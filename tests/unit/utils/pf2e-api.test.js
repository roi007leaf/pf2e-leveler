import {
  getCampaignFeatSectionIds,
  isDualClassEnabled,
  isFreeArchetypeEnabled,
} from '../../../scripts/utils/pf2e-api.js';

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

describe('system-aware PF2e API helpers', () => {
  beforeEach(() => {
    global._testSettings = {};
    game.system.id = 'sf2e';
  });

  test('reads variant settings from SF2e when running in SF2e worlds', () => {
    global._testSettings = {
      sf2e: { freeArchetypeVariant: true },
    };

    expect(isFreeArchetypeEnabled()).toBe(true);
  });

  test('reads campaign feat sections from SF2e when running in SF2e worlds', () => {
    global._testSettings = {
      sf2e: {
        campaignFeatSections: [
          { id: 'starfinder-training' },
          { id: '' },
          { id: 'faction' },
        ],
      },
    };

    expect(getCampaignFeatSectionIds()).toEqual(['starfinder-training', 'faction']);
  });
});
