import { applySpells } from '../../../scripts/apply/apply-spells.js';
import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { SUMMONER } from '../../../scripts/classes/summoner.js';
import { buildSpellContext } from '../../../scripts/ui/level-planner/spells.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';

function makeActor(remaster = true) {
  return {
    items: [
      { type: 'class', slug: 'summoner', system: { publication: { remaster } } },
      { id: 'primary', type: 'spellcastingEntry', name: 'Summoner Spells', update: jest.fn(async () => {}), system: {
        tradition: { value: 'primal' }, prepared: { value: 'spontaneous' }, ability: { value: 'cha' },
      } },
      { id: 'known', type: 'spell', system: { location: { value: 'primary', signature: true } } },
    ],
    system: { details: { level: { value: 7 } }, resources: { focus: { max: 0, value: 0 } } },
    createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc) => ({ ...doc, id: 'created' }))),
    updateEmbeddedDocuments: jest.fn(async () => []),
    deleteEmbeddedDocuments: jest.fn(),
    update: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  ClassRegistry.clear();
  ClassRegistry.register(SUMMONER);
  global.fromUuid = jest.fn(async () => null);
});

test.each(Array.from({ length: 20 }, (_, i) => i + 1))('remastered Summoner applies all spell ranks at level %s', async (level) => {
  const actor = makeActor();
  const before = JSON.stringify(actor.items);
  await applySpells(actor, { classSlug: 'summoner', levels: { [level]: {} } }, level);
  const updates = actor.updateEmbeddedDocuments.mock.calls.flatMap(([, docs]) => docs);
  expect(updates).toHaveLength(1);
  expect(updates[0]._id).toBe('primary');
  const highest = Math.min(9, Math.ceil(level / 2));
  for (let rank = 1; rank <= highest; rank++) {
    expect(updates[0][`system.slots.slot${rank}.max`]).toBe(rank === highest && level < 18 && level % 2 ? 1 : 2);
  }
  expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  expect(JSON.stringify(actor.items)).toBe(before);
});

test('legacy Summoner keeps legacy highest-rank progression', async () => {
  const actor = makeActor(false);
  await applySpells(actor, { classSlug: 'summoner', levels: { 7: {} } }, 7);
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
    _id: 'primary', 'system.slots.slot3.max': 2, 'system.slots.slot4.max': 2,
  })]);
});

test('creation applies remastered Summoner slots', async () => {
  const actor = makeActor();
  await new CasterBaseHandler()._applySpellcasting(actor, {
    class: { slug: 'summoner', name: 'Summoner' }, subclass: { tradition: 'primal' },
    spells: { cantrips: [], rank1: [] },
  });
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
    _id: 'primary', 'system.slots.slot1.max': 2, 'system.slots.slot4.max': 1,
  })]);
});

test('planner requests the second rank-4 spell at level 8 for remastered Summoner', async () => {
  const actor = makeActor();
  const context = await buildSpellContext({ actor, _ordinalRank: String, plan: { classSlug: 'summoner', levels: { 8: {} } } }, SUMMONER, 8);
  expect(context.spellSlots).toEqual(expect.arrayContaining([expect.objectContaining({ rankNum: 4, newSlots: 1 })]));
});

test.each([true, false])('planner projects edition-specific Signature Spells (remaster=%s)', (remaster) => {
  const actor = makeActor(remaster);
  const state = computeBuildState(actor, { classSlug: 'summoner', levels: {} }, 3);
  expect(state.classFeatures.has('signature-spells')).toBe(remaster);
  expect(state.classFeatures.has('unlimited-signature-spells')).toBe(!remaster);
  expect(SUMMONER.classFeatures.some((feature) => feature.key === 'unlimited-signature-spells')).toBe(true);
});
