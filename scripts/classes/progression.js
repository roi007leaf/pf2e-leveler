import { localize } from '../utils/i18n.js';

export const BOOSTS_PER_LEVEL = 4;

export const FREE_ARCHETYPE_FEAT_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
export const MYTHIC_FEAT_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
export const ANCESTRAL_PARAGON_FEAT_LEVELS = [3, 7, 11, 15, 19];

export const GRADUAL_BOOST_LEVELS = [2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20];

export function getGradualBoostGroupLevels(level) {
  const levelIndex = GRADUAL_BOOST_LEVELS.indexOf(level);
  if (levelIndex === -1) return [];

  const groupStart = Math.floor(levelIndex / 4) * 4;
  return GRADUAL_BOOST_LEVELS.slice(groupStart, groupStart + 4);
}

export function getChoicesForLevel(classDef, level, options = {}) {
  const choices = [];
  const dualClassDef = options.dualClass && options.dualClassDef ? options.dualClassDef : null;

  if (options.gradualBoosts) {
    if (GRADUAL_BOOST_LEVELS.includes(level)) {
      choices.push({ type: 'abilityBoosts', count: 1 });
    }
  } else if (classDef.abilityBoostSchedule.includes(level)) {
    choices.push({ type: 'abilityBoosts', count: BOOSTS_PER_LEVEL });
  }

  if (classDef.featSchedule.class.includes(level)) {
    choices.push({ type: 'classFeat' });
  }

  if (classDef.featSchedule.skill.includes(level)) {
    choices.push({ type: 'skillFeat' });
  }

  if (classDef.featSchedule.general.includes(level)) {
    choices.push({ type: 'generalFeat' });
  }

  if (classDef.featSchedule.ancestry.includes(level)) {
    choices.push({ type: 'ancestryFeat' });
  }

  if (classDef.skillIncreaseSchedule.includes(level)) {
    choices.push({ type: 'skillIncrease' });
  }
  addClassFeatureSkillIncreaseChoices(choices, classDef, level);

  addSecondaryDualClassChoices(choices, classDef, dualClassDef, level);

  if (options.freeArchetype && FREE_ARCHETYPE_FEAT_LEVELS.includes(level)) {
    choices.push({ type: 'archetypeFeat' });
  }

  if (options.mythic && MYTHIC_FEAT_LEVELS.includes(level)) {
    choices.push({ type: 'mythicFeat' });
  }

  if (options.ancestralParagon && ANCESTRAL_PARAGON_FEAT_LEVELS.includes(level)) {
    choices.push({ type: 'ancestryFeat' });
  }

  if (options.ancestryParagonFeatLevels?.includes(level)) {
    choices.push({ type: 'ancestryFeat' });
  }

  if (options.dualClass && [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].includes(level)) {
    choices.push({ type: 'dualClassFeat' });
  }

  if (options.abp && [3, 6, 9, 13, 15, 17, 20].includes(level)) {
    choices.push({ type: 'abpPotency' });
  }

  if (classDef.spellcasting?.slots?.[level]) {
    choices.push({ type: 'spells' });
  }

  return choices;
}

function addSecondaryDualClassChoices(choices, primaryClassDef, dualClassDef, level) {
  if (!dualClassDef) return;

  if (
    dualClassDef.featSchedule?.skill?.includes(level)
    && !primaryClassDef.featSchedule?.skill?.includes(level)
  ) {
    choices.push({ type: 'skillFeat' });
  }

  if (
    dualClassDef.skillIncreaseSchedule?.includes(level)
    && !primaryClassDef.skillIncreaseSchedule?.includes(level)
  ) {
    choices.push({ type: 'skillIncrease' });
  }
  addClassFeatureSkillIncreaseChoices(choices, dualClassDef, level);
}

function addClassFeatureSkillIncreaseChoices(choices, classDef, level) {
  for (const feature of classDef?.classFeatures ?? []) {
    const benefit = feature?.additionalSkillIncrease;
    if (feature.level !== level || !benefit) continue;

    const source = `${classDef.slug}:${feature.key}`;
    if (choices.some((choice) => choice.type === 'skillIncrease' && choice.source === source)) continue;
    choices.push({
      type: 'skillIncrease',
      source,
      label: feature.name,
      allowedSkills: [...(benefit.allowedSkills ?? [])],
    });
  }
}

export function normalizeSkillIncreaseSource(source) {
  return String(source ?? '').trim();
}

export function getSkillIncreaseChoiceSource(choice) {
  return normalizeSkillIncreaseSource(choice?.source);
}

