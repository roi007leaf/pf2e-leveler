import { buildSpellContext } from '../../../scripts/ui/level-planner/spells.js';

jest.mock('../../../scripts/plan/build-state.js', () => ({
  computeBuildState: jest.fn(() => ({ feats: new Set() })),
}));

jest.mock('../../../scripts/plan/plan-model.js', () => ({
  getLevelData: jest.fn(() => ({ spells: [] })),
}));

jest.mock('../../../scripts/data/subclass-spells.js', () => ({
  SUBCLASS_SPELLS: {},
  resolveSubclassSpells: jest.fn(() => null),
}));

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
});
