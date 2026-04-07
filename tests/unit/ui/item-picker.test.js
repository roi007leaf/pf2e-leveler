import { ItemPicker } from '../../../scripts/ui/item-picker.js';

describe('ItemPicker', () => {
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
});
