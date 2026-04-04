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
});
