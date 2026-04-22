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
import { PLAYER_DISALLOWED_CONTENT_MODES } from '../../scripts/access/content-guidance.js';

describe('registerSettings', () => {
  beforeEach(() => {
    game.settings.register.mockClear();
    invalidateCache.mockClear();
    invalidateItemCache.mockClear();
    clearSpellPickerCache.mockClear();
    invalidateCharacterWizardCompendiumCaches.mockClear();
    ui.windows = {};
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

  test('playerDisallowedContentMode registers world setting with choices and cache invalidation', () => {
    registerSettings();

    const modeRegistration = game.settings.register.mock.calls.find(
      ([moduleId, key]) => moduleId === 'pf2e-leveler' && key === 'playerDisallowedContentMode',
    );

    expect(modeRegistration).toBeTruthy();
    const options = modeRegistration[2];
    expect(options.scope).toBe('world');
    expect(options.config).toBe(true);
    expect(options.default).toBe(PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE);
    expect(options.choices).toEqual({
      [PLAYER_DISALLOWED_CONTENT_MODES.HIDDEN]: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.PLAYER_DISALLOWED_MODE.HIDDEN',
      [PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE]: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.PLAYER_DISALLOWED_MODE.UNSELECTABLE',
    });

    options.onChange();

    expect(invalidateCache).toHaveBeenCalled();
    expect(invalidateItemCache).toHaveBeenCalled();
    expect(clearSpellPickerCache).toHaveBeenCalled();
    expect(invalidateCharacterWizardCompendiumCaches).toHaveBeenCalled();
  });

  test('guidance setting changes rerender open leveler windows', () => {
    const wizardRender = jest.fn();
    const featRender = jest.fn();
    const unrelatedRender = jest.fn();
    ui.windows = {
      1: { options: { id: 'pf2e-leveler-wizard' }, render: wizardRender },
      2: { options: { id: 'pf2e-leveler-feat-picker' }, render: featRender },
      3: { options: { id: 'other-app' }, render: unrelatedRender },
    };

    registerSettings();

    const guidanceRegistration = game.settings.register.mock.calls.find(
      ([moduleId, key]) => moduleId === 'pf2e-leveler' && key === 'gmContentGuidance',
    );
    const modeRegistration = game.settings.register.mock.calls.find(
      ([moduleId, key]) => moduleId === 'pf2e-leveler' && key === 'playerDisallowedContentMode',
    );

    guidanceRegistration[2].onChange();
    modeRegistration[2].onChange();

    expect(wizardRender).toHaveBeenCalledWith(false);
    expect(featRender).toHaveBeenCalledWith(false);
    expect(unrelatedRender).not.toHaveBeenCalled();
  });
});
