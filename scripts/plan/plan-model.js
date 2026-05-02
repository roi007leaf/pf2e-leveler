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
    dualClassSlug: options.dualClassSlug ?? null,
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

export function createEmptyLevelData(choices) {
  const data = {};
  for (const choice of choices) {
    switch (choice.type) {
      case 'abilityBoosts':
        data.abilityBoosts = [];
        data.intBonusSkills = [];
        data.intBonusLanguages = [];
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
      case 'dualClassFeat':
        data.dualClassFeats = [];
        break;
      case 'spells':
        data.spells = [];
        break;
    }
  }
  return ensureCustomLevelData(data);
}

export function resetLevelData(plan, level, classDef, options = {}) {
  const choices = getChoicesForLevel(classDef, level, options);
  if (choices.length === 0) {
    delete plan.levels[level];
    return plan;
  }

  if (!plan.levels[level]) plan.levels[level] = {};
  plan.levels[level] = createEmptyLevelData(choices);
  return plan;
}

export function getLevelData(plan, level) {
  const levelData = plan.levels[level] ?? null;
  return levelData ? ensureCustomLevelData(levelData) : null;
}

export function setLevelFeat(plan, level, category, featEntry) {
  if (!plan.levels[level]) plan.levels[level] = {};
  ensureCustomLevelData(plan.levels[level]);
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
  ensureCustomLevelData(plan.levels[level]);
  plan.levels[level].abilityBoosts = boosts;
  return plan;
}

export function setLevelSkillIncrease(plan, level, skillIncrease) {
  if (!plan.levels[level]) plan.levels[level] = {};
  ensureCustomLevelData(plan.levels[level]);
  plan.levels[level].skillIncreases = [skillIncrease];
  return plan;
}

export function toggleLevelIntBonusSkill(plan, level, skill) {
  if (!plan.levels[level]) plan.levels[level] = {};
  ensureCustomLevelData(plan.levels[level]);
  if (!plan.levels[level].intBonusSkills) plan.levels[level].intBonusSkills = [];
  const skills = [...plan.levels[level].intBonusSkills];
  const index = skills.indexOf(skill);
  if (index >= 0) skills.splice(index, 1);
  else skills.push(skill);
  plan.levels[level].intBonusSkills = skills;
  return plan;
}

export function toggleLevelIntBonusLanguage(plan, level, language) {
  if (!plan.levels[level]) plan.levels[level] = {};
  ensureCustomLevelData(plan.levels[level]);
  if (!plan.levels[level].intBonusLanguages) plan.levels[level].intBonusLanguages = [];
  const languages = [...plan.levels[level].intBonusLanguages];
  const index = languages.indexOf(language);
  if (index >= 0) languages.splice(index, 1);
  else languages.push(language);
  plan.levels[level].intBonusLanguages = languages;
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
    'dualClassFeats',
    'customFeats',
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
    if (!levelData) continue;
    increases.push(...(levelData.skillIncreases ?? []));
    increases.push(...(levelData.customSkillIncreases ?? []));
  }
  return increases;
}

export function addLevelSpell(plan, level, spellEntry) {
  if (!plan.levels[level]) plan.levels[level] = {};
  ensureCustomLevelData(plan.levels[level]);
  if (!plan.levels[level].spells) plan.levels[level].spells = [];
  plan.levels[level].spells.push(spellEntry);
  return plan;
}

export function removeLevelSpell(plan, level, uuid, options = {}) {
  if (!plan.levels[level]?.spells) return plan;
  const targetEntryType = options.entryType ?? null;
  const targetRank = Number.isFinite(Number(options.rank)) ? Number(options.rank) : null;
  let removed = false;
  plan.levels[level].spells = plan.levels[level].spells.filter((s) => {
    if (removed) return true;
    if (s.uuid !== uuid) return true;
    if (targetEntryType != null && (s.entryType ?? 'primary') !== targetEntryType) return true;
    const spellRank = Number(s.rank) === -1
      ? Number(s.baseRank ?? -1)
      : Number(s.rank ?? s.baseRank ?? -1);
    if (targetRank != null && spellRank !== targetRank) return true;
    removed = true;
    return false;
  });
  return plan;
}

export function addLevelCustomFeat(plan, level, featEntry, index = null) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.customFeats)) levelData.customFeats = [];

  if (Number.isInteger(index) && index >= 0 && index < levelData.customFeats.length) {
    levelData.customFeats[index] = featEntry;
  } else {
    levelData.customFeats.push(featEntry);
  }

  return plan;
}

export function removeLevelCustomFeat(plan, level, index) {
  const customFeats = plan.levels[level]?.customFeats;
  if (!Array.isArray(customFeats) || !Number.isInteger(index)) return plan;
  customFeats.splice(index, 1);
  return plan;
}

export function addLevelCustomSkillIncrease(plan, level, skillIncrease) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.customSkillIncreases)) levelData.customSkillIncreases = [];
  levelData.customSkillIncreases.push(skillIncrease);
  return plan;
}

export function removeLevelCustomSkillIncrease(plan, level, index) {
  const customSkillIncreases = plan.levels[level]?.customSkillIncreases;
  if (!Array.isArray(customSkillIncreases) || !Number.isInteger(index)) return plan;
  customSkillIncreases.splice(index, 1);
  return plan;
}

export function addLevelCustomSpell(plan, level, spellEntry) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.customSpells)) levelData.customSpells = [];
  levelData.customSpells.push(spellEntry);
  return plan;
}

