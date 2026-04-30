import { PROFICIENCY_RANK_NAMES, SKILLS, SUBCLASS_TAGS, WEALTH_MODES, CHARACTER_WEALTH, expandPermanentItemSlots, MODULE_ID } from '../../constants.js';
import { getChoicesForLevel } from '../../classes/progression.js';
import { ClassRegistry } from '../../classes/registry.js';
import { getLevelData } from '../../plan/plan-model.js';
import {
  buildFeatGrantRequirements,
  buildPlanFormulaProgressionRequirements,
  getFeatGrantCompletion,
  getFeatGrantSelections,
} from '../../plan/feat-grants.js';
import { computeBuildState } from '../../plan/build-state.js';
import { isCantripExpansionFeat } from '../../plan/spellbook-feats.js';
import { loadCompendium, loadCompendiumCategory, loadDeities, loadTaggedClassFeatures } from '../character-wizard/loaders.js';
import { extractGrantedTrainedSkills, normalizePf2eCompendiumUuid, parseChoiceSets } from '../character-wizard/choice-sets.js';
import { humanizeSkillLikeLabel, normalizeLoreSkillName, slugifyLoreSkillName } from '../character-wizard/skills-languages.js';
import { annotateGuidanceBySlug, filterDisallowedForCurrentUser } from '../../access/content-guidance.js';
import { extractFeatSkillRules } from './index.js';
import { getAvailableLanguages } from './context.js';
import { buildCustomSpellEntryOptions } from './spells.js';
import { evaluatePredicate } from '../../utils/predicate.js';
import { normalizeSkillSlug } from '../../utils/skill-slugs.js';

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

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

  return {
    classFeatures: getClassFeaturesForLevel(planner, level),
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
    showSkillIncrease: choiceTypes.has('skillIncrease') && !planner._shouldHideHistoricalSkillIncrease(level),
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
    ...buildEquipmentContext(planner, level, levelData),
    ...buildABPContext(level, options),
    ...(await planner._buildSpellContext(classDef, level)),
  };
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
    features.push({ name: feature.name, uuid: feature.uuid, img: feature.img });
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
    features.push({ name: feature.name, uuid: feature.uuid ?? null, img: feature.img ?? null });
  }

  return features;
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

  const entries = SKILLS.map((slug) => {
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

  const specialChoiceSets = await buildPlannerSpecialChoiceSets(planner, feat, source, choiceSets);
  const combined = dedupePlannerChoiceSets([...choiceSets, ...dedicationFallbackSets, ...fallbackSets, ...specialChoiceSets]);
  syncPlannerChoiceSetSkillRules(feat, [...combined, ...(feat?.grantChoiceSets ?? [])]);

  return combined
    .map((entry) => decoratePlannerChoiceSetForRender(planner, entry, feat))
    .filter((entry) => entry.choiceType === 'lore' || entry.options.length > 0);
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

  const dedicationSubclassChoiceSet = await buildPlannerDedicationSubclassChoiceSet(planner, feat, source);
  if (dedicationSubclassChoiceSet) special.push(dedicationSubclassChoiceSet);

  return special;
}

function hasUsableChoiceSet(choiceSets, flag) {
  return (choiceSets ?? []).some((choiceSet) =>
    choiceSet?.flag === flag && (choiceSet?.options ?? []).length > 0);
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
  const match = String(description ?? '').match(/\b(?:choose|select)\s+(?:a|an|one|your)?\s*(school|bloodline|patron|order|doctrine|mystery|instinct|style|way|innovation|methodology|edge|study|mind|eidolon|racket)\b/u);
  const label = match?.[1] ? match[1].replace(/\b\w/gu, (char) => char.toUpperCase()) : 'Option';
  return `Select a ${label}.`;
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
    || options.every((option) => SKILLS.includes(String(option?.value ?? '').toLowerCase()));

  const hydratedOptions = entry?.grantsSkillTraining === true && isSkillChoiceSet
    ? decoratePlannerSkillChoiceOptions(planner, entry, feat, options)
    : options;

  if (!selectedValue || hydratedOptions.some((option) => option.selected)) return hydratedOptions;
  if (SKILLS.includes(selectedValue)) return hydratedOptions;

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
    ?? (entry.options.every((option) => SKILLS.includes(String(option.value ?? '').toLowerCase())) ? 'skill' : 'item');
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

  return {
    kind: 'feat',
    allowedUuids,
    category: inferChoiceSetFeatCategory(choiceSet, options),
    level: inferChoiceSetFeatLevel(options),
    title: choiceSet.prompt,
    selectedOption,
  };
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
    const choiceSets = dedupePlannerChoiceSets([...parsedChoiceSets, ...fallbackChoiceSets, ...dedicationChoiceSets])
      .filter((choiceSet) => !isPlannerChoiceSetSatisfied(choiceSet, storedChoices, preselectedChoiceFlags));
    for (const choiceSet of choiceSets) {
      if (grantChoiceSets.some((entry) => getChoiceSetSignature(entry) === getChoiceSetSignature(choiceSet))) continue;
      const choiceType = choiceSet.options.every((option) => SKILLS.includes(String(option.value ?? '').toLowerCase())) ? 'skill' : 'item';
      grantChoiceSets.push(decoratePlannerChoiceSetForRender(planner, {
        ...choiceSet,
        choiceType,
        sourceName: item.name,
      }, { choices: storedChoices }));
    }
  }

  for (const rule of item.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
    if (!matchesGrantPredicate(rule, planner)) continue;
    const preselectedChoices = extractGrantPreselectedChoices(rule);
    const ruleChoices = {
      ...(storedChoices ?? {}),
      ...preselectedChoices,
    };
    const resolvedUuid = resolveGrantRuleUuid(rule.uuid, ruleChoices);
    if (!resolvedUuid) continue;
    const granted = await fromUuid(resolvedUuid).catch(() => null);
    if (!granted) continue;

    const dedupeKey = `${item.uuid ?? item.name}->${granted.uuid}`;
    if (!seenGranted.has(dedupeKey)) {
      seenGranted.add(dedupeKey);
      grantedItems.push({
        uuid: granted.uuid,
        name: granted.name,
        img: granted.img ?? null,
        sourceName: item.name,
      });
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
  const wizard = {
    actor: planner.actor,
    _compendiumCache: planner._compendiumCache ?? (planner._compendiumCache = {}),
    data: {
      class: primaryClass,
      deity: planner.actor?.items?.find?.((item) => item.type === 'deity') ?? null,
      skills: collectPlannerSelectedSkills(planner),
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
      if (SKILLS.includes(skill)) selectedSkills.add(skill);
    }
  }

  return SKILLS.map((slug) => ({
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
      if (SKILLS.includes(skill)) selectedSkills.add(skill);
    }
  }

  return [...selectedSkills];
}

function decoratePlannerSkillChoiceOptions(planner, entry, feat, options) {
  const selected = String(feat?.choices?.[entry?.flag] ?? '').trim().toLowerCase();
  const priorState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const selectedIntSkills = new Set(collectPlannerSelectedSkills(planner));
  const selectedElsewhere = new Set(
    Object.entries(feat?.choices ?? {})
      .filter(([flag, value]) => flag !== entry?.flag && typeof value === 'string' && value !== '[object Object]')
      .map(([, value]) => String(value).trim().toLowerCase()),
  );
  const blockedSkills = new Set((entry?.blockedSkills ?? []).map((skill) => String(skill).trim().toLowerCase()));

  return options.map((option) => {
    const value = String(option?.value ?? '').trim().toLowerCase();
    const selectedHere = value === selected;
    const trainedBeforeLevel = (priorState.skills?.[value] ?? 0) >= 1;
    const selectedByIntBonus = selectedIntSkills.has(value);
    const disabled = !selectedHere
      && (trainedBeforeLevel || selectedByIntBonus || selectedElsewhere.has(value) || blockedSkills.has(value));

    return {
      ...option,
      disabled,
    };
  });
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

function buildPlannerSkillFallbackOptions(planner, feat, flag, blockedSkills) {
  const selected = String(feat?.choices?.[flag] ?? '');
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const selectedElsewhere = new Set(
    Object.entries(feat?.choices ?? {})
      .filter(([entryFlag, value]) => /^levelerSkillFallback\d+$/i.test(entryFlag) && entryFlag !== flag && typeof value === 'string')
      .map(([, value]) => value),
  );
  const blocked = new Set(blockedSkills);

  return SKILLS.map((slug) => {
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
      .filter((skill) => SKILLS.includes(skill)),
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
      if (!SKILLS.includes(match[1])) continue;
      skills.add(match[1]);
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
    if (SKILLS.includes(normalizedDeitySkill)) skills.add(normalizedDeitySkill);
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
    for (const skill of SKILLS) {
      const label = localizeSkillSlug(skill).toLowerCase();
      if (clause.includes(label)) skills.add(skill);
    }
  }

  return [...skills];
}

function matchesGrantPredicate(rule, planner) {
  if (!rule?.predicate) return true;
  const actorLevel = planner?.selectedLevel ?? planner?.actor?.system?.details?.level?.value ?? 1;
  return evaluatePredicate(rule.predicate, actorLevel);
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
  if (shouldAdd && SKILLS.includes(deitySkill)) {
    otherRules.push({ skill: deitySkill, value: 1, source: 'deity-associated-skill' });
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
      choiceRules.push({ skill: selectedSkill, value: 1, source: sourceKey });
      continue;
    }
    const selectedLore = normalizePlannerLoreChoice(feat?.choices?.[choiceSet?.flag]);
    if (selectedLore) loreRules.push({ skill: selectedLore, value: 1, source: sourceKey });
  }

  feat.dynamicSkillRules = [...preservedRules, ...choiceRules];
  feat.dynamicLoreRules = [...preservedLoreRules, ...loreRules];
}

function normalizePlannerSkillChoice(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;

  const aliases = {
    acr: 'acrobatics',
    arc: 'arcana',
    ath: 'athletics',
    cra: 'crafting',
    dec: 'deception',
    dip: 'diplomacy',
    itm: 'intimidation',
    med: 'medicine',
    nat: 'nature',
    occ: 'occultism',
    prf: 'performance',
    rel: 'religion',
    soc: 'society',
    ste: 'stealth',
    sur: 'survival',
    thi: 'thievery',
  };

  const candidate = aliases[normalized] ?? normalized;
  return SKILLS.includes(candidate) ? candidate : null;
}

function normalizePlannerLoreChoice(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || SKILLS.includes(normalized)) return null;
  return normalized.includes('lore') ? normalized : null;
}

function localizeSkillSlug(slug) {
  if (!SKILLS.includes(slug)) return humanizeSkillLikeLabel(slug);
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
}
