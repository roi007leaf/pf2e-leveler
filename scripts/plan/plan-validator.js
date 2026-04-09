import { PLAN_STATUS, MIN_PLAN_LEVEL, MAX_LEVEL, SPELLBOOK_CLASSES, SUBCLASS_TAGS, MODULE_ID } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getChoicesForLevel, getGradualBoostGroupLevels } from '../classes/progression.js';
import { resolveSubclassSpells } from '../data/subclass-spells.js';
import { computeBuildState } from './build-state.js';
import { getSpellbookBonusCantripSelectionCount } from './spellbook-feats.js';
import { getMaxSkillRank } from '../utils/pf2e-api.js';
import {
  doesFeatMatchRequiredSecondLevelClassFeat,
  getRequiredSecondLevelClassFeatForActor,
} from '../classes/class-archetype-requirements.js';

export function validatePlan(plan, options = {}, actor = null) {
  const classDef = ClassRegistry.get(plan.classSlug);
  if (!classDef) return { valid: false, errors: ['Unknown class'] };

  const levelResults = {};
  for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
    levelResults[level] = validateLevel(plan, classDef, level, options, actor);
  }

  const hasErrors = Object.values(levelResults).some((r) => r.status === PLAN_STATUS.INCOMPLETE);
  const hasWarnings = Object.values(levelResults).some((r) => r.status === PLAN_STATUS.WARNING);

  return {
    valid: !hasErrors,
    hasWarnings,
    levelResults,
  };
}

export function validateLevel(plan, classDef, level, options = {}, actor = null) {
  const choices = getChoicesForLevel(classDef, level, options);
  if (choices.length === 0) return { status: PLAN_STATUS.EMPTY, issues: [] };

  const levelData = plan.levels[level];
  if (!levelData) return { status: PLAN_STATUS.INCOMPLETE, issues: ['No selections made'] };

  const issues = [];
  let hasWarning = false;

  for (const choice of choices) {
    const issue = validateChoice(choice, levelData, level, plan, classDef, options, actor);
    if (issue) {
      if (issue.severity === 'error') {
        issues.push(issue);
      } else {
        issues.push(issue);
        hasWarning = true;
      }
    }
  }

  if (issues.some((i) => i.severity === 'error')) {
    return { status: PLAN_STATUS.INCOMPLETE, issues };
  }
  if (hasWarning) {
    return { status: PLAN_STATUS.WARNING, issues };
  }
  return { status: PLAN_STATUS.COMPLETE, issues: [] };
}

function validateChoice(choice, levelData, level, plan, classDef, options, actor) {
  switch (choice.type) {
    case 'abilityBoosts':
      return validateBoosts(levelData, choice.count, level, plan, actor);
    case 'classFeat':
      return validateClassFeat(levelData.classFeats, level, actor);
    case 'skillFeat':
      return validateFeatSlot(levelData.skillFeats, 'Skill Feat');
    case 'generalFeat':
      return validateFeatSlot(levelData.generalFeats, 'General Feat');
    case 'ancestryFeat':
      return validateFeatSlot(levelData.ancestryFeats, 'Ancestry Feat');
    case 'archetypeFeat':
      return validateFeatSlot(levelData.archetypeFeats, 'Archetype Feat');
    case 'mythicFeat':
      return validateFeatSlot(levelData.mythicFeats, 'Mythic Feat');
    case 'dualClassFeat':
      return validateFeatSlot(levelData.dualClassFeats, 'Dual Class Feat');
    case 'skillIncrease':
      if (optionsSkipHistoricalSkillIncrease(options, level)) return null;
      return validateSkillIncrease(levelData, level, plan);
    case 'spells':
      return validateSpells(levelData, level, classDef, actor, plan);
    default:
      return null;
  }
}

function optionsSkipHistoricalSkillIncrease(options, level) {
  const hiddenLevels = options?.skipHistoricalSkillIncreaseLevels;
  return hiddenLevels instanceof Set ? hiddenLevels.has(level) : false;
}

