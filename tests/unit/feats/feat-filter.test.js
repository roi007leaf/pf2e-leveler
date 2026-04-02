import {
  filterFeatsByCategory,
  filterBySearch,
  filterByRarity,
  sortFeats,
} from '../../../scripts/feats/feat-filter.js';

function makeFeat(name, level, traits, rarity = 'common', maxTakable = 1) {
  return {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    system: {
      level: { value: level },
      traits: { value: traits, rarity },
      prerequisites: { value: [] },
      maxTakable,
      category: 'class',
    },
  };
}

describe('filterFeatsByCategory', () => {
  const feats = [
    makeFeat('Quick Bomber', 1, ['alchemist']),
    makeFeat('Calculated Splash', 2, ['alchemist']),
    makeFeat('Battle Medicine', 1, ['general', 'skill']),
    makeFeat('Toughness', 1, ['general']),
    makeFeat('Fighter Dedication', 2, ['archetype', 'dedication']),
    makeFeat('Far Shot', 2, ['alchemist']),
  ];

  test('filters class feats by class trait', () => {
    const result = filterFeatsByCategory(feats, 'class', 'alchemist', 5);
    expect(result.every((f) => f.system.traits.value.includes('alchemist'))).toBe(true);
  });

  test('respects target level', () => {
    const result = filterFeatsByCategory(feats, 'class', 'alchemist', 1);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Quick Bomber');
  });

  test('filters general feats', () => {
    const result = filterFeatsByCategory(feats, 'general', '', 5);
    const names = result.map((f) => f.name);
    expect(names).toContain('Toughness');
    expect(names).toContain('Battle Medicine');
  });

  test('filters skill feats', () => {
    const result = filterFeatsByCategory(feats, 'skill', '', 5);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Battle Medicine');
  });

  test('filters archetype feats', () => {
    const result = filterFeatsByCategory(feats, 'archetype', '', 5);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fighter Dedication');
  });
});

describe('filterBySearch', () => {
  const feats = [
    makeFeat('Quick Bomber', 1, ['alchemist']),
    makeFeat('Battle Medicine', 1, ['skill']),
  ];

  test('filters by name', () => {
    const result = filterBySearch(feats, 'quick');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Quick Bomber');
  });

  test('returns all for empty search', () => {
    expect(filterBySearch(feats, '')).toHaveLength(2);
    expect(filterBySearch(feats, null)).toHaveLength(2);
  });
});

describe('filterByRarity', () => {
  const feats = [
    makeFeat('Common Feat', 1, ['general'], 'common'),
    makeFeat('Uncommon Feat', 1, ['general'], 'uncommon'),
    makeFeat('Rare Feat', 1, ['general'], 'rare'),
  ];

  test('hides uncommon/rare when enabled', () => {
    const result = filterByRarity(feats, true);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Common Feat');
  });

  test('shows all when disabled', () => {
    expect(filterByRarity(feats, false)).toHaveLength(3);
  });
});

describe('sortFeats', () => {
  const feats = [
    makeFeat('Zap', 3, []),
    makeFeat('Alpha', 1, []),
    makeFeat('Beta', 2, []),
  ];

  test('LEVEL_DESC sorts highest level first', () => {
    const result = sortFeats(feats, 'LEVEL_DESC');
    expect(result[0].name).toBe('Zap');
    expect(result[2].name).toBe('Alpha');
  });

  test('LEVEL_ASC sorts lowest level first', () => {
    const result = sortFeats(feats, 'LEVEL_ASC');
    expect(result[0].name).toBe('Alpha');
    expect(result[2].name).toBe('Zap');
  });

  test('ALPHA_ASC sorts alphabetically', () => {
    const result = sortFeats(feats, 'ALPHA_ASC');
    expect(result[0].name).toBe('Alpha');
    expect(result[2].name).toBe('Zap');
  });

  test('ALPHA_DESC sorts reverse alphabetically', () => {
    const result = sortFeats(feats, 'ALPHA_DESC');
    expect(result[0].name).toBe('Zap');
    expect(result[2].name).toBe('Alpha');
  });
});
