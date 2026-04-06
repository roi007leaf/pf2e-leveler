import {
  collectAdditionalArchetypeFeatLevels,
  filterFeatsByCategory,
  filterByArchetypeRestrictions,
  filterByDedication,
  filterByGeneralSkillFeats,
  getFeatsForSelection,
  filterBySearch,
  filterBySkill,
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
      description: { value: '' },
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

  test('can include dedication feats in class feat filtering when requested', () => {
    const result = filterFeatsByCategory(feats, 'class', 'fighter', 5, { includeDedications: true });
    expect(result).toEqual([
      expect.objectContaining({ name: 'Fighter Dedication' }),
    ]);
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
    expect(names).not.toContain('Battle Medicine');
  });

  test('can include skill feats in general feat filtering when requested', () => {
    const result = filterFeatsByCategory(feats, 'general', '', 5, { includeSkillFeats: true });
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

  test('includes additional feats granted by an owned archetype dedication', async () => {
    const dedication = {
      ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']),
      system: {
        ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']).system,
        description: {
          value: '<p><strong>Additional Feats:</strong> 4th Twin Takedown, 6th Twin Parry</p>',
        },
      },
    };
    const twinTakedown = makeFeat('Twin Takedown', 4, ['fighter']);
    const twinParry = makeFeat('Twin Parry', 8, ['fighter']);

    const additionalLevels = await collectAdditionalArchetypeFeatLevels(
      [dedication, twinTakedown, twinParry],
      new Set(['avenger-dedication']),
    );

    const result = filterFeatsByCategory(
      [dedication, twinTakedown, twinParry],
      'archetype',
      '',
      4,
      { additionalArchetypeFeatLevels: additionalLevels },
    );

    expect(result).toEqual([
      expect.objectContaining({ name: 'Avenger Dedication' }),
      expect.objectContaining({ name: 'Twin Takedown' }),
    ]);
    expect(result).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Twin Parry' }),
    ]));
  });

  test('ancestry feat filtering includes adopted ancestry traits from build state', () => {
    const feats = [
      makeFeat('Dwarven Lore', 1, ['dwarf']),
      makeFeat('Natural Ambition', 1, ['human']),
      makeFeat('Elven Lore', 1, ['elf']),
    ];

    const result = getFeatsForSelection(feats, 'ancestry', { ancestry: { slug: 'human' }, heritage: null }, 1, {
      buildState: {
        ancestryTraits: new Set(['human', 'dwarf']),
      },
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Dwarven Lore' }),
      expect.objectContaining({ name: 'Natural Ambition' }),
    ]));
    expect(result).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Elven Lore' }),
    ]));
  });
});

