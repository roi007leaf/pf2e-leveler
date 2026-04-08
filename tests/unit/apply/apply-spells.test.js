import { applySpells } from '../../../scripts/apply/apply-spells.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { MAGUS } from '../../../scripts/classes/magus.js';
import { SORCERER } from '../../../scripts/classes/sorcerer.js';

describe('applySpells', () => {
  let actor;

  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(SORCERER);
    ClassRegistry.register(MAGUS);
  });

  beforeEach(() => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };

    actor = {
      items: [
        {
          id: 'primary-entry',
          type: 'spellcastingEntry',
          name: 'Sorcerer Spells',
          system: {
            tradition: { value: 'arcane' },
            prepared: { value: 'spontaneous' },
            ability: { value: 'cha' },
          },
        },
        {
          type: 'feat',
          slug: 'bloodline-genie',
          system: { traits: { otherTags: ['sorcerer-bloodline'] } },
          flags: { pf2e: { rulesSelections: { genie: 'ifrit' } } },
        },
      ],
      system: {
        resources: {
          focus: { max: 1, value: 1 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: doc.type === 'spellcastingEntry' ? `created-entry-${index}` : `created-item-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.spells-srd.Item.B3tbO85GBpzQ3u8l') {
        return {
          uuid,
          name: 'Wish-Twisted Form',
          img: 'wish.png',
          system: {
            traits: { value: ['focus'], traditions: [] },
          },
          toObject: () => ({
            name: 'Wish-Twisted Form',
            type: 'spell',
            system: {
              traits: { value: ['focus'], traditions: [] },
            },
          }),
        };
      }

      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('adds advanced subclass focus spell when advanced bloodline is applied', async () => {
    const plan = {
      classSlug: 'sorcerer',
      levels: {
        8: {
          classFeats: [
            { uuid: 'feat-advanced-bloodline', name: 'Advanced Bloodline', slug: 'advanced-bloodline' },
          ],
        },
      },
    };

    const added = await applySpells(actor, plan, 8);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Sorcerer Focus Spells',
        type: 'spellcastingEntry',
      }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Wish-Twisted Form',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
    expect(actor.update).toHaveBeenCalledWith({
      'system.resources.focus.max': 2,
      'system.resources.focus.value': 2,
    });
    expect(added).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Wish-Twisted Form' }),
    ]));
  });

  test('adds custom planned spells alongside standard planned spells', async () => {
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid === 'custom-spell' ? 'Custom Spell' : 'Normal Spell',
      img: 'spell.png',
      system: { level: { value: 1 }, traits: { value: ['arcane'] } },
      toObject: () => ({
        name: uuid === 'custom-spell' ? 'Custom Spell' : 'Normal Spell',
        type: 'spell',
        system: { level: { value: 1 }, traits: { value: ['arcane'] } },
      }),
    }));

    const plan = {
      classSlug: 'sorcerer',
      levels: {
        2: {
          spells: [{ uuid: 'normal-spell', name: 'Normal Spell', rank: 1 }],
          customSpells: [{ uuid: 'custom-spell', name: 'Custom Spell', rank: 1 }],
        },
      },
    };

    const added = await applySpells(actor, plan, 2);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({ name: 'Normal Spell' }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({ name: 'Custom Spell' }),
    ]);
    expect(added).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Normal Spell', rank: 1 }),
      expect.objectContaining({ name: 'Custom Spell', rank: 1 }),
    ]));
  });

  test('magus keeps only bounded top-rank slots on the main entry and creates a studious entry', async () => {
    const magusActor = {
      items: [
        {
          id: 'magus-primary-entry',
          type: 'spellcastingEntry',
          name: 'Magus Spells',
          system: {
            tradition: { value: 'arcane' },
            prepared: { value: 'prepared' },
            ability: { value: 'cha' },
          },
        },
      ],
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: doc.type === 'spellcastingEntry' ? `created-entry-${index}` : `created-item-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    const plan = {
      classSlug: 'magus',
      levels: {
        7: {},
      },
    };

    await applySpells(magusActor, plan, 7);

    expect(magusActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Magus Studious Spells',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            magusStudiousEntry: true,
          },
        },
      }),
    ]);

    expect(magusActor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'magus-primary-entry',
        'system.slots.slot1.max': 0,
        'system.slots.slot2.max': 0,
        'system.slots.slot3.max': 2,
        'system.slots.slot4.max': 2,
      }),
      expect.objectContaining({
        _id: 'created-entry-0',
        'system.slots.slot2.max': 2,
        'system.slots.slot3.max': 0,
        'system.slots.slot4.max': 0,
      }),
    ]));
  });
});
