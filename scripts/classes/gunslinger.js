export const GUNSLINGER = {
  slug: 'gunslinger',
  nameKey: 'PF2E_LEVELER.GUNSLINGER.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Gunslinger',
  keyAbility: ['dex'],
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
    { level: 3, name: 'Stubborn', key: 'stubborn' },
    { level: 5, name: 'Gunslinger Weapon Mastery', key: 'gunslinger-weapon-mastery' },
    { level: 7, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Advanced Deed', key: 'advanced-deed' },
    { level: 9, name: 'Gunslinger Expertise', key: 'gunslinger-expertise' },
    { level: 11, name: 'Blast Dodger', key: 'blast-dodger' },
    { level: 13, name: 'Gunslinging Legend', key: 'gunslinging-legend' },
    { level: 13, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 15, name: 'Greater Deed', key: 'greater-deed' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 17, name: 'Lead Constitution', key: 'lead-constitution' },
    { level: 17, name: "Shootist's Edge", key: 'shootists-edge' },
    { level: 19, name: 'Medium Armor Mastery', key: 'medium-armor-mastery' },
    { level: 19, name: 'Perception Legend', key: 'perception-legend' },
  ],

  spellcasting: null,
};
