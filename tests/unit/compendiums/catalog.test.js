import {
  discoverCompendiumsByCategory,
  getCompendiumKeysForCategory,
  migrateLegacyFeatCompendiumsSetting,
  normalizeCompendiumSelections,
} from '../../../scripts/compendiums/catalog.js';

describe('compendium catalog helpers', () => {
  test('merges default and configured compendium keys for a category', () => {
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['my-module.extra-feats'],
        },
      },
    };

    expect(getCompendiumKeysForCategory('feats')).toEqual([
      'pf2e.feats-srd',
      'my-module.extra-feats',
    ]);
  });

  test('normalizes malformed settings payloads into per-category arrays', () => {
    const result = normalizeCompendiumSelections({
      feats: ['a', 'a', 'b'],
      ancestries: 'bad-shape',
    });

    expect(result.feats).toEqual(['a', 'b']);
    expect(result.ancestries).toEqual([]);
    expect(result.classes).toEqual([]);
  });

  test('discovers available packs by content category', async () => {
    game.packs = new Map([
      ['pf2e.ancestries', {
        collection: 'pf2e.ancestries',
        metadata: { id: 'pf2e.ancestries', label: 'Ancestries', type: 'Item', packageName: 'pf2e' },
        getIndex: jest.fn(async () => [{ type: 'ancestry' }]),
      }],
      ['my.feats', {
        collection: 'my.feats',
        metadata: { id: 'my.feats', label: 'Custom Feats', type: 'Item', packageName: 'my-module' },
        getIndex: jest.fn(async () => [{ type: 'feat' }]),
      }],
      ['my.deities', {
        collection: 'my.deities',
        metadata: { id: 'my.deities', label: 'Custom Deities', type: 'Item', packageName: 'my-module' },
        getIndex: jest.fn(async () => [{ type: 'deity' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.ancestries.map((pack) => pack.key)).toContain('pf2e.ancestries');
    expect(discovered.feats.map((pack) => pack.key)).toContain('my.feats');
    expect(discovered.deities.map((pack) => pack.key)).toContain('my.deities');
  });

  test('migrates legacy additional feat compendiums into the new category setting', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        additionalFeatCompendiums: 'my-module.feats, my-module.more-feats',
        customCompendiums: {},
      },
    };

    const migrated = await migrateLegacyFeatCompendiumsSetting();

    expect(migrated).toBe(true);
    expect(game.settings.set).toHaveBeenCalledWith('pf2e-leveler', 'customCompendiums', expect.objectContaining({
      feats: ['my-module.feats', 'my-module.more-feats'],
    }));
  });
});
