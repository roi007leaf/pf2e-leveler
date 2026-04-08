export async function applyBoosts(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData?.abilityBoosts?.length) return [];

  const boostKey = findBoostKey(level);
  if (!boostKey) return [];

  const buildSource = foundry.utils.deepClone(actor.toObject().system.build ?? {});
  if (!buildSource.attributes) buildSource.attributes = {};
  if (!buildSource.attributes.boosts) buildSource.attributes.boosts = {};
  const existing = buildSource.attributes.boosts[boostKey] ?? [];
  buildSource.attributes.boosts[boostKey] = [...existing, ...levelData.abilityBoosts];
  await actor.update({ 'system.build': buildSource });

  return levelData.abilityBoosts;
}

function findBoostKey(level) {
  const milestones = [5, 10, 15, 20];
  return milestones.find((m) => m >= level) ?? null;
}
