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

  test('detects class feature packs by PF2E item category instead of pack name', async () => {
    game.packs = new Map([
      ['teamplus.player-options', {
        collection: 'teamplus.player-options',
        metadata: { id: 'teamplus.player-options', label: 'Player Options', type: 'Item', packageName: 'teamplus' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
      ['whispering.subclasses', {
        collection: 'whispering.subclasses',
        metadata: { id: 'whispering.subclasses', label: 'Subclasses', type: 'Item', packageName: 'whispering' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.classFeatures.map((pack) => pack.key)).toEqual(expect.arrayContaining([
      'teamplus.player-options',
      'whispering.subclasses',
    ]));
  });

  test('does not classify pure class-feature packs as feats', async () => {
    game.packs = new Map([
      ['whispering.subclasses', {
        collection: 'whispering.subclasses',
        metadata: { id: 'whispering.subclasses', label: 'Subclasses', type: 'Item', packageName: 'whispering' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
      ['mixed.player-options', {
        collection: 'mixed.player-options',
        metadata: { id: 'mixed.player-options', label: 'Player Options', type: 'Item', packageName: 'mixed' },
        getIndex: jest.fn(async () => [
          { type: 'feat', system: { category: 'classfeature' } },
          { type: 'feat', system: { category: 'general' } },
        ]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.feats.map((pack) => pack.key)).not.toContain('whispering.subclasses');
    expect(discovered.feats.map((pack) => pack.key)).toContain('mixed.player-options');
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
