import { MAGUS } from '../../../scripts/classes/magus.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Magus class definition', () => {
  test('has correct basic properties', () => {
    expect(MAGUS.slug).toBe('magus');
    expect(MAGUS.keyAbility).toEqual(['str', 'dex']);
    expect(MAGUS.hp).toBe(8);
  });

  test('has prepared arcane spellcasting', () => {
    expect(MAGUS.spellcasting.tradition).toBe('arcane');
    expect(MAGUS.spellcasting.type).toBe('prepared');
  });

  test('bounded caster - slots shift upward', () => {
    expect(MAGUS.spellcasting.slots[5][1]).toBeUndefined();
    expect(MAGUS.spellcasting.slots[5][2]).toBe(2);
    expect(MAGUS.spellcasting.slots[5][3]).toBe(2);
  });

  test('tops out at 9th rank', () => {
    expect(MAGUS.spellcasting.slots[17][9]).toBe(2);
    expect(MAGUS.spellcasting.slots[19][10]).toBeUndefined();
  });

  test('level 2 has class feat, skill feat, and spells', () => {
    const types = getChoicesForLevel(MAGUS, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('spells');
  });
});
