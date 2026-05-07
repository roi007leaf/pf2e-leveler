import {
  ANCESTRY_TRAIT_ALIASES,
  ATTRIBUTES,
  MIXED_ANCESTRY_CHOICE_FLAG,
  MIXED_ANCESTRY_UUID,
  MAX_LEVEL,
  SKILLS,
  PROFICIENCY_RANKS,
} from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { SUBCLASS_SPELLS } from '../data/subclass-spells.js';
import { getAllPlannedFeats, getAllPlannedBoosts, getAllPlannedSpells } from './plan-model.js';
import { isDualClassEnabled, slugify } from '../utils/pf2e-api.js';
import { getDedicationAliasesFromDescription } from '../utils/feat-aliases.js';
import { evaluatePredicate } from '../utils/predicate.js';
import { normalizeSkillSlug } from '../utils/skill-slugs.js';
import { getFeatLoreRules, getFeatSkillRules, PLAN_FEAT_KEYS } from '../utils/feat-skill-rules.js';

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

const VARIABLE_SPELLCASTING_TRADITIONS = new Set(['bloodline', 'patron']);
const SECOND_DEDICATION_EXCEPTION_SLUGS = new Set(['cavalier-dedication']);
const PLAN_DEDICATION_PROGRESS_VERSION = 1;

export function computeBuildState(actor, plan, atLevel) {
  const classDef = ClassRegistry.get(plan.classSlug);
  const dualClassSlug = getTrackedDualClassSlug(plan);
  const dualClassDef = dualClassSlug ? ClassRegistry.get(dualClassSlug) : null;
  const classes = computeTrackedClasses([
    { classDef, slug: plan.classSlug },
    { classDef: dualClassDef, slug: dualClassSlug },
  ]);

  return {
    level: atLevel,
    classSlug: plan.classSlug,
    dualClassSlug,
    class: classes[0] ?? computeClassState(classDef, plan.classSlug),
    dualClass: classes[1] ?? null,
    classes,
    ancestrySlug: actor?.ancestry?.slug ?? null,
    heritageSlug: actor?.heritage?.slug ?? null,
    heritageAliases: computeHeritageAliases(actor, plan, atLevel),
    ancestryTraits: computeAncestryTraits(actor, plan, atLevel),
    backgroundSlug: actor?.background?.slug ?? null,
    attributes: computeAttributes(actor, plan, atLevel),
    rawAttributes: computeAttributes(actor, plan, atLevel, { raw: true }),
    skills: computeSkills(actor, plan, atLevel, classDef),
    languages: computeLanguages(actor),
    lores: computeLoreSkills(actor, plan, atLevel),
    proficiencies: computeProficiencies(actor, [classDef, dualClassDef], atLevel),
    weaponProficiencies: computeWeaponProficiencies(actor),
    equipment: computeEquipmentState(actor),
    feats: computeFeats(actor, plan, atLevel),
    featAliasSources: computeFeatAliasSources(actor, plan, atLevel),
    deity: computeDeityState(actor),
    divineFont: computeDivineFontState(actor),
    spellcasting: computeSpellcastingState(actor, plan, atLevel, [classDef, dualClassDef]),
    archetypeDedications: computeArchetypeDedications(actor, plan, atLevel),
    archetypeDedicationProgress: computeArchetypeDedicationProgress(actor, plan, atLevel),
    incompleteArchetypeDedications: computeIncompleteArchetypeDedications(actor, plan, atLevel),
    canTakeNewArchetypeDedication: canTakeNewArchetypeDedication(actor, plan, atLevel),
    classArchetypeDedications: computeClassArchetypeDedications(actor, plan, atLevel),
    classArchetypeTraits: computeClassArchetypeTraits(actor, plan, atLevel),
    classFeatures: computeClassFeatures(actor, plan, [classDef, dualClassDef], atLevel),
    senses: computeSenses(actor),
  };
}

function getTrackedDualClassSlug(plan) {
  if (!isDualClassEnabled()) return null;
  const dualClassSlug = String(plan?.dualClassSlug ?? '')
    .trim()
    .toLowerCase();
  if (
    !dualClassSlug ||
    dualClassSlug ===
      String(plan?.classSlug ?? '')
        .trim()
        .toLowerCase()
  )
    return null;
  return ClassRegistry.has(dualClassSlug) ? dualClassSlug : null;
}

function getEffectivePlannedFeats(plan, atLevel) {
  const removed = getActiveRetrainedFeatOriginals(plan, atLevel);
  const feats = getAllPlannedFeats(plan, atLevel).filter((feat) => !matchesAnyFeatIdentity(feat, removed));

  for (const retrain of getActiveFeatRetrains(plan, atLevel)) {
    if (retrain?.replacement) feats.push(retrain.replacement);
  }

  return feats;
}

function getEffectiveActorFeats(actor, plan, atLevel) {
  const removed = getActiveRetrainedFeatOriginals(plan, atLevel);
  return (actor?.items?.filter?.((item) => item?.type === 'feat') ?? [])
    .filter((feat) => !matchesAnyFeatIdentity(feat, removed));
}

function getEffectiveCharacterFeats(actor, plan, atLevel) {
  return [
    ...getEffectiveActorFeats(actor, plan, atLevel),
    ...getEffectivePlannedFeats(plan, atLevel),
  ];
}

function getEffectivePlannedFeatsForLevel(plan, level, atLevel = level) {
  return getEffectivePlannedFeatEntriesForLevel(plan, level, atLevel).map((entry) => entry.feat);
}

function getEffectivePlannedFeatEntriesForLevel(plan, level, atLevel = level) {
  const levelData = plan?.levels?.[level];
  const removed = getActiveRetrainedFeatOriginals(plan, atLevel);
  const entries = [];

  for (const key of PLAN_FEAT_KEYS) {
    for (const feat of levelData?.[key] ?? []) {
      if (!matchesAnyFeatIdentity(feat, removed)) entries.push({ feat, category: key });
    }
  }

  if (level <= atLevel) {
    for (const retrain of levelData?.retrainedFeats ?? []) {
      if (retrain?.replacement) entries.push({ feat: retrain.replacement, category: retrain.category });
    }
  }

  return entries;
}

function getEffectiveLevelSkillIncreases(plan, level, atLevel = level) {
  const levelData = plan?.levels?.[level];
  const removed = getActiveRetrainedSkillIncreaseOriginals(plan, atLevel);
  const increases = [
    ...(levelData?.skillIncreases ?? []),
    ...(levelData?.customSkillIncreases ?? []),
  ].filter((increase) => !matchesAnySkillIncrease(increase, level, removed));

  if (level <= atLevel) {
    for (const retrain of levelData?.retrainedSkillIncreases ?? []) {
      if (retrain?.replacement) increases.push(retrain.replacement);
    }
  }

  return increases;
}

function getActiveFeatRetrains(plan, atLevel) {
  const retrains = [];
  for (let level = 1; level <= atLevel; level++) {
    retrains.push(...(plan?.levels?.[level]?.retrainedFeats ?? []));
  }
  return retrains;
}

function getActiveRetrainedFeatOriginals(plan, atLevel) {
  return getActiveFeatRetrains(plan, atLevel)
    .map((retrain) => retrain?.original)
    .filter(Boolean);
}

function getActiveRetrainedSkillIncreaseOriginals(plan, atLevel) {
  const originals = [];
  for (let level = 1; level <= atLevel; level++) {
    for (const retrain of plan?.levels?.[level]?.retrainedSkillIncreases ?? []) {
      if (retrain?.original) originals.push({ ...retrain.original, fromLevel: retrain.fromLevel });
    }
  }
  return originals;
}

function matchesAnyFeatIdentity(feat, candidates) {
  return candidates.some((candidate) => matchesFeatIdentity(feat, candidate));
}

