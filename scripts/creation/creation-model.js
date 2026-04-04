const CURRENT_VERSION = 1;

export function createCreationData() {
  return {
    version: CURRENT_VERSION,
    ancestry: null,
    heritage: null,
    background: null,
    class: null,
    subclass: null,
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
    skills: [],
    ancestryFeat: null,
    classFeat: null,
    grantedFeatSections: [],
    grantedFeatChoices: {},
    spells: { cantrips: [], rank1: [] },
    curriculumSpells: { cantrips: [], rank1: [] },
  };
}

function clearBoostsForPrefix(data, prefix) {
  for (const key of Object.keys(data.boosts)) {
    if (key.startsWith(prefix)) delete data.boosts[key];
  }
}

export function setAncestry(data, item) {
  data.ancestry = item ? { uuid: item.uuid, name: item.name, img: item.img } : null;
  data.heritage = null;
  data.languages = [];
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  clearBoostsForPrefix(data, 'ancestry');
  return data;
}

export function setHeritage(data, item) {
  data.heritage = item ? { uuid: item.uuid, name: item.name, img: item.img } : null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  return data;
}

export function setBackground(data, item) {
  data.background = item ? { uuid: item.uuid, name: item.name, img: item.img } : null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  clearBoostsForPrefix(data, 'background');
  return data;
}

export function setClass(data, item) {
  data.class = item ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug } : null;
  data.subclass = null;
  data.implement = null;
  data.tactics = [];
  data.ikons = [];
  data.innovationItem = null;
  data.innovationModification = null;
  data.kineticGateMode = null;
  data.secondElement = null;
  data.kineticImpulses = [];
  data.subconsciousMind = null;
  data.thesis = null;
  data.apparitions = [];
  data.primaryApparition = null;
  data.deity = null;
  data.divineFont = null;
  data.devotionSpell = null;
  data.classFeat = null;
  data.grantedFeatSections = [];
  data.grantedFeatChoices = {};
  data.spells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  clearBoostsForPrefix(data, 'class');
  return data;
}

export function setImplement(data, item) {
  data.implement = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null;
  return data;
}

export function toggleTactic(data, item, max = 5) {
  if (!data.tactics) data.tactics = [];
  const index = data.tactics.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    data.tactics.splice(index, 1);
    return data;
  }

  if (data.tactics.length >= max) return data;
  data.tactics.push(item);
  return data;
}

export function toggleIkon(data, item, max = 3) {
  if (!data.ikons) data.ikons = [];
  const index = data.ikons.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    data.ikons.splice(index, 1);
    return data;
  }

  if (data.ikons.length >= max) return data;
  data.ikons.push(item);
  return data;
}

export function setInnovationItem(data, item) {
  data.innovationItem = item
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
  data.innovationModification = null;
  return data;
}

export function setInnovationModification(data, item) {
  data.innovationModification = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null;
  return data;
}

export function setKineticGateMode(data, value) {
  data.kineticGateMode = value;
  if (value !== 'dual-gate') data.secondElement = null;
  data.kineticImpulses = [];
  return data;
}

export function setSecondElement(data, item) {
  if (item && data.subclass?.uuid === item.uuid) return data;
  data.secondElement = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null;
  data.kineticImpulses = [];
  return data;
}

export function toggleKineticImpulse(data, item, max = 2) {
  if (!data.kineticImpulses) data.kineticImpulses = [];
  const index = data.kineticImpulses.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    data.kineticImpulses.splice(index, 1);
    return data;
  }

  if (data.kineticImpulses.length >= max) return data;
  if (data.kineticGateMode === 'dual-gate' && data.kineticImpulses.length === 1) {
    const existingElement = data.kineticImpulses[0]?.element;
    if (existingElement && item.element === existingElement) return data;
  }
  data.kineticImpulses.push(item);
  return data;
}

export function setSubconsciousMind(data, item) {
  data.subconsciousMind = item
    ? {
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      slug: item.slug,
      keyAbility: item.keyAbility ?? null,
    }
    : null;

  if (data.class?.slug === 'psychic') {
    data.boosts.class = item?.keyAbility ? [item.keyAbility] : [];
  }

  return data;
}

export function setThesis(data, item) {
  data.thesis = item
    ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug }
    : null;
  return data;
}

export function toggleApparition(data, item, max = 2) {
  if (!data.apparitions) data.apparitions = [];
  const index = data.apparitions.findIndex((entry) => entry.uuid === item.uuid);
  if (index >= 0) {
    data.apparitions.splice(index, 1);
    if (data.primaryApparition === item.uuid) {
      data.primaryApparition = data.apparitions[0]?.uuid ?? null;
    }
    return data;
  }

  if (data.apparitions.length >= max) return data;

  data.apparitions.push(item);
  if (!data.primaryApparition) data.primaryApparition = item.uuid;
  return data;
}

