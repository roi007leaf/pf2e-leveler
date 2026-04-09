import { buildSpellContext, buildSpellSlotDisplay, shouldExcludeOwnedSpellIdentityForPlanner } from '../../../scripts/ui/level-planner/spells.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { DRUID } from '../../../scripts/classes/druid.js';

jest.mock('../../../scripts/plan/build-state.js', () => ({
  computeBuildState: jest.fn(() => ({ feats: new Set() })),
}));

jest.mock('../../../scripts/plan/plan-model.js', () => ({
  getLevelData: jest.fn(() => ({ spells: [] })),
  getAllPlannedFeats: jest.fn((plan, upToLevel = 20) => {
    const feats = [];
    const featKeys = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
    for (let level = 1; level <= upToLevel; level++) {
      const levelData = plan?.levels?.[level];
      if (!levelData) continue;
      for (const key of featKeys) {
        feats.push(...(levelData[key] ?? []));
      }
    }
    return feats;
  }),
  getPlanApparitions: jest.fn(() => []),
}));

jest.mock('../../../scripts/data/subclass-spells.js', () => ({
  SUBCLASS_SPELLS: {},
  resolveSubclassSpells: jest.fn(() => null),
}));

const { resolveSubclassSpells } = jest.requireMock('../../../scripts/data/subclass-spells.js');
const { getLevelData } = jest.requireMock('../../../scripts/plan/plan-model.js');

beforeAll(() => {
  if (!ClassRegistry.get('druid')) {
    ClassRegistry.register(DRUID);
  }
});

