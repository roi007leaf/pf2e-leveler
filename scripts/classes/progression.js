export const BOOSTS_PER_LEVEL = 4;

export const FREE_ARCHETYPE_FEAT_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
export const MYTHIC_FEAT_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

export const GRADUAL_BOOST_LEVELS = [2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20];

export function getChoicesForLevel(classDef, level, options = {}) {
  const choices = [];

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

  if (options.freeArchetype && FREE_ARCHETYPE_FEAT_LEVELS.includes(level)) {
    choices.push({ type: 'archetypeFeat' });
  }

  if (options.mythic && MYTHIC_FEAT_LEVELS.includes(level)) {
    choices.push({ type: 'mythicFeat' });
  }

  if (options.abp && [3, 6, 9, 13, 15, 17, 20].includes(level)) {
    choices.push({ type: 'abpPotency' });
  }

  if (classDef.spellcasting?.slots?.[level]) {
    choices.push({ type: 'spells' });
  }

  return choices;
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
        parts.push('Boosts');
        break;
      case 'classFeat':
        parts.push('Class');
        break;
      case 'skillFeat':
        parts.push('Skill');
        break;
      case 'generalFeat':
        parts.push('General');
        break;
      case 'ancestryFeat':
        parts.push('Ancestry');
        break;
      case 'skillIncrease':
        parts.push('Skill+');
        break;
      case 'archetypeFeat':
        parts.push('Archetype');
        break;
      case 'mythicFeat':
        parts.push('Mythic');
        break;
      case 'abpPotency':
        parts.push('Potency');
        break;
      case 'spells':
        parts.push('Spells');
        break;
    }
  }

  return parts.join(', ');
}
