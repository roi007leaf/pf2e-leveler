import { PROFICIENCY_RANK_NAMES, SKILLS } from '../constants.js';
import { slugify } from '../utils/pf2e-api.js';

const RANK_NAME_ALIASES = {
  untrained: 'untrained',
  trained: 'trained',
  expert: 'expert',
  master: 'master',
  legendary: 'legendary',
  qualifie: 'trained',
  qualifiee: 'trained',
  maitre: 'master',
  legendaire: 'legendary',
  inexperimente: 'untrained',
  inexperimentee: 'untrained',
};

const RANK_NAME_PATTERN = [
  ...PROFICIENCY_RANK_NAMES,
  'qualifi(?:e|é)(?:e)?',
  'ma(?:i|î)tre',
  'l(?:e|é)gendaire',
  'inexp(?:e|é)riment(?:e|é)(?:e)?',
].join('|');
const RANK_CONNECTOR_PATTERN = '(?:in|en)';
const OR_WORD_PATTERN = '(?:or|ou)';
const AND_WORD_PATTERN = '(?:and|et)';

const RANK_PATTERN = new RegExp(
  `(${RANK_NAME_PATTERN})\\s+${RANK_CONNECTOR_PATTERN}\\s+(.+)`,
  'iu',
);
const RANK_WITH_EITHER_PATTERN = new RegExp(
  `^(${RANK_NAME_PATTERN})\\s+${RANK_CONNECTOR_PATTERN}\\s+(.+?)\\s+as\\s+well\\s+as\\s+either\\s+(.+)$`,
  'iu',
);
const ANY_SKILL_PATTERN = new RegExp(
  `^(${RANK_NAME_PATTERN})\\s+${RANK_CONNECTOR_PATTERN}\\s+(?:at\\s+least\\s+one\\s+skill|au\\s+moins\\s+une\\s+comp(?:e|é)tences?)\\b`,
  'iu',
);

const ABILITY_NAMES = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const ABILITY_PATTERN = new RegExp(`(${Object.keys(ABILITY_NAMES).join('|')})\\s+([+-]?\\d+)`, 'i');

const LEVEL_PATTERN = /(\d+)(?:st|nd|rd|th)\s+level/i;
const CLASS_HP_PATTERN =
  /class granting no more hit points per level than\s+(\d+)\s*\+\s*your\s+constitution\s+modifier/i;
const FOLLOW_DEITY_PATTERN = /^you follow a deity$/i;
const DEITY_IS_PATTERN = /^deity is\s+(.+)$/i;
const DEITY_DOMAIN_PATTERN = /^deity with (?:the\s+)?(.+?)\s+domain$/i;
const NOT_WORSHIPPER_PATTERN = /^not a worshipper of\s+(.+)$/i;
const FOCUS_POOL_PATTERN = /^(?:a |an )?focus pool$/i;
const FOCUS_SPELLS_PATTERN = /^ability to cast focus spells$/i;
const SPECIFIC_SPELL_WITH_SLOT_PATTERN = /^able to cast\s+(.+?)\s+with a spell slot$/i;
const SPELL_SLOTS_PATTERN = /^(?:ability|able) to cast spells (?:from|using) spell slots$/i;
const SPELL_TRAIT_PATTERN = /^able to cast at least one\s+(.+?)\s+spell$/i;
const SPECIFIC_CANTRIP_PATTERN =
  /^(?:you\s+(?:can|must\s+be\s+able\s+to)\s+cast|able\s+to\s+cast|ability\s+to\s+cast|have)\s+(?:the\s+)?(.+?)\s+cantrip$/i;
const SPECIFIC_SPELL_PATTERN =
  /^(?:you\s+(?:can|must\s+be\s+able\s+to)\s+cast|able\s+to\s+cast|ability\s+to\s+cast)\s+the\s+(.+?)\s+spell$/i;
const SPELLCASTING_TRADITION_PATTERN =
  /^ability to cast\s+(arcane|divine|occult|primal)\s+spells?$/i;
const SUBCLASS_TRADITION_PATTERN =
  /(bloodline|mystery|patron|order|conscious mind)\s+(?:that\s+grants?|with)\s+(?:the\s+)?(arcane|divine|occult|primal)\s+(?:spells?|spell list)/i;
