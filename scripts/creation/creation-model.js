const CURRENT_VERSION = 1;
const HANDLER_SELECTION_KEYS = [
  'implement',
  'tactics',
  'ikons',
  'innovationItem',
  'innovationModification',
  'kineticGateMode',
  'secondElement',
  'kineticImpulses',
  'subconsciousMind',
  'thesis',
  'apparitions',
  'primaryApparition',
  'deity',
  'sanctification',
  'divineFont',
  'devotionSpell',
];

function createEmptyHandlerSelections() {
  return {
    implement: null,
    tactics: [],
    ikons: [],
    innovationItem: null,
    innovationModification: null,
    kineticGateMode: null,
    secondElement: null,
    kineticImpulses: [],
    subconsciousMind: null,
    thesis: null,
    apparitions: [],
    primaryApparition: null,
    deity: null,
    sanctification: null,
    divineFont: null,
    devotionSpell: null,
  };
}

function cloneSelectionValue(value) {
  return foundry.utils.deepClone(value);
}

function isMeaningfulSelectionValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== null && value !== undefined && value !== '';
}

function syncPrimaryHandlerSelectionMirrors(data) {
  const bucket = getClassSelectionData(data, 'class');
  for (const key of HANDLER_SELECTION_KEYS) {
    data[key] = cloneSelectionValue(bucket[key]);
  }
}

function resetHandlerSelections(data, target = 'class') {
  data.classSelections[target] = createEmptyHandlerSelections();
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data.classSelections[target];
}

export function ensureClassSelections(data) {
  data.classSelections ??= {};
  data.classSelections.class ??= createEmptyHandlerSelections();
  data.classSelections.dualClass ??= createEmptyHandlerSelections();
  return data.classSelections;
}

export function getClassSelectionData(data, target = 'class') {
  ensureClassSelections(data);
  data.classSelections[target] ??= createEmptyHandlerSelections();
  if (target === 'class') {
    for (const key of HANDLER_SELECTION_KEYS) {
      if (!isMeaningfulSelectionValue(data.classSelections.class[key]) && isMeaningfulSelectionValue(data[key])) {
        data.classSelections.class[key] = cloneSelectionValue(data[key]);
      }
    }
  }
  return data.classSelections[target];
}

