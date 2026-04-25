export const SYSTEM_IDS = {
  PF2E: 'pf2e',
  SF2E: 'sf2e',
};

export const SF2E_ANACHRONISM_MODULE_ID = 'sf2e-anachronism';
export const PF2E_ANACHRONISM_MODULE_ID = 'pf2e-anachronism';
export const ANACHRONISM_MODULE_ID = SF2E_ANACHRONISM_MODULE_ID;

const PF2E_DEFAULT_PACKS = {
  ancestries: ['pf2e.ancestries'],
  heritages: ['pf2e.heritages', 'pf2e.ancestryfeatures'],
  backgrounds: ['pf2e.backgrounds'],
  classes: ['pf2e.classes'],
  feats: ['pf2e.feats-srd'],
  classFeatures: ['pf2e.classfeatures'],
  spells: ['pf2e.spells-srd'],
  equipment: ['pf2e.equipment-srd'],
  actions: ['pf2e.actionspf2e'],
  deities: ['pf2e.deities'],
};

const SF2E_DEFAULT_PACKS = {
  ancestries: ['sf2e.ancestries'],
  heritages: ['sf2e.heritages'],
  backgrounds: ['sf2e.backgrounds'],
  classes: ['sf2e.classes'],
  feats: ['sf2e.feats'],
  classFeatures: ['sf2e.class-features'],
  spells: ['sf2e.spells'],
  equipment: ['sf2e.equipment'],
  actions: ['sf2e.actions'],
  deities: ['sf2e.deities'],
};

const SF2E_ANACHRONISM_DEFAULT_PACKS = {
  ancestries: ['sf2e-anachronism.ancestries'],
  heritages: ['sf2e-anachronism.heritages'],
  backgrounds: ['sf2e-anachronism.backgrounds'],
  classes: ['sf2e-anachronism.classes'],
  feats: ['sf2e-anachronism.feats'],
  classFeatures: ['sf2e-anachronism.class-features'],
  spells: ['sf2e-anachronism.spells'],
  equipment: ['sf2e-anachronism.equipment'],
  actions: ['sf2e-anachronism.actions'],
  deities: ['sf2e-anachronism.deities'],
};

const PF2E_ANACHRONISM_DEFAULT_PACKS = {
  ancestries: ['pf2e-anachronism.ancestries'],
  heritages: ['pf2e-anachronism.heritages', 'pf2e-anachronism.ancestry-features'],
  backgrounds: ['pf2e-anachronism.backgrounds'],
  classes: ['pf2e-anachronism.classes'],
  feats: ['pf2e-anachronism.feats'],
  classFeatures: ['pf2e-anachronism.class-features'],
  spells: ['pf2e-anachronism.spells'],
  equipment: ['pf2e-anachronism.equipment'],
  actions: ['pf2e-anachronism.actions'],
  deities: ['pf2e-anachronism.deities'],
};

export function getActiveSystemProfile(options = {}) {
  const systemId = getActiveSystemId(options);
  const sf2eAnachronismActive = systemId === SYSTEM_IDS.PF2E && isSf2eAnachronismActive(options);
  const pf2eAnachronismActive = systemId === SYSTEM_IDS.SF2E && isPf2eAnachronismActive(options);

  if (systemId === SYSTEM_IDS.SF2E) {
    if (pf2eAnachronismActive) {
      return buildProfile({
        id: SYSTEM_IDS.SF2E,
        contentProfile: 'sf2e+pf2e-anachronism',
        defaultPacks: mergePackDefaults(SF2E_DEFAULT_PACKS, PF2E_ANACHRONISM_DEFAULT_PACKS),
      });
    }

    return buildProfile({
      id: SYSTEM_IDS.SF2E,
      contentProfile: SYSTEM_IDS.SF2E,
      defaultPacks: SF2E_DEFAULT_PACKS,
    });
  }

  if (sf2eAnachronismActive) {
    return buildProfile({
      id: SYSTEM_IDS.PF2E,
      contentProfile: 'pf2e+sf2e-anachronism',
      defaultPacks: mergePackDefaults(PF2E_DEFAULT_PACKS, SF2E_ANACHRONISM_DEFAULT_PACKS),
    });
  }

  return buildProfile({
    id: SYSTEM_IDS.PF2E,
    contentProfile: SYSTEM_IDS.PF2E,
    defaultPacks: PF2E_DEFAULT_PACKS,
  });
}

