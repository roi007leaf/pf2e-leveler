import { ATTRIBUTES, SKILLS, PROFICIENCY_RANKS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getAllPlannedFeats, getAllPlannedBoosts } from './plan-model.js';
import { slugify } from '../utils/pf2e-api.js';

const CLASS_SUBCLASS_TYPES = {
  alchemist: 'research field',
  animist: 'practice',
  barbarian: 'instinct',
  bard: 'muse',
  champion: 'cause',
  cleric: 'doctrine',
  druid: 'order',
  gunslinger: 'way',
  inventor: 'innovation',
  investigator: 'methodology',
  kineticist: 'gate',
  magus: 'study',
  oracle: 'mystery',
  psychic: 'conscious mind',
  ranger: "hunter's edge",
  rogue: 'racket',
  sorcerer: 'bloodline',
  summoner: 'eidolon',
  swashbuckler: 'style',
  witch: 'patron',
  wizard: 'school',
};

export function computeBuildState(actor, plan, atLevel) {
  const classDef = ClassRegistry.get(plan.classSlug);

  return {
    level: atLevel,
    classSlug: plan.classSlug,
    class: computeClassState(classDef, plan.classSlug),
    ancestrySlug: actor?.ancestry?.slug ?? null,
    heritageSlug: actor?.heritage?.slug ?? null,
    backgroundSlug: actor?.background?.slug ?? null,
    attributes: computeAttributes(actor, plan, atLevel),
    skills: computeSkills(actor, plan, atLevel, classDef),
    languages: computeLanguages(actor),
    lores: computeLoreSkills(actor),
    proficiencies: computeProficiencies(actor, classDef, atLevel),
    equipment: computeEquipmentState(actor),
    feats: computeFeats(actor, plan, atLevel),
    deity: computeDeityState(actor),
    spellcasting: computeSpellcastingState(actor, classDef),
    classArchetypeDedications: computeClassArchetypeDedications(actor, plan, atLevel),
    classFeatures: computeClassFeatures(classDef, atLevel),
  };
}

function computeClassState(classDef, classSlug) {
  return {
    slug: classSlug ?? classDef?.slug ?? null,
    hp: classDef?.hp ?? null,
    keyAbility: classDef?.keyAbility ?? [],
    subclassType: CLASS_SUBCLASS_TYPES[classSlug ?? classDef?.slug ?? ''] ?? null,
  };
}

function computeDeityState(actor) {
  const deityItem = getOwnedItems(actor).find((item) => item?.type === 'deity') ?? null;
  const detailsDeity = actor?.system?.details?.deity ?? null;
  const value = deityItem ?? detailsDeity;

  if (!value) return null;

  return {
    slug: value.slug ?? null,
    name: value.name ?? value.value ?? null,
    domains: collectDeityDomains(value),
  };
}

function computeSpellcastingState(actor, classDef) {
  const entries = getOwnedItems(actor).filter((item) => item?.type === 'spellcastingEntry');
  const spells = getOwnedItems(actor).filter((item) => item?.type === 'spell');
  const traditions = new Set(
    entries
      .map((item) => item?.system?.tradition?.value ?? null)
      .filter((value) => typeof value === 'string' && value.length > 0),
  );
  const spellNames = new Set();
  const spellTraits = new Set();

  const classTradition = classDef?.spellcasting?.tradition ?? null;
  if (typeof classTradition === 'string' && !['bloodline', 'patron'].includes(classTradition)) {
    traditions.add(classTradition);
  }

  for (const spell of spells) {
    const spellSlug = slugify(spell?.slug ?? spell?.name ?? '');
    if (spellSlug) spellNames.add(spellSlug);

    const traits = spell?.system?.traits?.value ?? [];
    for (const trait of traits) {
      const normalizedTrait = normalizeEquipmentValue(trait);
      if (normalizedTrait) spellTraits.add(normalizedTrait);
    }
  }

  const hasSpellSlots = entries.some((item) => {
    const systemSlots = item?.system?.slots;
    if (!systemSlots || typeof systemSlots !== 'object') return false;
    return Object.values(systemSlots).some((slot) => {
      if (!slot || typeof slot !== 'object') return false;
      const max = Number(slot.max ?? slot.value ?? 0);
      return Number.isFinite(max) && max > 0;
    });
  }) || !!classDef?.spellcasting?.slots;

  const focusMax = actor?.system?.resources?.focus?.max ?? 0;

  return {
    hasAny: traditions.size > 0,
    hasSpellSlots,
    spellNames,
    spellTraits,
    traditions,
    focusPool: focusMax > 0,
    focusPointsMax: focusMax,
  };
}

