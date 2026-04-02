import { DRUID } from '../../../scripts/classes/druid.js';
import { getChoicesForLevel } from '../../../scripts/classes/progression.js';

describe('Druid class definition', () => {
  test('has correct basic properties', () => {
    expect(DRUID.slug).toBe('druid');
    expect(DRUID.keyAbility).toEqual(['wis']);
    expect(DRUID.hp).toBe(8);
  });

  test('has prepared primal spellcasting', () => {
    expect(DRUID.spellcasting.tradition).toBe('primal');
    expect(DRUID.spellcasting.type).toBe('prepared');
  });

  test('level 2 has class feat, skill feat, and spells', () => {
    const types = getChoicesForLevel(DRUID, 2).map((c) => c.type);
    expect(types).toContain('classFeat');
    expect(types).toContain('spells');
  });

  test('10th rank at level 19', () => {
    expect(DRUID.spellcasting.slots[19][10]).toBe(1);
  });
});
