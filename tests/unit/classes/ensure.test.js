import {
  ensureActorClassRegistered,
  ensureClassRegistry,
} from '../../../scripts/classes/ensure.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';

describe('class registry ensure helpers', () => {
  beforeEach(() => {
    ClassRegistry.clear();
  });

  test('loads Starfinder Player Core classes into the default registry', () => {
    ensureClassRegistry();

    expect(ClassRegistry.getSlugs()).toEqual(
      expect.arrayContaining([
        'envoy',
        'mystic',
        'operative',
        'solarian',
        'soldier',
        'witchwarper',
      ]),
    );
    expect(ClassRegistry.get('witchwarper')).toEqual(
      expect.objectContaining({
        keyAbility: ['cha', 'int'],
        hp: 8,
        spellcasting: expect.objectContaining({
          tradition: 'paradox',
          type: 'spontaneous',
        }),
      }),
    );
    expect(ClassRegistry.get('envoy')).toEqual(
      expect.objectContaining({
        featSchedule: expect.objectContaining({
          class: expect.arrayContaining([1, 2, 20]),
        }),
        skillIncreaseSchedule: expect.arrayContaining([2, 10, 20]),
      }),
    );
  });

  test('loads PF2e 8.4 Necromancer and Runesmith classes', () => {
    ensureClassRegistry();

    expect(ClassRegistry.get('necromancer')?.compendiumUuid).toBe(
      'Compendium.pf2e.classes.Item.x0vpqoK830wozKMH',
    );
    expect(ClassRegistry.get('runesmith')?.compendiumUuid).toBe(
      'Compendium.pf2e.classes.Item.5RK0O6eiijmC7NmA',
    );
  });

  test('registers Mystic actor classes with spellcasting progression', () => {
    const actor = {
      class: {
        name: 'Mystic',
        slug: 'mystic',
        type: 'class',
        sourceId: 'Compendium.sf2e-anachronism.classes.Item.FYCUzPaaCU4G66Wz',
        system: {
          ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
          classFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          generalFeatLevels: { value: [3, 7, 11, 15, 19] },
          hp: 6,
          keyAbility: { value: ['wis'] },
          skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
          spellcasting: 1,
          trainedSkills: { additional: 3, value: [] },
          slug: 'mystic',
        },
      },
    };

    const classDef = ensureActorClassRegistered(actor);

    expect(classDef).toEqual(
      expect.objectContaining({
        slug: 'mystic',
        keyAbility: ['wis'],
        hp: 6,
        spellcasting: expect.objectContaining({
          tradition: 'connection',
          type: 'spontaneous',
        }),
      }),
    );
    expect(classDef.spellcasting.slots[3]).toEqual({ cantrips: 5, 1: 4, 2: 3 });
  });
});