function matchesFeatIdentity(feat, candidate) {
  if (!feat || !candidate) return false;
  const featIds = [
    feat.actorItemId,
    feat.id,
    feat._id,
    feat.uuid,
    feat.sourceId,
    feat.flags?.core?.sourceId,
    feat.slug,
  ].filter(Boolean);
  const candidateIds = [
    candidate.actorItemId,
    candidate.id,
    candidate._id,
    candidate.uuid,
    candidate.sourceId,
    candidate.flags?.core?.sourceId,
    candidate.slug,
  ].filter(Boolean);
  return featIds.some((id) => candidateIds.includes(id));
}

function matchesAnySkillIncrease(increase, level, candidates) {
  return candidates.some((candidate) => matchesSkillIncrease(increase, level, candidate));
}

function matchesSkillIncrease(increase, level, candidate) {
  if (!increase || !candidate) return false;
  if (Number.isInteger(Number(candidate.fromLevel)) && Number(candidate.fromLevel) !== Number(level)) return false;
  const skill = String(increase.skill ?? '').trim().toLowerCase();
  const candidateSkill = String(candidate.skill ?? '').trim().toLowerCase();
  const toRank = Number(increase.toRank);
  const candidateRank = Number(candidate.toRank);
  return !!skill && skill === candidateSkill && Number.isFinite(toRank) && toRank === candidateRank;
}

function computeTrackedClasses(entries) {
  return entries
    .filter((entry) => entry?.classDef && entry?.slug)
    .map((entry) => computeClassState(entry.classDef, entry.slug));
}

function computeWeaponProficiencies(actor) {
  const attacks = actor?.system?.proficiencies?.attacks ?? actor?.system?.martial ?? {};
  const entries = {
    simple: readWeaponProficiencyRank(attacks, 'simple'),
    martial: readWeaponProficiencyRank(attacks, 'martial'),
    unarmed: readWeaponProficiencyRank(attacks, 'unarmed'),
    advanced: readWeaponProficiencyRank(attacks, 'advanced'),
    crossbow: readWeaponProficiencyRank(attacks, 'crossbow'),
    bow: readWeaponProficiencyRank(attacks, 'bow'),
    firearm: readWeaponProficiencyRank(attacks, 'firearm'),
  };

  return Object.fromEntries(
    Object.entries(entries).filter(([, rank]) => Number.isFinite(rank) && rank > 0),
  );
}

function readWeaponProficiencyRank(source, key) {
  const entry = source?.[key];
  if (Number.isFinite(entry)) return Number(entry);
  if (Number.isFinite(entry?.rank)) return Number(entry.rank);
  if (Number.isFinite(entry?.value)) return Number(entry.value);
  return 0;
}

function computeClassState(classDef, classSlug) {
  const traditions = new Set();
  const tradition = classDef?.spellcasting?.tradition ?? null;
  if (
    typeof tradition === 'string' &&
    tradition.length > 0 &&
    !['bloodline', 'patron'].includes(tradition)
  ) {
    traditions.add(tradition);
  }

  return {
    slug: classSlug ?? classDef?.slug ?? null,
    hp: classDef?.hp ?? null,
    keyAbility: classDef?.keyAbility ?? [],
    subclassType: CLASS_SUBCLASS_TYPES[classSlug ?? classDef?.slug ?? ''] ?? null,
    traditions,
  };
}

