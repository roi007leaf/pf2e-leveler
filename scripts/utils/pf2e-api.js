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
