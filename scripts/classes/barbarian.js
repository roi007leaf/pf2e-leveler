export const BARBARIAN = {
  slug: 'barbarian',
  nameKey: 'PF2E_LEVELER.BARBARIAN.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Barbarian',
  keyAbility: ['str'],
  hp: 12,

  featSchedule: {
    class: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 3, name: 'Furious Footfalls', key: 'furious-footfalls' },
    { level: 5, name: 'Brutality', key: 'brutality' },
    { level: 7, name: 'Juggernaut', key: 'juggernaut' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Raging Resistance', key: 'raging-resistance' },
    { level: 9, name: 'Reflex Expertise', key: 'reflex-expertise' },
    { level: 11, name: 'Mighty Rage', key: 'mighty-rage' },
    { level: 13, name: 'Greater Juggernaut', key: 'greater-juggernaut' },
    { level: 13, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Indomitable Will', key: 'indomitable-will' },
    { level: 17, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 17, name: 'Revitalizing Rage', key: 'revitalizing-rage' },
    { level: 19, name: 'Armor Mastery', key: 'armor-mastery' },
    { level: 19, name: 'Devastator', key: 'devastator' },
  ],

  spellcasting: null,
};
