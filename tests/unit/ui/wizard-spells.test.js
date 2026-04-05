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
});
