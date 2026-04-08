import { ATTRIBUTES, PROFICIENCY_RANK_NAMES, SKILLS } from '../../constants.js';
import { getGradualBoostGroupLevels } from '../../classes/progression.js';
import { computeBuildState, computeSkillPickerState } from '../../plan/build-state.js';
import { getMaxSkillRank } from '../../utils/pf2e-api.js';
import { ClassRegistry } from '../../classes/registry.js';
import { annotateGuidanceBySlug } from '../../access/content-guidance.js';
import { getLanguageRarityMap, getLanguageMap } from '../character-wizard/skills-languages.js';

export function buildAttributeContext(planner, levelData, choices) {
  const selectedBoosts = levelData.abilityBoosts ?? [];
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const maxBoosts = choices?.find((c) => c.type === 'abilityBoosts')?.count ?? 4;
  const boostsRemaining = maxBoosts - selectedBoosts.length;
  const variantOptions = planner._getVariantOptions?.() ?? {};
  const usedBoostsInSet = getUsedBoostsInSet(planner, planner.selectedLevel, variantOptions.gradualBoosts);
  const actorLevel = Number(planner.actor?.system?.details?.level?.value ?? 1);
  const alreadyAppliedLevel = planner.selectedLevel <= actorLevel;

  return ATTRIBUTES.map((key) => {
    const mod = buildState.attributes[key] ?? 0;
    const rawMod = buildState.rawAttributes?.[key] ?? mod;
    const isPartial = mod >= 4;
    const hasPendingPartial = rawMod % 1 !== 0;
    const selected = selectedBoosts.includes(key);
    const newMod = selected
      ? (alreadyAppliedLevel ? mod : mod + 1)
      : mod;
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
      completesPartial: isPartial && hasPendingPartial,
      partialLabel,
      cost: 1,
      disabled: !selected && (boostsRemaining <= 0 || usedBoostsInSet.has(key)),
    };
  });
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
  const before = computeBuildState(planner.actor, planner.plan, level - 1);
  const after = computeBuildState(planner.actor, planner.plan, level);
  const beforeInt = before.attributes.int ?? 0;
  const afterInt = after.attributes.int ?? 0;
  const gained = Math.max(0, afterInt - beforeInt);

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
  const buildState = computeBuildState(planner.actor, planner.plan, level - 1);

  return SKILLS.map((slug) => {
    const trained = (buildState.skills[slug] ?? 0) >= 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: selected.has(slug),
      disabled: trained && !selected.has(slug),
      trained,
    };
  }).filter((entry) => !entry.disabled || entry.selected);
}

export function buildIntBonusLanguageContext(planner, levelData, level) {
  const benefit = buildIntelligenceBenefitContext(planner, level);
  if (!benefit) return null;

  const selected = new Set(levelData.intBonusLanguages ?? []);
  const current = new Set(planner.actor.system?.details?.languages?.value ?? []);
  const priorPlanned = getPlannedLanguagesBeforeLevel(planner, level);
  for (const slug of priorPlanned) current.add(slug);

  const allLanguages = getAvailableLanguages();
  const entries = allLanguages.map((entry) => ({
    ...entry,
    selected: selected.has(entry.slug),
    disabled: current.has(entry.slug) && !selected.has(entry.slug),
  })).filter((entry) => !entry.disabled || entry.selected);

  return annotateGuidanceBySlug(entries, 'language');
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

  return Object.entries(langMap)
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
  const currentSkills = computeSkillPickerState(planner.actor, planner.plan, level, classDef, {
    includePlannedFeatRules: true,
    includeCurrentLevelSkillIncrease: false,
  });
  const baseSkills = computeSkillPickerState(planner.actor, planner.plan, level, classDef, {
    includePlannedFeatRules: false,
    includeCurrentLevelSkillIncrease: false,
  });
  const currentIncrease = levelData.skillIncreases?.[0];

  const skills = Object.entries(currentSkills).map(([slug, rank]) => {
    const nextRank = rank + 1;
    const featGranted = rank > (baseSkills[slug] ?? 0);
    const featSourceName = featGranted ? findSkillGrantingFeatName(planner.plan, slug, level) : null;
    return {
      slug,
      label: localizeSkillSlug(slug),
      rank,
      rankName: PROFICIENCY_RANK_NAMES[rank],
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      maxed: nextRank > maxRank,
      featGranted,
      featSourceName,
      disabled: !featGranted && nextRank > maxRank,
      lockedByFeat: featGranted,
      selected: currentIncrease?.skill === slug,
    };
  });

  return skills.filter((s) => !s.maxed || s.selected || s.featGranted);
}

function localizeSkillSlug(slug) {
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
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
