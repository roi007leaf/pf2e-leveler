import { applySpells } from '../../../scripts/apply/apply-spells.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { DRUID } from '../../../scripts/classes/druid.js';
import { FIGHTER } from '../../../scripts/classes/fighter.js';
import { MAGUS } from '../../../scripts/classes/magus.js';
import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { WIZARD } from '../../../scripts/classes/wizard.js';

describe('applySpells', () => {
  let actor;

  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(DRUID);
    ClassRegistry.register(FIGHTER);
    ClassRegistry.register(SORCERER);
    ClassRegistry.register(MAGUS);
    ClassRegistry.register(WIZARD);
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

  test('adds dragon breath for draconic advanced bloodline even if stored focus UUID resolves to the wrong spell', async () => {
    const originalGame = global.game;
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

    actor.items = [
      actor.items[0],
      {
        type: 'feat',
        slug: 'bloodline-draconic',
        system: { traits: { otherTags: ['sorcerer-bloodline'] } },
        flags: { pf2e: { rulesSelections: { dragonBloodline: 'red' } } },
      },
    ];

    global.game = {
      ...(originalGame ?? {}),
      packs: new Map([
        ['pf2e.spells-srd', {
          getIndex: jest.fn(async () => [{
            uuid: 'Compendium.pf2e.spells-srd.Item.dragon-breath',
            name: 'Dragon Breath',
          }]),
        }],
      ]),
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.spells-srd.Item.HWJODX2zPg5cg34F') {
        return {
          uuid,
          name: 'Wrong Focus Spell',
          img: 'wrong.png',
          system: {
            traits: { value: ['focus'], traditions: [] },
          },
          toObject: () => ({
            name: 'Wrong Focus Spell',
            system: {
              traits: { value: ['focus'], traditions: [] },
            },
          }),
        };
      }
      if (uuid === 'Compendium.pf2e.spells-srd.Item.dragon-breath') {
        return {
          uuid,
          name: 'Dragon Breath',
          img: 'dragon-breath.png',
          system: {
            traits: { value: ['focus'], traditions: [] },
          },
          toObject: () => ({
            name: 'Dragon Breath',
            system: {
              traits: { value: ['focus'], traditions: [] },
            },
          }),
        };
      }
      return null;
    });

    try {
      const added = await applySpells(actor, plan, 8);

      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
        expect.objectContaining({
          name: 'Sorcerer Focus Spells',
          type: 'spellcastingEntry',
        }),
      ]);
      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
        expect.objectContaining({
          name: 'Dragon Breath',
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
        expect.objectContaining({ name: 'Dragon Breath' }),
      ]));
    } finally {
      global.game = originalGame;
    }
  });

  test('resolves subclass focus spell name overrides from SF2e spell packs', async () => {
    const originalGame = global.game;
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

    actor.items = [
      actor.items[0],
      {
        type: 'feat',
        slug: 'bloodline-draconic',
        system: { traits: { otherTags: ['sorcerer-bloodline'] } },
        flags: { pf2e: { rulesSelections: { dragonBloodline: 'red' } } },
      },
    ];

    global.game = {
      ...(originalGame ?? {}),
      system: { id: 'sf2e' },
      packs: new Map([
        ['sf2e.spells', {
          getIndex: jest.fn(async () => [{
            _id: 'dragon-breath',
            name: 'Dragon Breath',
          }]),
        }],
      ]),
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.spells-srd.Item.HWJODX2zPg5cg34F') {
        return {
          uuid,
          name: 'Wrong Focus Spell',
          system: { traits: { value: ['focus'], traditions: [] } },
          toObject: () => ({
            name: 'Wrong Focus Spell',
            system: { traits: { value: ['focus'], traditions: [] } },
          }),
        };
      }
      if (uuid === 'Compendium.sf2e.spells.Item.dragon-breath') {
        return {
          uuid,
          name: 'Dragon Breath',
          system: { traits: { value: ['focus'], traditions: [] } },
          toObject: () => ({
            name: 'Dragon Breath',
            system: { traits: { value: ['focus'], traditions: [] } },
          }),
        };
      }
      return null;
    });

    try {
      await applySpells(actor, plan, 8);

      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
        expect.objectContaining({
          name: 'Dragon Breath',
          system: expect.objectContaining({
            location: { value: 'created-entry-0' },
          }),
        }),
      ]);
    } finally {
      global.game = originalGame;
    }
  });

  test('creates and updates separate secondary dual-class spellcasting entries', async () => {
    global._testSettings = {
      pf2e: { dualClassVariant: true },
      'pf2e-leveler': { enableDualClassSupport: true },
    };

    const plan = {
      classSlug: 'sorcerer',
      dualClassSlug: 'wizard',
      levels: {
        3: {},
      },
    };

    await applySpells(actor, plan, 3);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Wizard Spells',
        type: 'spellcastingEntry',
      }),
    ]);
    expect(actor.updateEmbeddedDocuments).toHaveBeenNthCalledWith(1, 'Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'primary-entry',
        'system.slots.slot1.max': 4,
        'system.slots.slot2.max': 3,
      }),
    ]));
    expect(actor.updateEmbeddedDocuments).toHaveBeenNthCalledWith(2, 'Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'created-entry-0',
        'system.slots.slot1.max': 3,
        'system.slots.slot2.max': 2,
      }),
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

  test('adds planned studious spells to the Magus Studious spellcasting entry', async () => {
    const magusActor = {
      items: [
        {
          id: 'magus-primary-entry',
          type: 'spellcastingEntry',
          name: 'Magus Spells',
          system: {
            tradition: { value: 'arcane' },
            prepared: { value: 'prepared' },
            ability: { value: 'int' },
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

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Resist Energy',
      img: 'spell.png',
      system: { level: { value: 2 }, traits: { value: ['arcane'] } },
      toObject: () => ({
        name: 'Resist Energy',
        type: 'spell',
        system: { level: { value: 2 }, traits: { value: ['arcane'] } },
      }),
    }));

    const plan = {
      classSlug: 'magus',
      levels: {
        7: {
          spells: [{
            uuid: 'studious-spell',
            name: 'Resist Energy',
            rank: 2,
            entryType: 'studious',
          }],
        },
      },
    };

    await applySpells(magusActor, plan, 7);

    expect(magusActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Magus Studious Spells',
        type: 'spellcastingEntry',
      }),
    ]);
    expect(magusActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Resist Energy',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
  });

  test('creates an archetype spellcasting entry for a spellcasting dedication', async () => {
    const archetypeActor = {
      items: [
        {
          id: 'druid-dedication',
          type: 'feat',
          name: 'Druid Dedication',
          slug: 'druid-dedication',
          system: {
            traits: { value: ['archetype', 'dedication', 'druid', 'multiclass'] },
          },
        },
      ],
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: `created-entry-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    const plan = {
      classSlug: 'fighter',
      levels: {
        2: {
          archetypeFeats: [{ uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication', slug: 'druid-dedication', name: 'Druid Dedication' }],
        },
      },
    };

    await applySpells(archetypeActor, plan, 2);

    expect(archetypeActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Druid Dedication Spells',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            archetypeSpellcastingEntry: 'druid',
          },
        },
        system: expect.objectContaining({
          tradition: { value: 'primal' },
          prepared: { value: 'prepared' },
        }),
      }),
    ]);
    expect(archetypeActor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'created-entry-0',
        'system.slots.slot0.max': 2,
        'system.slots.slot1.max': 0,
      }),
    ]));
  });

  test('creates an archetype spellcasting entry from planned dedication feats even before actor feat embed sync', async () => {
    const archetypeActor = {
      items: [],
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: `created-entry-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    const plan = {
      classSlug: 'fighter',
      levels: {
        2: {
          archetypeFeats: [{ uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication', slug: 'druid-dedication', name: 'Druid Dedication' }],
        },
      },
    };

    await applySpells(archetypeActor, plan, 2);

    expect(archetypeActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Druid Dedication Spells',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            archetypeSpellcastingEntry: 'druid',
          },
        },
      }),
    ]);
    expect(archetypeActor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'created-entry-0',
        'system.slots.slot0.max': 2,
      }),
    ]));
  });

  test('creates planned custom spellcasting entries and adds targeted custom spells into them', async () => {
    const targetedActor = {
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
      ],
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: doc.type === 'spellcastingEntry' ? `created-entry-${index}` : `created-spell-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Targeted Spell',
      img: 'spell.png',
      system: { level: { value: 1 }, traits: { value: ['occult'] } },
      toObject: () => ({
        name: 'Targeted Spell',
        type: 'spell',
        system: { level: { value: 1 }, traits: { value: ['occult'] } },
      }),
    }));

    const plan = {
      classSlug: 'sorcerer',
      levels: {
        2: {
          customSpellEntries: [
            {
              key: 'custom-occult',
              name: 'Occult Sidebook',
              tradition: 'occult',
              prepared: 'prepared',
              ability: 'int',
            },
          ],
          customSpells: [
            {
              uuid: 'targeted-custom-spell',
              name: 'Targeted Spell',
              rank: 1,
              entryType: 'custom:custom-occult',
            },
          ],
        },
      },
    };

    await applySpells(targetedActor, plan, 2);

    expect(targetedActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Occult Sidebook',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            customSpellcastingEntry: 'custom-occult',
          },
        },
        system: expect.objectContaining({
          tradition: { value: 'occult' },
          prepared: { value: 'prepared' },
          ability: { value: 'int' },
        }),
      }),
    ]);
    expect(targetedActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Targeted Spell',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
  });

  test('basic archetype spellcasting benefits grant the standard multiclass slot progression', async () => {
    const archetypeActor = {
      items: [
        {
          id: 'druid-dedication',
          type: 'feat',
          name: 'Druid Dedication',
          slug: 'druid-dedication',
          system: {
            traits: { value: ['archetype', 'dedication', 'druid', 'multiclass'] },
          },
        },
        {
          id: 'basic-druid-spellcasting',
          type: 'feat',
          name: 'Basic Druid Spellcasting',
          slug: 'basic-druid-spellcasting',
          system: {
            traits: { value: ['archetype', 'druid'] },
          },
        },
      ],
      system: {
        resources: {
          focus: { max: 0, value: 0 },
        },
      },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({
        id: `created-entry-${index}`,
        ...doc,
      }))),
      updateEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };

    const plan = {
      classSlug: 'fighter',
      levels: {
        8: {
          archetypeFeats: [
            { uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication', slug: 'druid-dedication', name: 'Druid Dedication' },
            { uuid: 'Compendium.pf2e.feats-srd.Item.basic-druid-spellcasting', slug: 'basic-druid-spellcasting', name: 'Basic Druid Spellcasting' },
          ],
        },
      },
    };

    await applySpells(archetypeActor, plan, 8);

    expect(archetypeActor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.arrayContaining([
      expect.objectContaining({
        _id: 'created-entry-0',
        'system.slots.slot0.max': 2,
        'system.slots.slot1.max': 1,
        'system.slots.slot2.max': 1,
        'system.slots.slot3.max': 1,
        'system.slots.slot4.max': 0,
      }),
    ]));
  });

  test('adds planned dedication spells to the newly created dedication spellcasting entry', async () => {
    const archetypeActor = {
      items: [],
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

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid === 'wizard-cantrip-a' ? 'Detect Magic' : 'Read Aura',
      img: 'spell.png',
      system: { level: { value: 0 }, traits: { value: ['arcane', 'cantrip'] } },
      toObject: () => ({
        name: uuid === 'wizard-cantrip-a' ? 'Detect Magic' : 'Read Aura',
        type: 'spell',
        system: { level: { value: 0 }, traits: { value: ['arcane', 'cantrip'] } },
      }),
    }));

    const plan = {
      classSlug: 'magus',
      levels: {
        2: {
          archetypeFeats: [{ uuid: 'Compendium.pf2e.feats-srd.Item.wizard-dedication', slug: 'wizard-dedication', name: 'Wizard Dedication' }],
          spells: [
            { uuid: 'wizard-cantrip-a', name: 'Detect Magic', rank: 0, isCantrip: true, entryType: 'archetype:wizard' },
            { uuid: 'wizard-cantrip-b', name: 'Read Aura', rank: 0, isCantrip: true, entryType: 'archetype:wizard' },
          ],
        },
      },
    };

    await applySpells(archetypeActor, plan, 2);

    expect(archetypeActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Wizard Dedication Spells',
        type: 'spellcastingEntry',
      }),
    ]);
    expect(archetypeActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Detect Magic',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
    expect(archetypeActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Read Aura',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
  });

  test('creates planned custom spellcasting entries and adds targeted custom spells to them', async () => {
    const customActor = {
      items: [],
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

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Mystic Bolt',
      img: 'spell.png',
      system: { level: { value: 1 }, traits: { value: ['arcane'] } },
      toObject: () => ({
        name: 'Mystic Bolt',
        type: 'spell',
        system: { level: { value: 1 }, traits: { value: ['arcane'] } },
      }),
    }));

    const plan = {
      classSlug: 'sorcerer',
      levels: {
        2: {
          customSpellEntries: [{
            key: 'planner-entry',
            name: 'Ritual Notes',
            tradition: 'occult',
            prepared: 'prepared',
            ability: 'int',
          }],
          customSpells: [{
            uuid: 'custom-spell',
            name: 'Mystic Bolt',
            rank: 1,
            entryType: 'custom:planner-entry',
          }],
        },
      },
    };

    await applySpells(customActor, plan, 2);

    expect(customActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Ritual Notes',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            customSpellcastingEntry: 'planner-entry',
          },
        },
      }),
    ]);
    expect(customActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Mystic Bolt',
        system: expect.objectContaining({
          location: { value: 'created-entry-0' },
        }),
      }),
    ]);
  });
});
