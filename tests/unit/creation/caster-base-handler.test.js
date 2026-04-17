import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { DRUID } from '../../../scripts/classes/druid.js';
import { MAGUS } from '../../../scripts/classes/magus.js';
import { PSYCHIC } from '../../../scripts/classes/psychic.js';
import { WitchHandler } from '../../../scripts/creation/class-handlers/witch.js';

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

  it('creates a separate spellcasting entry when a different class entry already exists', async () => {
    const createdDocs = [];
    const actor = {
      items: [{
        id: 'entry-witch',
        type: 'spellcastingEntry',
        name: 'Witch Spells',
        system: {
          tradition: { value: 'arcane' },
          prepared: { value: 'prepared' },
          ability: { value: 'int' },
        },
      }],
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? `entry-${index}` : `spell-${index}`, ...doc }));
      }),
      updateEmbeddedDocuments: jest.fn(async () => []),
      system: {
        details: { level: { value: 1 } },
      },
    };

    const handler = new CasterBaseHandler();
    await handler._applySpellcasting(actor, {
      class: { slug: 'druid', name: 'Druid' },
      subclass: null,
      spells: {
        cantrips: [{ uuid: 'Compendium.pf2e.spells-srd.Item.tangle-vine', name: 'Tangle Vine' }],
        rank1: [],
      },
    });

    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spellcastingEntry',
        name: 'Druid Spells',
      }),
    ]));
    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spell',
        system: expect.objectContaining({
          location: { value: 'entry-0' },
        }),
      }),
    ]));
  });
});

describe('CasterBaseHandler._applyFocusSpells', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
  });

  it('creates a separate focus entry when another class focus entry already exists', async () => {
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Phase Familiar',
      img: 'phase-familiar.webp',
      toObject: () => ({
        name: 'Phase Familiar',
        type: 'spell',
        system: { traits: { value: ['focus'] } },
      }),
    }));

    const actor = {
      items: [{
        id: 'focus-witch',
        type: 'spellcastingEntry',
        name: 'Witch Focus Spells',
        system: {
          tradition: { value: 'arcane' },
          prepared: { value: 'focus' },
          ability: { value: 'int' },
        },
      }],
      createEmbeddedDocuments: jest.fn(async (_type, docs) =>
        docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? `focus-${index}` : `spell-${index}`, ...doc }))),
      update: jest.fn(async () => {}),
    };

    const handler = new CasterBaseHandler();
    jest.spyOn(handler, 'resolveFocusSpells').mockResolvedValue([
      { uuid: 'Compendium.pf2e.spells-srd.Item.phase-familiar', name: 'Phase Familiar', img: 'phase-familiar.webp' },
    ]);

    await handler._applyFocusSpells(actor, {
      class: { slug: 'champion', name: 'Champion' },
      subclass: null,
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        type: 'spellcastingEntry',
        name: 'Champion Focus Spells',
      }),
    ]));
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        type: 'spell',
        system: expect.objectContaining({
          location: { value: 'focus-0' },
        }),
      }),
    ]));
  });
});

describe('WitchHandler._applyChosenHex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
  });

  it('creates a separate witch focus entry when another class focus entry already exists', async () => {
    global.fromUuid = jest.fn(async () => ({
      uuid: 'Compendium.pf2e.spells-srd.Item.phase-familiar',
      name: 'Phase Familiar',
      img: 'phase-familiar.webp',
      toObject: () => ({
        name: 'Phase Familiar',
        type: 'spell',
        system: { traits: { value: ['focus'] } },
      }),
    }));

    const createdDocs = [];
    const actor = {
      items: [{
        id: 'focus-bard',
        type: 'spellcastingEntry',
        name: 'Bard Focus Spells',
        system: {
          tradition: { value: 'occult' },
          prepared: { value: 'focus' },
          ability: { value: 'cha' },
        },
      }],
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? `focus-${index}` : `spell-${index}`, ...doc }));
      }),
      update: jest.fn(async () => {}),
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
    };

    const handler = new WitchHandler();
    await handler._applyChosenHex(actor, {
      class: { slug: 'witch', name: 'Witch' },
      subclass: { tradition: 'arcane' },
      devotionSpell: { uuid: 'Compendium.pf2e.spells-srd.Item.phase-familiar' },
    });

    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spellcastingEntry',
        name: 'Witch Focus Spells',
      }),
      expect.objectContaining({
        type: 'spell',
        system: expect.objectContaining({
          location: { value: 'focus-0' },
        }),
      }),
    ]));
  });
});