export function getSkillIncreaseSelection(levelData, choiceOrSource = '') {
  const source = typeof choiceOrSource === 'object'
    ? getSkillIncreaseChoiceSource(choiceOrSource)
    : normalizeSkillIncreaseSource(choiceOrSource);
  return (levelData?.skillIncreases ?? []).find(
    (increase) => normalizeSkillIncreaseSource(increase?.source) === source,
  ) ?? null;
}

export function getSkillIncreaseChoices(choices) {
  return (choices ?? []).filter((choice) => choice.type === 'skillIncrease');
}

export function getPriorSkillIncreaseSelections(levelData, choices, choiceOrSource = '') {
  const source = typeof choiceOrSource === 'object'
    ? getSkillIncreaseChoiceSource(choiceOrSource)
    : normalizeSkillIncreaseSource(choiceOrSource);
  const skillChoices = getSkillIncreaseChoices(choices);
  const index = skillChoices.findIndex((choice) => getSkillIncreaseChoiceSource(choice) === source);
  if (index <= 0) return [];
  return skillChoices.slice(0, index)
    .map((choice) => getSkillIncreaseSelection(levelData, choice))
    .filter(Boolean);
}

export function getSkillRankBeforeIncreaseChoice(skill, rawRank, levelData, choices, choiceOrSource = '') {
  const normalizedSkill = String(skill ?? '').trim().toLowerCase();
  const matchingSelections = getSkillIncreaseChoices(choices)
    .map((choice) => getSkillIncreaseSelection(levelData, choice))
    .filter((selection) => String(selection?.skill ?? '').trim().toLowerCase() === normalizedSkill);
  let rank = Number(rawRank ?? 0);

  if (matchingSelections.length > 0) {
    rank = Math.min(
      rank,
      ...matchingSelections
        .map((selection) => Number(selection?.toRank))
        .filter(Number.isFinite)
        .map((targetRank) => Math.max(0, targetRank - 1)),
    );
  }

  for (const selection of getPriorSkillIncreaseSelections(levelData, choices, choiceOrSource)) {
    if (String(selection?.skill ?? '').trim().toLowerCase() !== normalizedSkill) continue;
    const targetRank = Number(selection?.toRank);
    if (Number.isFinite(targetRank)) rank = Math.max(rank, targetRank);
  }

  return rank;
}

export function getAutomaticLoreProficiencies(classDef, atLevel, options = {}) {
  const classDefs = Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean);
  const bySkill = new Map();

  for (const definition of classDefs) {
    for (const entry of definition?.automaticLoreProficiencies ?? []) {
      const level = Number(entry?.level);
      const rank = Number(entry?.rank);
      const skill = String(entry?.skill ?? '').trim().toLowerCase();
      const applies = options.exactLevel === true ? level === atLevel : level <= atLevel;
      if (!applies || !skill || !Number.isFinite(rank)) continue;

      const existing = bySkill.get(skill);
      if (existing && existing.rank >= rank) continue;
      bySkill.set(skill, {
        ...entry,
        skill,
        rank,
        source: `${definition.slug}:${skill}`,
      });
    }
  }

  return [...bySkill.values()];
}

export function hasChoicesAtLevel(classDef, level, options = {}) {
  return getChoicesForLevel(classDef, level, options).length > 0;
}

export function getLevelSummary(classDef, level, options = {}) {
  const parts = [];
  const choices = getChoicesForLevel(classDef, level, options);

  for (const choice of choices) {
    switch (choice.type) {
      case 'abilityBoosts':
        parts.push(localize('SUMMARY.BOOSTS'));
        break;
      case 'classFeat':
        parts.push(localize('SUMMARY.CLASS'));
        break;
      case 'skillFeat':
        parts.push(localize('SUMMARY.SKILL'));
        break;
      case 'generalFeat':
        parts.push(localize('SUMMARY.GENERAL'));
        break;
      case 'ancestryFeat':
        parts.push(localize('SUMMARY.ANCESTRY'));
        break;
      case 'skillIncrease':
        parts.push(localize('SUMMARY.SKILL_INCREASE'));
        break;
      case 'archetypeFeat':
        parts.push(localize('SUMMARY.ARCHETYPE'));
        break;
      case 'mythicFeat':
        parts.push(localize('SUMMARY.MYTHIC'));
        break;
      case 'abpPotency':
        parts.push(localize('SUMMARY.POTENCY'));
        break;
      case 'dualClassFeat':
        parts.push(localize('SUMMARY.DUAL_CLASS'));
        break;
      case 'spells':
        parts.push(localize('SUMMARY.SPELLS'));
        break;
    }
  }

  return parts.join(', ');
}
