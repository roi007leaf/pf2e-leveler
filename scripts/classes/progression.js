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
