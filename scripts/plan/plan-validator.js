import { PLAN_STATUS, MIN_PLAN_LEVEL, MAX_LEVEL } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getChoicesForLevel, BOOSTS_PER_LEVEL } from '../classes/progression.js';
import { getMaxSkillRank } from '../utils/pf2e-api.js';
import { computeBuildState } from './build-state.js';

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
    const issue = validateChoice(choice, levelData, level, plan, classDef, actor);
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

function validateChoice(choice, levelData, level, plan, classDef, actor) {
  switch (choice.type) {
    case 'abilityBoosts':
      return validateBoosts(levelData, choice.count, level, plan, actor);
    case 'classFeat':
      return validateFeatSlot(levelData.classFeats, 'Class Feat');
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
      return validateSkillIncrease(levelData, level, plan);
    case 'spells':
      return validateSpells(levelData, level, classDef, actor);
    default:
      return null;
  }
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
  const buildState = actor ? computeBuildState(actor, plan, level - 1) : null;
  let totalCost = 0;
  for (const attr of boosts) {
    const mod = buildState?.attributes?.[attr] ?? 0;
    totalCost += mod >= 4 ? 2 : 1;
  }
  if (totalCost !== expectedCount) {
    return {
      severity: 'error',
      message: `Need ${expectedCount} boost points, used ${totalCost}`,
    };
  }
  return null;
}

function validateFeatSlot(feats, label) {
  if (!feats || feats.length === 0) {
    return { severity: 'error', message: `${label} not selected` };
  }
  return null;
}

function validateSpells(levelData, level, classDef, actor) {
  if (!classDef?.spellcasting?.slots) return null;
  if (classDef.spellcasting.type === 'prepared') return null;

  const currentSlots = classDef.spellcasting.slots[level];
  if (!currentSlots) return null;

  const prevSlots = classDef.spellcasting.slots[level - 1] ?? getActorSpellCounts(actor);

  const planned = levelData.spells ?? [];
  let totalNewSlots = 0;

  for (const [rank, counts] of Object.entries(currentSlots)) {
    const total = Array.isArray(counts) ? counts[0] + counts[1] : counts;
    const prevVal = prevSlots?.[rank];
    const prevTotal = prevVal == null ? 0 : (Array.isArray(prevVal) ? prevVal[0] + prevVal[1] : prevVal);
    totalNewSlots += Math.max(0, total - prevTotal);
  }

  if (totalNewSlots === 0) return null;

  if (planned.length < totalNewSlots) {
    const missing = totalNewSlots - planned.length;
    return { severity: 'error', message: `${missing} spell(s) not yet selected` };
  }

  return null;
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