function validateBoosts(levelData, expectedCount, level, plan, actor) {
  const boosts = levelData.abilityBoosts;
  if (!boosts || boosts.length === 0) {
    return { severity: 'error', message: 'Ability boosts not selected' };
  }
  const unique = new Set(boosts);
  if (unique.size !== boosts.length) {
    return { severity: 'error', message: 'Duplicate ability boosts' };
  }
  if (boosts.length !== expectedCount) {
    return {
      severity: 'error',
      message: `Need ${expectedCount} boosts, selected ${boosts.length}`,
    };
  }

  if (expectedCount === 1) {
    const duplicate = findDuplicateGradualBoost(level, plan);
    if (duplicate) {
      return {
        severity: 'error',
        message: `${duplicate.toUpperCase()} already selected in this gradual ability boost set`,
      };
    }
  }

  const intBenefitCount = getIntBenefitCount(levelData, level, plan, actor);
  if ((levelData.intBonusSkills?.length ?? 0) !== intBenefitCount) {
    return {
      severity: 'error',
      message: `Need ${intBenefitCount} Intelligence bonus skill selection(s), selected ${levelData.intBonusSkills?.length ?? 0}`,
    };
  }
  if ((levelData.intBonusLanguages?.length ?? 0) !== intBenefitCount) {
    return {
      severity: 'error',
      message: `Need ${intBenefitCount} Intelligence bonus language selection(s), selected ${levelData.intBonusLanguages?.length ?? 0}`,
    };
  }
  return null;
}

function findDuplicateGradualBoost(level, plan) {
  const seen = new Set();
  for (const groupLevel of getGradualBoostGroupLevels(level)) {
    const boosts = plan?.levels?.[groupLevel]?.abilityBoosts ?? [];
    for (const boost of boosts) {
      if (seen.has(boost)) return boost;
      seen.add(boost);
    }
  }
  return null;
}

function getIntBenefitCount(levelData, level, plan, actor) {
  if (!levelData?.abilityBoosts?.includes('int')) return 0;
  const before = computeBuildState(actor, plan, level - 1);
  const after = computeBuildState(actor, plan, level);
  const beforeInt = before.attributes.int ?? 0;
  const afterInt = after.attributes.int ?? 0;
  return Math.max(0, afterInt - beforeInt);
}

function validateFeatSlot(feats, label) {
  if (!feats || feats.length === 0) {
    return { severity: 'error', message: `${label} not selected` };
  }
  return null;
}

function validateClassFeat(feats, level, actor) {
  const slotIssue = validateFeatSlot(feats, 'Class Feat');
  if (slotIssue) return slotIssue;
  if (level !== 2) return null;
  if (game.settings.get(MODULE_ID, 'enforceSubclassDedicationRequirement') !== true) return null;

  const requirement = getRequiredSecondLevelClassFeatForActor(actor);
  if (!requirement) return null;

  const selectedFeat = feats?.[0] ?? null;
  if (doesFeatMatchRequiredSecondLevelClassFeat(selectedFeat, requirement)) return null;

  return {
    severity: 'error',
    message: `Must select ${requirement.name ?? requirement.text} as the 2nd-level class feat`,
  };
}

function validateSpells(levelData, level, classDef, actor, plan) {
  if (!classDef?.spellcasting?.slots) return null;
  const hasSpellbook = SPELLBOOK_CLASSES.includes(classDef.slug);
  if (classDef.spellcasting.type !== 'spontaneous' && !hasSpellbook) return null;

  const planned = levelData.spells ?? [];
  const primaryPlanned = planned.filter((spell) => (spell.entryType ?? 'primary') === 'primary');

  if (hasSpellbook) {
    const bonusCantripSelections = getSpellbookBonusCantripSelectionCount(plan, level);
    const plannedRankSelections = primaryPlanned.filter((spell) => !(spell?.isCantrip === true || spell?.rank === 0)).length;
    const plannedCantrips = primaryPlanned.filter((spell) => spell?.isCantrip === true || spell?.rank === 0).length;

    if (plannedRankSelections < 2) {
      return { severity: 'error', message: `${2 - plannedRankSelections} spellbook spell(s) not yet selected` };
    }
    if (plannedCantrips < bonusCantripSelections) {
      return { severity: 'error', message: `${bonusCantripSelections - plannedCantrips} spellbook cantrip(s) not yet selected` };
    }
    const dedicationIssue = validateDedicationSpellSelections(plan, level, planned);
    if (dedicationIssue) return dedicationIssue;
    return null;
  }

  const currentSlots = classDef.spellcasting.slots[level];
  if (!currentSlots) return null;

  const prevSlots = classDef.spellcasting.slots[level - 1] ?? getActorSpellCounts(actor);
  const subclassItem = getSubclassItem(actor, classDef);
  const subclassChoices = getSubclassChoices(subclassItem);

  let totalNewSlots = 0;

  for (const [rank, counts] of Object.entries(currentSlots)) {
    const total = Array.isArray(counts) ? counts[0] + counts[1] : counts;
    const prevVal = prevSlots?.[rank];
    const prevTotal = prevVal == null ? 0 : (Array.isArray(prevVal) ? prevVal[0] + prevVal[1] : prevVal);
    const gainedSlots = Math.max(0, total - prevTotal);
    if (gainedSlots === 0) continue;

    const rankNum = Number(rank);
    const grantedCount = Number.isFinite(rankNum)
      ? getGrantedSpellCount(subclassItem?.slug, subclassChoices, rankNum)
      : 0;

    totalNewSlots += Math.max(0, gainedSlots - grantedCount);
  }

  if (totalNewSlots === 0) return null;

  if (planned.length < totalNewSlots) {
    const missing = totalNewSlots - planned.length;
    return { severity: 'error', message: `${missing} spell(s) not yet selected` };
  }

  return null;
}

