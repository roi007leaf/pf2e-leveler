import { SWASHBUCKLER } from '../../../scripts/classes/swashbuckler.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Swashbuckler class definition', () => {
  test('has correct basic properties', () => {
    expect(SWASHBUCKLER.slug).toBe('swashbuckler');
    expect(SWASHBUCKLER.keyAbility).toEqual(['dex']);
    expect(SWASHBUCKLER.hp).toBe(10);
  });

  test('class feats start at level 2', () => {
    expect(SWASHBUCKLER.featSchedule.class[0]).toBe(2);
  });

  test('ability boosts exclude level 1', () => {
    expect(SWASHBUCKLER.abilityBoostSchedule).toEqual([5, 10, 15, 20]);
  });

  test('no spellcasting', () => {
    expect(SWASHBUCKLER.spellcasting).toBeNull();
  });

  test('level 2 choices include class feat and skill feat', () => {
    const types = getChoicesForLevel(SWASHBUCKLER, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('skillFeat');
  });

  test('Precise Strike is a level 1 class feature', () => {
    const preciseStrike = SWASHBUCKLER.classFeatures.find((f) => f.key === 'precise-strike');
    expect(preciseStrike).toBeDefined();
    expect(preciseStrike.level).toBe(1);
  });

  test('class features include entries starting at level 1', () => {
    expect(SWASHBUCKLER.classFeatures[0].level).toBe(1);
  });
});
