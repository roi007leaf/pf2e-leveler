import { ATTRIBUTES, PROFICIENCY_RANK_NAMES, SKILLS } from '../../constants.js';
import { getGradualBoostGroupLevels } from '../../classes/progression.js';
import { applyActorSkillRankRules, computeBuildState } from '../../plan/build-state.js';
import { getMaxSkillRank } from '../../utils/pf2e-api.js';

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
    const isPartial = mod >= 4;
    const selected = selectedBoosts.includes(key);
    const newMod = selected ? (alreadyAppliedLevel ? mod : mod + 1) : mod;
    return {
      key,
      label: key.toUpperCase(),
      mod,
      newMod,
      selected,
      applied: selected && alreadyAppliedLevel,
      partial: isPartial,
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
  return allLanguages.map((entry) => ({
    ...entry,
    selected: selected.has(entry.slug),
    disabled: current.has(entry.slug) && !selected.has(entry.slug),
  })).filter((entry) => !entry.disabled || entry.selected);
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
  const configLangs = globalThis.CONFIG?.PF2E?.languages;
  if (Array.isArray(configLangs)) {
    return configLangs.map((slug) => ({
      slug,
      label: localizeLanguageLabel(slug),
    }));
  }

  return Object.entries(configLangs ?? {})
    .map(([slug, label]) => ({
      slug,
      label: localizeLanguageLabel(typeof label === 'string' ? label : slug),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function localizeLanguageLabel(label) {
  if (typeof label !== 'string' || label.length === 0) return '';
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
}

export function buildSkillContext(planner, levelData, level) {
  const maxRank = getMaxSkillRank(level);
  const buildState = computeBuildState(planner.actor, planner.plan, level - 1);
  applyActorSkillRankRules(buildState.skills, planner.actor, level);
  for (const skill of levelData.intBonusSkills ?? []) {
    buildState.skills[skill] = Math.max(buildState.skills[skill] ?? 0, 1);
  }
  const currentIncrease = levelData.skillIncreases?.[0];

  const skills = Object.entries(buildState.skills).map(([slug, rank]) => {
    const nextRank = rank + 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      rank,
      rankName: PROFICIENCY_RANK_NAMES[rank],
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      maxed: nextRank > maxRank,
      selected: currentIncrease?.skill === slug,
    };
  });

  return skills.filter((s) => !s.maxed || s.selected);
}

function localizeSkillSlug(slug) {
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
}
