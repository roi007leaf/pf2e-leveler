import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { createPlan, setLevelBoosts, setLevelSkillIncrease } from '../../../scripts/plan/plan-model.js';

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
      expect.objectContaining({ slug: 'draconic', label: 'Draconic', selected: false }),
      expect.objectContaining({ slug: 'elven', label: 'Elven', selected: false }),
    ]);
  });

  it('marks imported past boosts as applied instead of previewing a new increase', () => {
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
      mod: 4,
      newMod: 4,
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
});
