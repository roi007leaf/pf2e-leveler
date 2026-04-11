export const GUARDIAN = {
  slug: 'guardian',
  nameKey: 'PF2E_LEVELER.GUARDIAN.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Guardian',
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
    { level: 3, name: 'Tough to Kill', key: 'tough-to-kill' },
    { level: 5, name: 'Unbreakable Expertise', key: 'unbreakable-expertise' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: 'Reaction Time', key: 'reaction-time' },
    { level: 7, name: 'Reflex Expertise', key: 'reflex-expertise' },
    { level: 9, name: 'Battle Hardened', key: 'battle-hardened' },
    { level: 9, name: 'Guardian Expertise', key: 'guardian-expertise', proficiencies: { classdc: 2 } },
    { level: 11, name: 'Unbreakable Mastery', key: 'unbreakable-mastery' },
    { level: 11, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    { level: 15, name: 'Unbreakable Legend', key: 'unbreakable-legend' },
    { level: 17, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 17, name: 'Unyielding Resolve', key: 'unyielding-resolve' },
    { level: 19, name: 'Guardian Mastery', key: 'guardian-mastery', proficiencies: { classdc: 3 } },
  ],

  spellcasting: null,
};
