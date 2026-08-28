import { getAutomaticLoreProficiencies, getChoicesForLevel, getGradualBoostGroupLevels } from '../../../scripts/classes/progression.js';
import { FIGHTER } from '../../../scripts/classes/fighter.js';
import { ROGUE } from '../../../scripts/classes/rogue.js';
import { THAUMATURGE } from '../../../scripts/classes/thaumaturge.js';

describe('getGradualBoostGroupLevels', () => {
  test('returns the first gradual boost set for levels 2 through 5', () => {
    expect(getGradualBoostGroupLevels(2)).toEqual([2, 3, 4, 5]);
    expect(getGradualBoostGroupLevels(5)).toEqual([2, 3, 4, 5]);
  });

  test('returns the second gradual boost set for levels 7 through 10', () => {
    expect(getGradualBoostGroupLevels(7)).toEqual([7, 8, 9, 10]);
    expect(getGradualBoostGroupLevels(10)).toEqual([7, 8, 9, 10]);
  });

  test('returns the third and fourth gradual boost sets at the correct boundaries', () => {
    expect(getGradualBoostGroupLevels(12)).toEqual([12, 13, 14, 15]);
    expect(getGradualBoostGroupLevels(15)).toEqual([12, 13, 14, 15]);
    expect(getGradualBoostGroupLevels(17)).toEqual([17, 18, 19, 20]);
    expect(getGradualBoostGroupLevels(20)).toEqual([17, 18, 19, 20]);
  });

  test('returns an empty list for non-gradual-boost levels', () => {
    expect(getGradualBoostGroupLevels(6)).toEqual([]);
    expect(getGradualBoostGroupLevels(11)).toEqual([]);
    expect(getGradualBoostGroupLevels(16)).toEqual([]);
  });
});

describe('getChoicesForLevel dual class support', () => {
  test('adds secondary rogue skill feat and skill increase benefits without duplicating shared benefits', () => {
    const choices = getChoicesForLevel(FIGHTER, 2, {
      dualClass: true,
      dualClassDef: ROGUE,
    });

    expect(choices).toEqual(expect.arrayContaining([
      { type: 'skillFeat' },
      { type: 'skillIncrease' },
    ]));
    expect(choices.filter((choice) => choice.type === 'skillFeat')).toHaveLength(1);
    expect(choices.filter((choice) => choice.type === 'skillIncrease')).toHaveLength(1);
    expect(choices.filter((choice) => choice.type === 'classFeat')).toHaveLength(1);
    expect(choices.filter((choice) => choice.type === 'dualClassFeat')).toHaveLength(1);
  });
});

describe('additional class skill increases', () => {
  test('adds Thaumaturgic Expertise beside the normal level 9 increase', () => {
    const choices = getChoicesForLevel(THAUMATURGE, 9)
      .filter((choice) => choice.type === 'skillIncrease');

    expect(choices).toEqual([
      { type: 'skillIncrease' },
      {
        type: 'skillIncrease',
        source: 'thaumaturge:thaumaturgic-expertise',
        label: 'Thaumaturgic Expertise',
        allowedSkills: ['arcana', 'nature', 'occultism', 'religion'],
      },
    ]);
  });

  test('keeps a secondary Thaumaturge bonus even when the primary class has a normal increase', () => {
    const choices = getChoicesForLevel(FIGHTER, 9, {
      dualClass: true,
      dualClassDef: THAUMATURGE,
    }).filter((choice) => choice.type === 'skillIncrease');

    expect(choices).toHaveLength(2);
    expect(choices[1]).toEqual(expect.objectContaining({
      source: 'thaumaturge:thaumaturgic-expertise',
    }));
  });
});

describe('Thaumaturge Esoteric Lore progression', () => {
  test('automatically scales Esoteric Lore at its four class thresholds', () => {
    expect(getAutomaticLoreProficiencies(THAUMATURGE, 1)).toEqual([
      expect.objectContaining({ skill: 'esoteric-lore', name: 'Esoteric Lore', rank: 1 }),
    ]);
    expect(getAutomaticLoreProficiencies(THAUMATURGE, 3)[0].rank).toBe(2);
    expect(getAutomaticLoreProficiencies(THAUMATURGE, 7)[0].rank).toBe(3);
    expect(getAutomaticLoreProficiencies(THAUMATURGE, 15)[0].rank).toBe(4);
  });
});
