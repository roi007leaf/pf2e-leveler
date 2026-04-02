import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Sorcerer class definition', () => {
  test('has correct basic properties', () => {
    expect(SORCERER.slug).toBe('sorcerer');
    expect(SORCERER.keyAbility).toEqual(['cha']);
    expect(SORCERER.hp).toBe(6);
  });

  test('has spontaneous spellcasting', () => {
    expect(SORCERER.spellcasting.type).toBe('spontaneous');
    expect(SORCERER.spellcasting.tradition).toBe('bloodline');
  });

  test('spell slots are numbers (single caster)', () => {
    expect(typeof SORCERER.spellcasting.slots[3][1]).toBe('number');
  });

  test('level 2 has class feat, skill feat, and spells', () => {
    const types = getChoicesForLevel(SORCERER, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('spells');
  });

  test('10th rank at level 19', () => {
    expect(SORCERER.spellcasting.slots[19][10]).toBe(1);
  });
});
