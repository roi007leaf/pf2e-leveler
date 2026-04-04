import { ATTRIBUTES, SKILLS, PROFICIENCY_RANKS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getAllPlannedFeats, getAllPlannedBoosts } from './plan-model.js';
import { slugify } from '../utils/pf2e-api.js';

export function computeBuildState(actor, plan, atLevel) {
  const classDef = ClassRegistry.get(plan.classSlug);

  return {
    level: atLevel,
    classSlug: plan.classSlug,
    ancestrySlug: actor?.ancestry?.slug ?? null,
    heritageSlug: actor?.heritage?.slug ?? null,
    attributes: computeAttributes(actor, plan, atLevel),
    skills: computeSkills(actor, plan, atLevel, classDef),
    proficiencies: computeProficiencies(actor, classDef, atLevel),
    feats: computeFeats(actor, plan, atLevel),
    classFeatures: computeClassFeatures(classDef, atLevel),
  };
}

function computeAttributes(actor, plan, atLevel) {
  const attrs = {};
  for (const attr of ATTRIBUTES) {
    attrs[attr] = actor?.system?.abilities?.[attr]?.mod ?? 0;
  }

  const boosts = getAllPlannedBoosts(plan, atLevel);
  for (const [_level, boostList] of Object.entries(boosts)) {
    for (const attr of boostList) {
      if (attrs[attr] >= 4) {
        attrs[attr] += 0.5;
      } else {
        attrs[attr] += 1;
      }
    }
  }

  for (const attr of ATTRIBUTES) {
    attrs[attr] = Math.trunc(attrs[attr]);
  }

  return attrs;
}

function computeSkills(actor, plan, atLevel, classDef) {
  const skills = {};
  for (const skill of SKILLS) {
    skills[skill] = actor?.system?.skills?.[skill]?.rank ?? PROFICIENCY_RANKS.UNTRAINED;
  }

  if (classDef?.trainedSkills?.fixed) {
    for (const skill of classDef.trainedSkills.fixed) {
      if (skills[skill] < PROFICIENCY_RANKS.TRAINED) {
        skills[skill] = PROFICIENCY_RANKS.TRAINED;
      }
    }
  }

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;

    for (const skill of levelData.intBonusSkills ?? []) {
      if ((skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED) < PROFICIENCY_RANKS.TRAINED) {
        skills[skill] = PROFICIENCY_RANKS.TRAINED;
      }
    }

    for (const inc of levelData.skillIncreases ?? []) {
      if (inc.skill && inc.toRank > (skills[inc.skill] ?? 0)) {
        skills[inc.skill] = inc.toRank;
      }
    }
  }

  return skills;
}

function computeProficiencies(actor, classDef, atLevel) {
  const proficiencies = {
    perception: actor?.system?.perception?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    fortitude: actor?.system?.saves?.fortitude?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    reflex: actor?.system?.saves?.reflex?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    will: actor?.system?.saves?.will?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    classdc: actor?.system?.attributes?.classDC?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
  };

  for (const feature of classDef?.classFeatures ?? []) {
    if (feature.level > atLevel) continue;
    applyClassFeatureProficiency(proficiencies, feature);
  }

  return proficiencies;
}

function applyClassFeatureProficiency(proficiencies, feature) {
  const key = String(feature.key ?? '');
  const name = String(feature.name ?? '').toLowerCase();

  if (key.includes('perception-legend') || name.includes('perception legend')) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.LEGENDARY);
  } else if (key.includes('perception-mastery') || name.includes('perception mastery') || key.includes('perception-mastery')) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.MASTER);
  } else if (key.includes('perception-expertise') || key.includes('perception-expert') || name.includes('perception expertise') || name.includes('perception expert')) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('fortitude-legend') || name.includes('fortitude legend')) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.LEGENDARY);
  } else if (key.includes('fortress-of-will') || key.includes('greater-fortitude') || key.includes('fortitude-mastery') || name.includes('fortitude mastery')) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.MASTER);
  } else if (key.includes('fortitude-expertise') || key.includes('fortitude-expert') || name.includes('fortitude expertise') || name.includes('fortitude expert') || key.includes('magical-fortitude')) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('reflex-legend') || name.includes('reflex legend')) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.LEGENDARY);
  } else if (key.includes('greater-natural-reflexes') || key.includes('greater-rogue-reflexes') || key.includes('tempered-reflexes') || key.includes('reflex-mastery') || name.includes('reflex mastery')) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('reflex-expertise')
    || key.includes('reflex-expert')
    || name.includes('reflex expertise')
    || name.includes('reflex expert')
    || key.includes('lightning-reflexes')
    || key.includes('evasive-reflexes')
    || key.includes('natural-reflexes')
    || key.includes('shared-reflexes')
    || key.includes('premonitions-reflexes')
  ) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('will-legend') || name.includes('will legend')) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.LEGENDARY);
  } else if (
    key.includes('greater-dogged-will')
    || key.includes('prodigious-will')
    || key.includes('will-of-the-pupil')
    || key.includes('majestic-will')
    || key.includes('walls-of-will')
    || key.includes('divine-will')
    || key.includes('indomitable-will')
    || key.includes('wild-willpower')
    || name.includes('will mastery')
  ) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('will-expertise')
    || key.includes('will-expert')
    || key.includes('dogged-will')
    || key.includes('commanding-will')
    || name.includes('will expertise')
    || name.includes('will expert')
  ) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('class-dc-mastery') || name.includes('class dc mastery')) {
    proficiencies.classdc = Math.max(proficiencies.classdc, PROFICIENCY_RANKS.MASTER);
  } else if (key.includes('class-dc-expertise') || name.includes('class dc expertise')) {
    proficiencies.classdc = Math.max(proficiencies.classdc, PROFICIENCY_RANKS.EXPERT);
  }
}

function computeFeats(actor, plan, atLevel) {
  const feats = new Set();

  const existingFeats = actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
  for (const feat of existingFeats) {
    for (const alias of getFeatAliases(feat)) feats.add(alias);
  }

  const plannedFeats = getAllPlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    for (const alias of getFeatAliases(feat)) feats.add(alias);
  }

  if (actor?.system?.resources?.focus?.max > 0) feats.add('focus-pool');

  return feats;
}

function computeClassFeatures(classDef, atLevel) {
  if (!classDef?.classFeatures) return new Set();

  const features = new Set();
  for (const feature of classDef.classFeatures) {
    if (feature.level <= atLevel) {
      features.add(feature.key);
      if (feature.name) features.add(slugify(feature.name));
    }
  }
  return features;
}

function getFeatAliases(feat) {
  const aliases = new Set();

  if (feat?.slug) aliases.add(feat.slug);

  const name = feat?.name?.trim();
  if (name) {
    aliases.add(slugify(name));

    const baseName = name.replace(/\s*\([^)]*\)\s*$/u, '').trim();
    if (baseName && baseName !== name) aliases.add(slugify(baseName));
  }

  return aliases;
}