function validateDedicationSpellSelections(plan, level, plannedSpells) {
  const configs = collectDedicationSpellcastingConfigs(plan, level);
  for (const config of configs) {
    const sectionSpells = plannedSpells.filter((spell) => spell.entryType === config.entryType);
    const plannedCantrips = sectionSpells.filter((spell) => spell?.isCantrip === true || spell?.rank === 0).length;
    if (plannedCantrips < config.cantripCount) {
      return { severity: 'error', message: `${config.cantripCount - plannedCantrips} ${config.name} cantrip(s) not yet selected` };
    }

    for (const rank of config.slotRanks) {
      const plannedAtRank = sectionSpells.filter((spell) => Number(spell?.rank ?? spell?.baseRank ?? -1) === rank).length;
      if (plannedAtRank < 1) {
        return { severity: 'error', message: `1 ${config.name} ${ordinal(rank)}-rank spell not yet selected` };
      }
    }
  }

  return null;
}

function collectDedicationSpellcastingConfigs(plan, level) {
  const feats = [];
  const featKeys = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
  for (let currentLevel = MIN_PLAN_LEVEL; currentLevel <= level; currentLevel++) {
    const levelData = plan.levels[currentLevel];
    if (!levelData) continue;
    for (const key of featKeys) {
      feats.push(...(levelData[key] ?? []));
    }
  }

  const seen = new Set();
  const configs = [];
  for (const feat of feats) {
    const traits = (feat?.traits ?? feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const combined = `${String(feat?.name ?? '').toLowerCase()} ${String(feat?.slug ?? '').toLowerCase()} ${traits.join(' ')}`;
    if (!(traits.includes('dedication') || combined.includes('dedication'))) continue;

    const classSlug = ClassRegistry.getAll()
      .find((candidate) => candidate?.spellcasting && combined.includes(String(candidate.slug).toLowerCase()))
      ?.slug ?? null;
    if (!classSlug || seen.has(classSlug)) continue;

    const relatedFeats = feats.filter((entry) => {
      const entryTraits = (entry?.traits ?? entry?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
      const entryCombined = `${String(entry?.name ?? '').toLowerCase()} ${String(entry?.slug ?? '').toLowerCase()} ${entryTraits.join(' ')}`;
      return entryTraits.includes(classSlug) || entryCombined.includes(classSlug);
    });
    const dedicationLevel = getFirstFeatSelectionLevel(relatedFeats.filter((entry) => {
      const entryTraits = (entry?.traits ?? entry?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
      const entryCombined = `${String(entry?.name ?? '').toLowerCase()} ${String(entry?.slug ?? '').toLowerCase()} ${entryTraits.join(' ')}`;
      return entryTraits.includes('dedication') || entryCombined.includes('dedication');
    }));

    configs.push({
      entryType: `archetype:${classSlug}`,
      name: `${classSlug.charAt(0).toUpperCase()}${classSlug.slice(1)} Dedication Spells`,
      cantripCount: dedicationLevel === level ? 2 : 0,
      slotRanks: getNewDedicationSpellcastingSlotRanks(relatedFeats, level),
    });
    seen.add(classSlug);
  }

  return configs;
}

function getDedicationSpellcastingSlotRanks(feats, level) {
  const namesAndSlugs = feats.map((feat) => `${String(feat?.name ?? '').toLowerCase()} ${String(feat?.slug ?? '').toLowerCase()}`);
  const hasBasic = namesAndSlugs.some((value) => value.includes('basic') && value.includes('spellcasting'));
  const hasExpert = namesAndSlugs.some((value) => value.includes('expert') && value.includes('spellcasting'));
  const hasMaster = namesAndSlugs.some((value) => value.includes('master') && value.includes('spellcasting'));

  const ranks = [];
  if (hasBasic) {
    if (level >= 4) ranks.push(1);
    if (level >= 6) ranks.push(2);
    if (level >= 8) ranks.push(3);
  }
  if (hasExpert) {
    if (level >= 12) ranks.push(4);
    if (level >= 14) ranks.push(5);
    if (level >= 16) ranks.push(6);
  }
  if (hasMaster) {
    if (level >= 18) ranks.push(7);
    if (level >= 20) ranks.push(8);
  }
  return [...new Set(ranks)].sort((a, b) => a - b);
}

function getNewDedicationSpellcastingSlotRanks(feats, level) {
  const current = new Set(getDedicationSpellcastingSlotRanks(feats, level));
  const previous = new Set(getDedicationSpellcastingSlotRanks(feats, Math.max(0, level - 1)));
  return [...current].filter((rank) => !previous.has(rank)).sort((a, b) => a - b);
}

function getFirstFeatSelectionLevel(feats) {
  const levels = feats
    .map((feat) => getFeatSelectionLevel(feat))
    .filter((level) => Number.isFinite(level));
  return levels.length > 0 ? Math.min(...levels) : null;
}

function getFeatSelectionLevel(feat) {
  const directLevel = Number(feat?.level);
  if (Number.isFinite(directLevel) && directLevel > 0) return directLevel;

  const systemLevel = Number(feat?.system?.level?.taken ?? feat?.system?.level?.value);
  if (Number.isFinite(systemLevel) && systemLevel > 0) return systemLevel;

  return null;
}

function ordinal(rank) {
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${rank}${suffixes[rank] || 'th'}`;
}

function getSubclassItem(actor, classDef) {
  const subclassTag = SUBCLASS_TAGS[classDef?.slug];
  if (!actor || !subclassTag) return null;
  return actor.items?.find?.((item) =>
    item.type === 'feat' && item.system?.traits?.otherTags?.includes?.(subclassTag),
  ) ?? null;
}

function getSubclassChoices(subclassItem) {
  const rawChoices = subclassItem?.flags?.pf2e?.rulesSelections ?? {};
  return rawChoices && typeof rawChoices === 'object' ? rawChoices : {};
}

function getGrantedSpellCount(subclassSlug, subclassChoices, rankNum) {
  if (!subclassSlug) return 0;
  const resolved = resolveSubclassSpells(subclassSlug, subclassChoices, rankNum);
  return resolved?.grantedSpell ? 1 : 0;
}

function getActorSpellCounts(actor) {
  if (!actor) return null;
  const spells = actor.items?.filter?.((i) => i.type === 'spell') ?? [];
  if (spells.length === 0) return null;

  const counts = {};
  let cantripCount = 0;

  for (const spell of spells) {
    const isCantrip = spell.system?.traits?.value?.includes('cantrip');
    if (isCantrip) {
      cantripCount++;
    } else {
      const rank = spell.system?.level?.value ?? 0;
      if (rank > 0) counts[rank] = (counts[rank] ?? 0) + 1;
    }
  }

  if (cantripCount > 0) counts.cantrips = cantripCount;
  return Object.keys(counts).length > 0 ? counts : null;
}

function validateSkillIncrease(levelData, level, _plan) {
  const increases = levelData.skillIncreases;
  if (!increases || increases.length === 0) {
    return { severity: 'error', message: 'Skill increase not selected' };
  }
  const maxRank = getMaxSkillRank(level);
  for (const inc of increases) {
    if (inc.toRank > maxRank) {
      return {
        severity: 'warning',
        message: `Skill rank ${inc.toRank} exceeds maximum ${maxRank} at level ${level}`,
      };
    }
  }
  return null;
}