export function removeLevelCustomSpell(plan, level, index) {
  const customSpells = plan.levels[level]?.customSpells;
  if (!Array.isArray(customSpells) || !Number.isInteger(index)) return plan;
  customSpells.splice(index, 1);
  return plan;
}

export function addLevelCustomSpellEntry(plan, level, entry) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.customSpellEntries)) levelData.customSpellEntries = [];
  levelData.customSpellEntries.push(entry);
  return plan;
}

export function removeLevelCustomSpellEntry(plan, level, key) {
  const customSpellEntries = plan.levels[level]?.customSpellEntries;
  if (!Array.isArray(customSpellEntries) || !key) return plan;
  plan.levels[level].customSpellEntries = customSpellEntries.filter((entry) => entry?.key !== key);
  for (const levelData of Object.values(plan.levels ?? {})) {
    if (Array.isArray(levelData?.customSpells)) {
      levelData.customSpells = levelData.customSpells.filter((spell) => spell?.entryType !== `custom:${key}`);
    }
  }
  return plan;
}

export function setLevelEquipmentSlot(plan, level, slotIndex, entry) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.equipment)) levelData.equipment = [];
  while (levelData.equipment.length <= slotIndex) levelData.equipment.push(null);
  levelData.equipment[slotIndex] = entry;
  return plan;
}

export function clearLevelEquipmentSlot(plan, level, slotIndex) {
  const equipment = plan.levels[level]?.equipment;
  if (!Array.isArray(equipment) || !Number.isInteger(slotIndex)) return plan;
  if (slotIndex >= 0 && slotIndex < equipment.length) equipment[slotIndex] = null;
  return plan;
}

export function addLevelCustomEquipment(plan, level, entry, index = null) {
  const levelData = ensureLevelData(plan, level);
  if (!Array.isArray(levelData.customEquipment)) levelData.customEquipment = [];
  if (Number.isInteger(index) && index >= 0 && index < levelData.customEquipment.length) {
    levelData.customEquipment[index] = entry;
  } else {
    levelData.customEquipment.push(entry);
  }
  return plan;
}

export function removeLevelCustomEquipment(plan, level, index) {
  const customEquipment = plan.levels[level]?.customEquipment;
  if (!Array.isArray(customEquipment) || !Number.isInteger(index)) return plan;
  customEquipment.splice(index, 1);
  return plan;
}

export function getAllPlannedSpells(plan, upToLevel = MAX_LEVEL) {
  const spells = [];
  for (let level = 1; level <= upToLevel; level++) {
    const levelData = plan.levels[level];
    if (!levelData) continue;
    spells.push(...(levelData.spells ?? []));
    spells.push(...(levelData.customSpells ?? []));
  }
  return spells;
}

export function togglePlanApparition(plan, slug, maxSlots) {
  if (!plan.apparitions) plan.apparitions = [];
  const list = [...plan.apparitions];
  const index = list.indexOf(slug);
  if (index >= 0) {
    list.splice(index, 1);
  } else if (list.length < maxSlots) {
    list.push(slug);
  }
  plan.apparitions = list;
  return plan;
}

export function getPlanApparitions(plan) {
  return plan.apparitions ?? [];
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

function ensureLevelData(plan, level) {
  if (!plan.levels[level]) plan.levels[level] = {};
  return ensureCustomLevelData(plan.levels[level]);
}

function ensureCustomLevelData(levelData) {
  if (!levelData.classFeatureChoices || typeof levelData.classFeatureChoices !== 'object') levelData.classFeatureChoices = {};
  if (!Array.isArray(levelData.customFeats)) levelData.customFeats = [];
  if (!Array.isArray(levelData.customSkillIncreases)) levelData.customSkillIncreases = [];
  if (!Array.isArray(levelData.customSpells)) levelData.customSpells = [];
  if (!Array.isArray(levelData.customSpellEntries)) levelData.customSpellEntries = [];
  if (!Array.isArray(levelData.customEquipment)) levelData.customEquipment = [];
  if (!Array.isArray(levelData.featGrants)) levelData.featGrants = [];
  return levelData;
}

export function upsertLevelFeatGrant(plan, level, grantEntry) {
  const levelData = ensureLevelData(plan, level);
  const requirementId = String(grantEntry?.requirementId ?? '').trim();
  if (!requirementId) return plan;

  const normalized = {
    ...grantEntry,
    requirementId,
    selections: Array.isArray(grantEntry?.selections) ? [...grantEntry.selections] : [],
  };
  const index = levelData.featGrants.findIndex((entry) => entry?.requirementId === requirementId);
  if (index >= 0) levelData.featGrants[index] = normalized;
  else levelData.featGrants.push(normalized);
  return plan;
}

export function removeLevelFeatGrantSelection(plan, level, requirementId, uuid) {
  const levelData = getLevelData(plan, level);
  if (!levelData) return plan;

  const targetId = String(requirementId ?? '').trim();
  const targetUuid = String(uuid ?? '').trim();
  if (!targetId || !targetUuid) return plan;

  levelData.featGrants = levelData.featGrants
    .map((entry) => {
      if (entry?.requirementId !== targetId) return entry;
      return {
        ...entry,
        selections: (entry.selections ?? []).filter((selection) => selection?.uuid !== targetUuid),
      };
    })
    .filter((entry) => (entry?.selections ?? []).length > 0 || entry?.manual);
  return plan;
}
