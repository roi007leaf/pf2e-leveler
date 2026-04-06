import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { getPlan, savePlan } from '../../../scripts/plan/plan-store.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';

jest.mock('../../../scripts/plan/plan-store.js', () => ({
  getPlan: jest.fn(() => null),
  savePlan: jest.fn(),
  clearPlan: jest.fn(),
  exportPlan: jest.fn(),
  importPlan: jest.fn(),
}));

jest.mock('../../../scripts/utils/i18n.js', () => ({
  localize: jest.fn((key) => key),
}));

describe('LevelPlanner bootstrap from existing actor', () => {
  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);
  });

  beforeEach(() => {
    getPlan.mockReturnValue(null);
  });

  it('seeds obvious boosts and feats into a new plan for higher-level characters', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: ['str', 'dex', 'con', 'int'],
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 5: 4, 10: 4, 15: 4, 20: 4 },
            flaws: { ancestry: [] },
          },
        },
        abilities: {
          str: { mod: 1 },
          dex: { mod: 1 },
          con: { mod: 1 },
          int: { mod: 1 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
        skills: {
          acrobatics: { rank: 0, value: 0 },
          arcana: { rank: 0, value: 0 },
          athletics: { rank: 0, value: 0 },
          crafting: { rank: 0, value: 0 },
          deception: { rank: 0, value: 0 },
          diplomacy: { rank: 0, value: 0 },
          intimidation: { rank: 0, value: 0 },
          medicine: { rank: 1, value: 1 },
          nature: { rank: 0, value: 0 },
          occultism: { rank: 0, value: 0 },
          performance: { rank: 0, value: 0 },
          religion: { rank: 0, value: 0 },
          society: { rank: 0, value: 0 },
          stealth: { rank: 0, value: 0 },
          survival: { rank: 0, value: 0 },
          thievery: { rank: 0, value: 0 },
        },
      },
      items: [
        {
          type: 'feat',
          uuid: 'Actor.test.Item.class2',
          sourceId: 'Compendium.pf2e.feats-srd.Item.quick-bomber',
          slug: 'quick-bomber',
          name: 'Quick Bomber',
          img: 'icons/quick-bomber.webp',
          system: {
            category: 'class',
            level: { value: 1, taken: 2 },
            location: 'class-2',
            traits: { value: ['alchemist'] },
            rules: [],
          },
        },
        {
          type: 'feat',
          uuid: 'Actor.test.Item.skill2',
          sourceId: 'Compendium.pf2e.feats-srd.Item.battle-medicine',
          slug: 'battle-medicine',
          name: 'Battle Medicine',
          img: 'icons/battle-medicine.webp',
          system: {
            category: 'skill',
            level: { value: 1, taken: 2 },
            location: 'skill-2',
            traits: { value: ['general', 'skill'] },
            rules: [],
          },
        },
        {
          type: 'feat',
          uuid: 'Actor.test.Item.general3',
          sourceId: 'Compendium.pf2e.feats-srd.Item.toughness',
          slug: 'toughness',
          name: 'Toughness',
          img: 'icons/toughness.webp',
          system: {
            category: 'general',
            level: { value: 1, taken: 3 },
            location: 'general-3',
            traits: { value: ['general'] },
            rules: [],
          },
        },
        {
          type: 'feat',
          uuid: 'Actor.test.Item.ancestry5',
          sourceId: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
          slug: 'natural-ambition',
          name: 'Natural Ambition',
          img: 'icons/natural-ambition.webp',
          system: {
            category: 'ancestry',
            level: { value: 1, taken: 5 },
            location: 'ancestry-5',
            traits: { value: ['human'] },
            rules: [],
          },
        },
        {
          type: 'feat',
          uuid: 'Actor.test.Item.classfeature',
          sourceId: 'Compendium.pf2e.classfeatures.Item.powerful-alchemy',
          slug: 'powerful-alchemy',
          name: 'Powerful Alchemy',
          img: 'icons/powerful-alchemy.webp',
          system: {
            category: 'classfeature',
            level: { value: 1, taken: 1 },
            location: 'classfeature-1',
            traits: { value: [] },
            rules: [],
          },
        },
      ],
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[2].classFeats).toEqual([
      expect.objectContaining({ slug: 'quick-bomber', uuid: 'Compendium.pf2e.feats-srd.Item.quick-bomber' }),
    ]);
    expect(planner.plan.levels[2].skillFeats).toEqual([
      expect.objectContaining({ slug: 'battle-medicine', uuid: 'Compendium.pf2e.feats-srd.Item.battle-medicine' }),
    ]);
    expect(planner.plan.levels[3].generalFeats).toEqual([
      expect.objectContaining({ slug: 'toughness', uuid: 'Compendium.pf2e.feats-srd.Item.toughness' }),
    ]);
    expect(planner.plan.levels[5].ancestryFeats).toEqual([
      expect.objectContaining({ slug: 'natural-ambition', uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition' }),
    ]);
    expect(planner.plan.levels[5].abilityBoosts).toEqual(['str', 'dex', 'con', 'int']);
  });

  it('seeds boosts when actor build boost data is stored as selected slot objects', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: {
                0: { selected: 'str' },
                1: { selected: 'con' },
                2: { selected: 'int' },
                3: { selected: 'cha' },
              },
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 5: 4, 10: 4, 15: 4, 20: 4 },
            flaws: { ancestry: [] },
          },
        },
      },
      items: [],
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[5].abilityBoosts).toEqual(['str', 'con', 'int', 'cha']);
  });

  it('normalizes long-form ability names when seeding boosts from actor data', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              5: ['strength', 'constitution', 'intelligence', 'charisma'],
            },
            allowedBoosts: { 5: 4, 10: 4, 15: 4, 20: 4 },
            flaws: { ancestry: [] },
          },
        },
      },
      items: [],
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[5].abilityBoosts).toEqual(['str', 'con', 'int', 'cha']);
  });

  it('backfills missing past boosts into an existing saved plan without overwriting planned picks', () => {
    getPlan.mockReturnValue({
      classSlug: 'alchemist',
      levels: {
        1: {},
        2: {},
        3: {},
        4: {},
        5: { abilityBoosts: [] },
        6: {},
      },
    });

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: ['cha', 'wis', 'con', 'str'],
              5: ['str', 'con', 'int', 'cha'],
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 5: 4, 10: 4, 15: 4, 20: 4 },
            flaws: { ancestry: [] },
          },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[5].abilityBoosts).toEqual(['str', 'con', 'int', 'cha']);
    expect(savePlan).toHaveBeenCalledWith(actor, expect.objectContaining({
      levels: expect.objectContaining({
        5: expect.objectContaining({ abilityBoosts: ['str', 'con', 'int', 'cha'] }),
      }),
    }));
  });

  it('hides historical skill increases for imported higher-level plans', async () => {
    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 5;

    expect(planner.plan.importedFromActor).toEqual({
      actorLevel: 5,
      hideHistoricalSkillIncreases: true,
    });
    expect(planner._shouldHideHistoricalSkillIncrease(5)).toBe(true);
    expect(planner._shouldHideHistoricalSkillIncrease(6)).toBe(false);

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(false);
  });

  it('still shows skill increases for normal non-imported plans', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 5;

    expect(planner._shouldHideHistoricalSkillIncrease(5)).toBe(false);

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(true);
  });

  it('migrates legacy pulled-in plans to hide past skill increases', async () => {
    getPlan.mockReturnValue({
      classSlug: 'alchemist',
      levels: {
        1: { classFeats: [{ slug: 'mock-class-feat' }] },
        2: { classFeats: [{ slug: 'mock-class-feat-2' }], skillFeats: [{ slug: 'mock-skill-feat-2' }], skillIncreases: [] },
        3: { generalFeats: [{ slug: 'mock-general-feat-3' }], skillIncreases: [] },
        4: { classFeats: [{ slug: 'mock-class-feat-4' }], skillFeats: [{ slug: 'mock-skill-feat-4' }] },
        5: { abilityBoosts: ['str', 'con', 'int', 'cha'], ancestryFeats: [{ slug: 'mock-ancestry-feat-5' }], skillIncreases: [] },
      },
    });

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 3;

    expect(planner.plan.importedFromActor).toEqual({
      actorLevel: 5,
      hideHistoricalSkillIncreases: true,
    });

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(false);
  });

  it('stops treating pulled-in data as bootstrap once future levels are planned', async () => {
    getPlan.mockReturnValue({
      classSlug: 'alchemist',
      importedFromActor: {
        actorLevel: 5,
        hideHistoricalSkillIncreases: true,
      },
      levels: {
        1: { classFeats: [{ slug: 'mock-class-feat' }] },
        2: { classFeats: [{ slug: 'mock-class-feat-2' }], skillFeats: [{ slug: 'mock-skill-feat-2' }], skillIncreases: [] },
        3: { generalFeats: [{ slug: 'mock-general-feat-3' }], skillIncreases: [] },
        4: { classFeats: [{ slug: 'mock-class-feat-4' }], skillFeats: [{ slug: 'mock-skill-feat-4' }] },
        5: { abilityBoosts: ['str', 'con', 'int', 'cha'], ancestryFeats: [{ slug: 'mock-ancestry-feat-5' }], skillIncreases: [] },
        6: { classFeats: [{ slug: 'directional-bombs' }] },
      },
    });

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 3;

    expect(planner.plan.importedFromActor).toBeUndefined();
    expect(savePlan).toHaveBeenCalledWith(actor, expect.not.objectContaining({
      importedFromActor: expect.anything(),
    }));

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(true);
  });
});
