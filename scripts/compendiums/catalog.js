import { MODULE_ID } from '../constants.js';
import { getAllowedCompendiumKeysForCurrentUser } from '../access/player-content.js';
import { getDefaultPackKeysForCategory } from '../system-support/profiles.js';

export const COMPENDIUM_CATEGORY_DEFINITIONS = {
  ancestries: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.ANCESTRIES',
    defaultKeys: ['pf2e.ancestries'],
    matches: (pack, index) => isItemPack(pack)
      && !hasFeatureLikePackIdentity(pack)
      && !hasHeritageLikePackIdentity(pack)
      && index.some((entry) => entry.type === 'ancestry'),
  },
  heritages: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.HERITAGES',
    defaultKeys: ['pf2e.heritages', 'pf2e.ancestryfeatures'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'heritage'),
  },
  backgrounds: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.BACKGROUNDS',
    defaultKeys: ['pf2e.backgrounds'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'background'),
  },
  classes: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.CLASSES',
    defaultKeys: ['pf2e.classes'],
    matches: (pack, index) => isItemPack(pack)
      && !hasFeatureLikePackIdentity(pack)
      && index.some((entry) => entry.type === 'class'),
  },
  feats: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.FEATS',
    defaultKeys: ['pf2e.feats-srd'],
    matches: (pack, index) => isItemPack(pack)
      && (!hasNonFeatPackIdentity(pack) || hasAdditionalRecognizedContent(index, 'feats'))
      && index.some((entry) => isFeatIndexEntry(entry)),
  },
  classFeatures: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.CLASS_FEATURES',
    defaultKeys: ['pf2e.classfeatures'],
    matches: (pack, index) => isItemPack(pack) && isClassFeaturesPack(pack, index),
  },
  spells: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.SPELLS',
    defaultKeys: ['pf2e.spells-srd'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'spell'),
  },
  equipment: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.EQUIPMENT',
    defaultKeys: ['pf2e.equipment-srd'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => EQUIPMENT_TYPES.has(entry.type)),
  },
  actions: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.ACTIONS',
    showInSettings: false,
    defaultKeys: ['pf2e.actionspf2e'],
    matches: (pack, index) => isItemPack(pack)
      && (!hasNonActionPackIdentity(pack) || hasAdditionalRecognizedContent(index, 'actions'))
      && index.some((entry) => entry.type === 'action'),
  },
  deities: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.DEITIES',
    defaultKeys: ['pf2e.deities'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'deity'),
  },
};

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'equipment', 'consumable', 'ammo', 'treasure', 'backpack', 'shield', 'kit']);

export function getCompendiumCategoryKeys() {
  return Object.keys(COMPENDIUM_CATEGORY_DEFINITIONS);
}

export function getVisibleCompendiumCategoryKeys() {
  return Object.entries(COMPENDIUM_CATEGORY_DEFINITIONS)
    .filter(([, definition]) => definition.showInSettings !== false)
    .map(([key]) => key);
}

export function getDefaultCompendiumKeys(category) {
  return getDefaultPackKeysForCategory(category);
}

export function getConfiguredCompendiumSelections() {
  return normalizeCompendiumSelections(game.settings.get(MODULE_ID, 'customCompendiums'));
}

export function getCompendiumKeysForCategory(category, { includeDefaults = true } = {}) {
  const configured = getConfiguredCompendiumSelections();
  const custom = configured[category] ?? [];
  const defaults = includeDefaults ? getDefaultCompendiumKeys(category) : [];
  return getAllowedCompendiumKeysForCurrentUser(category, defaults, custom);
}

export function normalizeCompendiumSelections(value) {
  const normalized = {};
  for (const category of getCompendiumCategoryKeys()) {
    const keys = Array.isArray(value?.[category]) ? value[category] : [];
    normalized[category] = dedupeStrings(keys);
  }
  return normalized;
}

