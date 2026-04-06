export const DAREDEVIL = {
  slug: 'daredevil',
  nameKey: 'PF2E_LEVELER.DAREDEVIL.NAME',
  compendiumUuid: null,
  keyAbility: ['str', 'dex'],
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
    { level: 3, name: 'Deny Advantage', key: 'deny-advantage' },
    { level: 3, name: 'Galvanized Mobility', key: 'galvanized-mobility' },
    { level: 3, name: 'Will Expertise', key: 'will-expertise' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: 'Evasive Reflexes', key: 'evasive-reflexes' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 9, name: 'Stunt Flexibility', key: 'stunt-flexibility' },
    { level: 11, name: 'Daredevil Expertise', key: 'daredevil-expertise' },
    { level: 13, name: 'Light Armor Expertise', key: 'light-armor-expertise' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Improved Stunt Flexibility', key: 'improved-stunt-flexibility' },
    { level: 17, name: "Daredevil's Fortitude", key: 'daredevils-fortitude' },
    { level: 19, name: 'Enduring Adrenaline', key: 'enduring-adrenaline' },
    { level: 19, name: 'Light Armor Mastery', key: 'light-armor-mastery' },
  ],

  spellcasting: null,
};
