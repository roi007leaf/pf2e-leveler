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

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Heavy Armor Trick');
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('mechanical alternative prerequisites do not block selection when one branch is met', () => {
    const feat = createFeat({
      name: 'Break Curse',
      prereqText: 'master in Occultism or Religion',
      uuid: 'break-curse',
      slug: 'break-curse',
    });
    feat.system.level.value = 7;
    feat.system.traits.value = ['skill', 'general'];

    const picker = new FeatPicker(createActor(), 'general', 7, createBuildState({
      level: 7,
      skills: { athletics: 0, religion: 3, occultism: 0 },
    }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.prereqResults).toHaveLength(2);
    expect(result.prereqResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'master in Occultism', met: false }),
      expect.objectContaining({ text: 'master in Religion', met: true }),
    ]));
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('mechanical alternative prerequisites render as a grouped prerequisite cluster', () => {
    const feat = createFeat({
      name: 'Break Curse',
      prereqText: 'master in Occultism or Religion',
      uuid: 'break-curse',
      slug: 'break-curse',
    });
    feat.system.level.value = 7;
    feat.system.traits.value = ['skill', 'general'];

    const picker = new FeatPicker(createActor(), 'general', 7, createBuildState({
      level: 7,
      skills: { athletics: 0, religion: 3, occultism: 0 },
    }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();
    const templated = picker._toTemplateFeat(result);

    expect(templated.prereqGroups).toHaveLength(1);
    expect(templated.prereqGroups[0]).toEqual(expect.objectContaining({
      grouped: true,
    }));
    expect(templated.prereqGroups[0].items).toHaveLength(2);
    expect(templated.prereqGroups[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Master In Occultism', met: false }),
      expect.objectContaining({ text: 'Master In Religion', met: true }),
    ]));
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

    const picker = new FeatPicker(createActor(), 'archetype', 2, createBuildState({ level: 2 }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('archetype additional feats stay visible but respect their native prerequisites', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: 'trap-finder',
    });
    feat.system.traits.value = ['rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState({
      level: 4,
      feats: new Set(['archaeologist-dedication']),
    }), jest.fn());
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['trap-finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('archetype additional feats remain visible under locked archetype trait filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState({
      level: 4,
      feats: new Set(['dual-weapon-warrior-dedication']),
    }), jest.fn(), {
      preset: {
        selectedTraits: ['archetype', 'dedication'],
        lockedTraits: ['archetype', 'dedication'],
        traitLogic: 'or',
      },
    });
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('archetype additional feats inherit their dedication archetype trait for filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState({
      level: 4,
      feats: new Set(['dual-weapon-warrior-dedication']),
    }), jest.fn(), {
      preset: {
        selectedTraits: ['dual-weapon-warrior'],
        lockedTraits: ['dual-weapon-warrior'],
      },
    });
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);
    picker.additionalArchetypeFeatTraits = new Map([['quick-draw', new Set(['dual-weapon-warrior'])]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('archetype additional feats count as archetype feat type for locked feat-type filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState({
      level: 4,
      feats: new Set(['dual-weapon-warrior-dedication']),
    }), jest.fn(), {
      preset: {
        selectedFeatTypes: ['archetype'],
        lockedFeatTypes: ['archetype'],
      },
    });
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('template feats expose dedication unlock level for additional archetype feats', () => {
    const feat = createFeat({
      name: 'Twin Parry',
      uuid: 'Compendium.pf2e.feats-srd.Item.twin-parry',
      slug: 'twin-parry',
    });
    feat.system.traits.value = ['fighter', 'ranger'];
    feat.system.level.value = 4;

    const picker = new FeatPicker(createActor(), 'archetype', 6, createBuildState({
      level: 6,
      feats: new Set(['dual-weapon-warrior-dedication']),
    }), jest.fn());
    picker.additionalArchetypeFeatLevels = new Map([['twin-parry', 6]]);

    const templated = picker._toTemplateFeat(feat);

    expect(templated.isAdditionalArchetypeFeat).toBe(true);
    expect(templated.additionalArchetypeUnlockLevel).toBe(6);
  });

  test('custom feat picker treats dedication additional feats as archetype feats for filtering', () => {
    const feat = createFeat({
      name: 'Twin Parry',
      uuid: 'Compendium.pf2e.feats-srd.Item.twin-parry',
      slug: 'twin-parry',
    });
    feat.system.traits.value = ['fighter', 'ranger'];
    feat.system.level.value = 4;

    const picker = new FeatPicker(createActor(), 'custom', 6, createBuildState({
      level: 6,
      feats: new Set(['dual-weapon-warrior-dedication']),
    }), jest.fn(), {
      preset: {
        selectedFeatTypes: ['archetype'],
        lockedFeatTypes: ['archetype'],
        selectedTraits: ['archetype', 'dedication'],
        lockedTraits: ['archetype', 'dedication'],
        traitLogic: 'or',
      },
    });
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['twin-parry', 6]]);
    picker.additionalArchetypeFeatTraits = new Map([['twin-parry', new Set(['dual-weapon-warrior'])]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Twin Parry');
    expect(picker._getFeatTypes(feat)).toContain('archetype');
    expect(picker._getTraitFilterValues(feat)).toEqual(expect.arrayContaining(['archetype', 'dual-weapon-warrior']));
  });

  test('skill-tagged dedication additional feats do not gain virtual archetype type or trait filtering', () => {
    const feat = createFeat({
      name: 'Graceful Leaper',
      uuid: 'Compendium.pf2e.feats-srd.Item.graceful-leaper',
      slug: 'graceful-leaper',
    });
    feat.system.traits.value = ['archetype', 'skill'];
    feat.system.level.value = 7;

    const picker = new FeatPicker(createActor(), 'custom', 7, createBuildState({
      level: 7,
      feats: new Set(['acrobat-dedication']),
    }), jest.fn());
    picker.additionalArchetypeFeatLevels = new Map([['graceful-leaper', 7]]);
    picker.additionalArchetypeFeatTraits = new Map([['graceful-leaper', new Set(['acrobat'])]]);

    expect(picker._getFeatTypes(feat)).not.toContain('archetype');
    expect(picker._getFeatTypes(feat)).toContain('skill');
    expect(picker._getTraitFilterValues(feat)).not.toContain('archetype');
    expect(picker._getTraitFilterValues(feat)).toEqual(expect.arrayContaining(['skill', 'acrobat']));
  });

  test('dedication-unlocked archetype feats still respect unrelated failed prerequisites', () => {
    const feat = createFeat({
      name: 'Holistic Care',
      prereqText: 'trained in Diplomacy, Treat Condition',
      uuid: 'Compendium.pf2e.feats-srd.Item.holistic-care',
      slug: 'holistic-care',
    });
    feat.system.traits.value = ['archetype', 'skill'];
    feat.system.level.value = 6;

    const picker = new FeatPicker(createActor(), 'skill', 6, createBuildState({
      level: 6,
      skills: { athletics: 0, religion: 0, diplomacy: 0 },
      feats: new Set(['medic-dedication', 'treat-condition']),
    }), jest.fn());
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['holistic-care', 6]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.selectionBlocked).toBe(true);
    expect(result.prereqResults.some((entry) => entry.text.toLowerCase().includes('trained in diplomacy') && entry.met === false)).toBe(true);
  });

  test('archetype-unlocked skill feats stay visible in the general picker when skill feats are enabled', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: 'trap-finder',
    });
    feat.system.traits.value = ['skill', 'rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'general', 7, createBuildState({
      level: 7,
      feats: new Set(['archaeologist-dedication']),
    }), jest.fn());
    picker.allFeats = [feat];
    picker.showSkillFeats = true;
    picker.additionalArchetypeFeatLevels = new Map([['trap-finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('archetype additional feat matching through normalized fallback keys still respects prerequisites', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: '',
    });
    feat.system.traits.value = ['skill', 'rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(createActor(), 'class', 6, createBuildState({
      level: 6,
      feats: new Set(['archaeologist-dedication']),
    }), jest.fn());
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['name:trap finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(true);
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

  test('can filter feats by a min and max level range', () => {
    const lowFeat = createFeat({
      name: 'Low Feat',
      uuid: 'low-feat',
      slug: 'low-feat',
    });
    lowFeat.system.level.value = 1;
    lowFeat.system.traits.value = ['cleric'];

    const midFeat = createFeat({
      name: 'Mid Feat',
      uuid: 'mid-feat',
      slug: 'mid-feat',
    });
    midFeat.system.level.value = 4;
    midFeat.system.traits.value = ['cleric'];

    const highFeat = createFeat({
      name: 'High Feat',
      uuid: 'high-feat',
      slug: 'high-feat',
    });
    highFeat.system.level.value = 8;
    highFeat.system.traits.value = ['cleric'];

    const picker = new FeatPicker(createActor(), 'custom', 8, createBuildState({ level: 8 }), jest.fn());
    picker.allFeats = [lowFeat, midFeat, highFeat];
    picker.minLevel = '2';
    picker.maxLevel = '6';

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Mid Feat']);
  });

  test('defaults max level filter to the picker target level', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 7, createBuildState({ level: 7 }), jest.fn());
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(picker.maxLevel).toBe('7');
    expect(context.maxLevel).toBe('7');
  });

  test('custom feat picker starts with all rarities enabled regardless of hide settings', () => {
    global._testSettings = {
      ...(global._testSettings ?? {}),
      'pf2e-leveler': {
        ...(global._testSettings?.['pf2e-leveler'] ?? {}),
        hideUncommonFeats: true,
        hideRareFeats: true,
      },
    };

    const commonFeat = createFeat({
      name: 'Common Feat',
      uuid: 'common-feat',
      slug: 'common-feat',
    });
    commonFeat.system.traits.value = ['general'];
    commonFeat.system.traits.rarity = 'common';

    const uncommonFeat = createFeat({
      name: 'Uncommon Feat',
      uuid: 'uncommon-feat',
      slug: 'uncommon-feat',
    });
    uncommonFeat.system.traits.value = ['general'];
    uncommonFeat.system.traits.rarity = 'uncommon';

    const rareFeat = createFeat({
      name: 'Rare Feat',
      uuid: 'rare-feat',
      slug: 'rare-feat',
    });
    rareFeat.system.traits.value = ['general'];
    rareFeat.system.traits.rarity = 'rare';

    const picker = new FeatPicker(createActor(), 'custom', 6, createBuildState({ level: 6 }), jest.fn());
    picker.allFeats = [commonFeat, uncommonFeat, rareFeat];

    expect([...picker.selectedRarities].sort()).toEqual(['common', 'rare', 'uncommon', 'unique']);
    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Common Feat', 'Rare Feat', 'Uncommon Feat']);
  });

  test('restricts custom feat picker results to allowed feat uuids from a preset', () => {
    const allowedFeat = createFeat({
      name: 'Allowed Feat',
      uuid: 'Compendium.test.feats.Item.allowed',
      slug: 'allowed-feat',
    });
    allowedFeat.system.traits.value = ['general'];

    const blockedFeat = createFeat({
      name: 'Blocked Feat',
      uuid: 'Compendium.test.feats.Item.blocked',
      slug: 'blocked-feat',
    });
    blockedFeat.system.traits.value = ['general'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        allowedFeatUuids: ['Compendium.test.feats.Item.allowed'],
      },
    });
    picker.allFeats = [allowedFeat, blockedFeat];

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Allowed Feat']);
  });

  test('marks required allowed feats with a subclass limitation badge', () => {
    const feat = {
      uuid: 'Compendium.test.feats.Item.allowed',
      slug: 'battle-harbinger-dedication',
      name: 'Battle Harbinger Dedication',
      img: 'icons/svg/mystery-man.svg',
      system: {
        level: { value: 2 },
        maxTakable: 1,
        traits: { value: ['archetype', 'dedication', 'class'], rarity: 'common' },
        prerequisites: { value: [] },
      },
    };

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        allowedFeatUuids: ['Compendium.test.feats.Item.allowed'],
        requiredFeatLimitation: true,
      },
    });
    picker.allFeats = [feat];

    const [result] = picker._applyFilters().map((entry) => picker._toTemplateFeat(entry));

    expect(result.hasSelectionLimitationBadge).toBe(true);
  });

  test('disables level filters when the preset locks them', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 3, createBuildState({ level: 3 }), jest.fn(), {
      preset: {
        minLevel: 1,
        maxLevel: 1,
        lockMinLevel: true,
        lockMaxLevel: true,
      },
    });
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(context.minLevel).toBe('1');
    expect(context.maxLevel).toBe('1');
    expect(context.minLevelLocked).toBe(true);
    expect(context.maxLevelLocked).toBe(true);
  });

  test('uses a custom picker title when provided', () => {
    const picker = new FeatPicker(createActor(), 'custom', 3, createBuildState({ level: 3 }), jest.fn(), {
      title: 'General Training | Select a 1st-level general feat.',
    });

    expect(picker.title).toBe('General Training | Select a 1st-level general feat.');
  });

  test('level range options are capped at the picker target level', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 4, createBuildState({ level: 4 }), jest.fn());
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(context.levelOptions.map((entry) => entry.value)).toEqual(['1', '2', '3', '4']);
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

  test('commits typed trait input for feat filtering', () => {
    const feat = createFeat({
      name: 'Attack Feat',
      uuid: 'attack-feat',
      slug: 'attack-feat',
    });
    feat.system.traits.value = ['attack'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    picker._commitTraitInput({ value: 'attack' });

    expect([...picker.selectedTraits]).toEqual(['attack']);
    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Attack Feat']);
  });

  test('excluded trait filters out feats containing that trait', () => {
    const attackFeat = createFeat({
      name: 'Attack Feat',
      uuid: 'attack-feat',
      slug: 'attack-feat',
    });
    attackFeat.system.traits.value = ['attack'];

    const concentrateFeat = createFeat({
      name: 'Concentrate Feat',
      uuid: 'concentrate-feat',
      slug: 'concentrate-feat',
    });
    concentrateFeat.system.traits.value = ['concentrate'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [attackFeat, concentrateFeat];
    picker.excludedTraits = new Set(['attack']);

    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Concentrate Feat']);
  });

  test('excluded trait preset initializes exclusion filter state', () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        excludedTraits: ['attack'],
      },
    });

    expect([...picker.excludedTraits]).toEqual(['attack']);
  });

  test('search filters by feat title instead of matching trait text', () => {
    const matchingName = createFeat({
      name: 'Skill Training',
      uuid: 'skill-training',
      slug: 'skill-training',
    });
    matchingName.system.traits.value = ['general'];

    const traitOnly = createFeat({
      name: 'Unrelated Feat',
      uuid: 'unrelated-feat',
      slug: 'unrelated-feat',
    });
    traitOnly.system.traits.value = ['skill'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [matchingName, traitOnly];
    picker.searchText = 'skill';

    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Skill Training']);
  });

  test('new dedication feats are not blocked in the custom all-feats picker', () => {
    const feat = createFeat({
      name: 'Pirate Dedication',
      uuid: 'pirate-dedication',
      slug: 'pirate-dedication',
    });
    feat.system.traits.value = ['archetype', 'dedication'];

    const picker = new FeatPicker(createActor(), 'custom', 4, createBuildState({
      level: 4,
      archetypeDedications: new Set(['medic-dedication']),
      canTakeNewArchetypeDedication: false,
    }), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(false);
  });

  test('free archetype picker can ignore dedication lock when the preset requests it', () => {
    const feat = createFeat({
      name: 'Pirate Dedication',
      uuid: 'pirate-dedication',
      slug: 'pirate-dedication',
    });
    feat.system.traits.value = ['archetype', 'dedication'];

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState({
      level: 4,
      archetypeDedications: new Set(['medic-dedication']),
      canTakeNewArchetypeDedication: false,
    }), jest.fn(), {
      preset: {
        ignoreDedicationLock: true,
        selectedTraits: ['archetype', 'dedication'],
        lockedTraits: ['archetype', 'dedication'],
        traitLogic: 'or',
      },
    });
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(false);
    expect(result.prereqResults.some((entry) => String(entry.text ?? '').includes('Complete your current dedication'))).toBe(false);
  });
});