function computeAncestryTraits(actor, plan, atLevel) {
  const traits = new Set();

  addAncestryTraitAliases(traits, actor?.system?.details?.ancestry?.trait ?? null);
  for (const trait of actor?.system?.traits?.value ?? []) {
    addAncestryTraitAliases(traits, trait);
  }
  addAncestryItemTraits(traits, actor?.ancestry ?? null);
  addAncestryItemTraits(
    traits,
    getOwnedItems(actor).find((item) => item?.type === 'ancestry') ?? null,
  );

  for (const value of [
    actor?.ancestry?.slug ?? null,
    actor?.ancestry?.name ?? null,
    actor?.heritage?.slug ?? null,
    actor?.heritage?.name ?? null,
  ]) {
    addAncestryTraitAliases(traits, value);
  }

  for (const heritage of getEffectiveHeritageItems(actor, plan, atLevel)) {
    addAncestryTraitAliases(traits, heritage?.slug ?? null);
    addAncestryTraitAliases(traits, heritage?.name ?? null);
    addAncestryItemTraits(traits, heritage);
  }

  const mixedAncestrySelection =
    actor?.heritage?.flags?.pf2e?.rulesSelections?.[MIXED_ANCESTRY_CHOICE_FLAG] ??
    actor?.heritage?.flags?.['pf2e-leveler']?.mixedAncestrySelection ??
    null;
  if (actor?.heritage?.uuid === MIXED_ANCESTRY_UUID || actor?.heritage?.slug === 'mixed-ancestry') {
    addAncestryTraitAliases(traits, mixedAncestrySelection);
  }

  for (const item of getEffectiveActorFeats(actor, plan, atLevel)) {
    const featSlug = slugify(item?.slug ?? item?.name ?? '');
    if (featSlug !== 'adopted-ancestry') continue;
    const selected =
      item?.flags?.pf2e?.rulesSelections?.adoptedAncestry ??
      item?.flags?.pf2e?.rulesSelections?.ancestry ??
      null;
    addAncestryTraitAliases(traits, selected);
  }

  for (const feat of getEffectivePlannedFeats(plan, atLevel)) {
    const featSlug = slugify(feat?.slug ?? feat?.name ?? '');
    if (featSlug !== 'adopted-ancestry') continue;
    const selected = feat?.choices?.adoptedAncestry ?? feat?.adoptedAncestry ?? null;
    addAncestryTraitAliases(traits, selected);
  }

  return traits;
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

function computeHeritageAliases(actor, plan, atLevel) {
  const aliases = new Set();

  for (const heritage of getEffectiveHeritageItems(actor, plan, atLevel)) {
    for (const candidate of [heritage?.slug, heritage?.name]) {
      const normalized = normalizeEquipmentValue(candidate);
      if (normalized) aliases.add(slugify(normalized));
    }
  }

  return aliases;
}

function getEffectiveHeritageItems(actor, plan, atLevel) {
  const items = [];
  if (actor?.heritage) items.push(actor.heritage);
  items.push(...getOwnedItems(actor).filter((item) => isHeritageItemLike(item)));

  for (const feat of getEffectivePlannedFeats(plan, atLevel)) {
    for (const granted of feat?.grantedItems ?? []) {
      if (isHeritageItemLike(granted)) items.push(granted);
    }
  }

  return items;
}

function isHeritageItemLike(item) {
  if (!item) return false;
  if (String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() === 'heritage') return true;
  const uuid = String(item?.uuid ?? '').trim().toLowerCase();
  return uuid.includes('.heritages.') || uuid.includes('.heritage.');
}

function computeDivineFontState(actor) {
  for (const item of getOwnedItems(actor)) {
    if (item?.type !== 'spellcastingEntry') continue;

    const normalizedName = String(item?.name ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedName.includes('divine font')) continue;
    if (/\bhealing\b/.test(normalizedName) || /\bheal\b/.test(normalizedName)) return 'healing';
    if (
      /\bharmful\b/.test(normalizedName) ||
      /\bharming\b/.test(normalizedName) ||
      /\bharm\b/.test(normalizedName)
    )
      return 'harmful';
  }

  return null;
}

function computeSpellcastingState(actor, plan, atLevel, classDefs) {
  const trackedClassDefs = Array.isArray(classDefs)
    ? classDefs.filter(Boolean)
    : [classDefs].filter(Boolean);
  const entries = getOwnedItems(actor).filter((item) => item?.type === 'spellcastingEntry');
  const spells = getOwnedItems(actor).filter((item) => item?.type === 'spell');
  const traditions = new Set(
    entries
      .map((item) => item?.system?.tradition?.value ?? null)
      .filter((value) => typeof value === 'string' && value.length > 0),
  );
  const spellNames = new Set();
  const spellTraits = new Set();

  for (const classDef of trackedClassDefs) {
    const classTradition = classDef?.spellcasting?.tradition ?? null;
    if (typeof classTradition === 'string' && !['bloodline', 'patron'].includes(classTradition)) {
      traditions.add(classTradition);
    }
  }

  for (const tradition of collectVariableClassTraditions(actor, plan, atLevel, trackedClassDefs)) {
    traditions.add(tradition);
  }

  for (const tradition of collectPlannedDedicationTraditions(actor, plan, atLevel)) {
    traditions.add(tradition);
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

  for (const spell of getAllPlannedSpells(plan, atLevel)) {
    const spellSlug = slugify(spell?.slug ?? spell?.name ?? '');
    if (spellSlug) spellNames.add(spellSlug);

    for (const trait of spell?.traits ?? []) {
      const normalizedTrait = normalizeEquipmentValue(trait);
      if (normalizedTrait) spellTraits.add(normalizedTrait);
    }
  }

  const hasSpellSlots =
    entries.some((item) => {
      const systemSlots = item?.system?.slots;
      if (!systemSlots || typeof systemSlots !== 'object') return false;
      return Object.values(systemSlots).some((slot) => {
        if (!slot || typeof slot !== 'object') return false;
        const max = Number(slot.max ?? slot.value ?? 0);
        return Number.isFinite(max) && max > 0;
      });
    }) || trackedClassDefs.some((classDef) => !!classDef?.spellcasting?.slots);

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

function collectVariableClassTraditions(actor, plan, atLevel, trackedClassDefs) {
  const traditions = new Set();
  const feats = getEffectiveCharacterFeats(actor, plan, atLevel);

  for (const classDef of trackedClassDefs) {
    const classSlug = String(classDef?.slug ?? '')
      .trim()
      .toLowerCase();
    const baseTradition = String(classDef?.spellcasting?.tradition ?? '')
      .trim()
      .toLowerCase();
    if (!classSlug || !VARIABLE_SPELLCASTING_TRADITIONS.has(baseTradition)) continue;

    const subclassType = CLASS_SUBCLASS_TYPES[classSlug] ?? null;
    const subclassTag = subclassType ? `${classSlug}-${slugify(subclassType)}` : null;
    if (!subclassTag) continue;

    for (const feat of feats) {
      if (!matchesTagFamily(feat, subclassTag)) continue;
      const tradition = inferFeatSpellcastingTradition(feat);
      if (tradition) traditions.add(tradition);
    }
  }

  return traditions;
}

function collectPlannedDedicationTraditions(actor, plan, atLevel) {
  const traditions = new Set();
  const feats = getEffectivePlannedFeats(plan, atLevel);
  const actorFeatSlugs = new Set(
    getOwnedItems(actor)
      .filter((item) => item?.type === 'feat')
      .map((item) =>
        String(item?.slug ?? '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  for (const feat of feats) {
    const slug = String(feat?.slug ?? '')
      .trim()
      .toLowerCase();
    const name = String(feat?.name ?? '')
      .trim()
      .toLowerCase();
    const traits = (feat?.traits ?? feat?.system?.traits?.value ?? []).map((trait) =>
      String(trait).trim().toLowerCase(),
    );
    const combined = `${slug} ${name} ${traits.join(' ')}`;
    const isDedication = traits.includes('dedication') || combined.includes('dedication');
    if (!isDedication) continue;

    const classSlug =
      ClassRegistry.getAll().find(
        (candidate) =>
          candidate?.spellcasting && combined.includes(String(candidate.slug).toLowerCase()),
      )?.slug ?? null;
    if (!classSlug) continue;
    if (actorFeatSlugs.has(slug)) continue;

    const dedicationClass = ClassRegistry.get(classSlug);
    const tradition = dedicationClass?.spellcasting?.tradition ?? null;
    if (
      typeof tradition === 'string' &&
      tradition.length > 0 &&
      !['bloodline', 'patron'].includes(tradition)
    ) {
      traditions.add(tradition);
    }
  }

  return traditions;
}

function computeAttributes(actor, plan, atLevel, { raw = false } = {}) {
  const attrs = {};
  for (const attr of ATTRIBUTES) {
    attrs[attr] = getActorAbilityModifier(actor, attr) ?? 0;
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

  if (!raw) {
    for (const attr of ATTRIBUTES) {
      attrs[attr] = Math.trunc(attrs[attr]);
    }
  }

  return attrs;
}

function getActorAbilityModifier(actor, attr) {
  const actorAbilities = actor?.abilities?.[attr] ?? null;
  const systemAbility = actor?.system?.abilities?.[attr] ?? null;
  const base = actorAbilities?.base;

  if (Number.isFinite(base)) return Number(base);

  const mod = systemAbility?.mod;
  if (Number.isFinite(mod)) return Number(mod);

  return 0;
}

function computeSkills(actor, plan, atLevel, classDef) {
  const dualClassSlug = getTrackedDualClassSlug(plan);
  const dualClassDef = dualClassSlug ? ClassRegistry.get(dualClassSlug) : null;
  const skills = computeSkillsWithoutPlannedFeatRules(actor, plan, atLevel, [classDef, dualClassDef]);
  applyPlannedSkillRankRules(skills, plan, atLevel);
  return skills;
}

export function computeSkillsWithoutPlannedFeatRules(actor, plan, atLevel, classDef) {
  return computeSkillPickerState(actor, plan, atLevel, classDef, {
    includePlannedFeatRules: false,
    includeCurrentLevelSkillIncrease: true,
  });
}

export function computeSkillPickerState(actor, plan, atLevel, classDef, options = {}) {
  const includePlannedFeatRules = options.includePlannedFeatRules !== false;
  const includeCurrentLevelSkillIncrease = options.includeCurrentLevelSkillIncrease === true;
  const trackedClassDefs = Array.isArray(classDef)
    ? classDef.filter(Boolean)
    : [classDef].filter(Boolean);
  const skills = {};
  for (const skill of SKILLS) {
    skills[skill] = actor?.system?.skills?.[skill]?.rank ?? PROFICIENCY_RANKS.UNTRAINED;
  }

  for (const trackedClassDef of trackedClassDefs) {
    if (!trackedClassDef?.trainedSkills?.fixed) continue;
    for (const skill of trackedClassDef.trainedSkills.fixed) {
      if (skills[skill] < PROFICIENCY_RANKS.TRAINED) {
        skills[skill] = PROFICIENCY_RANKS.TRAINED;
      }
    }
  }

  applyActorSkillRankRules(skills, actor, atLevel);
  applyActorDeitySkill(skills, actor);

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;

    if (includePlannedFeatRules) applyPlannedLevelSkillRankRules(skills, plan, level, atLevel);

    for (const skill of levelData.intBonusSkills ?? []) {
      if (!SKILLS.includes(skill)) continue;
      if ((skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED) < PROFICIENCY_RANKS.TRAINED) {
        skills[skill] = PROFICIENCY_RANKS.TRAINED;
      }
    }

    if (level === atLevel && !includeCurrentLevelSkillIncrease) continue;

    for (const inc of getEffectiveLevelSkillIncreases(plan, level, atLevel)) {
      if (inc.skill && inc.toRank > (skills[inc.skill] ?? 0)) {
        skills[inc.skill] = inc.toRank;
      }
    }
  }

  return skills;
}

function applyActorDeitySkill(skills, actor) {
  const deitySkill = resolveActorDeitySkill(actor);
  if (!deitySkill || !SKILLS.includes(deitySkill)) return skills;
  skills[deitySkill] = Math.max(skills[deitySkill] ?? PROFICIENCY_RANKS.UNTRAINED, PROFICIENCY_RANKS.TRAINED);
  return skills;
}

function resolveActorDeitySkill(actor) {
  const deityItem = getOwnedItems(actor).find((item) => item?.type === 'deity') ?? null;
  return normalizeSkillSlug(
    deityItem?.skill
      ?? deityItem?.system?.skill
      ?? actor?.system?.details?.deity?.skill
      ?? actor?.system?.details?.deity?.system?.skill,
  );
}

function applyPlannedSkillRankRules(skills, plan, atLevel) {
  for (let level = 1; level <= atLevel; level++) {
    applyPlannedLevelSkillRankRules(skills, plan, level, atLevel);
  }

  return skills;
}

function computeLoreSkills(actor, plan, atLevel) {
  const lores = {};
  const skills = computeSkills(actor, plan, atLevel, ClassRegistry.get(plan.classSlug));

  for (const item of getOwnedItems(actor)) {
    if (item?.type !== 'lore') continue;

    const slug = slugify(item?.slug ?? item?.name ?? '');
    if (!slug) continue;

    const rank = Number(
      item?.system?.proficient?.value ??
        item?.system?.proficiency?.value ??
        item?.system?.rank ??
        1,
    );

    if (!Number.isFinite(rank)) continue;
    lores[slug] = Math.max(lores[slug] ?? 0, rank);
  }

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;
    for (const skill of levelData.intBonusSkills ?? []) {
      const loreSlug = String(skill ?? '')
        .trim()
        .toLowerCase();
      if (!loreSlug || SKILLS.includes(loreSlug)) continue;
      lores[loreSlug] = Math.max(lores[loreSlug] ?? 0, 1);
    }

    for (const feat of getEffectivePlannedFeatsForLevel(plan, level, atLevel)) {
      for (const rule of getFeatLoreRules(feat)) {
        const skill = String(rule?.skill ?? '')
          .trim()
          .toLowerCase();
        if (!skill || SKILLS.includes(skill)) continue;
        const rank = Number(resolveConditionalLoreRuleValue(rule, skills));
        if (!Number.isFinite(rank) || rank <= 0) continue;
        lores[skill] = Math.max(lores[skill] ?? 0, rank);
      }
    }

    for (const inc of getEffectiveLevelSkillIncreases(plan, level, atLevel)) {
      const skill = String(inc?.skill ?? '')
        .trim()
        .toLowerCase();
      if (!skill || SKILLS.includes(skill)) continue;
      const rank = Number(inc?.toRank ?? 0);
      if (!Number.isFinite(rank) || rank <= 0) continue;
      lores[skill] = Math.max(lores[skill] ?? 0, rank);
    }
  }

  return lores;
}

function resolveConditionalLoreRuleValue(rule, skills) {
  const condition = rule?.valueIfSkillRank;
  const skill = String(condition?.skill ?? '').trim().toLowerCase();
  const rank = Number(condition?.rank);
  if (!skill || !Number.isFinite(rank)) return rule?.value ?? 0;

  return Number(skills?.[skill] ?? 0) >= rank ? condition.value : rule?.value ?? 0;
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

      const value = evaluateRuleNumericValue(rule.value, atLevel, item);
      if (!Number.isFinite(value)) continue;

      skills[skill] = Math.max(skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED, value);
    }
  }

  return skills;
}

export function applyPlannedLevelSkillRankRules(skills, plan, level, atLevel = level) {
  const levelData = plan?.levels?.[level];
  if (!levelData) return skills;

  for (const feat of getEffectivePlannedFeatsForLevel(plan, level, atLevel)) {
    for (const rule of getPlannedFeatSkillRules(feat)) {
      if (!matchesRuleAtLevel(rule, atLevel)) continue;
      if (!SKILLS.includes(rule.skill)) continue;
      const currentRank = skills[rule.skill] ?? PROFICIENCY_RANKS.UNTRAINED;
      const valueSource =
        currentRank >= PROFICIENCY_RANKS.TRAINED && rule.valueIfAlreadyTrained != null
          ? rule.valueIfAlreadyTrained
          : rule.value;
      const value = evaluateRuleNumericValue(valueSource, atLevel, feat);
      if (!Number.isFinite(value)) continue;
      skills[rule.skill] = Math.max(currentRank, value);
    }

    for (const [flag, selected] of Object.entries(feat?.choices ?? {})) {
      if (!/^levelerSkillFallback\d+$/i.test(flag)) continue;
      if (!SKILLS.includes(selected)) continue;
      skills[selected] = Math.max(
        skills[selected] ?? PROFICIENCY_RANKS.UNTRAINED,
        PROFICIENCY_RANKS.TRAINED,
      );
    }
  }

  return skills;
}

function getPlannedFeatSkillRules(feat) {
  return getFeatSkillRules(feat);
}

function computeProficiencies(actor, classDefs, atLevel) {
  const trackedClassDefs = Array.isArray(classDefs)
    ? classDefs.filter(Boolean)
    : [classDefs].filter(Boolean);
  const proficiencies = {
    perception: actor?.system?.perception?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    fortitude: actor?.system?.saves?.fortitude?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    reflex: actor?.system?.saves?.reflex?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    will: actor?.system?.saves?.will?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
    classdc: actor?.system?.attributes?.classDC?.rank ?? PROFICIENCY_RANKS.UNTRAINED,
  };

  for (const classDef of trackedClassDefs) {
    for (const feature of classDef?.classFeatures ?? []) {
      if (feature.level > atLevel) continue;
      applyClassFeatureProficiency(proficiencies, feature);
    }
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
      const armorCategory = normalizeEquipmentValue(
        item?.system?.category?.value ?? item?.category,
      );
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
  applyExplicitFeatureProficiencies(proficiencies, feature?.proficiencies);

  const key = String(feature.key ?? '');
  const name = String(feature.name ?? '').toLowerCase();

  if (key.includes('perception-legend') || name.includes('perception legend')) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.LEGENDARY);
  } else if (
    key.includes('perception-mastery') ||
    key.includes('battlefield-surveyor') ||
    name.includes('perception mastery') ||
    name.includes('battlefield surveyor')
  ) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('perception-expertise') ||
    key.includes('perception-expert') ||
    name.includes('perception expertise') ||
    name.includes('perception expert')
  ) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('fortitude-legend') || name.includes('fortitude legend')) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.LEGENDARY);
  } else if (
    key.includes('fortress-of-will') ||
    key.includes('greater-fortitude') ||
    key.includes('fortitude-mastery') ||
    name.includes('fortitude mastery')
  ) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('fortitude-expertise') ||
    key.includes('fortitude-expert') ||
    name.includes('fortitude expertise') ||
    name.includes('fortitude expert') ||
    key.includes('magical-fortitude')
  ) {
    proficiencies.fortitude = Math.max(proficiencies.fortitude, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('reflex-legend') || name.includes('reflex legend')) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.LEGENDARY);
  } else if (
    key.includes('greater-natural-reflexes') ||
    key.includes('greater-rogue-reflexes') ||
    key.includes('tempered-reflexes') ||
    key.includes('reflex-mastery') ||
    name.includes('reflex mastery')
  ) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('reflex-expertise') ||
    key.includes('reflex-expert') ||
    name.includes('reflex expertise') ||
    name.includes('reflex expert') ||
    key.includes('lightning-reflexes') ||
    key.includes('evasive-reflexes') ||
    key.includes('natural-reflexes') ||
    key.includes('shared-reflexes') ||
    key.includes('premonitions-reflexes')
  ) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('will-legend') || name.includes('will legend')) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.LEGENDARY);
  } else if (
    key.includes('greater-dogged-will') ||
    key.includes('prodigious-will') ||
    key.includes('will-of-the-pupil') ||
    key.includes('majestic-will') ||
    key.includes('walls-of-will') ||
    key.includes('divine-will') ||
    key.includes('indomitable-will') ||
    key.includes('wild-willpower') ||
    name.includes('will mastery')
  ) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.MASTER);
  } else if (
    key.includes('will-expertise') ||
    key.includes('will-expert') ||
    key.includes('dogged-will') ||
    key.includes('commanding-will') ||
    name.includes('will expertise') ||
    name.includes('will expert')
  ) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('class-dc-mastery') || name.includes('class dc mastery')) {
    proficiencies.classdc = Math.max(proficiencies.classdc, PROFICIENCY_RANKS.MASTER);
  } else if (key.includes('class-dc-expertise') || name.includes('class dc expertise')) {
    proficiencies.classdc = Math.max(proficiencies.classdc, PROFICIENCY_RANKS.EXPERT);
  }
}

