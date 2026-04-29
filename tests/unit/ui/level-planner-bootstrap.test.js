import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { getPlan, savePlan } from '../../../scripts/plan/plan-store.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import { loadFeats } from '../../../scripts/feats/feat-cache.js';

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
    expect(preset.traitLogic).toBe('and');
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
        uuid: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
        name: 'Alchemical Familiar',
        type: 'feat',
        slug: 'alchemical-familiar',
        traits: ['alchemist'],
        otherTags: [],
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
        rarity: 'common',
        level: 1,
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
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
                  'item:trait:{actor|system.details.class.trait}',
                ],
              },
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
          options: [
            expect.objectContaining({
              value: 'Compendium.pf2e.feats-srd.Item.alchemical-familiar',
              label: 'Alchemical Familiar',
            }),
          ],
        }),
      ]));
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
    expect(preset.traitLogic).toBe('and');
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
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.excludedTraits).toEqual(['dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.traitLogic).toBe('and');
    expect(preset.ignoreDedicationLock).toBeUndefined();
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
    expect(preset.traitLogic).toBe('and');
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
});
