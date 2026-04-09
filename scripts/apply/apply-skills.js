export async function applySkillIncreases(actor, plan, level) {
  const levelData = plan.levels[level];
  const skillIncreases = [...(levelData?.skillIncreases ?? []), ...(levelData?.customSkillIncreases ?? [])];
  const intBonusSkills = levelData?.intBonusSkills ?? [];
  if (skillIncreases.length === 0 && intBonusSkills.length === 0) return [];

  const updates = {};
  const applied = [];

  for (const inc of skillIncreases) {
    updates[`system.skills.${inc.skill}.rank`] = inc.toRank;
    applied.push(inc);
  }

  for (const skill of intBonusSkills) {
    const currentRank = actor.system?.skills?.[skill]?.rank ?? 0;
    if (currentRank < 1) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    applied.push({ skill, toRank: 1, intBonus: true });
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }

  return applied;
}
