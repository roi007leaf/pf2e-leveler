import { ATTRIBUTES, MIN_PLAN_LEVEL, PROFICIENCY_RANK_NAMES, SKILLS } from '../../constants.js';
import { getGradualBoostGroupLevels } from '../../classes/progression.js';
import { computeBuildState, computeSkillPickerState, getAutomaticInitialLoreTraining, getAutomaticInitialSkillTrainingEntries, getImportedInitialSkillChoiceTraining, getImportedInitialSkillLimit, getImportedInitialSkillTraining, getInitialSkillSourceItems, getIntelligenceBenefitCount, isImportedHistoricalSkillLevel } from '../../plan/build-state.js';
import { getMaxSkillRank } from '../../utils/pf2e-api.js';
import { ClassRegistry } from '../../classes/registry.js';
import { annotateGuidanceBySlug, filterDisallowedForCurrentUser } from '../../access/content-guidance.js';
import { getLanguageRarityMap, getLanguageMap, getUnavailableLanguageSlugs, humanizeSkillLikeLabel, slugifyLoreSkillName } from '../character-wizard/skills-languages.js';
import { getActiveSkillConfigEntry, getActiveSkillSlugs, isActiveSkillSlug, normalizeSkillSlug } from '../../utils/skill-slugs.js';
import { getCreationData } from '../../creation/creation-store.js';

export function buildAttributeContext(planner, levelData, choices) {
  const selectedBoosts = levelData.abilityBoosts ?? [];
  const maxBoosts = choices?.find((c) => c.type === 'abilityBoosts')?.count ?? 4;
  const boostsRemaining = maxBoosts - selectedBoosts.length;
  const variantOptions = planner._getVariantOptions?.() ?? {};
  const usedBoostsInSet = getUsedBoostsInSet(planner, planner.selectedLevel, variantOptions.gradualBoosts);
  const actorLevel = Number(planner.actor?.system?.details?.level?.value ?? 1);
  const alreadyAppliedLevel = planner.selectedLevel <= actorLevel;
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const displayedRawAttributes = alreadyAppliedLevel
    ? buildAppliedLevelAttributeBaseline(planner, actorLevel, planner.selectedLevel)
    : (buildFutureLevelAttributeBaseline(planner, actorLevel, planner.selectedLevel) ?? buildState.rawAttributes ?? {});

  return ATTRIBUTES.map((key) => {
    const rawMod = displayedRawAttributes[key] ?? buildState.rawAttributes?.[key] ?? buildState.attributes[key] ?? 0;
    const mod = Math.trunc(rawMod);
    const isPartial = mod >= 4;
    const hasPendingPartial = rawMod % 1 !== 0;
    const selected = selectedBoosts.includes(key);
    const newRawMod = selected ? applyAbilityBoost(rawMod) : rawMod;
    const newMod = Math.trunc(newRawMod);
    const partialLabel = !isPartial
      ? ''
      : hasPendingPartial
        ? game.i18n.localize('PF2E_LEVELER.UI.PARTIAL_BOOST_COMPLETING')
        : game.i18n.localize('PF2E_LEVELER.UI.PARTIAL_BOOST_PENDING');
    return {
      key,
      label: key.toUpperCase(),
      mod,
      newMod,
      selected,
      applied: selected && alreadyAppliedLevel,
      partial: isPartial,
      pendingPartial: hasPendingPartial,
      completesPartial: isPartial && hasPendingPartial,
      partialLabel,
      cost: 1,
      disabled: !selected && (boostsRemaining <= 0 || usedBoostsInSet.has(key)),
    };
  });
}

function buildFutureLevelAttributeBaseline(planner, actorLevel, selectedLevel = planner.selectedLevel) {
  if (!Number.isFinite(actorLevel) || selectedLevel <= actorLevel) return null;

  const raw = buildReconstructedCurrentRawAttributes(planner, actorLevel);
  if (!raw) return null;

  for (let level = actorLevel + 1; level < selectedLevel; level++) {
    for (const boost of getAppliedBoostsForLevel(planner, level)) {
      if (!ATTRIBUTES.includes(boost)) continue;
      raw[boost] = applyAbilityBoost(raw[boost] ?? 0);
    }
  }

  return raw;
}

function buildReconstructedCurrentRawAttributes(planner, actorLevel) {
  const raw = buildKnownInitialAttributeBaseline(planner);
  if (!raw) return null;

  for (let level = MIN_PLAN_LEVEL; level <= actorLevel; level++) {
    for (const boost of getAppliedBoostsForLevel(planner, level)) {
      if (!ATTRIBUTES.includes(boost)) continue;
      raw[boost] = applyAbilityBoost(raw[boost] ?? 0);
    }
  }

  for (const attr of ATTRIBUTES) {
    const actorMod = getActorAbilityModifier(planner.actor, attr);
    if (!Number.isFinite(actorMod)) continue;
    if (Math.trunc(raw[attr] ?? 0) !== Math.trunc(actorMod)) {
      raw[attr] = actorMod;
    }
  }

  return raw;
}

