export const EXEMPLAR = {
  slug: 'exemplar',
  nameKey: 'PF2E_LEVELER.EXEMPLAR.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.Exemplar',
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
    { level: 3, name: 'Root Epithet', key: 'root-epithet' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    { level: 7, name: 'Dominion Epithet', key: 'dominion-epithet' },
    { level: 7, name: 'Spirit Striking', key: 'spirit-striking' },
    { level: 7, name: 'Unassailable Soul', key: 'unassailable-soul' },
    { level: 9, name: 'Divine Premonition', key: 'divine-premonition' },
    { level: 9, name: 'Godly Expertise', key: 'godly-expertise', proficiencies: { classdc: 2 } },
    { level: 9, name: 'Perception Expertise', key: 'perception-expertise' },
    { level: 13, name: 'Burnished Armor Expertise', key: 'burnished-armor-expertise' },
    { level: 13, name: 'Divine Weapon Mastery', key: 'divine-weapon-mastery' },
    { level: 13, name: 'Greater Unassailable Soul', key: 'greater-unassailable-soul' },
    { level: 15, name: 'Greater Spirit Striking', key: 'greater-spirit-striking' },
    { level: 15, name: 'Mortality Reforged', key: 'mortality-reforged' },
    { level: 15, name: 'Sovereignty Epithet', key: 'sovereignty-epithet' },
    { level: 17, name: 'Deific Mastery', key: 'deific-mastery', proficiencies: { classdc: 3 } },
    { level: 17, name: 'Perception Mastery', key: 'perception-mastery' },
    { level: 19, name: 'Burnished Armor Mastery', key: 'burnished-armor-mastery' },
  ],

  spellcasting: null,
};
