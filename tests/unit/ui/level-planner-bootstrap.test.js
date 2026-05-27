import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { PLAN_STATUS } from '../../../scripts/constants.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { getPlan, savePlan } from '../../../scripts/plan/plan-store.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import { loadFeats } from '../../../scripts/feats/feat-cache.js';
import { ItemPicker } from '../../../scripts/ui/item-picker.js';
import { readFileSync } from 'node:fs';

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

jest.mock('../../../scripts/feats/feat-cache.js', () => ({
  loadFeats: jest.fn(async () => []),
}));

describe('LevelPlanner bootstrap from existing actor', () => {
  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);
  });

  beforeEach(() => {
    getPlan.mockReturnValue(null);
    loadFeats.mockResolvedValue([]);
  });

  it('re-registers default classes when the registry is empty at planner bootstrap', () => {
    ClassRegistry.clear();

    const actor = createMockActor({
      class: { slug: 'druid', name: 'Druid' },
      system: {
        details: {
          level: { value: 1 },
          xp: { value: 0, max: 1000 },
        },
      },
    });

    const planner = new LevelPlanner(actor);

    expect(ClassRegistry.has('druid')).toBe(true);
    expect(planner.plan.classSlug).toBe('druid');
  });

  it('bootstraps plans for custom classes from the actor class item when the registry has no built-in entry', () => {
    ClassRegistry.clear();

    const actor = createMockActor({
      class: {
        slug: 'eldamon-trainer',
        name: 'Eldamon Trainer',
        system: {
          hp: 8,
          keyAbility: { value: ['cha'] },
          trainedSkills: { value: ['diplomacy'], additional: 3 },
          classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          generalFeatLevels: { value: [3, 7, 11, 15, 19] },
          ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
          skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
          items: {},
        },
      },
      system: {
        details: {
          level: { value: 1 },
          xp: { value: 0, max: 1000 },
        },
      },
    });

    const planner = new LevelPlanner(actor);

    expect(ClassRegistry.has('eldamon-trainer')).toBe(true);
    expect(planner.plan.classSlug).toBe('eldamon-trainer');
    expect(planner.plan.levels[2]).toEqual(expect.objectContaining({
      classFeats: [],
      skillFeats: [],
    }));
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

  it('seeds class feature rule selections into a new plan for higher-level characters', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 5 },
          xp: { value: 0, max: 1000 },
        },
      },
      items: [
        {
          type: 'feat',
          uuid: 'Actor.test.Item.blessing',
          sourceId: 'Compendium.pf2e.classfeatures.Item.blessing-of-the-devoted',
          slug: 'blessing-of-the-devoted',
          name: 'Blessing of the Devoted',
          img: 'icons/blessing.webp',
          flags: {
            pf2e: {
              rulesSelections: {
                blessing: 'blessed-one',
              },
            },
          },
          system: {
            category: 'classfeature',
            level: { value: 3, taken: 3 },
            location: 'classfeature-3',
            traits: { value: [] },
            rules: [],
          },
        },
      ],
    });
    actor.class.slug = 'champion';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[3].classFeatureChoices).toEqual({
      'blessing-of-the-devoted': {
        blessing: { value: 'blessed-one' },
      },
    });
  });

  it('imports Workbench dual-class feat slots into dual class planner slots', () => {
    global._testSettings = {
      ...(global._testSettings ?? {}),
      pf2e: {
        ...(global._testSettings?.pf2e ?? {}),
        dualClassVariant: true,
      },
    };

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
          xp: { value: 0, max: 1000 },
        },
      },
      items: [
        {
          type: 'feat',
          uuid: 'Actor.test.Item.dual2',
          sourceId: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
          slug: 'reactive-shield',
          name: 'Reactive Shield',
          img: 'icons/reactive-shield.webp',
          system: {
            category: 'class',
            level: { value: 1, taken: 2 },
            location: 'xdy_dualclass-2',
            traits: { value: ['fighter'] },
            rules: [],
          },
        },
      ],
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);

    expect(planner.plan.levels[2].dualClassFeats).toEqual([
      expect.objectContaining({ slug: 'reactive-shield', uuid: 'Compendium.pf2e.feats-srd.Item.reactive-shield' }),
    ]);
  });

  it('seeds dual class slug from stored character creation data when planner is created', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.getFlag = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'creation') {
        return {
          version: 1,
          class: { slug: 'alchemist' },
          dualClass: { slug: 'fighter' },
        };
      }
      return null;
    });

    if (!ClassRegistry.has('fighter')) {
      ClassRegistry.register({
        slug: 'fighter',
        name: 'Fighter',
        hp: 10,
        keyAbility: ['str', 'dex'],
        featSchedule: { class: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
        skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
        classFeatures: [],
      });
    }

    const planner = new LevelPlanner(actor);

    expect(planner.plan.dualClassSlug).toBe('fighter');
  });

  it('infers dual class slug from the actor class items when stored creation data is unavailable', () => {
    const actor = createMockActor({
      class: { slug: 'alchemist', name: 'Alchemist' },
      items: [
        {
          type: 'class',
          slug: 'alchemist',
          name: 'Alchemist',
          system: {
            hp: 8,
            keyAbility: { value: ['int'] },
            trainedSkills: { value: ['crafting'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
        {
          type: 'class',
          slug: 'fighter',
          name: 'Fighter',
          system: {
            hp: 10,
            keyAbility: { value: ['str', 'dex'] },
            trainedSkills: { value: ['acrobatics', 'athletics'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
      ],
    });
    actor.getFlag = jest.fn(() => null);

    const planner = new LevelPlanner(actor);

    expect(planner.plan.dualClassSlug).toBe('fighter');
  });

  it('repairs an existing saved plan by inferring the dual class slug from actor class items', () => {
    const actor = createMockActor({
      class: { slug: 'alchemist', name: 'Alchemist' },
      items: [
        {
          type: 'class',
          slug: 'alchemist',
          name: 'Alchemist',
          system: {
            hp: 8,
            keyAbility: { value: ['int'] },
            trainedSkills: { value: ['crafting'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
        {
          type: 'class',
          slug: 'fighter',
          name: 'Fighter',
          system: {
            hp: 10,
            keyAbility: { value: ['str', 'dex'] },
            trainedSkills: { value: ['acrobatics', 'athletics'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
      ],
    });
    actor.getFlag = jest.fn(() => null);

    const existingPlan = createPlan('alchemist');
    existingPlan.dualClassSlug = null;
    getPlan.mockReturnValue(existingPlan);

    const planner = new LevelPlanner(actor);

    expect(planner.plan.dualClassSlug).toBe('fighter');
  });

  it('re-registers a saved custom dual class from the actor item before opening dual class feat picks', () => {
    const actor = createMockActor({
      class: { slug: 'alchemist', name: 'Alchemist' },
      items: [
        {
          type: 'class',
          slug: 'alchemist',
          name: 'Alchemist',
          system: {
            hp: 8,
            keyAbility: { value: ['int'] },
            trainedSkills: { value: ['crafting'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
        {
          type: 'class',
          slug: 'eldamon-trainer',
          name: 'Eldamon Trainer',
          system: {
            hp: 8,
            keyAbility: { value: ['cha'] },
            trainedSkills: { value: ['diplomacy'], additional: 3 },
            classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
            generalFeatLevels: { value: [3, 7, 11, 15, 19] },
            ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
            skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
            items: {},
          },
        },
      ],
    });
    actor.getFlag = jest.fn(() => null);

    const existingPlan = createPlan('alchemist');
    existingPlan.dualClassSlug = 'eldamon-trainer';
    getPlan.mockReturnValue(existingPlan);
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);

    const planner = new LevelPlanner(actor);
    const buildState = computeBuildState(actor, planner.plan, 2);

    expect(ClassRegistry.has('eldamon-trainer')).toBe(true);
    expect(planner._buildDualClassPickerState(buildState)).toEqual(expect.objectContaining({
      classSlug: 'eldamon-trainer',
    }));
  });

  it('prefers the stored primary class from creation data for dual-class characters', () => {
    if (!ClassRegistry.has('witch')) {
      ClassRegistry.register({
        slug: 'witch',
        name: 'Witch',
        hp: 6,
        keyAbility: ['int'],
        featSchedule: {
          class: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
          skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
          general: [3, 7, 11, 15, 19],
          ancestry: [1, 5, 9, 13, 17],
        },
        skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
        abilityBoostSchedule: [5, 10, 15, 20],
        trainedSkills: { fixed: [], additional: 3 },
        classFeatures: [],
      });
    }
    if (!ClassRegistry.has('wizard')) {
      ClassRegistry.register({
        slug: 'wizard',
        name: 'Wizard',
        hp: 6,
        keyAbility: ['int'],
        featSchedule: {
          class: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
          skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
          general: [3, 7, 11, 15, 19],
          ancestry: [1, 5, 9, 13, 17],
        },
        skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
        abilityBoostSchedule: [5, 10, 15, 20],
        trainedSkills: { fixed: [], additional: 3 },
        classFeatures: [],
      });
    }

    const actor = createMockActor({
      class: { slug: 'wizard', name: 'Wizard' },
    });
    actor.getFlag = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'creation') {
        return {
          version: 1,
          class: { slug: 'witch' },
          dualClass: { slug: 'wizard' },
        };
      }
      return null;
    });

    const planner = new LevelPlanner(actor);

    expect(planner.plan.classSlug).toBe('witch');
    expect(planner.plan.dualClassSlug).toBe('wizard');
  });

  it('locks level 2 class feat picker to the required class-archetype dedication', async () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    loadFeats.mockResolvedValue([
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.spellshot-dedication',
        slug: 'spellshot-dedication',
        name: 'Spellshot Dedication',
        system: { level: { value: 2 }, traits: { value: ['archetype', 'dedication', 'class'] } },
      },
    ]);

    const actor = createMockActor({
      class: { slug: 'gunslinger' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'feat',
          system: {
            traits: { otherTags: ['gunslinger-way'] },
            description: {
              value: 'You must select Spellshot Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'gunslinger' },
    });

    expect(preset.allowedFeatUuids).toEqual(['Compendium.pf2e.feats-srd.Item.spellshot-dedication']);
    expect(preset.selectedFeatTypes).toEqual(['class', 'archetype']);
    expect(preset.lockedFeatTypes).toEqual(['class']);
    game.settings.get = originalGet;
  });

  it('exposes importing state in planner context while a plan import is running', async () => {
    const actor = createMockActor({
      class: { slug: 'alchemist' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [],
    });

    const planner = new LevelPlanner(actor);
    planner._isImportingPlan = true;

    const context = await planner._prepareContext();

    expect(context.isImportingPlan).toBe(true);
  });

  it('shows a level loading overlay before rendering a slow selected level', async () => {
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };

    try {
      const actor = createMockActor({
        class: { slug: 'alchemist' },
        system: {
          details: { level: { value: 8 }, xp: { value: 0, max: 1000 } },
        },
        items: [],
      });
      const planner = new LevelPlanner(actor);
      planner.selectedLevel = 8;
      planner.render = jest.fn(async () => {});

      const root = document.createElement('div');
      root.className = 'pf2e-leveler level-planner';
      root.innerHTML = `
        <aside class="planner-sidebar">
          <div class="sidebar-level active" data-action="selectLevel" data-level="8">
            <span class="sidebar-level__num">8</span>
            <i class="sidebar-level__status"></i>
          </div>
          <div class="sidebar-level" data-action="selectLevel" data-level="5">
            <span class="sidebar-level__num">5</span>
            <i class="sidebar-level__status"></i>
          </div>
        </aside>
        <main class="planner-content">
          <h2>Level 8</h2>
        </main>
      `;
      planner.element = root;

      const selection = planner._selectLevel(5);

      expect(root.getAttribute('aria-busy')).toBe('true');
      expect(root.querySelector('[data-level-planner-loading]')).not.toBeNull();
      expect(root.querySelector('[data-level="5"]').classList.contains('active')).toBe(true);
      expect(root.querySelector('[data-level="5"]').classList.contains('sidebar-level--loading')).toBe(true);

      await selection;

      expect(planner.selectedLevel).toBe(5);
      expect(planner.render).toHaveBeenCalledWith(true);
      expect(root.querySelector('[data-level-planner-loading]')).toBeNull();
      expect(root.hasAttribute('aria-busy')).toBe(false);
    } finally {
      global.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it('limits investigator odd-level skill feats to mental skills plus methodology skill', async () => {
    const actor = createMockActor({
      class: { slug: 'investigator' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'feat',
          slug: 'forensic-medicine-methodology',
          name: 'Forensic Medicine Methodology',
          system: {
            traits: { value: ['investigator'], otherTags: ['investigator-methodology'] },
            rules: [
              { key: 'ActiveEffectLike', path: 'system.skills.stealth.rank', value: 1 },
            ],
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('skillFeats', 3, {
      class: { slug: 'investigator' },
    });

    expect(preset.requiredSkills).toEqual(expect.arrayContaining([
      'arcana',
      'crafting',
      'occultism',
      'society',
      'medicine',
      'nature',
      'religion',
      'survival',
      'deception',
      'diplomacy',
      'intimidation',
      'performance',
      'stealth',
    ]));
    expect(preset.requiredSkills).not.toContain('athletics');
    expect(preset.selectedFeatTypes).toEqual(['skill']);
  });

  it('exposes existing and planned custom spellcasting entries in custom spell context', async () => {
    const actor = createMockActor({
      class: { slug: 'alchemist' },
      system: {
        details: { level: { value: 2 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          id: 'existing-entry',
          type: 'spellcastingEntry',
          name: 'Wand Thesis',
          system: {
            tradition: { value: 'arcane' },
            prepared: { value: 'prepared' },
            ability: { value: 'int' },
          },
          flags: {},
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 2;
    planner.plan.levels[2].customSpellEntries = [
      {
        key: 'custom-occult',
        name: 'Occult Notebook',
        tradition: 'occult',
        prepared: 'spontaneous',
        ability: 'cha',
      },
    ];

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

    expect(context.customSpellEntryOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryType: 'existing:existing-entry',
        label: 'Wand Thesis',
        tradition: 'arcane',
        prepared: 'prepared',
        ability: 'int',
        isCustom: false,
      }),
      expect.objectContaining({
        entryType: 'custom:custom-occult',
        label: 'Occult Notebook',
        tradition: 'occult',
        prepared: 'spontaneous',
        ability: 'cha',
        isCustom: true,
      }),
    ]));
  });

  it('resolves required 2nd-level class feat uuids from classfeature subclass items', async () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    loadFeats.mockResolvedValue([
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication',
        slug: 'battle-harbinger-dedication',
        name: 'Battle Harbinger Dedication',
        system: { level: { value: 2 }, traits: { value: ['archetype', 'dedication', 'class'] } },
      },
    ]);

    const actor = createMockActor({
      class: { slug: 'cleric' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'classfeature',
          system: {
            traits: { otherTags: ['cleric-doctrine'] },
            description: {
              value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'cleric' },
    });

    expect(preset.allowedFeatUuids).toEqual(['Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication']);
    game.settings.get = originalGet;
  });

  it('resolves required 2nd-level class feat uuids from subclass family tags', async () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    loadFeats.mockResolvedValue([
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication',
        slug: 'battle-harbinger-dedication',
        name: 'Battle Harbinger Dedication',
        system: { level: { value: 2 }, traits: { value: ['archetype', 'dedication', 'class'] } },
      },
    ]);

    const actor = createMockActor({
      class: { slug: 'cleric' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'classfeature',
          system: {
            traits: { otherTags: ['cleric-doctrine-battle-creed'] },
            description: {
              value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'cleric' },
    });

    expect(preset.allowedFeatUuids).toEqual(['Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication']);
    game.settings.get = originalGet;
  });

  it('resolves required 2nd-level class feat uuids from alternate subclass text fields', async () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    loadFeats.mockResolvedValue([
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication',
        slug: 'battle-harbinger-dedication',
        name: 'Battle Harbinger Dedication',
        system: { level: { value: 2 }, traits: { value: ['archetype', 'dedication', 'class'] } },
      },
    ]);

    const actor = createMockActor({
      class: { slug: 'cleric' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'feat',
          system: {
            traits: { otherTags: ['class-archetype', 'cleric-doctrine'] },
            description: { value: '' },
            details: {
              summary: {
                value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.',
              },
            },
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'cleric' },
    });

    expect(preset.allowedFeatUuids).toEqual(['Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication']);
    game.settings.get = originalGet;
  });

  it('does not restrict level 2 class feat picker when subclass dedication requirement setting is disabled', async () => {
    loadFeats.mockResolvedValue([
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.battle-harbinger-dedication',
        slug: 'battle-harbinger-dedication',
        name: 'Battle Harbinger Dedication',
        system: { level: { value: 2 }, traits: { value: ['archetype', 'dedication', 'class'] } },
      },
    ]);

    const actor = createMockActor({
      class: { slug: 'cleric' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'classfeature',
          system: {
            traits: { otherTags: ['cleric-doctrine'] },
            description: {
              value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'cleric' },
    });

    expect(preset.allowedFeatUuids).toEqual([]);
  });

  it('class feat picker includes archetype feats without class-trait locking', async () => {
    const actor = createMockActor({
      class: { slug: 'magus' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [],
    });

    const planner = new LevelPlanner(actor);
    const preset = await planner._buildFeatPickerPreset('classFeats', 2, {
      class: { slug: 'magus' },
    });

    expect(preset.selectedFeatTypes).toEqual(['class', 'archetype']);
    expect(preset.lockedFeatTypes).toEqual(['class']);
    expect(preset.extraVisibleFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toBeUndefined();
    expect(preset.lockedTraits).toBeUndefined();
  });

  it('defaults the free-archetype level 2 picker to dedication feats', async () => {
    const actor = createMockActor({
      class: { slug: 'magus' },
      system: {
        details: { level: { value: 1 }, xp: { value: 0, max: 1000 } },
      },
      items: [],
    });

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });

    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 2, computeBuildState(planner.actor, planner.plan, 2));

    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.traitLogic).toBe('or');
  });

  it('seeds applied dedication feats into the free-archetype slot even when the actor location says class', () => {
    const originalSettings = global._testSettings;
    global._testSettings = {
      ...(originalSettings ?? {}),
      pf2e: {
        ...((originalSettings ?? {}).pf2e ?? {}),
        freeArchetypeVariant: true,
      },
    };

    const actor = createMockActor({
      class: { slug: 'alchemist', name: 'Alchemist' },
      system: {
        details: { level: { value: 2 }, xp: { value: 0, max: 1000 } },
      },
      items: [
        {
          type: 'feat',
          uuid: 'Actor.test.Item.wellspring-mage-dedication',
          sourceId: 'Compendium.pf2e.feats-srd.Item.wellspring-mage-dedication',
          name: 'Wellspring Mage Dedication',
          slug: 'wellspring-mage-dedication',
          img: 'wellspring.png',
          system: {
            category: 'class',
            location: { value: 'class-2' },
            level: { value: 2, taken: 2 },
            traits: { value: ['class'] },
            description: { value: '' },
          },
          flags: { pf2e: { rulesSelections: {} }, core: { sourceId: 'Compendium.pf2e.feats-srd.Item.wellspring-mage-dedication' } },
        },
      ],
    });

    try {
      const planner = new LevelPlanner(actor);

      expect(planner.plan.levels[2].archetypeFeats).toEqual([
        expect.objectContaining({
          slug: 'wellspring-mage-dedication',
          name: 'Wellspring Mage Dedication',
        }),
      ]);
      expect(planner.plan.levels[2].classFeats).toEqual([]);
    } finally {
      global._testSettings = originalSettings;
    }
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

  it('shows historical skill increases for imported higher-level plans so users can fill unknown history', async () => {
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
    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(true);
    expect(context.availableSkills.length).toBeGreaterThan(0);
  });

  it('builds historical skill increases from manual starting skills and prior planned increases instead of final actor ranks', async () => {
    getPlan.mockReturnValue({
      ...createPlan('alchemist'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
        initialSkills: ['acrobatics'],
      },
      levels: {
        ...createPlan('alchemist').levels,
        3: {
          ...createPlan('alchemist').levels[3],
          generalFeats: [{ slug: 'toughness', name: 'Toughness' }],
          skillIncreases: [{ skill: 'acrobatics', toRank: 2 }],
        },
      },
    });

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
          xp: { value: 0, max: 1000 },
        },
        skills: {
          ...createMockActor().system.skills,
          acrobatics: { rank: 3, value: 3 },
          intimidation: { rank: 2, value: 2 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.class.system.trainedSkills = { value: ['crafting'], additional: 3 };
    actor.items = [];

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 7;

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    const acrobatics = context.availableSkills.find((entry) => entry.slug === 'acrobatics');
    const intimidation = context.availableSkills.find((entry) => entry.slug === 'intimidation');

    expect(context.showImportedInitialSkillButton).toBe(false);
    expect(acrobatics).toEqual(expect.objectContaining({
      rank: 2,
      rankName: 'expert',
      nextRankName: 'master',
      disabled: false,
    }));
    expect(intimidation).toEqual(expect.objectContaining({
      rank: 0,
      rankName: 'untrained',
      nextRankName: 'trained',
      disabled: false,
    }));
  });

  it('only offers the imported starting skill dialog button from the level 2 header with class cap summary', async () => {
    getPlan.mockReturnValue({
      ...createPlan('alchemist'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
        initialSkills: ['acrobatics', 'athletics', 'stealth'],
      },
    });

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.class.system.trainedSkills = { value: ['crafting'], additional: 3 };
    actor.items = [];

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 2;

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

    expect(context.showImportedInitialSkillButton).toBe(true);
    expect(context.showImportedInitialSkills).toBeUndefined();
    expect(context.importedInitialSkills).toBeUndefined();
    expect(context.importedInitialSkillCount).toBe(3);
    expect(context.importedInitialSkillLimit).toBe(3);
  });

  it('opens an imported starting skill dialog and stores selected training', async () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.class.system.trainedSkills = { value: ['crafting'], additional: 3 };
    actor.items = [];

    const planner = new LevelPlanner(actor);
    planner.plan = {
      ...createPlan('alchemist'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
        initialSkills: ['acrobatics'],
      },
    };
    const prompt = jest.fn(async (config) => {
      const container = document.createElement('div');
      container.innerHTML = config.content;
      container.querySelector('input[name="importedInitialSkills"][value="athletics"]').checked = true;
      container.querySelector('input[name="importedInitialSkills"][value="stealth"]').checked = true;
      return config.ok.callback(null, null, { element: container });
    });
    global.foundry.applications.api.DialogV2 = { prompt };

    await planner._openImportedInitialSkillDialog();

    expect(prompt).toHaveBeenCalled();
    const content = prompt.mock.calls[0][0].content;
    expect(content).toContain('Starting Skill Training');
    expect(content).toContain('Acrobatics');
    expect(content).toContain('Crafting');
    expect(content).toContain('data-imported-initial-skill-automatic="true"');
    expect(content).toContain('data-imported-initial-skill-automatic-input="true"');
    expect(content).toContain('Alchemist');
    expect(content).toContain('data-imported-initial-skills');
    expect(content).toContain('pf2e-leveler imported-initial-skills-dialog');
    expect(content).toContain('imported-initial-skill-card');
    expect(content).toContain('imported-initial-skill-card__check');
    expect(content).not.toContain('class="skill-btn');
    expect(planner.plan.importedFromActor.initialSkills).toEqual(['acrobatics', 'athletics', 'stealth']);
    expect(savePlan).toHaveBeenCalledWith(actor, planner.plan);
  });

  it('keeps imported starting skill dialog content within the Foundry prompt width', () => {
    const css = readFileSync('styles/level-planner.css', 'utf8');

    expect(css).toContain('width: min(100%, 560px);');
    expect(css).toContain('max-width: 100%;');
    expect(css).toContain('position: relative;');
    expect(css).toContain('imported-initial-skill-card--automatic');
    expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));');
    expect(css).not.toContain('min-width: min(560px, calc(100vw - 64px));');
    expect(css).not.toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('caps imported starting skill dialog selections to the class training allowance', async () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
          xp: { value: 0, max: 1000 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.class.system.trainedSkills = { value: ['crafting'], additional: 2 };
    actor.items = [];

    const planner = new LevelPlanner(actor);
    planner.plan = {
      ...createPlan('alchemist'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
        initialSkills: ['acrobatics'],
      },
    };
    const prompt = jest.fn(async () => ['acrobatics', 'athletics', 'crafting', 'stealth']);
    global.foundry.applications.api.DialogV2 = { prompt };

    await planner._openImportedInitialSkillDialog();

    expect(planner.plan.importedFromActor.initialSkills).toEqual(['acrobatics', 'athletics']);
    expect(savePlan).toHaveBeenCalledWith(actor, planner.plan);
  });

  it('still shows skill increases for normal non-imported plans', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 5;

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showSkillIncrease).toBe(true);
  });

  it('keeps an applied planned skill increase fulfilled instead of asking for another rank', async () => {
    getPlan.mockReturnValue({
      ...createPlan('alchemist'),
      levels: {
        ...createPlan('alchemist').levels,
        3: {
          ...createPlan('alchemist').levels[3],
          generalFeats: [{ slug: 'toughness', name: 'Toughness' }],
          skillIncreases: [{ skill: 'stealth', toRank: 2 }],
        },
      },
    });

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 3 },
          xp: { value: 0, max: 1000 },
        },
        skills: {
          ...createMockActor().system.skills,
          stealth: { rank: 2, value: 2 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.items = [];

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 3;

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    const stealth = context.availableSkills.find((entry) => entry.slug === 'stealth');

    expect(stealth).toEqual(expect.objectContaining({
      selected: true,
      rank: 1,
      rankName: 'trained',
      nextRankName: 'expert',
      disabled: false,
    }));
  });

  it('migrates legacy pulled-in plans while keeping past skill increases optional to fill', async () => {
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
    expect(context.showSkillIncrease).toBe(true);

    const level3 = planner._buildSidebarLevels(ClassRegistry.get('alchemist'), planner._getVariantOptions())
      .find((entry) => entry.level === 3);
    expect(level3.status).toBe(PLAN_STATUS.COMPLETE);
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

  it('hides the nested Ancestral Paragon feat preview until an ancestry feat is selected', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
    }];

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showGeneralFeat).toBe(true);
    expect(context.showGeneralFeatGrantedAncestryFeat).toBe(false);
    expect(context.showAncestryFeat).toBe(false);
  });

  it('surfaces direct choice sets on the ancestry feat granted by Ancestral Paragon', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
    }];
    planner.plan.levels[3].ancestryFeats = [{
      uuid: 'Compendium.test.Item.clever-adaptation',
      slug: 'clever-adaptation',
      name: 'Clever Adaptation',
      level: 1,
      choices: { skill: 'stealth' },
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.test.Item.clever-adaptation') {
        return {
          uuid,
          slug: 'clever-adaptation',
          name: 'Clever Adaptation',
          system: {
            description: { value: '' },
            rules: [{
              key: 'ChoiceSet',
              flag: 'skill',
              prompt: 'Select a skill.',
              choices: [{ value: 'stealth', label: 'Stealth' }],
              leveler: { grantsSkillTraining: true },
            }],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.showGeneralFeatGrantedAncestryFeat).toBe(true);
      expect(context.showAncestryFeat).toBe(false);
      expect(context.generalFeatGrantedAncestryFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'skill',
          prompt: 'Select a skill.',
          grantsSkillTraining: true,
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'stealth', selected: true }),
          ]),
        }),
      ]));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('surfaces Natural Ambition class-feat choices under Ancestral Paragon', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';
    actor.system.details.class = { trait: { value: 'alchemist' } };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
    }];
    planner.plan.levels[3].ancestryFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      slug: 'natural-ambition',
      name: 'Natural Ambition',
      level: 1,
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
        name: 'Natural Ambition',
        type: 'feat',
        slug: 'natural-ambition',
        traits: ['ancestry', 'human'],
        otherTags: [],
        category: 'ancestry',
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
        name: 'Alchemical Familiar',
        type: 'feat',
        slug: 'alchemical-familiar',
        traits: ['alchemist'],
        otherTags: [],
        category: { value: 'class' },
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
        name: 'Reactive Shield',
        type: 'feat',
        slug: 'reactive-shield',
        traits: ['fighter'],
        otherTags: [],
        category: { value: 'class' },
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          slug: 'natural-ambition',
          name: 'Natural Ambition',
          system: {
            description: { value: '' },
            rules: [{
              key: 'ChoiceSet',
              flag: 'naturalAmbition',
              prompt: 'Choose a class feat.',
              choices: {
                itemType: 'feat',
                filter: [
                  'item:type:feat',
                  'item:level:1',
                  'item:category:class',
                  'item:trait:{actor|system.details.class.trait}',
                ],
              },
            },
            {
              key: 'GrantItem',
              uuid: '{item|flags.pf2e.rulesSelections.naturalAmbition}',
            }],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.generalFeatGrantedAncestryFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'naturalAmbition',
          prompt: 'Choose a class feat.',
          choicePicker: expect.objectContaining({
            kind: 'feat',
            category: 'class',
            allowedUuids: ['Compendium.pf2e.feats-srd.Item.alchemical-familiar'],
          }),
          options: [
            expect.objectContaining({
              value: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
              label: 'Alchemical Familiar',
            }),
          ],
        }),
      ]));
      expect(planner._findRenderedPlannedFeatChoiceSet(context, {
        category: 'generalFeats',
        flag: 'naturalAmbition',
      })).toEqual(expect.objectContaining({
        flag: 'naturalAmbition',
        prompt: 'Choose a class feat.',
      }));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('shows the class feat granted by Natural Ambition under Ancestral Paragon', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';
    actor.system.details.class = { trait: { value: 'alchemist' } };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
        naturalAmbition: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
      },
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
        name: 'Natural Ambition',
        type: 'feat',
        slug: 'natural-ambition',
        traits: ['ancestry', 'human'],
        otherTags: [],
        category: { value: 'ancestry' },
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
        name: 'Alchemical Familiar',
        type: 'feat',
        slug: 'alchemical-familiar',
        traits: ['alchemist'],
        otherTags: [],
        category: { value: 'class' },
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          slug: 'natural-ambition',
          name: 'Natural Ambition',
          img: 'natural-ambition.png',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'naturalAmbition',
                prompt: 'Choose a class feat.',
                choices: {
                  itemType: 'feat',
                  filter: [
                    'item:type:feat',
                    'item:level:1',
                    'item:category:class',
                    'item:trait:{actor|system.details.class.trait}',
                  ],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.pf2e.rulesSelections.naturalAmbition}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.alchemical-familiar') {
        return {
          uuid,
          slug: 'alchemical-familiar',
          name: 'Alchemical Familiar',
          img: 'alchemical-familiar.png',
          system: {
            description: { value: '' },
            rules: [],
            level: { value: 1 },
            category: { value: 'class' },
            traits: { value: ['alchemist'], rarity: 'common' },
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const naturalAmbitionSet = context.generalFeatGrantedAncestryFeat.grantChoiceSets.find((choiceSet) => choiceSet.flag === 'naturalAmbition');

      expect(naturalAmbitionSet.choicePicker.selectedOption).toEqual(expect.objectContaining({
        label: 'Alchemical Familiar',
      }));
      expect(context.generalFeatGrantedAncestryFeat.grantedItems).toEqual([
        expect.objectContaining({
          uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
          name: 'Alchemical Familiar',
        }),
      ]);
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('falls back to class feat choices when Natural Ambition raw rules provide no usable picker', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      },
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
        name: 'Natural Ambition',
        type: 'feat',
        slug: 'natural-ambition',
        traits: ['ancestry', 'human'],
        otherTags: [],
        category: 'ancestry',
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
        name: 'Alchemical Familiar',
        type: 'feat',
        slug: 'alchemical-familiar',
        traits: ['alchemist'],
        otherTags: [],
        category: 'class',
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.quick-bomber',
        name: 'Quick Bomber',
        type: 'feat',
        slug: 'quick-bomber',
        traits: ['alchemist'],
        otherTags: [],
        category: 'class',
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
        name: 'Reactive Shield',
        type: 'feat',
        slug: 'reactive-shield',
        traits: ['fighter'],
        otherTags: [],
        category: 'class',
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          slug: 'natural-ambition',
          name: 'Natural Ambition',
          system: {
            description: { value: '' },
            rules: [],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const naturalAmbitionSet = context.generalFeatGrantedAncestryFeat.grantChoiceSets.find((choiceSet) => choiceSet.flag === 'naturalAmbition');

      expect(naturalAmbitionSet.choicePicker).toEqual(expect.objectContaining({
        kind: 'feat',
        category: 'class',
        allowedUuids: [
          'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
          'Compendium.pf2e.feats-srd.Item.quick-bomber',
        ],
      }));
      expect(naturalAmbitionSet.options.map((option) => option.label)).toEqual([
        'Alchemical Familiar',
        'Quick Bomber',
      ]);
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('resolves Natural Ambition class filters from the planner class when actor class data is sparse', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = null;
    actor.system.details.class = { trait: '' };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      },
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
        name: 'Natural Ambition',
        type: 'feat',
        slug: 'natural-ambition',
        traits: ['ancestry', 'human'],
        otherTags: [],
        category: { value: 'ancestry' },
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
        name: 'Alchemical Familiar',
        type: 'feat',
        slug: 'alchemical-familiar',
        traits: ['alchemist'],
        otherTags: [],
        category: { value: 'class' },
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          slug: 'natural-ambition',
          name: 'Natural Ambition',
          img: 'natural-ambition.png',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'naturalAmbition',
                prompt: 'Choose a class feat.',
                choices: {
                  itemType: 'feat',
                  filter: [
                    'item:type:feat',
                    'item:level:1',
                    'item:category:class',
                    'item:trait:{actor|system.details.class.trait}',
                  ],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.pf2e.rulesSelections.naturalAmbition}',
              },
            ],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const naturalAmbitionSet = context.generalFeatGrantedAncestryFeat.grantChoiceSets.find((choiceSet) => choiceSet.flag === 'naturalAmbition');

      expect(naturalAmbitionSet.choicePicker.allowedUuids).toEqual([
        'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
      ]);
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('renders native Ancestral Paragon selections as nested granted feats instead of bonus feat links', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
      },
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
        name: 'Arcane Tattoos',
        type: 'feat',
        slug: 'arcane-tattoos',
        traits: ['ancestry', 'human'],
        otherTags: [],
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.adapted-cantrip',
        name: 'Adapted Cantrip',
        type: 'feat',
        slug: 'adapted-cantrip',
        traits: ['ancestry', 'human'],
        otherTags: [],
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.arcane-tattoos') {
        return {
          uuid,
          slug: 'arcane-tattoos',
          name: 'Arcane Tattoos',
          img: 'arcane-tattoos.png',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'cantrip',
                prompt: 'Select a cantrip.',
                choices: [{ value: 'Compendium.pf2e.spells-srd.Item.daze', label: 'Daze', uuid: 'Compendium.pf2e.spells-srd.Item.daze', type: 'spell' }],
              },
            ],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.generalFeat.grantedItems).toEqual([]);
      expect(context.generalFeat.grantChoiceSets).toEqual([]);
      expect(context.showGeneralFeatGrantedAncestryFeat).toBe(true);
      expect(context.generalFeatGrantedAncestryFeat).toEqual(expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
        name: 'Arcane Tattoos',
        readOnly: true,
      }));
      expect(context.generalFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'ancestralParagon',
          options: expect.arrayContaining([
            expect.objectContaining({ label: 'Arcane Tattoos', selected: true }),
          ]),
        }),
      ]));
      expect(context.generalFeatGrantedAncestryFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'cantrip',
        }),
      ]));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('marks nested Arcane Tattoos spell choices selected from Ancestral Paragon storage', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      slug: 'ancestral-paragon',
      name: 'Ancestral Paragon',
      level: 3,
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
        cantrip: 'Compendium.pf2e.spellsSrd.Item.daze',
      },
    }];

    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
        name: 'Arcane Tattoos',
        type: 'feat',
        slug: 'arcane-tattoos',
        traits: ['ancestry', 'human'],
        otherTags: [],
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.ancestral-paragon') {
        return {
          uuid,
          slug: 'ancestral-paragon',
          name: 'Ancestral Paragon',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestralParagon',
                prompt: 'Select a 1st-level ancestry feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:type:feat', 'item:level:1', 'item:trait:ancestry'],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.ancestralParagon}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.arcane-tattoos') {
        return {
          uuid,
          slug: 'arcane-tattoos',
          name: 'Arcane Tattoos',
          img: 'arcane-tattoos.png',
          system: {
            description: { value: '' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'cantrip',
                prompt: 'Select a cantrip.',
                choices: [
                  { value: 'Compendium.pf2e.spellsSrd.Item.daze', uuid: 'Compendium.pf2e.spellsSrd.Item.daze', type: 'spell' },
                  { value: 'Compendium.pf2e.spellsSrd.Item.shield', uuid: 'Compendium.pf2e.spellsSrd.Item.shield', type: 'spell' },
                ],
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.spells-srd.Item.daze') {
        return {
          uuid,
          name: 'Daze',
          img: 'daze.png',
          type: 'spell',
          system: {
            level: { value: 0 },
            traits: { value: ['cantrip'] },
          },
        };
      }

      if (uuid === 'Compendium.pf2e.spells-srd.Item.shield') {
        return {
          uuid,
          name: 'Shield',
          img: 'shield.png',
          type: 'spell',
          system: {
            level: { value: 0 },
            traits: { value: ['cantrip'] },
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const cantripSet = context.generalFeatGrantedAncestryFeat.grantChoiceSets.find((choiceSet) => choiceSet.flag === 'cantrip');

      expect(context.generalFeat.grantChoiceSets).toEqual([]);
      expect(cantripSet.choiceCategory).toBe('generalFeats');
      expect(cantripSet.choicePicker).toEqual(expect.objectContaining({
        kind: 'spell',
        allowedUuids: [
          'Compendium.pf2e.spells-srd.Item.daze',
          'Compendium.pf2e.spells-srd.Item.shield',
        ],
        selectedOption: expect.objectContaining({
          label: 'Daze',
        }),
      }));
      expect(cantripSet.options).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: 'Daze', selected: true }),
        expect.objectContaining({ label: 'Shield', selected: false }),
      ]));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('shows an ancestry selector under Adopted Ancestry general feats', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';
    actor.ancestry.slug = 'human';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 1;
    planner.plan.levels[1] = planner.plan.levels[1] ?? {};
    planner.plan.levels[1].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
      slug: 'adopted-ancestry',
      name: 'Adopted Ancestry',
      level: 1,
      choices: { adoptedAncestry: 'dwarf' },
    }];
    planner._compendiumCache['category-ancestries'] = [
      { slug: 'human', name: 'Human', rarity: 'common' },
      { slug: 'dwarf', name: 'Dwarf', rarity: 'common', img: 'dwarf.webp' },
      { slug: 'elf', name: 'Elf', rarity: 'common', img: 'elf.webp' },
      { slug: 'fetchling', name: 'Fetchling', rarity: 'uncommon', img: 'fetchling.webp' },
    ];

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
    expect(context.showGeneralFeatAdoptedAncestry).toBe(true);
    expect(context.selectedGeneralFeatAdoptedAncestry).toBe('dwarf');
    expect(context.generalFeatAdoptedAncestryOptions).toEqual([
      expect.objectContaining({ value: 'dwarf', selected: true, img: 'dwarf.webp' }),
      expect.objectContaining({ value: 'elf', selected: false, img: 'elf.webp' }),
    ]);
    expect(context.generalFeatAdoptedAncestryOptions).toHaveLength(2);
  });

  it('uses Cultural Adaptability ancestry choices to filter the granted ancestry feat', async () => {
    const originalFromUuid = global.fromUuid;

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';
    actor.ancestry.slug = 'halfling';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 5;
    planner.plan.levels[5].ancestryFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.cultural-adaptability',
      slug: 'cultural-adaptability',
      name: 'Cultural Adaptability',
      level: 5,
      choices: {
        ancestry: 'dwarf',
      },
    }];
    planner._compendiumCache['pf2e.ancestries'] = [
      {
        uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
        name: 'Dwarf',
        type: 'ancestry',
        slug: 'dwarf',
        rarity: 'common',
      },
      {
        uuid: 'Compendium.pf2e.ancestries.Item.halfling',
        name: 'Halfling',
        type: 'ancestry',
        slug: 'halfling',
        rarity: 'common',
      },
    ];
    planner._compendiumCache['pf2e.feats-srd'] = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.dwarven-lore',
        name: 'Dwarven Lore',
        type: 'feat',
        slug: 'dwarven-lore',
        traits: ['dwarf'],
        category: 'ancestry',
        rarity: 'common',
        level: 1,
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.elven-lore',
        name: 'Elven Lore',
        type: 'feat',
        slug: 'elven-lore',
        traits: ['elf'],
        category: 'ancestry',
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.cultural-adaptability') {
        return {
          uuid,
          slug: 'cultural-adaptability',
          name: 'Cultural Adaptability',
          img: 'cultural.png',
          system: {
            description: { value: '' },
            level: { value: 5 },
            rules: [
              {
                key: 'GrantItem',
                uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
              },
              {
                adjustName: false,
                choices: {
                  filter: [
                    'item:level:1',
                    'item:trait:{actor|system.details.ancestry.adopted}',
                  ],
                },
                flag: 'feat',
                key: 'ChoiceSet',
                prompt: 'PF2E.SpecificRule.Prompt.LevelOneAncestryFeat',
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.feat}',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.adopted-ancestry') {
        return {
          uuid,
          slug: 'adopted-ancestry',
          name: 'Adopted Ancestry',
          type: 'feat',
          system: {
            description: { value: '' },
            rules: [
              {
                choices: {
                  filter: [{ not: 'item:slug:{actor|system.details.ancestry.trait}' }],
                  itemType: 'ancestry',
                  slugsAsValues: true,
                },
                flag: 'ancestry',
                key: 'ChoiceSet',
                prompt: 'PF2E.SpecificRule.AdoptedAncestry.Prompt',
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.dwarven-lore') {
        return {
          uuid,
          slug: 'dwarven-lore',
          name: 'Dwarven Lore',
          type: 'feat',
          img: 'dwarven-lore.png',
          system: {
            level: { value: 1 },
            traits: { value: ['dwarf'], rarity: 'common' },
            rules: [],
          },
        };
      }

      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.ancestryFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'ancestry',
          choicePicker: expect.objectContaining({
            kind: 'item',
            allowedUuids: ['Compendium.pf2e.ancestries.Item.dwarf'],
            items: [
              expect.objectContaining({
                uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
                name: 'Dwarf',
                type: 'ancestry',
                levelerChoiceValue: 'dwarf',
              }),
            ],
          }),
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'dwarf', label: 'Dwarf', selected: true }),
          ]),
        }),
      ]));
      expect(context.ancestryFeatChoiceSets).toEqual([
        expect.objectContaining({
          flag: 'feat',
          choicePicker: expect.objectContaining({
            kind: 'feat',
            category: 'ancestry',
            allowedUuids: ['Compendium.pf2e.feats-srd.Item.dwarven-lore'],
          }),
          options: [
            expect.objectContaining({
              value: 'Compendium.pf2e.feats-srd.Item.dwarven-lore',
              label: 'Dwarven Lore',
            }),
          ],
        }),
      ]);
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('opens non-feat planned item choices with ItemPicker and stores the choice-set value', async () => {
    const actor = createMockActor({ items: [] });
    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 5;
    planner.render = jest.fn();
    planner.plan.levels[5].ancestryFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.cultural-adaptability',
      slug: 'cultural-adaptability',
      name: 'Cultural Adaptability',
      choices: {},
    }];
    planner._refreshPlannedFeatGrantPreview = jest.fn(async (feat) => {
      feat.grantChoiceSets = [{ flag: 'feat', options: [] }];
    });
    planner._buildLevelContext = jest.fn(async () => ({
      ancestryFeat: {
        grantChoiceSets: [
          {
            flag: 'ancestry',
            prompt: 'Select a common ancestry.',
            choicePicker: {
              kind: 'item',
              title: 'Select a common ancestry.',
              allowedUuids: ['Compendium.pf2e.ancestries.Item.dwarf'],
              items: [
                {
                  uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
                  name: 'Dwarf',
                  img: 'dwarf.webp',
                  type: 'ancestry',
                  levelerChoiceValue: 'dwarf',
                  system: {
                    level: { value: 0 },
                    traits: { value: [], rarity: 'common' },
                  },
                },
              ],
            },
            options: [],
          },
        ],
      },
    }));
    let pickerInstance = null;
    const renderSpy = jest.spyOn(ItemPicker.prototype, 'render').mockImplementation(function render() {
      pickerInstance = this;
    });

    try {
      await planner._openPlannedFeatChoicePicker({
        category: 'ancestryFeats',
        flag: 'ancestry',
      });

      expect(pickerInstance).toBeInstanceOf(ItemPicker);
      expect(pickerInstance.allItems).toEqual([
        expect.objectContaining({
          uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
          levelerChoiceValue: 'dwarf',
        }),
      ]);

      await pickerInstance.onSelect(pickerInstance.allItems[0]);

      expect(planner.plan.levels[5].ancestryFeats[0].choices.ancestry).toBe('dwarf');
      expect(planner._refreshPlannedFeatGrantPreview).toHaveBeenCalledWith(planner.plan.levels[5].ancestryFeats[0]);
      expect(planner.plan.levels[5].ancestryFeats[0].grantChoiceSets).toEqual([{ flag: 'feat', options: [] }]);
      expect(savePlan).toHaveBeenCalledWith(actor, planner.plan);
    } finally {
      renderSpy.mockRestore();
    }
  });

  it('shows a deity selector under planner feats that require a deity choice', async () => {
    const originalFromUuid = global.fromUuid;
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.champion-dedication',
      slug: 'champion-dedication',
      name: 'Champion Dedication',
      level: 2,
      choices: { deity: 'Compendium.pf2e.deities.Item.abadar' },
    }];
    planner._compendiumCache.deities = [
      { uuid: 'Compendium.pf2e.deities.Item.abadar', name: 'Abadar', img: 'abadar.webp', type: 'deity', category: 'deity' },
      { uuid: 'Compendium.pf2e.deities.Item.sarenrae', name: 'Sarenrae', img: 'sarenrae.webp', type: 'deity', category: 'deity' },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.champion-dedication') {
        return {
          uuid,
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'deity',
                prompt: 'Select a deity.',
                choices: {
                  filter: ['item:type:deity'],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'deity',
          prompt: 'Select a deity.',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'Compendium.pf2e.deities.Item.abadar', selected: true, img: 'abadar.webp', label: 'Abadar' }),
            expect.objectContaining({ value: 'Compendium.pf2e.deities.Item.sarenrae', selected: false, img: 'sarenrae.webp', label: 'Sarenrae' }),
          ]),
        }),
      ]));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('shows dedication choice sets for planned archetype feats like druid dedication', async () => {
    const originalFromUuid = global.fromUuid;
    const originalPacks = game.packs;
    const originalHas = game.i18n.has;
    const originalLocalize = game.i18n.localize;
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'oracle';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      slug: 'druid-dedication',
      name: 'Druid Dedication',
      level: 2,
      traits: ['archetype', 'multiclass', 'dedication', 'druid'],
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          name: 'Druid Dedication',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'druidicOrder',
                prompt: 'PF2E.SpecificRule.Druid.DruidicOrder.Prompt',
                choices: {
                  filter: ['item:tag:druid-order', { not: 'item:tag:class-archetype' }],
                },
              },
            ],
          },
        };
      }
      return null;
    });
    game.packs = new Map([
      ['pf2e.classfeatures', {
        metadata: { label: 'Class Features', packageName: 'pf2e' },
        title: 'Class Features',
        collection: 'pf2e.classfeatures',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.classfeatures.Item.animal-order',
            name: 'Animal Order',
            img: 'animal.webp',
            type: 'feat',
            slug: 'animal-order',
            system: {
              traits: { value: [], otherTags: ['druid-order-animal'], rarity: 'common' },
              level: { value: 1 },
              description: { value: '' },
            },
          },
          {
            uuid: 'Compendium.pf2e.classfeatures.Item.leaf-order',
            name: 'Leaf Order',
            img: 'leaf.webp',
            type: 'feat',
            slug: 'leaf-order',
            system: {
              traits: { value: [], otherTags: ['druid-order-leaf'], rarity: 'common' },
              level: { value: 1 },
              description: { value: '' },
            },
          },
        ]),
      }],
      ['pf2e.feats-srd', {
        metadata: { label: 'Feats', packageName: 'pf2e' },
        title: 'Feats',
        collection: 'pf2e.feats-srd',
        getDocuments: jest.fn(async () => []),
      }],
    ]);
    game.i18n.has = jest.fn((key) => key === 'PF2E.SpecificRule.Druid.DruidicOrder.Prompt');
    game.i18n.localize = jest.fn((key) => (key === 'PF2E.SpecificRule.Druid.DruidicOrder.Prompt' ? 'Select a druidic order.' : key));

      try {
        const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
        expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
          expect.objectContaining({
            flag: 'druidicOrder',
          prompt: 'Select a druidic order.',
          choiceType: 'item',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'Compendium.pf2e.classfeatures.Item.animal-order', label: 'Animal Order', img: 'animal.webp' }),
            expect.objectContaining({ value: 'Compendium.pf2e.classfeatures.Item.leaf-order', label: 'Leaf Order', img: 'leaf.webp' }),
            ]),
          }),
        ]));
        expect((context.archetypeFeat?.grantChoiceSets ?? []).some((entry) => entry.flag === 'druidicOrder')).toBe(false);
      } finally {
        global.fromUuid = originalFromUuid;
        game.packs = originalPacks;
        game.i18n.has = originalHas;
      game.i18n.localize = originalLocalize;
    }
  });

  it('does not duplicate authored dedication subclass choices like barbarian instinct', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    const originalPacks = game.packs;
    const originalHas = game.i18n.has;
    const originalLocalize = game.i18n.localize;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          athletics: 'Athletics',
          survival: 'Survival',
          crafting: 'Crafting',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          ...createMockActor().system.skills,
          athletics: { rank: 1, value: 1 },
          survival: { rank: 0, value: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    const createBarbarianDedicationEntry = () => ({
      uuid: 'Compendium.pf2e.feats-srd.Item.barbarian-dedication',
      slug: 'barbarian-dedication',
      name: 'Barbarian Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'multiclass', 'barbarian'],
      choices: {
        instinct: 'Compendium.pf2e.classfeatures.Item.fury-instinct',
      },
    });
    planner.plan.levels[2].archetypeFeats = [createBarbarianDedicationEntry()];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.barbarian-dedication') {
        return {
          uuid,
          name: 'Barbarian Dedication',
          slug: 'barbarian-dedication',
          system: {
            description: {
              value: '<p>You become trained in Athletics; if you were already trained in Athletics, you instead become trained in a skill of your choice.</p><p>Choose an instinct as you would if you were a barbarian.</p>',
            },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'instinct',
                prompt: 'PF2E.SpecificRule.Barbarian.Instinct.Prompt',
                choices: {
                  filter: ['item:tag:barbarian-instinct', { not: 'item:tag:class-archetype' }],
                },
              },
              {
                key: 'GrantItem',
                uuid: '{item|flags.system.rulesSelections.instinct}',
              },
              {
                key: 'GrantItem',
                uuid: 'Compendium.pf2e.actionspf2e.Item.rage',
              },
              {
                key: 'ActiveEffectLike',
                mode: 'upgrade',
                path: 'system.skills.athletics.rank',
                value: 1,
              },
            ],
            traits: { value: ['archetype', 'dedication', 'multiclass', 'barbarian'] },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.fury-instinct') {
        return {
          uuid,
          name: 'Fury Instinct',
          slug: 'fury-instinct',
          system: {
            description: { value: '<p>Your rage comes from a personal well within you.</p>' },
            rules: [],
            traits: { value: ['barbarian'], otherTags: ['barbarian-instinct'], rarity: 'common' },
            category: 'classfeature',
          },
          type: 'feat',
        };
      }
      if (uuid === 'Compendium.pf2e.actionspf2e.Item.rage') {
        return {
          uuid,
          name: 'Rage',
          slug: 'rage',
          system: { rules: [] },
          type: 'action',
        };
      }
      return null;
    });

    game.packs = new Map([
      ['pf2e.classfeatures', {
        metadata: { label: 'Class Features', packageName: 'pf2e' },
        title: 'Class Features',
        collection: 'pf2e.classfeatures',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.classfeatures.Item.fury-instinct',
            name: 'Fury Instinct',
            img: 'fury.webp',
            type: 'feat',
            slug: 'fury-instinct',
            system: {
              traits: { value: ['barbarian'], otherTags: ['barbarian-instinct'], rarity: 'common' },
              category: 'classfeature',
              level: { value: 1 },
              description: { value: '' },
            },
          },
        ]),
      }],
      ['pf2e.feats-srd', {
        metadata: { label: 'Feats', packageName: 'pf2e' },
        title: 'Feats',
        collection: 'pf2e.feats-srd',
        getDocuments: jest.fn(async () => []),
      }],
    ]);
    game.i18n.has = jest.fn((key) => key === 'PF2E.SpecificRule.Barbarian.Instinct.Prompt');
    game.i18n.localize = jest.fn((key) => (key === 'PF2E.SpecificRule.Barbarian.Instinct.Prompt' ? 'Select an instinct.' : key));

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const instinctSets = context.archetypeFeatChoiceSets.filter((entry) =>
        String(entry.flag ?? '').toLowerCase().includes('instinct')
        || String(entry.prompt ?? '').toLowerCase().includes('instinct'));
      const fallbackSet = context.archetypeFeatChoiceSets.find((entry) => entry.flag === 'levelerSkillFallback1');

      expect(instinctSets).toHaveLength(1);
      expect(instinctSets[0]).toEqual(expect.objectContaining({
        flag: 'instinct',
        prompt: 'Select an instinct.',
      }));
      expect(fallbackSet.options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'survival', disabled: false }),
      ]));

      planner.plan.levels[2].archetypeFeats = [];
      planner.plan.levels[2].classFeats = [createBarbarianDedicationEntry()];
      const classContext = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const classInstinctSets = classContext.classFeatChoiceSets.filter((entry) =>
        String(entry.flag ?? '').toLowerCase().includes('instinct')
        || String(entry.prompt ?? '').toLowerCase().includes('instinct'));
      const classFallbackSets = classContext.classFeatChoiceSets.filter((entry) => entry.flag?.startsWith('levelerSkillFallback'));

      expect(classContext.classFeat.grantedItems.map((entry) => entry.name)).toEqual(['Fury Instinct', 'Rage']);
      expect(classContext.classFeat.grantChoiceSets ?? []).toEqual([]);
      expect(classInstinctSets).toHaveLength(1);
      expect(classFallbackSets).toHaveLength(1);
      expect(classFallbackSets[0].options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'survival', disabled: false }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
      game.packs = originalPacks;
      game.i18n.has = originalHas;
      game.i18n.localize = originalLocalize;
    }
  });

  it('marks planner fallback skill-of-your-choice prompts as lore-capable training picks', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          intimidation: 'Intimidation',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          nature: { rank: 1 },
          intimidation: { rank: 1 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
        name: 'Druid Dedication',
        slug: 'druid-dedication',
        choices: {
          druidicOrder: 'Compendium.pf2e.classfeatures.Item.flame-order',
        },
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          name: 'Druid Dedication',
          slug: 'druid-dedication',
          system: {
            description: {
              value: "<p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'druidicOrder',
                prompt: 'Select a druidic order.',
                choices: { filter: ['item:tag:druid-order', { not: 'item:tag:class-archetype' }] },
              },
            ],
            traits: { value: ['archetype', 'dedication', 'multiclass', 'druid'] },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.flame-order') {
        return {
          uuid,
          name: 'Flame Order',
          system: {
            description: {
              value: '<p>Order Skill Intimidation</p>',
            },
            rules: [],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const fallbackSets = context.archetypeFeatChoiceSets.filter((entry) => entry.flag.startsWith('levelerSkillFallback'));
      expect(fallbackSets).toHaveLength(2);
      expect(fallbackSets.every((entry) => entry.grantsSkillTraining === true)).toBe(true);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('rebuilds granted-feat skill selections into planned skill rules', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acrobatics: 'Acrobatics',
          athletics: 'Athletics',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
          intimidation: 'Intimidation',
          medicine: 'Medicine',
          performance: 'Performance',
          survival: 'Survival',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 1 },
          xp: { value: 0, max: 1000 },
        },
        skills: {
          acrobatics: { rank: 0, value: 0 },
          survival: { rank: 0, value: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].classFeats = [
      {
        uuid: 'feat-root',
        name: 'Spellshot Dedication',
        slug: 'spellshot-dedication',
        choices: {
          grantedSkill: 'survival',
        },
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Spellshot Dedication',
          slug: 'spellshot-dedication',
          system: {
            description: { value: '' },
            traits: { value: ['archetype', 'dedication', 'gunslinger'] },
            rules: [{ key: 'GrantItem', uuid: 'feat-granted' }],
          },
        };
      }
      if (uuid === 'feat-granted') {
        return {
          uuid,
          name: 'Granted Skill Choice',
          system: {
            description: { value: '' },
            rules: [{
              key: 'ChoiceSet',
              flag: 'grantedSkill',
              prompt: 'Select a skill.',
              choices: { config: 'skills' },
              leveler: { grantsSkillTraining: true },
            }],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.classFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'grantedSkill',
          grantsSkillTraining: true,
        }),
      ]));
      expect(planner.plan.levels[2].classFeats[0].dynamicSkillRules).toEqual(expect.arrayContaining([
        expect.objectContaining({ skill: 'survival', source: 'choice:grantedskill' }),
      ]));

      const state = computeBuildState(actor, planner.plan, 2);
      expect(state.skills.survival).toBe(1);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('blocks granted dedication skill choices already selected from same-level intelligence bonus skills', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acrobatics: 'Acrobatics',
          athletics: 'Athletics',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
          intimidation: 'Intimidation',
          medicine: 'Medicine',
          performance: 'Performance',
          survival: 'Survival',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 1 },
          xp: { value: 0, max: 1000 },
        },
        skills: {
          acrobatics: { rank: 0, value: 0 },
          athletics: { rank: 0, value: 0 },
          deception: { rank: 0, value: 0 },
          diplomacy: { rank: 0, value: 0 },
          intimidation: { rank: 0, value: 0 },
          medicine: { rank: 0, value: 0 },
          performance: { rank: 0, value: 0 },
          survival: { rank: 0, value: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].intBonusSkills = ['survival'];
    planner.plan.levels[2].classFeats = [
      {
        uuid: 'feat-root',
        name: 'Spellshot Dedication',
        slug: 'spellshot-dedication',
        choices: {},
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Spellshot Dedication',
          slug: 'spellshot-dedication',
          system: {
            description: { value: '' },
            traits: { value: ['archetype', 'dedication', 'gunslinger'] },
            rules: [{ key: 'GrantItem', uuid: 'feat-granted' }],
          },
        };
      }
      if (uuid === 'feat-granted') {
        return {
          uuid,
          name: 'Spellshot Skill Choice',
          system: {
            description: { value: '' },
            rules: [{
              key: 'ChoiceSet',
              flag: 'grantedSkill',
              prompt: 'Select a skill.',
              choices: { config: 'skills' },
              leveler: { grantsSkillTraining: true },
            }],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const grantedSkillSet = context.classFeat.grantChoiceSets.find((entry) => entry.flag === 'grantedSkill');
      expect(grantedSkillSet).toBeTruthy();
      expect(grantedSkillSet.options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'survival', disabled: true }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('blocks authored skill-choice arrays already selected from same-level intelligence bonus skills', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acrobatics: 'Acrobatics',
          athletics: 'Athletics',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
          intimidation: 'Intimidation',
          medicine: 'Medicine',
          performance: 'Performance',
          survival: 'Survival',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          level: { value: 1 },
          xp: { value: 0, max: 1000 },
        },
        skills: {
          acrobatics: { rank: 0, value: 0 },
          athletics: { rank: 0, value: 0 },
          deception: { rank: 0, value: 0 },
          diplomacy: { rank: 0, value: 0 },
          intimidation: { rank: 0, value: 0 },
          medicine: { rank: 0, value: 0 },
          performance: { rank: 0, value: 0 },
          survival: { rank: 0, value: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].intBonusSkills = ['survival'];
    planner.plan.levels[2].classFeats = [
      {
        uuid: 'spellshot-main',
        name: 'Spellshot Dedication',
        slug: 'spellshot-dedication',
        choices: {},
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid !== 'spellshot-main') return null;
      return {
        uuid,
        name: 'Spellshot Dedication',
        slug: 'spellshot-dedication',
        system: {
          description: { value: '' },
          traits: { value: ['archetype', 'dedication', 'gunslinger'] },
          rules: [{
            key: 'ChoiceSet',
            flag: 'skill',
            prompt: 'Select a skill.',
            choices: [
              { value: 'acrobatics', label: 'Acrobatics' },
              { value: 'athletics', label: 'Athletics' },
              { value: 'deception', label: 'Deception' },
              { value: 'diplomacy', label: 'Diplomacy' },
              { value: 'intimidation', label: 'Intimidation' },
              { value: 'medicine', label: 'Medicine' },
              { value: 'performance', label: 'Performance' },
              { value: 'survival', label: 'Survival' },
            ],
            leveler: { grantsSkillTraining: true },
          }],
        },
      };
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const skillSet = context.classFeatChoiceSets.find((entry) => entry.flag === 'skill');
      expect(skillSet).toBeTruthy();
      expect(skillSet.options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'survival', disabled: true }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('builds custom feat special choice sets for Additional Lore and Multilingual', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    const originalGame = global.game;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        languages: {
          common: 'PF2E.Actor.Creature.Language.common',
          draconic: 'PF2E.Actor.Creature.Language.draconic',
          elven: 'PF2E.Actor.Creature.Language.elven',
        },
      },
    };
    global.game = {
      ...originalGame,
      i18n: {
        has: jest.fn((key) => key.startsWith('PF2E.Actor.Creature.Language.')),
        localize: jest.fn((key) => ({
          'PF2E.Actor.Creature.Language.common': 'Common',
          'PF2E.Actor.Creature.Language.draconic': 'Draconic',
          'PF2E.Actor.Creature.Language.elven': 'Elven',
        }[key] ?? key)),
      },
      pf2e: {
        settings: {
          campaign: {
            languages: {
              common: new Set(['common', 'elven']),
              uncommon: new Set(['draconic']),
              rare: new Set(),
              secret: new Set(),
            },
          },
        },
      },
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e-leveler' && key === 'gmContentGuidance') {
            return {
              'language:draconic': 'recommended',
            };
          }
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          if (scope === 'pf2e' && ['gradualBoostsVariant', 'freeArchetypeVariant', 'dualClassVariant'].includes(key)) return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          return false;
        }),
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].customFeats = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.additional-lore',
        name: 'Additional Lore',
        slug: 'additional-lore',
        choices: {},
      },
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.multilingual',
        name: 'Multilingual',
        slug: 'multilingual',
        choices: {},
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      slug: uuid.endsWith('additional-lore') ? 'additional-lore' : 'multilingual',
      system: { rules: [] },
    }));

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.customFeats[0].choiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerAdditionalLore',
          choiceType: 'lore',
          grantsSkillTraining: true,
        }),
      ]));
      expect(context.customFeats[1].choiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerMultilingualLanguage',
          choiceType: 'language',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'draconic', isRecommended: true, rarity: 'uncommon' }),
            expect.objectContaining({ value: 'elven', rarity: 'common' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
      global.game = originalGame;
    }
  });

  it('adds a language choice set for archetype feats that grant a language slot', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    const originalGame = global.game;

    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          draconic: 'Draconic',
          elven: 'Elven',
        },
        settings: {
          campaign: {
            languages: {
              common: new Set(['common', 'elven']),
              uncommon: new Set(['draconic']),
              rare: new Set(),
              secret: new Set(),
            },
          },
        },
      },
    };
    global.game = {
      ...global.game,
      pf2e: {
        settings: {
          campaign: {
            languages: {
              common: new Set(['common', 'elven']),
              uncommon: new Set(['draconic']),
              rare: new Set(),
              secret: new Set(),
            },
          },
        },
      },
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          if (scope === 'pf2e' && ['gradualBoostsVariant', 'freeArchetypeVariant', 'dualClassVariant'].includes(key)) return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          return false;
        }),
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      system: {
        rules: [{
          key: 'ActiveEffectLike',
          path: 'system.build.languages.max',
          value: 1,
        }],
      },
    }));

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerLanguageChoice',
          choiceType: 'language',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'draconic', rarity: 'uncommon' }),
            expect.objectContaining({ value: 'elven', rarity: 'common' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
      global.game = originalGame;
    }
  });

  it('adds a common-or-uncommon language choice set from feat description text', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    const originalGame = global.game;

    const languageSettings = {
      common: new Set(['common', 'elven']),
      uncommon: new Set(['draconic']),
      rare: new Set(['necril']),
      secret: new Set(),
    };
    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          draconic: 'Draconic',
          elven: 'Elven',
          necril: 'Necril',
        },
        settings: {
          campaign: {
            languages: languageSettings,
          },
        },
      },
    };
    global.game = {
      ...global.game,
      pf2e: {
        settings: {
          campaign: {
            languages: languageSettings,
          },
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.settlement-scholastics') {
        return {
          uuid,
          name: 'Settlement Scholastics',
          slug: 'settlement-scholastics',
          system: {
            description: {
              value: '<p>You gain the Additional Lore skill feat and learn a single common or uncommon language of your choice that is prevalent in that settlement.</p>',
            },
            rules: [{ key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.additional-lore' }],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.additional-lore') {
        return {
          uuid,
          name: 'Additional Lore',
          slug: 'additional-lore',
          system: { rules: [] },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      const choiceSet = context.archetypeFeatChoiceSets.find((entry) => entry.flag === 'levelerLanguageChoice');
      expect(choiceSet).toEqual(expect.objectContaining({
        choiceType: 'language',
        options: expect.arrayContaining([
          expect.objectContaining({ value: 'draconic', rarity: 'uncommon' }),
          expect.objectContaining({ value: 'elven', rarity: 'common' }),
        ]),
      }));
      expect(choiceSet.options.map((entry) => entry.value)).not.toContain('necril');
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
      global.game = originalGame;
    }
  });

  it('renders description-based language choices on skill feat cards', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          elven: 'Elven',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].skillFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.settlement-scholastics') {
        return {
          uuid,
          name: 'Settlement Scholastics',
          slug: 'settlement-scholastics',
          system: {
            description: {
              value: '<p>You gain Additional Lore and learn a single common or uncommon language of your choice.</p>',
            },
            rules: [{ key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.additional-lore' }],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.additional-lore') {
        return {
          uuid,
          name: 'Additional Lore',
          slug: 'additional-lore',
          system: { rules: [] },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.skillFeat.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerLanguageChoice',
          choiceType: 'language',
          choiceCategory: 'skillFeats',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'elven' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('adds a language choice set for predicate-gated archetype language slots', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          elven: 'Elven',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      system: {
        rules: [{
          key: 'ActiveEffectLike',
          path: 'system.build.languages.max',
          mode: 'add',
          value: 'ternary(gte(@actor.system.abilities.int.mod,2),1,0)',
        }],
      },
    }));

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerLanguageChoice',
          choiceType: 'language',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'elven' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('uses stored planned feat rules for language choices when the source document cannot be resolved', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          elven: 'Elven',
        },
      },
    };
    global.fromUuid = jest.fn(async () => null);

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
      system: {
        rules: [{
          key: 'ActiveEffectLike',
          path: 'system.build.languages.max',
          value: 1,
        }],
      },
    }];

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerLanguageChoice',
          choiceType: 'language',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'elven' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('uses stored planned feat description text for language choices when the source document cannot be resolved', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          elven: 'Elven',
        },
      },
    };
    global.fromUuid = jest.fn(async () => null);

    const actor = createMockActor({
      items: [],
      system: {
        details: {
          languages: { value: ['common'] },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      name: 'Settlement Scholastics',
      slug: 'settlement-scholastics',
      choices: {},
      system: {
        description: {
          value: '<p>You gain Additional Lore and learn a single common or uncommon language of your choice.</p>',
        },
      },
    }];

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerLanguageChoice',
          choiceType: 'language',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'elven' }),
          ]),
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('unlocks archetype feat picker dedication filtering once a class dedication is planned', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'oracle';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      slug: 'druid-dedication',
      name: 'Druid Dedication',
      level: 2,
      traits: ['archetype', 'multiclass', 'dedication', 'druid'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 4);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 4, buildState);

    expect(buildState.classArchetypeDedications.has('druid-dedication')).toBe(true);
    expect(buildState.classArchetypeTraits.has('druid')).toBe(true);
    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.lockedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.excludedTraits).toEqual(['dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.traitLogic).toBe('and');
  });

  it('reopens dedication feats when two same-level archetype feats complete the current dedication', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 4;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
      slug: 'archaeologist-dedication',
      name: 'Archaeologist Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'archaeologist'],
      choices: {},
    }];
    planner.plan.levels[4].classFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
      slug: 'trap-finder',
      name: 'Trap Finder',
      level: 1,
      traits: ['archetype', 'archaeologist'],
      system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      slug: 'settlement-scholastics',
      name: 'Settlement Scholastics',
      level: 4,
      traits: ['archetype', 'archaeologist'],
      system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 4);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 4, buildState);

    expect(buildState.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
  });

  it('reopens free-archetype dedication browsing when same-level class feat completes the current dedication', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
      slug: 'archaeologist-dedication',
      name: 'Archaeologist Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'archaeologist'],
      choices: {},
    }];
    planner.plan.levels[3].skillFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
      slug: 'trap-finder',
      name: 'Trap Finder',
      level: 1,
      traits: ['archetype', 'archaeologist', 'skill'],
      system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
      choices: {},
    }];
    planner.plan.levels[4].classFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      slug: 'settlement-scholastics',
      name: 'Settlement Scholastics',
      level: 4,
      traits: ['archetype', 'archaeologist'],
      system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [];

    const buildState = computeBuildState(planner.actor, planner.plan, 4);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 4, buildState);

    expect(buildState.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
  });

  it('reopens level 6 free-archetype dedication browsing after a level 4 skill archetype feat and level 6 free-archetype feat', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
      slug: 'archaeologist-dedication',
      name: 'Archaeologist Dedication',
      level: 2,
      traits: ['archetype', 'dedication'],
      choices: {},
    }];
    planner.plan.levels[4].skillFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      slug: 'settlement-scholastics',
      name: 'Settlement Scholastics',
      level: 4,
      traits: ['archetype', 'skill'],
      choices: { levelerLanguageChoice: 'aklo' },
    }];
    planner.plan.levels[6].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
      slug: 'trap-finder',
      name: 'Trap Finder',
      level: 1,
      traits: ['archetype', 'skill'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 6);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 6, buildState);

    expect(buildState.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
  });

  it('backfills stale planned feat traits before building dedication picker state', async () => {
    const originalFromUuid = global.fromUuid;
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
      slug: 'archaeologist-dedication',
      name: 'Archaeologist Dedication',
      level: 2,
      traits: ['archetype', 'dedication'],
      choices: {},
    }];
    planner.plan.levels[4].skillFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
      slug: 'settlement-scholastics',
      name: 'Settlement Scholastics',
      choices: { levelerLanguageChoice: 'aklo' },
    }];
    planner.plan.levels[6].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
      slug: 'trap-finder',
      name: 'Trap Finder',
      choices: {},
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.settlement-scholastics') {
        return {
          uuid,
          name: 'Settlement Scholastics',
          slug: 'settlement-scholastics',
          img: 'settlement.webp',
          system: {
            level: { value: 4 },
            traits: { value: ['archetype', 'skill'] },
            prerequisites: { value: [{ value: 'Archaeologist Dedication' }] },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.trap-finder') {
        return {
          uuid,
          name: 'Trap Finder',
          slug: 'trap-finder',
          img: 'trap.webp',
          system: {
            level: { value: 1 },
            traits: { value: ['skill'] },
            prerequisites: { value: [{ value: 'Archaeologist Dedication' }] },
          },
        };
      }
      return null;
    });

    try {
      await planner._backfillFeatCoreMetadata();
      const buildState = computeBuildState(planner.actor, planner.plan, 6);
      const preset = await planner._buildFeatPickerPreset('archetypeFeats', 6, buildState);

      expect(planner.plan.levels[4].skillFeats[0].traits).toEqual(['archetype', 'skill']);
      expect(planner.plan.levels[6].archetypeFeats[0].traits).toEqual(['skill']);
      expect(buildState.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
      expect(preset.excludedTraits).toBeUndefined();
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('unlocks archetype feat picker dedication filtering once any dedication is planned in the plan', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.aldori-duelist-dedication',
      slug: 'aldori-duelist-dedication',
      name: 'Aldori Duelist Dedication',
      level: 2,
      traits: ['archetype', 'dedication'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 4);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 4, buildState);

    expect(buildState.archetypeDedications.has('aldori-duelist-dedication')).toBe(true);
    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.lockedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.excludedTraits).toEqual(['dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.traitLogic).toBe('and');
  });

  it('reopens dedication feats once the current dedication is completed', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
      slug: 'medic-dedication',
      name: 'Medic Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'medic'],
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
      slug: 'treat-condition',
      name: 'Treat Condition',
      level: 4,
      traits: ['archetype', 'skill'],
      system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
      choices: {},
    }];
    planner.plan.levels[6].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.holistic-care',
      slug: 'holistic-care',
      name: 'Holistic Care',
      level: 6,
      traits: ['archetype', 'skill'],
      system: { prerequisites: { value: [{ value: 'trained in Diplomacy, Treat Condition' }] } },
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 8);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 8, buildState);

    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.lockedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.traitLogic).toBe('or');
  });

  it('can ignore the free archetype dedication lock via setting', async () => {
    global._testSettings = {
      ...(global._testSettings ?? {}),
      'pf2e-leveler': {
        ...(global._testSettings?.['pf2e-leveler'] ?? {}),
        ignoreFreeArchetypeDedicationLock: true,
      },
    };

    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
      slug: 'medic-dedication',
      name: 'Medic Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'medic'],
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
      slug: 'treat-condition',
      name: 'Treat Condition',
      level: 4,
      traits: ['archetype', 'skill'],
      system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 8);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 8, buildState);

    expect(buildState.canTakeNewArchetypeDedication).toBe(false);
    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.lockedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.traitLogic).toBe('or');
    expect(preset.ignoreDedicationLock).toBe(true);
  });

  it('reopens dedication browsing for Cavalier special second-dedication rule', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.cavalier-dedication',
      slug: 'cavalier-dedication',
      name: 'Cavalier Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'cavalier'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 4);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 4, buildState);

    expect(buildState.incompleteArchetypeDedications).toEqual(new Set(['cavalier-dedication']));
    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.traitLogic).toBe('or');
    expect(preset.ignoreDedicationLock).toBe(false);
  });

  it('does not let Cavalier special rule open a third dedication', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.cavalier-dedication',
      slug: 'cavalier-dedication',
      name: 'Cavalier Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'cavalier'],
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
      slug: 'medic-dedication',
      name: 'Medic Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'medic'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 6);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 6, buildState);

    expect(buildState.canTakeNewArchetypeDedication).toBe(false);
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.excludedTraits).toEqual(['dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.ignoreDedicationLock).toBe(false);
  });

  it('reopens dedication browsing after two completed dedications', async () => {
    const actor = createMockActor({ items: [] });
    actor.class.slug = 'magus';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.first-dedication',
      slug: 'first-dedication',
      name: 'First Dedication',
      level: 2,
      traits: ['archetype', 'dedication', 'first-archetype'],
      choices: {},
    }];
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.first-follow-up-1',
      slug: 'first-follow-up-one',
      name: 'First Follow Up One',
      level: 4,
      traits: ['archetype'],
      choices: {},
    }];
    planner.plan.levels[6].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.first-follow-up-2',
      slug: 'first-follow-up-two',
      name: 'First Follow Up Two',
      level: 6,
      traits: ['archetype'],
      choices: {},
    }];
    planner.plan.levels[8].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.second-dedication',
      slug: 'second-dedication',
      name: 'Second Dedication',
      level: 8,
      traits: ['archetype', 'dedication', 'second-archetype'],
      choices: {},
    }];
    planner.plan.levels[10].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.second-follow-up-1',
      slug: 'second-follow-up-one',
      name: 'Second Follow Up One',
      level: 10,
      traits: ['archetype'],
      choices: {},
    }];
    planner.plan.levels[12].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.second-follow-up-2',
      slug: 'second-follow-up-two',
      name: 'Second Follow Up Two',
      level: 12,
      traits: ['archetype'],
      choices: {},
    }];

    const buildState = computeBuildState(planner.actor, planner.plan, 14);
    const preset = await planner._buildFeatPickerPreset('archetypeFeats', 14, buildState);

    expect(buildState.canTakeNewArchetypeDedication).toBe(true);
    expect(preset.selectedFeatTypes).toEqual(['archetype']);
    expect(preset.lockedFeatTypes).toEqual(['archetype']);
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.excludedTraits).toBeUndefined();
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.traitLogic).toBe('or');
  });

  it('shows fallback skill choices for champion dedication when a granted skill already overlaps', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          religion: 'Religion',
          society: 'Society',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          religion: { rank: 1 },
          society: { rank: 0 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.champion-dedication',
      slug: 'champion-dedication',
      name: 'Champion Dedication',
      level: 2,
      choices: { deity: 'Compendium.pf2e.deities.Item.abadar' },
      skillRules: [{ skill: 'religion', value: 1 }],
    }];
    planner._compendiumCache.deities = [
      { uuid: 'Compendium.pf2e.deities.Item.abadar', name: 'Abadar', img: 'abadar.webp', type: 'deity', category: 'deity', skill: 'society' },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.champion-dedication') {
        return {
          uuid,
          system: {
            description: {
              value: "<p>You become trained in Religion and your deity's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'deity',
                prompt: 'Select a deity.',
                choices: { filter: ['item:type:deity'] },
              },
            ],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.archetypeFeatChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({ flag: 'deity', choiceType: 'item' }),
        expect.objectContaining({
          flag: 'levelerSkillFallback1',
          prompt: 'Select a skill.',
          choiceType: 'skill',
          options: expect.arrayContaining([
            expect.objectContaining({ value: 'deception', disabled: false }),
          ]),
        }),
      ]));
      expect(context.archetypeFeatChoiceSets.find((entry) => entry.flag === 'levelerSkillFallback1').options.some((entry) => entry.value === 'religion')).toBe(false);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('shows fallback skill choices for druid dedication when the granted nature and order skill already overlap', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          athletics: 'Athletics',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          nature: { rank: 1 },
          athletics: { rank: 1 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      slug: 'druid-dedication',
      name: 'Druid Dedication',
      level: 2,
      choices: { druidicOrder: 'Compendium.pf2e.classfeatures.Item.animal-order' },
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          system: {
            description: {
              value: "<p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.animal-order') {
        return {
          uuid,
          name: 'Animal Order',
          system: {
            rules: [
              { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.athletics.rank', value: 1 },
            ],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const fallbackSets = context.archetypeFeatChoiceSets.filter((entry) => entry.flag.startsWith('levelerSkillFallback'));
      expect(fallbackSets).toHaveLength(2);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('shows druid dedication fallback skill choices when the selected order skill is described in text instead of rules', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          intimidation: 'Intimidation',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          nature: { rank: 1 },
          intimidation: { rank: 1 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      slug: 'druid-dedication',
      name: 'Druid Dedication',
      level: 2,
      choices: { druidicOrder: 'Compendium.pf2e.classfeatures.Item.flame-order' },
      skillRules: [{ skill: 'nature', value: 1 }],
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          system: {
            description: {
              value: "<p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.flame-order') {
        return {
          uuid,
          name: 'Flame Order',
          system: {
            description: {
              value: '<p>Order Skill Intimidation</p>',
            },
            rules: [],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const fallbackSets = context.archetypeFeatChoiceSets.filter((entry) => entry.flag.startsWith('levelerSkillFallback'));
      expect(fallbackSets).toHaveLength(2);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('backfills planner feat skill rules from source text when a saved druid dedication entry is stale', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          athletics: 'Athletics',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          nature: { rank: 1 },
          athletics: { rank: 1 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      slug: 'druid-dedication',
      name: 'Druid Dedication',
      level: 2,
      choices: { druidicOrder: 'Compendium.pf2e.classfeatures.Item.animal-order' },
      skillRules: [],
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          system: {
            description: {
              value: "<p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.animal-order') {
        return {
          uuid,
          name: 'Animal Order',
          system: {
            rules: [
              { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.athletics.rank', value: 1 },
            ],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const fallbackSets = context.archetypeFeatChoiceSets.filter((entry) => entry.flag.startsWith('levelerSkillFallback'));
      expect(fallbackSets).toHaveLength(2);
      expect(planner.plan.levels[2].archetypeFeats[0].skillRules).toEqual(
        expect.arrayContaining([expect.objectContaining({ skill: 'nature', value: 1 })]),
      );
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('backfills selected training-granting skill choices onto stale planned feat entries', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          arc: 'PF2E.SkillArc',
          ath: 'PF2E.SkillAth',
          cra: 'PF2E.SkillCra',
          dec: 'PF2E.SkillDec',
          dip: 'PF2E.SkillDip',
          itm: 'PF2E.SkillItm',
          med: 'PF2E.SkillMed',
          nat: 'PF2E.SkillNat',
          occ: 'PF2E.SkillOcc',
          prf: 'PF2E.SkillPrf',
          rel: 'PF2E.SkillRel',
          soc: 'PF2E.SkillSoc',
          ste: 'PF2E.SkillSte',
          sur: 'PF2E.SkillSur',
          thi: 'PF2E.SkillThi',
        },
      },
    };

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          survival: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 4;
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.test.Item.scholar',
      slug: 'scholar',
      name: 'Scholar',
      level: 1,
      choices: { skill: 'survival' },
      dynamicSkillRules: [],
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.test.Item.scholar') {
        return {
          uuid,
          name: 'Scholar',
          system: {
            description: { value: '<p>Choose a magical tradition skill.</p>' },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'skill',
                prompt: 'Select a skill.',
                choices: { config: 'skills' },
                leveler: { grantsSkillTraining: true },
              },
            ],
          },
        };
      }
      return null;
    });

    try {
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      expect(context.archetypeFeatChoiceSets.find((entry) => entry.flag === 'skill')).toBeTruthy();
      expect(planner.plan.levels[4].archetypeFeats[0].dynamicSkillRules).toEqual([
        expect.objectContaining({ skill: 'survival', value: 1, source: 'choice:skill' }),
      ]);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('builds retraining context for planned feat and skill retrains', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 8;
    planner.plan.levels[3].skillIncreases = [{ skill: 'stealth', toRank: 2 }];
    planner.plan.levels[8].retrainedFeats = [
      {
        fromLevel: 2,
        category: 'classFeats',
        original: { name: 'Quick Bomber', slug: 'quick-bomber' },
        replacement: { name: 'Alchemical Familiar', slug: 'alchemical-familiar' },
      },
    ];
    planner.plan.levels[8].retrainedSkillIncreases = [
      {
        fromLevel: 3,
        original: { skill: 'stealth', fromRank: 1, toRank: 2 },
        replacement: { skill: 'occultism', fromRank: 1, toRank: 2 },
      },
    ];

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

    expect(context.hasRetraining).toBe(true);
    expect(context.retrainedFeats).toEqual([
      expect.objectContaining({
        index: 0,
        activityLevel: 8,
        fromLevel: 2,
        categoryLabel: 'Class Feat',
        originalName: 'Quick Bomber',
        replacementName: 'Alchemical Familiar',
        downtimeLabel: '1 week',
        sourceLabel: 'Original Level 2',
      }),
    ]);
    expect(context.retrainedSkillIncreases).toEqual([
      expect.objectContaining({
        index: 0,
        activityLevel: 8,
        fromLevel: 3,
        originalName: 'Stealth',
        replacementName: 'Occultism',
        rankName: 'Expert',
        downtimeLabel: '1 week',
        sourceLabel: 'Original Level 3',
      }),
    ]);
    expect(context.skillRetrainSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromLevel: 3, skill: 'stealth', label: 'Stealth', rankName: 'Expert' }),
    ]));
  });

  it('offers creation-selected trained skills as skill retrain sources', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    actor.system.skills.athletics.rank = 1;
    actor.getFlag = jest.fn(() => ({ skills: ['athletics'] }));

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 8;
    planner.plan.levels[3].skillIncreases = [{ skill: 'stealth', toRank: 2 }];

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

    expect(context.skillRetrainSources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fromLevel: 1,
        sourceType: 'initialSkill',
        skill: 'athletics',
        toRank: 1,
        label: 'Athletics',
        rankName: 'Trained',
      }),
      expect.objectContaining({ fromLevel: 3, skill: 'stealth', toRank: 2 }),
    ]));
    expect(planner._getSkillRetrainSources()).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromLevel: 1, sourceType: 'initialSkill', skill: 'athletics', toRank: 1 }),
    ]));
  });

  it('infers initial trained skill retrain sources when creation selected skills are not saved', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    actor.system.skills.athletics.rank = 1;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    for (const level of [2, 3]) {
      planner.selectedLevel = level;
      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

      expect(context.skillRetrainSources).toEqual(expect.arrayContaining([
        expect.objectContaining({
          fromLevel: 1,
          sourceType: 'initialSkill',
          skill: 'athletics',
          toRank: 1,
          label: 'Athletics',
          rankName: 'Trained',
        }),
      ]));
      expect(planner._getSkillRetrainSources()).toEqual(expect.arrayContaining([
        expect.objectContaining({ fromLevel: 1, sourceType: 'initialSkill', skill: 'athletics', toRank: 1 }),
      ]));
    }
  });

  it('infers initial trained skill retrain sources from PF2E short skill keys', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    actor.system.skills = {
      ath: { rank: 1 },
      ste: { rank: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 2;

    const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());

    expect(context.skillRetrainSources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fromLevel: 1,
        sourceType: 'initialSkill',
        skill: 'athletics',
        toRank: 1,
        label: 'Athletics',
        rankName: 'Trained',
      }),
    ]));
    expect(context.hasSkillRetrainSources).toBe(true);
    expect(planner._getSkillRetrainSources()).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromLevel: 1, sourceType: 'initialSkill', skill: 'athletics', toRank: 1 }),
    ]));
  });

  it('renders retrain source choices as searchable rows instead of a native select', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    const planner = new LevelPlanner(actor);
    const prompt = jest.fn(async () => 0);
    global.foundry.applications.api.DialogV2 = { prompt };

    const source = await planner._promptRetrainSource({
      title: 'Retrain Feat',
      name: 'feat',
      sources: [
        {
          fromLevel: 1,
          category: 'classFeats',
          original: { name: 'Diverse Lore', img: 'feat.webp' },
        },
        {
          fromLevel: 2,
          category: 'skillFeats',
          original: { name: 'Dubious Knowledge', img: 'skill.webp' },
        },
      ],
      getLabel: (entry) => entry.original.name,
      getMeta: (entry) => `${formatTestFeatCategoryLabel(entry.category)} - Original Level ${entry.fromLevel}`,
      getIcon: (entry) => entry.original.img,
      getGroupLabel: (entry) => formatTestFeatCategoryLabel(entry.category),
    });

    expect(source.original.name).toBe('Diverse Lore');
    const content = prompt.mock.calls[0][0].content;
    expect(content).toContain('data-retrain-search');
    expect(content).toContain('data-retrain-choice-group');
    expect(content).toContain('<details');
    expect(content).toContain('<summary');
    expect(content).toContain('open');
    expect(content).toContain('Class Feat');
    expect(content).toContain('Skill Feat');
    expect(content).toContain('Original Level 1');
    expect(content).toContain('Original Level 2');
    expect(content).toContain('data-retrain-choice');
    expect(content).toContain('feat.webp');
    expect(content).toContain('>Diverse Lore<');
    expect(content).not.toContain('Level 1: Diverse Lore');
    expect(content).not.toContain('<select');
    expect(prompt.mock.calls[0][0].ok.label).toBe('Select');
  });

  it('renders skill retrain replacement choices as searchable buttons instead of a native select', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    actor.system.skills.stealth.rank = 2;
    actor.system.skills.occultism.rank = 1;
    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 8;
    const prompt = jest.fn(async () => 'occultism');
    global.foundry.applications.api.DialogV2 = { prompt };

    const result = await planner._promptSkillRetrainReplacement({ skill: 'stealth', toRank: 2 });

    expect(result).toBe('occultism');
    const content = prompt.mock.calls[0][0].content;
    expect(content).toContain('data-retrain-search');
    expect(content).toContain('data-retrain-choice');
    expect(content).toContain('Occultism');
    expect(content).toContain('retrain-rank-text--trained');
    expect(content).toContain('retrain-rank-text--expert');
    expect(content).not.toContain('<select');
    expect(prompt.mock.calls[0][0].ok.label).toBe('Select');

    const container = document.createElement('div');
    container.innerHTML = content;
    document.body.append(container);
    const search = container.querySelector('[data-retrain-search]');
    search.value = 'occultism';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = Array.from(container.querySelectorAll('[data-retrain-choice]'));
    const occultismRow = rows.find((row) => row.textContent.includes('Occultism'));
    expect(occultismRow.hidden).toBe(false);
    expect(rows.some((row) => !row.textContent.includes('Occultism') && row.hidden)).toBe(true);
    container.remove();
  });

  it('stores skill retrain replacement ranks as one-step increases', async () => {
    const actor = createMockActor();
    actor.items = [];
    actor.class.slug = 'alchemist';
    actor.system.skills.stealth.rank = 3;
    actor.system.skills.occultism.rank = 1;
    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 16;
    const source = {
      fromLevel: 15,
      skill: 'stealth',
      fromRank: 2,
      toRank: 3,
    };
    planner._getSkillRetrainSources = jest.fn(() => [source]);
    planner._promptRetrainSource = jest.fn(async () => source);
    planner._promptSkillRetrainReplacement = jest.fn(async () => 'occultism');
    planner._savePlanAndRender = jest.fn(async () => {});

    await planner._openSkillRetrainPicker();

    expect(planner.plan.levels[16].retrainedSkillIncreases).toEqual([
      {
        fromLevel: 15,
        original: { skill: 'stealth', fromRank: 2, toRank: 3 },
        replacement: { skill: 'occultism', fromRank: 1, toRank: 2 },
      },
    ]);
  });
});

function formatTestMeta(category) {
  return category;
}

function formatTestFeatCategoryLabel(category) {
  return {
    classFeats: 'Class Feat',
    skillFeats: 'Skill Feat',
  }[category] ?? formatTestMeta(category);
}
