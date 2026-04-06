import { FeatPicker } from '../../../scripts/ui/feat-picker.js';

describe('FeatPicker prerequisite enforcement', () => {
  function createFeat({ name, prereqText, uuid = 'feat-1', slug = 'feat-1' }) {
    return {
      uuid,
      slug,
      name,
      img: 'icons/svg/mystery-man.svg',
      system: {
        level: { value: 2 },
        maxTakable: 1,
        traits: { value: ['archetype'], rarity: 'common' },
        prerequisites: prereqText ? { value: [{ value: prereqText }] } : { value: [] },
      },
    };
  }

  function createBuildState(overrides = {}) {
    return {
      level: 2,
      class: { slug: 'cleric', hp: 8, subclassType: null },
      ancestrySlug: 'human',
      heritageSlug: 'versatile-heritage',
      attributes: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      skills: { athletics: 0, religion: 0 },
      lores: {},
      proficiencies: {},
      equipment: {
        hasShield: false,
        armorCategories: new Set(),
        weaponCategories: new Set(),
        weaponGroups: new Set(),
        weaponTraits: new Set(),
        wieldedMelee: false,
        wieldedRanged: false,
      },
      feats: new Set(),
      deity: null,
      spellcasting: { hasAny: false, traditions: new Set(), focusPool: false, focusPointsMax: 0 },
      classArchetypeDedications: new Set(),
      classFeatures: new Set(),
      ...overrides,
    };
  }

  function createActor() {
    return {
      name: 'Test Character',
      class: { slug: 'cleric' },
      items: {
        filter: jest.fn(() => []),
      },
    };
  }

  test('unknown narrative prerequisites are shown but do not block selection', () => {
    const feat = createFeat({
      name: 'Vampire Dedication',
      prereqText: 'You were killed by a vampire drinking your blood.',
      uuid: 'vampire-dedication',
      slug: 'vampire-dedication',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('mechanically unmet prerequisites still block selection when enforcement is enabled', () => {
    const feat = createFeat({
      name: 'Heavy Armor Trick',
      prereqText: 'wearing heavy armor',
      uuid: 'heavy-armor-trick',
      slug: 'heavy-armor-trick',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    const filtered = picker._applyFilters();

    expect(filtered).toHaveLength(0);
    expect(feat.hasFailedPrerequisites).toBe(true);
    expect(feat.hasUnknownPrerequisites).toBe(false);
    expect(feat.prerequisitesFailed).toBe(true);
    expect(feat.selectionBlocked).toBe(true);
  });

  test('signature trick prerequisites are shown as unknown and do not block selection', () => {
    const feat = createFeat({
      name: 'Additional Circus Trick',
      prereqText: 'You Must Have A Signature Trick',
      uuid: 'additional-circus-trick',
      slug: 'additional-circus-trick',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 3, createBuildState({ level: 3 }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('multi-ancestry feat selection prerequisites are shown as unknown and do not block selection', () => {
    const feat = createFeat({
      name: 'Different Worlds',
      prereqText: 'Ability To Select Ancestry Feats From Multiple Ancestries',
      uuid: 'different-worlds',
      slug: 'different-worlds',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 1, createBuildState({ level: 1 }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('custom feat picker can filter by multiple feat types', () => {
    const classFeat = createFeat({
      name: 'Power Attack',
      uuid: 'power-attack',
      slug: 'power-attack',
    });
    classFeat.system.traits.value = ['cleric'];

    const skillFeat = createFeat({
      name: 'Battle Medicine',
      uuid: 'battle-medicine',
      slug: 'battle-medicine',
    });
    skillFeat.system.traits.value = ['skill'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [classFeat, skillFeat];
    picker.selectedFeatTypes = new Set(['class']);

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Power Attack']);

    picker.selectedFeatTypes = new Set(['class', 'skill']);
    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Battle Medicine', 'Power Attack']);
  });

  test('supports multi-select confirmation for custom feat picking', async () => {
    const classFeat = createFeat({
      name: 'Power Attack',
      uuid: 'power-attack',
      slug: 'power-attack',
    });
    classFeat.system.traits.value = ['cleric'];

    const skillFeat = createFeat({
      name: 'Battle Medicine',
      uuid: 'battle-medicine',
      slug: 'battle-medicine',
    });
    skillFeat.system.traits.value = ['skill'];

    const onSelect = jest.fn();
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), onSelect, { multiSelect: true });
    picker.allFeats = [classFeat, skillFeat];
    await picker._prepareContext();
    picker.close = jest.fn();

    picker._toggleSelectedFeat('power-attack');
    picker._toggleSelectedFeat('battle-medicine');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ uuid: 'battle-medicine', name: 'Battle Medicine' }),
      expect.objectContaining({ uuid: 'power-attack', name: 'Power Attack' }),
    ]);
    expect(picker.close).toHaveBeenCalled();
  });

  test('uses sourceId fallback when feat uuid is missing', async () => {
    const feat = createFeat({
      name: 'Fallback Feat',
      slug: 'fallback-feat',
    });
    feat.uuid = '';
    feat.sourceId = 'Compendium.test.feats.Item.fallbackFeat';

    const onSelect = jest.fn();
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), onSelect, { multiSelect: true });
    picker.allFeats = [feat];

    const context = await picker._prepareContext();
    expect(context.feats[0].uuid).toBe('Compendium.test.feats.Item.fallbackFeat');

    picker._toggleSelectedFeat('Compendium.test.feats.Item.fallbackFeat');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ sourceId: 'Compendium.test.feats.Item.fallbackFeat', name: 'Fallback Feat' }),
    ]);
  });
});
