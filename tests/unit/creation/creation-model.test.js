import {
  createCreationData,
  getCreationLoreSkillNames,
  setClass,
  setDualClass,
  setFeatChoice,
  setSubconsciousMind,
} from '../../../scripts/creation/creation-model.js';

describe('creation Lore skills', () => {
  test('combines granted and selected Lore skills without duplicates', () => {
    expect(getCreationLoreSkillNames({
      lores: ['Legal Lore'],
      selectedLoreSkills: ['Sailing Lore', 'legal lore'],
    })).toEqual(['Legal Lore', 'Sailing Lore']);
  });
});

describe('dual class boost state', () => {
  test('clears stale boost selections when either class changes', () => {
    const data = createCreationData();
    setClass(data, { uuid: 'ranger', name: 'Ranger', slug: 'ranger' });
    setDualClass(data, { uuid: 'monk', name: 'Monk', slug: 'monk' });
    data.boosts.class = ['str'];
    data.boosts.dualClass = ['dex'];

    setDualClass(data, { uuid: 'fighter', name: 'Fighter', slug: 'fighter' });
    expect(data.boosts.class).toEqual(['str']);
    expect(data.boosts.dualClass).toBeUndefined();

    data.boosts.dualClass = ['str'];
    setClass(data, { uuid: 'wizard', name: 'Wizard', slug: 'wizard' });
    expect(data.boosts.class).toBeUndefined();
    expect(data.boosts.dualClass).toBeUndefined();
  });

  test('stores a dual psychic subconscious mind key ability in the dual class bucket', () => {
    const data = createCreationData();
    data.dualClass = { uuid: 'psychic', name: 'Psychic', slug: 'psychic' };

    setSubconsciousMind(
      data,
      {
        uuid: 'gathered-lore',
        name: 'Gathered Lore',
        slug: 'gathered-lore',
        keyAbility: 'int',
      },
      'dualClass',
    );

    expect(data.boosts.dualClass).toEqual(['int']);
    expect(data.boosts.class).toBeUndefined();
  });
});

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
