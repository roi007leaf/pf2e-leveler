import { getCompendiumKeysForCategory } from '../../../scripts/compendiums/catalog.js';
import { loadCompendiumCategory } from '../../../scripts/ui/character-wizard/loaders.js';

describe('player content restrictions', () => {
  afterEach(() => {
    game.user.isGM = true;
  });

  test('restricts compendium sources for non-GM users when player source limits are enabled', () => {
    game.user.isGM = false;
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['custom.allowed', 'custom.blocked'],
        },
        restrictPlayerCompendiumAccess: true,
        playerCompendiumAccess: {
          enabled: true,
          selections: {
            feats: ['pf2e.feats-srd', 'custom.allowed'],
          },
        },
      },
    };

    expect(getCompendiumKeysForCategory('feats')).toEqual([
      'pf2e.feats-srd',
      'custom.allowed',
    ]);
  });

  test('filters unavailable rarities out of character creation loaders for non-GM users', async () => {
    game.user.isGM = false;
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {},
        playerAllowUncommon: false,
        playerAllowRare: false,
        playerAllowUnique: false,
      },
    };

    const wizard = {
      _compendiumCache: {},
      _loadCompendium: jest.fn(async () => [
        { uuid: 'common', name: 'Common Option', rarity: 'common' },
        { uuid: 'uncommon', name: 'Uncommon Option', rarity: 'uncommon' },
        { uuid: 'rare', name: 'Rare Option', rarity: 'rare' },
      ]),
    };

    const items = await loadCompendiumCategory(wizard, 'feats', 'category-feats');

    expect(items).toEqual([
      { uuid: 'common', name: 'Common Option', rarity: 'common' },
    ]);
  });
});
