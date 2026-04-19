import { INVESTIGATOR } from '../../../scripts/classes/investigator.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('INVESTIGATOR progression', () => {
  test('level 3 includes a skill feat slot from Skillful Lessons', () => {
    const types = getChoicesForLevel(INVESTIGATOR, 3).map((choice) => choice.type);
    expect(types).toContain('skillFeat');
  });

  test('level 5 includes a skill feat slot alongside ancestry feat and skill increase', () => {
    const types = getChoicesForLevel(INVESTIGATOR, 5).map((choice) => choice.type);
    expect(types).toContain('skillFeat');
    expect(types).toContain('ancestryFeat');
    expect(types).toContain('skillIncrease');
  });
});
