export async function applyLanguages(actor, plan, level) {
  const levelData = plan.levels[level];
  const intBonusLanguages = levelData?.intBonusLanguages ?? [];
  if (intBonusLanguages.length === 0) return [];

  const current = actor.system?.details?.languages?.value ?? [];
  const merged = [...new Set([...current, ...intBonusLanguages])];
  await actor.update({ 'system.details.languages.value': merged });
  return intBonusLanguages;
}
