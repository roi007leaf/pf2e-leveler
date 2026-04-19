import { MODULE_ID } from '../constants.js';
import { warn } from '../utils/logger.js';
import {
  discoverCompendiumsByCategory,
  getCompendiumKeysForCategory,
} from '../compendiums/catalog.js';
import {
  getAllowedCompendiumKeysForCurrentUser,
  isRarityAllowedForCurrentUser,
} from '../access/player-content.js';

let cachedFeats = null;
const RAW_FEAT_DISCOVERY_STORAGE_KEY = `${MODULE_ID}.raw-feat-pack-discovery`;

export async function loadFeats() {
  if (cachedFeats) return cachedFeats;

  const keys = await getAdditionalCompendiumKeys();
  const [featGroups, worldFeats] = await Promise.all([
    Promise.all(keys.map((key) => loadCompendiumFeats(key))),
    loadWorldFeats(),
  ]);
  const allFeats = dedupeByUuid([...featGroups.flat(), ...worldFeats]);

  cachedFeats = allFeats;
  return cachedFeats;
}

async function getAdditionalCompendiumKeys() {
  const configuredKeys = Array.isArray(game.settings.get(MODULE_ID, 'customCompendiums')?.feats)
    ? game.settings.get(MODULE_ID, 'customCompendiums').feats
    : [];
  const baseKeys = getCompendiumKeysForCategory('feats');
  const discovered = await discoverCompendiumsByCategory().catch(() => null);
  const officialDiscoveredKeys = (discovered?.feats ?? [])
    .filter((pack) => pack?.packageName === game.system?.id)
    .map((pack) => pack.key)
    .filter(Boolean);
  const rawDiscoveredKeys = await discoverRawFeatPackKeys();
  if (configuredKeys.length > 0) {
    return filterAllowedFeatCompendiumKeys([
      ...new Set([...baseKeys, ...officialDiscoveredKeys, ...rawDiscoveredKeys]),
    ]);
  }

  const discoveredKeys = (discovered?.feats ?? []).map((pack) => pack.key).filter(Boolean);
  return filterAllowedFeatCompendiumKeys([
    ...new Set([...baseKeys, ...officialDiscoveredKeys, ...discoveredKeys, ...rawDiscoveredKeys]),
  ]);
}

function filterAllowedFeatCompendiumKeys(keys) {
  return getAllowedCompendiumKeysForCurrentUser('feats', [], keys);
}

async function discoverRawFeatPackKeys() {
  const packs = getAllPacks();
  const cachedKeys = getStoredRawFeatPackKeys(packs);
  if (cachedKeys) return cachedKeys;
  const keys = [];
  for (const pack of packs) {
    if (!isItemPack(pack)) continue;
    const key = pack.collection ?? pack.metadata?.id ?? '';
    if (!key) continue;
    const index = await getPackIndex(pack).catch(() => []);
    if (index.some((entry) => isFeatIndexEntry(entry))) keys.push(key);
  }
  storeRawFeatPackKeys(packs, keys);
  return keys;
}

function getStoredRawFeatPackKeys(packs) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(RAW_FEAT_DISCOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.signature !== buildRawFeatPackSignature(packs)) return null;
    return Array.isArray(parsed.keys)
      ? parsed.keys.filter((key) => typeof key === 'string' && key.length > 0)
      : null;
  } catch {
    return null;
  }
}

function storeRawFeatPackKeys(packs, keys) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      RAW_FEAT_DISCOVERY_STORAGE_KEY,
      JSON.stringify({
        signature: buildRawFeatPackSignature(packs),
        keys,
      }),
    );
  } catch {
    // Ignore storage failures; cache discovery can always fall back to a fresh scan.
  }
}

function buildRawFeatPackSignature(packs) {
  return packs
    .filter((pack) => isItemPack(pack))
    .map(
      (pack) =>
        `${pack.collection ?? pack.metadata?.id ?? ''}:${pack.metadata?.packageName ?? pack.metadata?.package ?? ''}`,
    )
    .sort()
    .join('|');
}

