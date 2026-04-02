import { debug } from '../utils/logger.js';

export async function applySkillIncreases(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData?.skillIncreases?.length) return [];

  const updates = {};
  const applied = [];

  for (const inc of levelData.skillIncreases) {
    const path = `system.skills.${inc.skill}.rank`;
    updates[path] = inc.toRank;
    applied.push(inc);
    debug(`Applied skill increase: ${inc.skill} → rank ${inc.toRank}`);
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }

  return applied;
}
