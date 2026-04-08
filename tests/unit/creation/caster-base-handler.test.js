import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { DRUID } from '../../../scripts/classes/druid.js';
import { MAGUS } from '../../../scripts/classes/magus.js';
import { PSYCHIC } from '../../../scripts/classes/psychic.js';

describe('CasterBaseHandler._applySpellcasting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ClassRegistry.clear();
    ClassRegistry.register(DRUID);
    ClassRegistry.register(MAGUS);
    ClassRegistry.register(PSYCHIC);
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
    global.fromUuid = jest.fn(async (uuid) => {
      const name = uuid.split('.').pop();
      const rank = name === 'tangle-vine' ? 0 : 1;
      const traits = name === 'tangle-vine' ? ['cantrip'] : [];
      return {
        uuid,
        name,
        img: `${name}.webp`,
        system: {
          level: { value: rank },
          traits: { value: traits },
        },
        toObject: () => ({
          name,
          type: 'spell',
          system: {
            level: { value: rank },
            traits: { value: traits },
          },
        }),
      };
    });
  });

  it('adds only selected or granted spells for prepared non-spellbook casters', async () => {
    const createdDocs = [];
    const actor = {
      items: [],
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? 'entry-1' : `spell-${index}`, ...doc }));
      }),
      updateEmbeddedDocuments: jest.fn(async () => []),
    };

    const handler = new CasterBaseHandler();
    await handler._applySpellcasting(actor, {
      class: { slug: 'druid', name: 'Druid' },
      subclass: null,
      spells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.tangle-vine', name: 'Tangle Vine' },
        ],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.heal-animal', name: 'Heal Animal' },
        ],
      },
    });

    const createdSpells = createdDocs.filter((doc) => doc.type === 'spell');
    expect(createdSpells.map((doc) => doc.name)).toEqual(['tangle-vine', 'heal-animal']);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(3);
  });

  it('creates a separate studious spellcasting entry for magus at level 7+', async () => {
    const createdDocs = [];
    const actor = {
      items: [],
      system: {
        details: { level: { value: 7 } },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? `entry-${index}` : `spell-${index}`, ...doc }));
      }),
      updateEmbeddedDocuments: jest.fn(async () => []),
    };

    const handler = new CasterBaseHandler();
    await handler._applySpellcasting(actor, {
      class: { slug: 'magus', name: 'Magus' },
      subclass: null,
      spells: {
        cantrips: [],
        rank1: [],
      },
    });

    expect(createdDocs.filter((doc) => doc.type === 'spellcastingEntry')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Magus Spells' }),
      expect.objectContaining({
        name: 'Magus Studious Spells',
        flags: {
          'pf2e-leveler': {
            magusStudiousEntry: true,
          },
        },
      }),
    ]));

    expect(actor.updateEmbeddedDocuments).toHaveBeenNthCalledWith(1, 'Item', [
      expect.objectContaining({
        _id: 'entry-0',
        'system.slots.slot3.max': 2,
        'system.slots.slot4.max': 2,
      }),
    ]);
    expect(actor.updateEmbeddedDocuments).toHaveBeenNthCalledWith(2, 'Item', [
      expect.objectContaining({
        _id: 'entry-0',
        'system.slots.slot2.max': 2,
      }),
    ]);
  });

  it('does not add psychic subclass psi cantrips to the primary spellcasting entry', async () => {
    const createdDocs = [];
    const actor = {
      items: [],
      system: {
        details: { level: { value: 1 } },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? 'entry-1' : `spell-${index}`, ...doc }));
      }),
      updateEmbeddedDocuments: jest.fn(async () => []),
    };

    const handler = new CasterBaseHandler();
    await handler._applySpellcasting(actor, {
      class: { slug: 'psychic', name: 'Psychic' },
      subclass: { slug: 'the-infinite-eye', name: 'The Infinite Eye' },
      spells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.message', name: 'Message' },
        ],
        rank1: [],
      },
    });

    const createdSpells = createdDocs.filter((doc) => doc.type === 'spell');
    expect(createdSpells.map((doc) => doc.name).sort()).toEqual(['Gb7SeieEvd0pL2Eh', 'message']);
  });
});
