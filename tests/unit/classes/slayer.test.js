import { SLAYER } from '../../../scripts/classes/slayer.js';

describe('SLAYER', () => {
  test('has the expected core progression', () => {
    expect(SLAYER.slug).toBe('slayer');
    expect(SLAYER.keyAbility).toEqual(['str', 'dex']);
    expect(SLAYER.hp).toBe(10);
    expect(SLAYER.featSchedule.class).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(SLAYER.skillIncreaseSchedule).toEqual([3, 5, 7, 9, 11, 13, 15, 17, 19]);
    expect(SLAYER.abilityBoostSchedule).toEqual([5, 10, 15, 20]);
  });
});
