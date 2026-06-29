import { INITIAL_SKILL_RETRAIN_SOURCE_TYPE, PROFICIENCY_RANK_NAMES, PROFICIENCY_RANKS, SUBCLASS_TAGS, WEALTH_MODES, CHARACTER_WEALTH, expandPermanentItemSlots, MODULE_ID } from '../../constants.js';
import { getChoicesForLevel } from '../../classes/progression.js';
import { ClassRegistry } from '../../classes/registry.js';
import { getLevelData } from '../../plan/plan-model.js';
import {
  buildFeatGrantRequirements,
  buildPlanFormulaProgressionRequirements,
  getFeatGrantCompletion,
  getFeatGrantSelections,
} from '../../plan/feat-grants.js';
import { computeBuildState, computeSkillPickerState, getAutomaticInitialSkillTraining, getImportedInitialSkillChoiceTraining, getImportedInitialSkillTraining } from '../../plan/build-state.js';
import { isCantripExpansionFeat } from '../../plan/spellbook-feats.js';
import { loadCompendium, loadCompendiumCategory, loadDeities, loadTaggedClassFeatures } from '../character-wizard/loaders.js';
import { extractGrantedTrainedSkills, normalizePf2eCompendiumUuid, parseChoiceSets } from '../character-wizard/choice-sets.js';
import { humanizeSkillLikeLabel, normalizeLoreSkillName, slugifyLoreSkillName } from '../character-wizard/skills-languages.js';
import { annotateGuidanceBySlug, filterDisallowedForCurrentUser } from '../../access/content-guidance.js';
import { extractFeatSkillRules } from './index.js';
import { buildImportedInitialSkillSummary, getAvailableLanguages, shouldShowImportedInitialSkillButton } from './context.js';
import { buildCustomSpellEntryOptions } from './spells.js';
import { evaluatePredicate } from '../../utils/predicate.js';
import { getActiveSkillConfigEntry, getActiveSkillSlugs, isActiveSkillSlug, normalizeSkillSlug, SKILL_ALIASES } from '../../utils/skill-slugs.js';
import { getCreationData } from '../../creation/creation-store.js';

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

const ADVANCED_MULTICLASS_FEAT_CHOICE_FLAG = 'levelerAdvancedClassFeat';
const FREE_HEART_BACKGROUND_CHOICE_FLAG = 'levelerFreeHeartBackground';

export async function buildLevelContext(planner, classDef, options) {
  if (!planner.plan || !classDef) return {};

  const level = planner.selectedLevel;
  const levelData = getLevelData(planner.plan, level) ?? {};
  const choices = getChoicesForLevel(classDef, level, options);
  const choiceTypes = new Set(choices.map((choice) => choice.type));
  const classFeat = await enrichPlannerFeat(planner, extractFeat(levelData.classFeats));
  const skillFeat = await enrichPlannerFeat(planner, extractFeat(levelData.skillFeats));
  const generalFeat = await enrichPlannerFeat(planner, extractFeat(levelData.generalFeats));
  const ancestryFeat = await enrichPlannerFeat(planner, extractFeat(levelData.ancestryFeats));
  const generalFeatGrantsAncestryFeat = isAncestralParagonFeat(generalFeat);
  const generalFeatIsAdoptedAncestry = isAdoptedAncestryFeat(generalFeat);
  const adoptedAncestryOptions = generalFeatIsAdoptedAncestry
    ? await buildAdoptedAncestryOptions(planner, generalFeat)
    : [];
  const classFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, classFeat);
  const skillFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, skillFeat);
  const skillFeatWithChoiceSets = mergePlannerChoiceSetsIntoFeat(skillFeat, skillFeatChoiceSets);
  const generalFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, generalFeat);
  const generalFeatHasNativeAncestryGrantChoice = generalFeatGrantsAncestryFeat
    && hasNativeAncestryFeatChoiceSet(generalFeatChoiceSets);
  if (generalFeatHasNativeAncestryGrantChoice) {
    suppressNativeAncestryGrantPreview(generalFeat);
  }
  const ancestryFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, ancestryFeat);
  const generalFeatGrantedAncestryFeat = generalFeatGrantsAncestryFeat
    ? generalFeatHasNativeAncestryGrantChoice
      ? await buildNativeAncestralParagonGrantedFeat(planner, generalFeat, generalFeatChoiceSets, ancestryFeat, ancestryFeatChoiceSets)
      : mergePlannerChoiceSetsIntoFeat(ancestryFeat, ancestryFeatChoiceSets)
    : ancestryFeat;
  const archetypeFeat = await enrichPlannerFeat(planner, extractFeat(levelData.archetypeFeats));
  const archetypeFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, archetypeFeat);
  const customFeats = await buildCustomPlannerFeatEntries(planner, levelData.customFeats ?? []);
  stampGrantChoiceCategory(classFeat, 'classFeats');
  stampGrantChoiceCategory(skillFeatWithChoiceSets, 'skillFeats');
  stampGrantChoiceCategory(generalFeat, 'generalFeats');
  stampGrantChoiceCategory(ancestryFeat, 'ancestryFeats');
  stampGrantChoiceCategory(
    generalFeatGrantedAncestryFeat,
    generalFeatGrantedAncestryFeat?.choiceStorageCategory ?? 'ancestryFeats',
  );
  stampGrantChoiceCategory(archetypeFeat, 'archetypeFeats');
  for (const entry of customFeats) {
    stampGrantChoiceCategory(entry.feat, 'customFeats');
  }
  const customSkillIncreaseGroups = buildCustomSkillIncreaseGroups(levelData.customSkillIncreases ?? []);
  const customAvailableSkills = buildCustomAvailableSkills(planner, levelData, level);
  const customSpellEntryOptions = buildCustomSpellEntryOptions(planner, level);
  const customSpellGroups = buildCustomSpellGroups(levelData.customSpells ?? [], customSpellEntryOptions);
  const importedInitialSkillSummary = buildImportedInitialSkillSummary(planner);

  return {
    classFeatures: await buildClassFeatureEntries(planner, level, levelData),
    grantRequirements: await buildPlannerClassGrantRequirements(planner, levelData, level),
    showBoosts: choiceTypes.has('abilityBoosts'),
    boostCount: choices.find((choice) => choice.type === 'abilityBoosts')?.count ?? 4,
    selectedBoostCount: (levelData.abilityBoosts ?? []).length,
    attributes: planner._buildAttributeContext(levelData, choices),
    intelligenceBenefit: planner._buildIntelligenceBenefitContext(level),
    intBonusSkillOptions: planner._buildIntBonusSkillContext(levelData, level),
    intBonusLanguageOptions: planner._buildIntBonusLanguageContext(levelData, level),
    intBonusSkillCount: levelData.intBonusSkills?.length ?? 0,
    intBonusLanguageCount: levelData.intBonusLanguages?.length ?? 0,
    showClassFeat: choiceTypes.has('classFeat'),
    classFeat,
    classFeatChoiceSets,
    showSkillFeat: choiceTypes.has('skillFeat'),
    skillFeat: skillFeatWithChoiceSets,
    showGeneralFeat: choiceTypes.has('generalFeat'),
    generalFeat,
    generalFeatChoiceSets,
    showGeneralFeatAdoptedAncestry: generalFeatIsAdoptedAncestry,
    generalFeatAdoptedAncestryOptions: adoptedAncestryOptions,
    selectedGeneralFeatAdoptedAncestry: generalFeat?.choices?.adoptedAncestry ?? generalFeat?.adoptedAncestry ?? '',
    showAncestryFeat: choiceTypes.has('ancestryFeat') && !generalFeatGrantsAncestryFeat,
    ancestryFeat,
    ancestryFeatChoiceSets,
    showGeneralFeatGrantedAncestryFeat: generalFeatGrantsAncestryFeat
      && !!generalFeatGrantedAncestryFeat,
    generalFeatGrantedAncestryFeat,
    showImportedInitialSkillButton: shouldShowImportedInitialSkillButton(planner, level),
    ...importedInitialSkillSummary,
    showSkillIncrease: choiceTypes.has('skillIncrease'),
    availableSkills: planner._buildSkillContext(levelData, level),
    showArchetypeFeat: choiceTypes.has('archetypeFeat'),
    archetypeFeat,
    archetypeFeatChoiceSets,
    showMythicFeat: choiceTypes.has('mythicFeat'),
    mythicFeat: extractFeat(levelData.mythicFeats),
    showDualClassFeat: choiceTypes.has('dualClassFeat'),
    dualClassFeat: extractFeat(levelData.dualClassFeats),
    showCustomLevelPlan: true,
    customPlanOpen: planner._isCustomPlanOpen(level),
    customFeats,
    customSkillIncreaseGroups,
    customAvailableSkills,
    customSpellEntryOptions,
    customSpellGroups,
    customEquipment: (levelData.customEquipment ?? []).map((entry, index) => ({ ...entry, index })),
    ...buildRetrainingContext(planner, level, levelData),
    ...buildEquipmentContext(planner, level, levelData),
    ...buildABPContext(level, options),
    ...(await planner._buildSpellContext(classDef, level)),
  };
}

function buildRetrainingContext(planner, level, levelData) {
  const skillRetrainSources = buildSkillRetrainSources(planner, level);
  const retrainedFeats = (levelData.retrainedFeats ?? []).map((entry, index) => ({
    index,
    activityLevel: level,
    fromLevel: entry?.fromLevel ?? null,
    category: entry?.category ?? null,
    categoryLabel: formatFeatCategoryLabel(entry?.category),
    originalName: entry?.original?.name ?? 'Original feat',
    replacementName: entry?.replacement?.name ?? 'Choose replacement',
    originalUuid: entry?.original?.uuid ?? entry?.original?.sourceId ?? null,
    replacementUuid: entry?.replacement?.uuid ?? null,
    downtimeLabel: '1 week',
    sourceLabel: formatOriginalLevelLabel(entry?.fromLevel),
  }));

  const retrainedSkillIncreases = (levelData.retrainedSkillIncreases ?? []).map((entry, index) => ({
    index,
    activityLevel: level,
    fromLevel: entry?.fromLevel ?? null,
    originalName: localizeSkillSlug(entry?.original?.skill),
    replacementName: entry?.replacement?.skill ? localizeSkillSlug(entry.replacement.skill) : 'Choose replacement',
    rankName: titleCase(PROFICIENCY_RANK_NAMES[entry?.replacement?.toRank ?? entry?.original?.toRank] ?? String(entry?.replacement?.toRank ?? entry?.original?.toRank ?? '')),
    downtimeLabel: '1 week',
    sourceLabel: formatOriginalLevelLabel(entry?.fromLevel),
  }));

  return {
    hasRetraining: retrainedFeats.length > 0 || retrainedSkillIncreases.length > 0,
    retrainedFeats,
    retrainedSkillIncreases,
    skillRetrainSources,
    hasSkillRetrainSources: skillRetrainSources.length > 0,
  };
}

function formatOriginalLevelLabel(level) {
  const numericLevel = Number(level);
  return Number.isFinite(numericLevel) ? `Original Level ${numericLevel}` : 'Original Level Unknown';
}

export function buildSkillRetrainSources(planner, level) {
  const sources = buildInitialSkillRetrainSources(planner);
  for (let fromLevel = 1; fromLevel < level; fromLevel++) {
    const levelData = getLevelData(planner.plan, fromLevel);
    for (const increase of levelData?.skillIncreases ?? []) {
      const rankName = titleCase(PROFICIENCY_RANK_NAMES[increase?.toRank] ?? String(increase?.toRank ?? ''));
      sources.push({
        fromLevel,
        skill: increase.skill,
        toRank: increase.toRank,
        label: localizeSkillSlug(increase.skill),
        rankName,
      });
    }
  }
  return sources;
}

function buildInitialSkillRetrainSources(planner) {
  const creationData = getCreationData(planner.actor);
  const creationSkills = Array.isArray(creationData?.skills) ? creationData.skills : [];
  const importedInitialSkills = [
    ...getImportedInitialSkillTraining(planner.plan),
    ...getImportedInitialSkillChoiceTraining(planner.plan),
  ];
  const classDef = ClassRegistry.get(planner.plan?.classSlug);
  const automaticInitialSkills = getAutomaticInitialSkillTraining(planner.actor, planner.plan, classDef);
  const sources = [];
  const seen = new Set();

  for (const rawSkill of automaticInitialSkills) {
    addInitialSkillRetrainSource(sources, seen, planner, rawSkill, { allowHigherRanks: true, forceEligible: true });
  }
  for (const rawSkill of creationSkills) {
    addInitialSkillRetrainSource(sources, seen, planner, rawSkill, { allowHigherRanks: true });
  }
  for (const rawSkill of importedInitialSkills) {
    addInitialSkillRetrainSource(sources, seen, planner, rawSkill, { allowHigherRanks: true, forceEligible: true });
  }

  if (sources.length === 0) {
    for (const skill of getActiveSkillSlugs()) {
      addInitialSkillRetrainSource(sources, seen, planner, skill, { allowHigherRanks: false });
    }
  }

  return sources;
}

