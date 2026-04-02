import { PROFICIENCY_RANKS, PROFICIENCY_RANK_NAMES, SKILLS } from '../constants.js';
import { slugify } from '../utils/pf2e-api.js';

const RANK_PATTERN = new RegExp(
  `(${PROFICIENCY_RANK_NAMES.join('|')})\\s+in\\s+(.+)`,
  'i',
);

const ABILITY_NAMES = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const ABILITY_PATTERN = new RegExp(
  `(${Object.keys(ABILITY_NAMES).join('|')})\\s+(\\d+)`,
  'i',
);

const LEVEL_PATTERN = /(\d+)(?:st|nd|rd|th)\s+level/i;

export function parsePrerequisite(text) {
  if (!text || typeof text !== 'string') return { type: 'unknown', text: text ?? '' };

  const trimmed = text.trim();

  const rankMatch = tryParseRankRequirement(trimmed);
  if (rankMatch) return rankMatch;

  const abilityMatch = tryParseAbilityRequirement(trimmed);
  if (abilityMatch) return abilityMatch;

  const levelMatch = tryParseLevelRequirement(trimmed);
  if (levelMatch) return levelMatch;

  return tryParseFeatRequirement(trimmed);
}

function tryParseRankRequirement(text) {
  const match = text.match(RANK_PATTERN);
  if (!match) return null;

  const rankName = match[1].toLowerCase();
  const subject = match[2].trim().toLowerCase();
  const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);

  if (minRank < 0) return null;

  const skillSlug = SKILLS.find((s) => s === subject || subject.includes(s));
  if (skillSlug) {
    return { type: 'skill', skill: skillSlug, minRank, text };
  }

  return { type: 'proficiency', key: slugify(subject), minRank, text };
}

function tryParseAbilityRequirement(text) {
  const match = text.match(ABILITY_PATTERN);
  if (!match) return null;

  const abilityName = match[1].toLowerCase();
  const ability = ABILITY_NAMES[abilityName];
  const minValue = parseInt(match[2], 10);

  if (!ability || isNaN(minValue)) return null;

  return { type: 'ability', ability, minValue, text };
}

function tryParseLevelRequirement(text) {
  const match = text.match(LEVEL_PATTERN);
  if (!match) return null;

  return { type: 'level', minLevel: parseInt(match[1], 10), text };
}

function tryParseFeatRequirement(text) {
  const slug = slugify(text);
  if (!slug) return { type: 'unknown', text };

  return { type: 'feat', slug, text };
}

export function parseAllPrerequisites(feat) {
  const prereqs = feat?.system?.prerequisites?.value;
  if (!prereqs || !Array.isArray(prereqs)) return [];
  return prereqs.map((p) => parsePrerequisite(p.value));
}
