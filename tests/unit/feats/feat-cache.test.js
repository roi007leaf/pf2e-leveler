import { getCachedFeats, invalidateCache, loadFeats } from '../../../scripts/feats/feat-cache.js';

describe('feat cache', () => {
  beforeEach(() => {
    invalidateCache();
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['my-module.feats'],
        },
      },
    };

    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.feats-srd') {
        return {
          getDocuments: jest.fn(async () => [
            { uuid: 'Compendium.pf2e.feats-srd.Item.A', type: 'feat', system: { category: 'class' } },
          ]),
        };
      }

      if (key === 'my-module.feats') {
        return {
          getDocuments: jest.fn(async () => [
            { uuid: 'Compendium.my-module.feats.Item.B', type: 'feat', system: { category: 'general' } },
          ]),
        };
      }

      return null;
    });
  });

  test('loads feats from default and configured feat compendiums', async () => {
    const feats = await loadFeats();

    expect(feats.map((feat) => feat.uuid)).toEqual([
      'Compendium.pf2e.feats-srd.Item.A',
      'Compendium.my-module.feats.Item.B',
    ]);
    expect(getCachedFeats()).toHaveLength(2);
  });
});
