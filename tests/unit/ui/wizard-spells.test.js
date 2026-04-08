import { buildSpellContext } from '../../../scripts/ui/character-wizard/spells.js';

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: { get: jest.fn() },
}));

const { ClassRegistry } = jest.requireMock('../../../scripts/classes/registry.js');

describe('buildSpellContext', () => {
  it('limits wizard character creation spell options to common spells', async () => {
    ClassRegistry.get.mockReturnValue({
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          1: {
            cantrips: 5,
            1: 2,
          },
        },
      },
    });

    const wizard = {
      data: {
        class: { slug: 'wizard' },
        subclass: {},
        spells: { cantrips: [], rank1: [] },
      },
      classHandler: {
        needsNonCasterSpellStep: () => false,
        getSpellbookCounts: () => null,
        resolveGrantedSpells: async () => ({ cantrips: [], rank1s: [] }),
        resolveFocusSpells: async () => [],
        isFocusSpellChoice: () => false,
        getSpellContext: async () => ({}),
      },
      _isCaster: () => true,
      _loadCompendiumCategory: async () => ([
        {
          uuid: 'common-cantrip',
          name: 'Detect Magic',
          level: 0,
          rarity: 'common',
          traditions: ['arcane'],
          traits: ['cantrip', 'concentrate', 'detection', 'manipulate'],
        },
        {
          uuid: 'uncommon-cantrip',
          name: 'Ancient Dust',
          level: 0,
          rarity: 'uncommon',
          traditions: ['arcane'],
          traits: ['cantrip', 'concentrate', 'void'],
        },
        {
          uuid: 'common-rank1',
          name: 'Mystic Armor',
          level: 1,
          rarity: 'common',
          traditions: ['arcane'],
          traits: ['concentrate', 'manipulate'],
        },
        {
          uuid: 'rare-rank1',
          name: 'Impossible Spell',
          level: 1,
          rarity: 'rare',
          traditions: ['arcane'],
          traits: ['concentrate', 'manipulate'],
        },
      ]),
    };

    const context = await buildSpellContext(wizard);

    expect(context.showSpellRarityFilters).toBe(false);
    expect(context.cantrips.map((spell) => spell.uuid)).toEqual(['common-cantrip']);
    expect(context.rank1Spells.map((spell) => spell.uuid)).toEqual(['common-rank1']);
  });

  it('uses category-aware spell loading so custom spell compendiums can contribute options', async () => {
    ClassRegistry.get.mockReturnValue({
      slug: 'sorcerer',
      spellcasting: {
        tradition: 'arcane',
        type: 'spontaneous',
        slots: {
          1: {
            cantrips: 5,
            1: 2,
          },
        },
      },
    });

    const wizard = {
      data: {
        class: { slug: 'sorcerer' },
        subclass: { tradition: 'arcane' },
        spells: { cantrips: [], rank1: [] },
      },
      classHandler: {
        needsNonCasterSpellStep: () => false,
        getSpellbookCounts: () => null,
        resolveGrantedSpells: async () => ({ cantrips: [], rank1s: [] }),
        resolveFocusSpells: async () => [],
        isFocusSpellChoice: () => false,
        getSpellContext: async () => ({}),
      },
      _isCaster: () => true,
      _loadCompendiumCategory: jest.fn(async (category) => {
        if (category !== 'spells') return [];
        return [
          {
            uuid: 'custom-cantrip',
            name: 'Custom Arcane Spark',
            level: 0,
            rarity: 'common',
            traditions: ['arcane'],
            traits: ['cantrip', 'concentrate'],
          },
        ];
      }),
    };

    const context = await buildSpellContext(wizard);

    expect(wizard._loadCompendiumCategory).toHaveBeenCalledWith('spells');
    expect(context.cantrips.map((spell) => spell.uuid)).toContain('custom-cantrip');
  });

  it('shows psychic psi cantrips as focus cantrips and keeps them out of regular cantrip choices', async () => {
    ClassRegistry.get.mockReturnValue({
      slug: 'psychic',
      spellcasting: {
        tradition: 'occult',
        type: 'spontaneous',
        slots: {
          1: {
            cantrips: 3,
            1: 2,
          },
        },
      },
    });

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      system: {
        traits: {
          value: ['cantrip', 'focus'],
        },
      },
    }));

    const wizard = {
      data: {
        class: { slug: 'psychic' },
        subclass: { slug: 'the-infinite-eye', name: 'The Infinite Eye' },
        spells: { cantrips: [], rank1: [] },
      },
      classHandler: {
        needsNonCasterSpellStep: () => false,
        getSpellbookCounts: () => ({ cantrips: 3, rank1: 2 }),
        resolveGrantedSpells: async () => ({ cantrips: [], rank1s: [{ uuid: 'sure-strike', name: 'Sure Strike' }] }),
        resolveFocusSpells: async () => ([
          { uuid: 'detect-magic', name: 'Detect Magic' },
          { uuid: 'guidance', name: 'Guidance' },
          { uuid: 'glimpse-weakness', name: 'Glimpse Weakness' },
        ]),
        isFocusSpellChoice: () => false,
        getSpellContext: async () => ({}),
      },
      _isCaster: () => true,
      _loadCompendiumCategory: async () => ([
        {
          uuid: 'detect-magic',
          name: 'Detect Magic',
          level: 0,
          rarity: 'common',
          traditions: ['occult'],
          traits: ['cantrip', 'focus'],
        },
        {
          uuid: 'guidance',
          name: 'Guidance',
          level: 0,
          rarity: 'common',
          traditions: ['occult'],
          traits: ['cantrip', 'focus'],
        },
        {
          uuid: 'glimpse-weakness',
          name: 'Glimpse Weakness',
          level: 0,
          rarity: 'common',
          traditions: ['occult'],
          traits: ['cantrip', 'focus'],
        },
        {
          uuid: 'message',
          name: 'Message',
          level: 0,
          rarity: 'common',
          traditions: ['occult'],
          traits: ['cantrip'],
        },
      ]),
    };

    const context = await buildSpellContext(wizard);

    expect(context.maxCantrips).toBe(3);
    expect(context.cantrips.map((spell) => spell.uuid)).toEqual(['message']);
    expect(context.focusCantrips.map((spell) => spell.uuid)).toEqual(['detect-magic', 'guidance', 'glimpse-weakness']);
    expect(context.grantedCantrips).toEqual([]);
  });

  it('keeps witch focus cantrips selectable when the class requires a focus-spell choice', async () => {
    ClassRegistry.get.mockReturnValue({
      slug: 'witch',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          1: {
            cantrips: 5,
            1: 2,
          },
        },
      },
    });

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      system: {
        traits: {
          value: ['cantrip', 'focus'],
        },
      },
    }));

    const wizard = {
      data: {
        class: { slug: 'witch' },
        subclass: { tradition: 'arcane' },
        devotionSpell: { uuid: 'phase-familiar', name: 'Phase Familiar' },
        spells: { cantrips: [], rank1: [] },
      },
      classHandler: {
        needsNonCasterSpellStep: () => false,
        getSpellbookCounts: () => ({ cantrips: 11, rank1: 6 }),
        resolveGrantedSpells: async () => ({ cantrips: [], rank1s: [] }),
        resolveFocusSpells: async () => ([
          { uuid: 'patrons-puppet', name: "Patron's Puppet" },
          { uuid: 'phase-familiar', name: 'Phase Familiar' },
        ]),
        isFocusSpellChoice: () => true,
        buildFocusContext: (data, focusSpells) => ({
          focusSpells: focusSpells.map((spell) => ({
            ...spell,
            selected: spell.uuid === data.devotionSpell?.uuid,
          })),
          isDevotionChoice: true,
        }),
        getSpellContext: async () => ({}),
      },
      _isCaster: () => true,
      _loadCompendiumCategory: async () => ([]),
    };

    const context = await buildSpellContext(wizard);

    expect(context.isDevotionChoice).toBe(true);
    expect(context.focusCantrips).toEqual([]);
    expect(context.focusNonCantrips.map((spell) => spell.uuid)).toEqual(['patrons-puppet', 'phase-familiar']);
    expect(context.focusNonCantrips.find((spell) => spell.uuid === 'phase-familiar')?.selected).toBe(true);
  });
});