export function setPrimaryApparition(data, uuid) {
  if (!data.apparitions?.some((entry) => entry.uuid === uuid)) return data;
  data.primaryApparition = uuid;
  return data;
}

export function setSubclass(data, item, tradition, spellUuids, grantedSkills, grantedLores, choiceSets, curriculum) {
  data.subclass = item ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug, tradition, spellUuids, grantedSkills, grantedLores, choiceSets, choices: {}, curriculum } : null;
  data.innovationItem = null;
  data.innovationModification = null;
  data.kineticGateMode = null;
  data.secondElement = null;
  data.kineticImpulses = [];
  data.spells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  return data;
}

export function addCurriculumCantrip(data, spell) {
  if (!data.curriculumSpells) data.curriculumSpells = { cantrips: [], rank1: [] };
  if (!data.curriculumSpells.cantrips) data.curriculumSpells.cantrips = [];
  data.curriculumSpells.cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeCurriculumCantrip(data, uuid) {
  if (!data.curriculumSpells?.cantrips) return data;
  const idx = data.curriculumSpells.cantrips.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) data.curriculumSpells.cantrips.splice(idx, 1);
  return data;
}

export function addCurriculumRank1(data, spell) {
  if (!data.curriculumSpells) data.curriculumSpells = { cantrips: [], rank1: [] };
  if (!data.curriculumSpells.rank1) data.curriculumSpells.rank1 = [];
  data.curriculumSpells.rank1.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeCurriculumRank1(data, uuid) {
  if (!data.curriculumSpells) return data;
  const idx = data.curriculumSpells.rank1.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) data.curriculumSpells.rank1.splice(idx, 1);
  return data;
}

export function setSubclassChoice(data, flag, value) {
  if (!data.subclass) return data;
  if (!data.subclass.choices) data.subclass.choices = {};
  data.subclass.choices[flag] = value;
  data.spells = { cantrips: [], rank1: [] };
  data.curriculumSpells = { cantrips: [], rank1: [] };
  return data;
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
  data.deity = item ? { uuid: item.uuid, name: item.name, img: item.img, font: item.font ?? [], sanctification: item.sanctification ?? {} } : null;
  // Auto-set sanctification / divine font if deity only allows one option
  const font = item?.font ?? [];
  const sanctWhat = item?.sanctification?.what ?? [];
  const sanctModal = item?.sanctification?.modal ?? 'can';
  data.divineFont = font.length === 1 ? font[0] : null;
  if (sanctWhat.length === 1 && sanctModal === 'must') data.sanctification = sanctWhat[0];
  else data.sanctification = null;
  data.subclass = null;
  data.devotionSpell = null;
  return data;
}

export function setSanctification(data, value) {
  data.sanctification = value;
  data.subclass = null;
  return data;
}

export function setDivineFont(data, value) {
  data.divineFont = value;
  return data;
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

export function setAncestryFeat(data, feat, choiceSets = []) {
  data.ancestryFeat = feat
    ? { uuid: feat.uuid, name: feat.name, slug: feat.slug, img: feat.img, choiceSets, choices: {} }
    : null;
  return data;
}

export function setClassFeat(data, feat, choiceSets = []) {
  data.classFeat = feat
    ? { uuid: feat.uuid, name: feat.name, slug: feat.slug, img: feat.img, choiceSets, choices: {} }
    : null;
  return data;
}

export function setFeatChoice(data, slot, flag, value) {
  const target = slot === 'ancestry' ? data.ancestryFeat : slot === 'class' ? data.classFeat : null;
  if (target) {
    if (!target.choices) target.choices = {};
    target.choices[flag] = value;
    return data;
  }

  if (!data.grantedFeatChoices) data.grantedFeatChoices = {};
  if (!data.grantedFeatChoices[slot]) data.grantedFeatChoices[slot] = {};
  data.grantedFeatChoices[slot][flag] = value;
  return data;
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

export function addSpell(data, spell, isCantrip) {
  const list = isCantrip ? data.spells.cantrips : data.spells.rank1;
  list.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  return data;
}

export function removeSpell(data, uuid, isCantrip) {
  const list = isCantrip ? data.spells.cantrips : data.spells.rank1;
  const idx = list.findIndex((s) => s.uuid === uuid);
  if (idx >= 0) list.splice(idx, 1);
  return data;
}
