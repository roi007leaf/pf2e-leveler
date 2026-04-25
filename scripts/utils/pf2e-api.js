import { MODULE_ID } from '../constants.js';
import { getSystemSetting } from '../system-support/profiles.js';

export function isFreeArchetypeEnabled() {
  return getSystemSetting('freeArchetypeVariant', { fallback: false });
}

export function isGradualBoostsEnabled() {
  return getSystemSetting('gradualBoostsVariant', { fallback: false });
}

export function isABPEnabled() {
  return getSystemSetting('automaticBonusVariant', { fallback: 'noABP' }) !== 'noABP';
}

export function isMythicEnabled() {
  return getSystemSetting('mythic', { fallback: 'disabled' }) === 'enabled';
}

export function isProficiencyWithoutLevelEnabled() {
  return getSystemSetting('proficiencyVariant', { fallback: null }) === 'ProficiencyWithoutLevel';
}

export function isStaminaEnabled() {
  return getSystemSetting('staminaVariant', { fallback: 0 }) > 0;
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
  const sections = getSystemSetting('campaignFeatSections', { fallback: [] });
  return Array.isArray(sections)
    ? sections.map((section) => section?.id).filter((id) => typeof id === 'string' && id.length > 0)
    : [];
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
