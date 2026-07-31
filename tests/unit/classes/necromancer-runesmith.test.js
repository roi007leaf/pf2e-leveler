import { getChoicesForLevel } from '../../../scripts/classes/progression.js';
import { NECROMANCER } from '../../../scripts/classes/necromancer.js';
import {
  getRunicRepertoireAtLevel,
  getRunicRepertoireIncrease,
  RUNESMITH,
} from '../../../scripts/classes/runesmith.js';

describe('Necromancer class definition', () => {
  test('uses the occult prepared two-slot progression', () => {
    expect(NECROMANCER).toEqual(
      expect.objectContaining({
        slug: 'necromancer',
        keyAbility: ['int'],
        hp: 8,
        trainedSkills: {
          fixed: ['occultism'],
          additional: 2,
        },
        spellcasting: expect.objectContaining({
          tradition: 'occult',
          type: 'prepared',
        }),
      }),
    );
    expect(NECROMANCER.spellcasting.slots[1]).toEqual({ cantrips: 5, 1: 1 });
    expect(NECROMANCER.spellcasting.slots[10]).toEqual({
      cantrips: 5,
      1: 2,
      2: 2,
      3: 2,
      4: 2,
      5: 2,
    });
    expect(NECROMANCER.spellcasting.slots[19][10]).toBe(1);
  });
});

describe('Runesmith class definition', () => {
  test('includes its level-1 class feat and core advancement schedules', () => {
    expect(RUNESMITH).toEqual(
      expect.objectContaining({
        slug: 'runesmith',
        keyAbility: ['int'],
        hp: 8,
        trainedSkills: {
          fixed: ['crafting'],
          additional: 2,
        },
      }),
    );
    expect(getChoicesForLevel(RUNESMITH, 1)).toContainEqual({ type: 'classFeat' });
    expect(getChoicesForLevel(RUNESMITH, 5)).toEqual(
      expect.arrayContaining([
        { type: 'abilityBoosts', count: 4 },
        { type: 'ancestryFeat' },
        { type: 'skillIncrease' },
      ]),
    );
  });

  test('tracks current repertoire limits and exact increase levels', () => {
    expect(getRunicRepertoireAtLevel(RUNESMITH, 4)).toEqual({
      known: 4,
      etched: 2,
    });
    expect(getRunicRepertoireAtLevel(RUNESMITH, 13)).toEqual({
      known: 10,
      etched: 5,
    });
    expect(getRunicRepertoireIncrease(RUNESMITH, 8)).toBeNull();
    expect(getRunicRepertoireIncrease(RUNESMITH, 9)).toEqual({
      known: 8,
      etched: 4,
    });
  });
});