const GENERIC_BARD_MUSE_PATTERN = /^(?:bard muse|muse de barde)$/i;
const CLASS_FEATURE_PATTERN = /^(.+?)\s+class feature$/i;
const BACKGROUND_PATTERN = /^(.+?)\s+background$/i;
const HERITAGE_PATTERN = /^(.+?)\s+heritage$/i;
const LANGUAGE_LIST_PATTERN = /^(.+?)\s+languages?$/i;
const WIELD_SHIELD_PATTERN = /^wielding a shield$/i;
const WEARING_ARMOR_PATTERN = /^wearing\s+(.+?)\s+armor$/i;
const WIELDING_WEAPON_PATTERN = /^wielding\s+(?:an?\s+)?(.+?)\s+weapon$/i;
const WIELDING_WEAPON_GROUP_PATTERN = /^wielding\s+(?:an?\s+)?weapon in the\s+(.+?)\s+group$/i;
const WIELDING_WEAPON_TRAIT_PATTERN = /^wielding\s+(?:an?\s+)?weapon with the\s+(.+?)\s+trait$/i;
const NARRATIVE_MEMBERSHIP_PATTERN =
  /^(member of|you were|you are or were|worshipper of|follower of)\b/i;
const NARRATIVE_ATTENDANCE_PATTERN = /^(attended|studied at|graduated from)\b/i;
const NARRATIVE_DEATH_PATTERN = /\b(dead|died|mummified)\b/i;
const NARRATIVE_INITIATION_PATTERN = /\b(initiates you into|earned the trust of)\b/i;
const ACTION_CAPABILITY_PATTERN = /\bskill to\b/i;
const RECALL_KNOWLEDGE_SKILL_PATTERN = new RegExp(
  `^(${PROFICIENCY_RANK_NAMES.join('|')})\\s+in\\s+(?:a|an|any)\\s+skill\\s+with\\s+(?:the\\s+)?recall\\s+knowledge\\s+action$`,
  'i',
);
const WEAPON_TYPE_PROFICIENCY_PATTERN = /^trained in at least one type of\b/i;
const WEAPON_FAMILY_PROFICIENCY_PATTERN = new RegExp(
  `^(${RANK_NAME_PATTERN})\\s+${RANK_CONNECTOR_PATTERN}\\s+(?:at\\s+least\\s+one|au\\s+moins\\s+une)\\s+(.+)$`,
  'iu',
);
const WEAPON_NAME_PROFICIENCY_PATTERN = new RegExp(
  `^(${RANK_NAME_PATTERN})\\s+${RANK_CONNECTOR_PATTERN}\\s+(?:an?\\s+)?(.+)$`,
  'iu',
);
const COMPANION_PROHIBITION_PATTERN = /\byou\s+do(?:\s+not|n't)\s+have\b.*\bcompanion\b/i;
const ALIGNMENT_PATTERN =
  /^(lawful|neutral|chaotic|good|evil)(?:\s+(lawful|neutral|chaotic|good|evil))?\s+alignment$/i;
const CURSE_STATE_PATTERN = /\bcursed\b/i;
const SIGNATURE_TRICK_PATTERN = /^(?:you\s+)?must\s+have\s+(?:a|an)\s+signature\s+trick\b/i;
const MULTIPLE_ANCESTRY_FEATS_PATTERN =
  /^ability\s+to\s+select\s+ancestry\s+feats?\s+from\s+multiple\s+ancestries\b/i;
const SUBCLASS_SPELL_PATTERN = /^(?:a\s+)?(bloodline|mystery|patron)\s+spell$/i;
const SENSE_PATTERN =
  /^(low-light vision|darkvision|greater darkvision|scent|tremorsense|echolocation)$/i;
const DIVINE_FONT_PATTERN = /^(healing|heal|harming|harmful|harm)\s+font$/i;
const AGE_REQUIREMENT_PATTERN = /^(?:at\s+least\s+)?\d+\s+years?\s+old$/i;
const LIVING_CREATURE_PATTERN = /^(?:you\s+are\s+)?(?:a\s+)?living\s+creature$/i;

const PROFICIENCY_SUBJECT_ALIASES = {
  perception: 'perception',
  'perception save': 'perception',
  'perception saves': 'perception',
  'class dc': 'classdc',
  classdc: 'classdc',
  fortitude: 'fortitude',
  'fortitude save': 'fortitude',
  'fortitude saves': 'fortitude',
  reflex: 'reflex',
  'reflex save': 'reflex',
  'reflex saves': 'reflex',
  will: 'will',
  'will save': 'will',
  'will saves': 'will',
};

const FALLBACK_SKILL_ALIASES = {
  acrobaties: 'acrobatics',
  arcanes: 'arcana',
  athletisme: 'athletics',
  artisanat: 'crafting',
  duperie: 'deception',
  diplomatie: 'diplomacy',
  intimidation: 'intimidation',
  medecine: 'medicine',
  nature: 'nature',
  occultisme: 'occultism',
  representation: 'performance',
  religion: 'religion',
  societe: 'society',
  discretion: 'stealth',
  survie: 'survival',
  vol: 'thievery',
};

export function parsePrerequisite(text) {
  if (!text || typeof text !== 'string') return { type: 'unknown', text: text ?? '' };

  const trimmed = text.trim();
  const baseText = stripTrailingParenthetical(trimmed);

  const rankMatch = tryParseRankRequirement(baseText, trimmed);
  if (rankMatch) return rankMatch;

  const weaponFamilyMatch = tryParseWeaponFamilyProficiency(baseText, trimmed);
  if (weaponFamilyMatch) return weaponFamilyMatch;

  if (ACTION_CAPABILITY_PATTERN.test(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  if (WEAPON_TYPE_PROFICIENCY_PATTERN.test(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  if (looksLikeWeaponNameProficiency(baseText)) {
    return { type: 'unknown', text: trimmed };
  }

  const abilityMatch = tryParseAbilityRequirement(baseText, trimmed);
  if (abilityMatch) return abilityMatch;

  const levelMatch = tryParseLevelRequirement(baseText, trimmed);
  if (levelMatch) return levelMatch;

  const classHpMatch = tryParseClassHpRequirement(baseText, trimmed);
  if (classHpMatch) return classHpMatch;

  const livingCreatureMatch = tryParseLivingCreatureRequirement(baseText, trimmed);
  if (livingCreatureMatch) return livingCreatureMatch;

  const deityMatch = tryParseDeityRequirement(baseText, trimmed);
  if (deityMatch) return deityMatch;

  const spellcastingMatch = tryParseSpellcastingRequirement(baseText, trimmed);
  if (spellcastingMatch) return spellcastingMatch;

  const divineFontMatch = tryParseDivineFontRequirement(baseText, trimmed);
  if (divineFontMatch) return divineFontMatch;

  const classIdentityMatch = tryParseClassIdentityRequirement(baseText, trimmed);
  if (classIdentityMatch) return classIdentityMatch;

  const equipmentMatch = tryParseEquipmentRequirement(baseText, trimmed);
  if (equipmentMatch) return equipmentMatch;

  const senseMatch = tryParseSenseRequirement(baseText, trimmed);
  if (senseMatch) return senseMatch;

  const classFeatureMatch = tryParseClassFeatureRequirement(baseText, trimmed);
  if (classFeatureMatch) return classFeatureMatch;

  const backgroundMatch = tryParseBackgroundRequirement(baseText, trimmed);
  if (backgroundMatch) return backgroundMatch;

  const heritageMatch = tryParseHeritageRequirement(baseText, trimmed);
  if (heritageMatch) return heritageMatch;

  const languageMatch = tryParseLanguageRequirement(baseText, trimmed);
  if (languageMatch) return languageMatch;

  const ancestryFeatAccessMatch = tryParseAncestryFeatAccessRequirement(baseText, trimmed);
  if (ancestryFeatAccessMatch) return ancestryFeatAccessMatch;

  return tryParseFeatRequirement(trimmed);
}

export function parsePrerequisiteNode(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return { kind: 'unknown', type: 'unknown', text: normalized };

  const atomicUnknown = tryParseAtomicUnknownNode(normalized);
  if (atomicUnknown) return atomicUnknown;

  const rankEitherNode = tryParseRankWithEitherNode(normalized);
  if (rankEitherNode) return rankEitherNode;

  const rankAlternativesNode = tryParseRankWithAlternativeSubjects(normalized);
  if (rankAlternativesNode) return rankAlternativesNode;

  const languageNode = tryParseLanguageNode(normalized);
  if (languageNode) return languageNode;

  const featAlternativesNode = tryParseFeatAlternativeNode(normalized);
  if (featAlternativesNode) return featAlternativesNode;

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
  if (parsed?.kind === 'all' || parsed?.kind === 'any' || parsed?.kind === 'not') {
    return parsed;
  }
  return {
    kind: 'leaf',
    ...parsed,
  };
}

function tryParseAtomicUnknownNode(text) {
  const parsed = parsePrerequisite(text);
  if (parsed?.type !== 'unknown') return null;
  if (!shouldKeepUnknownPrerequisiteAtomic(text)) return null;
  return {
    kind: 'leaf',
    ...parsed,
  };
}

function shouldKeepUnknownPrerequisiteAtomic(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return false;

  return [
    NARRATIVE_MEMBERSHIP_PATTERN,
    NARRATIVE_ATTENDANCE_PATTERN,
    NARRATIVE_DEATH_PATTERN,
    NARRATIVE_INITIATION_PATTERN,
    ACTION_CAPABILITY_PATTERN,
    WEAPON_TYPE_PROFICIENCY_PATTERN,
    COMPANION_PROHIBITION_PATTERN,
    ALIGNMENT_PATTERN,
    CURSE_STATE_PATTERN,
    SIGNATURE_TRICK_PATTERN,
    MULTIPLE_ANCESTRY_FEATS_PATTERN,
    AGE_REQUIREMENT_PATTERN,
  ].some((pattern) => pattern.test(normalized));
}

function tryParseRankRequirement(text, fullText = text) {
  if (RANK_WITH_EITHER_PATTERN.test(text)) return null;

  const anySkillMatch = text.match(ANY_SKILL_PATTERN);
  if (anySkillMatch) {
    const rankName = normalizeRankName(anySkillMatch[1]);
    const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);
    if (minRank >= 0) {
      return { type: 'anySkill', minRank, text: fullText };
    }
  }

  if (WEAPON_FAMILY_PROFICIENCY_PATTERN.test(text)) return null;
  if (WEAPON_TYPE_PROFICIENCY_PATTERN.test(text)) return null;
  if (looksLikeWeaponNameProficiency(text)) return null;

  const recallKnowledgeMatch = text.match(RECALL_KNOWLEDGE_SKILL_PATTERN);
  if (recallKnowledgeMatch) {
    const rankName = recallKnowledgeMatch[1].toLowerCase();
    const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);
    if (minRank >= 0) {
      return { type: 'recallKnowledgeSkill', minRank, text: fullText };
    }
  }

  const normalizedText = text.split(/[;,]/, 1)[0].trim();
  const match = normalizedText.match(RANK_PATTERN);
  if (!match) return null;

  const rankName = normalizeRankName(match[1]);
  const subject = normalizeRequirementText(match[2]);
  const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);

  if (minRank < 0) return null;

  const skillSlug = resolveSkillSlug(subject);
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

function tryParseWeaponFamilyProficiency(text, fullText = text) {
  if (WEAPON_TYPE_PROFICIENCY_PATTERN.test(text)) return null;

  const match = text.match(WEAPON_FAMILY_PROFICIENCY_PATTERN);
  if (!match) return null;

  const rankName = normalizeRankName(match[1]);
  const minRank = PROFICIENCY_RANK_NAMES.indexOf(rankName);
  if (minRank < 0) return null;

  const subject = normalizeEquipmentKeyword(match[2]);
  if (!subject) return null;

  if (!looksLikeWeaponFamilyRequirement(subject)) return null;

  return {
    type: 'weaponFamilyProficiency',
    family: normalizeWeaponFamilyRequirement(subject),
    minRank,
    text: fullText,
  };
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

function tryParseLivingCreatureRequirement(text, fullText = text) {
  if (!LIVING_CREATURE_PATTERN.test(text)) return null;
  return {
    type: 'livingCreature',
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
  const subclassSpellMatch = text.match(SUBCLASS_SPELL_PATTERN);
  if (subclassSpellMatch) {
    return {
      type: 'subclassSpell',
      subclassType: subclassSpellMatch[1].toLowerCase(),
      text: fullText,
    };
  }

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

  const cantripMatch = text.match(SPECIFIC_CANTRIP_PATTERN);
  if (cantripMatch) {
    return {
      type: 'spellcastingState',
      spellSlug: slugify(cantripMatch[1]),
      text: fullText,
    };
  }

  const specificSpellMatch = text.match(SPECIFIC_SPELL_PATTERN);
  if (specificSpellMatch) {
    return {
      type: 'spellcastingState',
      spellSlug: slugify(specificSpellMatch[1]),
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

function tryParseSenseRequirement(text, fullText = text) {
  const match = text.match(SENSE_PATTERN);
  if (!match) return null;
  const sense = slugifySense(match[1]);
  return { type: 'sense', sense, text: fullText };
}

function tryParseDivineFontRequirement(text, fullText = text) {
  const match = text.match(DIVINE_FONT_PATTERN);
  if (!match) return null;

  const font = normalizeDivineFont(match[1]);
  if (!font) return null;

  return {
    type: 'divineFont',
    font,
    text: fullText,
  };
}

function tryParseClassIdentityRequirement(text, fullText = text) {
  if (!GENERIC_BARD_MUSE_PATTERN.test(String(text ?? '').trim())) return null;
  return {
    type: 'classIdentity',
    subclassType: 'muse',
    text: fullText,
  };
}

function slugifySense(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '-');
}

function normalizeDivineFont(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['heal', 'healing'].includes(normalized)) return 'healing';
  if (['harm', 'harming', 'harmful'].includes(normalized)) return 'harmful';
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

function tryParseHeritageRequirement(text, fullText = text) {
  const match = text.match(HERITAGE_PATTERN);
  if (!match) return null;

  const slug = slugify(match[1]);
  if (!slug) return null;

  return {
    type: 'heritage',
    slug,
    text: fullText,
  };
}

function tryParseLanguageRequirement(text, fullText = text) {
  const match = text.match(LANGUAGE_LIST_PATTERN);
  if (!match) return null;

  const languages = splitLanguageList(match[1]).map(normalizeLanguageKeyword).filter(Boolean);

  if (languages.length === 0) return null;

  return {
    type: 'language',
    languages,
    text: fullText,
  };
}

function tryParseAncestryFeatAccessRequirement(text, fullText = text) {
  if (!MULTIPLE_ANCESTRY_FEATS_PATTERN.test(text)) return null;
  return {
    type: 'ancestryFeatAccess',
    multipleAncestries: true,
    text: fullText,
  };
}

function tryParseFeatRequirement(text) {
  if (looksLikeDescriptiveRequirement(text)) {
    return { type: 'unknown', text };
  }

  const parentheticalMatch = String(text ?? '')
    .trim()
    .match(/^(.+?)\s*\(([^()]+)\)\s*$/u);
  if (parentheticalMatch) {
    const baseText = parentheticalMatch[1].trim();
    const choiceText = parentheticalMatch[2].trim();
    const baseRequirement = tryParseFeatRequirement(baseText);
    const choiceRequirement = tryParseFeatRequirement(choiceText);
    if (baseRequirement?.type === 'feat' && isBardMuseQualifier(choiceText)) {
      return {
        type: 'feat',
        slug: `${baseRequirement.slug}-muse`,
        text,
      };
    }
    if (
      baseRequirement?.type === 'feat'
      && choiceRequirement?.type === 'feat'
      && shouldTreatParentheticalFeatSuffixAsClarifier(choiceText)
    ) {
      return {
        type: 'feat',
        slug: baseRequirement.slug,
        text,
      };
    }
    if (baseRequirement?.type === 'feat' && choiceRequirement?.type === 'feat') {
      return {
        kind: 'all',
        text,
        children: [
          { kind: 'leaf', ...baseRequirement },
          { kind: 'leaf', ...choiceRequirement },
        ],
      };
    }
  }

  const prefixedBardMuseName = extractPrefixedBardMuseName(text);
  if (prefixedBardMuseName) {
    const slug = slugify(prefixedBardMuseName);
    if (slug) {
      return {
        type: 'feat',
        slug: `${slug}-muse`,
        text,
      };
    }
  }

  const slug = slugify(text);
  if (!slug) return { type: 'unknown', text };

  return { type: 'feat', slug, text };
}

function shouldTreatParentheticalFeatSuffixAsClarifier(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) return false;
  return /^\p{Ll}/u.test(normalized);
}

function isBardMuseQualifier(text) {
  const normalized = slugify(text);
  return normalized === 'bard-muse' || normalized === 'muse-de-barde';
}

function extractPrefixedBardMuseName(text) {
  const normalized = String(text ?? '').trim();
  const match = normalized.match(/^muse\s+(.+)$/iu);
  if (!match) return null;
  const suffix = match[1].trim();
  if (!suffix) return null;
  if (isBardMuseQualifier(normalized) || isBardMuseQualifier(suffix)) return null;
  return suffix;
}

function tryParseRankWithEitherNode(text) {
  const match = String(text ?? '')
    .trim()
    .match(RANK_WITH_EITHER_PATTERN);
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
        children: alternativeSubjects.map((subject) =>
          parsePrerequisiteNode(`${rankName} in ${subject}`),
        ),
      },
    ],
  };
}

function tryParseRankWithAlternativeSubjects(text) {
  const match = String(text ?? '')
    .trim()
    .match(RANK_PATTERN);
  if (!match) return null;

  const rankName = match[1];
  const subjectsText = match[2].trim();

  if (subjectsText.includes('(')) return null;
  if (RANK_PATTERN.test(subjectsText)) return null;

  const hasComma = subjectsText.includes(',');
  const hasOr = new RegExp(`\\b${OR_WORD_PATTERN}\\b`, 'i').test(subjectsText);
  if (!hasComma && !hasOr) return null;

  const subjects = splitCommaOrList(subjectsText);
  if (subjects.length < 2) return null;

  return {
    kind: 'any',
    text: String(text ?? '').trim(),
    children: subjects.map((subject) => parsePrerequisiteNode(`${rankName} in ${subject}`)),
  };
}

function tryParseFeatAlternativeNode(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized || !/[,;]/.test(normalized) || !new RegExp(`\\b${OR_WORD_PATTERN}\\b`, 'i').test(normalized)) return null;

  const subjects = normalizeFeatAlternativeSubjects(splitCommaOrList(normalized));
  if (subjects.length < 2) return null;

  const children = subjects.map((subject) => {
    const parsed = parsePrerequisite(subject);
    return parsed?.type === 'feat' ? { kind: 'leaf', ...parsed } : null;
  });
  if (children.some((child) => !child)) return null;

  return {
    kind: 'any',
    text: normalized,
    children,
  };
}

function normalizeFeatAlternativeSubjects(subjects) {
  const values = (subjects ?? []).map((subject) => String(subject ?? '').trim()).filter(Boolean);
  const trailingDedication = values.some((subject) => /\bdedication$/iu.test(subject));
  if (!trailingDedication) return values;

  return values.map((subject) => (
    /\bdedication$/iu.test(subject) ? subject : `${subject} Dedication`
  ));
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
  if (SIGNATURE_TRICK_PATTERN.test(normalized)) return true;
  if (MULTIPLE_ANCESTRY_FEATS_PATTERN.test(normalized)) return true;
  if (AGE_REQUIREMENT_PATTERN.test(normalized)) return true;
  if (/\b(your|class granting|hit points per level|modifier)\b/i.test(normalized)) return true;
  if (/\d+\s*\+\s*your\s+[a-z]+\s+modifier/i.test(normalized)) return true;

  return false;
}

export function parseAllPrerequisites(feat) {
  return getPrerequisiteEntries(feat).map((entry) => parsePrerequisite(entry.value));
}

export function parseAllPrerequisiteNodes(feat) {
  return getPrerequisiteEntries(feat).map((entry) => parsePrerequisiteNode(entry.value));
}

function getPrerequisiteEntries(feat) {
  const sourceEntries = normalizePrerequisiteEntries(feat?._source?.system?.prerequisites?.value);
  if (sourceEntries.length > 0) return sourceEntries;
  return normalizePrerequisiteEntries(feat?.system?.prerequisites?.value);
}

function normalizePrerequisiteEntries(prereqs) {
  if (!Array.isArray(prereqs)) return [];
  return prereqs.filter(
    (entry) => typeof entry?.value === 'string' && entry.value.trim().length > 0,
  );
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
      depth === 0 &&
      normalized.slice(index).match(/^ (?:or|ou) /i) &&
      !/\bor better$/i.test(current)
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
    .split(/\s+(?:or|ou)\s+/i)
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
    .split(/\s*(?:,|\band\b|\bet\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tryParseLanguageNode(text) {
  const match = String(text ?? '')
    .trim()
    .match(LANGUAGE_LIST_PATTERN);
  if (!match) return null;

  const listText = match[1].trim();
  const hasOr = new RegExp(`\\b${OR_WORD_PATTERN}\\b`, 'i').test(listText);
  const hasAnd =
    new RegExp(`\\b${AND_WORD_PATTERN}\\b`, 'i').test(listText) || listText.includes(',');
  const mode = hasOr ? 'any' : hasAnd ? 'all' : 'leaf';
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
    .split(/\s*(?:,|\band\b|\bet\b|\bor\b|\bou\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitCommaOrList(text) {
  return String(text ?? '')
    .split(/\s*(?:,|\bor\b|\bou\b)\s*/i)
    .map((part) => part.trim().replace(/^(?:or|and|ou|et)\s+/i, ''))
    .filter(Boolean);
}

function shouldPreserveOrPhrase(text) {
  return (
    WEARING_ARMOR_PATTERN.test(text) ||
    WIELDING_WEAPON_PATTERN.test(text) ||
    COMPANION_PROHIBITION_PATTERN.test(text) ||
    CURSE_STATE_PATTERN.test(text)
  );
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
  const match = String(text ?? '')
    .trim()
    .match(WEAPON_NAME_PROFICIENCY_PATTERN);
  if (!match) return false;

  const subject = normalizeRequirementText(match[2] ?? match[1]);
  if (!subject) return false;
  if (subject.includes(' at least one ')) return false;
  if (subject.includes(' to ')) return false;
  if (subject.endsWith(' lore')) return false;
  if (resolveSkillSlug(subject)) return false;
  if (Object.prototype.hasOwnProperty.call(PROFICIENCY_SUBJECT_ALIASES, subject)) return false;

  return /\b(sabre|sabres|sword|swords|axe|axes|bow|bows|firearm|firearms|gun|guns|hammer|hammers|spear|spears|polearm|polearms|weapon|weapons)\b/i.test(
    subject,
  );
}

function looksLikeWeaponFamilyRequirement(subject) {
  if (/\bskill\b/i.test(subject)) return false;
  return /\b(crossbow|crossbows|bow|bows|firearm|firearms|weapon|weapons)\b/i.test(subject);
}

function normalizeWeaponFamilyRequirement(subject) {
  const normalized = String(subject ?? '')
    .trim()
    .toLowerCase();
  if (normalized.endsWith('crossbows')) return 'crossbow';
  if (normalized.endsWith('bows')) return 'bow';
  if (normalized.endsWith('firearms')) return 'firearm';
  if (normalized.endsWith('weapons')) return normalized.replace(/\s+weapons$/u, '');
  return normalized;
}

function normalizeRankName(value) {
  const normalized = normalizeRequirementText(value).replace(/\s+/g, '');
  return RANK_NAME_ALIASES[normalized] ?? normalized;
}

function resolveSkillSlug(subject) {
  const normalized = normalizeRequirementToken(subject);
  if (!normalized) return null;

  if (SKILLS.includes(normalized)) return normalized;

  const aliases = getSkillAliasLookup();
  const exact = aliases.get(normalized);
  if (exact) return exact;

  return SKILLS.find((skill) => normalized.includes(normalizeRequirementToken(skill))) ?? null;
}

function getSkillAliasLookup() {
  const lookup = new Map();

  for (const skill of SKILLS) {
    lookup.set(normalizeRequirementToken(skill), skill);
  }

  const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
  for (const [slug, rawEntry] of Object.entries(configSkills)) {
    const canonicalSlug = SKILLS.includes(slug) ? slug : null;
    if (!canonicalSlug) continue;

    const rawLabel =
      typeof rawEntry === 'string'
        ? rawEntry
        : (rawEntry?.label ?? rawEntry?.short ?? rawEntry?.long ?? null);
    const localizedLabel =
      rawLabel && game?.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;

    for (const candidate of [slug, rawLabel, localizedLabel]) {
      const normalized = normalizeRequirementToken(candidate);
      if (normalized) lookup.set(normalized, canonicalSlug);
    }
  }

  for (const [alias, slug] of Object.entries(FALLBACK_SKILL_ALIASES)) {
    lookup.set(normalizeRequirementToken(alias), slug);
  }

  return lookup;
}

function normalizeRequirementText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeRequirementToken(value) {
  return normalizeRequirementText(value).replace(/[^a-z0-9]+/g, '');
}