function buildAppliedLevelAttributeBaseline(planner, actorLevel, selectedLevel = planner.selectedLevel) {
  const raw = buildReconstructedCurrentRawAttributes(planner, actorLevel)
    ?? Object.fromEntries(ATTRIBUTES.map((key) => [key, getActorAbilityModifier(planner.actor, key)]));
  const knownBeforeLevelCache = new Map();

  for (let level = actorLevel; level >= selectedLevel; level--) {
    const knownBeforeLevel = getKnownAttributeBaselineBeforeLevel(planner, level, knownBeforeLevelCache);
    for (const boost of getAppliedBoostsForLevel(planner, level)) {
      if (!ATTRIBUTES.includes(boost)) continue;
      raw[boost] = reverseApplyAbilityBoost(raw[boost] ?? 0, knownBeforeLevel?.[boost]);
    }
  }

  return raw;
}

function getKnownAttributeBaselineBeforeLevel(planner, level, cache) {
  if (cache.has(level)) return cache.get(level);

  const raw = buildKnownInitialAttributeBaseline(planner);
  if (!raw) {
    cache.set(level, null);
    return null;
  }

  for (let pastLevel = MIN_PLAN_LEVEL; pastLevel < level; pastLevel++) {
    for (const boost of getAppliedBoostsForLevel(planner, pastLevel)) {
      if (!ATTRIBUTES.includes(boost)) continue;
      raw[boost] = applyAbilityBoost(raw[boost] ?? 0);
    }
  }

  cache.set(level, raw);
  return raw;
}

function buildKnownInitialAttributeBaseline(planner) {
  const actor = planner.actor;
  const creationData = getCreationData(actor) ?? {};
  const actorBuildBoosts = actor?.system?.build?.attributes?.boosts ?? {};
  const raw = Object.fromEntries(ATTRIBUTES.map((key) => [key, 0]));
  let hasEvidence = false;

  const applyBoosts = (boosts, delta = 1) => {
    for (const boost of boosts) {
      if (!ATTRIBUTES.includes(boost)) continue;
      raw[boost] += delta;
      hasEvidence = true;
    }
  };

  const ancestryChoiceBoosts = normalizeAbilityBoostList(creationData.boosts?.ancestry);
  const actorAncestryBoosts = normalizeStoredBoostBucket(actorBuildBoosts.ancestry);
  if (creationData.alternateAncestryBoosts === true) {
    applyBoosts(ancestryChoiceBoosts.length ? ancestryChoiceBoosts : actorAncestryBoosts.length ? actorAncestryBoosts : getSelectedBoostValues(actor?.ancestry?.system?.boosts));
  } else {
    if (actorAncestryBoosts.length) {
      applyBoosts(actorAncestryBoosts);
    } else {
      applyBoosts(getFixedBoostValues(actor?.ancestry?.system?.boosts));
      applyBoosts(ancestryChoiceBoosts.length ? ancestryChoiceBoosts : getSelectedBoostValues(actor?.ancestry?.system?.boosts));
    }
    applyBoosts(getFixedBoostValues(actor?.ancestry?.system?.flaws), -1);
  }

  const backgroundChoiceBoosts = normalizeAbilityBoostList(creationData.boosts?.background);
  const actorBackgroundBoosts = normalizeStoredBoostBucket(actorBuildBoosts.background);
  if (actorBackgroundBoosts.length) {
    applyBoosts(actorBackgroundBoosts);
  } else {
    applyBoosts(getFixedBoostValues(actor?.background?.system?.boosts));
    applyBoosts(backgroundChoiceBoosts.length ? backgroundChoiceBoosts : getSelectedBoostValues(actor?.background?.system?.boosts));
  }

  const classBoosts = getInitialClassBoosts(planner, creationData);
  applyBoosts(classBoosts);

  const creationFreeBoosts = normalizeAbilityBoostList(creationData.boosts?.free);
  const actorFreeBoosts = normalizeActorBoostEntries(actor?.system?.build?.attributes?.boosts?.[1]);
  applyBoosts(creationFreeBoosts.length ? creationFreeBoosts : actorFreeBoosts);

  return hasEvidence ? raw : null;
}

function getInitialClassBoosts(planner, creationData) {
  const creationClassBoosts = normalizeAbilityBoostList(creationData.boosts?.class);
  if (creationClassBoosts.length > 0) return creationClassBoosts;

  const actorClassBoosts = normalizeStoredBoostBucket(planner.actor?.system?.build?.attributes?.boosts?.class);
  if (actorClassBoosts.length > 0) return actorClassBoosts;

  const keyAbility = planner.actor?.class?.system?.keyAbility ?? {};
  const selected = normalizeAbilityBoostKey(keyAbility.selected);
  if (ATTRIBUTES.includes(selected)) return [selected];

  const systemValues = normalizeAbilityBoostList(keyAbility.value);
  if (systemValues.length === 1) return systemValues;

  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  const classValues = normalizeAbilityBoostList(classDef?.keyAbility);
  return classValues.length === 1 ? classValues : [];
}