function addInitialSkillRetrainSource(sources, seen, planner, rawSkill, { allowHigherRanks, forceEligible = false }) {
  const skill = normalizeSkillSlug(rawSkill);
  if (!isActiveSkillSlug(skill) || seen.has(skill)) return;
  const actorRank = getActorSkillRank(planner.actor, skill);
  const eligible = forceEligible || (allowHigherRanks
    ? actorRank >= PROFICIENCY_RANKS.TRAINED
    : actorRank === PROFICIENCY_RANKS.TRAINED);
  if (!eligible) return;
  seen.add(skill);
  sources.push({
    fromLevel: 1,
    sourceType: INITIAL_SKILL_RETRAIN_SOURCE_TYPE,
    skill,
    fromRank: PROFICIENCY_RANKS.UNTRAINED,
    toRank: PROFICIENCY_RANKS.TRAINED,
    label: localizeSkillSlug(skill),
    rankName: titleCase(PROFICIENCY_RANK_NAMES[PROFICIENCY_RANKS.TRAINED]),
  });
}

function getActorSkillRank(actor, skill) {
  const skills = actor?.system?.skills ?? {};
  const directRank = readSkillRank(skills[skill]);
  if (directRank !== null) return directRank;

  const alias = Object.entries(SKILL_ALIASES).find(([, canonical]) => canonical === skill)?.[0];
  if (!alias) return PROFICIENCY_RANKS.UNTRAINED;
  return readSkillRank(skills[alias]) ?? PROFICIENCY_RANKS.UNTRAINED;
}

function readSkillRank(entry) {
  const rank = Number(entry?.rank ?? entry?.value);
  return Number.isFinite(rank) ? rank : null;
}

function formatFeatCategoryLabel(category) {
  const labels = {
    classFeats: 'Class Feat',
    skillFeats: 'Skill Feat',
    generalFeats: 'General Feat',
    ancestryFeats: 'Ancestry Feat',
    archetypeFeats: 'Archetype Feat',
    mythicFeats: 'Mythic Feat',
    dualClassFeats: 'Dual Class Feat',
    customFeats: 'Custom Feat',
  };
  return labels[category] ?? 'Feat';
}

function buildEquipmentContext(planner, level, levelData) {
  const wealthMode = game.settings.get(MODULE_ID, 'startingWealthMode') ?? WEALTH_MODES.DISABLED;
  const actorLevel = planner.actor.system?.details?.level?.value ?? 1;
  const isItemsAndCurrency = wealthMode === WEALTH_MODES.ITEMS_AND_CURRENCY;
  const showEquipment = isItemsAndCurrency && level === actorLevel && actorLevel > 1;

  if (!showEquipment) return { showEquipment: false };

  const slots = expandPermanentItemSlots(actorLevel);
  const plannedEquipment = levelData.equipment ?? [];
  const equipmentSlots = slots.map((slot, index) => ({
    index,
    maxLevel: slot.level,
    filled: plannedEquipment[index] ?? null,
  }));

  const entry = CHARACTER_WEALTH[actorLevel];
  const currencyBudgetGp = entry?.currencyGp ?? 0;

  return {
    showEquipment: true,
    equipmentSlots,
    equipmentCurrencyBudgetGp: currencyBudgetGp,
  };
}