export function getDefaultPackKeysForCategory(category, options = {}) {
  const profile = getActiveSystemProfile(options);
  return [...(profile.defaultPacks[category] ?? [])];
}

export function isPackAllowedForActiveProfile(packOrKey, options = {}) {
  const packKey = getPackKey(packOrKey);
  const packageName = getPackageName(packOrKey, packKey);
  const systemId = getActiveSystemId(options);

  if (packageName === SYSTEM_IDS.PF2E) return systemId === SYSTEM_IDS.PF2E;
  if (packageName === SYSTEM_IDS.SF2E) return systemId === SYSTEM_IDS.SF2E;
  if (packageName === SF2E_ANACHRONISM_MODULE_ID) {
    return systemId === SYSTEM_IDS.PF2E && isSf2eAnachronismActive(options);
  }
  if (packageName === PF2E_ANACHRONISM_MODULE_ID) {
    return systemId === SYSTEM_IDS.SF2E && isPf2eAnachronismActive(options);
  }

  return true;
}

export function getCompendiumPacksForCategory(category, options = {}) {
  const root = options.root ?? globalThis;
  const packs = options.packs ?? root.game?.packs;
  return getDefaultPackKeysForCategory(category, options)
    .map((packKey) => getPack(packs, packKey))
    .filter(Boolean);
}

export function buildCompendiumUuid(category, documentId, options = {}) {
  const documentName = options.documentName ?? 'Item';
  const packKey = options.packKey ?? getDefaultPackKeysForCategory(category, options)[0];
  const id = String(documentId ?? '').trim();
  if (!packKey || !id) return null;
  return `Compendium.${packKey}.${documentName}.${id}`;
}

export function parseCompendiumUuid(uuid) {
  const match = /^Compendium\.([^.]+)\.([^.]+)\.([^.]+)\.(.+)$/.exec(String(uuid ?? '').trim());
  if (!match) return null;
  const [, packageName, packName, documentName, documentId] = match;
  return {
    packageName,
    packName,
    packKey: `${packageName}.${packName}`,
    documentName,
    documentId,
  };
}

export function isCompendiumUuidInCategory(uuid, category, options = {}) {
  const parsed = parseCompendiumUuid(uuid);
  if (!parsed) return false;
  return getDefaultPackKeysForCategory(category, options).includes(parsed.packKey);
}

export function extractCompendiumUuidsByCategory(text, category, options = {}) {
  const value = String(text ?? '');
  if (!value) return [];

  const uuids = new Set();
  const linkPattern = /@UUID\[(Compendium\.[^\]]+)\]/g;
  const dataPattern = /data-uuid=["'](Compendium\.[^"']+)["']/g;

  for (const match of value.matchAll(linkPattern)) {
    if (isCompendiumUuidInCategory(match[1], category, options)) uuids.add(match[1]);
  }
  for (const match of value.matchAll(dataPattern)) {
    if (isCompendiumUuidInCategory(match[1], category, options)) uuids.add(match[1]);
  }

  return [...uuids];
}

export function isAnachronismActive(options = {}) {
  return isSf2eAnachronismActive(options);
}

export function isSf2eAnachronismActive(options = {}) {
  const modules = options.modules ?? globalThis.game?.modules;
  const module = getModule(modules, SF2E_ANACHRONISM_MODULE_ID);
  return module?.active === true;
}

export function isPf2eAnachronismActive(options = {}) {
  const modules = options.modules ?? globalThis.game?.modules;
  const module = getModule(modules, PF2E_ANACHRONISM_MODULE_ID);
  return module?.active === true;
}

