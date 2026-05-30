import { ANCESTRY_TRAIT_ALIASES, ATTRIBUTES, INITIAL_SKILL_RETRAIN_SOURCE_TYPE, MIXED_ANCESTRY_CHOICE_FLAG, MIXED_ANCESTRY_UUID, MAX_LEVEL, PROFICIENCY_RANKS, SUBCLASS_TAGS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { SUBCLASS_SPELLS } from '../data/subclass-spells.js';
import { getAllPlannedFeats, getAllPlannedBoosts, getAllPlannedSpells } from './plan-model.js';
import { isDualClassEnabled, slugify } from '../utils/pf2e-api.js';
import { getDedicationAliasesFromDescription } from '../utils/feat-aliases.js';
import { evaluatePredicate } from '../utils/predicate.js';
import { getActiveSkillConfigEntry, getActiveSkillSlugs, isActiveSkillSlug, normalizeSkillSlug } from '../utils/skill-slugs.js';
import { getFeatLoreRules, getFeatSkillRules, PLAN_FEAT_KEYS } from '../utils/feat-skill-rules.js';
import { isCompendiumUuidInCategory } from '../system-support/profiles.js';
import { inferSf2eSpellcastingTraditionFromItem, normalizeSpellTradition } from '../utils/sf2e-spellcasting.js';
import { getRankAfterSkillRetrain } from '../utils/skill-retrains.js';

const CLASS_SUBCLASS_TYPES = {
  alchemist: 'research field',
  animist: 'practice',
  barbarian: 'instinct',
  bard: 'muse',
  champion: 'cause',
  cleric: 'doctrine',
  druid: 'order',
  envoy: 'leadership style',
  gunslinger: 'way',
  inventor: 'innovation',
  investigator: 'methodology',
  kineticist: 'gate',
  magus: 'study',
  mystic: 'connection',
  operative: 'specialization',
  oracle: 'mystery',
  psychic: 'conscious mind',
  ranger: "hunter's edge",
  rogue: 'racket',
  soldier: 'fighting style',
  sorcerer: 'bloodline',
  summoner: 'eidolon',
  swashbuckler: 'style',
  witch: 'patron',
  witchwarper: 'paradox',
  wizard: 'school',
};

const VARIABLE_SPELLCASTING_TRADITIONS = new Set(['bloodline', 'patron', 'connection', 'paradox']);
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
  const ancestryTraits = computeAncestryTraits(actor, plan, atLevel);
  const ancestryFeatTraits = computeAncestryFeatTraits(actor, plan, atLevel);

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
    ancestryTraits,
    ancestryFeatTraits,
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
  return (actor?.items?.filter?.((item) => item?.type === 'feat') ?? []).filter((feat) => !matchesAnyFeatIdentity(feat, removed));
}

function getEffectiveCharacterFeats(actor, plan, atLevel) {
  return [...getEffectiveActorFeats(actor, plan, atLevel), ...getEffectivePlannedFeats(plan, atLevel)];
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
  const increases = [...(levelData?.skillIncreases ?? []), ...(levelData?.customSkillIncreases ?? [])].filter((increase) => !matchesAnySkillIncrease(increase, level, removed));

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
      if (retrain?.original) originals.push({ ...retrain.original, fromLevel: retrain.fromLevel, sourceType: retrain.sourceType ?? retrain.original.sourceType ?? null });
    }
  }
  return originals;
}

function matchesAnyFeatIdentity(feat, candidates) {
  return candidates.some((candidate) => matchesFeatIdentity(feat, candidate));
}

function matchesFeatIdentity(feat, candidate) {
  if (!feat || !candidate) return false;
  const featIds = [feat.actorItemId, feat.id, feat._id, feat.uuid, feat.sourceId, feat.flags?.core?.sourceId, feat.slug].filter(Boolean);
  const candidateIds = [candidate.actorItemId, candidate.id, candidate._id, candidate.uuid, candidate.sourceId, candidate.flags?.core?.sourceId, candidate.slug].filter(Boolean);
  return featIds.some((id) => candidateIds.includes(id));
}

function matchesAnySkillIncrease(increase, level, candidates) {
  return candidates.some((candidate) => matchesSkillIncrease(increase, level, candidate));
}

function matchesSkillIncrease(increase, level, candidate) {
  if (!increase || !candidate) return false;
  if (Number.isInteger(Number(candidate.fromLevel)) && Number(candidate.fromLevel) !== Number(level)) return false;
  const skill = String(increase.skill ?? '')
    .trim()
    .toLowerCase();
  const candidateSkill = String(candidate.skill ?? '')
    .trim()
    .toLowerCase();
  const toRank = Number(increase.toRank);
  const candidateRank = Number(candidate.toRank);
  return !!skill && skill === candidateSkill && Number.isFinite(toRank) && toRank === candidateRank;
}