function getFixedBoostValues(boostObj) {
  if (!boostObj || typeof boostObj !== 'object') return [];

  const boosts = [];
  for (const entry of Object.values(boostObj)) {
    const values = normalizeAbilityBoostList(entry?.value);
    if (values.length === 1) boosts.push(values[0]);
  }
  return boosts;
}

function getSelectedBoostValues(boostObj) {
  if (!boostObj || typeof boostObj !== 'object') return [];

  const boosts = [];
  for (const entry of Object.values(boostObj)) {
    boosts.push(...normalizeAbilityBoostList(entry?.selected));
  }
  return boosts;
}

function getAppliedBoostsForLevel(planner, level) {
  const gradualActorBoost = getGradualActorBoostForLevel(planner, level);
  if (gradualActorBoost) return [gradualActorBoost];

  const actorBoosts = planner.actor?.system?.build?.attributes?.boosts?.[level];
  const normalizedActorBoosts = normalizeActorBoostEntries(actorBoosts);
  if (normalizedActorBoosts.length > 0) return normalizedActorBoosts;
  return (planner.plan?.levels?.[level]?.abilityBoosts ?? []).map((entry) => normalizeAbilityBoostKey(entry)).filter(Boolean);
}

function getGradualActorBoostForLevel(planner, level) {
  if (planner._getVariantOptions?.().gradualBoosts !== true) return null;
  const groupLevels = getGradualBoostGroupLevels(level);
  const index = groupLevels.indexOf(level);
  if (index < 0) return null;

  const bucketLevel = groupLevels.at(-1);
  const bucketBoosts = normalizeActorBoostEntries(planner.actor?.system?.build?.attributes?.boosts?.[bucketLevel]);
  return bucketBoosts[index] ?? null;
}

function reverseApplyAbilityBoost(rawModifier, knownBeforeBoost = null) {
  const value = Number(rawModifier ?? 0);
  if (!Number.isFinite(value)) return 0;
  if (value === 4 && Number(knownBeforeBoost) >= 4) return 4;
  return value > 4 ? value - 0.5 : value - 1;
}

function applyAbilityBoost(rawModifier) {
  const value = Number(rawModifier ?? 0);
  if (!Number.isFinite(value)) return 0;
  return value >= 4 ? value + 0.5 : value + 1;
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

function normalizeActorBoostEntries(value) {
  if (typeof value === 'string') {
    return [normalizeAbilityBoostKey(value)].filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeAbilityBoostKey(entry)).filter(Boolean);
  }
  if (!value || typeof value !== 'object') return [];

  const flattened = [];
  const directKeys = Object.entries(value)
    .filter(([key, entry]) => normalizeAbilityBoostKey(key) && (
      entry === true
      || entry === 1
      || entry === 'true'
      || entry === 'selected'
    ))
    .map(([key]) => key);
  flattened.push(...directKeys);

  for (const entry of Object.values(value)) {
    if (typeof entry === 'string') {
      flattened.push(entry);
      continue;
    }
    if (Array.isArray(entry)) {
      flattened.push(...entry);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.selected === 'string') {
      flattened.push(entry.selected);
      continue;
    }
    if (Array.isArray(entry.selected)) {
      flattened.push(...entry.selected);
      continue;
    }
    if (typeof entry.value === 'string') flattened.push(entry.value);
    if (Array.isArray(entry.value)) flattened.push(...entry.value);
    if (entry && typeof entry === 'object') {
      for (const [key, nested] of Object.entries(entry)) {
        if (!normalizeAbilityBoostKey(key)) continue;
        if (nested === true || nested === 1 || nested === 'true' || nested === 'selected') {
          flattened.push(key);
        }
      }
    }
  }

  return flattened.map((entry) => normalizeAbilityBoostKey(entry)).filter(Boolean);
}

function normalizeStoredBoostBucket(value) {
  return normalizeActorBoostEntries(value).filter((entry) => ATTRIBUTES.includes(entry));
}

function normalizeAbilityBoostList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeAbilityBoostKey(entry)).filter((entry) => ATTRIBUTES.includes(entry));
  }

  const normalized = normalizeAbilityBoostKey(value);
  return ATTRIBUTES.includes(normalized) ? [normalized] : [];
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

function getUsedBoostsInSet(planner, level, gradualBoosts) {
  if (!gradualBoosts) return new Set();
  const used = new Set();
  for (const groupLevel of getGradualBoostGroupLevels(level)) {
    if (groupLevel === level) continue;
    const boosts = planner.plan?.levels?.[groupLevel]?.abilityBoosts ?? [];
    for (const boost of boosts) used.add(boost);
  }
  return used;
}

