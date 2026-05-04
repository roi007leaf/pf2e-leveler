export async function applySkillRetrains(actor, plan, level) {
  const retrains = plan?.levels?.[level]?.retrainedSkillIncreases ?? [];
  if (retrains.length === 0) return [];

  const updates = {};
  const applied = [];
  for (const retrain of retrains) {
    const originalSkill = String(retrain?.original?.skill ?? '').trim().toLowerCase();
    const replacementSkill = String(retrain?.replacement?.skill ?? '').trim().toLowerCase();
    const originalFromRank = Number(retrain?.original?.fromRank ?? 0);
    const originalToRank = Number(retrain?.original?.toRank ?? 0);
    const replacementRank = Number(retrain?.replacement?.toRank ?? 0);
    if (!originalSkill || !replacementSkill || !Number.isFinite(replacementRank)) continue;

    const currentOriginalRank = Number(actor.system?.skills?.[originalSkill]?.rank ?? 0);
    const currentReplacementRank = Number(actor.system?.skills?.[replacementSkill]?.rank ?? 0);

    if (currentOriginalRank <= originalToRank && currentOriginalRank > originalFromRank) {
      updates[`system.skills.${originalSkill}.rank`] = originalFromRank;
    }
    if (currentReplacementRank < replacementRank) {
      updates[`system.skills.${replacementSkill}.rank`] = replacementRank;
    }

    applied.push({
      original: { skill: originalSkill, rank: originalToRank },
      replacement: { skill: replacementSkill, rank: replacementRank },
    });
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }

  return applied;
}