export async function discoverCompendiumsByCategory({ includeManualCandidates = false } = {}) {
  const categories = {};
  for (const category of getCompendiumCategoryKeys()) {
    categories[category] = [];
  }

  const allPacks = getAllPacks();
  for (const pack of allPacks) {
    const index = await getPackIndex(pack);
    for (const [category, definition] of Object.entries(COMPENDIUM_CATEGORY_DEFINITIONS)) {
      if (!definition.matches(pack, index)) continue;
      const packageName = pack.metadata?.packageName ?? pack.metadata?.package ?? '';
      const defaultKeys = getDefaultCompendiumKeys(category);
      categories[category].push({
        key: pack.collection ?? pack.metadata?.id ?? '',
        label: pack.metadata?.label ?? pack.title ?? pack.collection ?? '',
        packageName,
        packageLabel: resolvePackageLabel(packageName),
        packageAuthors: resolvePackageAuthors(packageName),
        locked: defaultKeys.includes(pack.collection ?? pack.metadata?.id ?? ''),
      });
    }
  }

  if (includeManualCandidates) {
    // Allow GMs to manually assign any Item compendium to any content category.
    for (const category of Object.keys(categories)) {
      const seen = new Set(categories[category].map((pack) => pack.key));
      for (const pack of allPacks) {
        if (!isItemPack(pack)) continue;
        const key = pack.collection ?? pack.metadata?.id ?? '';
        if (!key || seen.has(key)) continue;
        const packageName = pack.metadata?.packageName ?? pack.metadata?.package ?? '';
        categories[category].push({
          key,
          label: pack.metadata?.label ?? pack.title ?? pack.collection ?? '',
          packageName,
          packageLabel: resolvePackageLabel(packageName),
          packageAuthors: resolvePackageAuthors(packageName),
          locked: false,
          manualCandidate: true,
        });
        seen.add(key);
      }
    }
  }

  for (const category of Object.keys(categories)) {
    categories[category].sort((a, b) => a.label.localeCompare(b.label));
  }

  return categories;
}

export async function migrateLegacyFeatCompendiumsSetting() {
  const legacy = game.settings.get(MODULE_ID, 'additionalFeatCompendiums');
  if (!legacy) return false;

  const configured = getConfiguredCompendiumSelections();
  if ((configured.feats ?? []).length > 0) return false;

  const migrated = {
    ...configured,
    feats: dedupeStrings(legacy.split(',').map((key) => key.trim()).filter(Boolean)),
  };

  if (migrated.feats.length === 0) return false;

  await game.settings.set(MODULE_ID, 'customCompendiums', migrated);
  return true;
}

async function getPackIndex(pack) {
  if (!pack) return [];
  if (typeof pack.getIndex === 'function') {
    const index = await pack.getIndex({ fields: ['type', 'system.category', 'system.traits.otherTags'] }).catch(() => null);
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

function dedupeStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.length > 0))];
}

function isItemPack(pack) {
  return pack?.documentName === 'Item'
    || pack?.metadata?.type === 'Item'
    || pack?.metadata?.documentName === 'Item';
}

function isFeatIndexEntry(entry) {
  return getNormalizedEntryType(entry) === 'feat' && !isClassFeatureIndexEntry(entry);
}

function isClassFeatureIndexEntry(entry) {
  const type = getNormalizedEntryType(entry);
  if (type === 'classfeature' || type === 'class-feature') return true;

  const category = getNormalizedEntryCategory(entry);
  if (category === 'classfeature' || category === 'class-feature') return true;

  return false;
}

function isClassFeaturesPack(pack, index) {
  if (hasFeatureLikePackIdentity(pack)) return true;

  const hasClassFeatures = index.some((entry) => isClassFeatureIndexEntry(entry));
  if (!hasClassFeatures) return false;

  return !index.some((entry) => isNonClassFeatureFeatEntry(entry))
    || hasAdditionalRecognizedContentOutside(index, ['classFeatures', 'feats']);
}

function hasNonFeatPackIdentity(pack) {
  return hasActionLikePackIdentity(pack)
    || hasEffectLikePackIdentity(pack)
    || hasFeatureLikePackIdentity(pack)
    || hasFollowerLikePackIdentity(pack)
    || hasSupportLikePackIdentity(pack)
    || hasAncestryLikePackIdentity(pack)
    || hasHeritageLikePackIdentity(pack)
    || hasBackgroundLikePackIdentity(pack)
    || hasClassLikePackIdentity(pack)
    || hasSpellLikePackIdentity(pack)
    || hasEquipmentLikePackIdentity(pack)
    || hasDeityLikePackIdentity(pack);
}

function hasNonActionPackIdentity(pack) {
  return hasFeatureLikePackIdentity(pack)
    || hasFollowerLikePackIdentity(pack)
    || hasSupportLikePackIdentity(pack)
    || hasEffectLikePackIdentity(pack)
    || hasAncestryLikePackIdentity(pack)
    || hasHeritageLikePackIdentity(pack)
    || hasBackgroundLikePackIdentity(pack)
    || hasClassLikePackIdentity(pack)
    || hasSpellLikePackIdentity(pack)
    || hasEquipmentLikePackIdentity(pack)
    || hasDeityLikePackIdentity(pack);
}

function hasFeatureLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  if (/\beffect(?:s)?\b/.test(haystack)) return false;
  if (/\bancestry\b/.test(haystack)) return false;

  return /\bclass[\s-]*feature(?:s)?\b/.test(haystack)
    || /\bfeature(?:s)?\b/.test(haystack);
}

function isNonClassFeatureFeatEntry(entry) {
  return getNormalizedEntryType(entry) === 'feat' && !isClassFeatureIndexEntry(entry);
}

function hasHeritageLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  return /\bheritage(?:s)?\b/.test(haystack);
}

function hasFollowerLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bfollower(?:s)?\b/.test(haystack);
}

function hasSupportLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bsupport\b|\bbenefit(?:s)?\b/.test(haystack);
}

function hasActionLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\baction(?:s)?\b/.test(haystack);
}

function hasEffectLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\beffect(?:s)?\b/.test(haystack);
}

function hasAncestryLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bancestr(?:y|ies)\b/.test(haystack);
}

function hasBackgroundLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bbackground(?:s)?\b/.test(haystack);
}

function hasClassLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  if (hasFeatureLikePackIdentity(pack)) return true;
  return /\bclass(?:es)?\b/.test(haystack);
}

function hasSpellLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bspell(?:s)?\b/.test(haystack);
}

function hasEquipmentLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bequipment\b|\bitem(?:s)?\b|\bweapon(?:s)?\b|\barmor\b/.test(haystack);
}

function hasDeityLikePackIdentity(pack) {
  const haystack = getPackIdentityText(pack);
  if (!haystack) return false;
  if (/\bfeat(?:s)?\b/.test(haystack)) return false;
  return /\bdeit(?:y|ies)\b|\bdomain(?:s)?\b|\bdivine intercession(?:s)?\b/.test(haystack);
}

function hasAdditionalRecognizedContent(index, category) {
  const categories = new Set();

  for (const entry of index ?? []) {
    const type = getNormalizedEntryType(entry);
    const entryCategory = getNormalizedEntryCategory(entry);

    if (type === 'ancestry') categories.add('ancestries');
    else if (type === 'heritage') categories.add('heritages');
    else if (type === 'background') categories.add('backgrounds');
    else if (type === 'class') categories.add('classes');
    else if (type === 'spell') categories.add('spells');
    else if (type === 'action') categories.add('actions');
    else if (type === 'deity') categories.add('deities');
    else if (EQUIPMENT_TYPES.has(type)) categories.add('equipment');
    else if (isClassFeatureIndexEntry(entry) || entryCategory === 'classfeature' || entryCategory === 'class-feature') categories.add('classFeatures');
    else if (isFeatIndexEntry(entry)) categories.add('feats');
  }

  categories.delete(category);
  return categories.size > 0;
}

function hasAdditionalRecognizedContentOutside(index, excludedCategories = []) {
  const categories = getRecognizedContentCategories(index);
  for (const category of excludedCategories) categories.delete(category);
  return categories.size > 0;
}

function getRecognizedContentCategories(index) {
  const categories = new Set();

  for (const entry of index ?? []) {
    const type = getNormalizedEntryType(entry);
    const entryCategory = getNormalizedEntryCategory(entry);

    if (type === 'ancestry') categories.add('ancestries');
    else if (type === 'heritage') categories.add('heritages');
    else if (type === 'background') categories.add('backgrounds');
    else if (type === 'class') categories.add('classes');
    else if (type === 'spell') categories.add('spells');
    else if (type === 'action') categories.add('actions');
    else if (type === 'deity') categories.add('deities');
    else if (EQUIPMENT_TYPES.has(type)) categories.add('equipment');
    else if (isClassFeatureIndexEntry(entry) || entryCategory === 'classfeature' || entryCategory === 'class-feature') categories.add('classFeatures');
    else if (isFeatIndexEntry(entry)) categories.add('feats');
  }

  return categories;
}

function getPackIdentityText(pack) {
  return [
    pack?.metadata?.label,
    pack?.title,
    pack?.collection,
    pack?.metadata?.id,
    pack?.metadata?.name,
    pack?.metadata?.path,
  ]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

function getNormalizedEntryType(entry) {
  return String(entry?.type ?? '').trim().toLowerCase();
}

function getNormalizedEntryCategory(entry) {
  return String(
    entry?.system?.category
      ?? entry?.system?.category?.value
      ?? entry?.category
      ?? '',
  ).trim().toLowerCase();
}

function resolvePackageLabel(packageName) {
  if (!packageName) return '';
  if (game.system?.id === packageName) return game.system.title ?? packageName;
  return game.modules?.get?.(packageName)?.title ?? packageName;
}

function resolvePackageAuthors(packageName) {
  if (!packageName) return '';
  if (game.system?.id === packageName) {
    return normalizeAuthors(game.system?.authors);
  }
  return normalizeAuthors(game.modules?.get?.(packageName)?.authors);
}

function normalizeAuthors(authors) {
  if (!authors) return '';
  if (typeof authors === 'string') return authors;
  if (!Array.isArray(authors)) return '';
  return authors
    .map((author) => {
      if (typeof author === 'string') return author;
      return author?.name ?? author?.title ?? author?.label ?? '';
    })
    .filter(Boolean)
    .join(', ');
}
