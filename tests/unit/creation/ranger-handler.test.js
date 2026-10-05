import { getClassHandler } from '../../../scripts/creation/class-handlers/registry.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { RANGER } from '../../../scripts/classes/ranger.js';

const VINDICATORS_MARK_UUID = 'Compendium.pf2e.spells-srd.Item.LegaamqrflbArbWN';

describe('RangerHandler', () => {
  beforeEach(() => {
    ClassRegistry.clear();
    ClassRegistry.register(RANGER);
    global.foundry = { utils: { deepClone: (value) => JSON.parse(JSON.stringify(value)) } };
    global.fromUuid = jest.fn(async (uuid) => uuid === VINDICATORS_MARK_UUID ? {
      uuid,
      name: "Vindicator's Mark",
      toObject: () => ({ name: "Vindicator's Mark", type: 'spell', system: { traits: { value: ['focus'] } } }),
    } : null);
  });

  function createActor() {
    const actor = {
      items: [],
      system: { resources: { focus: { max: 0, value: 0 } } },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        const created = docs.map((doc) => ({ id: 'focus-ranger', ...doc }));
        actor.items.push(...created);
        actor.system.resources.focus.max = Math.min(3, actor.items.filter((item) => {
          const traits = item.system?.traits?.value ?? [];
          return item.type === 'spell' && traits.includes('focus') && !traits.includes('cantrip');
        }).length);
        return created;
      }),
      update: jest.fn(async () => {}),
    };
    return actor;
  }

  it('imports Vindicator focus spell with divine tradition and Wisdom through registered handler', async () => {
    const actor = createActor();
    const handler = getClassHandler('ranger');
    const data = {
      class: { slug: 'ranger', name: 'Ranger' },
      subclass: { slug: 'vindicator', name: 'Vindicator' },
    };

    expect(handler.needsSpellSelection(data, RANGER)).toBe(false);
    await handler.applyExtras(actor, data);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
      type: 'spellcastingEntry',
      system: expect.objectContaining({
        tradition: { value: 'divine' },
        prepared: { value: 'focus' },
        ability: { value: 'wis' },
      }),
    })]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
      name: "Vindicator's Mark",
      type: 'spell',
      system: expect.objectContaining({ location: { value: 'focus-ranger' } }),
    })]);
    expect(actor.update).toHaveBeenCalledWith({
      'system.resources.focus.value': 1,
    });
  });

  it('creates no spellcasting entry for ordinary ranger without focus spells', async () => {
    const actor = createActor();
    await getClassHandler('ranger').applyExtras(actor, {
      class: { slug: 'ranger', name: 'Ranger' },
      subclass: { slug: 'flurry', name: 'Flurry' },
    });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  it('does not require normal spell selection or import ordinary description-linked spells', async () => {
    const actor = createActor();
    const handler = getClassHandler('ranger');
    const data = {
      class: { slug: 'ranger', name: 'Ranger' },
      subclass: { slug: 'flurry', name: 'Flurry', spellUuids: ['ordinary-spell'] },
    };
    global.fromUuid = jest.fn(async () => ({
      uuid: 'ordinary-spell',
      type: 'spell',
      system: { level: { value: 1 }, traits: { value: [] } },
    }));

    expect(handler.needsSpellSelection(data, RANGER)).toBe(false);
    expect(handler.needsNonCasterSpellStep(data)).toBe(false);
    await handler.applyExtras(actor, data);
    expect(global.fromUuid).toHaveBeenCalledWith('ordinary-spell');
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
