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

  test('filters sources tab in the rendered DOM by source title', () => {
    document.body.innerHTML = `
      <div class="compendium-manager__panelWrap" style="overflow:auto">
        <input type="text" data-action="search-guidance" value="">
        <div class="guidance-item"><span class="guidance-item__name">Pathfinder Player Core</span></div>
        <div class="guidance-item"><span class="guidance-item__name">Lost Omens Divine Mysteries</span></div>
      </div>
    `;

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu.searchText = 'player core';
    menu._draft = {};
    menu.element = document.body;
    menu.render = jest.fn();

    menu._onRender();

    const items = [...document.querySelectorAll('.guidance-item')];
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
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
