export const ROGUE = {
  slug: 'rogue',
  nameKey: 'PF2E_LEVELER.ROGUE.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Rogue',
  keyAbility: ['dex'],
  hp: 8,

  featSchedule: {
    class: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 3, name: 'Deny Advantage', key: 'deny-advantage' },
    { level: 5, name: 'Weapon Tricks', key: 'weapon-tricks' },
    { level: 7, name: 'Evasive Reflexes', key: 'evasive-reflexes' },
    { level: 7, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Debilitating Strike', key: 'debilitating-strike' },
    { level: 9, name: 'Rogue Resilience', key: 'rogue-resilience' },
    { level: 11, name: 'Rogue Expertise', key: 'rogue-expertise', proficiencies: { classdc: 2 } },
    { level: 13, name: 'Greater Rogue Reflexes', key: 'greater-rogue-reflexes' },
    { level: 13, name: 'Light Armor Expertise', key: 'light-armor-expertise' },
    { level: 13, name: 'Master Tricks', key: 'master-tricks' },
    { level: 13, name: 'Perception Legend', key: 'perception-legend' },
    { level: 15, name: 'Double Debilitation', key: 'double-debilitation' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 17, name: 'Agile Mind', key: 'agile-mind' },
    { level: 19, name: 'Light Armor Mastery', key: 'light-armor-mastery' },
    { level: 19, name: 'Master Strike', key: 'master-strike', proficiencies: { classdc: 3 } },
  ],

  spellcasting: null,
};
