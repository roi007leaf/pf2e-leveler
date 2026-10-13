const INGENUITY_LEVELS = [3, 7, 15];
const INGENUITY_SKILLS = ['computers', 'crafting'];

export const MECHANIC = {
  slug: 'mechanic',
  nameKey: 'Mechanic',
  compendiumUuid: 'Compendium.sf2e.classes.Item.PMX0vxZeLdaofMVd',
  keyAbility: ['int'],
  hp: 8,

  featSchedule: {
    class: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 3, 4, 6, 7, 8, 10, 12, 14, 15, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
  abilityBoostSchedule: [5, 10, 15, 20],
  skillFeatRestriction: { levels: INGENUITY_LEVELS, skills: INGENUITY_SKILLS },

  classFeatures: [
    { level: 3, name: 'Mobile Exocortex', key: 'mobile-exocortex' },
    { level: 3, name: 'Will Expertise', key: 'will-expertise' },
    {
      level: 3,
      name: "Mechanic's Ingenuity",
      key: 'mechanic-s-ingenuity',
      additionalSkillIncrease: { levels: INGENUITY_LEVELS, allowedSkills: INGENUITY_SKILLS },
    },
    { level: 5, name: 'Mechanic Weapon Expertise', key: 'mechanic-weapon-expertise' },
    { level: 5, name: 'Damage Customizations', key: 'damage-customizations' },
    { level: 7, name: 'Reflex Mastery', key: 'reflex-mastery' },
    { level: 7, name: 'Weapon Specialization', key: 'weapon-specialization' },
    { level: 9, name: 'Remote Mods', key: 'remote-mods' },
    { level: 9, name: 'Mechanical Expertise', key: 'mechanical-expertise' },
    { level: 11, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 11, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 13, name: 'Impressive Endurance', key: 'impressive-endurance' },
    { level: 13, name: 'Mechanic Weapon Mastery', key: 'mechanic-weapon-mastery' },
    { level: 13, name: 'Enduring Mods', key: 'enduring-mods' },
    { level: 15, name: 'Greater Weapon Specialization', key: 'greater-weapon-specialization' },
    { level: 15, name: 'Manifold Mods', key: 'manifold-mods' },
    { level: 17, name: 'Mechanical Mastery', key: 'mechanical-mastery' },
    { level: 17, name: 'Critical Eye', key: 'critical-eye' },
    { level: 19, name: 'Instant Mods', key: 'instant-mods' },
    { level: 19, name: 'Medium Armor Mastery', key: 'medium-armor-mastery' },
  ],

  spellcasting: null,
};