function applyExplicitFeatureProficiencies(proficiencies, updates) {
  if (!updates || typeof updates !== 'object') return;

  for (const [key, rawRank] of Object.entries(updates)) {
    if (!(key in proficiencies)) continue;

    const rank = normalizeTrackedProficiencyRank(rawRank);
    if (rank === null) continue;

    proficiencies[key] = Math.max(proficiencies[key], rank);
  }
}

function normalizeTrackedProficiencyRank(rank) {
  if (Number.isFinite(rank)) return Number(rank);

  switch (
    String(rank ?? '')
      .trim()
      .toLowerCase()
  ) {
    case 'trained':
      return PROFICIENCY_RANKS.TRAINED;
    case 'expert':
      return PROFICIENCY_RANKS.EXPERT;
    case 'master':
      return PROFICIENCY_RANKS.MASTER;
    case 'legendary':
      return PROFICIENCY_RANKS.LEGENDARY;
    default:
      return null;
  }
}

function computeFeats(actor, plan, atLevel) {
  const feats = new Set();

  const existingFeats = getEffectiveActorFeats(actor, plan, atLevel);
  for (const feat of existingFeats) {
    for (const alias of getFeatAliases(feat)) feats.add(alias);
  }

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    for (const alias of getFeatAliases(feat)) feats.add(alias);
  }

  if (actor?.system?.resources?.focus?.max > 0) feats.add('focus-pool');

  return feats;
}

