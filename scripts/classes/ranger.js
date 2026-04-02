export const RANGER = {
  slug: 'ranger',
  nameKey: 'PF2E_LEVELER.RANGER.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Ranger',
  keyAbility: ['str', 'dex'],
  hp: 10,

  featSchedule: {
    class: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 3, name: 'Will Expertise', key: 'will-expertise' },
    { level: 5, name: 'Ranger Weapon Expertise', key: 'ranger-weapon-expertise' },
    { level: 5, name: 'Trackless Journey', key: 'trackless-journey' },
    { level: 7, name: 'Natural Reflexes', key: 'natural-reflexes' },
    { level: 7, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: "Nature's Edge", key: 'natures-edge' },
    { level: 9, name: 'Ranger Expertise', key: 'ranger-expertise' },
    { level: 11, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 11, name: 'Unimpeded Journey', key: 'unimpeded-journey' },
    { level: 11, name: "Warden's Endurance", key: 'wardens-endurance' },
    { level: 13, name: 'Martial Weapon Mastery', key: 'martial-weapon-mastery' },
    { level: 15, name: 'Greater Natural Reflexes', key: 'greater-natural-reflexes' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Perception Legend', key: 'perception-legend' },
    { level: 17, name: 'Masterful Hunter', key: 'masterful-hunter' },
    { level: 19, name: 'Medium Armor Mastery', key: 'medium-armor-mastery' },
    { level: 19, name: 'Swift Prey', key: 'swift-prey' },
  ],

  spellcasting: null,
};
