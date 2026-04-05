import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { PLAN_STATUS } from '../../../scripts/constants.js';
import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { validatePlan, validateLevel } from '../../../scripts/plan/plan-validator.js';
import * as buildState from '../../../scripts/plan/build-state.js';
import {
  createPlan,
  addLevelSpell,
  setLevelBoosts,
  setLevelFeat,
  setLevelSkillIncrease,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
  ClassRegistry.register(SORCERER);
});

describe('validateLevel', () => {
  test('empty plan level 2 is incomplete', () => {
    const plan = createPlan('alchemist');
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
  });

  test('level beyond 20 returns empty', () => {
    const plan = createPlan('alchemist');
    const result = validateLevel(plan, ALCHEMIST, 21);
    expect(result.status).toBe(PLAN_STATUS.EMPTY);
  });

  test('complete level 2 passes validation', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'x', name: 'X', slug: 'x' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('missing class feat at level 2 is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('Class Feat'))).toBe(true);
  });

  test('wrong number of boosts is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'dex']);
    const result = validateLevel(plan, ALCHEMIST, 5);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('boosts'))).toBe(true);
  });

  test('duplicate boosts is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'str', 'dex', 'con']);
    const result = validateLevel(plan, ALCHEMIST, 5);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('Duplicate'))).toBe(true);
  });

  test('duplicate gradual boosts across the same set is incomplete', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 2, ['str']);
    setLevelBoosts(plan, 3, ['dex']);
    setLevelBoosts(plan, 4, ['str']);
    const result = validateLevel(plan, ALCHEMIST, 4, { gradualBoosts: true });
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('gradual ability boost set'))).toBe(true);
  });

  test('gradual boosts reset when a new four-level set begins', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 2, ['dex']);
    setLevelBoosts(plan, 3, ['con']);
    setLevelBoosts(plan, 4, ['int']);
    setLevelBoosts(plan, 5, ['wis']);
    setLevelBoosts(plan, 7, ['int']);
    plan.levels[7].intBonusSkills = ['arcana'];
    plan.levels[7].intBonusLanguages = ['draconic'];
    setLevelFeat(plan, 7, 'generalFeats', { uuid: 'g', name: 'G', slug: 'g' });
    setLevelSkillIncrease(plan, 7, { skill: 'crafting', toRank: 2 });

    const result = validateLevel(plan, ALCHEMIST, 7, { gradualBoosts: true });

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
    expect(result.issues.some((i) => i.message.includes('gradual ability boost set'))).toBe(false);
  });

  test('spontaneous granted subclass spells count toward level completion', () => {
    const actor = {
      items: [
        {
          type: 'feat',
          slug: 'bloodline-genie',
          flags: { pf2e: { rulesSelections: { genie: 'ifrit' } } },
          system: { traits: { otherTags: ['sorcerer-bloodline'] } },
        },
      ],
    };
    const plan = createPlan('sorcerer');
    setLevelFeat(plan, 3, 'generalFeats', { uuid: 'general-1', name: 'Keen Follower', slug: 'keen-follower' });
    setLevelSkillIncrease(plan, 3, { skill: 'arcana', toRank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-1', name: 'Acid Arrow', rank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-2', name: 'Acidic Burst', rank: 2 });

    const result = validateLevel(plan, SORCERER, 3, {}, actor);

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('intelligence bonus selections validate correctly when INT increases from +4 to +5', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 9, ['int']);
    plan.levels[9].intBonusSkills = ['diplomacy'];
    plan.levels[9].intBonusLanguages = ['aklo'];
    setLevelFeat(plan, 9, 'ancestryFeats', { uuid: 'a', name: 'A', slug: 'a' });
    setLevelSkillIncrease(plan, 9, { skill: 'crafting', toRank: 1 });

    jest.spyOn(buildState, 'computeBuildState')
      .mockImplementation((_actor, _plan, atLevel) => ({
        attributes: { int: atLevel >= 9 ? 5 : 4 },
      }));

    const result = validateLevel(plan, ALCHEMIST, 9, { gradualBoosts: true }, {});

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });
});

describe('validatePlan', () => {
  test('empty plan is invalid', () => {
    const plan = createPlan('alchemist');
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
  });

  test('returns per-level results starting from level 2', () => {
    const plan = createPlan('alchemist');
    const result = validatePlan(plan);
    expect(result.levelResults[1]).toBeUndefined();
    expect(result.levelResults[2]).toBeDefined();
    expect(result.levelResults[21]).toBeUndefined();
  });
});
