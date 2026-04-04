import { applySkillIncreases } from '../../../scripts/apply/apply-skills.js';

describe('applySkillIncreases', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      update: jest.fn(() => Promise.resolve()),
    };
  });

  test('applies single skill increase', async () => {
    const plan = {
      levels: { 3: { skillIncreases: [{ skill: 'athletics', toRank: 2 }] } },
    };
    const result = await applySkillIncreases(mockActor, plan, 3);
    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.athletics.rank': 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].skill).toBe('athletics');
  });

  test('returns empty for level without skill increases', async () => {
    const plan = { levels: { 2: { classFeats: [] } } };
    const result = await applySkillIncreases(mockActor, plan, 2);
    expect(mockActor.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('returns empty for nonexistent level', async () => {
    const plan = { levels: {} };
    const result = await applySkillIncreases(mockActor, plan, 5);
    expect(result).toEqual([]);
  });

  test('applies Intelligence bonus trained skills', async () => {
    mockActor.system = { skills: { arcana: { rank: 0 } } };
    const plan = {
      levels: { 5: { intBonusSkills: ['arcana'] } },
    };
    const result = await applySkillIncreases(mockActor, plan, 5);
    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.arcana.rank': 1,
    });
    expect(result).toEqual([{ skill: 'arcana', toRank: 1, intBonus: true }]);
  });
});