function computeFeatAliasSources(actor, plan, atLevel) {
  const sources = new Map();

  const addSources = (feat) => {
    const sourceSlug = getPrimaryFeatAlias(feat);
    const sourceName = feat?.name?.trim() || sourceSlug || '';
    if (!sourceSlug && !sourceName) return;

    for (const alias of getFeatAliases(feat)) {
      if (!alias) continue;
      if (!sources.has(alias)) sources.set(alias, new Map());
      sources.get(alias).set(sourceSlug || sourceName, sourceName || sourceSlug);
    }
  };

  for (const feat of getEffectiveActorFeats(actor, plan, atLevel)) addSources(feat);

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) addSources(feat);

  return sources;
}

function computeSenses(actor) {
  const senses = new Set();
  const perceptionSenses = actor?.system?.perception?.senses ?? [];
  for (const sense of perceptionSenses) {
    const type = typeof sense === 'string' ? sense : (sense?.type ?? null);
    if (type) senses.add(slugifySense(type));
  }
  if (actor?.system?.perception?.vision) {
    senses.add('low-light-vision');
  }
  return senses;
}

function slugifySense(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function computeClassFeatures(actor, plan, classDefs, atLevel) {
  const trackedClassDefs = Array.isArray(classDefs)
    ? classDefs.filter(Boolean)
    : [classDefs].filter(Boolean);
  const features = new Set();

  for (const classDef of trackedClassDefs) {
    for (const feature of classDef?.classFeatures ?? []) {
      if (feature.level > atLevel) continue;
      if (feature.key) features.add(feature.key);
      if (feature.name) features.add(slugify(feature.name));
    }
  }

  for (const item of getOwnedItems(actor)) {
    if (!isOwnedClassFeatureItem(item, atLevel)) continue;

    const itemSlug = String(item?.slug ?? '')
      .trim()
      .toLowerCase();
    const itemNameSlug = slugify(item?.name ?? '');
    if (itemSlug) features.add(itemSlug);
    if (itemNameSlug) features.add(itemNameSlug);
    addOwnedClassFeatureSelectionAliases(features, item, [itemSlug, itemNameSlug]);

    for (const alias of extractLinkedFeatureAliases(
      item?.system?.description?.value ?? item?.description ?? '',
    )) {
      features.add(alias);
    }
  }

  for (const levelData of getPlanLevelDataUpTo(plan, atLevel)) {
    addPlannedClassFeatureChoiceAliases(features, levelData);
  }

  return features;
}

function addOwnedClassFeatureSelectionAliases(features, item, featureAliases) {
  const selectedAliases = new Set();

  for (const selected of Object.values(item?.flags?.pf2e?.rulesSelections ?? {})) {
    collectFeatureChoiceAliases(selectedAliases, selected);
  }
  for (const selected of Object.values(item?.flags?.['pf2e-leveler']?.classFeatureChoices ?? {})) {
    collectFeatureChoiceAliases(selectedAliases, selected);
  }

  for (const selectedAlias of selectedAliases) {
    features.add(selectedAlias);
    for (const featureAlias of featureAliases) {
      if (!featureAlias || featureAlias === selectedAlias) continue;
      features.add(`${selectedAlias}-${featureAlias}`);
    }
  }
}

function isOwnedClassFeatureItem(item, atLevel) {
  if (!item || !['feat', 'action', 'classfeature'].includes(String(item?.type ?? '').toLowerCase()))
    return false;

  const category = String(item?.system?.category?.value ?? item?.system?.category ?? '')
    .trim()
    .toLowerCase();
  if (item?.type !== 'classfeature' && !['classfeature', 'class-feature'].includes(category))
    return false;

  const level = Number(
    item?.system?.level?.taken ?? item?.system?.level?.value ?? item?.level ?? 0,
  );
  return Number.isFinite(level) ? level <= atLevel : true;
}

function getPlanLevelDataUpTo(plan, atLevel) {
  return Object.entries(plan?.levels ?? {})
    .filter(([level]) => Number(level) <= atLevel)
    .map(([, levelData]) => levelData)
    .filter(Boolean);
}

function addPlannedClassFeatureChoiceAliases(features, levelData) {
  for (const choiceBucket of Object.values(levelData?.classFeatureChoices ?? {})) {
    for (const choice of Object.values(choiceBucket ?? {})) {
      if (typeof choice === 'string') {
        addFeatureChoiceAlias(features, choice);
        continue;
      }
      addFeatureChoiceAlias(features, choice?.value);
      addFeatureChoiceAlias(features, choice?.label);
      addFeatureChoiceAlias(features, choice?.slug);
    }
  }
}

function addFeatureChoiceAlias(features, value) {
  collectFeatureChoiceAliases(features, value);
}

function collectFeatureChoiceAliases(features, value) {
  if (typeof value !== 'string' || value.length === 0 || value === '[object Object]') return;
  if (value.startsWith('Compendium.')) {
    const match = value.match(/\.Item\.([^.]+)$/u);
    const normalizedCompendiumAlias = slugify(match?.[1] ?? '');
    if (normalizedCompendiumAlias) features.add(normalizedCompendiumAlias);
    return;
  }
  const normalized = slugify(value);
  if (normalized) features.add(normalized);
}

function extractLinkedFeatureAliases(html) {
  const aliases = new Set();
  const text = String(html ?? '');
  if (!text) return aliases;

  const uuidLinkPattern = /@UUID\[[^\]]+\]\{([^}]+)\}/gu;
  const anchorPattern = /<a\b[^>]*data-uuid="[^"]+"[^>]*>([\s\S]*?)<\/a>/giu;

  for (const match of text.matchAll(uuidLinkPattern)) {
    const slug = slugify(stripHtml(match[1]));
    if (slug) aliases.add(slug);
  }

  for (const match of text.matchAll(anchorPattern)) {
    const slug = slugify(stripHtml(match[1]));
    if (slug) aliases.add(slug);
  }

  return aliases;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeClassArchetypeDedications(actor, plan, atLevel) {
  const dedications = new Set();

  const existingFeats = actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
  for (const feat of existingFeats) {
    if (isClassArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
    for (const alias of getSelectedClassArchetypeDedicationAliases(feat)) dedications.add(alias);
  }

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    if (isClassArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
    for (const alias of getSelectedClassArchetypeDedicationAliases(feat)) dedications.add(alias);
  }

  return dedications;
}

function computeArchetypeDedications(actor, plan, atLevel) {
  const dedications = new Set();

  const existingFeats = getEffectiveActorFeats(actor, plan, atLevel);
  for (const feat of existingFeats) {
    if (isArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
    for (const alias of getSelectedDedicationAliases(feat)) dedications.add(alias);
  }

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    if (isArchetypeDedication(feat)) dedications.add(getPrimaryFeatAlias(feat));
    for (const alias of getSelectedDedicationAliases(feat)) dedications.add(alias);
  }

  return dedications;
}

function computeClassArchetypeTraits(actor, plan, atLevel) {
  const traits = new Set();

  const existingFeats = getEffectiveActorFeats(actor, plan, atLevel);
  for (const feat of existingFeats) {
    if (!isClassArchetypeDedication(feat)) continue;
    const archetypeTrait = getClassArchetypeTrait(feat);
    if (archetypeTrait) traits.add(archetypeTrait);
  }
  for (const feat of existingFeats) {
    for (const trait of getSelectedClassArchetypeTraits(feat)) traits.add(trait);
  }

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    if (!isClassArchetypeDedication(feat)) continue;
    const archetypeTrait = getClassArchetypeTrait(feat);
    if (archetypeTrait) traits.add(archetypeTrait);
  }
  for (const feat of plannedFeats) {
    for (const trait of getSelectedClassArchetypeTraits(feat)) traits.add(trait);
  }

  return traits;
}

