import { ContentGuidanceMenu } from '../../../scripts/ui/content-guidance-menu.js';

jest.mock('../../../scripts/access/content-guidance.js', () => ({
  getContentGuidance: jest.fn(() => ({})),
  invalidateGuidanceCache: jest.fn(),
  getSourceGuidanceKey: jest.fn((title) => `source-title:${String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')}`),
}));

describe('ContentGuidanceMenu sources tab', () => {
  test('builds unique source rows with matched item counts', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu._draft = {};
    menu._itemCache.sources = [
      { uuid: 'source-title:pathfinder player core', name: 'Pathfinder Player Core', matchedCount: 3, categorySummary: 'Ancestries, Feats' },
      { uuid: 'source-title:lost omens divine mysteries', name: 'Lost Omens Divine Mysteries', matchedCount: 1, categorySummary: 'Spells' },
    ];

    const context = await menu._prepareContext();

    expect(context.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        uuid: 'source-title:pathfinder player core',
        name: 'Pathfinder Player Core',
        matchedCount: 3,
      }),
      expect.objectContaining({
        uuid: 'source-title:lost omens divine mysteries',
        matchedCount: 1,
      }),
    ]));
  });

  test('filters sources tab by source title', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu.searchText = 'player core';
    menu._draft = {};
    menu._itemCache.sources = [
      { uuid: 'source-title:pathfinder player core', name: 'Pathfinder Player Core', matchedCount: 3 },
      { uuid: 'source-title:lost omens divine mysteries', name: 'Lost Omens Divine Mysteries', matchedCount: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.items.map((entry) => entry.uuid)).toEqual(['source-title:pathfinder player core']);
  });

  test('existing item tabs expose inherited source guidance status', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {
      'source-title:pathfinder player core': 'disallowed',
    };
    menu._itemCache.backgrounds = [
      {
        uuid: 'bg-common',
        name: 'Scholar',
        rarity: 'common',
        level: 1,
        publicationTitle: 'Pathfinder Player Core',
      },
    ];

    const context = await menu._prepareContext();

    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'bg-common',
        isDisallowed: true,
        isRecommended: false,
        isNotRecommended: false,
        guidanceInherited: true,
      }),
    ]);
  });
});
