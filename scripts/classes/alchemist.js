export const ALCHEMIST = {
  slug: 'alchemist',
  nameKey: 'PF2E_LEVELER.ALCHEMIST.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Alchemist',
  keyAbility: ['int'],
  hp: 8,

  featSchedule: {
    class: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 5, name: 'Field Discovery', key: 'field-discovery' },
    { level: 5, name: 'Powerful Alchemy', key: 'powerful-alchemy' },
    { level: 7, name: 'Alchemical Weapon Expertise', key: 'alchemical-weapon-expertise' },
    { level: 7, name: 'Will Expertise', key: 'will-expertise' },
    { level: 9, name: 'Alchemical Expertise', key: 'alchemical-expertise' },
    { level: 9, name: 'Double Brew', key: 'double-brew' },
    { level: 9, name: 'Perception Expertise', key: 'perception-expertise' },
    { level: 11, name: 'Advanced Vials', key: 'advanced-vials' },
    { level: 11, name: 'Chemical Hardiness', key: 'chemical-hardiness' },
    { level: 13, name: 'Greater Field Discovery', key: 'greater-field-discovery' },
    { level: 13, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 13, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 15, name: 'Alchemical Weapon Mastery', key: 'alchemical-weapon-mastery' },
    { level: 15, name: 'Explosion Dodger', key: 'explosion-dodger' },
    { level: 17, name: 'Abundant Vials', key: 'abundant-vials' },
    { level: 17, name: 'Alchemical Mastery', key: 'alchemical-mastery' },
    { level: 19, name: 'Medium Armor Mastery', key: 'medium-armor-mastery' },
  ],

  spellcasting: null,
};
