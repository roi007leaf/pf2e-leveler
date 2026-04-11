export const CHAMPION = {
  slug: 'champion',
  nameKey: 'PF2E_LEVELER.CHAMPION.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Champion',
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
    { level: 3, name: 'Blessing of the Devoted', key: 'blessing-of-the-devoted' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: 'Armor Expertise', key: 'armor-expertise' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Champion Expertise', key: 'champion-expertise', proficiencies: { classdc: 2 } },
    { level: 9, name: 'Reflex Expertise', key: 'reflex-expertise' },
    { level: 9, name: 'Relentless Reaction', key: 'relentless-reaction' },
    { level: 9, name: 'Sacred Body', key: 'sacred-body' },
    { level: 11, name: 'Divine Will', key: 'divine-will' },
    { level: 11, name: 'Exalted Reaction', key: 'exalted-reaction' },
    { level: 11, name: 'Perception Expertise', key: 'perception-expertise' },
    { level: 13, name: 'Armor Mastery', key: 'armor-mastery' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 17, name: 'Champion Mastery', key: 'champion-mastery', proficiencies: { classdc: 3 } },
    { level: 17, name: 'Legendary Armor', key: 'legendary-armor' },
    { level: 19, name: "Hero's Defiance", key: 'heros-defiance' },
  ],

  spellcasting: null,
};
