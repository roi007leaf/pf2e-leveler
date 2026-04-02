import { COMMANDER } from '../../../scripts/classes/commander.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Commander class definition', () => {
  test('has correct basic properties', () => {
    expect(COMMANDER.slug).toBe('commander');
    expect(COMMANDER.keyAbility).toEqual(['int']);
    expect(COMMANDER.hp).toBe(8);
  });

  test('no spellcasting', () => {
    expect(COMMANDER.spellcasting).toBeNull();
  });

  test('level 2 has class feat and skill feat', () => {
    const types = getChoicesForLevel(COMMANDER, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('skillFeat');
    expect(types).not.toContain('spells');
  });

  test('class features start at level 3', () => {
    expect(COMMANDER.classFeatures[0].level).toBe(3);
  });
});
