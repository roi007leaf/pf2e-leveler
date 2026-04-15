import { invalidateItemCache, ItemPicker, loadItems } from '../../../scripts/ui/item-picker.js';

describe('ItemPicker', () => {
  beforeEach(() => {
    invalidateItemCache();
    game.items = [];
    game.packs.get = jest.fn((key) => {
      if (key !== 'pf2e.equipment-srd') return null;
      return {
        metadata: { packageName: 'pf2e', package: 'pf2e' },
        getDocuments: jest.fn(async () => []),
      };
    });
  });

  test('filters items by category and source using shared picker semantics', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          sourcePack: 'pf2e.equipment-srd',
          sourcePackage: 'pf2e',
          sourcePackageLabel: 'PF2E',
          system: { traits: { rarity: 'common' } },
        },
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          sourcePack: 'custom.equipment',
          sourcePackage: 'custom',
          sourcePackageLabel: 'Custom',
          system: { traits: { rarity: 'common' } },
        },
      ],
    });

    picker._getSourceOptions();
    picker._getCategoryOptions();

    picker.selectedSourcePackages = new Set(['custom']);
    picker.selectedCategories = new Set(['armor']);

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['armor-1']);
  });

  test('loads world equipment items alongside configured packs', async () => {
    game.items = [
      {
        uuid: 'Item.world-sword',
        name: 'World Sword',
        type: 'weapon',
        system: {
          level: { value: 1 },
          traits: { rarity: 'common', value: ['martial'] },
        },
      },
    ];

    const items = await loadItems();

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        uuid: 'Item.world-sword',
        sourcePackage: 'world',
      }),
    ]));
  });

  test('supports multi-select confirmation for item picking', async () => {
    const onSelect = jest.fn();
    const picker = new ItemPicker({ name: 'Actor' }, onSelect, {
      multiSelect: true,
      items: [
        {
          uuid: 'item-a',
          name: 'Adventurer Pack',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 1 } },
        },
        {
          uuid: 'item-b',
          name: 'Backpack',
          type: 'backpack',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 0 } },
        },
      ],
    });

    picker.close = jest.fn();
    picker._toggleSelectedItem('item-b');
    picker._toggleSelectedItem('item-a');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ uuid: 'item-a', name: 'Adventurer Pack' }),
      expect.objectContaining({ uuid: 'item-b', name: 'Backpack' }),
    ]);
    expect(picker.close).toHaveBeenCalled();
  });

  test('toggle select all only affects visible items', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      items: [],
    });

    picker.selectedItemUuids = new Set(['hidden-item']);
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="spell-picker__selected-count"></div>
      <button data-action="toggleSelectAll"></button>
      <button data-action="confirmSelection"></button>
      <div class="item-option" data-uuid="item-a"></div>
      <div class="item-option" data-uuid="item-b"></div>
      <div class="item-option" data-uuid="hidden-item" style="display:none"></div>
    `;

    picker._updateSelectionUI();
    expect(picker.element.querySelector('[data-action="toggleSelectAll"]').textContent)
      .toBe('PF2E_LEVELER.SPELLS.SELECT_ALL');

    picker._toggleSelectAllVisible();
    picker._updateSelectionUI();

    expect(picker.selectedItemUuids.has('item-a')).toBe(true);
    expect(picker.selectedItemUuids.has('item-b')).toBe(true);
    expect(picker.selectedItemUuids.has('hidden-item')).toBe(true);

    picker._toggleSelectAllVisible();
    picker._updateSelectionUI();

    expect(picker.selectedItemUuids.has('item-a')).toBe(false);
    expect(picker.selectedItemUuids.has('item-b')).toBe(false);
    expect(picker.selectedItemUuids.has('hidden-item')).toBe(true);
  });
});
