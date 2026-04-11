export const INVESTIGATOR = {
  slug: 'investigator',
  nameKey: 'PF2E_LEVELER.INVESTIGATOR.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Investigator',
  keyAbility: ['int'],
  hp: 8,

  featSchedule: {
    class: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 3, name: 'Keen Recollection', key: 'keen-recollection' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: 'Vigilant Senses', key: 'vigilant-senses', proficiencies: { perception: 2 } },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Fortitude Expertise', key: 'fortitude-expertise' },
    { level: 9, name: 'Investigator Expertise', key: 'investigator-expertise', proficiencies: { classdc: 2 } },
    { level: 11, name: 'Deductive Improvisation', key: 'deductive-improvisation' },
    { level: 11, name: 'Dogged Will', key: 'dogged-will' },
    { level: 13, name: 'Incredible Senses', key: 'incredible-senses', proficiencies: { perception: 3 } },
    { level: 13, name: 'Light Armor Expertise', key: 'light-armor-expertise' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Savvy Reflexes', key: 'savvy-reflexes', proficiencies: { reflex: 3 } },
    { level: 17, name: 'Greater Dogged Will', key: 'greater-dogged-will' },
    { level: 19, name: 'Light Armor Mastery', key: 'light-armor-mastery' },
    { level: 19, name: 'Master Detective', key: 'master-detective', proficiencies: { classdc: 3 } },
  ],

  spellcasting: null,
};
