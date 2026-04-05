import { getChoicesForLevel } from '../../../scripts/classes/progression.js';
import { ROGUE } from '../../../scripts/classes/rogue.js';

describe('ROGUE progression', () => {
  test('level 3 includes a skill feat slot', () => {
    const types = getChoicesForLevel(ROGUE, 3).map((choice) => choice.type);
    expect(types).toContain('skillFeat');
  });

  test('level 5 includes a skill feat slot alongside other rogue choices', () => {
    const types = getChoicesForLevel(ROGUE, 5).map((choice) => choice.type);
    expect(types).toContain('skillFeat');
    expect(types).toContain('ancestryFeat');
    expect(types).toContain('skillIncrease');
  });
});
