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
});
