import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { PROFICIENCY_RANKS } from '../../../scripts/constants.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import {
  createPlan,
  setLevelBoosts,
  setLevelFeat,
  setLevelSkillIncrease,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
});

describe('computeBuildState', () => {
  let mockActor;
  let plan;

  beforeEach(() => {
    mockActor = createMockActor();
    plan = createPlan('alchemist');
  });

  test('returns basic state at level 2', () => {
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.level).toBe(2);
    expect(state.classSlug).toBe('alchemist');
  });

  test('applies ability boosts', () => {
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'int']);
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.attributes.str).toBe(1);
    expect(state.attributes.dex).toBe(1);
    expect(state.attributes.con).toBe(1);
    expect(state.attributes.int).toBe(1);
    expect(state.attributes.wis).toBe(0);
  });

  test('partial boosts at high modifiers', () => {
    mockActor.system.abilities.str.mod = 4;
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'int']);
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.attributes.str).toBe(4);
  });

  test('computes skills from actor current state', () => {
    mockActor.system.skills.crafting.rank = 1;
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.skills.crafting).toBe(PROFICIENCY_RANKS.TRAINED);
  });

  test('applies planned skill increases', () => {
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    const state = computeBuildState(mockActor, plan, 3);
    expect(state.skills.athletics).toBe(2);
  });

  test('skill increases respect upToLevel', () => {
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.skills.athletics).toBe(0);
  });

  test('collects planned feats', () => {
    setLevelFeat(plan, 1, 'classFeats', { uuid: 'x', name: 'X', slug: 'quick-bomber' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'battle-medicine' });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('quick-bomber')).toBe(true);
    expect(state.feats.has('battle-medicine')).toBe(true);
  });

  test('feats respect upToLevel', () => {
    setLevelFeat(plan, 1, 'classFeats', { uuid: 'x', name: 'X', slug: 'quick-bomber' });
    setLevelFeat(plan, 3, 'generalFeats', { uuid: 'y', name: 'Y', slug: 'toughness' });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('quick-bomber')).toBe(true);
    expect(state.feats.has('toughness')).toBe(false);
  });

  test('computes class features for level', () => {
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.classFeatures.has('field-discovery')).toBe(true);
    expect(state.classFeatures.has('powerful-alchemy')).toBe(true);
    expect(state.classFeatures.has('double-brew')).toBe(false);
  });

  test('ancestry and heritage from actor', () => {
    const state = computeBuildState(mockActor, plan, 1);
    expect(state.ancestrySlug).toBe('human');
  });
});
