import { getUnavailableLanguageSlugs } from '../../../scripts/ui/character-wizard/skills-languages.js';
import { getAvailableLanguages } from '../../../scripts/ui/level-planner/context.js';

describe('unavailable language filtering', () => {
  let originalConfig;
  let originalCampaign;

  beforeEach(() => {
    originalConfig = global.CONFIG;
    originalCampaign = global.game.pf2e.settings.campaign;
    global.CONFIG = {
      PF2E: {
        languages: { common: 'Common', draconic: 'Draconic', elven: 'Elven' },
      },
    };
    global.game.pf2e.settings.campaign = {
      languages: {
        common: new Set(['common', 'elven']),
        uncommon: new Set(['draconic']),
        rare: new Set(),
        secret: new Set(),
        unavailable: new Set(['draconic']),
      },
    };
  });

  afterEach(() => {
    global.CONFIG = originalConfig;
    global.game.pf2e.settings.campaign = originalCampaign;
  });

  it('reads the unavailable set from campaign language settings', () => {
    expect([...getUnavailableLanguageSlugs()].sort()).toEqual(['draconic']);
  });

  it('returns an empty set when no campaign language settings exist', () => {
    global.game.pf2e.settings.campaign = undefined;
    expect(getUnavailableLanguageSlugs().size).toBe(0);
  });

  it('excludes unavailable languages from the planner language list', () => {
    const slugs = getAvailableLanguages().map((entry) => entry.slug);
    expect(slugs).toContain('common');
    expect(slugs).toContain('elven');
    expect(slugs).not.toContain('draconic');
  });

  it('keeps a language once it is no longer marked unavailable', () => {
    global.game.pf2e.settings.campaign.languages.unavailable = new Set();
    expect(getAvailableLanguages().map((entry) => entry.slug)).toContain('draconic');
  });
});
