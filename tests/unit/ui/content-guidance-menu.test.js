import { ContentGuidanceMenu } from '../../../scripts/ui/content-guidance-menu.js';

jest.mock('../../../scripts/access/content-guidance.js', () => ({
  getContentGuidance: jest.fn(() => ({})),
  invalidateGuidanceCache: jest.fn(),
}));

describe('ContentGuidanceMenu', () => {
  test('groups heritages by ancestry and exposes not-recommended status', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'heritages';
    menu._draft = {
      'heritage-elf': 'not-recommended',
      'heritage-versatile': 'recommended',
    };
    menu._itemCache.heritages = [
      { uuid: 'heritage-elf', name: 'Ancient Elf', ancestrySlug: 'elf', ancestryLabel: 'Elf', rarity: 'common', level: null },
      { uuid: 'heritage-dwarf', name: 'Death Warden Dwarf', ancestrySlug: 'dwarf', ancestryLabel: 'Dwarf', rarity: 'common', level: null },
      { uuid: 'heritage-versatile', name: 'Aiuvarin', ancestrySlug: null, ancestryLabel: null, rarity: 'common', level: null },
    ];

    const context = await menu._prepareContext();

    expect(context.useGridLayout).toBe(false);
    expect(context.groupedItems.map((entry) => entry.label)).toEqual(['Dwarf', 'Elf', 'PF2E_LEVELER.CREATION.HERITAGE_GROUP_VERSATILE']);
    expect(context.groupedItems.find((entry) => entry.label === 'Elf')).toEqual(expect.objectContaining({
      bulkScopeType: 'ancestry',
      bulkScopeValue: 'elf',
    }));
    expect(context.items.find((entry) => entry.uuid === 'heritage-elf')).toEqual(expect.objectContaining({
      isNotRecommended: true,
      isRecommended: false,
      isDisallowed: false,
    }));
  });

  test('exposes rarity bulk groups for rarity-bearing categories', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.useGridLayout).toBe(true);
    expect(context.rarityBulkGroups).toEqual([
      expect.objectContaining({ scopeType: 'rarity', scopeValue: 'common' }),
      expect.objectContaining({ scopeType: 'rarity', scopeValue: 'rare' }),
    ]);
  });

  test('search filtering does not hide rarity bulk groups for the active category', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu.searchText = 'scholar';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.items.map((entry) => entry.uuid)).toEqual(['bg-common']);
    expect(context.rarityBulkGroups).toEqual([
      expect.objectContaining({ scopeValue: 'common' }),
      expect.objectContaining({ scopeValue: 'rare' }),
    ]);
  });

  test('bulk guidance applies to matching rarity within the active category', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    menu._applyBulkGuidance('rarity', 'rare', 'not-recommended');

    expect(menu._draft).toEqual({ 'bg-rare': 'not-recommended' });
  });

  test('clear tab only removes guidance entries from the active category', () => {
    document.body.innerHTML = '<button type="button" data-action="clear-all-guidance"></button>';

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'heritages';
    menu._draft = {
      'heritage-elf': 'recommended',
      'background-a': 'disallowed',
    };
    menu._itemCache.heritages = [{ uuid: 'heritage-elf', name: 'Ancient Elf' }];
    menu._itemCache.backgrounds = [{ uuid: 'background-a', name: 'Scholar' }];
    menu.element = document.body;
    menu.render = jest.fn();

    menu._onRender();
    document.querySelector('[data-action="clear-all-guidance"]').click();

    expect(menu._draft).toEqual({ 'background-a': 'disallowed' });
  });

  test('view item opens compendium-backed guidance entries', async () => {
    document.body.innerHTML = '<button type="button" data-action="viewGuidanceItem" data-uuid="Compendium.test.items.Item.abc"></button>';

    const render = jest.fn();
    global.fromUuid = jest.fn(async () => ({ sheet: { render } }));

    const menu = new ContentGuidanceMenu();
    menu.element = document.body;

    menu._onRender();
    document.querySelector('[data-action="viewGuidanceItem"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(global.fromUuid).toHaveBeenCalledWith('Compendium.test.items.Item.abc');
    expect(render).toHaveBeenCalledWith(true);
  });

  test('changing guidance preserves the current list scroll position', () => {
    document.body.innerHTML = `
      <div class="compendium-manager__panelWrap" style="overflow:auto">
        <button type="button" data-action="cycle-guidance" data-uuid="heritage-elf"></button>
      </div>
    `;

    const menu = new ContentGuidanceMenu();
    menu._draft = {};
    menu.element = document.body;
    menu.render = jest.fn();

    const panel = document.querySelector('.compendium-manager__panelWrap');
    panel.scrollTop = 240;

    menu._onRender();
    document.querySelector('[data-action="cycle-guidance"]').click();

    expect(menu._draft).toEqual({ 'heritage-elf': 'recommended' });
    expect(menu._pendingScrollTop).toBe(240);
    expect(menu.render).toHaveBeenCalledWith(true);
  });
});
