import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import {
  createPlan,
  getLevelData,
  setLevelFeat,
  clearLevelFeat,
  setLevelBoosts,
  setLevelSkillIncrease,
  toggleLevelIntBonusSkill,
  toggleLevelIntBonusLanguage,
  getAllPlannedFeats,
  getAllPlannedSkillIncreases,
  getAllPlannedBoosts,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
});

describe('createPlan', () => {
  test('creates plan with correct class slug', () => {
    const plan = createPlan('alchemist');
    expect(plan.classSlug).toBe('alchemist');
    expect(plan.version).toBe(1);
  });

  test('throws for unknown class', () => {
    expect(() => createPlan('unknown')).toThrow('Unknown class');
  });

  test('does not include level 1 (character creation)', () => {
    const plan = createPlan('alchemist');
    expect(plan.levels[1]).toBeUndefined();
  });

  test('level 2 has class feat and skill feat slots', () => {
    const plan = createPlan('alchemist');
    expect(plan.levels[2].classFeats).toEqual([]);
    expect(plan.levels[2].skillFeats).toEqual([]);
  });

  test('level 3 has general feat and skill increase', () => {
    const plan = createPlan('alchemist');
    expect(plan.levels[3].generalFeats).toEqual([]);
    expect(plan.levels[3].skillIncreases).toEqual([]);
  });

  test('level 5 has boosts, ancestry feat, skill increase', () => {
    const plan = createPlan('alchemist');
    expect(plan.levels[5].abilityBoosts).toEqual([]);
    expect(plan.levels[5].intBonusSkills).toEqual([]);
    expect(plan.levels[5].intBonusLanguages).toEqual([]);
    expect(plan.levels[5].ancestryFeats).toEqual([]);
    expect(plan.levels[5].skillIncreases).toEqual([]);
  });

  test('includes archetype feat slots when freeArchetype enabled', () => {
    const plan = createPlan('alchemist', { freeArchetype: true });
    expect(plan.levels[2].archetypeFeats).toEqual([]);
  });
});

describe('getLevelData', () => {
  test('returns level data for existing level', () => {
    const plan = createPlan('alchemist');
    expect(getLevelData(plan, 2)).toBeDefined();
  });

  test('returns null for level 1 (not planned)', () => {
    const plan = createPlan('alchemist');
    expect(getLevelData(plan, 1)).toBeNull();
  });

  test('returns null for level beyond max', () => {
    const plan = createPlan('alchemist');
    expect(getLevelData(plan, 21)).toBeNull();
  });
});

describe('setLevelFeat', () => {
  test('sets a class feat', () => {
    const plan = createPlan('alchemist');
    const feat = { uuid: 'test-uuid', name: 'Test Feat', slug: 'test-feat' };
    setLevelFeat(plan, 2, 'classFeats', feat);
    expect(plan.levels[2].classFeats).toEqual([feat]);
  });
});

describe('clearLevelFeat', () => {
  test('clears a feat slot', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'x', name: 'X', slug: 'x' });
    clearLevelFeat(plan, 2, 'classFeats');
    expect(plan.levels[2].classFeats).toEqual([]);
  });
});

describe('setLevelBoosts', () => {
  test('sets ability boosts', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'wis']);
    expect(plan.levels[5].abilityBoosts).toEqual(['str', 'dex', 'con', 'wis']);
  });
});

describe('setLevelSkillIncrease', () => {
  test('sets skill increase', () => {
    const plan = createPlan('alchemist');
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    expect(plan.levels[3].skillIncreases).toEqual([{ skill: 'athletics', toRank: 2 }]);
  });
});

describe('Intelligence bonus selections', () => {
  test('toggles Intelligence bonus skill', () => {
    const plan = createPlan('alchemist');
    toggleLevelIntBonusSkill(plan, 5, 'arcana');
    expect(plan.levels[5].intBonusSkills).toEqual(['arcana']);
    toggleLevelIntBonusSkill(plan, 5, 'arcana');
    expect(plan.levels[5].intBonusSkills).toEqual([]);
  });

  test('toggles Intelligence bonus language', () => {
    const plan = createPlan('alchemist');
    toggleLevelIntBonusLanguage(plan, 5, 'draconic');
    expect(plan.levels[5].intBonusLanguages).toEqual(['draconic']);
    toggleLevelIntBonusLanguage(plan, 5, 'draconic');
    expect(plan.levels[5].intBonusLanguages).toEqual([]);
  });
});

describe('getAllPlannedFeats', () => {
  test('collects feats from all levels', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'a', name: 'A', slug: 'a' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'b', name: 'B', slug: 'b' });
    expect(getAllPlannedFeats(plan)).toHaveLength(2);
  });

  test('respects upToLevel', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'a', name: 'A', slug: 'a' });
    setLevelFeat(plan, 3, 'generalFeats', { uuid: 'b', name: 'B', slug: 'b' });
    expect(getAllPlannedFeats(plan, 2)).toHaveLength(1);
  });
});

describe('getAllPlannedSkillIncreases', () => {
  test('collects skill increases', () => {
    const plan = createPlan('alchemist');
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    setLevelSkillIncrease(plan, 5, { skill: 'stealth', toRank: 2 });
    expect(getAllPlannedSkillIncreases(plan)).toHaveLength(2);
  });
});

describe('getAllPlannedBoosts', () => {
  test('collects boosts by level', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'wis']);
    setLevelBoosts(plan, 10, ['str', 'int', 'wis', 'cha']);
    const boosts = getAllPlannedBoosts(plan);
    expect(boosts[5]).toEqual(['str', 'dex', 'con', 'wis']);
    expect(boosts[10]).toEqual(['str', 'int', 'wis', 'cha']);
  });
});
