import { MODULE_ID } from '../constants.js';
import { getCompendiumCategoryKeys } from '../compendiums/catalog.js';

const PLAYER_RARITIES = ['common', 'uncommon', 'rare', 'unique'];

export function shouldRestrictContentForUser() {
  return !!game.user && !game.user.isGM;
}

export function getAllowedRaritiesForCurrentUser() {
  if (!shouldRestrictContentForUser()) return new Set(PLAYER_RARITIES);

  const allowed = new Set(['common']);
  if (game.settings.get(MODULE_ID, 'playerAllowUncommon')) allowed.add('uncommon');
  if (game.settings.get(MODULE_ID, 'playerAllowRare')) allowed.add('rare');
  if (game.settings.get(MODULE_ID, 'playerAllowUnique')) allowed.add('unique');
  return allowed;
}

export function isRarityAllowedForCurrentUser(rarity) {
  return getAllowedRaritiesForCurrentUser().has(String(rarity ?? 'common').toLowerCase());
}

export function filterEntriesByRarityForCurrentUser(entries) {
  if (!shouldRestrictContentForUser()) return entries;
  return (entries ?? []).filter((entry) => isRarityAllowedForCurrentUser(entry?.rarity ?? entry?.system?.traits?.rarity ?? 'common'));
}

export function getPlayerCompendiumRestrictions() {
  const raw = game.settings.get(MODULE_ID, 'playerCompendiumAccess');
  const enabled = game.settings.get(MODULE_ID, 'restrictPlayerCompendiumAccess') && !!raw?.enabled;
  const selections = normalizeSelections(raw?.selections ?? {});
  return { enabled, selections };
}

export function getAllowedCompendiumKeysForCurrentUser(category, defaultKeys = [], configuredKeys = []) {
  const effective = [...new Set([...defaultKeys, ...configuredKeys])];
  if (!shouldRestrictContentForUser()) return effective;

  const { enabled, selections } = getPlayerCompendiumRestrictions();
  if (!enabled) return effective;

  const allowed = new Set(selections[category] ?? []);
  return effective.filter((key) => allowed.has(key));
}

export function createDefaultPlayerCompendiumSelections(allKeysByCategory = {}) {
  const selections = {};
  for (const category of getCompendiumCategoryKeys()) {
    selections[category] = [...new Set(allKeysByCategory[category] ?? [])];
  }
  return selections;
}

function normalizeSelections(value) {
  const normalized = {};
  for (const category of getCompendiumCategoryKeys()) {
    const keys = Array.isArray(value?.[category]) ? value[category] : [];
    normalized[category] = [...new Set(keys.filter((key) => typeof key === 'string' && key.length > 0))];
  }
  return normalized;
}