function computeArchetypeDedicationProgress(actor, plan, atLevel) {
  const progress = new Map();
  const selectedFeats = [
    ...getEffectiveCharacterFeats(actor, plan, atLevel),
  ];
  const timeline = buildArchetypeFeatTimeline(actor, plan, atLevel);
  const dedications = timeline
    .filter((entry) => isArchetypeDedication(entry.feat))
    .map((entry) => entry.feat);
  const matchedByDedication = new Map();

  for (const dedication of dedications) {
    const dedicationSlug = getPrimaryFeatAlias(dedication);
    if (!dedicationSlug || matchedByDedication.has(dedicationSlug)) continue;

    const matched = new Set();
    const relatedTraits = getArchetypeAssociationTraits(dedication);
    const relatedPhrases = new Set(getArchetypeAssociationPhrases(dedication));
    let changed = true;

    while (changed) {
      changed = false;

      for (const feat of selectedFeats) {
        const featSlug = getPrimaryFeatAlias(feat);
        const featTraits = [
          ...(Array.isArray(feat?.traits) ? feat.traits : []),
          ...(feat?.system?.traits?.value ?? []),
        ].map((trait) => String(trait).toLowerCase());
        const isArchetypeFeat =
          featTraits.includes('archetype') ||
          isStoredAdditionalArchetypeFeat(feat) ||
          hasArchetypeDedicationPrerequisite(feat);
        if (
          !featSlug ||
          featSlug === dedicationSlug ||
          matched.has(featSlug) ||
          isArchetypeDedication(feat) ||
          !isArchetypeFeat
        )
          continue;

        const featArchetypeTraits = getArchetypeAssociationTraits(feat);
        const prereqText = getArchetypePrerequisiteText(feat);
        const matchesByTrait =
          featArchetypeTraits.size > 0 &&
          [...featArchetypeTraits].some((trait) => relatedTraits.has(trait));
        const matchesByPrereq =
          prereqText.length > 0 &&
          [...relatedPhrases].some((phrase) => prereqText.includes(phrase));
        if (!matchesByTrait && !matchesByPrereq) continue;

        matched.add(featSlug);
        for (const trait of featArchetypeTraits) relatedTraits.add(trait);
        for (const phrase of getArchetypeAssociationPhrases(feat)) relatedPhrases.add(phrase);
        changed = true;
      }
    }

    if (dedications.length === 1 && matched.size < 2) {
      for (const feat of selectedFeats) {
        const featSlug = getPrimaryFeatAlias(feat);
        if (
          !featSlug ||
          featSlug === dedicationSlug ||
          matched.has(featSlug) ||
          isArchetypeDedication(feat)
        )
          continue;
        const featTraits = [
          ...(Array.isArray(feat?.traits) ? feat.traits : []),
          ...(feat?.system?.traits?.value ?? []),
        ].map((trait) => String(trait).toLowerCase());
        if (
          !featTraits.includes('archetype') &&
          !isStoredAdditionalArchetypeFeat(feat) &&
          !hasArchetypeDedicationPrerequisite(feat)
        )
          continue;
        matched.add(featSlug);
      }
    }

    matchedByDedication.set(dedicationSlug, matched);
  }

  const explicitlyMatched = new Set(
    [...matchedByDedication.values()].flatMap((matched) => [...matched]),
  );

  for (const entry of timeline) {
    const feat = entry.feat;
    const featSlug = getPrimaryFeatAlias(feat);
    if (!featSlug || explicitlyMatched.has(featSlug) || isArchetypeDedication(feat)) continue;

    const featTraits = [
      ...(Array.isArray(feat?.traits) ? feat.traits : []),
      ...(feat?.system?.traits?.value ?? []),
    ].map((trait) => String(trait).toLowerCase());
    if (!isArchetypeTimelineEntry(entry, featTraits)) continue;

    const candidateDedications = timeline
      .filter(
        (candidate) =>
          isArchetypeDedication(candidate.feat) && compareTimelineEntries(candidate, entry) < 0,
      )
      .map((candidate) => getPrimaryFeatAlias(candidate.feat))
      .filter((slug) => slug && matchedByDedication.has(slug));

    if (candidateDedications.length === 0) continue;

    const incompleteCandidates = candidateDedications.filter(
      (slug) => (matchedByDedication.get(slug)?.size ?? 0) < 2,
    );
    const targetSlug = incompleteCandidates.at(-1) ?? null;
    if (!targetSlug) continue;

    matchedByDedication.get(targetSlug).add(featSlug);
  }

  for (const [dedicationSlug, matched] of matchedByDedication.entries()) {
    progress.set(dedicationSlug, matched.size);
  }

  return progress;
}

function buildArchetypeFeatTimeline(actor, plan, atLevel) {
  const actorFeats = getEffectiveActorFeats(actor, plan, atLevel).map(
    (feat, index) => ({
      feat,
      level: getActorFeatLevel(feat),
      order: index,
    }),
  );

  const plannedFeats = [];
  let order = actorFeats.length;
  const featKeys = [
    'classFeats',
    'skillFeats',
    'generalFeats',
    'ancestryFeats',
    'archetypeFeats',
    'mythicFeats',
    'dualClassFeats',
    'customFeats',
  ];
  for (let level = 1; level <= atLevel; level++) {
    for (const { feat, category } of getEffectivePlannedFeatEntriesForLevel(plan, level, atLevel)) {
      const key = category;
      if (!featKeys.includes(key)) continue;
      if (
        !isArchetypeDedication(feat) &&
        key !== 'archetypeFeats' &&
        !isStoredAdditionalArchetypeFeat(feat) &&
        !getFeatTraitSlugs(feat).includes('archetype') &&
        !hasArchetypeDedicationPrerequisite(feat)
      ) {
        continue;
      }
      plannedFeats.push({ feat, level, order, category: key });
      order++;
    }
  }

  return [...actorFeats, ...plannedFeats].sort(compareTimelineEntries);
}