function computeTrackedClasses(entries) {
  return entries.filter((entry) => entry?.classDef && entry?.slug).map((entry) => computeClassState(entry.classDef, entry.slug));
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

  return Object.fromEntries(Object.entries(entries).filter(([, rank]) => Number.isFinite(rank) && rank > 0));
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
  if (typeof tradition === 'string' && tradition.length > 0 && !VARIABLE_SPELLCASTING_TRADITIONS.has(tradition)) {
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
  addAncestryItemTraits(traits, getOwnedItems(actor).find((item) => item?.type === 'ancestry') ?? null);

  for (const value of [actor?.ancestry?.slug ?? null, actor?.ancestry?.name ?? null, actor?.heritage?.slug ?? null, actor?.heritage?.name ?? null]) {
    addAncestryTraitAliases(traits, value);
  }

  for (const heritage of getEffectiveHeritageItems(actor, plan, atLevel)) {
    addAncestryTraitAliases(traits, heritage?.slug ?? null);
    addAncestryTraitAliases(traits, heritage?.name ?? null);
    addAncestryItemTraits(traits, heritage);
  }

  const mixedAncestrySelection = actor?.heritage?.flags?.pf2e?.rulesSelections?.[MIXED_ANCESTRY_CHOICE_FLAG] ?? actor?.heritage?.flags?.['pf2e-leveler']?.mixedAncestrySelection ?? null;
  if (actor?.heritage?.uuid === MIXED_ANCESTRY_UUID || actor?.heritage?.slug === 'mixed-ancestry') {
    addAncestryTraitAliases(traits, mixedAncestrySelection);
  }

  for (const item of getEffectiveActorFeats(actor, plan, atLevel)) {
    const featSlug = slugify(item?.slug ?? item?.name ?? '');
    if (featSlug !== 'adopted-ancestry') continue;
    const selected = item?.flags?.pf2e?.rulesSelections?.adoptedAncestry ?? item?.flags?.pf2e?.rulesSelections?.ancestry ?? null;
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

function computeAncestryFeatTraits(actor, plan, atLevel) {
  const traits = new Set();

  addAncestryTraitAliases(traits, actor?.system?.details?.ancestry?.trait ?? null);
  addAncestryFeatIdentity(traits, actor?.ancestry ?? null);
  addAncestryFeatIdentity(traits, getOwnedItems(actor).find((item) => item?.type === 'ancestry') ?? null);

  for (const heritage of getEffectiveHeritageItems(actor, plan, atLevel)) {
    addAncestryFeatIdentity(traits, heritage);
  }

  const mixedAncestrySelection = actor?.heritage?.flags?.pf2e?.rulesSelections?.[MIXED_ANCESTRY_CHOICE_FLAG] ?? actor?.heritage?.flags?.['pf2e-leveler']?.mixedAncestrySelection ?? null;
  if (actor?.heritage?.uuid === MIXED_ANCESTRY_UUID || actor?.heritage?.slug === 'mixed-ancestry') {
    addAncestryTraitAliases(traits, mixedAncestrySelection);
  }

  for (const item of getEffectiveActorFeats(actor, plan, atLevel)) {
    const featSlug = slugify(item?.slug ?? item?.name ?? '');
    if (featSlug !== 'adopted-ancestry') continue;
    const selected = item?.flags?.pf2e?.rulesSelections?.adoptedAncestry ?? item?.flags?.pf2e?.rulesSelections?.ancestry ?? null;
    addAncestryTraitAliases(traits, selected);
  }

  for (const feat of getEffectivePlannedFeats(plan, atLevel)) {
    const featSlug = slugify(feat?.slug ?? feat?.name ?? '');
    if (featSlug !== 'adopted-ancestry') continue;
    const selected = feat?.choices?.adoptedAncestry ?? feat?.adoptedAncestry ?? null;
    addAncestryTraitAliases(traits, selected);
  }

  if (traits.size === 0) {
    for (const trait of actor?.system?.traits?.value ?? []) {
      addAncestryTraitAliases(traits, trait);
    }
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
      addHeritageAlias(aliases, candidate);
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
  if (
    String(item?.type ?? item?.itemType ?? '')
      .trim()
      .toLowerCase() === 'heritage'
  )
    return true;
  const uuid = String(item?.uuid ?? '')
    .trim()
    .toLowerCase();
  return uuid.includes('.heritages.') || uuid.includes('.heritage.');
}

function computeDivineFontState(actor) {
  for (const item of getOwnedItems(actor)) {
    const font = inferDivineFontFromOwnedItem(item);
    if (font) return font;
  }

  return null;
}

function inferDivineFontFromOwnedItem(item) {
  if (item?.type === 'spellcastingEntry') {
    return inferDivineFontFromText(item?.name, { requireFont: true, requireDivine: true });
  }

  if (!isOwnedClassFeatureItem(item, Number.POSITIVE_INFINITY)) return null;

  const selectionFont = inferDivineFontFromSelections(item);
  if (selectionFont) return selectionFont;

  return inferDivineFontFromText([
    item?.name,
    item?.slug,
    item?.system?.slug,
    item?.sourceId,
    item?.flags?.core?.sourceId,
    item?._stats?.compendiumSource,
  ].join(' '), { requireFont: true });
}

function inferDivineFontFromSelections(item) {
  const itemSlug = slugify(item?.slug ?? item?.name ?? '');
  const canTrustUnqualifiedSelection = itemSlug.includes('divine-font') || itemSlug.includes('font');
  const sources = [
    item?.flags?.pf2e?.rulesSelections,
    item?.flags?.system?.rulesSelections,
    item?.flags?.['pf2e-leveler']?.classFeatureChoices,
  ];

  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      const keySlug = slugify(key);
      if (!canTrustUnqualifiedSelection && !keySlug.includes('font')) continue;
      const font = inferDivineFontFromChoiceValue(value);
      if (font) return font;
    }
  }

  return null;
}

function inferDivineFontFromChoiceValue(value) {
  if (typeof value === 'string') return inferDivineFontFromText(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const font = inferDivineFontFromChoiceValue(entry);
      if (font) return font;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const key of ['value', 'slug', 'name', 'label', 'uuid']) {
      const font = inferDivineFontFromChoiceValue(value[key]);
      if (font) return font;
    }
  }
  return null;
}

function inferDivineFontFromText(value, { requireFont = false, requireDivine = false } = {}) {
  const slug = slugify(String(value ?? ''));
  if (!slug) return null;
  if (requireFont && !slug.includes('font')) return null;
  if (requireDivine && !slug.includes('divine-font')) return null;

  const isHealingFont = /(^|-)healing-font($|-)/u.test(slug)
    || /(^|-)heal-font($|-)/u.test(slug)
    || slug.includes('divine-font-healing')
    || slug.includes('divine-font-heal');
  if (isHealingFont) return 'healing';

  const isHarmfulFont = /(^|-)harmful-font($|-)/u.test(slug)
    || /(^|-)harming-font($|-)/u.test(slug)
    || /(^|-)harm-font($|-)/u.test(slug)
    || slug.includes('divine-font-harmful')
    || slug.includes('divine-font-harm');
  if (isHarmfulFont) return 'harmful';

  if (!requireFont) {
    if (['healing', 'heal'].includes(slug)) return 'healing';
    if (['harmful', 'harming', 'harm'].includes(slug)) return 'harmful';
  }

  return null;
}

function computeSpellcastingState(actor, plan, atLevel, classDefs) {
  const trackedClassDefs = Array.isArray(classDefs) ? classDefs.filter(Boolean) : [classDefs].filter(Boolean);
  const entries = getOwnedItems(actor).filter((item) => item?.type === 'spellcastingEntry');
  const spells = getOwnedItems(actor).filter((item) => item?.type === 'spell');
  const traditions = new Set(entries.map((item) => item?.system?.tradition?.value ?? null).filter((value) => typeof value === 'string' && value.length > 0));
  const spellNames = new Set();
  const spellTraits = new Set();
  let hasNonCantripFocusSpell = false;
  const innateAncestrySpellSourceTraits = computeInnateAncestrySpellSourceTraits(actor, plan, atLevel, spells, entries);

  for (const classDef of trackedClassDefs) {
    const classTradition = classDef?.spellcasting?.tradition ?? null;
    if (typeof classTradition === 'string' && !VARIABLE_SPELLCASTING_TRADITIONS.has(classTradition)) {
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

    const traits = getSpellTraitValues(spell);
    if (isNonCantripFocusSpellTraits(traits)) hasNonCantripFocusSpell = true;
    for (const trait of traits) {
      spellTraits.add(trait);
    }
  }

  for (const spell of getAllPlannedSpells(plan, atLevel)) {
    const spellSlug = slugify(spell?.slug ?? spell?.name ?? '');
    if (spellSlug) spellNames.add(spellSlug);

    const traits = getSpellTraitValues(spell);
    if (isNonCantripFocusSpellTraits(traits)) hasNonCantripFocusSpell = true;
    for (const trait of traits) {
      spellTraits.add(trait);
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

  const actorFocusMax = Number(actor?.system?.resources?.focus?.max ?? 0);
  const focusMax = Math.max(Number.isFinite(actorFocusMax) ? actorFocusMax : 0, hasNonCantripFocusSpell ? 1 : 0);

  return {
    hasAny: traditions.size > 0,
    hasSpellSlots,
    spellNames,
    spellTraits,
    traditions,
    focusPool: focusMax > 0,
    focusPointsMax: focusMax,
    innateAncestrySpellSourceTraits,
  };
}

function computeInnateAncestrySpellSourceTraits(actor, plan, atLevel, spells, entries) {
  const innateSpellSourceIds = getOwnedInnateSpellSourceIds(spells, entries);
  const traits = new Set();

  for (const entry of getEffectiveAncestryFeatEntries(actor, plan, atLevel)) {
    const sourceSpellUuids = getFeatSpellGrantUuids(entry.feat);
    if (sourceSpellUuids.length === 0) continue;

    const hasAppliedInnateSpell = sourceSpellUuids.some((uuid) => innateSpellSourceIds.has(uuid));
    const hasPlannedInnateSpell = entry.category === 'ancestryFeats';
    if (!hasAppliedInnateSpell && !hasPlannedInnateSpell) continue;

    for (const trait of getAncestryFeatSourceTraits(entry.feat)) {
      traits.add(trait);
    }
  }

  return traits;
}

function getOwnedInnateSpellSourceIds(spells, entries) {
  const innateEntryIds = new Set(entries.filter((entry) => entry?.system?.prepared?.value === 'innate').flatMap((entry) => getItemIdentityValues(entry)));
  const sourceIds = new Set();

  for (const spell of spells) {
    const location = getSpellLocationValue(spell);
    if (!location || !innateEntryIds.has(location)) continue;

    const sourceId = getActorItemSourceId(spell);
    if (sourceId) sourceIds.add(sourceId);
  }

  return sourceIds;
}

function getEffectiveAncestryFeatEntries(actor, plan, atLevel) {
  const entries = getEffectiveActorFeats(actor, plan, atLevel)
    .filter((feat) => isActorAncestryFeat(feat))
    .map((feat) => ({ feat, category: 'actor' }));

  for (let level = 1; level <= atLevel; level++) {
    for (const entry of getEffectivePlannedFeatEntriesForLevel(plan, level, atLevel)) {
      if (entry.category === 'ancestryFeats') entries.push(entry);
    }
  }

  return entries;
}

function isActorAncestryFeat(feat) {
  const category = String(feat?.system?.category ?? feat?.category ?? '')
    .trim()
    .toLowerCase();
  if (category === 'ancestry') return true;

  const location = getActorFeatLocation(feat).toLowerCase();
  return location.startsWith('ancestry-') || location.startsWith('ancestryparagon-') || location.startsWith('xdy_ancestryparagon-');
}

function getFeatSpellGrantUuids(feat) {
  const uuids = new Set();

  collectSpellUuidsFromValue(feat?.choices, uuids);
  collectSpellUuidsFromValue(feat?.flags?.pf2e?.rulesSelections, uuids);

  for (const item of feat?.grantedItems ?? []) {
    const uuid = item?.uuid ?? item?.sourceId ?? item?.flags?.core?.sourceId;
    if (isSpellCompendiumUuid(uuid) || item?.type === 'spell') uuids.add(uuid);
  }

  for (const rule of feat?.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem') continue;
    if (isSpellCompendiumUuid(rule.uuid)) uuids.add(rule.uuid);
  }

  return [...uuids].filter(Boolean);
}

function collectSpellUuidsFromValue(value, target) {
  if (typeof value === 'string') {
    if (isSpellCompendiumUuid(value)) target.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSpellUuidsFromValue(entry, target);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectSpellUuidsFromValue(entry, target);
  }
}

function isSpellCompendiumUuid(value) {
  return typeof value === 'string' && isCompendiumUuidInCategory(value, 'spells');
}

function getAncestryFeatSourceTraits(feat) {
  const ignoredTraits = new Set(['ancestry', 'common', 'uncommon', 'rare', 'unique']);
  return getFeatTraitSlugs(feat).filter((trait) => trait && !ignoredTraits.has(trait));
}

function getSpellLocationValue(spell) {
  const location = spell?.system?.location;
  if (typeof location === 'string') return location.trim();
  if (location && typeof location === 'object' && typeof location.value === 'string') return location.value.trim();
  return '';
}

function getItemIdentityValues(item) {
  return [item?.id, item?._id, item?.uuid].filter((value) => typeof value === 'string' && value.length > 0);
}

function getActorItemSourceId(item) {
  return item?.sourceId ?? item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.uuid ?? null;
}

function getSpellTraitValues(spell) {
  return [...(spell?.system?.traits?.value ?? []), ...(spell?.traits ?? [])].map((trait) => normalizeEquipmentValue(trait)).filter(Boolean);
}

function isNonCantripFocusSpellTraits(traits) {
  return traits.includes('focus') && !traits.includes('cantrip');
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
    const traits = (feat?.traits ?? feat?.system?.traits?.value ?? []).map((trait) => String(trait).trim().toLowerCase());
    const combined = `${slug} ${name} ${traits.join(' ')}`;
    const isDedication = traits.includes('dedication') || combined.includes('dedication');
    if (!isDedication) continue;

    const classSlug = ClassRegistry.getAll().find((candidate) => candidate?.spellcasting && combined.includes(String(candidate.slug).toLowerCase()))?.slug ?? null;
    if (!classSlug) continue;
    if (actorFeatSlugs.has(slug)) continue;

    const dedicationClass = ClassRegistry.get(classSlug);
    const tradition = dedicationClass?.spellcasting?.tradition ?? null;
    if (typeof tradition === 'string' && tradition.length > 0 && !VARIABLE_SPELLCASTING_TRADITIONS.has(tradition)) {
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
    for (const attr of boostList) {
      if (isPlannedBoostReflectedOnActor(actor, attr, level, actorLevel)) continue;
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
  const actorMod = actorAbilities?.mod;
  const systemMod = systemAbility?.mod;
  const displayMod = Number.isFinite(actorMod)
    ? Number(actorMod)
    : Number.isFinite(systemMod)
      ? Number(systemMod)
      : null;

  for (const value of [actorMod, systemMod, actorAbilities?.base, systemAbility?.base]) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric % 1 === 0) continue;
    if (isRelevantFractionalAbilityModifier(numeric, displayMod)) return numeric;
  }

  if (Number.isFinite(actorMod)) return Number(actorMod);
  if (Number.isFinite(systemMod)) return Number(systemMod);

  const base = actorAbilities?.base;
  if (Number.isFinite(base)) return Number(base);

  return 0;
}

function isRelevantFractionalAbilityModifier(numeric, displayMod) {
  if (displayMod == null) return true;
  if (Math.trunc(numeric) === Math.trunc(displayMod)) return true;
  return numeric < displayMod && Math.abs(displayMod - numeric - 0.5) < 0.001;
}

function isPlannedBoostReflectedOnActor(actor, attr, boostLevel, actorLevel) {
  if (!Number.isFinite(actorLevel)) return false;
  if (boostLevel < actorLevel) return true;
  if (boostLevel > actorLevel) return false;

  const actorBoosts = actor?.system?.build?.attributes?.boosts ?? {};
  const actorBoostsAtLevel = new Set(normalizeAbilityBoostList(actorBoosts[boostLevel]));
  if (actorBoostsAtLevel.has(attr)) return true;

  const currentModifier = getActorAbilityModifier(actor, attr);
  if (boostLevel === 5 && Number.isFinite(currentModifier) && currentModifier % 1 !== 0) return true;

  return false;
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
  const includeActorSkillRanks = options.includeActorSkillRanks !== false;
  const initialSkillTraining = Array.isArray(options.initialSkillTraining) ? options.initialSkillTraining : [];
  const trackedClassDefs = Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean);
  const skills = {};
  for (const skill of getActiveSkillSlugs()) {
    skills[skill] = includeActorSkillRanks
      ? (actor?.system?.skills?.[skill]?.rank ?? PROFICIENCY_RANKS.UNTRAINED)
      : PROFICIENCY_RANKS.UNTRAINED;
  }

  applyInitialSkillTraining(skills, getAutomaticInitialSkillTraining(actor, plan, trackedClassDefs));
  applyInitialSkillTraining(skills, initialSkillTraining);
  if (includeActorSkillRanks) {
    applyActorSkillRankRules(skills, actor, atLevel);
    applyActorDeitySkill(skills, actor);
  }
  applyInitialSkillRetrains(skills, plan, atLevel);

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;

    if (includePlannedFeatRules) applyPlannedLevelSkillRankRules(skills, plan, level, atLevel);
    applyInitialSkillTraining(skills, getPlannedGrantedBackgroundSkillTrainingForLevel(plan, level, atLevel));

    for (const rawSkill of levelData.intBonusSkills ?? []) {
      const skill = normalizeSkillSlug(rawSkill);
      if (!isActiveSkillSlug(skill)) continue;
      if ((skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED) < PROFICIENCY_RANKS.TRAINED) {
        skills[skill] = PROFICIENCY_RANKS.TRAINED;
      }
    }

    if (level === atLevel && !includeCurrentLevelSkillIncrease) continue;

    for (const inc of getEffectiveLevelSkillIncreases(plan, level, atLevel)) {
      const skill = normalizeSkillSlug(inc.skill);
      if (skill && inc.toRank > (skills[skill] ?? 0)) {
        skills[skill] = inc.toRank;
      }
    }
  }

  return skills;
}

export function getIntelligenceBenefitCount(actor, plan, level) {
  const levelData = plan?.levels?.[level];
  if (!levelData?.abilityBoosts?.includes('int')) return 0;

  const actorLevel = Number(plan?.importedFromActor?.actorLevel ?? actor?.system?.details?.level?.value ?? 0);
  if (plan?.importedFromActor?.hideHistoricalSkillIncreases === true && Number.isFinite(actorLevel) && level < actorLevel) {
    return getHistoricalIntelligenceBenefitCount(actor, plan, level);
  }

  const before = computeBuildState(actor, plan, level - 1);
  const after = computeBuildState(actor, plan, level);
  const beforeInt = before.attributes.int ?? 0;
  const afterInt = after.attributes.int ?? 0;
  return Math.max(0, afterInt - beforeInt);
}

export function isImportedHistoricalSkillLevel(plan, level) {
  const actorLevel = Number(plan?.importedFromActor?.actorLevel ?? 0);
  const targetLevel = Number(level);
  return plan?.importedFromActor?.hideHistoricalSkillIncreases === true
    && Number.isFinite(actorLevel)
    && Number.isFinite(targetLevel)
    && targetLevel >= 1
    && targetLevel <= actorLevel;
}

export function getImportedInitialSkillTraining(plan) {
  const skills = new Set();
  for (const rawSkill of plan?.importedFromActor?.initialSkills ?? []) {
    const skill = normalizeSkillSlug(rawSkill);
    if (isActiveSkillSlug(skill)) skills.add(skill);
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

export function getImportedInitialSkillChoiceTraining(plan) {
  const skills = new Set();
  for (const rawSkill of Object.values(plan?.importedFromActor?.initialSkillChoices ?? {})) {
    const skill = normalizeSkillSlug(rawSkill);
    if (isActiveSkillSlug(skill)) skills.add(skill);
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

export function getImportedInitialSkillLimit(actor, classDef = null) {
  const actorClass = getActorClassItem(actor, classDef);
  const actorAdditional = Number(actorClass?.system?.trainedSkills?.additional ?? 0);
  const classAdditional = Number(classDef?.trainedSkills?.additional ?? 0);
  const additional = Math.max(actorAdditional, classAdditional);
  const flexibleClassPicks = Number.isFinite(additional) && additional > 0 ? additional : 0;
  return flexibleClassPicks + Math.max(0, getLevelOneIntModifier(actor));
}

export function getAutomaticInitialSkillTraining(actor, plan = null, classDef = null) {
  return getAutomaticInitialSkillTrainingEntries(actor, plan, classDef).map((entry) => entry.skill);
}

export function getAutomaticInitialSkillTrainingEntries(actor, plan = null, classDef = null) {
  const skills = new Map();
  const classDefs = Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean);
  const classSlugs = getTrackedClassSlugs(actor, plan, classDefs);
  const actorClass = getActorClassItem(actor, classDefs[0] ?? null);

  addInitialSkillList(skills, actorClass?.system?.trainedSkills?.value, getSourceLabel(actorClass, 'Class'));
  for (const entry of classDefs) {
    addInitialSkillList(skills, entry?.trainedSkills?.fixed, getSourceLabel(entry, 'Class'));
  }

  for (const item of getAutomaticInitialSkillItems(actor, classSlugs, plan)) {
    const sourceLabel = getSourceLabel(item, 'Automatic');
    addInitialSkillList(skills, item?.system?.trainedSkills?.value, sourceLabel);
    addInitialSkillRuleTraining(skills, item, sourceLabel);
    addExplicitDescriptionTraining(skills, item?.system?.description?.value ?? item?.description ?? '', sourceLabel);
  }

  return [...skills.values()].sort((a, b) => a.skill.localeCompare(b.skill));
}

export function getInitialSkillSourceItems(actor, plan = null, classDef = null) {
  const classDefs = Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean);
  const classSlugs = getTrackedClassSlugs(actor, plan, classDefs);
  return getAutomaticInitialSkillItems(actor, classSlugs, plan);
}

export function getAutomaticInitialLoreTraining(actor, plan = null, classDef = null) {
  const classDefs = Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean);
  const classSlugs = getTrackedClassSlugs(actor, plan, classDefs);
  return dedupeStrings(getAutomaticInitialSkillItems(actor, classSlugs, plan).flatMap((item) => extractLoreTrainingFromItem(item, actor)));
}

function getTrackedClassSlugs(actor, plan, classDefs) {
  const slugs = new Set([
    actor?.class?.slug,
    actor?.class?.system?.slug,
    getActorClassItem(actor)?.slug,
    getActorClassItem(actor)?.system?.slug,
    plan?.classSlug,
    plan?.dualClassSlug,
    ...classDefs.map((entry) => entry?.slug),
  ]);
  return [...slugs]
    .map((slug) => String(slug ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function getAutomaticInitialSkillItems(actor, classSlugs, plan = null) {
  const items = [];
  const seen = new Set();
  const addItem = (item) => {
    if (!item || typeof item !== 'object') return;
    const key = item.uuid ?? item.id ?? item._id ?? `${item.type ?? ''}:${item.slug ?? item.name ?? items.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  addItem(actor?.background);
  for (const item of getOwnedItems(actor)) {
    if (isBackgroundItem(item) || isInitialSubclassItem(item, classSlugs) || isInitialSkillSourceFeatItem(item, actor, plan)) addItem(item);
  }

  return items;
}

function isInitialSkillSourceFeatItem(item, actor, plan) {
  if (String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() !== 'feat') return false;
  if (extractSkillGrantsFromRules(item?.system?.rules ?? [], item).length === 0) return false;
  if (getEffectivePlannedFeatsForLevel(plan, 1, 1).some((feat) => matchesFeatIdentity(item, feat))) return true;
  return isGrantedByInitialAncestryOrHeritage(item, actor);
}

function isGrantedByInitialAncestryOrHeritage(item, actor) {
  const grantedById = String(item?.flags?.pf2e?.grantedBy?.id ?? '').trim();
  if (!grantedById) return false;

  const source = getOwnedItems(actor).find((ownedItem) => String(ownedItem?._id ?? ownedItem?.id ?? '').trim() === grantedById);
  const sourceType = String(source?.type ?? source?.itemType ?? '').trim().toLowerCase();
  if (!['ancestry', 'heritage'].includes(sourceType)) return false;

  const sourceLevel = Number(source?.system?.level?.value ?? 1);
  return !Number.isFinite(sourceLevel) || sourceLevel <= 1;
}

function isBackgroundItem(item) {
  return String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() === 'background';
}

function getPlannedGrantedBackgroundItemsForLevel(plan, level, atLevel = level) {
  return getEffectivePlannedFeatsForLevel(plan, level, atLevel).flatMap((feat) => getGrantedBackgroundItems(feat));
}

function getEffectivePlannedGrantedBackgroundItems(plan, atLevel) {
  const backgrounds = [];
  for (const feat of getEffectivePlannedFeats(plan, atLevel)) {
    backgrounds.push(...getGrantedBackgroundItems(feat));
  }
  return backgrounds;
}

function getGrantedBackgroundItems(source) {
  return (Array.isArray(source?.grantedItems) ? source.grantedItems : []).filter(isBackgroundItem);
}

function getPlannedGrantedBackgroundSkillTrainingForLevel(plan, level, atLevel) {
  return dedupeStrings(
    getPlannedGrantedBackgroundItemsForLevel(plan, level, atLevel)
      .flatMap((item) => getSkillTrainingFromItem(item)),
  );
}

function getPlannedGrantedBackgroundLoreTrainingForLevel(plan, level, atLevel, actor = null) {
  return dedupeStrings(
    getPlannedGrantedBackgroundItemsForLevel(plan, level, atLevel)
      .flatMap((item) => extractLoreTrainingFromItem(item, actor)),
  );
}

function getSkillTrainingFromItem(item) {
  const skills = new Map();
  const sourceLabel = getSourceLabel(item, 'Automatic');
  addInitialSkillList(skills, item?.system?.trainedSkills?.value, sourceLabel);
  addInitialSkillRuleTraining(skills, item, sourceLabel);
  addExplicitDescriptionTraining(skills, item?.system?.description?.value ?? item?.description ?? '', sourceLabel);
  return [...skills.keys()];
}

function dedupeStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function isInitialSubclassItem(item, classSlugs) {
  return classSlugs.some((classSlug) => itemHasTagFamily(item, SUBCLASS_TAGS[classSlug]));
}

function itemHasTagFamily(item, expected) {
  const tag = String(expected ?? '').trim().toLowerCase();
  if (!tag) return false;
  return getItemOtherTags(item).some((candidate) => candidate === tag || candidate.startsWith(`${tag}-`));
}

function getItemOtherTags(item) {
  return [...(item?.otherTags ?? []), ...(item?.system?.traits?.otherTags ?? [])]
    .map((tag) => String(tag ?? '').trim().toLowerCase())
    .filter(Boolean);
}

function addInitialSkillList(target, rawSkills, sourceLabel) {
  for (const rawSkill of Array.isArray(rawSkills) ? rawSkills : []) {
    const skill = normalizeSkillSlug(rawSkill);
    addInitialSkillEntry(target, skill, sourceLabel);
  }
}

function addInitialSkillRuleTraining(target, item, sourceLabel) {
  for (const skill of extractSkillGrantsFromRules(item?.system?.rules ?? [], item)) {
    addInitialSkillEntry(target, skill, sourceLabel);
  }
}

function extractSkillGrantsFromRules(rules, item = null) {
  const skills = [];
  for (const rule of rules ?? []) {
    if (rule?.key !== 'ActiveEffectLike') continue;
    if (!matchesRuleAtLevel(rule, 1)) continue;

    const path = resolveInjectedValue(rule.path, item);
    const match = String(path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
    if (!match) continue;

    const skill = normalizeSkillSlug(match[1]);

    const value = evaluateRuleNumericValue(rule.value, 1, item);
    if (Number.isFinite(value) && value >= PROFICIENCY_RANKS.TRAINED) {
      skills.push(skill);
    }
  }
  return skills;
}

function addExplicitDescriptionTraining(target, html, sourceLabel) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!description) return;

  const clauses = description.match(/\b(?:you\s+)?(?:become|are|gain)\s+(?:the\s+)?trained(?:\s+proficiency\s+rank)?\s+in\s+([^.!?]+)/gu) ?? [];
  for (const clause of clauses) {
    if (/\b(?:your\s+choice\s+of|choice\s+of|skill\s+of\s+your\s+choice|chosen\s+skill|skill\s+you\s+chose)\b/u.test(clause)) continue;
    for (const skill of getActiveSkillSlugs()) {
      if (skillNameAppearsInClause(skill, clause)) addInitialSkillEntry(target, skill, sourceLabel);
    }
  }
}

function addInitialSkillEntry(target, rawSkill, sourceLabel) {
  const skill = normalizeSkillSlug(rawSkill);
  if (!isActiveSkillSlug(skill) || target.has(skill)) return;
  target.set(skill, {
    skill,
    sourceLabel: sourceLabel || 'Automatic',
  });
}

function extractLoreTrainingFromItem(item, actor = null) {
  const entries = Array.isArray(item?.system?.trainedSkills?.lore) ? item.system.trainedSkills.lore : [];
  const actorLoreSlugs = new Set(getActorLoreSlugs(actor));
  const lores = [];

  for (const entry of entries) {
    const options = splitLoreTrainingOptions(entry);
    if (options.length === 0) continue;
    if (options.length === 1) {
      lores.push(normalizeLoreSlug(options[0]));
      continue;
    }

    const matching = options
      .map((option) => normalizeLoreSlug(option))
      .find((slug) => actorLoreSlugs.has(slug));
    if (matching) lores.push(matching);
  }

  return dedupeStrings(lores);
}

function splitLoreTrainingOptions(value) {
  return String(value ?? '')
    .split(/\s+or\s+|,/iu)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLoreSlug(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, ' ');
  if (!normalized) return '';
  const withLore = /\blore\b/u.test(normalized) ? normalized : `${normalized} lore`;
  return slugify(withLore);
}

function getActorLoreSlugs(actor) {
  return getOwnedItems(actor)
    .filter((item) => item?.type === 'lore')
    .map((item) => normalizeLoreSlug(item?.slug ?? item?.name ?? ''))
    .filter(Boolean);
}

function getSourceLabel(source, fallback) {
  const name = String(source?.name ?? '').trim();
  return name || fallback;
}

function skillNameAppearsInClause(skill, clause) {
  const candidates = new Set([
    skill,
    skill.replace(/-/gu, ' '),
  ]);
  const configEntry = getActiveSkillConfigEntry(skill);
  const label = typeof configEntry === 'string' ? configEntry : configEntry?.label;
  if (label) candidates.add(String(label).toLowerCase());

  return [...candidates].some((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'u').test(clause);
  });
}

function getLevelOneIntModifier(actor) {
  let intMod = getActorAbilityModifier(actor, 'int');
  const boosts = actor?.system?.build?.attributes?.boosts ?? {};
  const hasLevelOneIntBoost = normalizeAbilityBoostList(boosts[1]).includes('int');

  for (const [levelKey, boostList] of Object.entries(boosts)) {
    const level = Number(levelKey);
    if (!Number.isInteger(level) || level <= 1) continue;
    for (const boost of normalizeAbilityBoostList(boostList)) {
      if (boost !== 'int') continue;
      if (hasLevelOneIntBoost && intMod === 4) continue;
      intMod = reverseApplyAbilityBoost(intMod);
    }
  }

  return Math.trunc(intMod);
}

function getHistoricalIntelligenceBenefitCount(actor, plan, level) {
  let afterRaw = getActorAbilityModifier(actor, 'int');
  const boostEntries = {
    ...(actor?.system?.build?.attributes?.boosts ?? {}),
    ...getAllPlannedBoosts(plan, MAX_LEVEL),
  };

  const levels = Object.keys(boostEntries)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= level)
    .sort((a, b) => b - a);

  for (const boostLevel of levels) {
    if (!normalizeAbilityBoostList(boostEntries[boostLevel]).includes('int')) continue;
    afterRaw = reverseApplyAbilityBoost(afterRaw);
  }

  const beforeRaw = afterRaw;
  const rawAfterLevel = applyAbilityBoostValue(beforeRaw);
  return Math.max(0, Math.trunc(rawAfterLevel) - Math.trunc(beforeRaw));
}

function applyAbilityBoostValue(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric >= 4 ? numeric + 0.5 : numeric + 1;
}

function normalizeAbilityBoostList(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value)
        .filter(([, selected]) => selected === true || selected === 1 || selected === 'true' || selected === 'selected')
        .map(([key]) => key)
      : [value];

  return entries
    .map((entry) => normalizeAbilityBoostKey(entry))
    .filter((entry) => ATTRIBUTES.includes(entry));
}

function normalizeAbilityBoostKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const aliases = {
    strength: 'str',
    dexterity: 'dex',
    constitution: 'con',
    intelligence: 'int',
    wisdom: 'wis',
    charisma: 'cha',
  };
  return aliases[normalized] ?? normalized;
}

function reverseApplyAbilityBoost(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 4 ? numeric - 0.5 : numeric - 1;
}

function applyInitialSkillTraining(skills, initialSkillTraining) {
  for (const rawSkill of initialSkillTraining) {
    const skill = normalizeSkillSlug(rawSkill);
    if (!isActiveSkillSlug(skill)) continue;
    skills[skill] = Math.max(skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED, PROFICIENCY_RANKS.TRAINED);
  }
}

function applyInitialSkillRetrains(skills, plan, atLevel) {
  for (const original of getActiveRetrainedSkillIncreaseOriginals(plan, atLevel)) {
    if (!isInitialSkillRetrainOriginal(original)) continue;
    const skill = normalizeSkillSlug(original.skill);
    if (!isActiveSkillSlug(skill)) continue;

    const fromRank = Number(original.fromRank ?? PROFICIENCY_RANKS.UNTRAINED);
    const toRank = Number(original.toRank ?? PROFICIENCY_RANKS.TRAINED);
    const currentRank = Number(skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED);
    if (!Number.isFinite(fromRank) || !Number.isFinite(toRank) || !Number.isFinite(currentRank)) continue;
    const downgradedRank = getRankAfterSkillRetrain(currentRank, fromRank, toRank);
    if (downgradedRank < currentRank) skills[skill] = downgradedRank;
  }
}

function isInitialSkillRetrainOriginal(original) {
  if (original?.sourceType === INITIAL_SKILL_RETRAIN_SOURCE_TYPE) return true;
  return Number(original?.fromLevel) === 1
    && Number(original?.fromRank) === PROFICIENCY_RANKS.UNTRAINED
    && Number(original?.toRank) === PROFICIENCY_RANKS.TRAINED;
}

function applyActorDeitySkill(skills, actor) {
  const deitySkill = resolveActorDeitySkill(actor);
  if (!deitySkill || !isActiveSkillSlug(deitySkill)) return skills;
  skills[deitySkill] = Math.max(skills[deitySkill] ?? PROFICIENCY_RANKS.UNTRAINED, PROFICIENCY_RANKS.TRAINED);
  return skills;
}

function resolveActorDeitySkill(actor) {
  const deityItem = getOwnedItems(actor).find((item) => item?.type === 'deity') ?? null;
  return normalizeSkillSlug(deityItem?.skill ?? deityItem?.system?.skill ?? actor?.system?.details?.deity?.skill ?? actor?.system?.details?.deity?.system?.skill);
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

    const slug = normalizeLoreSlug(item?.slug ?? item?.name ?? '');
    if (!slug) continue;

    const rank = Number(item?.system?.proficient?.value ?? item?.system?.proficiency?.value ?? item?.system?.rank ?? 1);

    if (!Number.isFinite(rank)) continue;
    lores[slug] = Math.max(lores[slug] ?? 0, rank);
  }

  for (const lore of getAutomaticInitialLoreTraining(actor, plan, ClassRegistry.get(plan.classSlug))) {
    lores[lore] = Math.max(lores[lore] ?? 0, PROFICIENCY_RANKS.TRAINED);
  }

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan.levels?.[level];
    if (!levelData) continue;
    for (const lore of getPlannedGrantedBackgroundLoreTrainingForLevel(plan, level, atLevel, actor)) {
      lores[lore] = Math.max(lores[lore] ?? 0, PROFICIENCY_RANKS.TRAINED);
    }

    for (const skill of levelData.intBonusSkills ?? []) {
      const loreSlug = String(skill ?? '')
        .trim()
        .toLowerCase();
      if (!loreSlug || isActiveSkillSlug(loreSlug)) continue;
      lores[loreSlug] = Math.max(lores[loreSlug] ?? 0, 1);
    }

    for (const feat of getEffectivePlannedFeatsForLevel(plan, level, atLevel)) {
      for (const rule of getFeatLoreRules(feat)) {
        const skill = String(rule?.skill ?? '')
          .trim()
          .toLowerCase();
        if (!skill || isActiveSkillSlug(skill)) continue;
        const rank = Number(resolveConditionalLoreRuleValue(rule, skills));
        if (!Number.isFinite(rank) || rank <= 0) continue;
        lores[skill] = Math.max(lores[skill] ?? 0, rank);
      }
    }

    for (const inc of getEffectiveLevelSkillIncreases(plan, level, atLevel)) {
      const skill = String(inc?.skill ?? '')
        .trim()
        .toLowerCase();
      if (!skill || isActiveSkillSlug(skill)) continue;
      const rank = Number(inc?.toRank ?? 0);
      if (!Number.isFinite(rank) || rank <= 0) continue;
      lores[skill] = Math.max(lores[skill] ?? 0, rank);
    }
  }

  return lores;
}

function resolveConditionalLoreRuleValue(rule, skills) {
  const condition = rule?.valueIfSkillRank;
  const skill = String(condition?.skill ?? '')
    .trim()
    .toLowerCase();
  const rank = Number(condition?.rank);
  if (!skill || !Number.isFinite(rank)) return rule?.value ?? 0;

  return Number(skills?.[skill] ?? 0) >= rank ? condition.value : (rule?.value ?? 0);
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

      const skill = normalizeSkillSlug(match[1]);
      if (!isActiveSkillSlug(skill)) continue;

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
      const skill = normalizeSkillSlug(rule.skill);
      if (!isActiveSkillSlug(skill)) continue;
      const currentRank = skills[skill] ?? PROFICIENCY_RANKS.UNTRAINED;
      const valueSource = currentRank >= PROFICIENCY_RANKS.TRAINED && rule.valueIfAlreadyTrained != null ? rule.valueIfAlreadyTrained : rule.value;
      const value = evaluateRuleNumericValue(valueSource, atLevel, feat);
      if (!Number.isFinite(value)) continue;
      skills[skill] = Math.max(currentRank, value);
    }

    for (const [flag, rawSelected] of Object.entries(feat?.choices ?? {})) {
      if (!/^levelerSkillFallback\d+$/i.test(flag)) continue;
      const selected = normalizeSkillSlug(rawSelected);
      if (!isActiveSkillSlug(selected)) continue;
      skills[selected] = Math.max(skills[selected] ?? PROFICIENCY_RANKS.UNTRAINED, PROFICIENCY_RANKS.TRAINED);
    }
  }

  return skills;
}

function getPlannedFeatSkillRules(feat) {
  return getFeatSkillRules(feat);
}

function computeProficiencies(actor, classDefs, atLevel) {
  const trackedClassDefs = Array.isArray(classDefs) ? classDefs.filter(Boolean) : [classDefs].filter(Boolean);
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
  applyExplicitFeatureProficiencies(proficiencies, feature?.proficiencies);

  const key = String(feature.key ?? '');
  const name = String(feature.name ?? '').toLowerCase();

  if (key.includes('perception-legend') || name.includes('perception legend')) {
    proficiencies.perception = Math.max(proficiencies.perception, PROFICIENCY_RANKS.LEGENDARY);
  } else if (key.includes('perception-mastery') || key.includes('battlefield-surveyor') || name.includes('perception mastery') || name.includes('battlefield surveyor')) {
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
  } else if (key.includes('reflex-expertise') || key.includes('reflex-expert') || name.includes('reflex expertise') || name.includes('reflex expert') || key.includes('lightning-reflexes') || key.includes('evasive-reflexes') || key.includes('natural-reflexes') || key.includes('shared-reflexes') || key.includes('premonitions-reflexes')) {
    proficiencies.reflex = Math.max(proficiencies.reflex, PROFICIENCY_RANKS.EXPERT);
  }

  if (key.includes('will-legend') || name.includes('will legend')) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.LEGENDARY);
  } else if (key.includes('greater-dogged-will') || key.includes('prodigious-will') || key.includes('will-of-the-pupil') || key.includes('majestic-will') || key.includes('walls-of-will') || key.includes('divine-will') || key.includes('indomitable-will') || key.includes('wild-willpower') || name.includes('will mastery')) {
    proficiencies.will = Math.max(proficiencies.will, PROFICIENCY_RANKS.MASTER);
  } else if (key.includes('will-expertise') || key.includes('will-expert') || key.includes('dogged-will') || key.includes('commanding-will') || name.includes('will expertise') || name.includes('will expert')) {
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
  for (const action of getOwnedActionItems(actor)) {
    for (const alias of getFeatAliases(action)) feats.add(alias);
  }

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) {
    for (const alias of getFeatAliases(feat)) feats.add(alias);
  }
  for (const background of getEffectivePlannedGrantedBackgroundItems(plan, atLevel)) {
    for (const feat of getBackgroundGrantedFeatureEntries(background)) {
      for (const alias of getFeatAliases(feat)) feats.add(alias);
    }
  }

  if (actor?.system?.resources?.focus?.max > 0) feats.add('focus-pool');

  return feats;
}

function getBackgroundGrantedFeatureEntries(background) {
  return Object.values(background?.system?.items ?? {})
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      uuid: item.uuid ?? null,
      slug: item.slug ?? null,
      name: item.name ?? null,
      type: 'feat',
    }));
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
  for (const action of getOwnedActionItems(actor)) addSources(action);

  const plannedFeats = getEffectivePlannedFeats(plan, atLevel);
  for (const feat of plannedFeats) addSources(feat);

  return sources;
}

function getOwnedActionItems(actor) {
  return getOwnedItems(actor).filter((item) => String(item?.type ?? '').trim().toLowerCase() === 'action');
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
  const trackedClassDefs = Array.isArray(classDefs) ? classDefs.filter(Boolean) : [classDefs].filter(Boolean);
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

    for (const alias of extractLinkedFeatureAliases(item?.system?.description?.value ?? item?.description ?? '')) {
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
  if (!item || !['feat', 'action', 'classfeature'].includes(String(item?.type ?? '').toLowerCase())) return false;

  const category = String(item?.system?.category?.value ?? item?.system?.category ?? '')
    .trim()
    .toLowerCase();
  if (item?.type !== 'classfeature' && !['classfeature', 'class-feature'].includes(category)) return false;

  const level = Number(item?.system?.level?.taken ?? item?.system?.level?.value ?? item?.level ?? 0);
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
  const selectedFeats = [...getEffectiveCharacterFeats(actor, plan, atLevel)];
  const timeline = buildArchetypeFeatTimeline(actor, plan, atLevel);
  const dedications = timeline.filter((entry) => isArchetypeDedication(entry.feat)).map((entry) => entry.feat);
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
        const featTraits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
        const isArchetypeFeat = featTraits.includes('archetype') || isStoredAdditionalArchetypeFeat(feat) || hasArchetypeDedicationPrerequisite(feat);
        if (!featSlug || featSlug === dedicationSlug || matched.has(featSlug) || isArchetypeDedication(feat) || !isArchetypeFeat) continue;

        const featArchetypeTraits = getArchetypeAssociationTraits(feat);
        const prereqText = getArchetypePrerequisiteText(feat);
        const matchesByTrait = featArchetypeTraits.size > 0 && [...featArchetypeTraits].some((trait) => relatedTraits.has(trait));
        const matchesByPrereq = prereqText.length > 0 && [...relatedPhrases].some((phrase) => prereqText.includes(phrase));
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
        if (!featSlug || featSlug === dedicationSlug || matched.has(featSlug) || isArchetypeDedication(feat)) continue;
        const featTraits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
        if (!featTraits.includes('archetype') && !isStoredAdditionalArchetypeFeat(feat) && !hasArchetypeDedicationPrerequisite(feat)) continue;
        matched.add(featSlug);
      }
    }

    matchedByDedication.set(dedicationSlug, matched);
  }

  const explicitlyMatched = new Set([...matchedByDedication.values()].flatMap((matched) => [...matched]));

  for (const entry of timeline) {
    const feat = entry.feat;
    const featSlug = getPrimaryFeatAlias(feat);
    if (!featSlug || explicitlyMatched.has(featSlug) || isArchetypeDedication(feat)) continue;

    const featTraits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
    if (!isArchetypeTimelineEntry(entry, featTraits)) continue;

    const candidateDedications = timeline
      .filter((candidate) => isArchetypeDedication(candidate.feat) && compareTimelineEntries(candidate, entry) < 0)
      .map((candidate) => getPrimaryFeatAlias(candidate.feat))
      .filter((slug) => slug && matchedByDedication.has(slug));

    if (candidateDedications.length === 0) continue;

    const incompleteCandidates = candidateDedications.filter((slug) => (matchedByDedication.get(slug)?.size ?? 0) < 2);
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
  const actorFeats = getEffectiveActorFeats(actor, plan, atLevel).map((feat, index) => ({
    feat,
    level: getActorFeatLevel(feat),
    order: index,
  }));

  const plannedFeats = [];
  let order = actorFeats.length;
  const featKeys = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
  for (let level = 1; level <= atLevel; level++) {
    for (const { feat, category } of getEffectivePlannedFeatEntriesForLevel(plan, level, atLevel)) {
      const key = category;
      if (!featKeys.includes(key)) continue;
      if (!isArchetypeDedication(feat) && key !== 'archetypeFeats' && !isStoredAdditionalArchetypeFeat(feat) && !getFeatTraitSlugs(feat).includes('archetype') && !hasArchetypeDedicationPrerequisite(feat)) {
        continue;
      }
      plannedFeats.push({ feat, level, order, category: key });
      order++;
    }
  }

  return [...actorFeats, ...plannedFeats].sort(compareTimelineEntries);
}

function isArchetypeTimelineEntry(entry, featTraits = getFeatTraitSlugs(entry?.feat)) {
  return entry?.category === 'archetypeFeats' || featTraits.includes('archetype') || isStoredAdditionalArchetypeFeat(entry?.feat) || hasArchetypeDedicationPrerequisite(entry?.feat);
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
  return incompleteDedications.size === 0 || hasSecondDedicationException(actor, plan, atLevel, incompleteDedications);
}

export function syncPlanArchetypeDedicationProgress(actor, plan, atLevel = MAX_LEVEL) {
  if (!plan) return plan;
  plan.archetypeDedicationProgress = computePlanArchetypeDedicationProgress(actor, plan, atLevel);
  return plan;
}

export function computePlanArchetypeDedicationProgress(actor, plan, atLevel = MAX_LEVEL) {
  const progress = computeArchetypeDedicationProgress(actor, plan, atLevel);
  const incompleteDedications = new Set([...progress.entries()].filter(([, count]) => count < 2).map(([slug]) => slug));
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
    canTakeNewDedication: incompleteDedications.size === 0 || hasSecondDedicationException(actor, plan, atLevel, incompleteDedications),
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
    const suffix = slug.startsWith(classPrefix) ? slug.slice(classPrefix.length) : slug.startsWith(barePrefix) ? slug.slice(barePrefix.length) : '';
    if (suffix) aliases.add(`${suffix}-${subclassSlug}`);

    if (matchesTagFamily(feat, subclassTag) && !slug.endsWith(`-${subclassSlug}`)) {
      aliases.add(`${slug}-${subclassSlug}`);
    }
  }

  return aliases;
}

function addFeatChoiceAlias(target, selected) {
  if (selected && typeof selected === 'object') {
    if (!isFeatLikeChoiceOption(selected)) return;

    const candidates = [
      selected.slug,
      selected.system?.slug,
      selected.value?.slug,
      selected.name,
      selected.label,
      selected.value?.name,
      selected.value?.label,
    ];
    let added = false;
    for (const candidate of candidates) {
      const normalized = slugify(String(candidate ?? ''));
      if (!normalized) continue;
      target.add(normalized);
      added = true;
    }

    if (!added) {
      const fallback = selected.uuid ?? selected.value?.uuid ?? selected.value;
      if (typeof fallback === 'string') addFeatChoiceAlias(target, fallback);
    }
    return;
  }

  if (typeof selected !== 'string' || selected.length === 0 || selected === '[object Object]') return;

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
  const selections = [];
  collectFeatChoiceSelections(selections, feat);
  return selections;
}

function collectFeatChoiceSelections(target, source, inheritedSelections = new Map(), visited = new Set()) {
  if (!source || typeof source !== 'object' || visited.has(source)) return;
  visited.add(source);

  target.push(...getStoredFeatChoiceValues(source));

  const selections = mergeFeatChoiceSelectionMaps(inheritedSelections, getFeatChoiceSelectionMap(source));
  const selectedOptions = getSelectedChoiceSetOptions(source, selections);
  target.push(...selectedOptions);

  for (const option of selectedOptions) {
    collectFeatChoiceSelections(target, option, selections, visited);
  }

  const grantedItems = getGrantedFeatLikeItems(source);
  target.push(...grantedItems);
  for (const granted of grantedItems) {
    collectFeatChoiceSelections(target, granted, selections, visited);
  }
}

function getStoredFeatChoiceValues(feat) {
  return [
    ...Object.values(feat?.choices ?? {}),
    ...Object.values(feat?.flags?.pf2e?.rulesSelections ?? {}),
    ...Object.values(feat?.flags?.system?.rulesSelections ?? {}),
  ];
}

function mergeFeatChoiceSelectionMaps(inheritedSelections, ownSelections) {
  const selections = new Map(inheritedSelections);
  for (const [flag, value] of ownSelections.entries()) {
    selections.set(flag, value);
  }
  return selections;
}

function getSelectedChoiceSetOptions(feat, selections = getFeatChoiceSelectionMap(feat)) {
  const selectedOptions = [];

  for (const choiceSet of getStoredChoiceSets(feat)) {
    const flag = String(choiceSet?.flag ?? '').trim();
    if (!flag || !selections.has(flag)) continue;

    const selectedValue = selections.get(flag);
    for (const option of choiceSet?.options ?? []) {
      if (!isFeatLikeChoiceOption(option)) continue;
      if (choiceOptionMatchesSelection(option, selectedValue)) selectedOptions.push(option);
    }
  }

  return selectedOptions;
}

function getFeatChoiceSelectionMap(feat) {
  const selections = new Map();
  for (const source of [
    feat?.choices,
    feat?.flags?.pf2e?.rulesSelections,
    feat?.flags?.system?.rulesSelections,
  ]) {
    for (const [flag, value] of Object.entries(source ?? {})) {
      if (typeof value === 'string' && value.length > 0 && value !== '[object Object]') {
        selections.set(flag, value);
      }
    }
  }
  return selections;
}

function getStoredChoiceSets(feat) {
  return [
    ...(Array.isArray(feat?.choiceSets) ? feat.choiceSets : []),
    ...(Array.isArray(feat?.grantChoiceSets) ? feat.grantChoiceSets : []),
  ].filter((entry) => entry && typeof entry === 'object');
}

function choiceOptionMatchesSelection(option, selectedValue) {
  const selected = normalizeChoiceIdentity(selectedValue);
  if (!selected) return false;

  return getChoiceOptionIdentityValues(option).some((candidate) =>
    normalizeChoiceIdentity(candidate) === selected);
}

function getChoiceOptionIdentityValues(option) {
  const rawValue = option?.value;
  const values = [
    rawValue,
    option?.uuid,
    option?.slug,
    option?.label,
    option?.name,
    rawValue?.uuid,
    rawValue?.slug,
    rawValue?.value,
    rawValue?.label,
    rawValue?.name,
  ];
  return values.filter((value) => typeof value === 'string' && value.length > 0);
}

function getGrantedFeatLikeItems(feat) {
  return (Array.isArray(feat?.grantedItems) ? feat.grantedItems : []).filter(isFeatLikeChoiceOption);
}

function isFeatLikeChoiceOption(option) {
  if (!option || typeof option !== 'object') return false;

  const rawValue = option.value;
  const uuid = String(
    option.uuid
      ?? option.sourceId
      ?? option.flags?.core?.sourceId
      ?? rawValue?.uuid
      ?? (typeof rawValue === 'string' ? rawValue : '')
      ?? '',
  ).toLowerCase();
  if (uuid.includes('.feats') || uuid.includes('.classfeatures')) return true;

  const type = String(option.type ?? option.itemType ?? rawValue?.type ?? '').toLowerCase();
  if (['feat', 'action', 'classfeature'].includes(type)) return true;

  const category = String(
    option.category
      ?? option.system?.category?.value
      ?? option.system?.category
      ?? rawValue?.category
      ?? '',
  ).toLowerCase();
  return ['class', 'skill', 'general', 'ancestry', 'archetype', 'mythic', 'bonus', 'classfeature', 'class-feature'].includes(category);
}

function normalizeChoiceIdentity(value) {
  return String(value ?? '')
    .trim()
    .replace(/^Compendium\.pf2e\.([a-z]+)Srd\.Item\./u, (_match, pack) => `Compendium.pf2e.${pack}-srd.Item.`)
    .toLowerCase();
}

function matchesTagFamily(feat, tag) {
  const normalizedTag = String(tag ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedTag) return false;

  const tags = [...(feat?.otherTags ?? []), ...(feat?.system?.traits?.otherTags ?? [])].map((value) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

  return tags.includes(normalizedTag);
}

function inferFeatSpellcastingTradition(feat) {
  const directTradition = normalizeSpellTradition(feat?.system?.tradition?.value ?? feat?.tradition ?? null);
  if (directTradition && !VARIABLE_SPELLCASTING_TRADITIONS.has(directTradition)) {
    return directTradition;
  }

  const sf2eTradition = inferSf2eSpellcastingTraditionFromItem(feat);
  if (sf2eTradition) return sf2eTradition;

  const slug = getPrimaryFeatAlias(feat);
  const subclassData = SUBCLASS_SPELLS[slug] ?? null;
  if (!subclassData?.choiceFlag || !Array.isArray(subclassData.choiceOptions)) return null;

  const choices = {
    ...(feat?.choices ?? {}),
    ...(feat?.flags?.pf2e?.rulesSelections ?? {}),
    ...(feat?.flags?.system?.rulesSelections ?? {}),
  };
  const selected = String(choices[subclassData.choiceFlag] ?? '')
    .trim()
    .toLowerCase();
  if (!selected) return null;

  const option = subclassData.choiceOptions.find((entry) => {
    const slugValue = typeof entry === 'string' ? entry : entry?.slug;
    return (
      String(slugValue ?? '')
        .trim()
        .toLowerCase() === selected
    );
  });

  return normalizeSpellTradition(option?.tradition ?? null);
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
  return [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
}

function getArchetypeAssociationTraits(feat) {
  const genericTraits = new Set(['archetype', 'dedication', 'class', 'multiclass', 'general', 'skill', 'mythic']);
  const traits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? []), ...(Array.isArray(feat?.additionalArchetype?.sourceTraits) ? feat.additionalArchetype.sourceTraits : [])].map((trait) => String(trait).toLowerCase()).filter((trait) => trait && !genericTraits.has(trait));

  if (traits.length > 0) return new Set(traits);

  const slug = String(feat?.slug ?? '').toLowerCase();
  if (slug.endsWith('-dedication')) return new Set([slug.replace(/-dedication$/u, '')]);

  return new Set();
}

function isStoredAdditionalArchetypeFeat(feat) {
  return Array.isArray(feat?.additionalArchetype?.sourceTraits) && feat.additionalArchetype.sourceTraits.length > 0;
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
    if (slug.endsWith('-dedication')) phrases.add(slug.replace(/-dedication$/u, '').replace(/-/g, ' '));
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
  const traits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
  const isClassLikeArchetype = traits.includes('class') || traits.includes('multiclass');
  return isArchetypeDedication(feat) && isClassLikeArchetype;
}

function getClassArchetypeTrait(feat) {
  const genericTraits = new Set(['archetype', 'dedication', 'class', 'multiclass', 'general', 'skill', 'mythic']);
  const traits = [...(Array.isArray(feat?.traits) ? feat.traits : []), ...(feat?.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase()).filter((trait) => trait && !genericTraits.has(trait));

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

function getActorClassItem(actor, classDef = null) {
  if (actor?.class) return actor.class;

  const expectedSlug = String(classDef?.slug ?? '').trim().toLowerCase();
  const classItems = getOwnedItems(actor).filter((item) => String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() === 'class');
  if (!expectedSlug) return classItems[0] ?? null;

  return classItems.find((item) => String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase() === expectedSlug) ?? classItems[0] ?? null;
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
  if (normalized.endsWith('-heritage')) {
    const baseAlias = normalized.replace(/-heritage$/u, '');
    if (baseAlias) target.add(baseAlias);
  }
}

function addAncestryItemTraits(target, item) {
  const traits = Array.isArray(item?.traits) ? item.traits : item?.system?.traits?.value;
  if (!Array.isArray(traits)) return;
  for (const trait of traits) addAncestryTraitAliases(target, trait);
}

function addAncestryFeatIdentity(target, item) {
  if (!item) return;
  if (typeof item === 'string') {
    addAncestryTraitAliases(target, item);
    return;
  }

  const normalizedSlug = slugify(normalizeEquipmentValue(item?.slug) ?? '');
  addAncestryTraitAliases(target, item?.slug ?? null);
  addAncestryTraitAliases(target, item?.name ?? null);

  if (normalizedSlug) return;
  addAncestryItemTraits(target, item);
}

function addHeritageAlias(target, value) {
  const normalized = slugify(normalizeEquipmentValue(value) ?? '');
  if (!normalized) return;
  target.add(normalized);
  if (normalized.endsWith('-heritage')) {
    const baseAlias = normalized.replace(/-heritage$/u, '');
    if (baseAlias) target.add(baseAlias);
  }
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
