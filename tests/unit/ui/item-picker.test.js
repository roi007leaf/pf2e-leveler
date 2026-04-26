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

  test('uses custom formula grant title and empty copy', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      title: 'Bomber: Formula',
      preset: {
        selectedTraits: ['bomb'],
      },
      items: [
        {
          uuid: 'item-a',
          name: 'Torch',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 0 } },
        },
      ],
    });

    const context = await picker._prepareContext();

    expect(picker.title).toBe('Bomber: Formula');
    expect(context.resultsTitle).toBe('Bomber: Formula');
    expect(context.emptyMessage).toBe('No formulas found');
    expect(context.items).toEqual([]);
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

  test('marks taken formula items and blocks selecting them again', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      takenItems: [
        { uuid: 'item-a', name: 'Acid Flask' },
      ],
      items: [
        {
          uuid: 'item-a',
          name: 'Acid Flask',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-b',
          name: 'Alchemist Fire',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
      ],
    });

    const context = await picker._prepareContext();

    expect(context.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ uuid: 'item-a', alreadyTaken: true, selectionBlocked: true }),
      expect.objectContaining({ uuid: 'item-b', alreadyTaken: false, selectionBlocked: false }),
    ]));

    picker._toggleSelectedItem('item-a');
    picker._toggleSelectedItem('item-b');

    expect([...picker.selectedItemUuids]).toEqual(['item-b']);
  });

  test('toggle select all skips visible taken formulas', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      takenItems: [
        { uuid: 'item-a', name: 'Acid Flask' },
      ],
      items: [],
    });

    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="spell-picker__selected-count"></div>
      <button data-action="toggleSelectAll"></button>
      <button data-action="confirmSelection"></button>
      <div class="item-option" data-uuid="item-a" data-already-taken="true" data-selectable="false">
        <button data-action="selectItem"></button>
      </div>
      <div class="item-option" data-uuid="item-b" data-already-taken="false" data-selectable="true">
        <button data-action="selectItem"></button>
      </div>
    `;

    picker._toggleSelectAllVisible();
    picker._updateSelectionUI();

    expect(picker.selectedItemUuids.has('item-a')).toBe(false);
    expect(picker.selectedItemUuids.has('item-b')).toBe(true);
    expect(picker.element.querySelector('[data-uuid="item-a"] [data-action="selectItem"]').disabled).toBe(true);
    expect(picker.element.querySelector('[data-uuid="item-a"] [data-action="selectItem"]').textContent)
      .toBe('PF2E_LEVELER.ITEM_PICKER.TAKEN');
  });

  test('supports preset filters and max multi-select count for grant picking', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      maxSelect: 1,
      preset: {
        selectedCategories: ['consumable'],
        selectedTraits: ['alchemical'],
        selectedRarities: ['common'],
        maxLevel: 1,
      },
      items: [
        {
          uuid: 'item-a',
          name: 'Acid Flask',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-b',
          name: 'Alchemist Fire',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-c',
          name: 'Torch',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 0 } },
        },
      ],
    });

    picker._getCategoryOptions();
    picker._toggleSelectedItem('item-a');
    picker._toggleSelectedItem('item-b');

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['item-a', 'item-b']);
    expect([...picker.selectedItemUuids]).toEqual(['item-a']);
    expect(picker.maxLevel).toBe('1');

    const context = await picker._prepareContext();
    expect(context.maxSelect).toBe(1);
  });

  test('shows max multi-select counter and disables extra formula selections', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      maxSelect: 1,
      items: [
        {
          uuid: 'item-a',
          name: 'Acid Flask',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-b',
          name: 'Alchemist Fire',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
      ],
    });

    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="spell-picker__selected-count"></div>
      <button data-action="toggleSelectAll"></button>
      <button data-action="confirmSelection"></button>
      <div class="item-option" data-uuid="item-a" data-selectable="true">
        <button data-action="selectItem"></button>
      </div>
      <div class="item-option" data-uuid="item-b" data-selectable="true">
        <button data-action="selectItem"></button>
      </div>
    `;

    picker._toggleSelectedItem('item-a');
    picker._updateSelectionUI();

    expect(picker.element.querySelector('.spell-picker__selected-count').textContent).toBe('1 / 1');
    expect(picker.element.querySelector('[data-uuid="item-a"] [data-action="selectItem"]').disabled).toBe(false);
    expect(picker.element.querySelector('[data-uuid="item-b"] [data-action="selectItem"]').disabled).toBe(true);
  });

  test('supports strict formula trait presets for grant picking', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      preset: {
        selectedTraits: ['alchemical', 'mutagen'],
        traitLogic: 'and',
      },
      items: [
        {
          uuid: 'item-a',
          name: 'Generic Alchemical Item',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-b',
          name: 'Mutagen',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical', 'mutagen'] }, level: { value: 1 } },
        },
      ],
    });

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['item-b']);
  });

  test('supports required formula traits combined with alternate selectable traits', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      preset: {
        requiredTraits: ['alchemical'],
        selectedTraits: ['ammunition', 'bomb'],
        traitLogic: 'or',
      },
      items: [
        {
          uuid: 'item-bomb',
          name: 'Alchemical Bomb',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical', 'bomb'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-ammo',
          name: 'Alchemical Ammunition',
          type: 'ammo',
          system: { traits: { rarity: 'common', value: ['alchemical', 'ammunition'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-mundane-ammo',
          name: 'Mundane Ammunition',
          type: 'ammo',
          system: { traits: { rarity: 'common', value: ['ammunition'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-elixir',
          name: 'Alchemical Elixir',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical', 'elixir'] }, level: { value: 1 } },
        },
      ],
    });

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['item-bomb', 'item-ammo']);
  });

  test('locks preset rarity filters for grant picking', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      multiSelect: true,
      preset: {
        selectedCategories: ['consumable'],
        selectedTraits: ['alchemical'],
        selectedRarities: ['common'],
        lockedRarities: ['uncommon', 'rare', 'unique'],
        maxLevel: 1,
      },
      items: [
        {
          uuid: 'item-common',
          name: 'Common Formula',
          type: 'consumable',
          system: { traits: { rarity: 'common', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-uncommon',
          name: 'Uncommon Formula',
          type: 'consumable',
          system: { traits: { rarity: 'uncommon', value: ['alchemical'] }, level: { value: 1 } },
        },
        {
          uuid: 'item-rare',
          name: 'Rare Formula',
          type: 'consumable',
          system: { traits: { rarity: 'rare', value: ['alchemical'] }, level: { value: 1 } },
        },
      ],
    });

    const context = await picker._prepareContext();

    expect(context.rarityOptions).toEqual([
      expect.objectContaining({ value: 'common', selected: true, locked: true }),
    ]);
    expect(context.items.map((item) => item.uuid)).toEqual(['item-common']);
    expect([...picker.selectedRarities]).toEqual(['common']);
  });

  test('caps max level options for grant picking', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      preset: {
        maxLevel: 5,
        maxLevelCap: 2,
      },
      items: [
        {
          uuid: 'item-level-2',
          name: 'Plan-Level Item',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 2 } },
        },
        {
          uuid: 'item-level-3',
          name: 'Too-High Item',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 3 } },
        },
      ],
    });

    const context = await picker._prepareContext();

    expect(context.maxLevel).toBe('2');
    expect(context.maxLevelCapped).toBe(true);
    expect(context.levelOptions.map((entry) => entry.value)).toEqual(['0', '1', '2']);
    expect(context.items.map((item) => item.uuid)).toEqual(['item-level-2']);
    expect(picker._normalizeMaxLevel('3')).toBe('2');
  });

  test('hides rarity chips that have no items in the current max-level view', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'item-common',
          name: 'Common Item',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 1 } },
        },
        {
          uuid: 'item-rare',
          name: 'Rare Item',
          type: 'equipment',
          system: { traits: { rarity: 'rare', value: [] }, level: { value: 5 } },
        },
      ],
    });
    picker.maxLevel = '1';

    const context = await picker._prepareContext();

    expect(context.rarityOptions.map((entry) => entry.value)).toEqual(['common']);
  });

  test('prepares collapsible filter section metadata for publications and equipment filters', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          publicationTitle: 'Player Core',
          system: {
            category: { value: 'medium' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          publicationTitle: 'Treasure Vault',
          system: {
            category: { value: 'martial' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
        {
          uuid: 'armor-2',
          name: 'Leather Armor',
          type: 'armor',
          publicationTitle: 'Treasure Vault',
          system: {
            category: { value: 'light' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
      ],
    });
    picker.selectedCategories = new Set(['armor']);
    picker.selectedArmorFilters = new Set(['category:medium']);
    picker.selectedPublications = new Set(['Player Core']);

    const context = await picker._prepareContext();

    expect(context.filterSections.publications).toEqual(expect.objectContaining({
      collapsed: true,
      activeCount: 1,
      summary: '1',
    }));
    expect(context.filterSections.armor).toEqual(expect.objectContaining({
      collapsed: true,
      activeCount: 1,
      summary: '1',
    }));
    expect(context.filterSections.weapon).toEqual(expect.objectContaining({
      collapsed: true,
      activeCount: 0,
    }));
  });

  test('item picker template moves trait filter below search and uses collapsible section shells', () => {
    const template = require('fs').readFileSync(require('path').resolve(__dirname, '../../../templates/item-picker.hbs'), 'utf8');

    expect(template).not.toContain('{{localize "PF2E_LEVELER.CREATION.SEARCH"}}');
    expect(template).toContain('picker__utility-row picker__utility-row--inline-label');
    expect(template).toContain('<div class="picker__filter-label">{{localize "PF2E_LEVELER.FEAT_PICKER.FILTER_LEVEL"}}</div>');
    expect(template).not.toContain('{{localize "PF2E_LEVELER.FEAT_PICKER.MAX_LEVEL" level=this.label}}');
    expect(template.indexOf('data-action="traitInput"')).toBeGreaterThan(template.indexOf('data-action="searchItems"'));
    expect(template.indexOf('data-action="traitInput"')).toBeLessThan(template.indexOf('data-action="filterMaxLevel"'));
    expect(template).toContain('data-section="publications"');
    expect(template).toContain('data-section="armor"');
    expect(template).toContain('data-section="weapon"');
    expect(template).toContain('picker__prereq-toggle picker__prereq-toggle--section" data-action="toggleArmorFilterLogic"');
    expect(template).toContain('picker__prereq-toggle picker__prereq-toggle--section" data-action="toggleWeaponFilterLogic"');
    expect(template).not.toContain('picker__filter-label picker__filter-label--row');
    expect(template.match(/picker__section-chevron/g)).toHaveLength(3);
    expect(template).toContain('{{#unless filterSections.publications.collapsed}}');
    expect(template).toContain('{{#unless filterSections.armor.collapsed}}');
    expect(template).toContain('{{#unless filterSections.weapon.collapsed}}');
  });

  test('toggling an item filter section is reflected in the next prepared context', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
      ],
    });
    picker.selectedCategories = new Set(['armor']);
    picker.render = jest.fn();
    picker.element = document.createElement('div');
    picker.element.innerHTML = '<button type="button" data-action="toggleFilterSection" data-section="armor"></button>';

    picker._onRender();
    picker.element.querySelector('[data-action="toggleFilterSection"]').click();

    expect(picker.filterSections.armor).toBe(false);
    const context = await picker._prepareContext();
    expect(context.filterSections.armor.collapsed).toBe(false);
  });

  test('builds dedicated armor and weapon filter options from item metadata', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            group: { value: 'chain' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
          },
        },
      ],
    });

    const armorOptions = picker._getArmorFilterOptions();
    const weaponOptions = picker._getWeaponFilterOptions();

    expect(armorOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'category:medium', label: 'Medium Armor' }),
      expect.objectContaining({ value: 'group:chain', label: 'Chain' }),
    ]));
    expect(weaponOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'category:martial', label: 'Martial Weapon' }),
      expect.objectContaining({ value: 'group:sword', label: 'Sword' }),
    ]));
  });

  test('filters items by dedicated armor filters', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            group: { value: 'chain' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'armor-2',
          name: 'Leather Armor',
          type: 'armor',
          system: {
            category: { value: 'light' },
            group: { value: 'leather' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
          },
        },
      ],
    });

    picker._getArmorFilterOptions();
    picker.selectedCategories = new Set(['armor']);
    picker.selectedArmorFilters = new Set(['category:medium']);

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['armor-1']);
  });

  test('supports AND logic for dedicated weapon filters', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-2',
          name: 'Greatsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-3',
          name: 'Longbow',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'bow' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-4',
          name: 'Dagger',
          type: 'weapon',
          system: {
            category: { value: 'simple' },
            group: { value: 'knife' },
            traits: { rarity: 'common', value: [] },
          },
        },
      ],
    });

    picker._getWeaponFilterOptions();
    picker.selectedCategories = new Set(['weapon']);
    picker.selectedWeaponFilters = new Set(['category:martial', 'group:sword']);
    picker.weaponFilterLogic = 'and';

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['weapon-1', 'weapon-2']);
  });

  test('hides armor and weapon filters before parent category is explicitly selected', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            group: { value: 'chain' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
      ],
    });

    const context = await picker._prepareContext();

    expect(context.showArmorFilters).toBe(false);
    expect(context.showWeaponFilters).toBe(false);
  });

  test('hides armor filters when armor category is not selected', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            group: { value: 'chain' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
            level: { value: 1 },
          },
        },
      ],
    });

    picker._getCategoryOptions();
    picker.selectedCategories = new Set(['weapon']);

    const context = await picker._prepareContext();

    expect(context.showArmorFilters).toBe(false);
    expect(context.showWeaponFilters).toBe(true);
  });

  test('ignores hidden armor filters until armor category is active again', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'armor-1',
          name: 'Chain Mail',
          type: 'armor',
          system: {
            category: { value: 'medium' },
            group: { value: 'chain' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'armor-2',
          name: 'Leather Armor',
          type: 'armor',
          system: {
            category: { value: 'light' },
            group: { value: 'leather' },
            traits: { rarity: 'common', value: [] },
          },
        },
        {
          uuid: 'weapon-1',
          name: 'Longsword',
          type: 'weapon',
          system: {
            category: { value: 'martial' },
            group: { value: 'sword' },
            traits: { rarity: 'common', value: [] },
          },
        },
      ],
    });

    picker._getCategoryOptions();
    picker._getArmorFilterOptions();
    picker.selectedCategories = new Set(['armor']);
    picker.selectedArmorFilters = new Set(['category:medium']);

    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['armor-1']);

    picker.selectedCategories = new Set(['weapon']);
    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['weapon-1']);

    picker.selectedCategories = new Set(['armor']);
    expect(picker._filterItems().map((item) => item.uuid)).toEqual(['armor-1']);
  });

  test('builds special equipment tags for armor and weapon items', () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [],
    });

    const armorItem = picker._toTemplateItem({
      uuid: 'armor-1',
      name: 'Chain Mail',
      type: 'armor',
      system: {
        category: { value: 'medium' },
        group: { value: 'chain' },
        traits: { rarity: 'common', value: [] },
        level: { value: 1 },
      },
    });
    const weaponItem = picker._toTemplateItem({
      uuid: 'weapon-1',
      name: 'Longsword',
      type: 'weapon',
      system: {
        category: { value: 'martial' },
        group: { value: 'sword' },
        traits: { rarity: 'common', value: [] },
        level: { value: 1 },
      },
    });

    expect(armorItem.equipmentTags).toEqual(['Medium Armor', 'Chain']);
    expect(weaponItem.equipmentTags).toEqual(['Martial Weapon', 'Sword']);
  });

  test('caps initial item picker results to first 200 items with no active filters', async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({
      uuid: `item-${i}`,
      name: `Item ${String(i).padStart(3, '0')}`,
      type: 'equipment',
      system: {
        traits: { rarity: 'common', value: [] },
        level: { value: 1 },
      },
    }));
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), { items });

    const context = await picker._prepareContext();

    expect(context.filteredCount).toBe(250);
    expect(context.renderedCount).toBe(200);
    expect(context.items).toHaveLength(200);
    expect(context.capped).toBe(true);
  });

  test('caps initial item picker results even when source packages are present but no source filter is selected', async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({
      uuid: `item-${i}`,
      name: `Item ${String(i).padStart(3, '0')}`,
      type: 'equipment',
      sourcePackage: i < 220 ? 'pf2e' : 'custom',
      sourcePackageLabel: i < 220 ? 'PF2E' : 'Custom',
      system: {
        traits: { rarity: 'common', value: [] },
        level: { value: 1 },
      },
    }));
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), { items });

    const context = await picker._prepareContext();

    expect(context.filteredCount).toBe(250);
    expect(context.renderedCount).toBe(200);
    expect(context.items).toHaveLength(200);
    expect(context.capped).toBe(true);
  });

  test('shows all matching item picker results once a specific filter is active', async () => {
    const items = Array.from({ length: 250 }, (_, i) => ({
      uuid: `item-${i}`,
      name: `Item ${String(i).padStart(3, '0')}`,
      type: 'equipment',
      sourcePackage: i < 220 ? 'pf2e' : 'custom',
      sourcePackageLabel: i < 220 ? 'PF2E' : 'Custom',
      system: {
        traits: { rarity: 'common', value: [] },
        level: { value: 1 },
      },
    }));
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), { items });

    picker._getSourceOptions();
    picker.selectedSourcePackages = new Set(['custom']);
    const context = await picker._prepareContext();

    expect(context.filteredCount).toBe(30);
    expect(context.renderedCount).toBe(30);
    expect(context.items).toHaveLength(30);
    expect(context.capped).toBe(false);
  });

  test('keeps rarity chips rendered after an item list update', async () => {
    const picker = new ItemPicker({ name: 'Actor' }, jest.fn(), {
      items: [
        {
          uuid: 'item-common',
          name: 'Common Item',
          type: 'equipment',
          system: { traits: { rarity: 'common', value: [] }, level: { value: 1 } },
        },
        {
          uuid: 'item-rare',
          name: 'Rare Item',
          type: 'equipment',
          system: { traits: { rarity: 'rare', value: [] }, level: { value: 1 } },
        },
      ],
    });
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="pf2e-leveler item-picker">
        <div data-role="rarity-chips"></div>
        <div class="item-list"></div>
        <div class="picker__results-count"></div>
      </div>
    `;

    const renderSpy = jest.spyOn(foundry.applications.handlebars, 'renderTemplate').mockImplementation(async (_template, context) => `
      <div class="pf2e-leveler item-picker">
        <div data-role="rarity-chips">${(context.rarityOptions ?? []).map((entry) => `<button data-action="toggleRarityChip" data-rarity="${entry.value}">${entry.label}</button>`).join('')}</div>
        <div class="item-list"></div>
      </div>
    `);

    await picker._prepareContext();
    await picker._updateList();

    expect(renderSpy).toHaveBeenCalled();
    expect(picker.element.querySelectorAll('[data-role="rarity-chips"] [data-action="toggleRarityChip"]')).toHaveLength(2);

    renderSpy.mockRestore();
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
