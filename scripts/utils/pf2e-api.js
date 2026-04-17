import { MODULE_ID } from '../constants.js';

export function isFreeArchetypeEnabled() {
  return game.settings.get('pf2e', 'freeArchetypeVariant');
}

export function isGradualBoostsEnabled() {
  return game.settings.get('pf2e', 'gradualBoostsVariant');
}

export function isABPEnabled() {
  return game.settings.get('pf2e', 'automaticBonusVariant') !== 'noABP';
}

export function isMythicEnabled() {
  return game.settings.get('pf2e', 'mythic') === 'enabled';
}

export function isProficiencyWithoutLevelEnabled() {
  try { return game.settings.get('pf2e', 'proficiencyVariant') === 'ProficiencyWithoutLevel'; } catch { return false; }
}

export function isStaminaEnabled() {
  try { return game.settings.get('pf2e', 'staminaVariant') > 0; } catch { return false; }
}

export function isDualClassEnabled() {
  try {
    return game.settings.get(MODULE_ID, 'enableDualClassSupport');
  } catch {
    return false;
  }
}

export function isAncestralParagonEnabled() {
  try { return game.settings.get('pf2e-leveler', 'ancestralParagon'); } catch { return false; }
}

export function getCampaignFeatSectionIds() {
  try {
    const sections = game.settings.get('pf2e', 'campaignFeatSections');
    return Array.isArray(sections)
      ? sections.map((section) => section?.id).filter((id) => typeof id === 'string' && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function getMaxSkillRank(level) {
  if (level >= 15) return 4;
  if (level >= 7) return 3;
  return 2;
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
