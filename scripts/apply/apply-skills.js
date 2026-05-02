import { SKILLS } from '../constants.js';
import { getAllPlannedFeats } from '../plan/plan-model.js';
import { evaluateRuleNumericValue } from '../plan/build-state.js';
import { getFeatLoreRules, getFeatSkillRules } from '../utils/feat-skill-rules.js';

export async function applySkillIncreases(actor, plan, level) {
  const levelData = plan.levels[level];
  const skillIncreases = [...(levelData?.skillIncreases ?? []), ...(levelData?.customSkillIncreases ?? [])];
  const intBonusSkills = levelData?.intBonusSkills ?? [];
  const featSkillRules = getPlannedFeatSkillRules(plan, level);
  const featLoreRules = getPlannedFeatLoreRules(plan, level);
  if (skillIncreases.length === 0 && intBonusSkills.length === 0 && featSkillRules.length === 0 && featLoreRules.length === 0) return [];

  const updates = {};
  const applied = [];
  const loreItemsToCreate = [];

  for (const inc of skillIncreases) {
    const skill = String(inc?.skill ?? '').trim().toLowerCase();
    if (!skill) continue;
    if (skill.endsWith('-lore') || !SKILLS.includes(skill)) {
      loreItemsToCreate.push({ skill, toRank: inc.toRank, appliedEntry: inc });
      continue;
    }
    updates[`system.skills.${skill}.rank`] = inc.toRank;
    applied.push(inc);
  }

  for (const skill of intBonusSkills) {
    if (String(skill ?? '').endsWith('-lore')) {
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
    const skill = String(rule?.skill ?? '').trim().toLowerCase();
    if (!skill) continue;

    const currentRank = getPendingSkillRank(actor, updates, skill);
    const rawTargetRank = currentRank >= 1 && rule?.valueIfAlreadyTrained != null
      ? rule.valueIfAlreadyTrained
      : rule?.value;
    const toRank = evaluateRuleNumericValue(rawTargetRank ?? 1, level, rule);
    if (!Number.isFinite(toRank) || toRank <= currentRank) continue;

    if (skill.endsWith('-lore') || !SKILLS.includes(skill)) {
      loreItemsToCreate.push({ skill, toRank, appliedEntry: { skill, toRank, featChoice: true } });
      continue;
    }

    updates[`system.skills.${skill}.rank`] = toRank;
    applied.push({ skill, toRank, featChoice: true });
  }

  for (const rule of featLoreRules) {
    const skill = String(rule?.skill ?? '').trim().toLowerCase();
    const toRank = evaluateRuleNumericValue(rule?.value ?? 1, level, rule);
    if (!skill || !skill.endsWith('-lore') || !Number.isFinite(toRank) || toRank <= 0) continue;
    loreItemsToCreate.push({ skill, toRank, appliedEntry: { skill, toRank, featChoice: true } });
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

    const loreCreates = [];
    const loreUpdates = [];
    for (const entry of loreItemsToCreate) {
      const existing = existingLores.get(entry.skill);
      const name = humanizeLoreSlug(entry.skill);
      if (existing) {
        const currentRank = Number(existing.system?.proficient?.value ?? existing.system?.proficiency?.value ?? existing.system?.rank ?? 0);
        if (entry.toRank > currentRank) {
          loreUpdates.push({ _id: existing.id, 'system.proficient.value': entry.toRank });
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
