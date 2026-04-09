export const MODULE_ID = 'pf2e-leveler';

export const PLAN_FLAG = 'plan';
export const MIXED_ANCESTRY_UUID = 'pf2e-leveler.synthetic.heritage.mixed-ancestry';
export const MIXED_ANCESTRY_CHOICE_FLAG = 'mixedAncestry';

export const PROFICIENCY_RANKS = {
  UNTRAINED: 0,
  TRAINED: 1,
  EXPERT: 2,
  MASTER: 3,
  LEGENDARY: 4,
};

export const PROFICIENCY_RANK_NAMES = ['untrained', 'trained', 'expert', 'master', 'legendary'];

export const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const SKILLS = [
  'acrobatics',
  'arcana',
  'athletics',
  'crafting',
  'deception',
  'diplomacy',
  'intimidation',
  'medicine',
  'nature',
  'occultism',
  'performance',
  'religion',
  'society',
  'stealth',
  'survival',
  'thievery',
];

export const MIN_PLAN_LEVEL = 2;
export const MAX_LEVEL = 20;

export const FEAT_CATEGORIES = {
  CLASS: 'class',
  SKILL: 'skill',
  GENERAL: 'general',
  ANCESTRY: 'ancestry',
  ARCHETYPE: 'archetype',
  MYTHIC: 'mythic',
};

export const SUBCLASS_TAGS = {
  alchemist: 'alchemist-research-field',
  animist: 'animistic-practice',
  barbarian: 'barbarian-instinct',
  bard: 'bard-muse',
  champion: 'champion-cause',
  cleric: 'cleric-doctrine',
  druid: 'druid-order',
  gunslinger: 'gunslinger-way',
  inventor: 'inventor-innovation',
  investigator: 'investigator-methodology',
  kineticist: 'kineticist-kinetic-gate',
  magus: 'magus-hybrid-study',
  oracle: 'oracle-mystery',
  psychic: 'psychic-conscious-mind',
  ranger: 'ranger-hunters-edge',
  rogue: 'rogue-racket',
  sorcerer: 'sorcerer-bloodline',
  summoner: 'summoner-eidolon',
  swashbuckler: 'swashbuckler-style',
  witch: 'witch-patron',
  wizard: 'wizard-arcane-school',
};

export const ANCESTRY_TRAIT_ALIASES = {
  kholo: ['kholo', 'gnoll'],
  gnoll: ['gnoll', 'kholo'],
  dromaar: ['dromaar', 'orc'],
  'half-orc': ['half-orc', 'orc', 'dromaar'],
  aiuvarin: ['aiuvarin', 'elf'],
  'half-elf': ['half-elf', 'elf', 'aiuvarin'],
};

export const SPELLBOOK_CLASSES = ['wizard', 'witch', 'magus'];

export const PLAN_STATUS = {
  COMPLETE: 'complete',
  WARNING: 'warning',
  INCOMPLETE: 'incomplete',
  EMPTY: 'empty',
};

export const WEALTH_MODES = {
  DISABLED: 'DISABLED',
  LUMP_SUM: 'LUMP_SUM',
  ITEMS_AND_CURRENCY: 'ITEMS_AND_CURRENCY',
  CUSTOM: 'CUSTOM',
};

/**
 * PF2e Table 10-10: Character Wealth by level.
 * Each entry has:
 *   permanentItems — array of {level, count} for permanent item slots
 *   currencyGp     — gold available for consumables, runes, materials
 *   lumpSumGp      — flat gold budget for lump-sum mode
 */
