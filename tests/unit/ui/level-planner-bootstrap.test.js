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
    expect(preset.selectedTraits).toBeUndefined();
    expect(preset.lockedTraits).toBeUndefined();
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

  it('shows an ancestry feat slot under Ancestral Paragon general feats', async () => {
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
    expect(context.showGeneralFeatGrantedAncestryFeat).toBe(true);
    expect(context.showAncestryFeat).toBe(false);
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
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.showDedications).toBe(false);
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
    expect(preset.selectedTraits).toEqual(['archetype']);
    expect(preset.lockedTraits).toEqual(['archetype']);
    expect(preset.showDedications).toBe(false);
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
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.showDedications).toBe(true);
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
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.showDedications).toBe(true);
    expect(preset.ignoreDedicationLock).toBe(true);
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
    expect(preset.selectedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.lockedTraits).toEqual(['archetype', 'dedication']);
    expect(preset.showDedications).toBe(true);
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