export function getActiveSystemId(options = {}) {
  const root = options.root ?? globalThis;
  const rawSystemId = options.systemId ?? root.game?.system?.id ?? SYSTEM_IDS.PF2E;
  const systemId = String(rawSystemId).trim().toLowerCase();
  return systemId === SYSTEM_IDS.SF2E ? SYSTEM_IDS.SF2E : SYSTEM_IDS.PF2E;
}

export function getSystemSetting(settingId, options = {}) {
  const root = options.root ?? globalThis;
  const settings = options.settings ?? root.game?.settings;
  if (!settings || typeof settings.get !== 'function') return options.fallback;

  try {
    const value = settings.get(getActiveSystemId(options), settingId);
    return value === undefined ? options.fallback : value;
  } catch {
    return options.fallback;
  }
}

export function resolveSystemPredicate(options = {}) {
  const root = options.root ?? globalThis;
  const systemId = getActiveSystemId(options);
  const primary = getPredicateForSystem(root, systemId);
  if (primary) return primary;
  return getPredicateForSystem(root, SYSTEM_IDS.PF2E)
    ?? getPredicateForSystem(root, SYSTEM_IDS.SF2E)
    ?? null;
}

export function getRulesetConfig(options = {}) {
  const root = options.root ?? globalThis;
  const systemId = getActiveSystemId(options);
  return getConfigForSystem(root, systemId)
    ?? getConfigForSystem(root, SYSTEM_IDS.PF2E)
    ?? {};
}

export function getCampaignLanguages(options = {}) {
  const root = options.root ?? globalThis;
  const systemId = getActiveSystemId(options);
  return getSystemGameNamespace(root, systemId)?.settings?.campaign?.languages
    ?? getSystemGameNamespace(root, SYSTEM_IDS.PF2E)?.settings?.campaign?.languages
    ?? null;
}

function buildProfile({ id, contentProfile, defaultPacks }) {
  return {
    id,
    contentProfile,
    defaultPacks: clonePackDefaults(defaultPacks),
  };
}

function mergePackDefaults(...defaults) {
  const merged = {};
  for (const source of defaults) {
    for (const [category, keys] of Object.entries(source)) {
      merged[category] = [...(merged[category] ?? []), ...keys];
    }
  }
  return merged;
}

function clonePackDefaults(defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([category, keys]) => [category, [...keys]]),
  );
}

function getModule(modules, id) {
  if (!modules) return null;
  if (typeof modules.get === 'function') return modules.get(id) ?? null;
  if (Array.isArray(modules)) return modules.find((entry) => entry?.id === id) ?? null;
  if (Array.isArray(modules.contents)) return modules.contents.find((entry) => entry?.id === id) ?? null;
  return modules[id] ?? null;
}

function getPack(packs, packKey) {
  if (!packs) return null;
  if (typeof packs.get === 'function') return packs.get(packKey) ?? null;

  const values = Array.isArray(packs.contents)
    ? packs.contents
    : Array.isArray(packs)
      ? packs
      : Object.values(packs);
  return values.find((entry) => entry?.collection === packKey) ?? null;
}

function getPackKey(packOrKey) {
  if (typeof packOrKey === 'string') return packOrKey;
  return packOrKey?.collection ?? packOrKey?.metadata?.id ?? '';
}

function getPackageName(packOrKey, packKey) {
  if (typeof packOrKey !== 'string') {
    const packageName = packOrKey?.metadata?.packageName ?? packOrKey?.metadata?.package;
    if (packageName) return String(packageName);
  }
  return String(packKey ?? '').split('.')[0] ?? '';
}

function getPredicateForSystem(root, systemId) {
  const namespace = getSystemGameNamespace(root, systemId);
  if (namespace?.Predicate) return namespace.Predicate;

  const globalUpperKey = systemId.toUpperCase();
  return root[globalUpperKey]?.Predicate
    ?? root[systemId]?.Predicate
    ?? null;
}

function getConfigForSystem(root, systemId) {
  return root.CONFIG?.[systemId.toUpperCase()] ?? null;
}

function getSystemGameNamespace(root, systemId) {
  return root.game?.[systemId] ?? null;
}
