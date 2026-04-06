export const SLAYER = {
  slug: 'slayer',
  nameKey: 'PF2E_LEVELER.SLAYER.NAME',
  compendiumUuid: null,
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
    { level: 3, name: 'Reflex Expertise', key: 'reflex-expertise' },
    { level: 5, name: 'Tip of the Tongue', key: 'tip-of-the-tongue' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: "Slayer's Sight", key: 'slayers-sight' },
    { level: 7, name: 'Specialized Arsenal', key: 'specialized-arsenal' },
    { level: 9, name: 'Persistent Focus', key: 'persistent-focus' },
    { level: 9, name: 'Slayer Expertise', key: 'slayer-expertise' },
    { level: 11, name: 'Armor Expertise', key: 'armor-expertise' },
    { level: 11, name: 'Expanded Arsenal', key: 'expanded-arsenal' },
    { level: 11, name: 'Natural Reflexes', key: 'natural-reflexes' },
    { level: 13, name: 'Martial Weapon Mastery', key: 'martial-weapon-mastery' },
    { level: 15, name: 'Greater Persistent Focus', key: 'greater-persistent-focus' },
    { level: 15, name: 'Greater Specialized Arsenal', key: 'greater-specialized-arsenal' },
    { level: 17, name: 'Perception Legend', key: 'perception-legend' },
    { level: 17, name: 'Slayer Mastery', key: 'slayer-mastery' },
    { level: 19, name: 'Armor Mastery', key: 'armor-mastery' },
    { level: 19, name: 'Fated Foe', key: 'fated-foe' },
  ],

  spellcasting: null,
};
