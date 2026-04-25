export const SYSTEM_IDS = {
  PF2E: 'pf2e',
  SF2E: 'sf2e',
};

export const ANACHRONISM_MODULE_ID = 'sf2e-anachronism';

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

const ANACHRONISM_DEFAULT_PACKS = {
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

export function getActiveSystemProfile(options = {}) {
  const systemId = getActiveSystemId(options);
  const anachronismActive = systemId === SYSTEM_IDS.PF2E && isAnachronismActive(options);

  if (systemId === SYSTEM_IDS.SF2E) {
    return buildProfile({
      id: SYSTEM_IDS.SF2E,
      contentProfile: SYSTEM_IDS.SF2E,
      defaultPacks: SF2E_DEFAULT_PACKS,
    });
  }

  if (anachronismActive) {
    return buildProfile({
      id: SYSTEM_IDS.PF2E,
      contentProfile: 'pf2e+sf2e-anachronism',
      defaultPacks: mergePackDefaults(PF2E_DEFAULT_PACKS, ANACHRONISM_DEFAULT_PACKS),
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

export function isAnachronismActive(options = {}) {
  const modules = options.modules ?? globalThis.game?.modules;
  const module = getModule(modules, ANACHRONISM_MODULE_ID);
  return module?.active === true;
}

export function getActiveSystemId(options = {}) {
  const rawSystemId = options.systemId ?? globalThis.game?.system?.id ?? SYSTEM_IDS.PF2E;
  const systemId = String(rawSystemId).trim().toLowerCase();
  return systemId === SYSTEM_IDS.SF2E ? SYSTEM_IDS.SF2E : SYSTEM_IDS.PF2E;
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
