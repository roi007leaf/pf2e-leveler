export const COMMANDER = {
  slug: 'commander',
  nameKey: 'PF2E_LEVELER.COMMANDER.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Commander',
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
    { level: 3, name: 'Warfare Expertise', key: 'warfare-expertise' },
    { level: 5, name: 'Military Expertise', key: 'military-expertise' },
    { level: 7, name: 'Expert Tactician', key: 'expert-tactician', proficiencies: { classdc: 2 } },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Fortitude Expertise', key: 'fortitude-expertise' },
    { level: 11, name: 'Armor Expertise', key: 'armor-expertise' },
    { level: 11, name: 'Commanding Will', key: 'commanding-will' },
    { level: 13, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Battlefield Intuition', key: 'battlefield-intuition' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Master Tactician', key: 'master-tactician', proficiencies: { classdc: 3 } },
    { level: 17, name: 'Armor Mastery', key: 'armor-mastery' },
    { level: 19, name: 'Legendary Tactician', key: 'legendary-tactician', proficiencies: { classdc: 4 } },
  ],

  spellcasting: null,
};
