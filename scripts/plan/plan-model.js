import { MIN_PLAN_LEVEL, MAX_LEVEL } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getChoicesForLevel } from '../classes/progression.js';

const CURRENT_VERSION = 1;

export function createPlan(classSlug, options = {}) {
  const classDef = ClassRegistry.get(classSlug);
  if (!classDef) throw new Error(`Unknown class: ${classSlug}`);

  return {
    version: CURRENT_VERSION,
    classSlug,
    levels: buildEmptyLevels(classDef, options),
  };
}

function buildEmptyLevels(classDef, options) {
  const levels = {};
  for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
    const choices = getChoicesForLevel(classDef, level, options);
    if (choices.length === 0) continue;
    levels[level] = createEmptyLevelData(choices);
  }
  return levels;
}

function createEmptyLevelData(choices) {
  const data = {};
  for (const choice of choices) {
    switch (choice.type) {
      case 'abilityBoosts':
        data.abilityBoosts = [];
        break;
      case 'classFeat':
        data.classFeats = [];
        break;
      case 'skillFeat':
        data.skillFeats = [];
        break;
      case 'generalFeat':
        data.generalFeats = [];
        break;
      case 'ancestryFeat':
        data.ancestryFeats = [];
        break;
      case 'skillIncrease':
        data.skillIncreases = [];
        break;
      case 'archetypeFeat':
        data.archetypeFeats = [];
        break;
      case 'mythicFeat':
        data.mythicFeats = [];
        break;
      case 'spells':
        data.spells = [];
        break;
    }
  }
  return data;
}

export function getLevelData(plan, level) {
  return plan.levels[level] ?? null;
}

export function setLevelFeat(plan, level, category, featEntry) {
  if (!plan.levels[level]) plan.levels[level] = {};
  plan.levels[level][category] = [featEntry];
  return plan;
}

export function clearLevelFeat(plan, level, category) {
  if (plan.levels[level]?.[category]) {
    plan.levels[level][category] = [];
  }
  return plan;
}

export function addLevelReminder(plan, level, reminder) {
  if (!plan.levels[level]) plan.levels[level] = {};
  if (!plan.levels[level].reminders) plan.levels[level].reminders = [];
  const exists = plan.levels[level].reminders.some((r) => r.featSlug === reminder.featSlug);
  if (!exists) plan.levels[level].reminders.push(reminder);
  return plan;
}

export function clearLevelReminders(plan, level, featSlug) {
  if (!plan.levels[level]?.reminders) return plan;
  plan.levels[level].reminders = plan.levels[level].reminders.filter((r) => r.featSlug !== featSlug);
  return plan;
}

export function getRemindersForLevel(plan, level) {
  return plan.levels[level]?.reminders ?? [];
}

export function setLevelBoosts(plan, level, boosts) {
  if (!plan.levels[level]) plan.levels[level] = {};
  plan.levels[level].abilityBoosts = boosts;
  return plan;
}

export function setLevelSkillIncrease(plan, level, skillIncrease) {
  if (!plan.levels[level]) plan.levels[level] = {};
  plan.levels[level].skillIncreases = [skillIncrease];
  return plan;
}

export function getAllPlannedFeats(plan, upToLevel = MAX_LEVEL) {
  const feats = [];
  const featKeys = [
    'classFeats',
    'skillFeats',
    'generalFeats',
    'ancestryFeats',
    'archetypeFeats',
    'mythicFeats',
  ];
  for (let level = 1; level <= upToLevel; level++) {
    const levelData = plan.levels[level];
    if (!levelData) continue;
    for (const key of featKeys) {
      if (levelData[key]) {
        feats.push(...levelData[key]);
      }
    }
  }
  return feats;
}

export function getAllPlannedSkillIncreases(plan, upToLevel = MAX_LEVEL) {
  const increases = [];
  for (let level = 1; level <= upToLevel; level++) {
    const levelData = plan.levels[level];
    if (!levelData?.skillIncreases) continue;
    increases.push(...levelData.skillIncreases);
  }
  return increases;
}

export function addLevelSpell(plan, level, spellEntry) {
  if (!plan.levels[level]) plan.levels[level] = {};
  if (!plan.levels[level].spells) plan.levels[level].spells = [];
  plan.levels[level].spells.push(spellEntry);
  return plan;
}

export function removeLevelSpell(plan, level, uuid) {
  if (!plan.levels[level]?.spells) return plan;
  plan.levels[level].spells = plan.levels[level].spells.filter((s) => s.uuid !== uuid);
  return plan;
}

export function getAllPlannedBoosts(plan, upToLevel = MAX_LEVEL) {
  const boosts = {};
  for (let level = 1; level <= upToLevel; level++) {
    const levelData = plan.levels[level];
    if (!levelData?.abilityBoosts?.length) continue;
    boosts[level] = levelData.abilityBoosts;
  }
  return boosts;
}
