export const FIGHTER = {
  slug: 'fighter',
  nameKey: 'PF2E_LEVELER.FIGHTER.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Fighter',
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
    { level: 3, name: 'Bravery', key: 'bravery' },
    { level: 5, name: 'Fighter Weapon Mastery', key: 'fighter-weapon-mastery' },
    { level: 7, name: 'Battlefield Surveyor', key: 'battlefield-surveyor' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Battle Hardened', key: 'battle-hardened' },
    { level: 9, name: 'Combat Flexibility', key: 'combat-flexibility' },
    { level: 11, name: 'Armor Expertise', key: 'armor-expertise' },
    { level: 11, name: 'Fighter Expertise', key: 'fighter-expertise' },
    { level: 13, name: 'Weapon Legend', key: 'weapon-legend' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Improved Flexibility', key: 'improved-flexibility' },
    { level: 15, name: 'Tempered Reflexes', key: 'tempered-reflexes' },
    { level: 17, name: 'Armor Mastery', key: 'armor-mastery' },
    { level: 19, name: 'Versatile Legend', key: 'versatile-legend' },
  ],

  spellcasting: null,
};
