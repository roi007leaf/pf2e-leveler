export function getRequiredSignatureSpellRanks(classDef, level) {
  if (classDef?.spellcasting?.type !== 'spontaneous') return [];

  const feature = (classDef.classFeatures ?? []).find((entry) =>
    ['signature-spells', 'unlimited-signature-spells'].includes(entry?.key),
  );
  if (!feature || feature.key === 'unlimited-signature-spells' || level < feature.level) return [];

  const currentSlots = classDef.spellcasting.slots?.[level];
  if (!currentSlots) return [];

  const currentRanks = Object.keys(currentSlots)
    .map(Number)
    .filter((rank) => Number.isInteger(rank) && rank > 0)
    .sort((a, b) => a - b);
  if (level === feature.level) return currentRanks;

  const previousSlots = classDef.spellcasting.slots?.[level - 1] ?? {};
  return currentRanks.filter((rank) => previousSlots[rank] == null);
}

export function getSpellSelectionRank(spell) {
  const rank = Number(
    spell?.rank
    ?? spell?.system?.location?.heightenedLevel
    ?? spell?.system?.heightenedLevel
    ?? spell?.baseRank
    ?? spell?.system?.level?.value,
  );
  return Number.isFinite(rank) ? rank : -1;
}