export function buildIntelligenceBenefitContext(planner, level) {
  const gained = getIntelligenceBenefitCount(planner.actor, planner.plan, level);

  if (gained <= 0) return null;

  return {
    count: gained,
    gainsSingle: gained === 1,
  };
}

export function buildIntBonusSkillContext(planner, levelData, level) {
  const benefit = buildIntelligenceBenefitContext(planner, level);
  if (!benefit) return null;

  const selected = new Set(levelData.intBonusSkills ?? []);
  const useHistoricalSkillState = isImportedHistoricalSkillLevel(planner.plan, level);
  const buildState = useHistoricalSkillState
    ? {
        skills: buildHistoricalActiveSkillRanks(planner, level - 1),
        lores: buildHistoricalLoreRanks(planner, level - 1),
      }
    : computeBuildState(planner.actor, planner.plan, level - 1);
  const activeSkillSlugs = getActiveSkillSlugs();
  const activeSkillSet = new Set(activeSkillSlugs);

  const entries = activeSkillSlugs.map((slug) => {
    const trained = (buildState.skills[slug] ?? 0) >= 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: selected.has(slug),
      disabled: trained && !selected.has(slug),
      trained,
    };
  }).filter((entry) => !entry.disabled || entry.selected);

  const loreRanks = buildState.lores ?? {};
  const selectedLoreSlugs = (levelData.intBonusSkills ?? []).filter((slug) => !activeSkillSet.has(slug));
  const loreSlugs = new Set([...Object.keys(loreRanks), ...selectedLoreSlugs]);
  const loreEntries = [...loreSlugs].map((slug) => ({
    slug,
    label: humanizeSkillLikeLabel(slug),
    selected: selected.has(slug),
    disabled: !selected.has(slug) && (loreRanks[slug] ?? 0) >= 1,
    trained: (loreRanks[slug] ?? 0) >= 1,
    isLore: true,
  })).filter((entry) => !entry.disabled || entry.selected);

  return filterDisallowedForCurrentUser(annotateGuidanceBySlug([...entries, ...loreEntries], 'skill')).map((entry) => ({
    ...entry,
    disabled: entry.disabled || entry.guidanceSelectionBlocked === true,
  }));
}

export function buildIntBonusLanguageContext(planner, levelData, level) {
  const benefit = buildIntelligenceBenefitContext(planner, level);
  if (!benefit) return null;

  const selected = new Set(levelData.intBonusLanguages ?? []);
  const current = new Set(planner.actor.system?.details?.languages?.value ?? []);
  const priorPlanned = getPlannedLanguagesBeforeLevel(planner, level);
  for (const slug of priorPlanned) current.add(slug);
  const ancestrySuggested = new Set(
    planner.actor.ancestry?.system?.additionalLanguages?.value
    ?? planner.actor.system?.details?.ancestry?.additionalLanguages?.value
    ?? [],
  );

  const allLanguages = getAvailableLanguages();
  const entries = allLanguages.map((entry) => ({
    ...entry,
    selected: selected.has(entry.slug),
    disabled: current.has(entry.slug) && !selected.has(entry.slug),
    suggested: ancestrySuggested.has(entry.slug),
  })).filter((entry) => !entry.disabled || entry.selected);

  return filterDisallowedForCurrentUser(annotateGuidanceBySlug(entries, 'language')).map((entry) => ({
    ...entry,
    disabled: entry.disabled || entry.guidanceSelectionBlocked === true,
  }));
}

export function getPlannedLanguagesBeforeLevel(planner, level) {
  const languages = new Set();
  for (let current = 2; current < level; current++) {
    const entries = planner.plan.levels[current]?.intBonusLanguages ?? [];
    for (const slug of entries) languages.add(slug);
  }
  return languages;
}

