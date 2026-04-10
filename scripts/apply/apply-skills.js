export async function applySkillIncreases(actor, plan, level) {
  const levelData = plan.levels[level];
  const skillIncreases = [...(levelData?.skillIncreases ?? []), ...(levelData?.customSkillIncreases ?? [])];
  const intBonusSkills = levelData?.intBonusSkills ?? [];
  const featLoreRules = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats']
    .flatMap((key) => levelData?.[key] ?? [])
    .flatMap((feat) => feat?.dynamicLoreRules ?? []);
  if (skillIncreases.length === 0 && intBonusSkills.length === 0 && featLoreRules.length === 0) return [];

  const updates = {};
  const applied = [];
  const loreItemsToCreate = [];

  for (const inc of skillIncreases) {
    updates[`system.skills.${inc.skill}.rank`] = inc.toRank;
    applied.push(inc);
  }

  for (const skill of intBonusSkills) {
    if (String(skill ?? '').endsWith('-lore')) {
      loreItemsToCreate.push({ skill, toRank: 1, intBonus: true });
      applied.push({ skill, toRank: 1, intBonus: true });
      continue;
    }
    const currentRank = actor.system?.skills?.[skill]?.rank ?? 0;
    if (currentRank < 1) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    applied.push({ skill, toRank: 1, intBonus: true });
  }

  for (const rule of featLoreRules) {
    const skill = String(rule?.skill ?? '').trim().toLowerCase();
    const toRank = Number(rule?.value ?? 1);
    if (!skill || !skill.endsWith('-lore') || !Number.isFinite(toRank) || toRank <= 0) continue;
    loreItemsToCreate.push({ skill, toRank });
    applied.push({ skill, toRank, featChoice: true });
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
    }
    if (loreCreates.length > 0) await actor.createEmbeddedDocuments('Item', loreCreates);
    if (loreUpdates.length > 0) await actor.updateEmbeddedDocuments('Item', loreUpdates);
  }

  return applied;
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
