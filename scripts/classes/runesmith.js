export const RUNESMITH = {
  slug: 'runesmith',
  nameKey: 'PF2E_LEVELER.RUNESMITH.NAME',
  compendiumUuid: 'Compendium.pf2e.classes.Item.5RK0O6eiijmC7NmA',
  keyAbility: ['int'],
  hp: 8,
  trainedSkills: {
    fixed: ['crafting'],
    additional: 2,
  },

  featSchedule: {
    class: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    skill: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    general: [3, 7, 11, 15, 19],
    ancestry: [5, 9, 13, 17],
  },
  skillIncreaseSchedule: [3, 5, 7, 9, 11, 13, 15, 17, 19],
  abilityBoostSchedule: [5, 10, 15, 20],

  classFeatures: [
    { level: 2, name: 'Runic Crafter', key: 'runic-crafter' },
    { level: 5, name: 'Weapon Expertise', key: 'weapon-expertise' },
    {
      level: 7,
      name: 'Reflex Expertise',
      key: 'reflex-expertise',
      proficiencies: { reflex: 2 },
    },
    {
      level: 7,
      name: 'Expert Runes',
      key: 'expert-runes',
      proficiencies: { classdc: 2 },
    },
    { level: 7, name: 'Runic Optimization', key: 'runic-optimization' },
    { level: 9, name: 'Assured Runic Crafter', key: 'assured-runic-crafter' },
    {
      level: 11,
      name: 'Forged Endurance',
      key: 'forged-endurance',
      proficiencies: { fortitude: 2 },
    },
    {
      level: 13,
      name: 'Perception Expertise',
      key: 'perception-expertise',
      proficiencies: { perception: 2 },
    },
    { level: 13, name: 'Medium Armor Expertise', key: 'medium-armor-expertise' },
    { level: 13, name: 'Weapon Mastery', key: 'weapon-mastery' },
    {
      level: 15,
      name: 'Masterful Runes',
      key: 'masterful-runes',
      proficiencies: { classdc: 3 },
    },
    {
      level: 15,
      name: 'Greater Runic Optimization',
      key: 'greater-runic-optimization',
    },
    {
      level: 19,
      name: 'Legendary Runes',
      key: 'legendary-runes',
      proficiencies: { classdc: 4 },
    },
    { level: 19, name: 'Medium Armor Mastery', key: 'medium-armor-mastery' },
  ],

  spellcasting: null,

  runicRepertoire: {
    progression: {
      1: { known: 4, etched: 2 },
      5: { known: 6, etched: 3 },
      9: { known: 8, etched: 4 },
      13: { known: 10, etched: 5 },
      17: { known: 12, etched: 6 },
    },
  },
};

export function getRunicRepertoireAtLevel(classDef, level) {
  const progression = classDef?.runicRepertoire?.progression ?? {};
  const currentLevel = Number(level);
  const threshold = Object.keys(progression)
    .map(Number)
    .filter((entryLevel) => Number.isInteger(entryLevel) && entryLevel <= currentLevel)
    .sort((left, right) => right - left)[0];
  const entry = progression[threshold];
  return entry ? { ...entry } : null;
}

export function getRunicRepertoireIncrease(classDef, level) {
  const entry = classDef?.runicRepertoire?.progression?.[Number(level)];
  return entry ? { ...entry } : null;
}