export function getAvailableLanguages() {
  const langMap = getLanguageMap();
  const rarityMap = getLanguageRarityMap();
  const unavailable = getUnavailableLanguageSlugs();

  return Object.entries(langMap)
    .filter(([slug]) => !unavailable.has(slug))
    .map(([slug, label]) => ({
      slug,
      label,
      rarity: rarityMap[slug] ?? 'common',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function localizeLanguageLabel(label) {
  if (typeof label !== 'string' || label.length === 0) return '';
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
}

export function buildSkillContext(planner, levelData, level) {
  const maxRank = getMaxSkillRank(level);
  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  const useHistoricalSkillState = isImportedHistoricalSkillLevel(planner.plan, level);
  const historicalInitialSkills = getHistoricalInitialSkillTraining(planner);
  const skillPickerOptions = {
    includePlannedFeatRules: true,
    includeCurrentLevelSkillIncrease: false,
    ...(useHistoricalSkillState
      ? { includeActorSkillRanks: false, initialSkillTraining: historicalInitialSkills }
      : {}),
  };
  const baseSkillPickerOptions = {
    includePlannedFeatRules: false,
    includeCurrentLevelSkillIncrease: false,
    ...(useHistoricalSkillState
      ? { includeActorSkillRanks: false, initialSkillTraining: historicalInitialSkills }
      : {}),
  };
  const stateBeforeLevel = useHistoricalSkillState
    ? { lores: buildHistoricalLoreRanks(planner, level - 1) }
    : computeBuildState(planner.actor, planner.plan, level - 1);
  const loreStateForPicker = useHistoricalSkillState
    ? { lores: buildHistoricalLoreRanks(planner, level) }
    : computeBuildState(planner.actor, planner.plan, level);
  const currentSkills = computeSkillPickerState(planner.actor, planner.plan, level, classDef, skillPickerOptions);
  const baseSkills = computeSkillPickerState(planner.actor, planner.plan, level, classDef, baseSkillPickerOptions);
  const currentIncrease = levelData.skillIncreases?.[0];

  const skills = Object.entries(currentSkills).map(([slug, rawRank]) => {
    const rank = getRankBeforeCurrentSkillIncrease(slug, rawRank, currentIncrease);
    const nextRank = rank + 1;
    const maxed = nextRank > maxRank;
    const plannedFeatSourceName = findSkillGrantingFeatName(planner.plan, slug, level);
    const featGranted = rank > (baseSkills[slug] ?? 0) || (maxed && !!plannedFeatSourceName);
    const featSourceName = featGranted ? plannedFeatSourceName : null;
    const lockedByFeat = featGranted && nextRank > maxRank;
    return {
      slug,
      label: localizeSkillSlug(slug),
      rank,
      rankName: PROFICIENCY_RANK_NAMES[rank],
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      maxed,
      featGranted,
      featSourceName,
      disabled: !featGranted && nextRank > maxRank,
      lockedByFeat,
      selected: currentIncrease?.skill === slug,
    };
  });

  const selectedLoreSlug = currentIncrease?.skill && !isActiveSkillSlug(currentIncrease.skill)
    ? String(currentIncrease.skill).toLowerCase()
    : null;
  const loreRanks = { ...(loreStateForPicker.lores ?? stateBeforeLevel.lores ?? {}) };
  const loreSlugs = new Set(Object.keys(loreRanks));
  if (selectedLoreSlug) loreSlugs.add(selectedLoreSlug);
  if (selectedLoreSlug) {
    loreRanks[selectedLoreSlug] = Math.max(
      loreRanks[selectedLoreSlug] ?? 0,
      Number(currentIncrease?.toRank ?? ((loreRanks[selectedLoreSlug] ?? 0) + 1)),
    );
  }

  const lores = [...loreSlugs].map((slug) => {
    const rank = getRankBeforeCurrentSkillIncrease(slug, loreRanks[slug] ?? 0, currentIncrease);
    const nextRank = rank + 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      rank,
      rankName: PROFICIENCY_RANK_NAMES[rank],
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      maxed: nextRank > maxRank,
      featGranted: false,
      featSourceName: null,
      disabled: nextRank > maxRank,
      lockedByFeat: false,
      selected: currentIncrease?.skill === slug,
    };
  });

  return filterDisallowedForCurrentUser(annotateGuidanceBySlug(
    [...skills, ...lores].filter((s) => !s.maxed || s.selected || s.featGranted),
    'skill',
  )).map((entry) => ({
    ...entry,
    disabled: entry.disabled || entry.guidanceSelectionBlocked === true,
  }));
}

export function shouldShowImportedInitialSkillButton(planner, level) {
  return Number(level) === MIN_PLAN_LEVEL && isImportedHistoricalSkillLevel(planner.plan, level);
}

export function buildImportedInitialSkillContext(planner) {
  const automatic = getAutomaticInitialSkillMap(planner);
  const selected = new Set(getManualHistoricalInitialSkillTraining(planner).filter((skill) => !automatic.has(skill)));
  const limit = getImportedInitialSkillLimit(planner.actor, ClassRegistry.get(planner.plan?.classSlug));
  const count = selected.size;
  const limitReached = limit > 0 && count >= limit;
  return getActiveSkillSlugs().map((slug) => {
    const automaticEntry = automatic.get(slug);
    const isAutomatic = !!automaticEntry;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: isAutomatic || selected.has(slug),
      disabled: isAutomatic || (!selected.has(slug) && limitReached),
      automatic: isAutomatic,
      sourceLabel: automaticEntry?.sourceLabel ?? null,
      rankName: PROFICIENCY_RANK_NAMES[1],
    };
  });
}

export function buildImportedInitialSkillSummary(planner) {
  const limit = getImportedInitialSkillLimit(planner.actor, ClassRegistry.get(planner.plan?.classSlug));
  const automatic = getAutomaticInitialSkillSet(planner);
  const count = getManualHistoricalInitialSkillTraining(planner).filter((skill) => !automatic.has(skill)).length;
  return {
    importedInitialSkillCount: count,
    importedInitialSkillLimit: limit,
    importedInitialSkillLimitReached: limit > 0 && count >= limit,
  };
}

function getHistoricalInitialSkillTraining(planner) {
  const skills = new Set(getManualHistoricalInitialSkillTraining(planner));
  for (const skill of getImportedInitialSkillChoiceTraining(planner.plan)) {
    if (isActiveSkillSlug(skill)) skills.add(skill);
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

function getManualHistoricalInitialSkillTraining(planner) {
  const skills = new Set(getImportedInitialSkillTraining(planner.plan));
  const creationData = getCreationData(planner.actor);
  for (const rawSkill of creationData?.skills ?? []) {
    const skill = normalizeSkillSlug(rawSkill);
    if (isActiveSkillSlug(skill)) skills.add(skill);
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

function buildHistoricalActiveSkillRanks(planner, upToLevel) {
  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  return computeSkillPickerState(planner.actor, planner.plan, upToLevel, classDef, {
    includeActorSkillRanks: false,
    includePlannedFeatRules: true,
    includeCurrentLevelSkillIncrease: true,
    initialSkillTraining: getHistoricalInitialSkillTraining(planner),
  });
}

function getAutomaticInitialSkillSet(planner) {
  return new Set(getAutomaticInitialSkillMap(planner).keys());
}

function getAutomaticInitialSkillMap(planner) {
  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  return new Map(
    getAutomaticInitialSkillTrainingEntries(planner.actor, planner.plan, classDef)
      .map((entry) => [entry.skill, entry]),
  );
}

export async function buildInitialSkillChoiceSetsAndFallbacks(planner) {
  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  const sourceItems = getInitialSkillSourceItems(planner.actor, planner.plan, classDef);
  const automaticSkills = getAutomaticInitialSkillSet(planner);
  const storedChoices = planner.plan?.importedFromActor?.initialSkillChoices ?? {};

  const choiceSets = [];
  const fallbacks = [];
  const activeSkillSlugs = getActiveSkillSlugs();

  // Track skills encountered from previous items to detect duplicates between background/subclass
  const encounteredSkills = getFixedInitialSkillSet(planner, classDef);
  let fallbackIndex = 0;

  for (const item of sourceItems) {
    const itemRules = item?.system?.rules ?? [];
    const sourceName = item?.name ?? 'Background';
    const itemUuid = item?.uuid ?? null;

    const itemChoiceSets = await extractInitialSkillChoiceSets(item, itemRules, storedChoices, activeSkillSlugs, sourceName);
    choiceSets.push(...itemChoiceSets);

    // Check for fallbacks from explicit fallback text in item description
    const itemFallbacks = await extractInitialSkillFallbacks(item, itemRules, storedChoices, automaticSkills, activeSkillSlugs, sourceName, fallbackIndex);
    const itemFallbackSkills = new Set(
      itemFallbacks
        .map((fallback) => normalizeSkillSlug(fallback.originalSkill))
        .filter((skill) => isActiveSkillSlug(skill)),
    );
    fallbacks.push(...itemFallbacks);
    fallbackIndex += itemFallbacks.length;

    // Check for duplicate skills granted by this item that were already encountered from previous items
    const grantedSkills = extractInitialSkillGrantsFromItem(item, itemRules);
    for (const skill of grantedSkills) {
      // If this skill was already granted by a previous item (not this one), create a fallback
      if (encounteredSkills.has(skill) && !itemFallbackSkills.has(skill) && !hasInitialSkillFallbackForItemSkill(fallbacks, itemUuid, sourceName, skill)) {
        const flag = `duplicateSkillFallback_${itemUuid}_${skill}`;
        const selectedValue = storedChoices?.[flag] ?? null;
        const availableSkills = activeSkillSlugs.filter((slug) =>
          !encounteredSkills.has(slug) && slug !== skill);

        if (availableSkills.length > 0) {
          fallbacks.push({
            flag,
            prompt: `Select a replacement skill (${localizeSkillSlug(skill)} already granted)`,
            sourceName,
            sourceUuid: itemUuid,
            originalSkill: skill,
            options: availableSkills.map((slug) => ({
              value: slug,
              label: localizeSkillSlug(slug),
              selected: selectedValue === slug,
            })),
            selectedValue,
            grantsSkillTraining: true,
            isFallback: true,
            isDuplicate: true,
          });
        }
      }
      // Add to encountered set for subsequent items
      encounteredSkills.add(skill);
    }
  }

  return { choiceSets, fallbacks };
}

function hasInitialSkillFallbackForItemSkill(fallbacks, sourceUuid, sourceName, skill) {
  return fallbacks.some((fallback) => {
    const sameSkill = normalizeSkillSlug(fallback.originalSkill) === skill;
    if (!sameSkill) return false;
    if (sourceUuid) return fallback.sourceUuid === sourceUuid;
    return !fallback.sourceUuid && fallback.sourceName === sourceName;
  });
}

function getFixedInitialSkillSet(planner, classDef = null) {
  const skills = new Set();
  addInitialSkillGrantsToSet(skills, planner.actor?.class?.system?.trainedSkills?.value);
  for (const entry of Array.isArray(classDef) ? classDef.filter(Boolean) : [classDef].filter(Boolean)) {
    addInitialSkillGrantsToSet(skills, entry?.trainedSkills?.fixed);
  }
  return skills;
}

function addInitialSkillGrantsToSet(target, rawSkills) {
  for (const rawSkill of Array.isArray(rawSkills) ? rawSkills : []) {
    const skill = normalizeSkillSlug(rawSkill);
    if (isActiveSkillSlug(skill)) target.add(skill);
  }
}

async function extractInitialSkillChoiceSets(item, rules, storedChoices, activeSkillSlugs, sourceName) {
  const choiceSets = [];
  const itemUuid = item?.uuid ?? null;

  for (const rule of rules) {
    if (rule?.key !== 'ChoiceSet') continue;
    if (isNativeBackgroundSkillChoiceRule(item, rule)) continue;

    const options = await resolveChoiceSetSkillOptions(rule, activeSkillSlugs);
    if (options.length === 0) continue;

    // Use rule flag if available, otherwise generate unique flag using item UUID
    const flag = rule?.flag ?? rule?.rollOption ?? `skillChoice_${itemUuid}_${choiceSets.length}`;
    const selectedValue = storedChoices?.[flag] ?? null;

    choiceSets.push({
      flag,
      prompt: rule?.prompt ?? 'Select a skill',
      sourceName,
      sourceUuid: itemUuid,
      options: options.map((slug) => ({
        value: slug,
        label: localizeSkillSlug(slug),
        selected: selectedValue === slug,
      })),
      selectedValue,
      grantsSkillTraining: true,
    });
  }

  return choiceSets;
}

function isNativeBackgroundSkillChoiceRule(item, rule) {
  return String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() === 'background'
    && String(rule?.prompt ?? '') === 'PF2E.SpecificRule.Prompt.Skill'
    && hasStoredBackgroundSkillChoice(item, rule);
}

function hasStoredBackgroundSkillChoice(item, rule) {
  const flag = rule?.flag ?? rule?.rollOption;
  if (!flag) return false;
  const rawSkill = item?.flags?.pf2e?.rulesSelections?.[flag]
    ?? item?.flags?.system?.rulesSelections?.[flag];
  return isActiveSkillSlug(normalizeSkillSlug(rawSkill));
}

async function resolveChoiceSetSkillOptions(rule, activeSkillSlugs) {
  const choices = rule?.choices;
  if (!choices) return [];

  if (choices?.config === 'skills') {
    return activeSkillSlugs;
  }

  if (Array.isArray(choices)) {
    const skillOptions = [];
    for (const choice of choices) {
      const slug = normalizeSkillSlug(choice?.value ?? choice?.slug ?? choice?.label ?? choice);
      if (SKILLS.includes(slug) || activeSkillSlugs.includes(slug)) {
        skillOptions.push(slug);
      }
    }
    if (skillOptions.length === choices.length && skillOptions.length > 0) {
      return skillOptions;
    }
  }

  return [];
}

async function extractInitialSkillFallbacks(item, rules, storedChoices, automaticSkills, activeSkillSlugs, sourceName, _startIndex = 0) {
  const description = String(item?.system?.description?.value ?? '');
  if (!description) return [];

  const cleanDescription = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!hasSkillFallbackText(cleanDescription)) return [];

  const grantedSkills = extractGrantedSkillsFromRules(rules);
  if (grantedSkills.length === 0) return [];

  const overlaps = grantedSkills.filter((skill) => automaticSkills.has(skill));
  if (overlaps.length === 0) return [];

  const fallbacks = [];
  const itemUuid = item?.uuid ?? null;

  for (let i = 0; i < overlaps.length; i++) {
    const originalSkill = overlaps[i];
    const flag = `skillFallback_${itemUuid}_${originalSkill}`;
    const selectedValue = storedChoices?.[flag] ?? null;

    const availableSkills = activeSkillSlugs.filter((slug) =>
      !automaticSkills.has(slug) && !grantedSkills.includes(slug));

    if (availableSkills.length === 0) continue;

    fallbacks.push({
      flag,
      prompt: `Select a replacement skill (${localizeSkillSlug(originalSkill)} already trained)`,
      sourceName,
      sourceUuid: itemUuid,
      originalSkill,
      options: availableSkills.map((slug) => ({
        value: slug,
        label: localizeSkillSlug(slug),
        selected: selectedValue === slug,
      })),
      selectedValue,
      grantsSkillTraining: true,
      isFallback: true,
    });
  }

  return fallbacks;
}

function hasSkillFallbackText(description) {
  if (!description) return false;
  if (description.includes('skill of your choice') && description.includes('already trained')) return true;

  return [
    /if you would automatically become trained in [^.]+?,?\s+you instead become trained in a skill of your choice\.?/,
    /if you would automatically become trained in one of those skills(?:\s*\([^)]*\))?,?\s+you instead become trained in a skill of your choice\.?/,
    /for each of (?:these|those) skills in which you were already trained,?\s+you instead become trained in a skill of your choice\.?/,
    /if you were already trained in both,?\s+you become trained in a skill of your choice\.?/,
  ].some((pattern) => pattern.test(description));
}

function extractInitialSkillGrantsFromItem(item, rules) {
  const skills = new Set();
  addInitialSkillGrantsToSet(skills, item?.system?.trainedSkills?.value);
  addInitialSkillGrantsToSet(skills, extractGrantedSkillsFromRules(rules));
  return [...skills];
}

function extractGrantedSkillsFromRules(rules) {
  const skills = [];
  for (const rule of rules ?? []) {
    if (rule?.key !== 'ActiveEffectLike') continue;
    const match = String(rule?.path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
    if (!match) continue;
    if (Number(rule?.value) < 1) continue;
    const skill = normalizeSkillSlug(match[1]);
    if (SKILLS.includes(skill) && !skills.includes(skill)) {
      skills.push(skill);
    }
  }
  return skills;
}

function buildHistoricalLoreRanks(planner, upToLevel) {
  const lores = {};
  for (const slug of getAutomaticInitialLoreTraining(planner.actor, planner.plan, ClassRegistry.get(planner.plan?.classSlug))) {
    lores[slug] = 1;
  }
  for (const slug of collectActorLoreSlugs(planner.actor)) {
    lores[slug] ??= 0;
  }

  for (let level = 1; level <= upToLevel; level++) {
    const levelData = planner.plan?.levels?.[level];
    if (!levelData) continue;

    for (const skill of levelData.intBonusSkills ?? []) {
      const slug = String(skill ?? '').trim().toLowerCase();
      if (!slug || isActiveSkillSlug(slug)) continue;
      lores[slug] = Math.max(lores[slug] ?? 0, 1);
    }

    for (const inc of [...(levelData.skillIncreases ?? []), ...(levelData.customSkillIncreases ?? [])]) {
      const slug = String(inc?.skill ?? '').trim().toLowerCase();
      const rank = Number(inc?.toRank ?? 0);
      if (!slug || isActiveSkillSlug(slug) || !Number.isFinite(rank)) continue;
      lores[slug] = Math.max(lores[slug] ?? 0, rank);
    }
  }

  return lores;
}

function collectActorLoreSlugs(actor) {
  return (actor?.items?.filter?.((item) => item?.type === 'lore') ?? [])
    .map((item) => slugifyLoreSkillName(item?.slug ?? item?.name ?? ''))
    .filter(Boolean);
}

function getRankBeforeCurrentSkillIncrease(slug, rank, currentIncrease) {
  const selectedSkill = normalizeSkillSlug(currentIncrease?.skill);
  if (!selectedSkill || selectedSkill !== normalizeSkillSlug(slug)) return rank;

  const targetRank = Number(currentIncrease?.toRank);
  if (!Number.isFinite(targetRank) || targetRank <= 0) return rank;

  return Math.max(0, targetRank - 1);
}

function localizeSkillSlug(slug) {
  const raw = getActiveSkillConfigEntry(slug);
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  if (game.i18n?.has?.(label)) return game.i18n.localize(label);
  return humanizeSkillLikeLabel(slug);
}

function findSkillGrantingFeatName(plan, skillSlug, atLevel) {
  const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];

  for (let level = 1; level <= atLevel; level++) {
    const levelData = plan?.levels?.[level];
    if (!levelData) continue;

    for (const key of FEAT_KEYS) {
      for (const feat of levelData[key] ?? []) {
        for (const rule of [...(feat.skillRules ?? []), ...(feat.dynamicSkillRules ?? [])]) {
          if (rule?.skill !== skillSlug) continue;
          return resolvePlannedFeatSourceName(feat);
        }
      }
    }
  }

  return null;
}

function resolvePlannedFeatSourceName(feat) {
  const explicitName = String(feat?.name ?? feat?.label ?? '').trim();
  if (explicitName) return explicitName;

  const docName = resolveNameFromUuid(feat?.uuid);
  if (docName) return docName;

  const slugName = humanizeSlug(feat?.slug);
  if (slugName) return slugName;

  return game.i18n?.localize?.('PF2E_LEVELER.UI.UNKNOWN_FEAT_SOURCE') ?? 'feat';
}

function resolveNameFromUuid(uuid) {
  if (!uuid || typeof globalThis.fromUuidSync !== 'function') return '';
  try {
    const doc = globalThis.fromUuidSync(uuid);
    return String(doc?.name ?? '').trim();
  } catch {
    return '';
  }
}

function humanizeSlug(slug) {
  const value = String(slug ?? '').trim();
  if (!value) return '';
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
