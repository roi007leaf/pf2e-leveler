import { ATTRIBUTES, SKILLS, PROFICIENCY_RANKS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getAllPlannedFeats, getAllPlannedSkillIncreases, getAllPlannedBoosts } from './plan-model.js';

export function computeBuildState(actor, plan, atLevel) {
  const classDef = ClassRegistry.get(plan.classSlug);

  return {
    level: atLevel,
    classSlug: plan.classSlug,
    ancestrySlug: actor?.ancestry?.slug ?? null,
    heritageSlug: actor?.heritage?.slug ?? null,
    attributes: computeAttributes(actor, plan, atLevel),
    skills: computeSkills(actor, plan, atLevel, classDef),
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

  const increases = getAllPlannedSkillIncreases(plan, atLevel);
  for (const inc of increases) {
    if (inc.skill && inc.toRank > (skills[inc.skill] ?? 0)) {
      skills[inc.skill] = inc.toRank;
    }
  }

  return skills;
}

function computeFeats(actor, plan, atLevel) {
  const feats = new Set();

  const existingFeats = actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
  for (const feat of existingFeats) {
    if (feat.slug) feats.add(feat.slug);
  }

  const plannedFeats = getAllPlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    if (feat.slug) feats.add(feat.slug);
  }

  return feats;
}

function computeClassFeatures(classDef, atLevel) {
  if (!classDef?.classFeatures) return new Set();

  const features = new Set();
  for (const feature of classDef.classFeatures) {
    if (feature.level <= atLevel) {
      features.add(feature.key);
    }
  }
  return features;
}
