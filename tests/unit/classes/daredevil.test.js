import { DAREDEVIL } from '../../../scripts/classes/daredevil.js';

describe('DAREDEVIL', () => {
  test('has the expected core progression', () => {
    expect(DAREDEVIL.slug).toBe('daredevil');
    expect(DAREDEVIL.keyAbility).toEqual(['str', 'dex']);
    expect(DAREDEVIL.hp).toBe(8);
    expect(DAREDEVIL.featSchedule.class).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(DAREDEVIL.skillIncreaseSchedule).toEqual([3, 5, 7, 9, 11, 13, 15, 17, 19]);
    expect(DAREDEVIL.abilityBoostSchedule).toEqual([5, 10, 15, 20]);
  });
});
