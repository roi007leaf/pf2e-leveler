const CURRENT_VERSION = 1;

export function createCreationData() {
  return {
    version: CURRENT_VERSION,
    ancestry: null,
    heritage: null,
    background: null,
    class: null,
    subclass: null,
    boosts: {
      free: [],
    },
    skills: [],
    ancestryFeat: null,
    classFeat: null,
    spells: { cantrips: [], rank1: [] },
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
  clearBoostsForPrefix(data, 'ancestry');
  return data;
}

export function setHeritage(data, item) {
  data.heritage = item ? { uuid: item.uuid, name: item.name, img: item.img } : null;
  return data;
}

export function setBackground(data, item) {
  data.background = item ? { uuid: item.uuid, name: item.name, img: item.img } : null;
  clearBoostsForPrefix(data, 'background');
  return data;
}

export function setClass(data, item) {
  data.class = item ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug } : null;
  data.subclass = null;
  data.classFeat = null;
  data.spells = { cantrips: [], rank1: [] };
  clearBoostsForPrefix(data, 'class');
  return data;
}

export function setSubclass(data, item, tradition, grantedSpells, grantedSkills) {
  data.subclass = item ? { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug, tradition, grantedSpells, grantedSkills } : null;
  data.spells = { cantrips: [], rank1: [] };
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

export function setSkills(data, skills) {
  data.skills = skills;
  return data;
}

export function setAncestryFeat(data, feat) {
  data.ancestryFeat = feat
    ? { uuid: feat.uuid, name: feat.name, slug: feat.slug, img: feat.img }
    : null;
  return data;
}

export function setClassFeat(data, feat) {
  data.classFeat = feat
    ? { uuid: feat.uuid, name: feat.name, slug: feat.slug, img: feat.img }
    : null;
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