export function normalizeCreationData(data) {
  ensureClassSelections(data);
  if (data.subclass) data.subclass.choiceCurricula ??= {};
  if (data.dualSubclass) data.dualSubclass.choiceCurricula ??= {};
  data.featGrants = normalizeFeatGrants(data.featGrants);
  data.grantedFeatChoices = normalizeGrantedFeatChoices(
    data.grantedFeatChoices,
    data.grantedFeatSections,
  );

  for (const key of HANDLER_SELECTION_KEYS) {
    const primaryBucket = data.classSelections.class;
    if (!isMeaningfulSelectionValue(primaryBucket[key]) && isMeaningfulSelectionValue(data[key])) {
      primaryBucket[key] = cloneSelectionValue(data[key]);
    }
  }

  syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

function normalizeFeatGrants(grants) {
  if (!Array.isArray(grants)) return [];
  return grants
    .filter((entry) => entry?.requirementId && entry?.kind)
    .map((entry) => ({
      requirementId: String(entry.requirementId),
      sourceFeatUuid: entry.sourceFeatUuid ?? null,
      sourceFeatName: entry.sourceFeatName ?? null,
      kind: entry.kind,
      manual: entry.manual && typeof entry.manual === 'object' ? foundry.utils.deepClone(entry.manual) : undefined,
      selections: Array.isArray(entry.selections)
        ? entry.selections
          .filter((selection) => selection?.uuid)
          .map((selection) => foundry.utils.deepClone(selection))
        : [],
    }));
}

function normalizeGrantedFeatChoices(choices, sections) {
  const source = choices && typeof choices === 'object' ? choices : {};
  const normalized = {};

  for (const section of sections ?? []) {
    const slot = String(section?.slot ?? '').trim();
    if (!slot) continue;

    const directValue = source[slot];
    const nestedValue = foundry.utils.getProperty(source, slot);
    const value = directValue && typeof directValue === 'object'
      ? directValue
      : nestedValue && typeof nestedValue === 'object'
        ? nestedValue
        : null;

    if (value) normalized[slot] = foundry.utils.deepClone(value);
  }

  for (const [key, value] of Object.entries(source)) {
    if (normalized[key] || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    normalized[key] = foundry.utils.deepClone(value);
  }

  return normalized;
}

export function getGrantedFeatChoiceValues(data, slot) {
  const key = String(slot ?? '').trim();
  if (!key) return {};
  const source = data?.grantedFeatChoices;
  if (!source || typeof source !== 'object') return {};

  const direct = source[key];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) return direct;

  const nested = foundry.utils.getProperty(source, key);
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;

  return {};
}

function setHandlerSelection(data, key, value, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  bucket[key] = value;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return bucket;
}

export function createCreationData() {
  const data = {
    version: CURRENT_VERSION,
    ancestry: null,
    heritage: null,
    mixedAncestry: null,
    background: null,
    class: null,
    dualClass: null,
    subclass: null,
    dualSubclass: null,
    classSelections: {
      class: createEmptyHandlerSelections(),
      dualClass: createEmptyHandlerSelections(),
    },
    implement: null,
    tactics: [],
    ikons: [],
    innovationItem: null,
    innovationModification: null,
    kineticGateMode: null,
    secondElement: null,
    kineticImpulses: [],
    subconsciousMind: null,
    thesis: null,
    apparitions: [],
    primaryApparition: null,
    deity: null,
    sanctification: null,
    divineFont: null,
    devotionSpell: null,
    alternateAncestryBoosts: false,
    boosts: {
      free: [],
    },
    languages: [],
    lores: [],
    selectedLoreSkills: [],
    skills: [],
    ancestryFeat: null,
    ancestryParagonFeat: null,
    classFeat: null,
    dualClassFeat: null,
    skillFeat: null,
    grantedFeatSections: [],
    grantedFeatChoices: {},
    featGrants: [],
    spells: { cantrips: [], rank1: [] },
    dualSpells: { cantrips: [], rank1: [] },
    curriculumSpells: { cantrips: [], rank1: [] },
    dualCurriculumSpells: { cantrips: [], rank1: [] },
    equipment: [],
  };
  syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

function clearBoostsForPrefix(data, prefix) {
  for (const key of Object.keys(data.boosts)) {
    if (key.startsWith(prefix)) delete data.boosts[key];
  }
}

export function setAncestry(data, item) {
  data.ancestry = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug ?? null,
        traits: cloneTraitList(item),
      }
    : null;
  data.heritage = null;
  data.mixedAncestry = null;
  data.languages = [];
  data.ancestryFeat = null;
  data.ancestryParagonFeat = null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  clearBoostsForPrefix(data, 'ancestry');
  return data;
}

export function setHeritage(data, item, grantedSkills = []) {
  data.heritage = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug ?? null,
        traits: cloneTraitList(item),
        grantedSkills: Array.isArray(grantedSkills) ? [...grantedSkills] : [],
      }
    : null;
  if (
    (item?.slug ?? null) !== 'mixed-ancestry' &&
    (item?.uuid ?? null) !== 'pf2e-leveler.synthetic.heritage.mixed-ancestry'
  ) {
    data.mixedAncestry = null;
  }
  data.ancestryFeat = null;
  data.ancestryParagonFeat = null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  return data;
}

export function setMixedAncestry(data, item) {
  data.mixedAncestry = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug ?? null,
        traits: cloneTraitList(item),
      }
    : null;
  return data;
}

function cloneTraitList(item) {
  const traits = Array.isArray(item?.traits) ? item.traits : item?.system?.traits?.value;
  return Array.isArray(traits) ? [...traits] : [];
}