function isArchetypeTimelineEntry(entry, featTraits = getFeatTraitSlugs(entry?.feat)) {
  return (
    entry?.category === 'archetypeFeats' ||
    featTraits.includes('archetype') ||
    isStoredAdditionalArchetypeFeat(entry?.feat) ||
    hasArchetypeDedicationPrerequisite(entry?.feat)
  );
}

function getActorFeatLevel(feat) {
  const taken = Number(feat?.system?.level?.taken ?? feat?.system?.level?.value ?? 0);
  if (Number.isFinite(taken)) return taken;
  const location = getActorFeatLocation(feat);
  const match = location.match(/-(\d+)$/u);
  return match ? Number(match[1]) : 0;
}

function getActorFeatLocation(feat) {
  const location = feat?.system?.location;
  if (typeof location === 'string') return location.trim();
  if (location && typeof location === 'object' && typeof location.value === 'string') return location.value.trim();
  return '';
}

function compareTimelineEntries(a, b) {
  if ((a?.level ?? 0) !== (b?.level ?? 0)) return (a?.level ?? 0) - (b?.level ?? 0);
  return (a?.order ?? 0) - (b?.order ?? 0);
}

function computeIncompleteArchetypeDedications(actor, plan, atLevel) {
  const progress = computeArchetypeDedicationProgress(actor, plan, atLevel);
  return new Set([...progress.entries()].filter(([, count]) => count < 2).map(([slug]) => slug));
}

function canTakeNewArchetypeDedication(actor, plan, atLevel) {
  const incompleteDedications = computeIncompleteArchetypeDedications(actor, plan, atLevel);
  return (
    incompleteDedications.size === 0 ||
    hasSecondDedicationException(actor, plan, atLevel, incompleteDedications)
  );
}

export function syncPlanArchetypeDedicationProgress(actor, plan, atLevel = MAX_LEVEL) {
  if (!plan) return plan;
  plan.archetypeDedicationProgress = computePlanArchetypeDedicationProgress(actor, plan, atLevel);
  return plan;
}

