import { extractFeatSkillRules, LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { createPlan, setLevelBoosts, setLevelSkillIncrease } from '../../../scripts/plan/plan-model.js';
import { invalidateGuidanceCache } from '../../../scripts/access/content-guidance.js';
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

describe('LevelPlanner intelligence boost planner choices', () => {
  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);
  });

  it('shows localized extra skill and language selections when INT modifier increases', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.languages = { value: ['common'] };
    global.game = {
      ...global.game,
      i18n: {
        has: jest.fn((key) => key.startsWith('PF2E.Actor.Creature.Language.')),
        localize: jest.fn((key) => ({
          'PF2E.Actor.Creature.Language.draconic': 'Draconic',
          'PF2E.Actor.Creature.Language.elven': 'Elven',
        }[key] ?? key)),
      },
    };
    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'PF2E.Actor.Creature.Language.common',
          draconic: 'PF2E.Actor.Creature.Language.draconic',
          elven: 'PF2E.Actor.Creature.Language.elven',
        },
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    expect(planner._buildIntelligenceBenefitContext(5)).toBeNull();

    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);

    expect(planner._buildIntelligenceBenefitContext(5)).toEqual({
      count: 1,
      gainsSingle: true,
    });
    expect(planner._buildIntBonusSkillContext(planner.plan.levels[5], 5)).toBeTruthy();
    expect(planner._buildIntBonusLanguageContext(planner.plan.levels[5], 5)).toEqual([
      expect.objectContaining({ slug: 'draconic', label: 'Draconic', rarity: 'common', selected: false }),
      expect.objectContaining({ slug: 'elven', label: 'Elven', rarity: 'common', selected: false }),
    ]);
  });

  it('shows Intelligence bonus selections for imported historical boosts before current level', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
          xp: { value: 0, max: 1000 },
        },
        abilities: {
          int: { mod: 4 },
        },
        build: {
          attributes: {
            boosts: {
              5: ['str', 'dex', 'con', 'int'],
            },
          },
        },
      },
    });
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = {
      ...createPlan('alchemist'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
      },
    };
    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);

    expect(planner._buildIntelligenceBenefitContext(5)).toEqual({
      count: 1,
      gainsSingle: true,
    });
  });

  it('renders an add-Lore control for Intelligence bonus skill selections', () => {
    const template = readFileSync('templates/level-planner.hbs', 'utf8');
    const skillSection = template.slice(
      template.indexOf('PF2E_LEVELER.CREATION.INTELLIGENCE_BONUS_SKILLS'),
      template.indexOf('{{#if intBonusLanguageOptions}}'),
    );

    expect(skillSection).toContain('data-action="addIntBonusLoreSkill"');
  });

  it('renders pending partial ability modifiers in boost labels', () => {
    const template = readFileSync('templates/level-planner.hbs', 'utf8');

    expect(template).toContain('+{{this.mod}}(partial) → +{{this.newMod}}');
    expect(template).toContain('+{{this.mod}}{{#if this.pendingPartial}}(partial){{/if}}');
  });

  it('includes language rarity and GM guidance in planner intelligence language choices', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.languages = { value: ['common'] };
    global.game = {
      ...global.game,
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
    };
    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'PF2E.Actor.Creature.Language.common',
          draconic: 'PF2E.Actor.Creature.Language.draconic',
          elven: 'PF2E.Actor.Creature.Language.elven',
        },
      },
    };

    global._testSettings = {
      ...(global._testSettings ?? {}),
      'pf2e-leveler': {
        ...(global._testSettings?.['pf2e-leveler'] ?? {}),
        gmContentGuidance: {
          'language:draconic': 'recommended',
          'language:elven': 'not-recommended',
        },
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);

    const languages = planner._buildIntBonusLanguageContext(planner.plan.levels[5], 5);

    expect(languages).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: 'draconic', rarity: 'uncommon', isRecommended: true }),
      expect.objectContaining({ slug: 'elven', rarity: 'common', isNotRecommended: true }),
    ]));
  });

  it('keeps disallowed planner bonus languages selectable for GMs', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.languages = { value: ['common'] };
    global.game = {
      ...global.game,
      i18n: {
        has: jest.fn((key) => key.startsWith('PF2E.Actor.Creature.Language.')),
        localize: jest.fn((key) => ({
          'PF2E.Actor.Creature.Language.common': 'Common',
          'PF2E.Actor.Creature.Language.draconic': 'Draconic',
        }[key] ?? key)),
      },
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e-leveler' && key === 'gmContentGuidance') {
            return { 'language:draconic': 'disallowed' };
          }
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          if (scope === 'pf2e' && ['gradualBoostsVariant', 'freeArchetypeVariant', 'dualClassVariant'].includes(key)) return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          return false;
        }),
      },
      pf2e: {
        settings: {
          campaign: {
            languages: {
              common: new Set(['common']),
              uncommon: new Set(['draconic']),
              rare: new Set(),
              secret: new Set(),
            },
          },
        },
      },
    };
    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'PF2E.Actor.Creature.Language.common',
          draconic: 'PF2E.Actor.Creature.Language.draconic',
        },
      },
    };
    invalidateGuidanceCache();

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);

    const languages = planner._buildIntBonusLanguageContext(planner.plan.levels[5], 5);
    expect(languages.find((entry) => entry.slug === 'draconic')).toEqual(
      expect.objectContaining({
        isDisallowed: true,
        disabled: false,
        guidanceSelectionBlocked: false,
        guidanceSelectionTooltip: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.GM_OVERRIDE_ALLOWED',
      }),
    );
  });

  it('marks imported past boosts as applied from their reconstructed baseline', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 5;
    actor.system.abilities.str.mod = 4;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 5;
    planner.plan.levels[5].abilityBoosts = ['str'];

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[5], choices);
    const strength = context.find((entry) => entry.key === 'str');

    expect(strength).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 3,
      newMod: 4,
    }));
  });

  it('reconstructs standard boost baselines for imported mid-level actors', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.build.attributes.boosts[5] = ['dex', 'con'];
    actor.system.abilities.dex.mod = 4.5;
    actor.system.abilities.con.mod = 4;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4.5, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 0, base: 0 },
      wis: { mod: 0, base: 0 },
      cha: { mod: 0, base: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 5;

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[5], choices);
    const dexterity = context.find((entry) => entry.key === 'dex');
    const constitution = context.find((entry) => entry.key === 'con');

    expect(dexterity).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 4,
      newMod: 4,
      partial: true,
      completesPartial: false,
    }));
    expect(constitution).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 3,
      newMod: 4,
      partial: false,
      completesPartial: false,
    }));
  });

  it('uses level 1 boost history when reconstructing hidden partial boosts', () => {
    const actor = createMockActor();
    actor.class.slug = 'fighter';
    actor.class.system.keyAbility = { value: ['str', 'dex'], selected: 'str' };
    actor.ancestry = {
      system: {
        boosts: {
          0: { value: ['str'] },
          1: { value: ['con'] },
        },
        flaws: {},
      },
    };
    actor.background = {
      system: {
        boosts: {
          0: { value: ['str'] },
          1: { value: ['con'] },
        },
      },
    };
    actor.system.details.level.value = 8;
    actor.system.build.attributes.boosts[1] = ['str', 'con'];
    actor.system.build.attributes.boosts[5] = ['str', 'con'];
    actor.system.abilities.str.mod = 4.5;
    actor.system.abilities.con.mod = 4;
    actor.abilities = {
      str: { mod: 4.5, base: 4 },
      dex: { mod: 0, base: 0 },
      con: { mod: 4, base: 4 },
      int: { mod: 0, base: 0 },
      wis: { mod: 0, base: 0 },
      cha: { mod: 0, base: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 5;

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[5], choices);
    const strength = context.find((entry) => entry.key === 'str');
    const constitution = context.find((entry) => entry.key === 'con');

    expect(strength).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 4,
      newMod: 4,
      partial: true,
      completesPartial: false,
    }));
    expect(constitution).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 3,
      newMod: 4,
      partial: false,
      completesPartial: false,
    }));
  });

  it('uses raw imported partial boosts when previewing future standard boosts', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.abilities.dex.mod = 4.5;
    actor.system.abilities.con.mod = 4;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4.5, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 0, base: 0 },
      wis: { mod: 0, base: 0 },
      cha: { mod: 0, base: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 10, ['dex', 'con']);
    setLevelBoosts(planner.plan, 15, ['dex', 'con']);
    const choices = [{ type: 'abilityBoosts', count: 4 }];

    planner.selectedLevel = 10;
    const level10 = planner._buildAttributeContext(planner.plan.levels[10], choices);
    expect(level10.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      pendingPartial: true,
      completesPartial: true,
    }));
    expect(level10.find((entry) => entry.key === 'con')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 4,
      partial: true,
      pendingPartial: false,
      completesPartial: false,
    }));

    planner.selectedLevel = 15;
    const level15 = planner._buildAttributeContext(planner.plan.levels[15], choices);
    expect(level15.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 5,
      newMod: 5,
      partial: true,
      pendingPartial: false,
      completesPartial: false,
    }));
    expect(level15.find((entry) => entry.key === 'con')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      pendingPartial: true,
      completesPartial: true,
    }));
  });

  it('reconstructs hidden level 5 partial boosts from level 1 boost history when previewing level 10', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.class.system.keyAbility = { selected: 'dex', value: ['dex'] };
    actor.system.details.level.value = 8;
    actor.ancestry = {
      system: {
        boosts: {
          0: { value: ['dex'] },
          1: { value: ['con'] },
        },
        flaws: {},
      },
    };
    actor.background = {
      system: {
        boosts: {
          0: { value: ['dex'] },
          1: { value: ['con'] },
        },
      },
    };
    actor.system.build.attributes.boosts[1] = ['dex', 'con', 'cha', 'wis'];
    actor.system.build.attributes.boosts[5] = ['dex', 'con', 'int', 'cha'];
    actor.system.abilities.dex.mod = 4;
    actor.system.abilities.con.mod = 4;
    actor.system.abilities.int.mod = 1;
    actor.system.abilities.wis.mod = 1;
    actor.system.abilities.cha.mod = 2;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 1, base: 1 },
      wis: { mod: 1, base: 1 },
      cha: { mod: 2, base: 2 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 10, ['dex', 'con', 'int', 'cha']);
    planner.selectedLevel = 10;

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[10], choices);

    expect(context.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      completesPartial: true,
    }));
  });

  it('uses PF2e stored creation boost buckets when previewing future partial boosts', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.build.attributes.boosts = {
      ancestry: ['dex', 'con'],
      background: ['dex', 'con'],
      class: 'dex',
      1: ['dex', 'con', 'cha', 'wis'],
      5: ['dex', 'con', 'int', 'cha'],
      10: [],
      15: [],
      20: [],
    };
    actor.system.abilities.dex.mod = 4;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 1, base: 1 },
      wis: { mod: 1, base: 1 },
      cha: { mod: 2, base: 2 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 10, ['dex', 'con', 'int', 'cha']);
    planner.selectedLevel = 10;

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[10], choices);

    expect(context.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      completesPartial: true,
    }));
  });

  it('preserves hidden gradual partial boosts when previewing the next gradual set', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.build.attributes.boosts = {
      ancestry: ['dex', 'con'],
      background: ['dex', 'con'],
      class: 'dex',
      1: ['dex', 'con', 'cha', 'wis'],
      5: ['dex', 'con', 'int', 'cha'],
      10: [],
      15: [],
      20: [],
    };
    actor.system.abilities.dex.mod = 4;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 1, base: 1 },
      wis: { mod: 1, base: 1 },
      cha: { mod: 2, base: 2 },
    };
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(planner.plan, 10, ['dex']);
    planner.selectedLevel = 10;

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const context = planner._buildAttributeContext(planner.plan.levels[10], choices);

    expect(context.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      completesPartial: true,
    }));
  });

  it('shows hidden gradual partial boosts on already-applied later gradual levels', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.build.attributes.boosts = {
      ancestry: ['dex', 'con'],
      background: ['dex', 'con'],
      class: 'dex',
      1: ['dex', 'con', 'cha', 'wis'],
      5: ['dex', 'con', 'int', 'cha'],
      10: [],
      15: [],
      20: [],
    };
    actor.system.abilities.dex.mod = 4;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 4, base: 4 },
      con: { mod: 4, base: 4 },
      int: { mod: 1, base: 1 },
      wis: { mod: 1, base: 1 },
      cha: { mod: 2, base: 2 },
    };
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 7;

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const context = planner._buildAttributeContext(planner.plan.levels[7], choices);

    expect(context.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({
      mod: 4,
      selected: false,
      pendingPartial: true,
      completesPartial: true,
    }));
  });

  it('uses fractional actor base values when previewing future Intelligence partial boosts', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 5;
    actor.system.abilities.int.mod = 4;
    actor.system.build.attributes.boosts[5] = ['int'];
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 0, base: 0 },
      con: { mod: 0, base: 0 },
      int: { mod: 4, base: 4.5 },
      wis: { mod: 0, base: 0 },
      cha: { mod: 0, base: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    setLevelBoosts(planner.plan, 10, ['int']);
    planner.selectedLevel = 10;

    const choices = [{ type: 'abilityBoosts', count: 4 }];
    const context = planner._buildAttributeContext(planner.plan.levels[10], choices);
    expect(context.find((entry) => entry.key === 'int')).toEqual(expect.objectContaining({
      mod: 4,
      newMod: 5,
      partial: true,
      completesPartial: true,
    }));
    expect(planner._buildIntelligenceBenefitContext(10)).toEqual({
      count: 1,
      gainsSingle: true,
    });
  });

  it('uses historical skill state for imported past Intelligence bonus choices', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.level.value = 8;
    actor.system.abilities.int.mod = 4;
    actor.system.build.attributes.boosts[5] = ['int'];
    actor.system.skills.intimidation.rank = 1;
    actor.system.skills.intimidation.value = 1;
    actor.abilities = {
      str: { mod: 0, base: 0 },
      dex: { mod: 0, base: 0 },
      con: { mod: 0, base: 0 },
      int: { mod: 4, base: 4 },
      wis: { mod: 0, base: 0 },
      cha: { mod: 0, base: 0 },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.importedFromActor = {
      actorLevel: 8,
      hideHistoricalSkillIncreases: true,
      initialSkills: ['arcana'],
    };
    setLevelBoosts(planner.plan, 5, ['int']);
    planner.selectedLevel = 5;

    expect(planner._buildIntelligenceBenefitContext(5)).toEqual({
      count: 1,
      gainsSingle: true,
    });

    const skills = planner._buildIntBonusSkillContext(planner.plan.levels[5], 5);
    expect(skills.find((entry) => entry.slug === 'intimidation')).toEqual(expect.objectContaining({
      disabled: false,
      selected: false,
      trained: false,
    }));
  });

  it('replaces single-slot Intelligence bonus selections when clicking a different option', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.details.languages = { value: ['common'] };
    global.game = {
      ...global.game,
      i18n: {
        has: jest.fn(() => false),
        localize: jest.fn((key) => key),
      },
    };
    global.CONFIG = {
      PF2E: {
        languages: {
          common: 'Common',
          draconic: 'Draconic',
          elven: 'Elven',
        },
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner._savePlanAndRender = jest.fn();

    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);
    planner.selectedLevel = 5;

    planner._handleIntBonusSkillToggle('arcana');
    expect(planner.plan.levels[5].intBonusSkills).toEqual(['arcana']);

    planner._handleIntBonusSkillToggle('athletics');
    expect(planner.plan.levels[5].intBonusSkills).toEqual(['athletics']);

    planner._handleIntBonusLanguageToggle('draconic');
    expect(planner.plan.levels[5].intBonusLanguages).toEqual(['draconic']);

    planner._handleIntBonusLanguageToggle('elven');
    expect(planner.plan.levels[5].intBonusLanguages).toEqual(['elven']);
  });

  it('shows same-level INT bonus training in the skill increase picker', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    setLevelBoosts(planner.plan, 5, ['str', 'dex', 'con', 'int']);
    planner.plan.levels[5].intBonusSkills = ['crafting'];
    planner.selectedLevel = 5;

    const skills = planner._buildSkillContext(planner.plan.levels[5], 5);
    const crafting = skills.find((entry) => entry.slug === 'crafting');
    expect(crafting.rank).toBe(1);
    expect(crafting.nextRankName).toBe('expert');

    setLevelSkillIncrease(planner.plan, 5, { skill: 'crafting', toRank: 2 });
    const updatedSkills = planner._buildSkillContext(planner.plan.levels[5], 5);
    const selectedCrafting = updatedSkills.find((entry) => entry.slug === 'crafting');
    expect(selectedCrafting.selected).toBe(true);
    expect(selectedCrafting.nextRankName).toBe('expert');
  });

  it('shows same-level heritage skill upgrades in the skill increase picker', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.skills.athletics.rank = 1;
    actor.items = [
      {
        type: 'heritage',
        slug: 'skilled-human',
        flags: {
          pf2e: {
            rulesSelections: {
              skill: 'athletics',
            },
          },
        },
        system: {
          rules: [
            {
              key: 'ActiveEffectLike',
              path: 'system.skills.{item|flags.pf2e.rulesSelections.skill}.rank',
              value: 2,
              predicate: ['self:level:5'],
            },
          ],
        },
      },
    ];

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    const skills = planner._buildSkillContext(planner.plan.levels[5], 5);
    expect(skills.find((entry) => entry.slug === 'athletics')).toBeUndefined();
  });

  it('shows same-level planned feat skill upgrades in the skill increase picker', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.skills.acrobatics.rank = 1;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.levels[2].classFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      name: 'Acrobat Dedication',
      slug: 'acrobat-dedication',
      skillRules: [
        { skill: 'acrobatics', value: 'ternary(gte(@actor.level,15),4,ternary(gte(@actor.level,7),3,2))' },
      ],
      skillRulesResolved: true,
    }];

    const skills = planner._buildSkillContext(planner.plan.levels[2], 2);
    expect(skills.find((entry) => entry.slug === 'acrobatics')).toEqual(expect.objectContaining({
      rank: 2,
      rankName: 'expert',
      featGranted: true,
      featSourceName: 'Acrobat Dedication',
      lockedByFeat: true,
      disabled: false,
      maxed: true,
    }));
  });

  it('keeps skill rules from browsed nested feat choices while building level context', async () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.items = [];
    actor.system.skills.crafting.rank = 0;
    global.fromUuid = jest.fn(async () => ({
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      name: 'Ancestral Paragon',
      system: { rules: [] },
    }));

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 3;
    planner.plan.levels[3].generalFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
      name: 'Ancestral Paragon',
      slug: 'ancestral-paragon',
      choices: {
        ancestralParagon: 'Compendium.pf2e.feats-srd.Item.eye-for-treasure',
      },
      dynamicSkillRules: [
        { skill: 'crafting', value: 1, source: 'choice:ancestralparagon' },
      ],
    }];

    const context = await planner._buildLevelContext(ALCHEMIST, {});
    const crafting = context.availableSkills.find((entry) => entry.slug === 'crafting');

    expect(crafting).toEqual(expect.objectContaining({
      rank: 1,
      nextRankName: 'expert',
      featGranted: true,
      selected: false,
    }));
    expect(planner.plan.levels[3].generalFeats[0].dynamicSkillRules).toEqual([
      { skill: 'crafting', value: 1, source: 'choice:ancestralparagon' },
    ]);
  });

  it('keeps earlier feat-granted skill ranks marked as feat-granted at later levels', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.skills.acrobatics.rank = 1;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.levels[2].classFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      name: 'Acrobat Dedication',
      slug: 'acrobat-dedication',
      skillRules: [
        { skill: 'acrobatics', value: 'ternary(gte(@actor.level,15),4,ternary(gte(@actor.level,7),3,2))' },
      ],
      skillRulesResolved: true,
    }];

    const skills = planner._buildSkillContext(planner.plan.levels[7], 7);
    expect(skills.find((entry) => entry.slug === 'acrobatics')).toEqual(expect.objectContaining({
      rank: 3,
      rankName: 'master',
      featGranted: true,
      featSourceName: 'Acrobat Dedication',
      lockedByFeat: true,
      disabled: false,
      maxed: true,
    }));
  });

  it('does not keep expert-only feat-granted skills locked once a later manual increase is legal', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.skills.medicine.rank = 1;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.levels[4].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
      name: 'Medic Dedication',
      slug: 'medic-dedication',
      skillRules: [
        { skill: 'medicine', value: 2 },
      ],
      skillRulesResolved: true,
    }];

    const skills = planner._buildSkillContext(planner.plan.levels[7], 7);
    expect(skills.find((entry) => entry.slug === 'medicine')).toEqual(expect.objectContaining({
      rank: 2,
      rankName: 'expert',
      featGranted: true,
      featSourceName: 'Medic Dedication',
      lockedByFeat: false,
      disabled: false,
      maxed: false,
      nextRankName: 'master',
    }));
  });

  it('falls back to slug-based feat source names when planned feat names are missing', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.system.skills.athletics.rank = 0;

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.levels[2].generalFeats = [{
      slug: 'battlefield-bravado',
      skillRules: [
        { skill: 'athletics', value: 1 },
      ],
      skillRulesResolved: true,
    }];

    const skills = planner._buildSkillContext(planner.plan.levels[2], 2);
    expect(skills.find((entry) => entry.slug === 'athletics')).toEqual(expect.objectContaining({
      featGranted: true,
      featSourceName: 'Battlefield Bravado',
    }));
  });

  it('includes GM guidance flags in planner skill increase choices', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e-leveler' && key === 'gmContentGuidance') {
            return {
              'skill:arcana': 'recommended',
              'skill:athletics': 'not-recommended',
              'skill:stealth': 'disallowed',
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
    invalidateGuidanceCache();

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    const skills = planner._buildSkillContext(planner.plan.levels[2], 2);

    expect(skills.find((entry) => entry.slug === 'arcana')).toEqual(expect.objectContaining({ isRecommended: true }));
    expect(skills.find((entry) => entry.slug === 'athletics')).toEqual(expect.objectContaining({ isNotRecommended: true }));
    expect(skills.find((entry) => entry.slug === 'stealth')).toEqual(expect.objectContaining({ isDisallowed: true }));
  });

  it('shows existing lore skills in the skill increase picker', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    actor.items = [
      {
        type: 'lore',
        name: 'Underworld Lore',
        slug: 'underworld-lore',
        system: {
          proficient: { value: 1 },
        },
      },
    ];

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');

    const skills = planner._buildSkillContext(planner.plan.levels[3], 3);

    expect(skills.find((entry) => entry.slug === 'underworld-lore')).toEqual(expect.objectContaining({
      label: 'Underworld Lore',
      rank: 1,
      nextRankName: 'expert',
    }));
  });

  it('extracts skill rules through GrantItem chains', async () => {
    const grantedEffect = {
      uuid: 'Compendium.pf2e.feat-effects.Item.acrobat-effect',
      system: {
        rules: [
          {
            key: 'ActiveEffectLike',
            path: 'system.skills.acrobatics.rank',
            value: 2,
          },
        ],
      },
    };
    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      system: {
        rules: [
          {
            key: 'GrantItem',
            uuid: grantedEffect.uuid,
          },
        ],
      },
    };

    const result = await extractFeatSkillRules(feat, async (uuid) => {
      if (uuid === grantedEffect.uuid) return grantedEffect;
      return null;
    });

    expect(result).toEqual([
      { skill: 'acrobatics', value: 2, predicate: null },
    ]);
  });

  it('preserves formula-valued direct feat skill rules', async () => {
    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      system: {
        rules: [
          {
            key: 'ActiveEffectLike',
            path: 'system.skills.acrobatics.rank',
            value: 'ternary(gte(@actor.level,15),4,ternary(gte(@actor.level,7),3,2))',
          },
        ],
      },
    };

    const result = await extractFeatSkillRules(feat, async () => null);

    expect(result).toEqual([
      { skill: 'acrobatics', value: 'ternary(gte(@actor.level,15),4,ternary(gte(@actor.level,7),3,2))', predicate: null },
    ]);
  });

  it('extracts textual trained-or-expert dedication skill rules', async () => {
    global.CONFIG = {
      ...(global.CONFIG ?? {}),
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          intimidation: 'Intimidation',
        },
      },
    };

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.blackjacket-dedication',
      system: {
        description: {
          value: `
            <p>You become trained in Intimidation; if you were already trained, you become an expert instead.</p>
          `,
        },
        rules: [
          {
            key: 'ActiveEffectLike',
            path: 'system.skills.intimidation.rank',
            value: 1,
          },
        ],
      },
    };

    const result = await extractFeatSkillRules(feat, async () => null);

    expect(result).toEqual([
      { skill: 'intimidation', value: 1, valueIfAlreadyTrained: 2, predicate: null },
    ]);
  });

  it('extracts trained-or-expert dedication rules with either-skill wording', async () => {
    global.CONFIG = {
      ...(global.CONFIG ?? {}),
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          deception: 'Deception',
          society: 'Society',
        },
      },
    };

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.dandy-dedication',
      system: {
        description: {
          value: '<p>You become trained in Deception and Society; if you were already trained in either, you become an expert in it instead.</p>',
        },
        rules: [],
      },
    };

    const result = await extractFeatSkillRules(feat, async () => null);

    expect(result).toEqual([
      { skill: 'deception', value: 1, valueIfAlreadyTrained: 2, predicate: null },
      { skill: 'society', value: 1, valueIfAlreadyTrained: 2, predicate: null },
    ]);
  });

  it('extracts plain textual trained skill rules from dedication descriptions', async () => {
    global.CONFIG = {
      ...(global.CONFIG ?? {}),
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
        },
      },
    };

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      system: {
        description: {
          value: `
            <p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [],
      },
    };

    const result = await extractFeatSkillRules(feat, async () => null);

    expect(result).toEqual([
      { skill: 'nature', value: 1, predicate: null },
    ]);
  });

  it('flags older saved feat skill rules for backfill when their version is stale', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.levels[2].archetypeFeats = [{
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      name: 'Acrobat Dedication',
      slug: 'acrobat-dedication',
      skillRules: [
        { skill: 'acrobatics', value: 2 },
      ],
      skillRulesResolved: true,
      skillRulesVersion: 2,
    }];

    planner._migratePlan(planner.plan, 'alchemist');

    expect(planner._needsSkillRulesBackfill).toBe(true);
  });

  it('migrates saved gradual boost buckets into one boost per planner level', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 5;
    setLevelBoosts(planner.plan, 5, ['dex', 'con', 'int', 'cha']);

    planner._migratePlan(planner.plan, 'alchemist');

    expect(planner.plan.levels[2].abilityBoosts).toEqual(['dex']);
    expect(planner.plan.levels[3].abilityBoosts).toEqual(['con']);
    expect(planner.plan.levels[4].abilityBoosts).toEqual(['int']);
    expect(planner.plan.levels[5].abilityBoosts).toEqual(['cha']);

    expect(planner.plan.levels[5].abilityBoosts).toHaveLength(1);
  });

  it('disables attributes already used in the same gradual boost set', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 4;
    setLevelBoosts(planner.plan, 2, ['str']);
    setLevelBoosts(planner.plan, 3, ['dex']);

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const attributes = planner._buildAttributeContext(planner.plan.levels[4], choices);

    expect(attributes.find((entry) => entry.key === 'str')).toEqual(expect.objectContaining({ disabled: true, selected: false }));
    expect(attributes.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({ disabled: true, selected: false }));
    expect(attributes.find((entry) => entry.key === 'con')).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('refuses duplicate gradual boost selections from the same set', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner._savePlanAndRender = jest.fn();
    planner.selectedLevel = 4;
    setLevelBoosts(planner.plan, 2, ['str']);

    planner._handleBoostToggle('str');
    expect(planner.plan.levels[4].abilityBoosts).toEqual([]);

    planner._handleBoostToggle('dex');
    expect(planner.plan.levels[4].abilityBoosts).toEqual(['dex']);
  });

  it('allows the next gradual boost set to reuse attributes from the previous set', () => {
    const actor = createMockActor();
    actor.class.slug = 'alchemist';
    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 7;
    setLevelBoosts(planner.plan, 2, ['dex']);
    setLevelBoosts(planner.plan, 3, ['con']);
    setLevelBoosts(planner.plan, 4, ['int']);
    setLevelBoosts(planner.plan, 5, ['wis']);

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const attributes = planner._buildAttributeContext(planner.plan.levels[7], choices);

    expect(attributes.find((entry) => entry.key === 'dex')).toEqual(expect.objectContaining({ disabled: false }));
    expect(attributes.find((entry) => entry.key === 'con')).toEqual(expect.objectContaining({ disabled: false }));
    expect(attributes.find((entry) => entry.key === 'int')).toEqual(expect.objectContaining({ disabled: false }));
    expect(attributes.find((entry) => entry.key === 'wis')).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('reconstructs already-applied gradual boost display from actor boost history', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: ['dex'],
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 1: 4, 5: 1, 10: 0, 15: 0, 20: 0 },
            flaws: { ancestry: [] },
          },
        },
        abilities: {
          str: { mod: 0 },
          dex: { mod: 3 },
          con: { mod: 1 },
          int: { mod: 0 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 2;
    setLevelBoosts(planner.plan, 2, ['dex']);

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const attributes = planner._buildAttributeContext(planner.plan.levels[2], choices);
    const dex = attributes.find((entry) => entry.key === 'dex');

    expect(dex).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 2,
      newMod: 3,
      disabled: false,
    }));
  });

  it('allows reselecting an already-applied gradual boost after clearing the plan row', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: ['dex'],
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 1: 4, 5: 1, 10: 0, 15: 0, 20: 0 },
            flaws: { ancestry: [] },
          },
        },
        abilities: {
          str: { mod: 0 },
          dex: { mod: 3 },
          con: { mod: 1 },
          int: { mod: 0 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 2;

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const attributes = planner._buildAttributeContext(planner.plan.levels[2], choices);
    const dex = attributes.find((entry) => entry.key === 'dex');

    expect(dex).toEqual(expect.objectContaining({
      selected: false,
      mod: 2,
      disabled: false,
    }));
  });

  it('reconstructs gradual boost history when actor boost storage uses direct ability keys', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: { wisdom: true },
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 1: 4, 5: 1, 10: 0, 15: 0, 20: 0 },
            flaws: { ancestry: [] },
          },
        },
        abilities: {
          str: { mod: 0 },
          dex: { mod: 1 },
          con: { mod: 1 },
          int: { mod: 4 },
          wis: { mod: 3 },
          cha: { mod: 1 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 2;
    setLevelBoosts(planner.plan, 2, ['wis']);

    const choices = [{ type: 'abilityBoosts', count: 1 }];
    const attributes = planner._buildAttributeContext(planner.plan.levels[2], choices);
    const wisdom = attributes.find((entry) => entry.key === 'wis');

    expect(wisdom).toEqual(expect.objectContaining({
      selected: true,
      applied: true,
      mod: 2,
      newMod: 3,
      disabled: false,
    }));
  });

  it('does not backfill cleared gradual boosts from actor history on reopen', () => {
    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
          xp: { value: 0, max: 1000 },
        },
        build: {
          attributes: {
            boosts: {
              1: [],
              5: ['dex'],
              10: [],
              15: [],
              20: [],
            },
            allowedBoosts: { 1: 4, 5: 1, 10: 0, 15: 0, 20: 0 },
            flaws: { ancestry: [] },
          },
        },
        abilities: {
          str: { mod: 0 },
          dex: { mod: 3 },
          con: { mod: 1 },
          int: { mod: 0 },
          wis: { mod: 0 },
          cha: { mod: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';

    global.game = {
      ...global.game,
      settings: {
        get: jest.fn((scope, key) => {
          if (scope === 'pf2e' && key === 'gradualBoostsVariant') return true;
          if (scope === 'pf2e' && key === 'freeArchetypeVariant') return false;
          if (scope === 'pf2e' && key === 'automaticBonusVariant') return 'noABP';
          if (scope === 'pf2e' && key === 'mythic') return 'disabled';
          if (scope === 'pf2e' && key === 'dualClassVariant') return false;
          if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
          return false;
        }),
      },
    };

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { gradualBoosts: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].abilityBoosts = [];

    const changed = planner._backfillMissingBoostsFromActor(planner.plan, planner._getVariantOptions());

    expect(changed).toBe(false);
    expect(planner.plan.levels[2].abilityBoosts).toEqual([]);
  });
});
