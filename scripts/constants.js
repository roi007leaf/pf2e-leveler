export const MODULE_ID = 'pf2e-leveler';

export const PLAN_FLAG = 'plan';

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
};

export const SPELLBOOK_CLASSES = ['wizard', 'witch', 'magus'];

export const PLAN_STATUS = {
  COMPLETE: 'complete',
  WARNING: 'warning',
  INCOMPLETE: 'incomplete',
  EMPTY: 'empty',
};
