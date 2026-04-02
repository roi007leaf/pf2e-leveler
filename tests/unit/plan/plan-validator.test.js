import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { PLAN_STATUS } from '../../../scripts/constants.js';
import { validatePlan, validateLevel } from '../../../scripts/plan/plan-validator.js';
import {
  createPlan,
  setLevelBoosts,
  setLevelFeat,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
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
    expect(result.issues.some((i) => i.message.includes('boost points'))).toBe(true);
  });

  test('duplicate boosts is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'str', 'dex', 'con']);
    const result = validateLevel(plan, ALCHEMIST, 5);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('Duplicate'))).toBe(true);
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
