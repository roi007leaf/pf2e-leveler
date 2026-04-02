import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Alchemist class definition', () => {
  test('has correct basic properties', () => {
    expect(ALCHEMIST.slug).toBe('alchemist');
    expect(ALCHEMIST.keyAbility).toEqual(['int']);
    expect(ALCHEMIST.hp).toBe(8);
  });

  test('class feats start at level 2', () => {
    expect(ALCHEMIST.featSchedule.class[0]).toBe(2);
  });

  test('ability boosts exclude level 1', () => {
    expect(ALCHEMIST.abilityBoostSchedule).toEqual([5, 10, 15, 20]);
  });

  test('no spellcasting', () => {
    expect(ALCHEMIST.spellcasting).toBeNull();
  });

  test('level 2 choices include class feat and skill feat', () => {
    const types = getChoicesForLevel(ALCHEMIST, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('skillFeat');
  });

  test('level 5 choices include boosts, ancestry feat, skill increase', () => {
    const types = getChoicesForLevel(ALCHEMIST, 5).map((c) => c.type);
    expect(types).toContain('abilityBoosts');
    expect(types).toContain('ancestryFeat');
    expect(types).toContain('skillIncrease');
  });

  test('class features start at level 5', () => {
    expect(ALCHEMIST.classFeatures[0].level).toBe(5);
  });
});
