jest.mock('../../scripts/feats/feat-cache.js', () => ({
  invalidateCache: jest.fn(),
}));

jest.mock('../../scripts/ui/item-picker.js', () => ({
  invalidateItemCache: jest.fn(),
}));

jest.mock('../../scripts/ui/spell-picker.js', () => ({
  clearSpellPickerCache: jest.fn(),
}));

jest.mock('../../scripts/ui/character-wizard/loaders.js', () => ({
  invalidateCharacterWizardCompendiumCaches: jest.fn(),
}));

import { registerSettings } from '../../scripts/settings.js';
import { invalidateCache } from '../../scripts/feats/feat-cache.js';
import { invalidateItemCache } from '../../scripts/ui/item-picker.js';
import { clearSpellPickerCache } from '../../scripts/ui/spell-picker.js';
import { invalidateCharacterWizardCompendiumCaches } from '../../scripts/ui/character-wizard/loaders.js';

describe('registerSettings', () => {
  beforeEach(() => {
    game.settings.register.mockClear();
    invalidateCache.mockClear();
    invalidateItemCache.mockClear();
    clearSpellPickerCache.mockClear();
    invalidateCharacterWizardCompendiumCaches.mockClear();
  });

  test('gmContentGuidance onChange invalidates guidance and picker caches', () => {
    registerSettings();

    const guidanceRegistration = game.settings.register.mock.calls.find(
      ([moduleId, key]) => moduleId === 'pf2e-leveler' && key === 'gmContentGuidance',
    );

    expect(guidanceRegistration).toBeTruthy();
    const options = guidanceRegistration[2];
    options.onChange();

    expect(invalidateCache).toHaveBeenCalled();
    expect(invalidateItemCache).toHaveBeenCalled();
    expect(clearSpellPickerCache).toHaveBeenCalled();
    expect(invalidateCharacterWizardCompendiumCaches).toHaveBeenCalled();
  });
});
