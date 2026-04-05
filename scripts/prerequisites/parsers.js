import { PROFICIENCY_RANK_NAMES, SKILLS } from '../constants.js';
import { slugify } from '../utils/pf2e-api.js';

const RANK_PATTERN = new RegExp(
  `(${PROFICIENCY_RANK_NAMES.join('|')})\\s+in\\s+(.+)`,
  'i',
);
const RANK_WITH_EITHER_PATTERN = new RegExp(
  `^(${PROFICIENCY_RANK_NAMES.join('|')})\\s+in\\s+(.+?)\\s+as\\s+well\\s+as\\s+either\\s+(.+)$`,
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
  `(${Object.keys(ABILITY_NAMES).join('|')})\\s+([+-]?\\d+)`,
  'i',
);

const LEVEL_PATTERN = /(\d+)(?:st|nd|rd|th)\s+level/i;
const CLASS_HP_PATTERN = /class granting no more hit points per level than\s+(\d+)\s*\+\s*your\s+constitution\s+modifier/i;
const FOLLOW_DEITY_PATTERN = /^you follow a deity$/i;
const DEITY_IS_PATTERN = /^deity is\s+(.+)$/i;
const DEITY_DOMAIN_PATTERN = /^deity with (?:the\s+)?(.+?)\s+domain$/i;
const NOT_WORSHIPPER_PATTERN = /^not a worshipper of\s+(.+)$/i;
const FOCUS_POOL_PATTERN = /^(?:a |an )?focus pool$/i;
const FOCUS_SPELLS_PATTERN = /^ability to cast focus spells$/i;
const SPECIFIC_SPELL_WITH_SLOT_PATTERN = /^able to cast\s+(.+?)\s+with a spell slot$/i;
const SPELL_SLOTS_PATTERN = /^(?:ability|able) to cast spells (?:from|using) spell slots$/i;
const SPELL_TRAIT_PATTERN = /^able to cast at least one\s+(.+?)\s+spell$/i;
const SPELLCASTING_TRADITION_PATTERN = /^ability to cast\s+(arcane|divine|occult|primal)\s+spells?$/i;
const SUBCLASS_TRADITION_PATTERN = /(bloodline|mystery|patron|order|conscious mind)\s+that\s+grants?\s+(arcane|divine|occult|primal)\s+spells?/i;
const CLASS_FEATURE_PATTERN = /^(.+?)\s+class feature$/i;
const BACKGROUND_PATTERN = /^(.+?)\s+background$/i;
const LANGUAGE_LIST_PATTERN = /^(.+?)\s+languages?$/i;
const WIELD_SHIELD_PATTERN = /^wielding a shield$/i;
const WEARING_ARMOR_PATTERN = /^wearing\s+(.+?)\s+armor$/i;
const WIELDING_WEAPON_PATTERN = /^wielding\s+(?:an?\s+)?(.+?)\s+weapon$/i;
const WIELDING_WEAPON_GROUP_PATTERN = /^wielding\s+(?:an?\s+)?weapon in the\s+(.+?)\s+group$/i;
const WIELDING_WEAPON_TRAIT_PATTERN = /^wielding\s+(?:an?\s+)?weapon with the\s+(.+?)\s+trait$/i;
const NARRATIVE_MEMBERSHIP_PATTERN = /^(member of|you were|worshipper of|follower of)\b/i;
const NARRATIVE_ATTENDANCE_PATTERN = /^(attended|studied at|graduated from)\b/i;
const NARRATIVE_DEATH_PATTERN = /\b(dead|died|mummified)\b/i;
const NARRATIVE_INITIATION_PATTERN = /\b(initiates you into|earned the trust of)\b/i;
const ACTION_CAPABILITY_PATTERN = /\bskill to\b/i;
const WEAPON_TYPE_PROFICIENCY_PATTERN = /^trained in at least one type of\b/i;
const WEAPON_NAME_PROFICIENCY_PATTERN = /^trained in\s+(?:an?\s+)?(.+)$/i;
const COMPANION_PROHIBITION_PATTERN = /\byou\s+do(?:\s+not|n't)\s+have\b.*\bcompanion\b/i;
const ALIGNMENT_PATTERN = /^(lawful|neutral|chaotic|good|evil)(?:\s+(lawful|neutral|chaotic|good|evil))?\s+alignment$/i;
const CURSE_STATE_PATTERN = /\bcursed\b/i;

const PROFICIENCY_SUBJECT_ALIASES = {
  perception: 'perception',
  'class dc': 'classdc',
  classdc: 'classdc',
  fortitude: 'fortitude',
  reflex: 'reflex',
  will: 'will',
};

export function parsePrerequisite(text) {
  if (!text || typeof text !== 'string') return { type: 'unknown', text: text ?? '' };

  const trimmed = text.trim();
  const baseText = stripTrailingParenthetical(trimmed);

  if (ACTION_CAPABILITY_PATTERN.test(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  if (WEAPON_TYPE_PROFICIENCY_PATTERN.test(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  if (looksLikeWeaponNameProficiency(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  const rankMatch = tryParseRankRequirement(baseText, trimmed);
  if (rankMatch) return rankMatch;

  const abilityMatch = tryParseAbilityRequirement(baseText, trimmed);
  if (abilityMatch) return abilityMatch;

  const levelMatch = tryParseLevelRequirement(baseText, trimmed);
  if (levelMatch) return levelMatch;

  const classHpMatch = tryParseClassHpRequirement(baseText, trimmed);
  if (classHpMatch) return classHpMatch;

  const deityMatch = tryParseDeityRequirement(baseText, trimmed);
  if (deityMatch) return deityMatch;

  const spellcastingMatch = tryParseSpellcastingRequirement(baseText, trimmed);
  if (spellcastingMatch) return spellcastingMatch;

  const equipmentMatch = tryParseEquipmentRequirement(baseText, trimmed);
  if (equipmentMatch) return equipmentMatch;

  const classFeatureMatch = tryParseClassFeatureRequirement(baseText, trimmed);
  if (classFeatureMatch) return classFeatureMatch;

  const backgroundMatch = tryParseBackgroundRequirement(baseText, trimmed);
  if (backgroundMatch) return backgroundMatch;

  const languageMatch = tryParseLanguageRequirement(baseText, trimmed);
  if (languageMatch) return languageMatch;
  return tryParseFeatRequirement(trimmed);
}

export function parsePrerequisiteNode(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return { kind: 'unknown', type: 'unknown', text: normalized };

  const rankEitherNode = tryParseRankWithEitherNode(normalized);
  if (rankEitherNode) return rankEitherNode;

  const languageNode = tryParseLanguageNode(normalized);
  if (languageNode) return languageNode;

  const andClauses = splitClauses(normalized, ';');
  if (andClauses.length > 1) {
    return {
      kind: 'all',
      text: normalized,
      children: andClauses.map((clause) => parsePrerequisiteNode(clause)),
    };
  }

  const orClauses = splitOnOr(normalized);
  if (orClauses.length > 1) {
    return {
      kind: 'any',
      text: normalized,
      children: orClauses.map((clause) => parsePrerequisiteNode(clause)),
    };
  }

  const parsed = parsePrerequisite(normalized);
  return {
    kind: 'leaf',
    ...parsed,
  };
}

function tryParseRankRequirement(text, fullText = text) {
  if (RANK_WITH_EITHER_PATTERN.test(text)) return null;

  const normalizedText = text.split(/[;,]/, 1)[0].trim();
  const match = normalizedText.match(RANK_PATTERN);
  if (!match) return null;

  const rankName = match[1].toLowerCase();
  const subject = match[2].trim().toLowerCase();
  const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);

  if (minRank < 0) return null;

  const skillSlug = SKILLS.find((s) => s === subject || subject.includes(s));
  if (skillSlug) {
    return { type: 'skill', skill: skillSlug, minRank, text: fullText };
  }

  if (/\blore$/i.test(subject)) {
    return {
      type: 'lore',
      lore: subject,
      loreSlug: slugify(subject),
      minRank,
      text: fullText,
    };
  }

  const normalizedSubject = subject
    .replace(/\s+or\s+better$/i, '')
    .replace(/\s+dc$/i, ' dc')
    .trim();
  const key = PROFICIENCY_SUBJECT_ALIASES[normalizedSubject] ?? slugify(normalizedSubject);
  return { type: 'proficiency', key, minRank, text: fullText };
}

function tryParseAbilityRequirement(text, fullText = text) {
  const match = text.match(ABILITY_PATTERN);
  if (!match) return null;

  const abilityName = match[1].toLowerCase();
  const ability = ABILITY_NAMES[abilityName];
  const raw = match[2];
  const minValue = parseInt(raw, 10);
  const isModifier = raw.startsWith('+') || raw.startsWith('-');

  if (!ability || isNaN(minValue)) return null;

  return { type: 'ability', ability, minValue, isModifier, text: fullText };
}

function tryParseLevelRequirement(text, fullText = text) {
  const match = text.match(LEVEL_PATTERN);
  if (!match) return null;

  return { type: 'level', minLevel: parseInt(match[1], 10), text: fullText };
}

function tryParseClassHpRequirement(text, fullText = text) {
  const match = text.match(CLASS_HP_PATTERN);
  if (!match) return null;

  const maxHp = parseInt(match[1], 10);
  if (!Number.isFinite(maxHp)) return null;

  return {
    type: 'classHp',
    comparator: 'lte',
    maxHp,
    includesConModifier: true,
    text: fullText,
  };
}

function tryParseDeityRequirement(text, fullText = text) {
  if (FOLLOW_DEITY_PATTERN.test(text)) {
    return {
      type: 'deityState',
      requiresFollower: true,
      text: fullText,
    };
  }

  const deityIsMatch = text.match(DEITY_IS_PATTERN);
  if (deityIsMatch) {
    const requiredDeity = slugify(deityIsMatch[1]);
    if (!requiredDeity) return null;

    return {
      type: 'deityState',
      requiredDeity,
      text: fullText,
    };
  }

  const domainMatch = text.match(DEITY_DOMAIN_PATTERN);
  if (domainMatch) {
    return {
      type: 'deityState',
      requiresFollower: true,
      requiredDomain: normalizeEquipmentKeyword(domainMatch[1]),
      text: fullText,
    };
  }

  const notWorshipperMatch = text.match(NOT_WORSHIPPER_PATTERN);
  if (notWorshipperMatch) {
    return {
      type: 'deityState',
      forbiddenDeity: slugify(notWorshipperMatch[1]),
      text: fullText,
    };
  }

  return null;
}

function tryParseSpellcastingRequirement(text, fullText = text) {
  if (FOCUS_POOL_PATTERN.test(text)) {
    return {
      type: 'spellcastingState',
      focusPool: true,
      text: fullText,
    };
  }

  if (FOCUS_SPELLS_PATTERN.test(text)) {
    return {
      type: 'spellcastingState',
      focusPool: true,
      text: fullText,
    };
  }

  const specificSpellWithSlotMatch = text.match(SPECIFIC_SPELL_WITH_SLOT_PATTERN);
  if (specificSpellWithSlotMatch) {
    return {
      type: 'spellcastingState',
      spellSlots: true,
      spellSlug: slugify(specificSpellWithSlotMatch[1]),
      text: fullText,
    };
  }

  if (SPELL_SLOTS_PATTERN.test(text)) {
    return {
      type: 'spellcastingState',
      spellSlots: true,
      text: fullText,
    };
  }

  const spellTraitMatch = text.match(SPELL_TRAIT_PATTERN);
  if (spellTraitMatch) {
    return {
      type: 'spellcastingState',
      spellTrait: normalizeEquipmentKeyword(spellTraitMatch[1]),
      text: fullText,
    };
  }

  const spellcastingTraditionMatch = text.match(SPELLCASTING_TRADITION_PATTERN);
  if (spellcastingTraditionMatch) {
    return {
      type: 'spellcastingState',
      tradition: spellcastingTraditionMatch[1].toLowerCase(),
      text: fullText,
    };
  }

  const subclassTraditionMatch = text.match(SUBCLASS_TRADITION_PATTERN);
  if (subclassTraditionMatch) {
    return {
      type: 'classIdentity',
      subclassType: subclassTraditionMatch[1].toLowerCase(),
      tradition: subclassTraditionMatch[2].toLowerCase(),
      text: fullText,
    };
  }

  return null;
}

function tryParseEquipmentRequirement(text, fullText = text) {
  if (WIELD_SHIELD_PATTERN.test(text)) {
    return {
      type: 'equipmentState',
      shield: true,
      text: fullText,
    };
  }

  const armorMatch = text.match(WEARING_ARMOR_PATTERN);
  if (armorMatch) {
    const armorCategories = parseAlternatives(armorMatch[1])
      .map(normalizeEquipmentKeyword)
      .filter(Boolean);

    if (armorCategories.length > 0) {
      return {
        type: 'equipmentState',
        armorCategories,
        text: fullText,
      };
    }
  }

  const weaponMatch = text.match(WIELDING_WEAPON_PATTERN);
  if (weaponMatch) {
    const normalized = normalizeEquipmentKeyword(weaponMatch[1]);
    const categories = parseAlternatives(weaponMatch[1])
      .map(normalizeEquipmentKeyword)
      .filter(Boolean);

    if (['melee', 'ranged'].includes(normalized)) {
      return {
        type: 'equipmentState',
        weaponUsage: normalized,
        text: fullText,
      };
    }

    if (categories.length > 0) {
      return {
        type: 'equipmentState',
        weaponCategories: categories,
        text: fullText,
      };
    }
  }

  const weaponGroupMatch = text.match(WIELDING_WEAPON_GROUP_PATTERN);
  if (weaponGroupMatch) {
    return {
      type: 'equipmentState',
      weaponGroups: [normalizeEquipmentKeyword(weaponGroupMatch[1])].filter(Boolean),
      text: fullText,
    };
  }

  const weaponTraitMatch = text.match(WIELDING_WEAPON_TRAIT_PATTERN);
  if (weaponTraitMatch) {
    return {
      type: 'equipmentState',
      weaponTraits: [normalizeEquipmentKeyword(weaponTraitMatch[1])].filter(Boolean),
      text: fullText,
    };
  }

  return null;
}

function tryParseClassFeatureRequirement(text, fullText = text) {
  const match = text.match(CLASS_FEATURE_PATTERN);
  if (!match) return null;

  const slug = slugify(match[1]);
  if (!slug) return null;

  return {
    type: 'classFeature',
    slug,
    text: fullText,
  };
}

function tryParseBackgroundRequirement(text, fullText = text) {
  const match = text.match(BACKGROUND_PATTERN);
  if (!match) return null;

  const slug = slugify(match[1]);
  if (!slug) return null;

  return {
    type: 'background',
    slug,
    text: fullText,
  };
}

function tryParseLanguageRequirement(text, fullText = text) {
  const match = text.match(LANGUAGE_LIST_PATTERN);
  if (!match) return null;

  const languages = splitLanguageList(match[1])
    .map(normalizeLanguageKeyword)
    .filter(Boolean);

  if (languages.length === 0) return null;

  return {
    type: 'language',
    languages,
    text: fullText,
  };
}

function tryParseFeatRequirement(text) {
  if (looksLikeDescriptiveRequirement(text)) {
    return { type: 'unknown', text };
  }

  const slug = slugify(text);
  if (!slug) return { type: 'unknown', text };

  return { type: 'feat', slug, text };
}

function tryParseRankWithEitherNode(text) {
  const match = String(text ?? '').trim().match(RANK_WITH_EITHER_PATTERN);
  if (!match) return null;

  const rankName = match[1];
  const requiredSubject = match[2].trim();
  const alternativeSubjects = splitCommaOrList(match[3]);
  if (!requiredSubject || alternativeSubjects.length === 0) return null;

  return {
    kind: 'all',
    text: String(text ?? '').trim(),
    children: [
      parsePrerequisiteNode(`${rankName} in ${requiredSubject}`),
      {
        kind: 'any',
        text: `either ${match[3].trim()}`,
        children: alternativeSubjects.map((subject) => parsePrerequisiteNode(`${rankName} in ${subject}`)),
      },
    ],
  };
}

function looksLikeDescriptiveRequirement(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return true;

  if (/[.!?]/.test(normalized)) return true;
  if (NARRATIVE_MEMBERSHIP_PATTERN.test(normalized)) return true;
  if (NARRATIVE_ATTENDANCE_PATTERN.test(normalized)) return true;
  if (NARRATIVE_DEATH_PATTERN.test(normalized)) return true;
  if (NARRATIVE_INITIATION_PATTERN.test(normalized)) return true;
  if (ACTION_CAPABILITY_PATTERN.test(normalized)) return true;
  if (WEAPON_TYPE_PROFICIENCY_PATTERN.test(normalized)) return true;
  if (looksLikeWeaponNameProficiency(normalized)) return true;
  if (COMPANION_PROHIBITION_PATTERN.test(normalized)) return true;
  if (ALIGNMENT_PATTERN.test(normalized)) return true;
  if (CURSE_STATE_PATTERN.test(normalized)) return true;
  if (/\b(your|class granting|hit points per level|modifier)\b/i.test(normalized)) return true;
  if (/\d+\s*\+\s*your\s+[a-z]+\s+modifier/i.test(normalized)) return true;

  return false;
}

export function parseAllPrerequisites(feat) {
  const prereqs = feat?.system?.prerequisites?.value;
  if (!prereqs || !Array.isArray(prereqs)) return [];
  return prereqs.map((p) => parsePrerequisite(p.value));
}

export function parseAllPrerequisiteNodes(feat) {
  const prereqs = feat?.system?.prerequisites?.value;
  if (!prereqs || !Array.isArray(prereqs)) return [];
  return prereqs.map((p) => parsePrerequisiteNode(p.value));
}

function splitClauses(text, separator) {
  const clauses = [];
  let depth = 0;
  let current = '';

  for (const char of String(text ?? '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === separator && depth === 0) {
      pushClause(clauses, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushClause(clauses, current);
  return clauses;
}

function splitOnOr(text) {
  const clauses = [];
  let depth = 0;
  let current = '';
  const normalized = String(text ?? '');

  if (shouldPreserveOrPhrase(normalized)) return [normalized.trim()];

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (
      depth === 0
      && normalized.slice(index).match(/^ or /i)
      && !/\bor better$/i.test(current)
    ) {
      pushClause(clauses, current);
      current = '';
      index += 3;
      continue;
    }

    current += char;
  }

  pushClause(clauses, current);
  return clauses;
}

function pushClause(clauses, text) {
  const normalized = String(text ?? '').trim();
  if (normalized.length > 0) clauses.push(normalized);
}

function parseAlternatives(text) {
  return String(text ?? '')
    .split(/\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeEquipmentKeyword(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(?:a|an)\s+/i, '')
    .replace(/\s+/g, ' ');
}

function normalizeLanguageKeyword(value) {
  const normalized = normalizeEquipmentKeyword(value);
  if (!normalized) return null;
  if (normalized === 'ancient osiriani') return 'osiriani';
  return normalized.replace(/\s+/g, '-');
}

function splitLanguageList(text) {
  return String(text ?? '')
    .split(/\s*(?:,| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tryParseLanguageNode(text) {
  const match = String(text ?? '').trim().match(LANGUAGE_LIST_PATTERN);
  if (!match) return null;

  const listText = match[1].trim();
  const mode = /\bor\b/i.test(listText) ? 'any' : /\b(?:and|,)\b/i.test(listText) ? 'all' : 'leaf';
  const languages = splitLanguageAlternatives(listText)
    .map(normalizeLanguageKeyword)
    .filter(Boolean);

  if (languages.length === 0) return null;
  if (mode === 'leaf' || languages.length === 1) {
    return {
      kind: 'leaf',
      type: 'language',
      languages,
      text: String(text ?? '').trim(),
    };
  }

  return {
    kind: mode,
    text: String(text ?? '').trim(),
    children: languages.map((language) => ({
      kind: 'leaf',
      type: 'language',
      languages: [language],
      text: `${language} language`,
    })),
  };
}

function splitLanguageAlternatives(text) {
  return String(text ?? '')
    .split(/\s*(?:,| and | or )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitCommaOrList(text) {
  return String(text ?? '')
    .split(/\s*(?:,| or )\s*/i)
    .map((part) => part.trim().replace(/^(?:or|and)\s+/i, ''))
    .filter(Boolean);
}

function shouldPreserveOrPhrase(text) {
  return WEARING_ARMOR_PATTERN.test(text)
    || WIELDING_WEAPON_PATTERN.test(text)
    || COMPANION_PROHIBITION_PATTERN.test(text)
    || CURSE_STATE_PATTERN.test(text);
}

function stripTrailingParenthetical(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized.endsWith(')')) return normalized;

  let depth = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const char = normalized[index];
    if (char === ')') depth += 1;
    if (char === '(') {
      depth -= 1;
      if (depth === 0) {
        const prefix = normalized.slice(0, index).trim();
        return prefix.length > 0 ? prefix : normalized;
      }
    }
  }

  return normalized;
}

function looksLikeWeaponNameProficiency(text) {
  const match = String(text ?? '').trim().match(WEAPON_NAME_PROFICIENCY_PATTERN);
  if (!match) return false;

  const subject = match[1].trim().toLowerCase();
  if (!subject) return false;
  if (subject.includes(' at least one ')) return false;
  if (subject.includes(' to ')) return false;
  if (subject.endsWith(' lore')) return false;
  if (SKILLS.includes(subject)) return false;
  if (Object.prototype.hasOwnProperty.call(PROFICIENCY_SUBJECT_ALIASES, subject)) return false;

  return /\b(sabre|sabres|sword|swords|axe|axes|bow|bows|firearm|firearms|gun|guns|hammer|hammers|spear|spears|polearm|polearms|weapon|weapons)\b/i.test(subject);
}
