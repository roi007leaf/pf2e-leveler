import { applyFeatGrantEntries, applyFeatGrants } from '../../../scripts/apply/apply-feat-grants.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { WIZARD } from '../../../scripts/classes/wizard.js';

beforeAll(() => {
  if (!ClassRegistry.get('wizard')) ClassRegistry.register(WIZARD);
});

function createSourceItem(uuid, overrides = {}) {
  return {
    uuid,
    name: overrides.name ?? 'Granted Item',
    type: overrides.type ?? 'equipment',
    system: {
      level: { value: 1 },
      traits: { value: [] },
      ...(overrides.system ?? {}),
    },
    toObject: jest.fn(function () {
      return {
        uuid: this.uuid,
        name: this.name,
        type: this.type,
        system: this.system,
        flags: { core: { sourceId: this.uuid } },
      };
    }),
  };
}

describe('applyFeatGrants', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => createSourceItem(uuid, {
      name: uuid.includes('spell') ? 'Granted Spell' : 'Granted Item',
      type: uuid.includes('spell') ? 'spell' : 'equipment',
      system: uuid.includes('spell')
        ? { level: { value: 1 }, location: { value: null }, traits: { value: [], traditions: ['arcane'] } }
        : { level: { value: 1 }, traits: { value: ['alchemical'] } },
    }));
  });

  test('adds selected formulas to actor crafting formulas without duplicates', async () => {
    const actor = {
      system: {
        crafting: {
          formulas: [{ uuid: 'item-existing', sort: 10 }],
        },
      },
      items: [],
      update: jest.fn(async () => {}),
      createEmbeddedDocuments: jest.fn(),
    };
    const plan = {
      levels: {
        2: {
          featGrants: [
            {
              requirementId: 'req-formula',
              kind: 'formula',
              selections: [
                { uuid: 'item-existing', name: 'Existing Formula' },
                { uuid: 'item-new', name: 'New Formula' },
              ],
            },
          ],
        },
      },
    };

    const applied = await applyFeatGrants(actor, plan, 2);

    expect(actor.update).toHaveBeenCalledWith({
      'system.crafting.formulas': [
        { uuid: 'item-existing', sort: 10 },
        { uuid: 'item-new' },
      ],
    });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(applied.formulas).toEqual([{ uuid: 'item-new', name: 'New Formula' }]);
  });

  test('creates selected item grants unless actor already owns source item', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [
        { type: 'equipment', flags: { core: { sourceId: 'item-existing' } } },
      ],
      update: jest.fn(),
      createEmbeddedDocuments: jest.fn(async (type, items) => items.map((item, index) => ({ ...item, id: `created-${index}` }))),
    };
    const plan = {
      levels: {
        2: {
          featGrants: [
            {
              requirementId: 'req-item',
              kind: 'item',
              selections: [
                { uuid: 'item-existing', name: 'Existing Item' },
                { uuid: 'item-new', name: 'New Item' },
              ],
            },
          ],
        },
      },
    };

    const applied = await applyFeatGrants(actor, plan, 2);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({ uuid: 'item-new', name: 'Granted Item' }),
    ]);
    expect(applied.items).toEqual([{ uuid: 'item-new', name: 'New Item' }]);
  });

  test('adds alchemical item grant selections as formulas instead of owned items', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [],
      update: jest.fn(async () => {}),
      createEmbeddedDocuments: jest.fn(),
    };
    const plan = {
      levels: {
        2: {
          featGrants: [
            {
              requirementId: 'req-alchemical-items',
              kind: 'item',
              selections: [
                { uuid: 'item-food-a', name: 'Ration Tonic', traits: ['alchemical', 'consumable', 'food'] },
                { uuid: 'item-food-b', name: 'Treat', traits: ['alchemical', 'consumable', 'food'] },
              ],
            },
          ],
        },
      },
    };

    const applied = await applyFeatGrants(actor, plan, 2);

    expect(actor.update).toHaveBeenCalledWith({
      'system.crafting.formulas': [
        { uuid: 'item-food-a' },
        { uuid: 'item-food-b' },
      ],
    });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(applied.formulas).toEqual([
      { uuid: 'item-food-a', name: 'Ration Tonic' },
      { uuid: 'item-food-b', name: 'Treat' },
    ]);
  });

  test('adds selected spell grants to existing spellcasting entry', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [
        { id: 'entry-1', type: 'spellcastingEntry', name: 'Wizard Spells', system: { prepared: { value: 'prepared' } } },
      ],
      update: jest.fn(),
      createEmbeddedDocuments: jest.fn(async (type, items) => items),
    };
    const plan = {
      levels: {
        2: {
          featGrants: [
            {
              requirementId: 'req-spell',
              kind: 'spell',
              selections: [
                { uuid: 'spell-new', name: 'Granted Spell' },
              ],
            },
          ],
        },
      },
    };

    const applied = await applyFeatGrants(actor, plan, 2);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        uuid: 'spell-new',
        system: expect.objectContaining({
          location: { value: 'entry-1' },
        }),
      }),
    ]);
    expect(applied.spells).toEqual([{ uuid: 'spell-new', name: 'Granted Spell' }]);
  });

  test('creates and uses dedication spellcasting entry for feat-granted dedication spells', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [
        {
          id: 'sorcerer-entry',
          type: 'spellcastingEntry',
          name: 'Sorcerer Spells',
          system: {
            tradition: { value: 'divine' },
            prepared: { value: 'spontaneous' },
          },
        },
      ],
      update: jest.fn(async () => {}),
      updateEmbeddedDocuments: jest.fn(async () => {}),
      createEmbeddedDocuments: jest.fn(async (_type, items) => items.map((item, index) => ({
        ...item,
        id: item.type === 'spellcastingEntry' ? 'wizard-entry' : `created-spell-${index}`,
      }))),
    };
    const plan = {
      classSlug: 'sorcerer',
      levels: {
        2: {
          classFeats: [{ uuid: 'feat-wizard-dedication', name: 'Wizard Dedication', slug: 'wizard-dedication' }],
          featGrants: [
            {
              requirementId: 'feat-wizard-dedication:spell',
              sourceFeatUuid: 'feat-wizard-dedication',
              sourceFeatName: 'Wizard Dedication',
              kind: 'spell',
              selections: [
                { uuid: 'spell-cantrip', name: 'Detect Magic', rank: 1, traits: ['cantrip', 'arcane'] },
              ],
            },
          ],
        },
      },
    };

    const applied = await applyFeatGrants(actor, plan, 2);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Wizard Dedication Spells',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            archetypeSpellcastingEntry: 'wizard',
          },
        },
      }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        uuid: 'spell-cantrip',
        system: expect.objectContaining({
          location: { value: 'wizard-entry' },
        }),
      }),
    ]);
    expect(applied.spells).toEqual([{ uuid: 'spell-cantrip', name: 'Detect Magic' }]);
  });

  test('spell grants can create dedication entry directly from stored grant source', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [
        {
          id: 'sorcerer-entry',
          type: 'spellcastingEntry',
          name: 'Sorcerer Spells',
          system: {
            tradition: { value: 'divine' },
            prepared: { value: 'spontaneous' },
          },
        },
      ],
      update: jest.fn(async () => {}),
      createEmbeddedDocuments: jest.fn(async (_type, items) => items.map((item, index) => ({
        ...item,
        id: item.type === 'spellcastingEntry' ? 'wizard-entry' : `created-${index}`,
      }))),
    };

    const applied = await applyFeatGrantEntries(actor, [
      {
        requirementId: 'feat-wizard-dedication:spell',
        sourceFeatName: 'Wizard Dedication',
        kind: 'spell',
        selections: [{ uuid: 'spell-cantrip', name: 'Detect Magic', rank: 1, traits: ['cantrip', 'arcane'] }],
      },
    ]);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Wizard Dedication Spells',
        type: 'spellcastingEntry',
        system: expect.objectContaining({
          slots: {
            slot0: { max: 2, value: 2 },
          },
        }),
      }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        uuid: 'spell-cantrip',
        system: expect.objectContaining({
          location: { value: 'wizard-entry' },
        }),
      }),
    ]);
    expect(applied.spells).toEqual([{ uuid: 'spell-cantrip', name: 'Detect Magic' }]);
  });

  test('updates existing dedication spellcasting entry to two cantrip slots', async () => {
    const actor = {
      system: { crafting: { formulas: [] } },
      items: [
        {
          id: 'wizard-entry',
          type: 'spellcastingEntry',
          name: 'Wizard Dedication Spells',
          flags: { 'pf2e-leveler': { archetypeSpellcastingEntry: 'wizard' } },
          system: {
            tradition: { value: 'arcane' },
            prepared: { value: 'prepared' },
            slots: { slot0: { max: 0, value: 0 } },
          },
        },
      ],
      update: jest.fn(async () => {}),
      updateEmbeddedDocuments: jest.fn(async () => {}),
      createEmbeddedDocuments: jest.fn(async (_type, items) => items),
    };

    await applyFeatGrantEntries(actor, [
      {
        requirementId: 'feat-wizard-dedication:spell',
        sourceFeatName: 'Wizard Dedication',
        kind: 'spell',
        selections: [{ uuid: 'spell-cantrip', name: 'Detect Magic', rank: 1, traits: ['cantrip', 'arcane'] }],
      },
    ]);

    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      _id: 'wizard-entry',
      'system.slots.slot0.max': 2,
      'system.slots.slot0.value': 2,
    }]);
  });
});
