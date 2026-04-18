import { createCreationData, setFeatChoice } from '../../../scripts/creation/creation-model.js';

describe('setFeatChoice', () => {
  test('mirrors granted Runelord sin curriculum choices onto the dual subclass state', () => {
    const data = createCreationData();
    data.dualSubclass = {
      slug: 'runelord',
      name: 'Runelord',
      choiceCurricula: {},
    };
    data.dualCurriculumSpells = {
      cantrips: [{ uuid: 'stale-cantrip', name: 'Old Spell' }],
      rank1: [{ uuid: 'stale-rank1', name: 'Old Rank 1' }],
    };

    setFeatChoice(data, 'dual-grant', 'sin', 'envy', {
      target: 'dualClass',
      curriculum: {
        0: ['Compendium.pf2e.spells-srd.Item.Shield'],
        1: ['Compendium.pf2e.spells-srd.Item.Schadenfreude'],
      },
    });

    expect(data.grantedFeatChoices['dual-grant']).toEqual({ sin: 'envy' });
    expect(data.dualSubclass.choiceCurricula).toEqual({
      sin: {
        0: ['Compendium.pf2e.spells-srd.Item.Shield'],
        1: ['Compendium.pf2e.spells-srd.Item.Schadenfreude'],
      },
    });
    expect(data.dualCurriculumSpells).toEqual({ cantrips: [], rank1: [] });
  });
});
