import { evaluatePredicate } from '../../../scripts/utils/predicate.js';

describe('evaluatePredicate', () => {
  afterEach(() => {
    delete global.game.sf2e;
  });

  test('uses SF2e Predicate when running in an SF2e world', () => {
    game.system.id = 'sf2e';
    const test = jest.fn(() => false);
    global.game.sf2e = {
      Predicate: {
        test,
      },
    };

    expect(evaluatePredicate(['item:trait:tech'], 3, ['item:trait:magic'])).toBe(false);
    expect(test).toHaveBeenCalledWith(['item:trait:tech'], new Set(['item:trait:magic', 'self:level:3']));
  });
});
