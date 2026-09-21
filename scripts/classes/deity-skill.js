import { ClassRegistry } from './registry.js';

/**
 * Only classes whose level-1 features train the deity's associated skill
 * (Cleric's Deity, Champion's Deity and Cause) should treat a selected deity
 * as a source of skill training. Any other class can worship a deity without
 * gaining its skill.
 */
export function classGrantsDeitySkill(classDefOrSlug) {
  const classDef = typeof classDefOrSlug === 'string' ? ClassRegistry.get(classDefOrSlug) : classDefOrSlug;
  return classDef?.deitySkillTraining === true;
}

export function anyClassGrantsDeitySkill(classDefsOrSlugs) {
  return (classDefsOrSlugs ?? []).some((entry) => classGrantsDeitySkill(entry));
}
