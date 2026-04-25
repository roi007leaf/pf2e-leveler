import {
  buildFeatGrantRequirements,
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
              value: '<p>You specialize in explosions and other violent alchemical reactions. <strong>Formulas</strong> Two common 1st-level alchemical bombs.</p>',
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
      expect.objectContaining({ id: 'class-alchemist:formula-book-formula', sourceFeatName: 'Formula Book', count: 4 }),
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