export const CHARACTER_WEALTH = [
  null, // index 0 unused
  { permanentItems: [], currencyGp: 15, lumpSumGp: 15 },
  { permanentItems: [{ level: 1, count: 1 }], currencyGp: 20, lumpSumGp: 30 },
  { permanentItems: [{ level: 2, count: 1 }, { level: 1, count: 2 }], currencyGp: 25, lumpSumGp: 75 },
  { permanentItems: [{ level: 3, count: 1 }, { level: 2, count: 2 }, { level: 1, count: 1 }], currencyGp: 30, lumpSumGp: 140 },
  { permanentItems: [{ level: 4, count: 1 }, { level: 3, count: 2 }, { level: 2, count: 1 }, { level: 1, count: 2 }], currencyGp: 50, lumpSumGp: 270 },
  { permanentItems: [{ level: 5, count: 1 }, { level: 4, count: 2 }, { level: 3, count: 1 }, { level: 2, count: 2 }], currencyGp: 80, lumpSumGp: 450 },
  { permanentItems: [{ level: 6, count: 1 }, { level: 5, count: 2 }, { level: 4, count: 1 }, { level: 3, count: 2 }], currencyGp: 125, lumpSumGp: 720 },
  { permanentItems: [{ level: 7, count: 1 }, { level: 6, count: 2 }, { level: 5, count: 1 }, { level: 4, count: 2 }], currencyGp: 180, lumpSumGp: 1_100 },
  { permanentItems: [{ level: 8, count: 1 }, { level: 7, count: 2 }, { level: 6, count: 1 }, { level: 5, count: 2 }], currencyGp: 250, lumpSumGp: 1_600 },
  { permanentItems: [{ level: 9, count: 1 }, { level: 8, count: 2 }, { level: 7, count: 1 }, { level: 6, count: 2 }], currencyGp: 350, lumpSumGp: 2_300 },
  { permanentItems: [{ level: 10, count: 1 }, { level: 9, count: 2 }, { level: 8, count: 1 }, { level: 7, count: 2 }], currencyGp: 500, lumpSumGp: 3_200 },
  { permanentItems: [{ level: 11, count: 1 }, { level: 10, count: 2 }, { level: 9, count: 1 }, { level: 8, count: 2 }], currencyGp: 700, lumpSumGp: 4_500 },
  { permanentItems: [{ level: 12, count: 1 }, { level: 11, count: 2 }, { level: 10, count: 1 }, { level: 9, count: 2 }], currencyGp: 1_000, lumpSumGp: 6_400 },
  { permanentItems: [{ level: 13, count: 1 }, { level: 12, count: 2 }, { level: 11, count: 1 }, { level: 10, count: 2 }], currencyGp: 1_500, lumpSumGp: 9_300 },
  { permanentItems: [{ level: 14, count: 1 }, { level: 13, count: 2 }, { level: 12, count: 1 }, { level: 11, count: 2 }], currencyGp: 2_250, lumpSumGp: 13_500 },
  { permanentItems: [{ level: 15, count: 1 }, { level: 14, count: 2 }, { level: 13, count: 1 }, { level: 12, count: 2 }], currencyGp: 3_250, lumpSumGp: 20_000 },
  { permanentItems: [{ level: 16, count: 1 }, { level: 15, count: 2 }, { level: 14, count: 1 }, { level: 13, count: 2 }], currencyGp: 5_000, lumpSumGp: 30_000 },
  { permanentItems: [{ level: 17, count: 1 }, { level: 16, count: 2 }, { level: 15, count: 1 }, { level: 14, count: 2 }], currencyGp: 7_500, lumpSumGp: 45_000 },
  { permanentItems: [{ level: 18, count: 1 }, { level: 17, count: 2 }, { level: 16, count: 1 }, { level: 15, count: 2 }], currencyGp: 12_000, lumpSumGp: 69_000 },
  { permanentItems: [{ level: 19, count: 1 }, { level: 18, count: 2 }, { level: 17, count: 1 }, { level: 16, count: 2 }], currencyGp: 20_000, lumpSumGp: 112_000 },
];

/** Item types that qualify as permanent items for Table 10-10 slots. */
export const PERMANENT_ITEM_TYPES = new Set(['weapon', 'armor', 'equipment', 'shield', 'backpack']);

/**
 * Expand CHARACTER_WEALTH permanentItems into flat slot array.
 * E.g. level 5 → [{level:4}, {level:3}, {level:3}, {level:2}, {level:1}, {level:1}]
 */
export function expandPermanentItemSlots(characterLevel) {
  const entry = CHARACTER_WEALTH[characterLevel];
  if (!entry) return [];
  const slots = [];
  for (const { level, count } of entry.permanentItems) {
    for (let i = 0; i < count; i++) slots.push({ level });
  }
  return slots;
}
