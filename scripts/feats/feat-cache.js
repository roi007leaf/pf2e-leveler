import { debug, warn } from '../utils/logger.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';

let cachedFeats = null;

export async function loadFeats() {
  if (cachedFeats) return cachedFeats;

  const featGroups = await Promise.all(getAdditionalCompendiumKeys().map((key) => loadCompendiumFeats(key)));
  const allFeats = dedupeByUuid(featGroups.flat());

  cachedFeats = allFeats;
  debug(`Cached ${allFeats.length} feats`);
  return cachedFeats;
}

function getAdditionalCompendiumKeys() {
  return getCompendiumKeysForCategory('feats');
}

async function loadCompendiumFeats(key) {
  const compendium = game.packs.get(key);
  if (!compendium) {
    warn(`Compendium not found: ${key}`);
    return [];
  }
  try {
    const collection = await compendium.getDocuments();
    const sourcePackage = compendium.metadata?.packageName ?? compendium.metadata?.package ?? '';
    const sourcePackageLabel = getSourceOwnerLabel(sourcePackage);
    return collection
      .filter((item) => item.type === 'feat' && item.system.category !== 'classfeature')
      .map((item) => {
        item.sourcePack = key;
        item.sourcePackage = sourcePackage || key;
        item.sourcePackageLabel = sourcePackageLabel || key;
        return item;
      });
  } catch (err) {
    warn(`Failed to load compendium ${key}: ${err.message}`);
    return [];
  }
}

function dedupeByUuid(items) {
  const seen = new Set();
  return items.filter((item) => {
    const uuid = item?.uuid ?? item?.id ?? null;
    if (!uuid || seen.has(uuid)) return false;
    seen.add(uuid);
    return true;
  });
}

export function getCachedFeats() {
  return cachedFeats ?? [];
}

export function invalidateCache() {
  cachedFeats = null;
}

function getSourceOwnerLabel(packageKey) {
  if (!packageKey) return '';
  if (game.system?.id === packageKey) return compactSourceOwnerLabel(game.system.title ?? packageKey);
  return compactSourceOwnerLabel(game.modules?.get?.(packageKey)?.title ?? packageKey);
}

function compactSourceOwnerLabel(label) {
  let text = String(label ?? '').trim();
  if (!text) return '';
  if (/^pathfinder second edition$/i.test(text)) return 'PF2E';
  text = text.replace(/\s+for\s+Pathfinder\s+2e\s+by\s+Roll\s+For\s+Combat$/i, '');
  text = text.replace(/\s+by\s+Roll\s+For\s+Combat$/i, '');
  return text;
}
