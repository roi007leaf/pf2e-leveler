import { getAllPlannedFeats } from '../plan/plan-model.js';
import { evaluateRuleNumericValue } from '../plan/build-state.js';
import { getFeatLoreRules, getFeatSkillRules } from '../utils/feat-skill-rules.js';
import { isActiveSkillSlug, normalizeSkillSlug } from '../utils/skill-slugs.js';
import { ClassRegistry } from '../classes/registry.js';
import { getAutomaticLoreProficiencies } from '../classes/progression.js';

export async function applySkillIncreases(actor, plan, level) {
  const levelData = plan.levels[level];
  const skillIncreases = [...(levelData?.skillIncreases ?? []), ...(levelData?.customSkillIncreases ?? [])];
  const intBonusSkills = levelData?.intBonusSkills ?? [];
  const featSkillRules = getPlannedFeatSkillRules(plan, level);
  const featLoreRules = getPlannedFeatLoreRules(plan, level);
  const classDefs = [plan.classSlug, plan.dualClassSlug]
    .filter(Boolean)
    .map((slug) => ClassRegistry.get(slug))
    .filter(Boolean);
  const automaticLoreIncreases = getAutomaticLoreProficiencies(classDefs, level, { exactLevel: true });
  if (skillIncreases.length === 0 && intBonusSkills.length === 0 && featSkillRules.length === 0 && featLoreRules.length === 0 && automaticLoreIncreases.length === 0) return [];

  const updates = {};
  const applied = [];
  const loreItemsToCreate = [];

  for (const inc of skillIncreases) {
    const skill = normalizeSkillSlug(inc?.skill);
    if (!skill) continue;
    if (skill.endsWith('-lore') || !isActiveSkillSlug(skill)) {
      loreItemsToCreate.push({ skill, toRank: inc.toRank, appliedEntry: inc });
      continue;
    }
    const toRank = Number(inc?.toRank);
    if (!Number.isFinite(toRank)) continue;
    const currentRank = getPendingSkillRank(actor, updates, skill);
    if (toRank > currentRank) {
      updates[`system.skills.${skill}.rank`] = toRank;
      applied.push(inc);
    }
  }

  for (const rawSkill of intBonusSkills) {
    const skill = normalizeSkillSlug(rawSkill);
    if (!skill) continue;
    if (skill.endsWith('-lore') || !isActiveSkillSlug(skill)) {
      loreItemsToCreate.push({ skill, toRank: 1, intBonus: true, appliedEntry: { skill, toRank: 1, intBonus: true } });
      continue;
    }
    const currentRank = actor.system?.skills?.[skill]?.rank ?? 0;
    if (currentRank < 1) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    applied.push({ skill, toRank: 1, intBonus: true });
  }

  for (const rule of featSkillRules) {
    const skill = normalizeSkillSlug(rule?.skill);
    if (!skill) continue;

    const currentRank = getPendingSkillRank(actor, updates, skill);
    const rawTargetRank = currentRank >= 1 && rule?.valueIfAlreadyTrained != null
      ? rule.valueIfAlreadyTrained
      : rule?.value;
    const toRank = evaluateRuleNumericValue(rawTargetRank ?? 1, level, rule);
    if (!Number.isFinite(toRank) || toRank <= currentRank) continue;

    if (skill.endsWith('-lore') || !isActiveSkillSlug(skill)) {
      loreItemsToCreate.push({ skill, toRank, appliedEntry: { skill, toRank, featChoice: true } });
      continue;
    }

    updates[`system.skills.${skill}.rank`] = toRank;
    applied.push({ skill, toRank, featChoice: true });
  }

  for (const rule of featLoreRules) {
    const skill = String(rule?.skill ?? '').trim().toLowerCase();
    const toRank = evaluateRuleNumericValue(resolveConditionalLoreRuleValue(rule, actor), level, rule);
    if (!skill || !skill.endsWith('-lore') || !Number.isFinite(toRank) || toRank <= 0) continue;
    loreItemsToCreate.push({ skill, toRank, appliedEntry: { skill, toRank, featChoice: true } });
  }

  for (const entry of automaticLoreIncreases) {
    loreItemsToCreate.push({
      skill: entry.skill,
      name: entry.name,
      toRank: entry.rank,
      appliedEntry: {
        skill: entry.skill,
        toRank: entry.rank,
        automatic: true,
        source: entry.source,
      },
    });
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }

  if (loreItemsToCreate.length > 0) {
    const existingLores = new Map(
      (actor.items ?? [])
        .filter((item) => item?.type === 'lore')
        .map((item) => [slugify(String(item.slug ?? item.name ?? '')), item]),
    );

    const pendingLores = new Map();
    for (const entry of loreItemsToCreate) {
      const existing = pendingLores.get(entry.skill);
      if (!existing || Number(entry.toRank) > Number(existing.toRank)) pendingLores.set(entry.skill, entry);
    }

    const loreCreates = [];
    const loreUpdates = [];
    for (const entry of pendingLores.values()) {
      const existing = existingLores.get(entry.skill);
      const name = entry.name ?? humanizeLoreSlug(entry.skill);
      if (existing) {
        const currentRank = Number(existing.system?.proficient?.value ?? existing.system?.proficiency?.value ?? existing.system?.rank ?? 0);
        if (entry.toRank > currentRank) {
          loreUpdates.push({ _id: existing.id ?? existing._id, 'system.proficient.value': entry.toRank });
          applied.push(entry.appliedEntry);
        }
        continue;
      }
      loreCreates.push({
        name,
        type: 'lore',
        system: {
          proficient: { value: entry.toRank },
        },
      });
      applied.push(entry.appliedEntry);
    }
    if (loreCreates.length > 0) await actor.createEmbeddedDocuments('Item', loreCreates);
    if (loreUpdates.length > 0) await actor.updateEmbeddedDocuments('Item', loreUpdates);
  }

  return applied;
}

function resolveConditionalLoreRuleValue(rule, actor) {
  const condition = rule?.valueIfSkillRank;
  const skill = String(condition?.skill ?? '').trim().toLowerCase();
  const rank = Number(condition?.rank);
  if (!skill || !Number.isFinite(rank)) return rule?.value ?? 1;

  const currentRank = Number(actor?.system?.skills?.[skill]?.rank ?? 0);
  return currentRank >= rank ? condition.value : rule?.value ?? 1;
}

function getPlannedFeatSkillRules(plan, level) {
  return getAllPlannedFeats(plan, level).flatMap((feat) => getFeatSkillRules(feat));
}

function getPlannedFeatLoreRules(plan, level) {
  return getAllPlannedFeats(plan, level).flatMap((feat) => getFeatLoreRules(feat));
}

function getPendingSkillRank(actor, updates, skill) {
  const pendingRank = updates[`system.skills.${skill}.rank`];
  if (Number.isFinite(pendingRank)) return pendingRank;
  return Number(actor.system?.skills?.[skill]?.rank ?? 0);
}

function slugify(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function humanizeLoreSlug(slug) {
  return String(slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