export function computePlanArchetypeDedicationProgress(actor, plan, atLevel = MAX_LEVEL) {
  const progress = computeArchetypeDedicationProgress(actor, plan, atLevel);
  const incompleteDedications = new Set(
    [...progress.entries()].filter(([, count]) => count < 2).map(([slug]) => slug),
  );
  const nameBySlug = new Map();
  for (const entry of buildArchetypeFeatTimeline(actor, plan, atLevel)) {
    if (!isArchetypeDedication(entry.feat)) continue;
    const slug = getPrimaryFeatAlias(entry.feat);
    if (!slug || nameBySlug.has(slug)) continue;
    nameBySlug.set(slug, String(entry.feat?.name ?? slug));
  }

  return {
    version: PLAN_DEDICATION_PROGRESS_VERSION,
    atLevel,
    canTakeNewDedication:
      incompleteDedications.size === 0 ||
      hasSecondDedicationException(actor, plan, atLevel, incompleteDedications),
    dedications: [...progress.entries()]
      .map(([slug, count]) => ({
        slug,
        name: nameBySlug.get(slug) ?? slug,
        count,
        complete: count >= 2,
        specialSecondDedication: SECOND_DEDICATION_EXCEPTION_SLUGS.has(slug),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

function hasSecondDedicationException(actor, plan, atLevel, incompleteDedications) {
  if (incompleteDedications.size !== 1) return false;
  const [incompleteSlug] = [...incompleteDedications];
  if (!SECOND_DEDICATION_EXCEPTION_SLUGS.has(incompleteSlug)) return false;

  const dedications = computeArchetypeDedications(actor, plan, atLevel);
  return dedications.size === 1 && dedications.has(incompleteSlug);
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

  for (const selected of getFeatChoiceSelections(feat)) {
    addFeatChoiceAlias(aliases, selected);
  }

  for (const selected of Object.values(feat?.flags?.pf2e?.rulesSelections ?? {})) {
    addFeatChoiceAlias(aliases, selected);
  }

  for (const alias of feat?.aliases ?? []) {
    if (typeof alias === 'string' && alias.length > 0) aliases.add(alias);
  }

  for (const alias of getDedicationAliasesFromDescription(feat)) {
    aliases.add(alias);
  }

  for (const alias of getSubclassAliases(feat)) {
    aliases.add(alias);
  }

  return aliases;
}

function getSubclassAliases(feat) {
  const aliases = new Set();
  const slug = String(feat?.slug ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return aliases;

  for (const [classSlug, subclassType] of Object.entries(CLASS_SUBCLASS_TYPES)) {
    const subclassSlug = slugify(subclassType);
    const subclassTag = `${classSlug}-${subclassSlug}`;
    const classPrefix = `${classSlug}-${subclassSlug}-`;
    const barePrefix = `${subclassSlug}-`;
    const suffix = slug.startsWith(classPrefix)
      ? slug.slice(classPrefix.length)
      : slug.startsWith(barePrefix)
        ? slug.slice(barePrefix.length)
        : '';
    if (suffix) aliases.add(`${suffix}-${subclassSlug}`);

    if (matchesTagFamily(feat, subclassTag) && !slug.endsWith(`-${subclassSlug}`)) {
      aliases.add(`${slug}-${subclassSlug}`);
    }
  }

  return aliases;
}

function addFeatChoiceAlias(target, selected) {
  if (typeof selected !== 'string' || selected.length === 0 || selected === '[object Object]')
    return;

  if (selected.startsWith('Compendium.')) {
    const match = selected.match(/\.Item\.([^.]+)$/u);
    const normalizedCompendiumAlias = slugify(match?.[1] ?? '');
    if (normalizedCompendiumAlias) target.add(normalizedCompendiumAlias);
    return;
  }

  const normalized = slugify(selected);
  if (normalized) target.add(normalized);
}

function getFeatChoiceSelections(feat) {
  return [
    ...Object.values(feat?.choices ?? {}),
    ...Object.values(feat?.flags?.pf2e?.rulesSelections ?? {}),
  ];
}

function matchesTagFamily(feat, tag) {
  const normalizedTag = String(tag ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedTag) return false;

  const tags = [
    ...(feat?.otherTags ?? []),
    ...(feat?.system?.traits?.otherTags ?? []),
  ].map((value) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

  return tags.includes(normalizedTag);
}

function inferFeatSpellcastingTradition(feat) {
  const directTradition = normalizeSpellcastingTradition(
    feat?.system?.tradition?.value ?? feat?.tradition ?? null,
  );
  if (directTradition && !VARIABLE_SPELLCASTING_TRADITIONS.has(directTradition)) {
    return directTradition;
  }

  const slug = getPrimaryFeatAlias(feat);
  const subclassData = SUBCLASS_SPELLS[slug] ?? null;
  if (!subclassData?.choiceFlag || !Array.isArray(subclassData.choiceOptions)) return null;

  const choices = {
    ...(feat?.choices ?? {}),
    ...(feat?.flags?.pf2e?.rulesSelections ?? {}),
  };
  const selected = String(choices[subclassData.choiceFlag] ?? '')
    .trim()
    .toLowerCase();
  if (!selected) return null;

  const option = subclassData.choiceOptions.find((entry) => {
    const slugValue = typeof entry === 'string' ? entry : entry?.slug;
    return String(slugValue ?? '')
      .trim()
      .toLowerCase() === selected;
  });

  return normalizeSpellcastingTradition(option?.tradition ?? null);
}

function normalizeSpellcastingTradition(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['arcane', 'divine', 'occult', 'primal'].includes(normalized) ? normalized : null;
}

function getSelectedDedicationAliases(feat) {
  return [...getFeatAliases(feat)].filter((alias) => alias.endsWith('-dedication'));
}

function getSelectedClassArchetypeDedicationAliases(feat) {
  return getSelectedDedicationAliases(feat).filter((alias) => {
    const classSlug = alias.replace(/-dedication$/u, '');
    return ClassRegistry.has(classSlug);
  });
}

function getSelectedClassArchetypeTraits(feat) {
  return getSelectedClassArchetypeDedicationAliases(feat)
    .map((alias) => alias.replace(/-dedication$/u, ''))
    .filter(Boolean);
}

function getPrimaryFeatAlias(feat) {
  if (feat?.slug) return feat.slug;

  const name = feat?.name?.trim();
  if (name) return slugify(name);

  return '';
}

function isArchetypeDedication(feat) {
  const traits = getFeatTraitSlugs(feat);
  return traits.includes('dedication') && traits.includes('archetype');
}

function getFeatTraitSlugs(feat) {
  return [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(feat?.system?.traits?.value ?? []),
  ].map((trait) => String(trait).toLowerCase());
}

function getArchetypeAssociationTraits(feat) {
  const genericTraits = new Set([
    'archetype',
    'dedication',
    'class',
    'multiclass',
    'general',
    'skill',
    'mythic',
  ]);
  const traits = [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(feat?.system?.traits?.value ?? []),
    ...(Array.isArray(feat?.additionalArchetype?.sourceTraits)
      ? feat.additionalArchetype.sourceTraits
      : []),
  ]
    .map((trait) => String(trait).toLowerCase())
    .filter((trait) => trait && !genericTraits.has(trait));

  if (traits.length > 0) return new Set(traits);

  const slug = String(feat?.slug ?? '').toLowerCase();
  if (slug.endsWith('-dedication')) return new Set([slug.replace(/-dedication$/u, '')]);

  return new Set();
}

function isStoredAdditionalArchetypeFeat(feat) {
  return (
    Array.isArray(feat?.additionalArchetype?.sourceTraits) &&
    feat.additionalArchetype.sourceTraits.length > 0
  );
}

function getArchetypeAssociationPhrases(feat) {
  const phrases = new Set();
  const name = String(feat?.name ?? '')
    .trim()
    .toLowerCase();
  if (name) {
    phrases.add(name);
    phrases.add(name.replace(/\s+dedication$/u, '').trim());
  }

  const slug = String(feat?.slug ?? '')
    .trim()
    .toLowerCase();
  if (slug) {
    phrases.add(slug.replace(/-/g, ' '));
    if (slug.endsWith('-dedication'))
      phrases.add(slug.replace(/-dedication$/u, '').replace(/-/g, ' '));
  }

  for (const trait of getArchetypeAssociationTraits(feat)) {
    phrases.add(String(trait).toLowerCase().replace(/-/g, ' '));
  }

  return [...phrases].filter((phrase) => phrase.length > 0);
}

function getArchetypePrerequisiteText(feat) {
  return (feat?.system?.prerequisites?.value ?? [])
    .map((entry) =>
      String(entry?.value ?? entry ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(' ; ');
}

function hasArchetypeDedicationPrerequisite(feat) {
  return /\bdedication\b/u.test(getArchetypePrerequisiteText(feat));
}

function isClassArchetypeDedication(feat) {
  const traits = [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(feat?.system?.traits?.value ?? []),
  ].map((trait) => String(trait).toLowerCase());
  const isClassLikeArchetype = traits.includes('class') || traits.includes('multiclass');
  return isArchetypeDedication(feat) && isClassLikeArchetype;
}

function getClassArchetypeTrait(feat) {
  const genericTraits = new Set([
    'archetype',
    'dedication',
    'class',
    'multiclass',
    'general',
    'skill',
    'mythic',
  ]);
  const traits = [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(feat?.system?.traits?.value ?? []),
  ]
    .map((trait) => String(trait).toLowerCase())
    .filter((trait) => trait && !genericTraits.has(trait));

  if (traits.length > 0) return traits[0];

  const slug = String(feat?.slug ?? '').toLowerCase();
  if (slug.endsWith('-dedication')) return slug.replace(/-dedication$/u, '');

  return '';
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

function addAncestryTraitAliases(target, slug) {
  const normalized = slugify(normalizeEquipmentValue(slug) ?? '');
  if (!normalized) return;
  const aliases = ANCESTRY_TRAIT_ALIASES[normalized] ?? [normalized];
  for (const alias of aliases) target.add(alias);
}

function addAncestryItemTraits(target, item) {
  const traits = Array.isArray(item?.traits) ? item.traits : item?.system?.traits?.value;
  if (!Array.isArray(traits)) return;
  for (const trait of traits) addAncestryTraitAliases(target, trait);
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

function resolveInjectedValue(value, item) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{item\|([^}]+)\}/g, (_match, path) => {
    const resolved = foundry.utils.getProperty(item, path);
    return resolved == null ? '' : String(resolved);
  });
}

export function evaluateRuleNumericValue(value, atLevel, item) {
  const resolved = resolveInjectedValue(value, item);
  if (typeof resolved === 'number') return resolved;

  const numeric = Number(resolved);
  if (Number.isFinite(numeric)) return numeric;

  if (typeof resolved !== 'string') return NaN;
  return evaluateRuleExpression(resolved, atLevel);
}

function evaluateRuleExpression(expression, atLevel) {
  const text = String(expression ?? '').trim();
  if (!text) return NaN;

  if (/^@actor\.level$/i.test(text)) return atLevel;

  const directNumber = Number(text);
  if (Number.isFinite(directNumber)) return directNumber;

  const ternaryArgs = parseFunctionArguments(text, 'ternary');
  if (ternaryArgs) {
    if (ternaryArgs.length < 3) return NaN;
    const condition = evaluateRuleCondition(ternaryArgs[0], atLevel);
    return evaluateRuleExpression(condition ? ternaryArgs[1] : ternaryArgs[2], atLevel);
  }

  return NaN;
}

function evaluateRuleCondition(expression, atLevel) {
  const text = String(expression ?? '').trim();
  if (!text) return false;

  const gteArgs = parseFunctionArguments(text, 'gte');
  if (gteArgs) return compareRuleExpressions(gteArgs, atLevel, (left, right) => left >= right);

  const gtArgs = parseFunctionArguments(text, 'gt');
  if (gtArgs) return compareRuleExpressions(gtArgs, atLevel, (left, right) => left > right);

  const lteArgs = parseFunctionArguments(text, 'lte');
  if (lteArgs) return compareRuleExpressions(lteArgs, atLevel, (left, right) => left <= right);

  const ltArgs = parseFunctionArguments(text, 'lt');
  if (ltArgs) return compareRuleExpressions(ltArgs, atLevel, (left, right) => left < right);

  const eqArgs = parseFunctionArguments(text, 'eq');
  if (eqArgs) return compareRuleExpressions(eqArgs, atLevel, (left, right) => left === right);

  const numeric = evaluateRuleExpression(text, atLevel);
  return Number.isFinite(numeric) && numeric !== 0;
}

function compareRuleExpressions(args, atLevel, comparator) {
  if (!Array.isArray(args) || args.length < 2) return false;
  const left = evaluateRuleExpression(args[0], atLevel);
  const right = evaluateRuleExpression(args[1], atLevel);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return comparator(left, right);
}

function parseFunctionArguments(expression, functionName) {
  const text = String(expression ?? '').trim();
  const prefix = `${functionName}(`;
  if (!text.toLowerCase().startsWith(prefix)) return null;
  if (!text.endsWith(')')) return null;

  const inner = text.slice(prefix.length, -1);
  const args = [];
  let depth = 0;
  let current = '';

  for (const char of inner) {
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    current += char;
  }

  if (current.trim().length > 0) args.push(current.trim());
  return args;
}