export function setBackground(data, item) {
  data.background = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug ?? null }
    : null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  clearBoostsForPrefix(data, 'background');
  return data;
}

export function setClass(data, item) {
  data.class = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        sourcePack: item.sourcePack ?? null,
        sourcePackage: item.sourcePackage ?? null,
        keyAbility: Array.isArray(item.keyAbility) ? [...item.keyAbility] : null,
        subclassTag: typeof item.subclassTag === 'string' ? item.subclassTag : null,
      }
    : null;
  data.dualClass = null;
  data.subclass = null;
  data.dualSubclass = null;
  resetHandlerSelections(data, 'class');
  resetHandlerSelections(data, 'dualClass');
  data.classFeat = null;
  data.dualClassFeat = null;
  data.skillFeat = null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  data.spells = { cantrips: [], rank1: [] };
  data.dualSpells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  data.dualCurriculumSpells = { cantrips: [], rank1: [] };
  clearBoostsForPrefix(data, 'class');
  return data;
}

export function setDualClass(data, item) {
  data.dualClass = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        sourcePack: item.sourcePack ?? null,
        sourcePackage: item.sourcePackage ?? null,
        keyAbility: Array.isArray(item.keyAbility) ? [...item.keyAbility] : null,
        subclassTag: typeof item.subclassTag === 'string' ? item.subclassTag : null,
      }
    : null;
  data.dualSubclass = null;
  resetHandlerSelections(data, 'dualClass');
  data.dualClassFeat = null;
  data.dualSpells = { cantrips: [], rank1: [] };
  data.dualCurriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function setImplement(data, item, target = 'class') {
  setHandlerSelection(
    data,
    'implement',
    item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null,
    target,
  );
  return data;
}

export function toggleTactic(data, item, max = 5, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  if (!bucket.tactics) bucket.tactics = [];
  const index = bucket.tactics.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    bucket.tactics.splice(index, 1);
    if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
    return data;
  }

  if (bucket.tactics.length >= max) return data;
  bucket.tactics.push(item);
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function toggleIkon(data, item, max = 3, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  if (!bucket.ikons) bucket.ikons = [];
  const index = bucket.ikons.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    bucket.ikons.splice(index, 1);
    if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
    return data;
  }

  if (bucket.ikons.length >= max) return data;
  bucket.ikons.push(item);
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setInnovationItem(data, item, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  bucket.innovationItem = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        category: item.category ?? null,
        traits: item.traits ?? [],
        usage: item.usage ?? null,
        range: item.range ?? null,
      }
    : null;
  bucket.innovationModification = null;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setInnovationModification(data, item, target = 'class') {
  setHandlerSelection(
    data,
    'innovationModification',
    item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null,
    target,
  );
  return data;
}

export function setKineticGateMode(data, value, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  bucket.kineticGateMode = value;
  if (value !== 'dual-gate') bucket.secondElement = null;
  bucket.kineticImpulses = [];
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setSecondElement(data, item, target = 'class') {
  const subclass = target === 'dualClass' ? data.dualSubclass : data.subclass;
  if (item && subclass?.uuid === item.uuid) return data;
  const bucket = getClassSelectionData(data, target);
  bucket.secondElement = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null;
  bucket.kineticImpulses = [];
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function toggleKineticImpulse(data, item, max = 2, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  if (!bucket.kineticImpulses) bucket.kineticImpulses = [];
  const index = bucket.kineticImpulses.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    bucket.kineticImpulses.splice(index, 1);
    if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
    return data;
  }

  if (bucket.kineticImpulses.length >= max) return data;
  if (bucket.kineticGateMode === 'dual-gate' && bucket.kineticImpulses.length === 1) {
    const existingElement = bucket.kineticImpulses[0]?.element;
    if (existingElement && item.element === existingElement) return data;
  }
  bucket.kineticImpulses.push(item);
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setSubconsciousMind(data, item, target = 'class') {
  setHandlerSelection(
    data,
    'subconsciousMind',
    item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        keyAbility: item.keyAbility ?? null,
      }
    : null,
    target,
  );

  if (target === 'class' && data.class?.slug === 'psychic') {
    data.boosts.class = item?.keyAbility ? [item.keyAbility] : [];
  }

  return data;
}

export function setThesis(data, item, target = 'class') {
  setHandlerSelection(
    data,
    'thesis',
    item ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug } : null,
    target,
  );
  return data;
}

