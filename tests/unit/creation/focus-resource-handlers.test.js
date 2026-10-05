jest.mock('../../../scripts/creation/apply-creation.js', () => ({ applyItem: jest.fn() }));

import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { PsychicHandler } from '../../../scripts/creation/class-handlers/psychic.js';
import { ChampionHandler } from '../../../scripts/creation/class-handlers/champion.js';
import { WitchHandler } from '../../../scripts/creation/class-handlers/witch.js';

// PF2e prepares max from non-cantrip focus spells, rule bonuses, and the cap of 3.
function makeActor(ruleBonus = 0) {
  const actor = {
    items: [],
    system: { resources: { focus: { max: ruleBonus, value: 0 } } },
    update: jest.fn(async () => {}),
    createEmbeddedDocuments: jest.fn(async (_type, docs) => {
      const created = docs.map((doc) => ({ id: `item-${actor.items.length}`, ...doc }));
      actor.items.push(...created);
      actor.system.resources.focus.max = Math.min(3, ruleBonus + actor.items.filter((item) => {
        const traits = item.system?.traits?.value ?? [];
        return item.type === 'spell' && traits.includes('focus') && !traits.includes('cantrip');
      }).length);
      return created;
    }),
  };
  return actor;
}

describe('native derived focus resources', () => {
  beforeEach(() => {
    global.foundry = { utils: { deepClone: (value) => JSON.parse(JSON.stringify(value)) } };
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid,
      toObject: () => ({ name: uuid, type: 'spell', system: { traits: { value: uuid.startsWith('cantrip') ? ['focus', 'cantrip'] : ['focus'] } } }),
    }));
  });

  test.each([
    ['cantrip-only', CasterBaseHandler, ['cantrip-1'], 0, 0],
    ['two focus spells', CasterBaseHandler, ['spell-1', 'spell-2'], 0, 2],
    ['psychic rule bonus', PsychicHandler, ['cantrip-1', 'cantrip-2'], 2, 2],
    ['native cap', CasterBaseHandler, ['spell-1', 'spell-2', 'spell-3', 'spell-4'], 0, 3],
  ])('%s uses prepared max', async (_name, Handler, uuids, bonus, expected) => {
    const actor = makeActor(bonus);
    const handler = new Handler();
    jest.spyOn(handler, 'resolveFocusSpells').mockResolvedValue(uuids.map((uuid) => ({ uuid })));
    await handler._applyFocusSpells(actor, { class: { name: 'Test' } });
    expect(actor.system.resources.focus.max).toBe(expected);
    if (expected === 0) expect(actor.update).not.toHaveBeenCalled();
    else expect(actor.update).toHaveBeenCalledWith({ 'system.resources.focus.value': expected });
  });

  test.each([ChampionHandler, WitchHandler])('%p refills pool after chosen spell creation', async (Handler) => {
    const actor = makeActor(1);
    const handler = new Handler();
    const data = { class: { name: 'Test' }, devotionSpell: { uuid: 'spell-1' } };
    if (handler instanceof WitchHandler) await handler._applyChosenHex(actor, data);
    else await handler.applyExtras(actor, data);
    expect(actor.update).toHaveBeenCalledWith({ 'system.resources.focus.value': 2 });
  });

  test('champion refills existing spell pool without duplicating spell', async () => {
    const actor = makeActor(2);
    actor.items.push({ type: 'spell', sourceId: 'spell-1' });
    await new ChampionHandler().applyExtras(actor, { devotionSpell: { uuid: 'spell-1' } });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(actor.update).toHaveBeenCalledWith({ 'system.resources.focus.value': 2 });
  });

  test('existing full focus pool needs no write', async () => {
    const actor = makeActor(3);
    actor.system.resources.focus.value = 3;
    actor.items.push({ type: 'spell', sourceId: 'spell-1' });
    const handler = new CasterBaseHandler();
    jest.spyOn(handler, 'resolveFocusSpells').mockResolvedValue([{ uuid: 'spell-1' }]);
    await handler._applyFocusSpells(actor, {});
    expect(actor.update).not.toHaveBeenCalled();
  });
});