describe('level planner spell context', () => {
  test('wizard uses spellbook selections instead of spontaneous slot picks', async () => {
    const planner = {
      actor: { items: [] },
      plan: { classSlug: 'wizard' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          1: { cantrips: 5, 1: 2 },
          2: { cantrips: 5, 1: 3 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 2);

    expect(context.isSpontaneous).toBe(false);
    expect(context.hasRankSpellSelections).toBe(false);
    expect(context.hasSpellbook).toBe(true);
    expect(context.spellbookSelectionCount).toBe(2);
    expect(context.highestRank).toBe(1);
  });

  test('spontaneous casters still use rank-based spell picks', async () => {
    const planner = {
      actor: { items: [] },
      plan: { classSlug: 'sorcerer' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'sorcerer',
      spellcasting: {
        tradition: 'arcane',
        type: 'spontaneous',
        slots: {
          1: { cantrips: 5, 1: 2 },
          2: { cantrips: 5, 1: 3 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 2);

    expect(context.isSpontaneous).toBe(true);
    expect(context.hasRankSpellSelections).toBe(true);
    expect(context.hasSpellbook).toBe(false);
  });

  test('new-rank granted spells reduce spontaneous free picks', async () => {
    resolveSubclassSpells.mockReturnValueOnce({ grantedSpell: 'granted-rank-2' });
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Granted Spell',
      img: 'icons/svg/mystery-man.svg',
    }));

    const planner = {
      actor: {
        items: [
          {
            type: 'feat',
            slug: 'bloodline-diabolic',
            flags: { pf2e: { rulesSelections: { genie: 'ifrit' } } },
            system: { traits: { otherTags: ['sorcerer-bloodline'] } },
          },
        ],
      },
      plan: { classSlug: 'sorcerer' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'sorcerer',
      spellcasting: {
        tradition: 'bloodline',
        type: 'spontaneous',
        slots: {
          2: { cantrips: 5, 1: 4 },
          3: { cantrips: 5, 1: 4, 2: 3 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 3);
    const rankTwo = context.spellSlots.find((slot) => slot.rankNum === 2);

    expect(resolveSubclassSpells).toHaveBeenCalledWith('bloodline-diabolic', { genie: 'ifrit' }, 2);
    expect(rankTwo.gainedSlots).toBe(3);
    expect(rankTwo.grantedCount).toBe(1);
    expect(rankTwo.newSlots).toBe(2);
  });

  test('buildSpellSlotDisplay subtracts granted spells from new spontaneous picks', () => {
    const planner = { _ordinalRank: (rank) => `${rank}th` };
    const display = buildSpellSlotDisplay(
      planner,
      { cantrips: 5, 1: 4, 2: 3 },
      { cantrips: 5, 1: 4 },
      [],
      [{ uuid: 'x', rank: 2 }],
    );

    expect(display.find((slot) => slot.rankNum === 2)).toEqual(expect.objectContaining({
      gainedSlots: 3,
      grantedCount: 1,
      newSlots: 2,
    }));
  });

  test('passes subclass rule selections when resolving genie bloodline spells', async () => {
    resolveSubclassSpells.mockReturnValueOnce({ grantedSpell: 'granted-rank-5' });
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Granted Spell',
      img: 'icons/svg/mystery-man.svg',
    }));

    const planner = {
      actor: {
        items: [
          {
            type: 'feat',
            slug: 'bloodline-genie',
            flags: { pf2e: { rulesSelections: { genie: 'ifrit' } } },
            system: { traits: { otherTags: ['sorcerer-bloodline'] } },
          },
        ],
      },
      plan: { classSlug: 'sorcerer' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'sorcerer',
      spellcasting: {
        tradition: 'bloodline',
        type: 'spontaneous',
        slots: {
          4: { cantrips: 5, 1: 4, 2: 4, 3: 4, 4: 4 },
          5: { cantrips: 5, 1: 4, 2: 4, 3: 4, 4: 4, 5: 3 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 5);

    expect(resolveSubclassSpells).toHaveBeenCalledWith('bloodline-genie', { genie: 'ifrit' }, 5);
    expect(context.grantedSpells).toEqual([
      expect.objectContaining({ uuid: 'granted-rank-5', rank: 5 }),
    ]);
  });

  test('spellbook planned spells use base rank when stored rank is any-rank sentinel', async () => {
    getLevelData.mockReturnValueOnce({
      spells: [
        {
          uuid: 'spell-1',
          name: 'Acid Grip',
          img: 'icons/svg/mystery-man.svg',
          rank: -1,
          baseRank: 2,
        },
      ],
    });

    const planner = {
      actor: { items: [] },
      plan: { classSlug: 'wizard' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          2: { cantrips: 5, 1: 3, 2: 2 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 2);

    expect(context.plannedSpells).toEqual([
      expect.objectContaining({
        rank: -1,
        baseRank: 2,
        displayRank: 2,
      }),
    ]);
  });

  test('new spell ranks show a custom-plan reminder for non-spellbook casters', async () => {
    const planner = {
      actor: { items: [] },
      plan: { classSlug: 'sorcerer' },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'sorcerer',
      spellcasting: {
        tradition: 'arcane',
        type: 'spontaneous',
        slots: {
          2: { cantrips: 5, 1: 4 },
          3: { cantrips: 5, 1: 4, 2: 3 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 3);

    expect(context.showCustomSpellRankReminder).toBe(true);
  });

  test('spellbook casters track cantrip expansion as two extra cantrip picks', async () => {
    getLevelData.mockReturnValueOnce({
      spells: [
        { uuid: 'spell-rank-1', name: 'Magic Missile', rank: 1, baseRank: 1 },
        { uuid: 'spell-rank-2', name: 'See Invisibility', rank: 2, baseRank: 2 },
        { uuid: 'spell-cantrip', name: 'Shield', rank: 0, isCantrip: true },
      ],
    });

    const planner = {
      actor: { items: [] },
      plan: {
        classSlug: 'wizard',
        levels: {
          3: {
            generalFeats: [{ uuid: 'feat-cantrip-expansion', name: 'Cantrip Expansion', slug: 'cantrip-expansion' }],
          },
        },
      },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          2: { cantrips: 5, 1: 3 },
          3: { cantrips: 5, 1: 3, 2: 2 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 3);

    expect(context.hasSpellbook).toBe(true);
    expect(context.spellbookSelectionCount).toBe(2);
    expect(context.spellbookCantripSelectionCount).toBe(2);
    expect(context.spellbookTotalSelectionCount).toBe(4);
    expect(context.plannedSpellbookSelectionCount).toBe(2);
    expect(context.plannedSpellbookCantripCount).toBe(1);
  });

  test('prepared spellbook classes exclude already known spells by identity in planner picks', () => {
    expect(shouldExcludeOwnedSpellIdentityForPlanner({
      slug: 'wizard',
      spellcasting: { type: 'prepared' },
    })).toBe(true);

    expect(shouldExcludeOwnedSpellIdentityForPlanner({
      slug: 'witch',
      spellcasting: { type: 'prepared' },
    })).toBe(true);

    expect(shouldExcludeOwnedSpellIdentityForPlanner({
      slug: 'sorcerer',
      spellcasting: { type: 'spontaneous' },
    })).toBe(false);
  });

  test('spellbook planner builds a separate dedication spell section for multiclass spellcasting', async () => {
    getLevelData.mockReturnValueOnce({
      spells: [
        { uuid: 'druid-cantrip', name: 'Electric Arc', rank: 0, isCantrip: true, entryType: 'archetype:druid' },
      ],
    });

    const planner = {
      actor: { items: [] },
      plan: {
        classSlug: 'wizard',
        levels: {
          2: {
            archetypeFeats: [{ uuid: 'feat-druid', name: 'Druid Dedication', slug: 'druid-dedication', traits: ['archetype', 'dedication', 'druid', 'multiclass'] }],
          },
          4: {
            archetypeFeats: [{ uuid: 'feat-basic-druid', name: 'Basic Druid Spellcasting', slug: 'basic-druid-spellcasting', traits: ['archetype', 'druid'] }],
          },
        },
      },
      _ordinalRank: (rank) => `${rank}th`,
    };
    const classDef = {
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          4: { cantrips: 5, 1: 3, 2: 2 },
        },
      },
    };

    const context = await buildSpellContext(planner, classDef, 4);

    expect(context.dedicationSpellSections).toEqual([
      expect.objectContaining({
        entryType: 'archetype:druid',
        tradition: 'primal',
        cantripSelectionCount: 0,
        plannedCantripCount: 1,
        rankRows: expect.arrayContaining([
          expect.objectContaining({ rank: 1 }),
        ]),
      }),
    ]);
  });
});