export function buildABPContext(level, options) {
  if (!options.abp) return { showABP: false };

  const ABP_NEW_POTENCY = [3, 6, 9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_2 = [9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_3 = [17, 20];

  const hasNew = ABP_NEW_POTENCY.includes(level);
  const hasUpgrade2 = ABP_UPGRADE_TO_2.includes(level);
  const hasUpgrade3 = ABP_UPGRADE_TO_3.includes(level);

  if (!hasNew && !hasUpgrade2 && !hasUpgrade3) return { showABP: false };

  return {
    showABP: true,
    abpHasNew: hasNew,
    abpHasUpgrade2: hasUpgrade2,
    abpHasUpgrade3: hasUpgrade3,
  };
}

export function getClassFeaturesForLevel(planner, level) {
  const classItem = planner.actor.class;
  const features = [];
  const seen = new Set();

  for (const feature of Object.values(classItem?.system?.items ?? {})) {
    if (feature?.level !== level) continue;
    const key = String(feature?.uuid ?? feature?.name ?? '').trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    features.push({
      key: getClassFeatureKey(feature),
      name: feature.name,
      slug: feature.slug ?? feature.key ?? null,
      uuid: feature.uuid,
      img: feature.img,
    });
  }

  const dualClassSlug = String(planner.plan?.dualClassSlug ?? '').trim().toLowerCase();
  const dualClassDef = dualClassSlug && ClassRegistry.has(dualClassSlug)
    ? ClassRegistry.get(dualClassSlug)
    : null;

  for (const feature of dualClassDef?.classFeatures ?? []) {
    if (feature?.level !== level) continue;
    const key = String(feature?.key ?? feature?.name ?? '').trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    features.push({
      key: getClassFeatureKey(feature),
      name: feature.name,
      slug: feature.slug ?? feature.key ?? null,
      uuid: feature.uuid ?? null,
      img: feature.img ?? null,
    });
  }

  return features;
}

async function buildClassFeatureEntries(planner, level, levelData) {
  const features = getClassFeaturesForLevel(planner, level);
  const wizard = createPlannerChoiceWizard(planner);

  return Promise.all(features.map(async (feature) => {
    const sourceEntry = await resolveClassFeatureSource(planner, feature);
    const enrichedFeature = {
      ...feature,
      uuid: feature.uuid ?? sourceEntry?.uuid ?? null,
      img: feature.img ?? sourceEntry?.img ?? null,
    };
    const source = sourceEntry?.source ?? null;
    const rules = Array.isArray(source?.system?.rules) ? source.system.rules : [];
    if (rules.length === 0) return { ...enrichedFeature, choiceSets: [] };

    const storedChoices = levelData?.classFeatureChoices?.[feature.key] ?? {};
    const storedChoiceValues = getClassFeatureChoiceValues(storedChoices);
    const choiceSets = await parseChoiceSets(wizard, rules, storedChoiceValues, source);
    const selectedOptionChoiceSets = await buildSelectedClassFeatureOptionChoiceSets(wizard, choiceSets, storedChoiceValues);
    const combinedChoiceSets = dedupePlannerChoiceSets([...choiceSets, ...selectedOptionChoiceSets]);
    return {
      ...enrichedFeature,
      choiceSets: combinedChoiceSets
        .map((entry) => decoratePlannerClassFeatureChoiceSet(entry, storedChoices))
        .filter((entry) => entry.options.length > 0),
    };
  }));
}

async function buildSelectedClassFeatureOptionChoiceSets(wizard, choiceSets, storedChoiceValues) {
  const nestedChoiceSets = [];
  const seen = new Set();

  for (const choiceSet of choiceSets ?? []) {
    const selectedValue = storedChoiceValues?.[choiceSet?.flag];
    if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') continue;

    const option = findMatchingPlannerChoiceSetOption(choiceSet, selectedValue);
    const uuid = option?.uuid ?? (isItemUuid(selectedValue) ? selectedValue : null);
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);

    const selectedItem = await fromUuid(uuid).catch(() => null);
    const rules = Array.isArray(selectedItem?.system?.rules) ? selectedItem.system.rules : [];
    if (rules.length === 0) continue;
    nestedChoiceSets.push(...await parseChoiceSets(wizard, rules, storedChoiceValues, selectedItem));
  }

  return nestedChoiceSets;
}

function findMatchingPlannerChoiceSetOption(choiceSet, selectedValue) {
  return (choiceSet?.options ?? []).find((option) =>
    plannerChoiceValueMatches(option?.value, selectedValue)
    || plannerChoiceValueMatches(option?.uuid, selectedValue)
    || plannerChoiceValueMatches(option?.slug, selectedValue));
}

async function resolveClassFeatureSource(planner, feature) {
  if (feature?.uuid) {
    const source = await fromUuid(feature.uuid).catch(() => null);
    if (source) {
      return {
        uuid: source.uuid ?? feature.uuid,
        img: source.img ?? null,
        source,
      };
    }
  }

  const entry = await findClassFeatureCompendiumEntry(planner, feature);
  if (!entry?.uuid) return null;

  const source = await fromUuid(entry.uuid).catch(() => null);
  return {
    uuid: source?.uuid ?? entry.uuid,
    img: entry.img ?? source?.img ?? null,
    source,
  };
}

async function findClassFeatureCompendiumEntry(planner, feature) {
  const featureKey = getClassFeatureKey(feature);
  const featureName = normalizeFeatureName(feature?.name);
  const entries = await loadCompendiumCategory(planner, 'classFeatures').catch(() => []);

  return entries.find((entry) => {
    if (!entry) return false;
    const entryKeys = new Set([
      entry.uuid,
      entry.slug,
      entry.key,
      getClassFeatureKey(entry),
    ].filter(Boolean));
    if (featureKey && entryKeys.has(featureKey)) return true;
    return featureName && normalizeFeatureName(entry.name) === featureName;
  }) ?? null;
}

function normalizeFeatureName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function getClassFeatureKey(feature) {
  return String(feature?.key ?? feature?.slug ?? feature?.name ?? feature?.uuid ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function getClassFeatureChoiceValues(storedChoices = {}) {
  return Object.fromEntries(
    Object.entries(storedChoices ?? {}).map(([flag, entry]) => [
      flag,
      typeof entry === 'object' && entry !== null ? String(entry.value ?? '') : String(entry ?? ''),
    ]),
  );
}

function decoratePlannerClassFeatureChoiceSet(choiceSet, storedChoices = {}) {
  const selectedValue = String(storedChoices?.[choiceSet.flag]?.value ?? storedChoices?.[choiceSet.flag] ?? '');
  const choiceType = choiceSet.choiceType
    ?? (choiceSet.options.every((option) => isActiveSkillSlug(option.value)) ? 'skill' : 'item');
  const decorated = {
    ...choiceSet,
    choiceType,
    options: (choiceSet.options ?? []).map((option) => ({
      ...option,
      uuid: option.uuid ?? (isItemUuid(option.value) ? option.value : null),
      selected: plannerChoiceValueMatches(option?.value, selectedValue)
        || plannerChoiceValueMatches(option?.uuid, selectedValue),
      slug: option.slug ?? null,
    })),
  };
  const choicePicker = buildPlannerChoicePickerMetadata(decorated);
  if (choicePicker?.kind === 'feat') decorated.choicePicker = choicePicker;
  return decorated;
}

export function annotateFeat(feat) {
  if (!feat) return null;
  if (MANUAL_SPELL_FEATS.has(feat.slug)) {
    feat.manualSpellNote = true;
  }
  return feat;
}

export function extractFeat(feats) {
  if (!feats || feats.length === 0) return null;
  return feats[0];
}

async function buildCustomPlannerFeatEntries(planner, feats) {
  const entries = [];
  for (let index = 0; index < feats.length; index++) {
    const feat = await enrichPlannerFeat(planner, feats[index]);
    entries.push({
      index,
      feat,
      choiceSets: await buildPlannerFeatChoiceSets(planner, feat),
    });
  }
  return entries;
}

async function enrichPlannerFeat(planner, feat) {
  const annotated = annotateFeat(feat);
  if (!annotated?.uuid) return annotated;
  const preview = await buildFeatGrantPreview(planner, annotated);
  annotated.grantedItems = preview.grantedItems;
  annotated.grantChoiceSets = preview.grantChoiceSets;
  annotated.grantRequirements = await buildPlannerFeatGrantRequirements(planner, annotated);
  return annotated;
}

async function buildPlannerClassGrantRequirements(planner, levelData, level) {
  const requirements = [
    ...await buildFeatGrantRequirements({
      classEntries: getPlannerClassGrantEntries(planner),
      level,
    }),
    ...await buildPlanFormulaProgressionRequirements({
      actor: planner.actor,
      plan: planner.plan,
      level,
    }),
  ];
  const completion = getFeatGrantCompletion(levelData, requirements);

  return requirements.map((requirement) => {
    const status = completion[requirement.id] ?? {};
    return {
      ...requirement,
      selectedCount: status.selected ?? 0,
      requiredCount: status.required ?? requirement.count ?? null,
      missingCount: status.missing ?? null,
      complete: status.complete === true,
      selections: getFeatGrantSelections(levelData, requirement),
    };
  });
}

function getPlannerClassGrantEntries(planner) {
  const entries = [];
  const primary = ClassRegistry.get(planner.plan?.classSlug);
  if (primary) {
    entries.push({
      slug: primary.slug,
      name: primary.nameKey ? game.i18n.localize(primary.nameKey) : primary.slug,
      uuid: planner.actor?.class?.uuid ?? `class:${primary.slug}`,
    });
  }
  const dualClassSlug = String(planner.plan?.dualClassSlug ?? '').trim().toLowerCase();
  const dual = dualClassSlug && dualClassSlug !== primary?.slug && ClassRegistry.has(dualClassSlug)
    ? ClassRegistry.get(dualClassSlug)
    : null;
  if (dual) {
    entries.push({
      slug: dual.slug,
      name: dual.nameKey ? game.i18n.localize(dual.nameKey) : dual.slug,
      uuid: `class:${dual.slug}`,
    });
  }
  return entries;
}

async function buildPlannerFeatGrantRequirements(planner, feat) {
  const detectedRequirements = await buildFeatGrantRequirements({
    actor: planner.actor,
    plan: planner.plan,
    level: planner.selectedLevel,
    feats: [feat],
  });
  const requirements = detectedRequirements.filter((requirement) =>
    !isSpellbookBonusCantripRequirement(feat, requirement));
  const levelData = getLevelData(planner.plan, planner.selectedLevel) ?? {};
  const completion = getFeatGrantCompletion(levelData, requirements);

  return requirements.map((requirement) => {
    const status = completion[requirement.id] ?? {};
    return {
      ...requirement,
      selectedCount: status.selected ?? 0,
      requiredCount: status.required ?? requirement.count ?? null,
      missingCount: status.missing ?? null,
      complete: status.complete === true,
      selections: getFeatGrantSelections(levelData, requirement),
    };
  });
}

function isSpellbookBonusCantripRequirement(feat, requirement) {
  return isCantripExpansionFeat(feat)
    && requirement?.kind === 'spell'
    && Number(requirement?.filters?.rank) === 0
    && requirement?.filters?.spellbook === true;
}

function buildCustomSkillIncreaseGroups(customSkillIncreases) {
  const entries = customSkillIncreases.map((entry, index) => ({
    index,
    skill: entry.skill,
    label: localizeSkillSlug(entry.skill),
    toRank: entry.toRank,
    rankName: PROFICIENCY_RANK_NAMES[entry.toRank] ?? String(entry.toRank ?? ''),
  }));

  return groupEntriesBy(entries, (entry) => entry.rankName, (rankName) => ({
    label: titleCase(rankName),
    sort: Number(customSkillIncreases.find((entry) => (PROFICIENCY_RANK_NAMES[entry.toRank] ?? String(entry.toRank ?? '')) === rankName)?.toRank ?? 0),
  }));
}

function buildCustomAvailableSkills(planner, levelData, level) {
  const currentState = computeBuildState(planner.actor, planner.plan, level);
  const currentSkills = currentState.skills ?? {};
  const currentLores = currentState.lores ?? {};
  const maxRank = level >= 15 ? 4 : level >= 7 ? 3 : 2;
  const currentIncrease = levelData?.skillIncreases?.[0];

  const entries = getActiveSkillSlugs().map((slug) => {
    const rank = currentSkills[slug] ?? 0;
    const nextRank = rank + 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      disabled: nextRank > maxRank,
      selected: currentIncrease?.skill === slug,
    };
  }).filter((entry) => !entry.disabled);

  const loreEntries = Object.entries(currentLores).map(([slug, rank]) => {
    const nextRank = Number(rank ?? 0) + 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      disabled: nextRank > maxRank,
      selected: currentIncrease?.skill === slug,
    };
  }).filter((entry) => !entry.disabled);

  return filterDisallowedForCurrentUser(annotateGuidanceBySlug([...entries, ...loreEntries], 'skill'));
}

export function buildLoreSkillIncreaseEntry(name, currentRank = 0) {
  const normalized = normalizeLoreSkillName(name);
  return {
    skill: slugifyLoreSkillName(normalized),
    label: normalized,
    toRank: currentRank >= 1 ? currentRank + 1 : 1,
  };
}

function buildCustomSpellGroups(customSpells, entryOptions = []) {
  const entryLabels = new Map(entryOptions.map((entry) => [entry.entryType, entry.label]));
  const entries = customSpells.map((spell, index) => ({
    ...spell,
    index,
    displayRank: resolveSpellDisplayRank(spell),
    entryLabel: spell.entryLabel ?? entryLabels.get(spell.entryType ?? 'primary') ?? 'Primary Spellcasting Entry',
  }));

  return groupEntriesBy(entries, (entry) => entry.entryType ?? 'primary', (entryType) => {
    const option = entryOptions.find((entry) => entry.entryType === entryType);
    return {
      label: option?.label ?? entryLabels.get(entryType) ?? 'Primary Spellcasting Entry',
      tradition: option?.tradition ?? null,
      prepared: option?.prepared ?? null,
      abilityLabel: option?.abilityLabel ?? null,
      isCustom: option?.isCustom ?? false,
      entryType,
      rankGroups: [],
    };
  }).map((entryGroup) => ({
    ...entryGroup,
    rankGroups: groupEntriesBy(entryGroup.entries, (entry) => entry.displayRank, (displayRank) => ({
      label: displayRank === 0 ? 'Cantrip' : `Rank ${displayRank}`,
      sort: Number.isFinite(displayRank) ? displayRank : 999,
    })),
  }));
}

function resolveSpellDisplayRank(spell) {
  const rank = Number(spell?.rank);
  if (Number.isFinite(rank) && rank >= 0) return rank;

  const baseRank = Number(spell?.baseRank);
  if (Number.isFinite(baseRank) && baseRank >= 0) return baseRank;

  return 0;
}

function groupEntriesBy(entries, getKey, getMeta) {
  const groups = new Map();

  for (const entry of entries) {
    const key = getKey(entry);
    if (!groups.has(key)) {
      groups.set(key, { key, ...(getMeta?.(key) ?? {}), entries: [] });
    }
    groups.get(key).entries.push(entry);
  }

  return [...groups.values()].sort((a, b) => {
    if ((a.sort ?? 0) !== (b.sort ?? 0)) return (a.sort ?? 0) - (b.sort ?? 0);
    return String(a.label ?? a.key).localeCompare(String(b.label ?? b.key));
  });
}

function titleCase(value) {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isAncestralParagonFeat(feat) {
  if (!feat) return false;
  const slug = String(feat.slug ?? '').toLowerCase();
  const name = String(feat.name ?? '').toLowerCase();
  return slug === 'ancestral-paragon' || name === 'ancestral paragon';
}

function hasNativeAncestryFeatChoiceSet(choiceSets) {
  return (choiceSets ?? []).some((choiceSet) => {
    const prompt = String(choiceSet?.prompt ?? '').toLowerCase();
    if (prompt.includes('ancestry feat')) return true;
    return (choiceSet?.options ?? []).some((option) =>
      (option?.traits ?? []).map((trait) => String(trait).toLowerCase()).includes('ancestry'));
  });
}

function suppressNativeAncestryGrantPreview(feat) {
  if (!feat) return;
  const selectedValues = new Set(
    Object.values(feat.choices ?? {})
      .filter((value) => typeof value === 'string' && value.length > 0),
  );
  if (selectedValues.size === 0) return;

  feat.grantedItems = (feat.grantedItems ?? []).filter((item) => !selectedValues.has(item?.uuid));
  feat.grantChoiceSets = [];
}

async function buildNativeAncestralParagonGrantedFeat(planner, generalFeat, generalFeatChoiceSets, fallbackFeat, fallbackChoiceSets) {
  const selectedUuid = getSelectedNativeAncestralParagonFeatUuid(generalFeat, generalFeatChoiceSets);
  if (!selectedUuid) {
    return fallbackFeat ? mergePlannerChoiceSetsIntoFeat(fallbackFeat, fallbackChoiceSets) : null;
  }

  const source = await fromUuid(selectedUuid).catch(() => null);
  if (!source) return fallbackFeat ? mergePlannerChoiceSetsIntoFeat(fallbackFeat, fallbackChoiceSets) : null;

  const feat = await enrichPlannerFeat(planner, {
    uuid: source.uuid ?? selectedUuid,
    slug: source.slug ?? null,
    name: source.name,
    img: source.img ?? null,
    level: source.system?.level?.value ?? source.level ?? null,
    traits: [...(source.system?.traits?.value ?? source.traits ?? [])],
    choices: { ...(generalFeat?.choices ?? {}) },
    readOnly: true,
    choiceStorageCategory: 'generalFeats',
  });
  const choiceSets = await buildPlannerFeatChoiceSets(planner, feat);
  return {
    ...mergePlannerChoiceSetsIntoFeat(feat, choiceSets),
    readOnly: true,
    choiceStorageCategory: 'generalFeats',
  };
}

function getSelectedNativeAncestralParagonFeatUuid(generalFeat, choiceSets) {
  for (const choiceSet of choiceSets ?? []) {
    if (!hasNativeAncestryFeatChoiceSet([choiceSet])) continue;
    const selectedOption = (choiceSet.options ?? []).find((option) => option.selected);
    const selectedFromOption = selectedOption?.uuid ?? selectedOption?.value;
    if (isItemUuid(selectedFromOption)) return selectedFromOption;

    const selectedFromChoice = generalFeat?.choices?.[choiceSet.flag];
    if (isItemUuid(selectedFromChoice)) return selectedFromChoice;
  }

  return null;
}

function isAdoptedAncestryFeat(feat) {
  if (!feat) return false;
  const slug = String(feat.slug ?? '').toLowerCase();
  const name = String(feat.name ?? '').toLowerCase();
  return slug === 'adopted-ancestry' || name === 'adopted ancestry';
}

async function buildAdoptedAncestryOptions(planner, feat) {
  const items = await loadCompendiumCategory(planner, 'ancestries');
  const current = feat?.choices?.adoptedAncestry ?? feat?.adoptedAncestry ?? '';
  const actorAncestry = String(planner.actor?.ancestry?.slug ?? '').toLowerCase();

  return items
    .filter((item) => item?.slug && String(item.slug).toLowerCase() !== actorAncestry)
    .filter((item) => String(item?.rarity ?? 'common').toLowerCase() === 'common')
    .map((item) => ({
      value: String(item.slug).toLowerCase(),
      label: item.name,
      img: item.img ?? null,
      rarity: String(item.rarity ?? 'common').toLowerCase(),
      selected: String(item.slug).toLowerCase() === String(current).toLowerCase(),
    }));
}

async function buildPlannerFeatChoiceSets(planner, feat) {
  if (!feat?.uuid) return [];

  const resolvedSource = await fromUuid(feat.uuid).catch(() => null);
  const source = resolvedSource ?? feat;
  if (resolvedSource) {
    await backfillPlannerFeatSkillRules(feat, resolvedSource);
  }
  const rules = Array.isArray(source?.system?.rules) ? source.system.rules : [];

  if (sourceHasDeityAssociatedSkill(source)) {
    const deitySkill = await resolvePlannerDeitySkill(planner, feat?.choices?.deity ?? null);
    syncFeatDynamicSkillRules(feat, true, deitySkill);
  }

  const wizard = createPlannerChoiceWizard(planner);
  const choiceSets = await parseChoiceSets(wizard, rules, feat.choices ?? {}, source);
  const fallbackSets = hasSkillFallbackText(source?.system?.description?.value ?? '')
    && !choiceSets.some((choiceSet) => choiceSet?.syntheticType === 'skill-training-fallback')
    ? await buildPlannerSkillFallbackChoiceSets(planner, feat, source)
    : [];
  const dedicationFallbackSets = choiceSets.length === 0
    ? await buildPlannerDedicationChoiceSetFallbacks(planner, feat, source)
    : [];

  const authoredOrFallbackChoiceSets = [...choiceSets, ...dedicationFallbackSets];
  const specialChoiceSets = await buildPlannerSpecialChoiceSets(planner, feat, source, authoredOrFallbackChoiceSets);
  const combined = dedupePlannerChoiceSets([...choiceSets, ...dedicationFallbackSets, ...fallbackSets, ...specialChoiceSets]);
  const availableChoiceSets = filterActorSelectedRepeatableFeatChoiceSets(planner, feat, source, combined);
  syncPlannerChoiceSetSkillRules(feat, [...availableChoiceSets, ...(feat?.grantChoiceSets ?? [])]);

  return availableChoiceSets
    .map((entry) => decoratePlannerChoiceSetForRender(planner, entry, feat))
    .filter((entry) => entry.choiceType === 'lore' || entry.options.length > 0);
}

function filterActorSelectedRepeatableFeatChoiceSets(planner, feat, source, choiceSets) {
  if (!isRepeatablePlannerFeat(source)) return choiceSets;
  const actorSelections = getActorSelectedFeatChoiceValues(planner?.actor, feat, source);
  if (actorSelections.size === 0) return choiceSets;

  return (choiceSets ?? []).map((choiceSet) => {
    const selectedValues = actorSelections.get(choiceSet?.flag);
    if (!selectedValues?.length) return choiceSet;

    const plannedValue = feat?.choices?.[choiceSet.flag];
    if (selectedValues.some((value) => plannerChoiceValueMatches(plannedValue, value)) && feat?.choices) {
      delete feat.choices[choiceSet.flag];
    }

    return {
      ...choiceSet,
      options: (choiceSet.options ?? []).filter((option) =>
        !selectedValues.some((value) => plannerOptionMatchesChoiceValue(option, value))),
    };
  });
}

function isRepeatablePlannerFeat(source) {
  const rawLimit = source?.system?.maxTakable ?? source?.maxTakable;
  const limit = Number(rawLimit?.value ?? rawLimit);
  return Number.isFinite(limit) && limit > 1;
}

function getActorSelectedFeatChoiceValues(actor, feat, source) {
  const choicesByFlag = new Map();

  for (const item of getActorItems(actor)) {
    if (!isSamePlannerFeatSource(item, feat, source)) continue;
    for (const [flag, value] of Object.entries(getActorItemRuleSelections(item))) {
      if (!hasUsablePlannerChoiceValue(value)) continue;
      const entries = choicesByFlag.get(flag) ?? [];
      entries.push(value);
      choicesByFlag.set(flag, entries);
    }
  }

  return choicesByFlag;
}

function isSamePlannerFeatSource(item, feat, source) {
  const targetIds = new Set([feat?.uuid, feat?.sourceId, source?.uuid, source?.sourceId, source?.flags?.core?.sourceId, source?._stats?.compendiumSource]
    .map(normalizePlannerSourceIdentity)
    .filter(Boolean));
  const itemIds = [item?.uuid, item?.sourceId, item?.flags?.core?.sourceId, item?._stats?.compendiumSource]
    .map(normalizePlannerSourceIdentity)
    .filter(Boolean);
  if (itemIds.some((id) => targetIds.has(id))) return true;

  const targetSlug = normalizePlannerSlugIdentity(source?.slug ?? source?.system?.slug ?? feat?.slug);
  const itemSlug = normalizePlannerSlugIdentity(item?.slug ?? item?.system?.slug);
  if (targetSlug && itemSlug && targetSlug === itemSlug) return true;

  const targetName = normalizePlannerSlugIdentity(source?.name ?? feat?.name);
  const itemName = normalizePlannerSlugIdentity(item?.name);
  return !!targetName && !!itemName && targetName === itemName;
}

function normalizePlannerSourceIdentity(value) {
  const normalized = normalizePf2eCompendiumUuid(value);
  return String(normalized ?? '').trim().toLowerCase();
}

function normalizePlannerSlugIdentity(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function getActorItemRuleSelections(item) {
  return {
    ...(item?.flags?.system?.rulesSelections ?? {}),
    ...(item?.flags?.pf2e?.rulesSelections ?? {}),
  };
}

function hasUsablePlannerChoiceValue(value) {
  if (typeof value === 'string') return value.trim().length > 0 && value !== '[object Object]';
  return typeof value === 'number';
}

function plannerOptionMatchesChoiceValue(option, value) {
  return plannerChoiceValueMatches(option?.value, value)
    || plannerChoiceValueMatches(option?.uuid, value)
    || plannerChoiceValueMatches(option?.slug, value)
    || plannerChoiceValueMatches(option?.label, value);
}

async function buildPlannerSpecialChoiceSets(planner, feat, source, parsedChoiceSets = []) {
  const slug = String(feat?.slug ?? source?.slug ?? '').toLowerCase();
  const special = [];

  if (slug === 'additional-lore') {
    special.push({
      flag: 'levelerAdditionalLore',
      prompt: 'Select a Lore skill.',
      choiceType: 'lore',
      grantsSkillTraining: true,
      options: [],
    });
  }

  if (slug === 'multilingual') {
    special.push({
      flag: 'levelerMultilingualLanguage',
      prompt: 'Select a language.',
      choiceType: 'language',
      options: filterDisallowedForCurrentUser(annotateGuidanceBySlug(getAvailableLanguages(), 'language')).map((entry) => ({
        value: entry.slug,
        label: entry.label,
        rarity: entry.rarity,
        isRecommended: entry.isRecommended,
        isNotRecommended: entry.isNotRecommended,
        isDisallowed: entry.isDisallowed,
        guidanceSelectionBlocked: entry.guidanceSelectionBlocked,
        guidanceSelectionTooltip: entry.guidanceSelectionTooltip,
      })),
    });
  }

  if (slug === 'natural-ambition' && !hasUsableChoiceSet(parsedChoiceSets, 'naturalAmbition')) {
    const naturalAmbitionChoiceSet = await buildNaturalAmbitionChoiceSet(planner);
    if (naturalAmbitionChoiceSet) special.push(naturalAmbitionChoiceSet);
  }

  const textLanguageRarities = getLanguageChoiceRaritiesFromDescription(source);
  if (
    (hasLanguageChoiceSlot(source) || textLanguageRarities) &&
    !special.some((entry) => entry.choiceType === 'language')
  ) {
    special.push(buildPlannerLanguageChoiceSet({ rarities: textLanguageRarities }));
  }

  const dedicationSubclassChoiceSet = hasExistingDedicationSubclassChoiceSet(parsedChoiceSets, feat, source)
    ? null
    : await buildPlannerDedicationSubclassChoiceSet(planner, feat, source);
  if (dedicationSubclassChoiceSet) special.push(dedicationSubclassChoiceSet);

  const advancedMulticlassChoiceSet = await buildAdvancedMulticlassClassFeatChoiceSet(planner, feat, source, parsedChoiceSets);
  if (advancedMulticlassChoiceSet) special.push(advancedMulticlassChoiceSet);

  const freeHeartBackgroundChoiceSets = await buildFreeHeartBackgroundChoiceSets(planner, feat, source, parsedChoiceSets);
  special.push(...freeHeartBackgroundChoiceSets);

  return special;
}

function hasUsableChoiceSet(choiceSets, flag) {
  return (choiceSets ?? []).some((choiceSet) =>
    choiceSet?.flag === flag && (choiceSet?.options ?? []).length > 0);
}

async function buildFreeHeartBackgroundChoiceSets(planner, feat, source, parsedChoiceSets = []) {
  const slug = String(feat?.slug ?? source?.system?.slug ?? source?.slug ?? '').trim().toLowerCase();
  const name = String(feat?.name ?? source?.name ?? '').trim().toLowerCase();
  if (slug !== 'free-heart' && name !== 'free heart') return [];

  const backgrounds = await loadCompendiumCategory(planner, 'backgrounds');
  const options = backgrounds
    .filter((item) => String(item?.type ?? '').toLowerCase() === 'background')
    .filter((item) => String(item?.rarity ?? 'common').toLowerCase() === 'common')
    .map((item) => ({
      value: item.uuid,
      uuid: item.uuid,
      label: item.name,
      img: item.img ?? null,
      slug: item.slug ?? null,
      traits: item.traits ?? [],
      rarity: item.rarity ?? 'common',
      type: 'background',
      category: 'background',
      level: item.level ?? 0,
    }))
    .filter((item) => isItemUuid(item.uuid))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (options.length === 0) return [];

  const choiceSets = [];
  if (!hasUsableChoiceSet(parsedChoiceSets, FREE_HEART_BACKGROUND_CHOICE_FLAG)) {
    choiceSets.push({
      flag: FREE_HEART_BACKGROUND_CHOICE_FLAG,
      prompt: 'Select a common background.',
      choiceType: 'item',
      syntheticType: 'free-heart-background-choice',
      options,
    });
  }

  const selectedBackground = await resolveSelectedFreeHeartBackground(feat);
  if (!selectedBackground) return choiceSets;

  const fixedSkillRules = await syncFreeHeartBackgroundSkillRules(feat, selectedBackground);
  syncFreeHeartBackgroundLoreRules(feat, selectedBackground);
  const wizard = createPlannerChoiceWizard(planner);
  let backgroundChoiceSets = await parseChoiceSets(wizard, selectedBackground.system?.rules ?? [], feat?.choices ?? {}, selectedBackground);
  if (!backgroundChoiceSets.some((choiceSet) => (choiceSet?.options ?? []).every((option) => isActiveSkillSlug(option?.value)))) {
    backgroundChoiceSets = [
      ...backgroundChoiceSets,
      ...buildFreeHeartBackgroundTextSkillChoiceSets(selectedBackground),
    ];
  }
  choiceSets.push(...backgroundChoiceSets.map((choiceSet) => {
    const isSkillChoiceSet = (choiceSet?.options ?? []).every((option) => isActiveSkillSlug(option?.value));
    const drivesGrant = isSkillChoiceSet && backgroundChoiceSetDrivesGrant(selectedBackground, choiceSet?.flag);
    return {
      ...choiceSet,
      sourceName: selectedBackground.name,
      ...(isSkillChoiceSet
        ? {
            grantsSkillTraining: true,
            widenWhenAllOptionsBlocked: !drivesGrant,
            allowTrainedSkillSelection: drivesGrant,
          }
        : {}),
    };
  }));

  const fallbackChoiceSets = buildFreeHeartBackgroundSkillFallbackChoiceSets(planner, feat, selectedBackground, fixedSkillRules, backgroundChoiceSets);
  if (fallbackChoiceSets.length > 0) {
    removeFreeHeartBackgroundOverlappedSkillRules(feat, fallbackChoiceSets.map((choiceSet) => choiceSet.replacedSkill));
    choiceSets.push(...fallbackChoiceSets);
  }
  return choiceSets;
}

function backgroundChoiceSetDrivesGrant(background, flag) {
  if (flag === 'backgroundSkill' && hasFreeHeartBackgroundTextSkillFeatGrant(background)) return true;
  const normalizedFlag = String(flag ?? '').trim().toLowerCase();
  if (!normalizedFlag) return false;
  const needle = `rulesselections.${normalizedFlag}`;
  return (background?.system?.rules ?? []).some((rule) =>
    rule?.key === 'GrantItem'
    && String(rule?.uuid ?? '').toLowerCase().includes(needle));
}

function buildFreeHeartBackgroundTextSkillChoiceSets(background) {
  if (!hasFreeHeartBackgroundTextSkillFeatGrant(background)) return [];
  const description = normalizeDescriptionText(background?.system?.description?.value ?? '');
  const options = [];
  if (/\bacrobatics\b/.test(description) && /\bcat\s+fall\b/.test(description)) {
    options.push({ value: 'acrobatics', label: localizeSkillSlug('acrobatics') });
  }
  if (/\bathletics\b/.test(description) && /\bquick\s+jump\b/.test(description)) {
    options.push({ value: 'athletics', label: localizeSkillSlug('athletics') });
  }
  if (options.length < 2) return [];
  return [{
    flag: 'backgroundSkill',
    prompt: 'Select a skill.',
    choiceType: 'skill',
    syntheticType: 'free-heart-background-text-skill-feat',
    grantsSkillTraining: true,
    sourceName: background?.name ?? null,
    options,
  }];
}

function hasFreeHeartBackgroundTextSkillFeatGrant(background) {
  const description = normalizeDescriptionText(background?.system?.description?.value ?? '');
  return /\bacrobatics\b/.test(description)
    && /\bathletics\b/.test(description)
    && /\bcat\s+fall\b/.test(description)
    && /\bquick\s+jump\b/.test(description);
}

function normalizeDescriptionText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

async function resolveSelectedFreeHeartBackground(feat) {
  const uuid = feat?.choices?.[FREE_HEART_BACKGROUND_CHOICE_FLAG];
  if (!isItemUuid(uuid) || !String(uuid).includes('.backgrounds.')) return null;
  return fromUuid(uuid).catch(() => null);
}

async function syncFreeHeartBackgroundSkillRules(feat, background) {
  if (!feat || !background) return [];
  const sourceKey = `choice:${FREE_HEART_BACKGROUND_CHOICE_FLAG.toLowerCase()}`;
  const preservedRules = Array.isArray(feat.dynamicSkillRules)
    ? feat.dynamicSkillRules.filter((rule) => rule?.source !== sourceKey)
    : [];
  const rules = await extractFeatSkillRules(background).catch(() => []);
  feat.dynamicSkillRules = [
    ...preservedRules,
    ...rules.map((rule) => ({
      ...rule,
      source: sourceKey,
    })),
  ];
  return rules;
}

function buildFreeHeartBackgroundSkillFallbackChoiceSets(planner, feat, background, fixedSkillRules, backgroundChoiceSets = []) {
  const grantedSkillSet = new Set((fixedSkillRules ?? [])
    .map((rule) => normalizeSkillSlug(rule?.skill))
    .filter((skill) => isActiveSkillSlug(skill)));
  for (const choiceSet of backgroundChoiceSets ?? []) {
    if (!backgroundChoiceSetDrivesGrant(background, choiceSet?.flag)) continue;
    const selectedSkill = normalizeSkillSlug(feat?.choices?.[choiceSet?.flag]);
    if (isActiveSkillSlug(selectedSkill)) grantedSkillSet.add(selectedSkill);
  }
  const grantedSkills = [...grantedSkillSet];
  if (grantedSkills.length === 0) return [];

  const priorSkills = getFreeHeartBackgroundPriorSkillRanks(planner, background);
  const overlaps = grantedSkills.filter((skill) => (priorSkills?.[skill] ?? 0) >= 1);
  if (overlaps.length === 0) return [];

  return overlaps.map((skill, index) => {
    const flag = `levelerFreeHeartBackgroundSkillFallback${index + 1}`;
    return {
      flag,
      prompt: 'Select a skill.',
      choiceType: 'skill',
      syntheticType: 'free-heart-background-skill-fallback',
      grantsSkillTraining: true,
      replacedSkill: skill,
      sourceName: background?.name ?? null,
      options: buildPlannerSkillFallbackOptions(
        planner,
        feat,
        flag,
        grantedSkills,
        /^levelerFreeHeartBackgroundSkillFallback\d+$/i,
      ),
    };
  });
}

function removeFreeHeartBackgroundOverlappedSkillRules(feat, skills) {
  const sourceKey = `choice:${FREE_HEART_BACKGROUND_CHOICE_FLAG.toLowerCase()}`;
  const blockedSkills = new Set((skills ?? []).map((skill) => normalizeSkillSlug(skill)));
  feat.dynamicSkillRules = (feat.dynamicSkillRules ?? []).filter((rule) =>
    rule?.source !== sourceKey || !blockedSkills.has(normalizeSkillSlug(rule?.skill)));
}

function syncFreeHeartBackgroundLoreRules(feat, background) {
  if (!feat || !background) return [];
  const sourceKey = `choice:${FREE_HEART_BACKGROUND_CHOICE_FLAG.toLowerCase()}`;
  const preservedRules = Array.isArray(feat.dynamicLoreRules)
    ? feat.dynamicLoreRules.filter((rule) => rule?.source !== sourceKey)
    : [];
  const rules = extractFreeHeartBackgroundLoreRules(background);
  feat.dynamicLoreRules = [
    ...preservedRules,
    ...rules.map((rule) => ({
      ...rule,
      source: sourceKey,
    })),
  ];
  return rules;
}

function extractFreeHeartBackgroundLoreRules(background) {
  const lores = new Set();

  for (const rawLore of background?.system?.trainedSkills?.lore ?? []) {
    for (const option of splitLoreTrainingOptions(rawLore)) {
      const slug = slugifyLoreSkillName(option);
      if (slug) lores.add(slug);
    }
  }

  for (const rule of background?.system?.rules ?? []) {
    if (rule?.key !== 'ActiveEffectLike') continue;
    if (Number(rule?.value ?? 0) < 1) continue;
    const match = String(rule?.path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
    if (!match) continue;
    const skill = normalizeSkillSlug(match[1]);
    if (!skill || isActiveSkillSlug(skill)) continue;
    lores.add(slugifyLoreSkillName(skill));
  }

  return [...lores].map((skill) => ({ skill, value: 1 }));
}

function splitLoreTrainingOptions(value) {
  return String(value ?? '')
    .split(/\s+or\s+|,/iu)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getFreeHeartBackgroundPriorSkillRanks(planner, background) {
  const actorLevel = Number(planner?.plan?.importedFromActor?.actorLevel ?? planner?.actor?.system?.details?.level?.value ?? 0);
  const selectedLevel = Number(planner?.selectedLevel ?? 1);
  const isImportedHistoricalLevel = planner?.plan?.importedFromActor?.hideHistoricalSkillIncreases === true
    && Number.isFinite(actorLevel)
    && Number.isFinite(selectedLevel)
    && selectedLevel <= actorLevel;
  if (!isImportedHistoricalLevel) {
    return computeBuildState(planner.actor, planner.plan, selectedLevel - 1).skills ?? {};
  }

  const creationData = getCreationData(planner.actor);
  const initialSkillTraining = new Set([
    ...getImportedInitialSkillTraining(planner.plan),
    ...getImportedInitialSkillChoiceTraining(planner.plan),
  ]);
  for (const rawSkill of creationData?.skills ?? []) {
    const skill = normalizeSkillSlug(rawSkill);
    if (isActiveSkillSlug(skill)) initialSkillTraining.add(skill);
  }

  return computeSkillPickerState(
    withoutSelectedBackgroundItem(planner.actor, background),
    planner.plan,
    selectedLevel - 1,
    ClassRegistry.get(planner.plan?.classSlug),
    {
      includeActorSkillRanks: false,
      includePlannedFeatRules: true,
      includeCurrentLevelSkillIncrease: true,
      initialSkillTraining: [...initialSkillTraining],
    },
  );
}

function withoutSelectedBackgroundItem(actor, background) {
  const backgroundUuid = String(background?.uuid ?? '');
  const backgroundSlug = String(background?.slug ?? background?.system?.slug ?? '').trim().toLowerCase();
  const items = getActorItems(actor).filter((item) => !isSameBackgroundItem(item, backgroundUuid, backgroundSlug));
  return {
    ...actor,
    background: isSameBackgroundItem(actor?.background, backgroundUuid, backgroundSlug) ? null : actor?.background,
    items,
  };
}

function getActorItems(actor) {
  if (!actor?.items) return [];
  if (Array.isArray(actor.items)) return actor.items;
  if (Array.isArray(actor.items.contents)) return actor.items.contents;
  if (typeof actor.items.filter === 'function') return actor.items.filter(() => true);
  return Array.from(actor.items);
}

function isSameBackgroundItem(item, uuid, slug) {
  if (!item || String(item?.type ?? item?.itemType ?? '').trim().toLowerCase() !== 'background') return false;
  const itemUuid = String(item?.uuid ?? item?.sourceId ?? item?.flags?.core?.sourceId ?? '');
  if (uuid && itemUuid === uuid) return true;
  const itemSlug = String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase();
  return !!slug && itemSlug === slug;
}

async function buildNaturalAmbitionChoiceSet(planner) {
  const classSlug = String(resolvePlannerPrimaryClass(planner)?.slug ?? '').trim().toLowerCase();
  if (!classSlug) return null;

  const feats = await loadCompendiumCategory(planner, 'feats');
  const options = feats
    .filter((item) => String(item?.category ?? '').toLowerCase() === 'class')
    .filter((item) => Number(item?.level ?? 0) === 1)
    .filter((item) => (item?.traits ?? []).map((trait) => String(trait).toLowerCase()).includes(classSlug))
    .map((item) => ({
      value: item.uuid ?? item.slug,
      label: item.name,
      uuid: item.uuid ?? null,
      slug: item.slug ?? null,
      img: item.img ?? null,
      traits: item.traits ?? [],
      rarity: item.rarity ?? 'common',
      type: item.type ?? 'feat',
      category: item.category ?? 'class',
      level: item.level ?? 1,
    }))
    .filter((item) => isItemUuid(item.uuid ?? item.value))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (options.length === 0) return null;
  return {
    flag: 'naturalAmbition',
    prompt: game.i18n?.has?.('PF2E.SpecificRule.Prompt.LevelOneClassFeat')
      ? game.i18n.localize('PF2E.SpecificRule.Prompt.LevelOneClassFeat')
      : 'Select a 1st-level class feat.',
    choiceType: 'item',
    options,
  };
}

// The "Advanced [Archetype]" multiclass feats let you gain a class feat from the
// archetype's class, so we synthesize a class-feat browse for them. This must only
// fire for ARCHETYPE feats — base class feats like "Advanced Domain" (cleric) also
// start with "advanced-" but carry their own rules, so they must be left untouched.
export function isAdvancedMulticlassFeatCandidate(feat, source) {
  const slug = String(feat?.slug ?? source?.system?.slug ?? source?.slug ?? '').trim().toLowerCase();
  const name = String(feat?.name ?? source?.name ?? '').trim().toLowerCase();
  const isConcoction = slug === 'basic-concoction' || slug === 'advanced-concoction' || name === 'basic concoction' || name === 'advanced concoction';
  if (isConcoction) return true;
  if ((source?.system?.rules ?? []).some((rule) => rule?.key === 'GrantItem')) return false;
  if (!slug.startsWith('advanced-') && !name.startsWith('advanced ')) return false;
  const traits = (source?.system?.traits?.value ?? feat?.traits ?? []).map((trait) => String(trait).toLowerCase());
  return traits.includes('archetype');
}

async function buildAdvancedMulticlassClassFeatChoiceSet(planner, feat, source, parsedChoiceSets = []) {
  if (hasUsableChoiceSet(parsedChoiceSets, ADVANCED_MULTICLASS_FEAT_CHOICE_FLAG)) return null;
  if (!isAdvancedMulticlassFeatCandidate(feat, source)) return null;

  const slug = String(feat?.slug ?? source?.system?.slug ?? source?.slug ?? '').trim().toLowerCase();
  const name = String(feat?.name ?? source?.name ?? '').trim().toLowerCase();
  const isConcoction = slug === 'basic-concoction' || slug === 'advanced-concoction' || name === 'basic concoction' || name === 'advanced concoction';

  const classSlug = isConcoction ? 'alchemist' : getPlannerDedicationArchetypeSlug(feat, source);
  if (!classSlug || !ClassRegistry.has(classSlug)) return null;

  const maxLevel = Math.max(1, Math.floor(Number(planner?.selectedLevel ?? 1) / 2));
  const feats = await loadCompendiumCategory(planner, 'feats');
  const options = feats
    .filter((item) => String(item?.category ?? '').toLowerCase() === 'class')
    .filter((item) => Number(item?.level ?? 0) <= maxLevel)
    .filter((item) => (item?.traits ?? []).map((trait) => String(trait).toLowerCase()).includes(classSlug))
    .filter((item) => !(item?.traits ?? []).map((trait) => String(trait).toLowerCase()).includes('class-archetype'))
    .map((item) => ({
      value: item.uuid ?? item.slug,
      label: item.name,
      uuid: item.uuid ?? null,
      slug: item.slug ?? null,
      img: item.img ?? null,
      traits: item.traits ?? [],
      rarity: item.rarity ?? 'common',
      type: item.type ?? 'feat',
      category: item.category ?? 'class',
      level: item.level ?? null,
    }))
    .filter((item) => isItemUuid(item.uuid ?? item.value))
    .sort((a, b) => {
      const levelCompare = Number(a.level ?? 0) - Number(b.level ?? 0);
      return levelCompare || a.label.localeCompare(b.label);
    });

  if (options.length === 0) return null;
  return {
    flag: ADVANCED_MULTICLASS_FEAT_CHOICE_FLAG,
    prompt: `Select a ${ClassRegistry.get(classSlug)?.name ?? classSlug} feat.`,
    choiceType: 'item',
    syntheticType: 'advanced-multiclass-class-feat',
    options,
  };
}

function hasLanguageChoiceSlot(source) {
  return (source?.system?.rules ?? []).some((rule) => {
    if (rule?.key !== 'ActiveEffectLike' || rule?.path !== 'system.build.languages.max') return false;
    return getLanguageSlotCount(rule.value) > 0;
  });
}

function getLanguageSlotCount(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  return value.startsWith('ternary(') ? 1 : 0;
}

function getLanguageChoiceRaritiesFromDescription(source) {
  const description = String(source?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!/\b(?:learn|gain|choose|select)\b[^.]*\blanguage(?:s)?\b[^.]*\b(?:choice|choose|select)\b/u.test(description)) {
    return null;
  }
  if (/\bcommon\s+or\s+uncommon\s+language\b/u.test(description)) return new Set(['common', 'uncommon']);
  if (/\bcommon\s+language\b/u.test(description)) return new Set(['common']);
  if (/\buncommon\s+language\b/u.test(description)) return new Set(['uncommon']);
  return null;
}

function buildPlannerLanguageChoiceSet({ rarities = null } = {}) {
  const allowedRarities = rarities instanceof Set ? rarities : null;
  return {
    flag: 'levelerLanguageChoice',
    prompt: 'Select a language.',
    choiceType: 'language',
    options: filterDisallowedForCurrentUser(annotateGuidanceBySlug(getAvailableLanguages(), 'language'))
      .filter((entry) => !allowedRarities || allowedRarities.has(String(entry.rarity ?? 'common').toLowerCase()))
      .map((entry) => ({
        value: entry.slug,
        label: entry.label,
        rarity: entry.rarity,
        isRecommended: entry.isRecommended,
        isNotRecommended: entry.isNotRecommended,
        isDisallowed: entry.isDisallowed,
        guidanceSelectionBlocked: entry.guidanceSelectionBlocked,
        guidanceSelectionTooltip: entry.guidanceSelectionTooltip,
      })),
  };
}

async function buildPlannerDedicationSubclassChoiceSet(planner, feat, source) {
  const description = String(source?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!/\b(?:choose|select)\s+(?:a|an|one|your)?\s*(?:school|bloodline|patron|order|doctrine|mystery|instinct|style|way|innovation|methodology|edge|study|mind|eidolon|racket)\b/u.test(description)) {
    return null;
  }

  const archetypeSlug = getPlannerDedicationArchetypeSlug(feat, source);
  const subclassTag = SUBCLASS_TAGS[archetypeSlug] ?? archetypeSlug;
  if (!subclassTag) return null;

  const wizard = createPlannerChoiceWizard(planner);
  const options = filterDisallowedForCurrentUser(await loadTaggedClassFeatures(wizard, subclassTag, `planner-dedication-${subclassTag}`))
    .map((entry) => ({
      value: entry.uuid,
      uuid: entry.uuid,
      label: entry.name,
      img: entry.img ?? null,
      type: 'feat',
      rarity: entry.rarity ?? 'common',
      isRecommended: entry.isRecommended,
      isNotRecommended: entry.isNotRecommended,
      isDisallowed: entry.isDisallowed,
      guidanceSelectionBlocked: entry.guidanceSelectionBlocked,
      guidanceSelectionTooltip: entry.guidanceSelectionTooltip,
    }));
  if (options.length === 0) return null;

  return {
    flag: `${archetypeSlug}DedicationSubclass`,
    prompt: inferDedicationSubclassPrompt(description),
    choiceType: 'item',
    syntheticType: 'dedication-subclass-choice',
    options,
  };
}

function inferDedicationSubclassPrompt(description) {
  const kind = inferDedicationSubclassKind(description);
  const label = kind ? kind.replace(/\b\w/gu, (char) => char.toUpperCase()) : 'Option';
  return `Select a ${label}.`;
}

function inferDedicationSubclassKind(description) {
  const match = String(description ?? '').match(/\b(?:choose|select)\s+(?:a|an|one|your)?\s*(school|bloodline|patron|order|doctrine|mystery|instinct|style|way|innovation|methodology|edge|study|mind|eidolon|racket)\b/u);
  return match?.[1] ?? null;
}

function hasExistingDedicationSubclassChoiceSet(choiceSets, feat, source) {
  const description = String(source?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const kind = inferDedicationSubclassKind(description);
  const archetypeSlug = getPlannerDedicationArchetypeSlug(feat, source);

  return (choiceSets ?? []).some((choiceSet) => {
    if (choiceSet?.syntheticType === 'dedication-subclass-choice') return true;
    const label = `${choiceSet?.flag ?? ''} ${choiceSet?.prompt ?? ''}`.toLowerCase();
    const labelMatches = (!!kind && label.includes(kind))
      || (!!archetypeSlug && label.includes(archetypeSlug));
    if (!labelMatches) return false;
    const options = choiceSet?.options ?? [];
    return options.length === 0 || options.some(isClassFeatureChoiceOption);
  });
}

function isClassFeatureChoiceOption(option) {
  const uuid = String(option?.uuid ?? option?.value ?? '').toLowerCase();
  if (uuid.includes('.classfeatures.')) return true;
  return ['classfeature', 'class-feature'].includes(normalizeChoiceOptionCategory(option?.category));
}

function hydratePlannerChoiceOptions(planner, entry, feat) {
  const selectedValue = String(feat?.choices?.[entry.flag] ?? '');
  const options = (entry.options ?? []).map((option) => ({
    ...option,
    uuid: option.uuid ?? (isItemUuid(option.value) ? option.value : null),
    selected: plannerChoiceValueMatches(option?.value, selectedValue)
      || plannerChoiceValueMatches(option?.uuid, selectedValue),
  }));

  const isSkillChoiceSet = (entry.choiceType === 'skill')
    || options.every((option) => isActiveSkillSlug(option?.value));

  const hydratedOptions = entry?.grantsSkillTraining === true && isSkillChoiceSet
    ? decoratePlannerSkillChoiceOptions(planner, entry, feat, options)
    : options;

  if (!selectedValue || hydratedOptions.some((option) => option.selected)) return hydratedOptions;
  if (isActiveSkillSlug(selectedValue)) return hydratedOptions;

  return [
    ...hydratedOptions,
    {
      value: selectedValue,
      label: localizeSkillSlug(selectedValue),
      selected: true,
    },
  ];
}

function decoratePlannerChoiceSetForRender(planner, entry, feat) {
  const choiceType = entry.choiceType
    ?? (entry.options.every((option) => isActiveSkillSlug(option.value)) ? 'skill' : 'item');
  const hydratedEntry = { ...entry, choiceType };
  const options = hydratePlannerChoiceOptions(planner, hydratedEntry, feat);
  const decorated = {
    ...hydratedEntry,
    options,
  };
  const choicePicker = buildPlannerChoicePickerMetadata(decorated);
  if (choicePicker) decorated.choicePicker = choicePicker;
  return decorated;
}

function buildPlannerChoicePickerMetadata(choiceSet) {
  if (choiceSet?.choiceType !== 'item') return null;
  const options = (choiceSet.options ?? []).filter((option) => isItemUuid(option.uuid ?? option.value));
  if (options.length === 0) return null;
  const allowedUuids = options.map((option) => option.uuid ?? option.value);
  const selectedOption = options.find((option) => option.selected) ?? null;
  const isSpell = options.some((option) =>
    String(option.type ?? '').toLowerCase() === 'spell'
    || String(option.uuid ?? option.value ?? '').includes('.spells-'));

  if (isSpell) {
    const rank = inferChoiceSetSpellRank(choiceSet);
    return {
      kind: 'spell',
      allowedUuids,
      rank,
      title: choiceSet.prompt,
      selectedOption,
    };
  }

  if (!options.every(isFeatPickerChoiceOption)) {
    return {
      kind: 'item',
      allowedUuids,
      items: options.map(choiceOptionToPickerItem),
      title: choiceSet.prompt,
      selectedOption,
    };
  }

  return {
    kind: 'feat',
    allowedUuids,
    category: inferChoiceSetFeatCategory(choiceSet, options),
    level: inferChoiceSetFeatLevel(options),
    title: choiceSet.prompt,
    selectedOption,
  };
}

function isFeatPickerChoiceOption(option) {
  const uuid = String(option?.uuid ?? option?.value ?? '').toLowerCase();
  if (uuid.includes('.classfeatures.')) return false;
  if (uuid.includes('.feats')) return true;

  const type = String(option?.type ?? '').toLowerCase();
  const category = normalizeChoiceOptionCategory(option?.category);
  return type === 'feat' && !['classfeature', 'class-feature'].includes(category);
}

function choiceOptionToPickerItem(option) {
  const uuid = option.uuid ?? option.value;
  const type = String(option.type ?? inferItemTypeFromUuid(uuid) ?? 'equipment').toLowerCase();
  const category = normalizeChoiceOptionCategory(option.category) ?? type;
  const rarity = String(option.rarity ?? 'common').toLowerCase();
  const level = Number(option.level ?? option.rank ?? option.system?.level?.value ?? 0);

  return {
    uuid,
    name: option.label ?? option.name ?? option.slug ?? uuid,
    img: option.img ?? 'icons/svg/item-bag.svg',
    type,
    slug: option.slug ?? (typeof option.value === 'string' && !isItemUuid(option.value) ? option.value : null),
    category,
    levelerChoiceValue: option.value ?? uuid,
    system: {
      slug: option.slug ?? null,
      category,
      level: { value: Number.isFinite(level) ? level : 0 },
      traits: {
        value: (option.traits ?? []).map((trait) => String(trait).toLowerCase()),
        rarity,
      },
    },
  };
}

function inferItemTypeFromUuid(uuid) {
  const text = String(uuid ?? '').toLowerCase();
  if (text.includes('.ancestries.')) return 'ancestry';
  if (text.includes('.backgrounds.')) return 'background';
  if (text.includes('.heritages.')) return 'heritage';
  if (text.includes('.deities.')) return 'deity';
  if (text.includes('.classfeatures.')) return 'classfeature';
  if (text.includes('.equipment')) return 'equipment';
  return null;
}

function normalizeChoiceOptionCategory(category) {
  if (category && typeof category === 'object') {
    return String(category.value ?? category.slug ?? category.name ?? '')
      .trim()
      .toLowerCase();
  }
  const normalized = String(category ?? '')
    .trim()
    .toLowerCase();
  return normalized || null;
}

function inferChoiceSetSpellRank(choiceSet) {
  const text = `${choiceSet?.flag ?? ''} ${choiceSet?.prompt ?? ''}`.toLowerCase();
  if (text.includes('cantrip')) return 0;
  const ranks = (choiceSet?.options ?? [])
    .map((option) => Number(option.rank ?? option.level ?? option.system?.level?.value))
    .filter(Number.isFinite);
  if (ranks.length > 0 && ranks.every((rank) => rank === ranks[0])) return ranks[0];
  return -1;
}

function inferChoiceSetFeatCategory(choiceSet, options) {
  const text = `${choiceSet?.flag ?? ''} ${choiceSet?.prompt ?? ''}`.toLowerCase();
  if (text.includes('ancestry')) return 'ancestry';
  if (text.includes('class')) return 'class';
  if (text.includes('skill')) return 'skill';
  if (text.includes('archetype')) return 'archetype';
  const traits = options.flatMap((option) => option.traits ?? []).map((trait) => String(trait).toLowerCase());
  if (traits.includes('ancestry')) return 'ancestry';
  if (traits.includes('skill')) return 'skill';
  return 'custom';
}

function inferChoiceSetFeatLevel(options) {
  const levels = options
    .map((option) => Number(option.level ?? option.system?.level?.value))
    .filter(Number.isFinite);
  if (levels.length === 0) return 1;
  return Math.max(...levels);
}

function isItemUuid(value) {
  return /^(?:Compendium|Actor)\./.test(String(value ?? ''));
}

function plannerChoiceValueMatches(candidate, selectedValue) {
  const candidateText = String(candidate ?? '');
  const selectedText = String(selectedValue ?? '');
  if (!candidateText || !selectedText) return false;
  return candidateText === selectedText
    || normalizePf2eCompendiumUuid(candidateText) === normalizePf2eCompendiumUuid(selectedText);
}

async function backfillPlannerFeatSkillRules(feat, source) {
  if (!feat || !source) return;
  if (Array.isArray(feat.skillRules) && feat.skillRules.length > 0) return;

  const resolvedRules = await extractFeatSkillRules(source).catch(() => []);
  if (!Array.isArray(resolvedRules) || resolvedRules.length === 0) return;
  feat.skillRules = resolvedRules;
}

export async function buildFeatGrantPreview(planner, feat) {
  const source = await fromUuid(feat.uuid).catch(() => null);
  if (!source) return { grantedItems: [], grantChoiceSets: [] };

  const wizard = createPlannerChoiceWizard(planner);
  const grantedItems = [];
  const grantChoiceSets = [];
  const seenGranted = new Set();

  await collectGrantPreviewEntries({
    item: source,
    planner,
    wizard,
    storedChoices: feat.choices ?? {},
    grantedItems,
    grantChoiceSets,
    seenGranted,
    includeChoiceSets: false,
    preselectedChoiceFlags: new Set(),
  });

  return {
    grantedItems,
    grantChoiceSets,
  };
}

async function collectGrantPreviewEntries({
  item,
  planner,
  wizard,
  storedChoices,
  grantedItems,
  grantChoiceSets,
  seenGranted,
  includeChoiceSets = true,
  preselectedChoiceFlags = new Set(),
}) {
  if (!item) return;

  if (includeChoiceSets) {
    const parsedChoiceSets = (await parseChoiceSets(wizard, item.system?.rules ?? [], storedChoices, item))
      .filter((choiceSet) => !isPlannerManagedSyntheticGrantChoice(choiceSet));
    const fallbackChoiceSets = hasSkillFallbackText(item?.system?.description?.value ?? '')
      && !parsedChoiceSets.some((choiceSet) => choiceSet?.syntheticType === 'skill-training-fallback')
      ? await buildPlannerGrantSkillFallbackChoiceSets(planner, item, storedChoices)
      : [];
    const dedicationChoiceSets = parsedChoiceSets.length === 0
      ? await buildPlannerGrantDedicationChoiceSetFallbacks(planner, item, storedChoices)
      : [];
    const authoredOrFallbackChoiceSets = [...parsedChoiceSets, ...dedicationChoiceSets];
    const specialChoiceSets = await buildPlannerSpecialChoiceSets(
      planner,
      buildGrantPreviewFeatState(item, storedChoices),
      item,
      authoredOrFallbackChoiceSets,
    );
    const choiceSets = dedupePlannerChoiceSets([...parsedChoiceSets, ...fallbackChoiceSets, ...dedicationChoiceSets, ...specialChoiceSets])
      .filter((choiceSet) => !isPlannerChoiceSetSatisfied(choiceSet, storedChoices, preselectedChoiceFlags));
    for (const choiceSet of choiceSets) {
      if (grantChoiceSets.some((entry) => getChoiceSetSignature(entry) === getChoiceSetSignature(choiceSet))) continue;
      const choiceType = choiceSet.options.every((option) => isActiveSkillSlug(option.value)) ? 'skill' : 'item';
      grantChoiceSets.push(decoratePlannerChoiceSetForRender(planner, {
        ...choiceSet,
        choiceType,
        sourceName: item.name,
      }, { choices: storedChoices }));
    }
  }

  for (const rule of item.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
    if (!matchesGrantPredicate(rule, planner, wizard)) continue;
    const preselectedChoices = extractGrantPreselectedChoices(rule);
    const ruleChoices = {
      ...(storedChoices ?? {}),
      ...preselectedChoices,
    };
    const resolvedUuid = resolveGrantRuleUuid(rule.uuid, ruleChoices);
    if (!resolvedUuid) continue;
    const granted = await fromUuid(resolvedUuid).catch(() => null);
    if (!granted) continue;

    const dedupeKeys = getGrantedItemPreviewDedupeKeys(granted);
    if (!dedupeKeys.some((key) => seenGranted.has(key))) {
      for (const key of dedupeKeys) seenGranted.add(key);
      grantedItems.push(buildGrantedItemPreviewEntry(granted, item.name));
    }

    await collectGrantPreviewEntries({
      item: granted,
      planner,
      wizard,
      storedChoices: ruleChoices,
      grantedItems,
      grantChoiceSets,
      seenGranted,
      includeChoiceSets: true,
      preselectedChoiceFlags: new Set(Object.keys(preselectedChoices)),
    });
  }
}

function buildGrantPreviewFeatState(item, choices = {}) {
  return {
    uuid: item?.uuid ?? null,
    slug: item?.slug ?? item?.system?.slug ?? null,
    name: item?.name ?? null,
    img: item?.img ?? null,
    traits: getItemTraitValues(item),
    system: item?.system ?? null,
    choices: { ...(choices ?? {}) },
  };
}

function buildGrantedItemPreviewEntry(item, sourceName) {
  return {
    uuid: item.uuid,
    name: item.name,
    img: item.img ?? null,
    type: item.type ?? null,
    slug: item.slug ?? item.system?.slug ?? null,
    traits: getItemTraitValues(item),
    sourceName,
  };
}

function getGrantedItemPreviewDedupeKeys(item) {
  const keys = [];
  const uuid = normalizePf2eCompendiumUuid(item?.uuid);
  const slug = String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase();
  const name = String(item?.name ?? '').trim().toLowerCase();

  if (uuid) keys.push(`uuid:${uuid}`);
  if (slug) keys.push(`slug:${slug}`);
  if (name) keys.push(`name:${name}`);

  return keys.length > 0 ? keys : [`fallback:${item?.uuid ?? item?.name ?? ''}`];
}

function getItemTraitValues(item) {
  const traits = Array.isArray(item?.traits) ? item.traits : item?.system?.traits?.value;
  if (!Array.isArray(traits)) return [];
  return traits.map((trait) => String(trait).trim()).filter(Boolean);
}

function isPlannerManagedSyntheticGrantChoice(choiceSet) {
  return ['formula-choice', 'spell-choice'].includes(choiceSet?.syntheticType);
}

function isPlannerChoiceSetSatisfied(choiceSet, choices = {}, preselectedChoiceFlags = new Set()) {
  const flag = choiceSet?.flag;
  if (typeof flag !== 'string' || flag.length === 0) return false;
  if (!preselectedChoiceFlags.has(flag)) return false;
  const value = choices?.[flag];
  return typeof value === 'string' && value.length > 0 && value !== '[object Object]';
}

function createPlannerChoiceWizard(planner) {
  const primaryClass = resolvePlannerPrimaryClass(planner);
  const buildState = buildPlannerChoiceBuildState(planner);
  const rollOptions = buildPlannerChoiceRollOptions(buildState);
  const wizard = {
    actor: planner.actor,
    _compendiumCache: planner._compendiumCache ?? (planner._compendiumCache = {}),
    rollOptions,
    data: {
      class: primaryClass,
      deity: planner.actor?.items?.find?.((item) => item.type === 'deity') ?? null,
      skills: collectPlannerSelectedSkills(planner),
      classFeatures: [...(buildState?.classFeatures ?? [])],
      feats: [...(buildState?.feats ?? [])],
      rollOptions,
    },
    _getCachedDocument: (uuid) => fromUuid(uuid).catch(() => null),
    _loadCompendium: async (key) => loadCompendium(wizard, key),
    _loadDeities: async () => loadDeities(planner),
    async _getClassTrainedSkills() {
      const classItem = planner.actor?.class;
      if (!classItem) return [];
      const rules = classItem.system?.rules ?? [];
      return rules
        .filter((rule) => rule.key === 'ActiveEffectLike' && typeof rule.path === 'string' && rule.path.startsWith('system.skills.') && rule.path.endsWith('.rank'))
        .map((rule) => rule.path.replace('system.skills.', '').replace('.rank', ''))
        .filter(Boolean);
    },
  };
  return wizard;
}

function buildPlannerChoiceBuildState(planner) {
  if (!planner?.plan) return null;
  try {
    return computeBuildState(planner.actor, planner.plan, planner.selectedLevel);
  } catch {
    return null;
  }
}

function buildPlannerChoiceRollOptions(buildState) {
  const options = new Set();
  for (const slug of buildState?.feats ?? []) {
    const normalized = normalizeRollOptionSlug(slug);
    if (normalized) options.add(`feat:${normalized}`);
  }
  for (const slug of buildState?.classFeatures ?? []) {
    const normalized = normalizeRollOptionSlug(slug);
    if (normalized) options.add(`feature:${normalized}`);
  }
  for (const entry of [buildState?.classSlug, buildState?.dualClassSlug]) {
    const normalized = normalizeRollOptionSlug(entry);
    if (normalized) options.add(`class:${normalized}`);
  }
  for (const classState of buildState?.classes ?? []) {
    const normalized = normalizeRollOptionSlug(classState?.slug);
    if (normalized) options.add(`class:${normalized}`);
  }
  return options;
}

function normalizeRollOptionSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function resolvePlannerPrimaryClass(planner) {
  const planSlug = String(planner?.plan?.classSlug ?? '').trim().toLowerCase();
  const actorClass = planner?.actor?.class ?? null;
  const actorSlug = String(actorClass?.slug ?? '').trim().toLowerCase();
  const slug = planSlug || actorSlug || null;
  if (!slug) return actorClass;

  const classDef = ClassRegistry.has(slug) ? ClassRegistry.get(slug) : null;
  return {
    ...(actorClass ?? {}),
    ...(classDef ?? {}),
    slug,
  };
}

function dedupePlannerChoiceSets(choiceSets) {
  const seen = new Set();
  const deduped = [];

  for (const entry of choiceSets ?? []) {
    const signature = getChoiceSetSignature(entry);
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(entry);
  }

  return deduped;
}

function mergePlannerChoiceSetsIntoFeat(feat, choiceSets) {
  if (!feat) return feat;
  return {
    ...feat,
    grantChoiceSets: dedupePlannerChoiceSets([...(feat.grantChoiceSets ?? []), ...(choiceSets ?? [])]),
  };
}

function stampGrantChoiceCategory(feat, category) {
  if (!feat || !Array.isArray(feat.grantChoiceSets)) return;
  feat.grantChoiceSets = feat.grantChoiceSets.map((choiceSet) => ({
    ...choiceSet,
    choiceCategory: category,
  }));
}

function getChoiceSetSignature(entry) {
  const flag = String(entry?.flag ?? '').trim().toLowerCase();
  const prompt = String(entry?.prompt ?? '').trim().toLowerCase();
  const options = (entry?.options ?? [])
    .map((option) => String(option?.uuid ?? option?.value ?? option?.label ?? '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
  return `${flag}::${prompt}::${options}`;
}

async function buildPlannerGrantSkillFallbackChoiceSets(planner, item, storedChoices) {
  const wizard = createPlannerChoiceWizard(planner);
  const rules = Array.isArray(item?.system?.rules) ? item.system.rules : [];
  const skillContext = await buildPlannerChoiceSetSkillContext(planner);
  const trainedSkills = new Set(
    (skillContext ?? [])
      .filter((entry) => entry?.selected || entry?.autoTrained)
      .map((entry) => entry.slug),
  );
  const grantedSkills = await extractGrantedTrainedSkills(wizard, rules, storedChoices, item);
  const overlaps = grantedSkills.filter((skill) => trainedSkills.has(skill));
  if (overlaps.length === 0) return [];

  return overlaps.map((skill, index) => ({
    flag: `levelerSkillFallback${index + 1}`,
    prompt: 'Select a skill.',
    options: skillContext
      .filter((entry) => entry.slug !== skill)
      .filter((entry) => !grantedSkills.filter((value) => value !== skill).includes(entry.slug))
      .map((entry) => ({
        value: entry.slug,
        label: entry.label,
      })),
    syntheticType: 'skill-training-fallback',
    grantsSkillTraining: true,
    blockedSkills: grantedSkills.filter((value) => value !== skill),
    sourceName: item?.name ?? null,
  })).filter((entry) => entry.options.length > 0);
}

async function buildPlannerGrantDedicationChoiceSetFallbacks(planner, item, storedChoices) {
  const feat = {
    uuid: item?.uuid,
    slug: item?.slug ?? null,
    name: item?.name ?? null,
    traits: item?.system?.traits?.value ?? [],
    choices: storedChoices ?? {},
  };
  return buildPlannerDedicationChoiceSetFallbacks(planner, feat, item);
}

async function buildPlannerChoiceSetSkillContext(planner) {
  const actorSkills = planner.actor?.system?.skills ?? {};
  const selectedSkills = new Set();
  const autoTrainedSkills = new Set();

  for (const [slug, entry] of Object.entries(actorSkills)) {
    const rank = Number(entry?.rank ?? entry?.value ?? 0);
    if (rank >= 1) autoTrainedSkills.add(slug);
  }

  for (const level of Object.keys(planner.plan?.levels ?? {})) {
    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel > Number(planner.selectedLevel ?? 0)) continue;
    for (const skill of planner.plan?.levels?.[level]?.intBonusSkills ?? []) {
      if (isActiveSkillSlug(skill)) selectedSkills.add(normalizeSkillSlug(skill));
    }
  }

  return getActiveSkillSlugs().map((slug) => ({
    slug,
    label: localizeSkillSlug(slug),
    selected: selectedSkills.has(slug),
    autoTrained: autoTrainedSkills.has(slug),
  }));
}

function collectPlannerSelectedSkills(planner) {
  const selectedSkills = new Set();

  for (const level of Object.keys(planner.plan?.levels ?? {})) {
    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel > Number(planner.selectedLevel ?? 0)) continue;

    for (const skill of planner.plan?.levels?.[level]?.intBonusSkills ?? []) {
      if (isActiveSkillSlug(skill)) selectedSkills.add(normalizeSkillSlug(skill));
    }
  }

  return [...selectedSkills];
}

function decoratePlannerSkillChoiceOptions(planner, entry, feat, options) {
  const selected = normalizeSkillSlug(feat?.choices?.[entry?.flag]);
  const priorState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const selectedIntSkills = new Set(collectPlannerSelectedSkills(planner));
  const selectedElsewhere = new Set(
    Object.entries(feat?.choices ?? {})
      .filter(([flag, value]) => flag !== entry?.flag && typeof value === 'string' && value !== '[object Object]')
      .map(([, value]) => normalizeSkillSlug(value)),
  );
  const blockedSkills = new Set((entry?.blockedSkills ?? []).map((skill) => normalizeSkillSlug(skill)));

  const decorated = options.map((option) => {
    const value = normalizeSkillSlug(option?.value);
    const selectedHere = value === selected;
    const trainedBeforeLevel = (priorState.skills?.[value] ?? 0) >= 1;
    const selectedByIntBonus = selectedIntSkills.has(value);
    const blocksTrainedSkill = entry?.allowTrainedSkillSelection !== true;
    const disabled = !selectedHere
      && ((blocksTrainedSkill && trainedBeforeLevel) || selectedByIntBonus || selectedElsewhere.has(value) || blockedSkills.has(value));

    return {
      ...option,
      disabled,
    };
  });

  if (entry?.widenWhenAllOptionsBlocked !== true || decorated.some((option) => option.disabled !== true)) {
    return decorated;
  }

  return buildPlannerSkillChoiceReplacementOptions({
    priorState,
    selected,
    selectedIntSkills,
    selectedElsewhere,
    blockedSkills,
  });
}

function buildPlannerSkillChoiceReplacementOptions({
  priorState,
  selected,
  selectedIntSkills,
  selectedElsewhere,
  blockedSkills,
}) {
  return getActiveSkillSlugs().map((slug) => {
    const selectedHere = slug === selected;
    const trainedBeforeLevel = (priorState.skills?.[slug] ?? 0) >= 1;
    const disabled = !selectedHere
      && (trainedBeforeLevel || selectedIntSkills.has(slug) || selectedElsewhere.has(slug) || blockedSkills.has(slug));

    return {
      value: slug,
      label: localizeSkillSlug(slug),
      selected: selectedHere,
      disabled,
    };
  }).filter((entry) => !entry.disabled || entry.selected);
}

function extractGrantPreselectedChoices(rule) {
  const rawChoices = rule?.preselectChoices ?? rule?.preselectChoice;
  if (!rawChoices || typeof rawChoices !== 'object') return {};
  return Object.fromEntries(
    Object.entries(rawChoices)
      .filter(([, value]) => ['string', 'number'].includes(typeof value))
      .map(([flag, value]) => [flag, String(value)]),
  );
}

function resolveGrantRuleUuid(uuid, choices) {
  const raw = String(uuid ?? '').trim();
  if (!raw) return null;
  if (!raw.includes('{item|flags.')) return raw;

  const resolved = raw.replace(/\{item\|flags\.(?:pf2e|system)\.rulesSelections\.([^}]+)\}/g, (_match, flag) => {
    const value = choices?.[flag];
    return typeof value === 'string' ? value : '';
  });

  return resolved.includes('{item|') ? null : resolved;
}

async function buildPlannerSkillFallbackChoiceSets(planner, feat, source) {
  const grantedSkills = await getGrantedPlannerSkillSlugs(planner, feat, source);
  if (grantedSkills.length === 0) return [];

  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const overlaps = grantedSkills.filter((skill) => (buildState.skills?.[skill] ?? 0) >= 1);
  if (overlaps.length === 0) return [];

  return overlaps.map((skill, index) => {
    const flag = `levelerSkillFallback${index + 1}`;
    return {
      flag,
      prompt: 'Select a skill.',
      choiceType: 'skill',
      grantsSkillTraining: true,
      options: buildPlannerSkillFallbackOptions(planner, feat, flag, grantedSkills.filter((entry) => entry !== skill)),
    };
  });
}

function buildPlannerSkillFallbackOptions(planner, feat, flag, blockedSkills, fallbackFlagPattern = /^levelerSkillFallback\d+$/i) {
  const selected = normalizeSkillSlug(feat?.choices?.[flag]);
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const selectedElsewhere = new Set(
    Object.entries(feat?.choices ?? {})
      .filter(([entryFlag, value]) => fallbackFlagPattern.test(entryFlag) && entryFlag !== flag && typeof value === 'string')
      .map(([, value]) => normalizeSkillSlug(value)),
  );
  const blocked = new Set(blockedSkills.map((skill) => normalizeSkillSlug(skill)));

  return getActiveSkillSlugs().map((slug) => {
    const selectedHere = slug === selected;
    const trained = (buildState.skills?.[slug] ?? 0) >= 1;
    const disabled = !selectedHere && (trained || blocked.has(slug) || selectedElsewhere.has(slug));
    return {
      value: slug,
      label: localizeSkillSlug(slug),
      selected: selectedHere,
      disabled,
    };
  }).filter((entry) => !entry.disabled || entry.selected);
}

async function getGrantedPlannerSkillSlugs(planner, feat, source) {
  const skills = new Set(
    [...(feat?.skillRules ?? []), ...(feat?.dynamicSkillRules ?? [])]
      .map((rule) => rule?.skill)
      .map((skill) => normalizeSkillSlug(skill))
      .filter((skill) => isActiveSkillSlug(skill)),
  );
  const scannedUuids = new Set();

  const collectFromItem = async (item) => {
    const itemUuid = item?.uuid ?? null;
    if (itemUuid && scannedUuids.has(itemUuid)) return;
    if (itemUuid) scannedUuids.add(itemUuid);

    for (const rule of item?.system?.rules ?? []) {
      if (rule?.key !== 'ActiveEffectLike') continue;
      const match = String(rule?.path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
      if (!match) continue;
      if (Number(rule?.value) < 1) continue;
      const skill = normalizeSkillSlug(match[1]);
      if (!isActiveSkillSlug(skill)) continue;
      skills.add(skill);
    }

    for (const skill of extractExplicitTrainedSkillsFromDescription(item?.system?.description?.value ?? '')) {
      skills.add(skill);
    }

    for (const selectedValue of Object.values(feat?.choices ?? {})) {
      if (typeof selectedValue !== 'string' || !selectedValue.startsWith('Compendium.')) continue;
      const selectedItem = await fromUuid(selectedValue).catch(() => null);
      if (selectedItem) await collectFromItem(selectedItem);
    }

    for (const rule of item?.system?.rules ?? []) {
      if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
      if (!matchesGrantPredicate(rule, planner)) continue;
      const grantedUuid = resolveGrantRuleUuid(rule.uuid, feat?.choices ?? {});
      if (!grantedUuid) continue;
      const grantedItem = await fromUuid(grantedUuid).catch(() => null);
      if (grantedItem) await collectFromItem(grantedItem);
    }
  };

  await collectFromItem(source);

  if (sourceHasDeityAssociatedSkill(source)) {
    const deityUuid = feat?.choices?.deity ?? null;
    const deitySkill = await resolvePlannerDeitySkill(planner, deityUuid);
    syncFeatDynamicSkillRules(feat, true, deitySkill);
    const normalizedDeitySkill = normalizeSkillSlug(deitySkill);
    if (isActiveSkillSlug(normalizedDeitySkill)) skills.add(normalizedDeitySkill);
  }

  return [...skills];
}

function extractExplicitTrainedSkillsFromDescription(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return [];

  const matches = description.match(/\b(?:you\s+)?(?:become|are)\s+trained\s+in\s+([^.!?]+)/gu) ?? [];
  const orderSkillMatches = description.match(/\b(?:order|school|patron|practice|muse|mystery|instinct|style|deity'?s?\s+associated)\s+skill\s+([^.!?]+)/gu) ?? [];
  if (matches.length === 0 && orderSkillMatches.length === 0) return [];

  const skills = new Set();
  for (const clause of [...matches, ...orderSkillMatches]) {
    if (clauseDescribesSelectedSkillChoice(clause)) continue;
    for (const skill of getActiveSkillSlugs()) {
      const label = localizeSkillSlug(skill).toLowerCase();
      if (clause.includes(label)) skills.add(skill);
    }
  }

  return [...skills];
}

function clauseDescribesSelectedSkillChoice(clause) {
  const normalized = String(clause ?? '').toLowerCase();
  return /\b(?:your\s+choice\s+of|choice\s+of|chosen\s+skill|skill\s+you\s+chose)\b/u.test(normalized);
}

function matchesGrantPredicate(rule, planner, wizard = null) {
  if (!rule?.predicate) return true;
  const actorLevel = planner?.selectedLevel ?? planner?.actor?.system?.details?.level?.value ?? 1;
  const rollOptions = wizard?.rollOptions ?? buildPlannerChoiceRollOptions(buildPlannerChoiceBuildState(planner));
  return evaluatePredicate(rule.predicate, actorLevel, rollOptions);
}

async function resolvePlannerDeitySkill(planner, deityUuid) {
  if (typeof deityUuid !== 'string' || deityUuid.length === 0) return null;
  const deities = await loadDeities(planner);
  return normalizeSkillSlug(deities.find((entry) => entry.uuid === deityUuid)?.skill);
}

function sourceHasDeityAssociatedSkill(entry) {
  const description = String(entry?.system?.description?.value ?? entry?.description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return /\byour deity'?s associated skill\b/.test(description);
}

async function buildPlannerDedicationChoiceSetFallbacks(planner, feat, source) {
  const rules = Array.isArray(source?.system?.rules) ? source.system.rules : [];
  const choiceRules = rules.filter((rule) => rule?.key === 'ChoiceSet' && rule?.choices && typeof rule.choices === 'object');
  if (choiceRules.length === 0) return [];

  const archetypeSlug = getPlannerDedicationArchetypeSlug(feat, source);
  const subclassTag = SUBCLASS_TAGS[archetypeSlug] ?? archetypeSlug;
  if (!subclassTag) return [];

  const wizard = createPlannerChoiceWizard(planner);
  const classFeatures = await loadCompendiumCategory(wizard, 'classFeatures');
  const feats = await loadCompendiumCategory(wizard, 'feats');
  const candidates = [...classFeatures, ...feats];

  return choiceRules
    .filter((rule) => serializeChoiceSetFilter(rule?.choices?.filter).includes(`item:tag:${subclassTag}`))
    .map((rule) => {
      const filters = rule?.choices?.filter ?? [];
      const excludeClassArchetype = serializeChoiceSetFilter(filters).includes('item:tag:class-archetype');
      const options = candidates
        .filter((entry) => matchesTagFamily(entry?.otherTags ?? [], subclassTag))
        .filter((entry) => !excludeClassArchetype || !matchesTagFamily(entry?.otherTags ?? [], 'class-archetype'))
        .map((entry) => ({
          value: entry.uuid ?? entry.slug,
          label: entry.name,
          uuid: entry.uuid ?? null,
          img: entry.img ?? null,
          traits: entry.traits ?? [],
          rarity: entry.rarity ?? 'common',
          type: entry.type ?? null,
          category: entry.category ?? null,
          range: entry.range ?? null,
          isRanged: !!entry.isRanged,
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));

      if (options.length === 0) return null;

      const prompt = String(rule?.prompt ?? '').trim();
      return {
        flag: String(rule?.flag ?? ''),
        prompt: game.i18n?.has?.(prompt) ? game.i18n.localize(prompt) : prompt,
        options,
      };
    })
    .filter((entry) => entry?.flag && entry.options.length > 0);
}

function serializeChoiceSetFilter(filter) {
  return String(JSON.stringify(filter ?? []) ?? '').toLowerCase();
}

function getPlannerDedicationArchetypeSlug(feat, source) {
  const genericTraits = new Set(['archetype', 'dedication', 'class', 'multiclass', 'general', 'skill', 'mythic']);
  const traits = [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(source?.system?.traits?.value ?? []),
    ...(feat?.system?.traits?.value ?? []),
  ]
    .map((trait) => String(trait).toLowerCase())
    .filter((trait) => trait && !genericTraits.has(trait));

  if (traits.length > 0) return traits[0];

  const slug = String(feat?.slug ?? source?.slug ?? '').toLowerCase();
  if (slug.endsWith('-dedication')) return slug.replace(/-dedication$/u, '');
  return '';
}

function matchesTagFamily(tags, expected) {
  const normalizedExpected = String(expected ?? '').toLowerCase();
  return (tags ?? []).some((tag) => {
    const normalizedTag = String(tag ?? '').toLowerCase();
    return normalizedTag === normalizedExpected || normalizedTag.startsWith(`${normalizedExpected}-`);
  });
}

function hasSkillFallbackText(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return false;
  if (description.includes('skill of your choice') && description.includes('already trained')) return true;

  return [
    /if you would automatically become trained in [^.]+?,?\s+you instead become trained in a skill of your choice\.?/,
    /if you would automatically become trained in one of those skills(?:\s*\([^)]*\))?,?\s+you instead become trained in a skill of your choice\.?/,
    /for each of (?:these|those) skills in which you were already trained,?\s+you instead become trained in a skill of your choice\.?/,
    /if you were already trained in both,?\s+you become trained in a skill of your choice\.?/,
  ].some((pattern) => pattern.test(description));
}

function syncFeatDynamicSkillRules(feat, shouldAdd, deitySkill) {
  if (!feat) return;
  const otherRules = (feat.dynamicSkillRules ?? []).filter((rule) => rule?.source !== 'deity-associated-skill');
  const skill = normalizeSkillSlug(deitySkill);
  if (shouldAdd && isActiveSkillSlug(skill)) {
    otherRules.push({ skill, value: 1, source: 'deity-associated-skill' });
  }
  feat.dynamicSkillRules = otherRules;
}

function syncPlannerChoiceSetSkillRules(feat, choiceSets) {
  if (!feat) return;

  const managedSkillChoiceSources = new Set(
    (choiceSets ?? [])
      .filter((choiceSet) => choiceSet?.grantsSkillTraining === true)
      .map((choiceSet) => `choice:${String(choiceSet?.flag ?? '').toLowerCase()}`),
  );
  const preservedRules = Array.isArray(feat.dynamicSkillRules)
    ? feat.dynamicSkillRules.filter((rule) => !managedSkillChoiceSources.has(String(rule?.source ?? '')))
    : [];
  const preservedLoreRules = Array.isArray(feat.dynamicLoreRules)
    ? feat.dynamicLoreRules.filter((rule) => !managedSkillChoiceSources.has(String(rule?.source ?? '')))
    : [];
  const choiceRules = [];
  const loreRules = [];

  for (const choiceSet of choiceSets ?? []) {
    if (choiceSet?.grantsSkillTraining !== true) continue;
    const sourceKey = `choice:${String(choiceSet?.flag ?? '').toLowerCase()}`;
    const selectedSkill = normalizePlannerSkillChoice(feat?.choices?.[choiceSet?.flag]);
    if (selectedSkill) {
      const rule = { skill: selectedSkill, value: 1, source: sourceKey };
      const rawValueIfAlreadyTrained = choiceSet?.valueIfAlreadyTrained;
      const valueIfAlreadyTrained = rawValueIfAlreadyTrained == null || rawValueIfAlreadyTrained === ''
        ? null
        : Number(rawValueIfAlreadyTrained);
      if (Number.isFinite(valueIfAlreadyTrained)) rule.valueIfAlreadyTrained = valueIfAlreadyTrained;
      choiceRules.push(rule);
      continue;
    }
    const selectedLore = normalizePlannerLoreChoice(feat?.choices?.[choiceSet?.flag]);
    if (selectedLore) loreRules.push({ skill: selectedLore, value: 1, source: sourceKey });
  }

  feat.dynamicSkillRules = [...preservedRules, ...choiceRules];
  feat.dynamicLoreRules = [...preservedLoreRules, ...loreRules];
}

function normalizePlannerSkillChoice(value) {
  const candidate = normalizeSkillSlug(value);
  return isActiveSkillSlug(candidate) ? candidate : null;
}

function normalizePlannerLoreChoice(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || isActiveSkillSlug(normalized)) return null;
  return normalized.includes('lore') ? normalized : null;
}

function localizeSkillSlug(slug) {
  if (!isActiveSkillSlug(slug)) return humanizeSkillLikeLabel(slug);
  const raw = getActiveSkillConfigEntry(slug);
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : humanizeSkillLikeLabel(slug);
}
