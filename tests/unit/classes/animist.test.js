import { ANIMIST } from '../../../scripts/classes/animist.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Animist class definition', () => {
  test('has correct basic properties', () => {
    expect(ANIMIST.slug).toBe('animist');
    expect(ANIMIST.keyAbility).toEqual(['wis']);
    expect(ANIMIST.hp).toBe(8);
  });

  test('class feats start at level 2', () => {
    expect(ANIMIST.featSchedule.class[0]).toBe(2);
  });

  test('has dual spellcasting', () => {
    expect(ANIMIST.spellcasting.type).toBe('dual');
    expect(ANIMIST.spellcasting.tradition).toBe('divine');
  });

  test('spell slots include level 1 with arrays', () => {
    expect(ANIMIST.spellcasting.slots[1].cantrips).toEqual([2, 2]);
    expect(ANIMIST.spellcasting.slots[1][1]).toEqual([1, 1]);
  });

  test('apparitions: 13 in list', () => {
    expect(ANIMIST.apparitions.list).toHaveLength(13);
  });

  test('level 2 choices include class feat, skill feat, and spells', () => {
    const types = getChoicesForLevel(ANIMIST, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('skillFeat');
    expect(types).toContain('spells');
  });

  test('free archetype adds archetype feat at level 2', () => {
    const types = getChoicesForLevel(ANIMIST, 2, { freeArchetype: true }).map((c) => c.type);
    expect(types).toContain('archetypeFeat');
  });
});
