import { isDualClassEnabled } from '../../../scripts/utils/pf2e-api.js';

describe('isDualClassEnabled', () => {
  beforeEach(() => {
    global._testSettings = {};
  });

  test('uses only the Leveler dual class support setting', () => {
    global._testSettings = {
      pf2e: { dualClassVariant: false },
      'pf2e-leveler': { enableDualClassSupport: true },
    };

    expect(isDualClassEnabled()).toBe(true);
  });

  test('returns false when Leveler dual class support is disabled', () => {
    global._testSettings = {
      'pf2e-leveler': { enableDualClassSupport: false },
    };

    expect(isDualClassEnabled()).toBe(false);
  });
});
