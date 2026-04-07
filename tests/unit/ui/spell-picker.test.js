jest.mock('../../../scripts/compendiums/catalog.js', () => ({
  getCompendiumKeysForCategory: jest.fn(() => ['pf2e.spells-srd']),
}));

import { clearSpellPickerCache, SpellPicker } from '../../../scripts/ui/spell-picker.js';

const { getCompendiumKeysForCategory } = jest.requireMock('../../../scripts/compendiums/catalog.js');

describe('SpellPicker', () => {
  beforeEach(() => {
    clearSpellPickerCache();
    getCompendiumKeysForCategory.mockReturnValue(['pf2e.spells-srd']);
    game.packs.get = jest.fn((key) => {
      if (key !== 'pf2e.spells-srd') return null;
      return {
        getDocuments: jest.fn(async () => [
          makeSpell('magic-missile', 'Magic Missile', 1, ['arcane']),
          makeSpell('acid-grip', 'Acid Grip', 2, ['arcane']),
          makeSpell('heal', 'Heal', 1, ['divine']),
        ]),
      };
    });
  });

  test('allows lower-rank spells for higher-rank spontaneous selections', async () => {
    const actor = createMockActor({
      items: [],
    });
    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), { excludedSelections: [] });

    const context = await picker._prepareContext();
    const names = context.spells.map((spell) => spell.name);

    expect(names).toContain('Magic Missile');
    expect(names).toContain('Acid Grip');
    expect(names).not.toContain('Heal');
    expect(names.slice(0, 2)).toEqual(['Acid Grip', 'Magic Missile']);
  });

  test('can switch spell picker sorting back to alphabetical', async () => {
    const actor = createMockActor({
      items: [],
    });
    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), { excludedSelections: [] });
    await picker._prepareContext();

    picker.sortMode = 'alpha-asc';
    picker.filteredSpells = picker._filterSpells();
    picker._sortSpells(picker.filteredSpells);

    expect(picker.filteredSpells.map((spell) => spell.name).slice(0, 2)).toEqual(['Acid Grip', 'Magic Missile']);

    picker.sortMode = 'alpha-desc';
    picker.filteredSpells = picker._filterSpells();
    picker._sortSpells(picker.filteredSpells);

    expect(picker.filteredSpells.map((spell) => spell.name).slice(0, 2)).toEqual(['Magic Missile', 'Acid Grip']);
  });

  test('allows same spell at a different rank but blocks same spell and rank', async () => {
    const actor = createMockActor({
      items: [
        {
          type: 'spell',
          sourceId: 'magic-missile',
          system: {
            level: { value: 1 },
            location: { value: 'entry-1' },
          },
        },
      ],
    });

    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), { excludedSelections: [] });
    const context = await picker._prepareContext();
    expect(context.spells.map((spell) => spell.uuid)).toContain('magic-missile');

    const sameRankPicker = new SpellPicker(actor, 'arcane', 1, jest.fn(), { excludedSelections: [] });
    const sameRankContext = await sameRankPicker._prepareContext();
    expect(sameRankContext.spells.map((spell) => spell.uuid)).not.toContain('magic-missile');
  });

  test('supports exact-rank spell selection for preparation-style picking', async () => {
    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), {
      exactRank: true,
      excludedSelections: [],
    });

    const context = await picker._prepareContext();
    const uuids = context.spells.map((spell) => spell.uuid);

    expect(uuids).toContain('acid-grip');
    expect(uuids).not.toContain('magic-missile');
  });

  test('loads spells from configured spell compendium categories', async () => {
    clearSpellPickerCache();
    getCompendiumKeysForCategory.mockReturnValue(['pf2e.spells-srd', 'custom.spells']);
    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.spells-srd') {
        return {
          getDocuments: jest.fn(async () => [
            makeSpell('magic-missile', 'Magic Missile', 1, ['arcane']),
          ]),
        };
      }
      if (key === 'custom.spells') {
        return {
          getDocuments: jest.fn(async () => [
            makeSpell('custom-bolt', 'Custom Bolt', 1, ['arcane']),
          ]),
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'arcane', 1, jest.fn(), { excludedSelections: [] });
    const context = await picker._prepareContext();

    expect(getCompendiumKeysForCategory).toHaveBeenCalledWith('spells');
    expect(context.spells.map((spell) => spell.uuid)).toEqual(expect.arrayContaining(['magic-missile', 'custom-bolt']));
  });

  test('supports multi-select confirmation for preparation-style picking', async () => {
    const actor = createMockActor({ items: [] });
    const onSelect = jest.fn();
    const picker = new SpellPicker(actor, 'arcane', 1, onSelect, {
      exactRank: true,
      multiSelect: true,
      excludedSelections: [],
    });

    await picker._prepareContext();
    picker.close = jest.fn();

    picker._toggleSelectedSpell('magic-missile');
    picker._toggleSelectedSpell('magic-missile');
    picker._toggleSelectedSpell('magic-missile');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ uuid: 'magic-missile', name: 'Magic Missile' }),
    ]);
    expect(picker.close).toHaveBeenCalled();
  });

  test('toggle select all selects or deselects only visible spells', () => {
    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'arcane', 1, jest.fn(), {
      exactRank: true,
      multiSelect: true,
      excludedSelections: [],
    });

    picker.selectedSpellUuids = new Set(['hidden-spell']);
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="spell-picker__selected-count"></div>
      <button data-action="toggleSelectAll"></button>
      <button data-action="confirmSelection"></button>
      <div class="spell-option" data-uuid="magic-missile"></div>
      <div class="spell-option" data-uuid="acid-grip"></div>
      <div class="spell-option" data-uuid="hidden-spell" style="display:none"></div>
    `;

    picker._updateSelectionUI();
    expect(picker.element.querySelector('[data-action="toggleSelectAll"]').textContent)
      .toBe('PF2E_LEVELER.SPELLS.SELECT_ALL');

    picker._toggleSelectAllVisible();
    picker._updateSelectionUI();

    expect(picker.selectedSpellUuids.has('magic-missile')).toBe(true);
    expect(picker.selectedSpellUuids.has('acid-grip')).toBe(true);
    expect(picker.selectedSpellUuids.has('hidden-spell')).toBe(true);
    expect(picker.element.querySelector('[data-action="toggleSelectAll"]').textContent)
      .toBe('PF2E_LEVELER.SPELLS.DESELECT_ALL');

    picker._toggleSelectAllVisible();
    picker._updateSelectionUI();

    expect(picker.selectedSpellUuids.has('magic-missile')).toBe(false);
    expect(picker.selectedSpellUuids.has('acid-grip')).toBe(false);
    expect(picker.selectedSpellUuids.has('hidden-spell')).toBe(true);
    expect(picker.element.querySelector('[data-action="toggleSelectAll"]').textContent)
      .toBe('PF2E_LEVELER.SPELLS.SELECT_ALL');
  });

  test('preserves spell uuid in template view data', () => {
    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'arcane', 1, jest.fn(), {
      exactRank: true,
      multiSelect: true,
      excludedSelections: [],
    });

    const spell = makeSpell('magic-missile', 'Magic Missile', 1, ['arcane']);
    const viewData = picker._toTemplateSpell(spell);

    expect(viewData.uuid).toBe('magic-missile');
    expect(viewData.name).toBe('Magic Missile');
    expect(viewData.system.level.value).toBe(1);
  });

  test('can filter out already owned spells by identity for preparation-style picking', async () => {
    const actor = createMockActor({
      items: [
        {
          type: 'spell',
          sourceId: 'magic-missile',
          name: 'Magic Missile',
          system: {
            level: { value: 1 },
            location: { value: 'entry-1' },
          },
        },
      ],
    });

    const picker = new SpellPicker(actor, 'arcane', 1, jest.fn(), {
      exactRank: true,
      multiSelect: true,
      excludeOwnedByIdentity: true,
      excludedSelections: [],
    });

    const context = await picker._prepareContext();
    const uuids = context.spells.map((spell) => spell.uuid);

    expect(uuids).not.toContain('magic-missile');
  });

  test('can filter spells by multiple selected ranks', async () => {
    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'any', -1, jest.fn(), { excludedSelections: [] });
    await picker._prepareContext();

    picker.selectedRanks = new Set([1]);
    expect(picker._filterSpells().map((spell) => spell.uuid)).toEqual(expect.arrayContaining(['magic-missile', 'heal']));
    expect(picker._filterSpells().map((spell) => spell.uuid)).not.toContain('acid-grip');

    picker.selectedRanks = new Set([1, 2]);
    expect(picker._filterSpells().map((spell) => spell.uuid)).toEqual(expect.arrayContaining(['magic-missile', 'heal', 'acid-grip']));
  });

  test('can filter spells by selected traditions', async () => {
    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'any', -1, jest.fn(), { excludedSelections: [] });
    await picker._prepareContext();

    picker.selectedTraditions = new Set(['divine']);
    expect(picker._filterSpells().map((spell) => spell.uuid)).toEqual(['heal']);

    picker.selectedTraditions = new Set(['arcane']);
    expect(picker._filterSpells().map((spell) => spell.uuid)).toEqual(expect.arrayContaining(['magic-missile', 'acid-grip']));
    expect(picker._filterSpells().map((spell) => spell.uuid)).not.toContain('heal');
  });

  test('does not crash when a spell is missing system.level.value but has a valid heightened level', async () => {
    clearSpellPickerCache();
    game.packs.get = jest.fn((key) => {
      if (key !== 'pf2e.spells-srd') return null;
      return {
        getDocuments: jest.fn(async () => [
          {
            uuid: 'city-of-sin',
            name: 'City of Sin',
            system: {
              heightenedLevel: 7,
              traits: {
                value: [],
                traditions: ['arcane'],
              },
            },
          },
        ]),
      };
    });

    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'any', -1, jest.fn(), { excludedSelections: [] });
    const context = await picker._prepareContext();

    expect(context.spells.map((spell) => spell.uuid)).toContain('city-of-sin');
  });

  test('can filter spells by category', async () => {
    clearSpellPickerCache();
    game.packs.get = jest.fn((key) => {
      if (key !== 'pf2e.spells-srd') return null;
      return {
        getDocuments: jest.fn(async () => [
          makeSpell('magic-missile', 'Magic Missile', 1, ['arcane']),
          makeSpell('force-barrage', 'Force Barrage', 1, ['arcane'], ['focus']),
        ]),
      };
    });

    const actor = createMockActor({ items: [] });
    const picker = new SpellPicker(actor, 'any', -1, jest.fn(), { excludedSelections: [] });
    await picker._prepareContext();

    picker.selectedCategories = new Set(['focus']);
    expect(picker._filterSpells().map((spell) => spell.uuid)).toEqual(['force-barrage']);
  });
});

function makeSpell(uuid, name, level, traditions, extraTraits = []) {
  return {
    uuid,
    name,
    system: {
      level: { value: level },
      traits: {
        value: extraTraits,
        traditions,
      },
    },
  };
}
