import { PROFICIENCY_RANK_NAMES, SKILLS } from '../../constants.js';
import { getChoicesForLevel } from '../../classes/progression.js';
import { getLevelData } from '../../plan/plan-model.js';
import { computeBuildState } from '../../plan/build-state.js';
import { loadCompendiumCategory, loadDeities } from '../character-wizard/loaders.js';

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
  const generalFeat = annotateFeat(extractFeat(levelData.generalFeats));
  const ancestryFeat = annotateFeat(extractFeat(levelData.ancestryFeats));
  const generalFeatGrantsAncestryFeat = isAncestralParagonFeat(generalFeat);
  const generalFeatIsAdoptedAncestry = isAdoptedAncestryFeat(generalFeat);
  const adoptedAncestryOptions = generalFeatIsAdoptedAncestry
    ? await buildAdoptedAncestryOptions(planner, generalFeat)
    : [];
  const classFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, extractFeat(levelData.classFeats));
  const generalFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, generalFeat);
  const ancestryFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, ancestryFeat);
  const archetypeFeat = extractFeat(levelData.archetypeFeats);
  const archetypeFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, archetypeFeat);
  const customFeats = await buildCustomPlannerFeatEntries(planner, levelData.customFeats ?? []);
  const customSkillIncreaseGroups = buildCustomSkillIncreaseGroups(levelData.customSkillIncreases ?? []);
  const customAvailableSkills = buildCustomAvailableSkills(planner, levelData, level);
  const customSpellGroups = buildCustomSpellGroups(levelData.customSpells ?? []);

  return {
    classFeatures: getClassFeaturesForLevel(planner, level),
    showBoosts: choiceTypes.has('abilityBoosts'),
    boostCount: choices.find((choice) => choice.type === 'abilityBoosts')?.count ?? 4,
    attributes: planner._buildAttributeContext(levelData, choices),
    intelligenceBenefit: planner._buildIntelligenceBenefitContext(level),
    intBonusSkillOptions: planner._buildIntBonusSkillContext(levelData, level),
    intBonusLanguageOptions: planner._buildIntBonusLanguageContext(levelData, level),
    intBonusSkillCount: levelData.intBonusSkills?.length ?? 0,
    intBonusLanguageCount: levelData.intBonusLanguages?.length ?? 0,
    showClassFeat: choiceTypes.has('classFeat'),
    classFeat: annotateFeat(extractFeat(levelData.classFeats)),
    classFeatChoiceSets,
    showSkillFeat: choiceTypes.has('skillFeat'),
    skillFeat: annotateFeat(extractFeat(levelData.skillFeats)),
    showGeneralFeat: choiceTypes.has('generalFeat'),
    generalFeat,
    generalFeatChoiceSets,
    showGeneralFeatAdoptedAncestry: generalFeatIsAdoptedAncestry,
    generalFeatAdoptedAncestryOptions: adoptedAncestryOptions,
    selectedGeneralFeatAdoptedAncestry: generalFeat?.choices?.adoptedAncestry ?? generalFeat?.adoptedAncestry ?? '',
    showAncestryFeat: choiceTypes.has('ancestryFeat') && !generalFeatGrantsAncestryFeat,
    ancestryFeat,
    ancestryFeatChoiceSets,
    showGeneralFeatGrantedAncestryFeat: generalFeatGrantsAncestryFeat,
    generalFeatGrantedAncestryFeat: ancestryFeat,
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
    customSpellGroups,
    ...buildABPContext(level, options),
    ...(await planner._buildSpellContext(classDef, level)),
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
  if (!classItem?.system?.items) return [];

  return Object.values(classItem.system.items)
    .filter((feature) => feature.level === level)
    .map((feature) => ({ name: feature.name, uuid: feature.uuid, img: feature.img }));
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
    const feat = annotateFeat(feats[index]);
    entries.push({
      index,
      feat,
      choiceSets: await buildPlannerFeatChoiceSets(planner, feat),
    });
  }
  return entries;
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
  const currentSkills = computeBuildState(planner.actor, planner.plan, level).skills ?? {};
  const maxRank = level >= 15 ? 4 : level >= 7 ? 3 : 2;
  const currentIncrease = levelData?.skillIncreases?.[0];

  return SKILLS.map((slug) => {
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
}

function buildCustomSpellGroups(customSpells) {
  const entries = customSpells.map((spell, index) => ({
    ...spell,
    index,
    displayRank: spell.isCantrip ? 'Cantrip' : `Rank ${resolveSpellDisplayRank(spell)}`,
  }));

  return groupEntriesBy(entries, (entry) => entry.displayRank, (displayRank) => ({
    label: displayRank,
    sort: /^Rank\s+(\d+)$/i.test(displayRank) ? Number(displayRank.match(/^Rank\s+(\d+)$/i)?.[1] ?? 0) : -1,
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

  const source = await fromUuid(feat.uuid).catch(() => null);
  const rules = source?.system?.rules ?? [];
  if (!Array.isArray(rules) || rules.length === 0) return [];

  const choiceSets = [];
  for (const rule of rules) {
    if (rule?.key !== 'ChoiceSet' || !isDeityChoiceRule(rule)) continue;
    const flag = getChoiceSetFlag(rule);
    if (!flag) continue;
    choiceSets.push({
      flag,
      prompt: localizeRulePrompt(rule),
      choiceType: 'item',
      options: await buildDeityChoiceOptions(planner, feat, flag),
    });
  }

  if (hasSkillFallbackText(source?.system?.description?.value ?? '')) {
    const fallbackSets = await buildPlannerSkillFallbackChoiceSets(planner, feat, source);
    choiceSets.push(...fallbackSets);
  }

  return choiceSets.filter((entry) => entry.options.length > 0);
}

async function buildDeityChoiceOptions(planner, feat, flag) {
  const selected = String(feat?.choices?.[flag] ?? '');
  const deities = await loadDeities(planner);
  return deities.map((item) => ({
    value: item.uuid,
    label: item.name,
    img: item.img ?? null,
    selected: item.uuid === selected,
  }));
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

function isDeityChoiceRule(rule) {
  const prompt = localizeRulePrompt(rule).trim().toLowerCase();
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();
  return String(rule?.flag ?? '').toLowerCase() === 'deity'
    || filterText.includes('item:type:deity')
    || filterText.includes('item:category:deity')
    || prompt === 'select a deity.'
    || prompt === 'select a deity';
}

function localizeRulePrompt(rule) {
  const prompt = String(rule?.prompt ?? '');
  return game.i18n?.has?.(prompt) ? game.i18n.localize(prompt) : prompt;
}

function getChoiceSetFlag(rule) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return null;
}

async function getGrantedPlannerSkillSlugs(planner, feat, source) {
  const skills = new Set(
    [...(feat?.skillRules ?? []), ...(feat?.dynamicSkillRules ?? [])]
      .map((rule) => rule?.skill)
      .filter((skill) => SKILLS.includes(skill)),
  );

  if (sourceHasDeityAssociatedSkill(source)) {
    const deityUuid = feat?.choices?.deity ?? null;
    const deitySkill = await resolvePlannerDeitySkill(planner, deityUuid);
    syncFeatDynamicSkillRules(feat, true, deitySkill);
    if (SKILLS.includes(deitySkill)) skills.add(deitySkill);
  }

  return [...skills];
}

async function resolvePlannerDeitySkill(planner, deityUuid) {
  if (typeof deityUuid !== 'string' || deityUuid.length === 0) return null;
  const deities = await loadDeities(planner);
  return deities.find((entry) => entry.uuid === deityUuid)?.skill ?? null;
}

function sourceHasDeityAssociatedSkill(entry) {
  const description = String(entry?.system?.description?.value ?? entry?.description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return /\byour deity'?s associated skill\b/.test(description);
}

function hasSkillFallbackText(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return false;

  return [
    /if you would automatically become trained in one of those skills(?:\s*\([^)]*\))?,?\s+you instead become trained in a skill of your choice\.?/,
    /for each of these skills in which you were already trained,?\s+you instead become trained in a skill of your choice\.?/,
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

function localizeSkillSlug(slug) {
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
}
