import {
  initializeSelectionSet,
  normalizeItemCategory,
  toggleSelectableChip,
} from '../../../scripts/ui/shared/picker-utils.js';

describe('picker utils', () => {
  test('selection sets default to all available values when empty', () => {
    const selected = initializeSelectionSet(new Set(), ['a', 'b', 'c']);
    expect([...selected]).toEqual(['a', 'b', 'c']);
  });

  test('toggling a selected chip from all-selected deselects only that chip', () => {
    const next = toggleSelectableChip(new Set(['a', 'b', 'c']), 'b', ['a', 'b', 'c']);
    expect([...next]).toEqual(['a', 'c']);
  });

  test('toggling the last selected value restores all values', () => {
    const next = toggleSelectableChip(new Set(['b']), 'b', ['a', 'b', 'c']);
    expect([...next]).toEqual(['a', 'b', 'c']);
  });

  test('normalizes item categories for the item picker', () => {
    expect(normalizeItemCategory({ type: 'weapon' })).toBe('weapon');
    expect(normalizeItemCategory({ type: 'armor' })).toBe('armor');
    expect(normalizeItemCategory({ type: 'consumable' })).toBe('consumable');
    expect(normalizeItemCategory({ type: 'backpack' })).toBe('container');
    expect(normalizeItemCategory({ type: 'equipment', system: { category: { value: 'ammunition' } } })).toBe('ammunition');
  });
});
