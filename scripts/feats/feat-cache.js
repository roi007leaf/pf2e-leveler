import { MODULE_ID } from '../constants.js';
import { debug, warn } from '../utils/logger.js';

let cachedFeats = null;

export async function loadFeats() {
  if (cachedFeats) return cachedFeats;

  const defaultCompendium = game.packs.get('pf2e.feats-srd');
  const additionalKeys = getAdditionalCompendiumKeys();
  const [defaultFeats, additionalFeatGroups] = await Promise.all([
    defaultCompendium ? defaultCompendium.getDocuments() : Promise.resolve([]),
    Promise.all(additionalKeys.map((key) => loadCompendiumFeats(key))),
  ]);

  const allFeats = [
    ...defaultFeats.filter((f) => f.system.category !== 'classfeature'),
    ...additionalFeatGroups.flat(),
  ];

  cachedFeats = allFeats;
  debug(`Cached ${allFeats.length} feats`);
  return cachedFeats;
}

function getAdditionalCompendiumKeys() {
  const setting = game.settings.get(MODULE_ID, 'additionalFeatCompendiums');
  if (!setting) return [];
  return setting
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

async function loadCompendiumFeats(key) {
  const compendium = game.packs.get(key);
  if (!compendium) {
    warn(`Compendium not found: ${key}`);
    return [];
  }
  try {
    const collection = await compendium.getDocuments();
    return collection.filter((item) => item.type === 'feat' && item.system.category !== 'classfeature');
  } catch (err) {
    warn(`Failed to load compendium ${key}: ${err.message}`);
    return [];
  }
}

export function getCachedFeats() {
  return cachedFeats ?? [];
}

export function invalidateCache() {
  cachedFeats = null;
}