function computeAttributes(actor, plan, atLevel) {
  const attrs = {};
  for (const attr of ATTRIBUTES) {
    attrs[attr] = actor?.system?.abilities?.[attr]?.mod ?? 0;
  }

  const actorLevel = Number(actor?.system?.details?.level?.value ?? 1);
  const boosts = getAllPlannedBoosts(plan, atLevel);
  for (const [levelKey, boostList] of Object.entries(boosts)) {
    const level = Number(levelKey);
    if (Number.isFinite(actorLevel) && level <= actorLevel) continue;
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

  applyActorSkillRankRules(skills, actor, atLevel);

  const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats'];

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;

    for (const key of FEAT_KEYS) {
      for (const feat of levelData[key] ?? []) {
        for (const rule of feat.skillRules ?? []) {
          if (!matchesRuleAtLevel(rule, atLevel)) continue;
          if (!SKILLS.includes(rule.skill)) continue;
          skills[rule.skill] = Math.max(skills[rule.skill] ?? PROFICIENCY_RANKS.UNTRAINED, rule.value);
        }
      }
    }

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

function computeLoreSkills(actor) {
  const lores = {};

  for (const item of getOwnedItems(actor)) {
    if (item?.type !== 'lore') continue;

    const slug = slugify(item?.slug ?? item?.name ?? '');
    if (!slug) continue;

    const rank = Number(
      item?.system?.proficient?.value
      ?? item?.system?.proficiency?.value
      ?? item?.system?.rank
      ?? 1,
    );

    if (!Number.isFinite(rank)) continue;
    lores[slug] = Math.max(lores[slug] ?? 0, rank);
  }

  return lores;
}

function computeLanguages(actor) {
  const languages = new Set();
  const known = actor?.system?.details?.languages?.value ?? [];

  for (const language of known) {
    const normalized = normalizeLanguageSlug(language);
    if (normalized) languages.add(normalized);
  }

  return languages;
}

export function applyActorSkillRankRules(skills, actor, atLevel) {
  for (const item of getOwnedItems(actor)) {
    for (const rule of item?.system?.rules ?? []) {
      if (rule?.key !== 'ActiveEffectLike') continue;
      if (!matchesRuleAtLevel(rule, atLevel)) continue;

      const path = resolveInjectedValue(rule.path, item);
      const match = String(path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
      if (!match) continue;

      const skill = match[1];
      if (!SKILLS.includes(skill)) continue;

      const value = Number(resolveInjectedValue(rule.value, item));
      if (!Number.isFinite(value)) continue;

      skills[skill] = Math.max(skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED, value);
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

function computeEquipmentState(actor) {
  const equipment = {
    hasShield: false,
    armorCategories: new Set(),
    weaponCategories: new Set(),
    weaponGroups: new Set(),
    weaponTraits: new Set(),
    wieldedMelee: false,
    wieldedRanged: false,
  };

  for (const item of getOwnedItems(actor)) {
    if (!isEquippedItem(item)) continue;

    if (item?.type === 'armor') {
      const armorCategory = normalizeEquipmentValue(item?.system?.category?.value ?? item?.category);
      if (armorCategory) equipment.armorCategories.add(armorCategory);
      if (isShieldItem(item)) equipment.hasShield = true;
      continue;
    }

    if (item?.type !== 'weapon') continue;

    const category = normalizeEquipmentValue(item?.system?.category?.value ?? item?.category);
    const group = normalizeEquipmentValue(item?.system?.group?.value ?? item?.group);
    const traits = item?.system?.traits?.value ?? [];

    if (category) equipment.weaponCategories.add(category);
    if (group) equipment.weaponGroups.add(group);

    for (const trait of traits) {
      const normalizedTrait = normalizeEquipmentValue(trait);
      if (normalizedTrait) equipment.weaponTraits.add(normalizedTrait);
    }

    if (isRangedWeapon(item)) {
      equipment.wieldedRanged = true;
    } else {
      equipment.wieldedMelee = true;
    }
  }

  return equipment;
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

function computeClassArchetypeDedications(actor, plan, atLevel) {
  const dedications = new Set();

  const existingFeats = actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
  for (const feat of existingFeats) {
    if (isClassArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
  }

  const plannedFeats = getAllPlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    if (isClassArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
  }

  return dedications;
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

function getPrimaryFeatAlias(feat) {
  if (feat?.slug) return feat.slug;

  const name = feat?.name?.trim();
  if (name) return slugify(name);

  return '';
}

function isClassArchetypeDedication(feat) {
  const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  return traits.includes('dedication') && traits.includes('archetype') && traits.includes('class');
}

function getOwnedItems(actor) {
  if (!actor?.items) return [];
  if (Array.isArray(actor.items)) return actor.items;
  if (Array.isArray(actor.items.contents)) return actor.items.contents;
  if (typeof actor.items.filter === 'function') return actor.items.filter(() => true);
  return Array.from(actor.items);
}

function isEquippedItem(item) {
  const carryType = String(item?.system?.equipped?.carryType ?? '').toLowerCase();
  const handsHeld = Number(item?.system?.equipped?.handsHeld ?? 0);
  const inSlot = item?.system?.equipped?.inSlot;

  if (inSlot === true) return true;
  if (handsHeld > 0) return true;
  if (['held', 'worn'].includes(carryType)) return true;

  return false;
}

function isShieldItem(item) {
  const category = normalizeEquipmentValue(item?.system?.category?.value ?? item?.category);
  if (category === 'shield') return true;

  const traits = item?.system?.traits?.value ?? [];
  if (traits.some((trait) => normalizeEquipmentValue(trait) === 'shield')) return true;

  const slug = slugify(item?.slug ?? item?.name ?? '');
  return slug.includes('shield');
}

function isRangedWeapon(item) {
  const traits = (item?.system?.traits?.value ?? []).map((trait) => normalizeEquipmentValue(trait));
  if (traits.some((trait) => trait?.startsWith('thrown'))) return false;

  const rangeIncrement = item?.system?.range?.increment ?? item?.system?.range?.value ?? null;
  if (typeof rangeIncrement === 'number') return rangeIncrement > 0;

  if (typeof rangeIncrement === 'string') {
    const normalized = rangeIncrement.trim().toLowerCase();
    return normalized.length > 0 && normalized !== 'null';
  }

  return false;
}

function normalizeEquipmentValue(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeLanguageSlug(value) {
  const normalized = normalizeEquipmentValue(value);
  if (!normalized) return null;
  if (normalized === 'ancient-osiriani' || normalized === 'ancient osiriani') return 'osiriani';
  return normalized;
}

function collectDeityDomains(value) {
  const domains = new Set();
  const source = value?.system?.domains ?? value?.domains ?? null;
  if (!source || typeof source !== 'object') return domains;

  for (const list of [source.primary, source.alternate]) {
    if (!Array.isArray(list)) continue;
    for (const domain of list) {
      const normalized = normalizeEquipmentValue(domain);
      if (normalized) domains.add(normalized);
    }
  }

  return domains;
}

function matchesRuleAtLevel(rule, atLevel) {
  const predicate = rule?.predicate;
  if (!predicate) return true;
  return evaluatePredicate(predicate, atLevel);
}

function evaluatePredicate(predicate, atLevel) {
  if (typeof predicate === 'string') return matchesPredicateString(predicate, atLevel);
  if (Array.isArray(predicate)) return predicate.every((entry) => evaluatePredicate(entry, atLevel));
  if (!predicate || typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.and)) return predicate.and.every((entry) => evaluatePredicate(entry, atLevel));
  if (Array.isArray(predicate.or)) return predicate.or.some((entry) => evaluatePredicate(entry, atLevel));
  if ('not' in predicate) return !evaluatePredicate(predicate.not, atLevel);
  if (Array.isArray(predicate.nor)) return predicate.nor.every((entry) => !evaluatePredicate(entry, atLevel));
  if (Array.isArray(predicate.gte)) return comparePredicate('gte', predicate.gte, atLevel);
  if (Array.isArray(predicate.gt)) return comparePredicate('gt', predicate.gt, atLevel);
  if (Array.isArray(predicate.lte)) return comparePredicate('lte', predicate.lte, atLevel);
  if (Array.isArray(predicate.lt)) return comparePredicate('lt', predicate.lt, atLevel);
  if (Array.isArray(predicate.eq)) return comparePredicate('eq', predicate.eq, atLevel);
  return true;
}

function matchesPredicateString(predicate, atLevel) {
  const text = String(predicate ?? '').toLowerCase();
  const levelMatch = text.match(/^self:level:(\d+)$/);
  if (levelMatch) return atLevel >= Number(levelMatch[1]);
  return true;
}

function comparePredicate(kind, args, atLevel) {
  if (!Array.isArray(args) || args.length < 2) return true;
  const [left, right] = args;
  const leftValue = normalizePredicateOperand(left, atLevel);
  const rightValue = normalizePredicateOperand(right, atLevel);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return true;

  switch (kind) {
    case 'gte': return leftValue >= rightValue;
    case 'gt': return leftValue > rightValue;
    case 'lte': return leftValue <= rightValue;
    case 'lt': return leftValue < rightValue;
    case 'eq': return leftValue === rightValue;
    default: return true;
  }
}

function normalizePredicateOperand(value, atLevel) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').toLowerCase();
  if (text === 'self:level') return atLevel;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function resolveInjectedValue(value, item) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{item\|([^}]+)\}/g, (_match, path) => {
    const resolved = foundry.utils.getProperty(item, path);
    return resolved == null ? '' : String(resolved);
  });
}