function getStorage() {
  if (typeof globalThis?.localStorage?.getItem === 'function') return globalThis.localStorage;
  return null;
}

async function getPackIndex(pack) {
  if (!pack) return [];
  if (typeof pack.getIndex === 'function') {
    const index = await pack.getIndex({ fields: ['type', 'system.category'] }).catch(() => null);
    if (index) return Array.from(index);
  }
  return Array.from(pack.index ?? []);
}

function getAllPacks() {
  if (!game.packs) return [];
  if (typeof game.packs.values === 'function') return [...game.packs.values()];
  if (Array.isArray(game.packs.contents)) return [...game.packs.contents];
  if (Array.isArray(game.packs)) return [...game.packs];
  return [];
}

function isItemPack(pack) {
  return (
    pack?.documentName === 'Item' ||
    pack?.metadata?.type === 'Item' ||
    pack?.metadata?.documentName === 'Item'
  );
}

function isFeatIndexEntry(entry) {
  return isEligibleFeatDocument(entry);
}

function isEligibleFeatDocument(item) {
  const type = String(item?.type ?? item?.system?.type ?? '').toLowerCase();
  const rawCategory = item?.system?.category ?? item?.category;
  const category = String(
    (typeof rawCategory === 'object' && rawCategory !== null ? rawCategory.value : rawCategory) ??
      '',
  ).toLowerCase();
  return (
    type === 'feat' &&
    !['classfeature', 'class-feature', 'ancestryfeature', 'ancestry-feature'].includes(category)
  );
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
    const feats = collection
      .filter((item) => {
        const category = String(
          item.system.category?.value ?? item.system.category ?? '',
        ).toLowerCase();
        return (
          item.type === 'feat' &&
          !['classfeature', 'class-feature', 'ancestryfeature', 'ancestry-feature'].includes(
            category,
          )
        );
      })
      .filter((item) => isRarityAllowedForCurrentUser(item.system?.traits?.rarity ?? 'common'))
      .map((item) => {
        item.sourcePack = key;
        item.sourcePackage = sourcePackage || key;
        item.sourcePackageLabel = sourcePackageLabel || key;
        return item;
      });
    return feats;
  } catch (err) {
    warn(`Failed to load compendium ${key}: ${err.message}`);
    return [];
  }
}

function loadWorldFeats() {
  const sourcePackage = 'world';
  const sourcePackageLabel = getWorldSourceLabel();

  return getAllWorldItems()
    .filter((item) => isEligibleFeatDocument(item))
    .filter((item) => isRarityAllowedForCurrentUser(item.system?.traits?.rarity ?? 'common'))
    .map((item) => {
      item.sourcePack = item.sourcePack ?? null;
      item.sourcePackage = item.sourcePackage ?? sourcePackage;
      item.sourcePackageLabel = item.sourcePackageLabel ?? sourcePackageLabel;
      return item;
    });
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

function getAllWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}

function getSourceOwnerLabel(packageKey) {
  if (!packageKey) return '';
  if (game.system?.id === packageKey)
    return compactSourceOwnerLabel(game.system.title ?? packageKey);
  return compactSourceOwnerLabel(game.modules?.get?.(packageKey)?.title ?? packageKey);
}

function getWorldSourceLabel() {
  return compactSourceOwnerLabel(game.world?.title ?? 'World');
}

function compactSourceOwnerLabel(label) {
  let text = String(label ?? '').trim();
  if (!text) return '';
  if (/^pathfinder second edition$/i.test(text)) return 'PF2E';
  text = text.replace(/\s+for\s+Pathfinder\s+2e\s+by\s+Roll\s+For\s+Combat$/i, '');
  text = text.replace(/\s+by\s+Roll\s+For\s+Combat$/i, '');
  return text;
}