describe('dedication and skill filters', () => {
  beforeEach(() => {
    global.game = {
      ...global.game,
      i18n: {
        has: jest.fn(() => false),
        localize: jest.fn((key) => key),
      },
    };
    global.CONFIG = {
      ...global.CONFIG,
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          arc: 'Arcana',
          cra: 'Crafting',
        },
      },
    };
  });

  test('filterByDedication hides dedication feats when disabled', () => {
    const feats = [
      makeFeat('Wizard Dedication', 2, ['archetype', 'dedication']),
      makeFeat('Basic Wizard Spellcasting', 4, ['archetype']),
    ];

    const result = filterByDedication(feats, false);
    expect(result).toEqual([
      expect.objectContaining({ name: 'Basic Wizard Spellcasting' }),
    ]);
  });

  test('filterBySkill matches skill feats by prerequisite skill text', () => {
    const feats = [
      {
        ...makeFeat('Battle Medicine', 1, ['skill']),
        system: {
          ...makeFeat('Battle Medicine', 1, ['skill']).system,
          prerequisites: { value: [{ value: 'Trained in Medicine' }] },
        },
      },
      {
        ...makeFeat('Arcane Sense', 1, ['skill']),
        system: {
          ...makeFeat('Arcane Sense', 1, ['skill']).system,
          prerequisites: { value: [{ value: 'Trained in Arcana' }] },
        },
      },
    ];

    const result = filterBySkill(feats, ['arc']);
    expect(result).toEqual([
      expect.objectContaining({ name: 'Arcane Sense' }),
    ]);
  });

  test('handles object-valued PF2E skill config entries', () => {
    global.CONFIG = {
      ...global.CONFIG,
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          arc: { label: 'Arcana' },
          cra: { short: 'Crafting' },
        },
      },
    };

    const feats = [
      {
        ...makeFeat('Arcane Sense', 1, ['skill']),
        system: {
          ...makeFeat('Arcane Sense', 1, ['skill']).system,
          prerequisites: { value: [{ value: 'Trained in Arcana' }] },
        },
      },
    ];

    const result = filterBySkill(feats, ['arc']);
    expect(result).toEqual([
      expect.objectContaining({ name: 'Arcane Sense' }),
    ]);
  });

  test('filterByGeneralSkillFeats hides skill feats when disabled', () => {
    const feats = [
      makeFeat('Toughness', 1, ['general']),
      makeFeat('Battle Medicine', 1, ['general', 'skill']),
      makeFeat('Arcane Sense', 1, ['skill']),
    ];

    expect(filterByGeneralSkillFeats(feats, false)).toEqual([
      expect.objectContaining({ name: 'Toughness' }),
    ]);

    expect(filterByGeneralSkillFeats(feats, true)).toEqual(feats);
  });

  test('filterByArchetypeRestrictions blocks same-class dedications', () => {
    const actor = { class: { slug: 'wizard' } };
    const feats = [
      makeFeat('Wizard Dedication', 2, ['archetype', 'dedication', 'multiclass']),
      makeFeat('Fighter Dedication', 2, ['archetype', 'dedication', 'multiclass']),
      makeFeat('Medic Dedication', 2, ['archetype', 'dedication']),
    ];
    feats[0].slug = 'wizard-dedication';
    feats[1].slug = 'fighter-dedication';
    feats[2].slug = 'medic-dedication';

    const result = filterByArchetypeRestrictions(feats, actor, { classSlug: 'wizard', classArchetypeDedications: new Set() });
    expect(result).toEqual([
      expect.objectContaining({ name: 'Fighter Dedication' }),
      expect.objectContaining({ name: 'Medic Dedication' }),
    ]);
  });

  test('filterByArchetypeRestrictions blocks new class archetype dedications when one already exists', () => {
    const actor = { class: { slug: 'fighter' } };
    const feats = [
      makeFeat('Spellshot Dedication', 2, ['archetype', 'dedication', 'class']),
      makeFeat('Runelord Dedication', 2, ['archetype', 'dedication', 'class']),
      makeFeat('Basic Spellshot Feat', 4, ['archetype', 'class']),
    ];
    feats[0].slug = 'spellshot-dedication';
    feats[1].slug = 'runelord-dedication';
    feats[2].slug = 'basic-spellshot-feat';

    const result = filterByArchetypeRestrictions(feats, actor, {
      classSlug: 'fighter',
      classArchetypeDedications: new Set(['spellshot-dedication']),
    });

    expect(result).toEqual([
      expect.objectContaining({ name: 'Spellshot Dedication' }),
      expect.objectContaining({ name: 'Basic Spellshot Feat' }),
    ]);
  });

  test('filterByArchetypeRestrictions still allows multiclass and normal archetypes when a class archetype exists', () => {
    const actor = { class: { slug: 'fighter' } };
    const feats = [
      makeFeat('Spellshot Dedication', 2, ['archetype', 'dedication', 'class']),
      makeFeat('Cleric Dedication', 2, ['archetype', 'dedication', 'multiclass']),
      makeFeat('Medic Dedication', 2, ['archetype', 'dedication']),
    ];
    feats[0].slug = 'spellshot-dedication';
    feats[1].slug = 'cleric-dedication';
    feats[2].slug = 'medic-dedication';

    const result = filterByArchetypeRestrictions(feats, actor, {
      classSlug: 'fighter',
      classArchetypeDedications: new Set(['spellshot-dedication']),
    });

    expect(result).toEqual([
      expect.objectContaining({ name: 'Spellshot Dedication' }),
      expect.objectContaining({ name: 'Cleric Dedication' }),
      expect.objectContaining({ name: 'Medic Dedication' }),
    ]);
  });

  test('collectAdditionalArchetypeFeatLevels parses the lowest listed archetype feat level from dedication text', async () => {
    const feats = [
      {
        ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']),
        system: {
          ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']).system,
          description: {
            value: '<p>Additional Feats: 4th Twin Takedown, 12th Twin Riposte, 16th Improved Twin Riposte</p>',
          },
        },
      },
    ];

    const result = await collectAdditionalArchetypeFeatLevels(feats, new Set(['avenger-dedication']));
    expect(result.get('twin-takedown')).toBe(4);
    expect(result.get('twin-riposte')).toBe(12);
    expect(result.get('improved-twin-riposte')).toBe(16);
  });

  test('collectAdditionalArchetypeFeatLevels prefers @UUID-linked additional feats when present', async () => {
    const feats = [
      {
        ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']),
        system: {
          ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']).system,
          description: {
            value: '<p><strong>Additional Feats:</strong> 4th @UUID[Compendium.pf2e.feats-srd.Item.twin-takedown]{Twin Takedown}, 6th @UUID[Compendium.pf2e.feats-srd.Item.twin-parry]{Twin Parry}</p>',
          },
        },
      },
    ];

    const result = await collectAdditionalArchetypeFeatLevels(feats, new Set(['avenger-dedication']));
    expect(result.get('twin-takedown')).toBe(4);
    expect(result.get('twin-parry')).toBe(6);
  });

  test('collectAdditionalArchetypeFeatLevels can parse Additional Feats from a linked journal entry', async () => {
    const feats = [
      {
        ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']),
        system: {
          ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']).system,
          description: {
            value: '<p>See @UUID[Compendium.pf2e.journals.JournalEntry.vx5FGEG34AxI2dow]{Avenger} for details.</p>',
          },
        },
      },
    ];

    const resolver = jest.fn(async (uuid) => ({
      uuid,
      pages: [
        {
          text: {
            content: '<p><strong>Additional Feats:</strong> 4th @UUID[Compendium.pf2e.feats-srd.Item.twin-takedown]{Twin Takedown}, 6th @UUID[Compendium.pf2e.feats-srd.Item.twin-parry]{Twin Parry}</p>',
          },
        },
      ],
    }));

    const result = await collectAdditionalArchetypeFeatLevels(
      feats,
      new Set(['avenger-dedication']),
      { documentResolver: resolver },
    );

    expect(resolver).toHaveBeenCalledWith('Compendium.pf2e.journals.JournalEntry.vx5FGEG34AxI2dow');
    expect(result.get('twin-takedown')).toBe(4);
    expect(result.get('twin-parry')).toBe(6);
  });

  test('collectAdditionalArchetypeFeatLevels parses journal Additional Feats from content-link data-uuid anchors', async () => {
    const feats = [
      {
        ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']),
        system: {
          ...makeFeat('Avenger Dedication', 2, ['archetype', 'dedication']).system,
          description: {
            value: '<p>See @UUID[Compendium.pf2e.journals.JournalEntry.vx5FGEG34AxI2dow]{Avenger} for details.</p>',
          },
        },
      },
    ];

    const resolver = jest.fn(async (uuid) => ({
      uuid,
      pages: [
        {
          text: {
            content: '<p><strong>Additional Feats:</strong> <strong>4th</strong> <a class="content-link" data-uuid="Compendium.pf2e.feats-srd.Item.Gw0wGXikhAhiGoud">Twin Takedown</a>; <strong>6th</strong> <a class="content-link" data-uuid="Compendium.pf2e.feats-srd.Item.Y8LHfkzGyOhPlUou">Twin Parry</a>; <strong>12th</strong> <a class="content-link" data-uuid="Compendium.pf2e.feats-srd.Item.GJIAecRq1bD2r8O0">Twin Riposte</a></p>',
          },
        },
      ],
    }));

    const result = await collectAdditionalArchetypeFeatLevels(
      feats,
      new Set(['avenger-dedication']),
      { documentResolver: resolver },
    );

    expect(result.get('twin-takedown')).toBe(4);
    expect(result.get('twin-parry')).toBe(6);
    expect(result.get('twin-riposte')).toBe(12);
  });
});

describe('filterBySearch', () => {
  const feats = [
    makeFeat('Quick Bomber', 1, ['alchemist']),
    makeFeat('Battle Medicine', 1, ['skill']),
    makeFeat('Fighter Dedication', 2, ['archetype', 'dedication']),
  ];

  test('filters by name', () => {
    const result = filterBySearch(feats, 'quick');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Quick Bomber');
  });

  test('also filters by traits', () => {
    const result = filterBySearch(feats, 'archetype');
    expect(result).toEqual([
      expect.objectContaining({ name: 'Fighter Dedication' }),
    ]);
  });

  test('returns all for empty search', () => {
    expect(filterBySearch(feats, '')).toHaveLength(3);
    expect(filterBySearch(feats, null)).toHaveLength(3);
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