export function toggleApparition(data, item, max = 2, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  if (!bucket.apparitions) bucket.apparitions = [];
  const index = bucket.apparitions.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    bucket.apparitions.splice(index, 1);
    if (bucket.primaryApparition === item.uuid) {
      bucket.primaryApparition = bucket.apparitions[0]?.uuid ?? null;
    }
    if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
    return data;
  }

  if (bucket.apparitions.length >= max) return data;

  bucket.apparitions.push(item);
  if (!bucket.primaryApparition) bucket.primaryApparition = item.uuid;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setPrimaryApparition(data, uuid, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  if (!bucket.apparitions?.some((entry) => entry.uuid === uuid)) return data;
  bucket.primaryApparition = uuid;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setSubclass(
  data,
  item,
  tradition,
  spellUuids,
  grantedSkills,
  grantedLores,
  choiceSets,
  curriculum,
) {
  data.subclass = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        tradition,
        spellUuids,
        grantedSkills,
        grantedLores,
        choiceSets,
        choices: {},
        choiceCurricula: {},
        curriculum,
      }
    : null;
  const bucket = getClassSelectionData(data, 'class');
  bucket.innovationItem = null;
  bucket.innovationModification = null;
  bucket.kineticGateMode = null;
  bucket.secondElement = null;
  bucket.kineticImpulses = [];
  syncPrimaryHandlerSelectionMirrors(data);
  data.spells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function setDualSubclass(
  data,
  item,
  tradition,
  spellUuids,
  grantedSkills,
  grantedLores,
  choiceSets,
  curriculum,
) {
  data.dualSubclass = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        tradition,
        spellUuids,
        grantedSkills,
        grantedLores,
        choiceSets,
        choices: {},
        choiceCurricula: {},
        curriculum,
      }
    : null;
  const bucket = getClassSelectionData(data, 'dualClass');
  bucket.innovationItem = null;
  bucket.innovationModification = null;
  bucket.kineticGateMode = null;
  bucket.secondElement = null;
  bucket.kineticImpulses = [];
  data.dualSpells = { cantrips: [], rank1: [] };
  data.dualCurriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function addCurriculumCantrip(data, spell, target = 'primary') {
  const store = getCurriculumSpellStore(data, target);
  store.cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeCurriculumCantrip(data, uuid, target = 'primary') {
  const store = getCurriculumSpellStore(data, target);
  const idx = store.cantrips.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) store.cantrips.splice(idx, 1);
  return data;
}

export function addCurriculumRank1(data, spell, target = 'primary') {
  const store = getCurriculumSpellStore(data, target);
  store.rank1.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeCurriculumRank1(data, uuid, target = 'primary') {
  const store = getCurriculumSpellStore(data, target);
  const idx = store.rank1.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) store.rank1.splice(idx, 1);
  return data;
}

export function setSubclassChoice(data, flag, value, metadata = {}) {
  if (!data.subclass) return data;
  if (!data.subclass.choices) data.subclass.choices = {};
  data.subclass.choiceCurricula ??= {};
  data.subclass.choices[flag] = value;
  if (metadata.curriculum && Object.keys(metadata.curriculum).length > 0) data.subclass.choiceCurricula[flag] = foundry.utils.deepClone(metadata.curriculum);
  else delete data.subclass.choiceCurricula[flag];
  data.spells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function setDualSubclassChoice(data, flag, value, metadata = {}) {
  if (!data.dualSubclass) return data;
  if (!data.dualSubclass.choices) data.dualSubclass.choices = {};
  data.dualSubclass.choiceCurricula ??= {};
  data.dualSubclass.choices[flag] = value;
  if (metadata.curriculum && Object.keys(metadata.curriculum).length > 0) data.dualSubclass.choiceCurricula[flag] = foundry.utils.deepClone(metadata.curriculum);
  else delete data.dualSubclass.choiceCurricula[flag];
  data.dualSpells = { cantrips: [], rank1: [] };
  data.dualCurriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function getEffectiveSubclassCurriculum(subclass) {
  const merged = {};
  mergeCurriculumRanks(merged, subclass?.curriculum);
  for (const curriculum of Object.values(subclass?.choiceCurricula ?? {})) {
    mergeCurriculumRanks(merged, curriculum);
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

function mergeCurriculumRanks(target, curriculum) {
  if (!curriculum || typeof curriculum !== 'object') return;

  for (const [rank, uuids] of Object.entries(curriculum)) {
    if (!Array.isArray(uuids) || uuids.length === 0) continue;
    target[rank] ??= [];
    for (const uuid of uuids) {
      if (typeof uuid !== 'string' || target[rank].includes(uuid)) continue;
      target[rank].push(uuid);
    }
  }
}

export function getAllBoosts(data) {
  const all = [];
  for (const val of Object.values(data.boosts ?? {})) {
    if (Array.isArray(val)) all.push(...val);
    else if (typeof val === 'string') all.push(val);
  }
  return all;
}

export function setDeity(data, item) {
  return setTargetedDeity(data, item, 'class');
}

export function setTargetedDeity(data, item, target = 'class') {
  const normalizedFont = normalizeDivineFontList(item?.font ?? []);
  const bucket = getClassSelectionData(data, target);
  bucket.deity = item
    ? {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        font: normalizedFont,
        sanctification: item.sanctification ?? {},
        domains: item.domains ?? { primary: [], alternate: [] },
        skill: item.skill ?? null,
      }
    : null;
  // Auto-set sanctification / divine font if deity only allows one option
  const font = normalizedFont;
  const sanctWhat = item?.sanctification?.what ?? [];
  const sanctModal = item?.sanctification?.modal ?? 'can';
  bucket.divineFont = font.length === 1 ? font[0] : null;
  if (sanctWhat.length === 1 && sanctModal === 'must') bucket.sanctification = sanctWhat[0];
  else bucket.sanctification = null;
  bucket.devotionSpell = null;
  if (target === 'dualClass') data.dualSubclass = null;
  else data.subclass = null;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setSanctification(data, value, target = 'class') {
  const bucket = getClassSelectionData(data, target);
  bucket.sanctification = value;
  if (target === 'dualClass') data.dualSubclass = null;
  else data.subclass = null;
  if (target === 'class') syncPrimaryHandlerSelectionMirrors(data);
  return data;
}

export function setDivineFont(data, value, target = 'class') {
  setHandlerSelection(data, 'divineFont', normalizeDivineFont(value), target);
  return data;
}

function normalizeDivineFontList(fonts) {
  return (Array.isArray(fonts) ? fonts : [])
    .map((font) => normalizeDivineFont(font))
    .filter(Boolean);
}

function normalizeDivineFont(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['healing', 'heal'].includes(normalized)) return 'healing';
  if (['harmful', 'harming', 'harm'].includes(normalized)) return 'harmful';
  return normalized || null;
}

export function setSkills(data, skills) {
  data.skills = skills;
  return data;
}

export function setLanguages(data, languages) {
  data.languages = languages;
  return data;
}

export function setLores(data, lores) {
  data.lores = lores;
  return data;
}

export function setSelectedLoreSkills(data, lores) {
  data.selectedLoreSkills = lores;
  return data;
}

export function setAncestryFeat(
  data,
  feat,
  choiceSets = [],
  grantedSkills = [],
  grantedLores = [],
) {
  data.ancestryFeat = feat
    ? {
        uuid: feat.uuid,
        name: feat.name,
        slug: feat.slug,
        img: feat.img,
        choiceSets,
        grantedSkills,
        grantedLores,
        choices: {},
      }
    : null;
  return data;
}

export function setAncestryParagonFeat(
  data,
  feat,
  choiceSets = [],
  grantedSkills = [],
  grantedLores = [],
) {
  data.ancestryParagonFeat = feat
    ? {
        uuid: feat.uuid,
        name: feat.name,
        slug: feat.slug,
        img: feat.img,
        choiceSets,
        grantedSkills,
        grantedLores,
        choices: {},
      }
    : null;
  return data;
}

export function setClassFeat(data, feat, choiceSets = [], grantedSkills = [], grantedLores = []) {
  data.classFeat = feat
    ? {
        uuid: feat.uuid,
        name: feat.name,
        slug: feat.slug,
        img: feat.img,
        choiceSets,
        grantedSkills,
        grantedLores,
        choices: {},
      }
    : null;
  return data;
}

export function setDualClassFeat(data, feat, choiceSets = [], grantedSkills = [], grantedLores = []) {
  data.dualClassFeat = feat
    ? {
        uuid: feat.uuid,
        name: feat.name,
        slug: feat.slug,
        img: feat.img,
        choiceSets,
        grantedSkills,
        grantedLores,
        choices: {},
      }
    : null;
  return data;
}

export function setSkillFeat(data, feat, choiceSets = [], grantedSkills = [], grantedLores = []) {
  data.skillFeat = feat
    ? {
        uuid: feat.uuid,
        name: feat.name,
        slug: feat.slug,
        img: feat.img,
        choiceSets,
        grantedSkills,
        grantedLores,
        choices: {},
      }
    : null;
  return data;
}

export function setFeatChoice(data, slot, flag, value, metadata = {}) {
  const target =
    slot === 'ancestry'
      ? data.ancestryFeat
      : slot === 'ancestryParagon'
        ? data.ancestryParagonFeat
        : slot === 'class'
          ? data.classFeat
          : slot === 'dualClass'
            ? data.dualClassFeat
          : slot === 'skill'
            ? data.skillFeat
            : null;
  if (target) {
    if (!target.choices) target.choices = {};
    target.choices[flag] = value;
    applyFeatChoiceCurriculumMetadata(data, metadata.target, flag, metadata.curriculum);
    return data;
  }

  if (!data.grantedFeatChoices) data.grantedFeatChoices = {};
  if (!data.grantedFeatChoices[slot]) data.grantedFeatChoices[slot] = {};
  data.grantedFeatChoices[slot][flag] = value;
  applyFeatChoiceCurriculumMetadata(data, metadata.target, flag, metadata.curriculum);
  return data;
}

export function upsertCreationFeatGrant(data, grantEntry) {
  if (!grantEntry?.requirementId) return data;
  data.featGrants = normalizeFeatGrants(data.featGrants);
  const next = {
    requirementId: grantEntry.requirementId,
    sourceFeatUuid: grantEntry.sourceFeatUuid ?? null,
    sourceFeatName: grantEntry.sourceFeatName ?? null,
    kind: grantEntry.kind,
    manual: grantEntry.manual ? foundry.utils.deepClone(grantEntry.manual) : undefined,
    selections: Array.isArray(grantEntry.selections) ? foundry.utils.deepClone(grantEntry.selections) : [],
  };
  const index = data.featGrants.findIndex((entry) => entry.requirementId === next.requirementId);
  if (index >= 0) data.featGrants[index] = next;
  else data.featGrants.push(next);
  return data;
}

export function removeCreationFeatGrantSelection(data, requirementId, uuid) {
  data.featGrants = normalizeFeatGrants(data.featGrants)
    .map((entry) => {
      if (entry.requirementId !== requirementId) return entry;
      return {
        ...entry,
        selections: (entry.selections ?? []).filter((selection) => selection?.uuid !== uuid),
      };
    })
    .filter((entry) => (entry.selections ?? []).length > 0 || entry.manual);
  return data;
}

function applyFeatChoiceCurriculumMetadata(data, target, flag, curriculum) {
  const normalizedTarget = target === 'dualClass' ? 'dualClass' : target === 'class' ? 'class' : null;
  if (!normalizedTarget || !flag) return;

  const subclass = normalizedTarget === 'dualClass' ? data.dualSubclass : data.subclass;
  if (!subclass) return;

  subclass.choiceCurricula ??= {};
  if (curriculum && Object.keys(curriculum).length > 0) {
    subclass.choiceCurricula[flag] = foundry.utils.deepClone(curriculum);
  } else {
    delete subclass.choiceCurricula[flag];
  }

  if (normalizedTarget === 'dualClass') {
    data.dualCurriculumSpells = { cantrips: [], rank1: [] };
  } else {
    data.curriculumSpells = { cantrips: [], rank1: [] };
  }
}

export function setGrantedFeatSections(data, sections) {
  data.grantedFeatSections = sections ?? [];
  const validSlots = new Set(data.grantedFeatSections.map((section) => section.slot));
  const currentChoices = data.grantedFeatChoices ?? {};
  data.grantedFeatChoices = Object.fromEntries(
    Object.entries(currentChoices).filter(([slot]) => validSlots.has(slot)),
  );
  return data;
}

export function addEquipment(data, item, quantity = 1) {
  if (!data.equipment) data.equipment = [];
  const existing = data.equipment.find((e) => e.uuid === item.uuid);
  if (existing) {
    existing.quantity = (existing.quantity ?? 1) + quantity;
  } else {
    const price = item.system?.price?.value ?? null;
    const pricePer = Number(item.system?.price?.per ?? 1) || 1;
    data.equipment.push({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      quantity,
      price,
      pricePer,
    });
  }
  return data;
}

export function removeEquipment(data, uuid) {
  data.equipment = (data.equipment ?? []).filter((e) => e.uuid !== uuid);
  return data;
}

export function setPermanentItem(data, slotIndex, item) {
  if (!data.permanentItems) data.permanentItems = [];
  data.permanentItems[slotIndex] = {
    uuid: item.uuid,
    name: item.name,
    img: item.img,
    itemLevel: item.system?.level?.value ?? 0,
    price: item.system?.price?.value ?? null,
  };
  return data;
}

export function removePermanentItem(data, slotIndex) {
  if (!data.permanentItems) return data;
  data.permanentItems[slotIndex] = null;
  return data;
}

export function addSpell(data, spell, isCantrip, target = 'primary') {
  const store = getSpellStore(data, target);
  const list = isCantrip ? store.cantrips : store.rank1;
  list.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeSpell(data, uuid, isCantrip, target = 'primary') {
  const store = getSpellStore(data, target);
  const list = isCantrip ? store.cantrips : store.rank1;
  const idx = list.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) list.splice(idx, 1);
  return data;
}

function getSpellStore(data, target) {
  if (target === 'secondary') {
    data.dualSpells ??= { cantrips: [], rank1: [] };
    data.dualSpells.cantrips ??= [];
    data.dualSpells.rank1 ??= [];
    return data.dualSpells;
  }
  data.spells ??= { cantrips: [], rank1: [] };
  data.spells.cantrips ??= [];
  data.spells.rank1 ??= [];
  return data.spells;
}

function getCurriculumSpellStore(data, target) {
  if (target === 'secondary') {
    data.dualCurriculumSpells ??= { cantrips: [], rank1: [] };
    data.dualCurriculumSpells.cantrips ??= [];
    data.dualCurriculumSpells.rank1 ??= [];
    return data.dualCurriculumSpells;
  }
  data.curriculumSpells ??= { cantrips: [], rank1: [] };
  data.curriculumSpells.cantrips ??= [];
  data.curriculumSpells.rank1 ??= [];
  return data.curriculumSpells;
}
