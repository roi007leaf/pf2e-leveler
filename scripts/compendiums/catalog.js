import { MODULE_ID } from '../constants.js';

export const COMPENDIUM_CATEGORY_DEFINITIONS = {
  ancestries: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.ANCESTRIES',
    defaultKeys: ['pf2e.ancestries'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'ancestry'),
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
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'class'),
  },
  feats: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.FEATS',
    defaultKeys: ['pf2e.feats-srd'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'feat'),
  },
  classFeatures: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.CLASS_FEATURES',
    defaultKeys: ['pf2e.classfeatures'],
    matches: (pack) => {
      const metadata = `${pack.metadata?.id ?? ''} ${pack.metadata?.label ?? ''}`.toLowerCase();
      return isItemPack(pack) && (metadata.includes('classfeature') || metadata.includes('class feature'));
    },
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
    defaultKeys: ['pf2e.actionspf2e'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'action'),
  },
  deities: {
    labelKey: 'PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.DEITIES',
    defaultKeys: ['pf2e.deities'],
    matches: (pack, index) => isItemPack(pack) && index.some((entry) => entry.type === 'deity'),
  },
};

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'equipment', 'consumable', 'treasure', 'backpack', 'shield', 'kit']);

export function getCompendiumCategoryKeys() {
  return Object.keys(COMPENDIUM_CATEGORY_DEFINITIONS);
}

export function getDefaultCompendiumKeys(category) {
  return [...(COMPENDIUM_CATEGORY_DEFINITIONS[category]?.defaultKeys ?? [])];
}

export function getConfiguredCompendiumSelections() {
  return normalizeCompendiumSelections(game.settings.get(MODULE_ID, 'customCompendiums'));
}

export function getCompendiumKeysForCategory(category, { includeDefaults = true } = {}) {
  const configured = getConfiguredCompendiumSelections();
  const custom = configured[category] ?? [];
  if (!includeDefaults) return [...custom];
  return dedupeStrings([...getDefaultCompendiumKeys(category), ...custom]);
}

export function normalizeCompendiumSelections(value) {
  const normalized = {};
  for (const category of getCompendiumCategoryKeys()) {
    const keys = Array.isArray(value?.[category]) ? value[category] : [];
    normalized[category] = dedupeStrings(keys);
  }
  return normalized;
}

export async function discoverCompendiumsByCategory() {
  const categories = {};
  for (const category of getCompendiumCategoryKeys()) {
    categories[category] = [];
  }

  for (const pack of getAllPacks()) {
    const index = await getPackIndex(pack);
    for (const [category, definition] of Object.entries(COMPENDIUM_CATEGORY_DEFINITIONS)) {
      if (!definition.matches(pack, index)) continue;
      const packageName = pack.metadata?.packageName ?? pack.metadata?.package ?? '';
      categories[category].push({
        key: pack.collection ?? pack.metadata?.id ?? '',
        label: pack.metadata?.label ?? pack.title ?? pack.collection ?? '',
        packageName,
        packageLabel: resolvePackageLabel(packageName),
        locked: definition.defaultKeys.includes(pack.collection ?? pack.metadata?.id ?? ''),
      });
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
    const index = await pack.getIndex().catch(() => null);
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

function resolvePackageLabel(packageName) {
  if (!packageName) return '';
  if (game.system?.id === packageName) return game.system.title ?? packageName;
  return game.modules?.get?.(packageName)?.title ?? packageName;
}
