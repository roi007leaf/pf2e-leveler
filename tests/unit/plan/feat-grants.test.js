import {
  buildFeatGrantRequirements,
  buildPlanFormulaProgressionRequirements,
  getFeatGrantCompletion,
} from '../../../scripts/plan/feat-grants.js';

function createFeat(overrides = {}) {
  return {
    uuid: 'Compendium.pf2e.feats-srd.Item.test',
    name: 'Generic Feat',
    type: 'feat',
    system: {
      description: { value: '' },
      rules: [],
      traits: { value: [] },
    },
    ...overrides,
  };
}

describe('feat grant requirements', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => {
      const docs = {
        'feat-spells': createFeat({
          uuid: 'feat-spells',
          name: 'Spell Grant',
          system: {
            description: {
              value: '<p>You add two common 1st-rank arcane spells of your choice to your spellbook.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-cantrips': createFeat({
          uuid: 'feat-cantrips',
          name: 'Cantrip Grant',
          system: {
            description: {
              value: '<p>You gain a spellbook with four common arcane cantrips of your choice.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-formulas': createFeat({
          uuid: 'feat-formulas',
          name: 'Formula Grant',
          system: {
            description: {
              value: '<p>You gain formulas for four common alchemical items of 1st level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-item': createFeat({
          uuid: 'feat-item',
          name: 'Item Grant',
          system: {
            description: {
              value: '<p>You gain one common weapon of 2nd level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-ambiguous': createFeat({
          uuid: 'feat-ambiguous',
          name: 'Ambiguous Grant',
          system: {
            description: {
              value: '<p>You gain formulas of your choice.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-demonbane': createFeat({
          uuid: 'feat-demonbane',
          name: 'Demonbane Warrior',
          system: {
            description: {
              value: '<p>You gain a +1 circumstance bonus to damage with weapons and unarmed attacks against demons.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-wandering-chef': createFeat({
          uuid: 'feat-wandering-chef',
          name: 'Wandering Chef Dedication',
          system: {
            description: {
              value: '<p>You gain the Alchemical Crafting and Quick Alchemy feats. Any items you choose with Alchemical Crafting must be alchemical food, but they can be 1st level or 2nd level instead of only 1st level.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feature-mutagenist': createFeat({
          uuid: 'feature-mutagenist',
          name: 'Mutagenist',
          system: {
            description: {
              value: '<p>You focus on bizarre mutagenic transformations that sacrifice one aspect of a creature. <strong>Formulas</strong> Two common 1st-level alchemical mutagens.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feature-bomber': createFeat({
          uuid: 'feature-bomber',
          name: 'Bomber',
          system: {
            description: {
              value: '<p>You specialize in explosions and other violent magical reactions. <strong>Formulas</strong> Two common 1st-level alchemical bombs.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feature-chirurgeon': createFeat({
          uuid: 'feature-chirurgeon',
          name: 'Chirurgeon',
          system: {
            description: {
              value: '<p><strong>Formulas</strong> Two common 1st-level alchemical elixirs with the healing trait.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feature-toxicologist': createFeat({
          uuid: 'feature-toxicologist',
          name: 'Toxicologist',
          system: {
            description: {
              value: '<p><strong>Formulas</strong> Two common 1st-level alchemical poisons.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-munitions-crafter': createFeat({
          uuid: 'feat-munitions-crafter',
          name: 'Munitions Crafter',
          system: {
            description: {
              value: '<p>You gain a formula book that includes the formula for black powder and four 1st-level types of common or uncommon alchemical ammunition or bombs of your choice.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-cauldron': createFeat({
          uuid: 'feat-cauldron',
          name: 'Cauldron',
          system: {
            description: {
              value: '<p>You immediately gain the formulas for four common 1st-level oils or potions. At 4th level and every 2 levels beyond that, you gain the formula for a common oil or potion of that level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-improbable-elixirs': createFeat({
          uuid: 'feat-improbable-elixirs',
          name: 'Improbable Elixirs',
          system: {
            description: {
              value: '<p>Select a number of potions equal to your Intelligence modifier (minimum 1); these potions must be of 9th level or lower. You gain formulas to create these potions as alchemical consumables with the elixir trait.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-brastlewark-snare-engineering': createFeat({
          uuid: 'feat-brastlewark-snare-engineering',
          name: 'Brastlewark Snare Engineering',
          system: {
            description: {
              value: '<p>You learn the formulas for crafting the pit illusion snare and the shadow cloak snare or two uncommon magical snares of your level or lower that you have access to.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-alchemical-scholar': createFeat({
          uuid: 'feat-alchemical-scholar',
          name: 'Alchemical Scholar',
          system: {
            description: {
              value: '<p>Add an additional common 1st-level alchemical formula to your formula book when you take this feat. Each time you gain a level beyond 1st, add one common alchemical formula of that level to your formula book.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-snare-crafting': createFeat({
          uuid: 'feat-snare-crafting',
          name: 'Snare Crafting',
          system: {
            description: {
              value: '<p>You add the formulas for four common 1st-level snares to your formula book.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-tattoo-artist': createFeat({
          uuid: 'feat-tattoo-artist',
          name: 'Tattoo Artist',
          system: {
            description: {
              value: '<p>When you select this feat, you gain the formulas for four common magical tattoos of 2nd level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-graft-technician': createFeat({
          uuid: 'feat-graft-technician',
          name: 'Graft Technician',
          system: {
            description: {
              value: '<p>When you select this feat, you gain the formulas for four common grafts of 3rd level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-skilled-herbalist': createFeat({
          uuid: 'feat-skilled-herbalist',
          name: 'Skilled Herbalist',
          system: {
            description: {
              value: '<p>You gain the Alchemical Crafting feat, except you must select the following items to add to your formula book: lesser antidote, lesser antiplague, and minor elixir of life, as well as a fourth 1st-level common alchemical formula of your choice.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-philosophers-stone': createFeat({
          uuid: 'feat-philosophers-stone',
          name: "Craft Philosopher's Stone",
          system: {
            description: {
              value: "<p>You learn the formula for the philosopher's stone.</p>",
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-gadget-specialist': createFeat({
          uuid: 'feat-gadget-specialist',
          name: 'Gadget Specialist',
          system: {
            description: {
              value: "<p>You gain the formulas for three common or uncommon gadgets. If you're a master in Crafting, you gain three additional common or uncommon gadget formulas. If you're legendary in Crafting, you gain another additional three common or uncommon gadget formulas, for a total of nine.</p>",
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-snare-specialist': createFeat({
          uuid: 'feat-snare-specialist',
          name: 'Snare Specialist',
          system: {
            description: {
              value: '<p>If your proficiency rank in Crafting is expert, you gain the formulas for three common or uncommon snares. If your rank is master, you gain 6. If your rank is legendary, you gain 9.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-talisman-dabbler': createFeat({
          uuid: 'feat-talisman-dabbler',
          name: 'Talisman Dabbler Dedication',
          system: {
            description: {
              value: '<p>You can craft talismans and know the formulas for all common talismans of your level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-poisoner': createFeat({
          uuid: 'feat-poisoner',
          name: 'Poisoner Dedication',
          system: {
            description: {
              value: "<p>You remember alchemical poison formulas and don't need a formula book for them.</p>",
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-firework-technician': createFeat({
          uuid: 'feat-firework-technician',
          name: 'Firework Technician Dedication',
          system: {
            description: {
              value: '<p>You gain the Alchemical Crafting skill feat. You can create magical or alchemical fireworks and choose their colors.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
        'feat-protective-screen': createFeat({
          uuid: 'feat-protective-screen',
          name: 'Protective Screen',
          system: {
            description: {
              value: '<p>Choose one ally. Until your next turn, that ally gains a bonus against spells and other effects.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        }),
      };
      return docs[uuid] ?? null;
    });
  });

  test('detects generic spellbook spell choices from description text', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-spells', name: 'Spell Grant' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        sourceFeatUuid: 'feat-spells',
        sourceFeatName: 'Spell Grant',
        kind: 'spell',
        count: 2,
        confidence: 'inferred',
        filters: expect.objectContaining({
          rank: 1,
          rarity: ['common'],
          tradition: 'arcane',
          spellbook: true,
        }),
      }),
    ]);
  });

  test('detects cantrip spellbook choices as rank 0 spells', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-cantrips', name: 'Cantrip Grant' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'spell',
        count: 4,
        confidence: 'inferred',
        filters: expect.objectContaining({
          rank: 0,
          rarity: ['common'],
          tradition: 'arcane',
          spellbook: true,
        }),
      }),
    ]);
  });

  test('detects generic formula choices with count, level, rarity, and traits', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-formulas', name: 'Formula Grant' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 4,
        confidence: 'inferred',
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['alchemical'],
        }),
      }),
    ]);
  });

  test('detects formula section count instead of earlier description numbers', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 1,
      feats: [{ uuid: 'feature-mutagenist', name: 'Mutagenist' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 2,
        confidence: 'inferred',
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['alchemical', 'mutagen'],
        }),
      }),
    ]);
  });

  test('detects bomber formulas without adding magical trait', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 1,
      feats: [{ uuid: 'feature-bomber', name: 'Bomber' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 2,
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['alchemical', 'bomb'],
        }),
      }),
    ]);
  });

  test('detects research field formula filters for chirurgeon and toxicologist', async () => {
    const chirurgeon = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feature-chirurgeon', name: 'Chirurgeon' }],
    });
    const toxicologist = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feature-toxicologist', name: 'Toxicologist' }],
    });

    expect(chirurgeon).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 2,
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['alchemical', 'elixir', 'healing'],
          traitLogic: 'and',
        }),
      }),
    ]);
    expect(toxicologist).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 2,
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['alchemical', 'poison'],
          traitLogic: 'and',
        }),
      }),
    ]);
  });

  test('detects counted special formula grants with source-specific filters', async () => {
    const munitions = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-munitions-crafter', name: 'Munitions Crafter' }],
    });
    const cauldron = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-cauldron', name: 'Cauldron' }],
    });
    const snare = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-snare-crafting', name: 'Snare Crafting' }],
    });
    const tattoo = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-tattoo-artist', name: 'Tattoo Artist' }],
    });
    const graft = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-graft-technician', name: 'Graft Technician' }],
    });

    expect(munitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        count: 4,
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common', 'uncommon'],
          requiredTraits: ['alchemical'],
          traits: ['bomb', 'ammunition'],
          traitLogic: 'or',
        }),
      }),
    ]));
    expect(cauldron).toEqual([
      expect.objectContaining({
        count: 4,
        filters: expect.objectContaining({
          maxLevel: 1,
          rarity: ['common'],
          traits: ['oil', 'potion'],
          traitLogic: 'or',
        }),
      }),
    ]);
    expect(snare).toEqual([
      expect.objectContaining({ count: 4, filters: expect.objectContaining({ maxLevel: 1, traits: ['snare'] }) }),
    ]);
    expect(tattoo).toEqual([
      expect.objectContaining({ count: 4, filters: expect.objectContaining({ maxLevel: 2, traits: ['magical', 'tattoo'], traitLogic: 'and' }) }),
    ]);
    expect(graft).toEqual([
      expect.objectContaining({ count: 4, filters: expect.objectContaining({ maxLevel: 3, traits: ['graft'] }) }),
    ]);
  });

  test('adds Cauldron progression formula at even levels beyond 2nd', async () => {
    const initial = await buildFeatGrantRequirements({
      level: 2,
      feats: [{ uuid: 'feat-cauldron', name: 'Cauldron' }],
    });
    const progression = await buildFeatGrantRequirements({
      level: 4,
      feats: [{ uuid: 'feat-cauldron', name: 'Cauldron' }],
    });

    expect(initial).toEqual([
      expect.objectContaining({
        id: 'feat-cauldron:formula',
        count: 4,
        filters: expect.objectContaining({ maxLevel: 1, traits: ['oil', 'potion'], traitLogic: 'or' }),
      }),
    ]);
    expect(progression).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-cauldron:formula',
        count: 4,
        filters: expect.objectContaining({ maxLevel: 1, traits: ['oil', 'potion'], traitLogic: 'or' }),
      }),
      expect.objectContaining({
        id: 'feat-cauldron:cauldron-level-4-formula',
        count: 1,
        filters: expect.objectContaining({ maxLevel: 4, rarity: ['common'], traits: ['oil', 'potion'], traitLogic: 'or' }),
      }),
    ]));
  });

  test('detects Improbable Elixirs from Intelligence modifier without empty elixir filter', async () => {
    const requirements = await buildFeatGrantRequirements({
      actor: { system: { abilities: { int: { mod: 4 } } } },
      level: 18,
      feats: [{ uuid: 'feat-improbable-elixirs', name: 'Improbable Elixirs' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        count: 4,
        filters: expect.objectContaining({
          maxLevel: 9,
          traits: ['potion'],
        }),
      }),
    ]);
    expect(requirements[0].filters.traits).not.toEqual(expect.arrayContaining(['alchemical', 'elixir']));
  });

  test('detects Brastlewark fixed snares and alternate uncommon magical snare choices', async () => {
    const requirements = await buildFeatGrantRequirements({
      level: 4,
      feats: [{ uuid: 'feat-brastlewark-snare-engineering', name: 'Brastlewark Snare Engineering' }],
    });

    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-brastlewark-snare-engineering:fixed-formula',
        count: 2,
        fixedSelections: [
          expect.objectContaining({ slug: 'pit-illusion-snare', name: 'Pit Illusion Snare' }),
          expect.objectContaining({ slug: 'shadow-cloak-snare', name: 'Shadow Cloak Snare' }),
        ],
      }),
      expect.objectContaining({
        id: 'feat-brastlewark-snare-engineering:formula',
        count: 2,
        filters: expect.objectContaining({
          maxLevel: 4,
          rarity: ['uncommon'],
          traits: ['magical', 'snare'],
          traitLogic: 'and',
        }),
      }),
    ]));
  });

  test('detects Alchemical Scholar initial and later-level formula progression', async () => {
    const initial = await buildFeatGrantRequirements({
      level: 1,
      feats: [{ uuid: 'feat-alchemical-scholar', name: 'Alchemical Scholar' }],
    });
    const progression = await buildFeatGrantRequirements({
      level: 5,
      feats: [{ uuid: 'feat-alchemical-scholar', name: 'Alchemical Scholar' }],
    });

    expect(initial).toEqual([
      expect.objectContaining({
        count: 1,
        filters: expect.objectContaining({ maxLevel: 1, rarity: ['common'], traits: ['alchemical'] }),
      }),
    ]);
    expect(progression).toEqual([
      expect.objectContaining({
        id: 'feat-alchemical-scholar:alchemical-scholar-level-5-formula',
        count: 1,
        filters: expect.objectContaining({ maxLevel: 5, rarity: ['common'], traits: ['alchemical'] }),
      }),
    ]);
  });

  test('builds formula progression requirements from earlier planned feats', async () => {
    const requirements = await buildPlanFormulaProgressionRequirements({
      level: 4,
      plan: {
        levels: {
          1: {
            ancestryFeats: [{ uuid: 'feat-alchemical-scholar', name: 'Alchemical Scholar' }],
          },
          2: {
            classFeats: [{ uuid: 'feat-cauldron', name: 'Cauldron' }],
          },
          4: {
            featGrants: [],
          },
        },
      },
    });

    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-alchemical-scholar:alchemical-scholar-level-4-formula',
        count: 1,
        filters: expect.objectContaining({ maxLevel: 4, rarity: ['common'], traits: ['alchemical'] }),
      }),
      expect.objectContaining({
        id: 'feat-cauldron:cauldron-level-4-formula',
        count: 1,
        filters: expect.objectContaining({ maxLevel: 4, rarity: ['common'], traits: ['oil', 'potion'] }),
      }),
    ]));
  });

  test('detects fixed formulas without turning them into user choices', async () => {
    const munitions = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-munitions-crafter', name: 'Munitions Crafter' }],
    });
    const herbalist = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-skilled-herbalist', name: 'Skilled Herbalist' }],
    });
    const philosopher = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-philosophers-stone', name: "Craft Philosopher's Stone" }],
    });

    expect(munitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-munitions-crafter:fixed-formula',
        kind: 'formula',
        count: 1,
        confidence: 'fixed',
        fixedSelections: [
          expect.objectContaining({ slug: 'black-powder', name: 'Black Powder' }),
        ],
      }),
      expect.objectContaining({ id: 'feat-munitions-crafter:formula', count: 4 }),
    ]));
    expect(herbalist).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-skilled-herbalist:fixed-formula',
        count: 3,
        confidence: 'fixed',
        fixedSelections: [
          expect.objectContaining({ slug: 'lesser-antidote' }),
          expect.objectContaining({ slug: 'lesser-antiplague' }),
          expect.objectContaining({ slug: 'minor-elixir-of-life' }),
        ],
      }),
      expect.objectContaining({ id: 'feat-skilled-herbalist:formula', count: 1 }),
    ]));
    expect(philosopher).toEqual([
      expect.objectContaining({
        id: 'feat-philosophers-stone:fixed-formula',
        count: 1,
        confidence: 'fixed',
        fixedSelections: [
          expect.objectContaining({ slug: 'philosophers-stone' }),
        ],
      }),
    ]);
  });

  test('scales counted formula grants from current Crafting proficiency', async () => {
    const masterActor = { system: { skills: { crafting: { rank: 3 } } } };
    const legendaryActor = { system: { skills: { crafting: { rank: 4 } } } };

    const masterGadgets = await buildFeatGrantRequirements({
      actor: masterActor,
      feats: [{ uuid: 'feat-gadget-specialist', name: 'Gadget Specialist' }],
    });
    const legendarySnares = await buildFeatGrantRequirements({
      actor: legendaryActor,
      feats: [{ uuid: 'feat-snare-specialist', name: 'Snare Specialist' }],
    });

    expect(masterGadgets).toEqual([
      expect.objectContaining({
        count: 6,
        filters: expect.objectContaining({
          rarity: ['common', 'uncommon'],
          traits: ['gadget'],
        }),
      }),
    ]);
    expect(legendarySnares).toEqual([
      expect.objectContaining({
        count: 9,
        filters: expect.objectContaining({
          rarity: ['common', 'uncommon'],
          traits: ['snare'],
        }),
      }),
    ]);
  });

  test('does not create bulk formula requirements for know-all formula features', async () => {
    const talismanDabbler = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-talisman-dabbler', name: 'Talisman Dabbler Dedication' }],
    });
    const poisoner = await buildFeatGrantRequirements({
      feats: [{ uuid: 'feat-poisoner', name: 'Poisoner Dedication' }],
    });

    expect(talismanDabbler).toEqual([]);
    expect(poisoner).toEqual([]);
  });

  test('adds alchemist starting and level-up formula grants', async () => {
    const starting = await buildFeatGrantRequirements({
      classEntries: [{ uuid: 'class-alchemist', slug: 'alchemist', name: 'Alchemist' }],
      level: 1,
    });
    const levelUp = await buildFeatGrantRequirements({
      classEntries: [{ uuid: 'class-alchemist', slug: 'alchemist', name: 'Alchemist' }],
      level: 2,
    });

    expect(starting).toEqual([
      expect.objectContaining({ id: 'class-alchemist:alchemical-crafting-formula', sourceFeatName: 'Alchemical Crafting', count: 4 }),
      expect.objectContaining({ id: 'class-alchemist:formula-book-formula', sourceFeatName: 'Formula Book', count: 2 }),
    ]);
    expect(levelUp).toEqual([
      expect.objectContaining({ id: 'class-alchemist:formula-book-level-2-formula', sourceFeatName: 'Formula Book', count: 2 }),
    ]);
  });

  test('detects generic item choices with count, level, rarity, and item type', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-item', name: 'Item Grant' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'item',
        count: 1,
        confidence: 'inferred',
        filters: expect.objectContaining({
          maxLevel: 2,
          rarity: ['common'],
          itemTypes: ['weapon'],
        }),
      }),
    ]);
  });

  test('does not treat damage bonuses mentioning weapons as item grants', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-demonbane', name: 'Demonbane Warrior' }],
    });

    expect(requirements).toEqual([]);
  });

  test('does not infer spell grants from non-spell choice text', async () => {
    const firework = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-firework-technician', name: 'Firework Technician Dedication' }],
    });
    const protective = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-protective-screen', name: 'Protective Screen' }],
    });

    expect(firework).toEqual([]);
    expect(protective).toEqual([]);
  });

  test('treats alchemical crafting item choices as formula choices', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-wandering-chef', name: 'Wandering Chef Dedication' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 4,
        filters: expect.objectContaining({
          maxLevel: 2,
          traits: ['alchemical', 'food'],
        }),
      }),
    ]);
  });

  test('emits manual requirement for ambiguous choice text', async () => {
    const requirements = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-ambiguous', name: 'Ambiguous Grant' }],
    });

    expect(requirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: null,
        confidence: 'manual-required',
      }),
    ]);
  });

  test('uses stable deterministic ids for the same source text', async () => {
    const first = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-formulas', name: 'Formula Grant' }],
    });
    const second = await buildFeatGrantRequirements({
      plan: {},
      level: 2,
      feats: [{ uuid: 'feat-formulas', name: 'Formula Grant' }],
    });

    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).toContain('feat-formulas');
  });

  test('computes selected and missing grant counts from stored level data', () => {
    const completion = getFeatGrantCompletion(
      {
        featGrants: [
          {
            requirementId: 'req-a',
            selections: [
              { uuid: 'item-a', name: 'A' },
            ],
          },
        ],
      },
      [
        { id: 'req-a', count: 2 },
        { id: 'req-b', count: null, confidence: 'manual-required' },
      ],
    );

    expect(completion).toEqual({
      'req-a': expect.objectContaining({ selected: 1, required: 2, missing: 1, complete: false }),
      'req-b': expect.objectContaining({ selected: 0, required: null, missing: null, complete: false }),
    });
  });
});
