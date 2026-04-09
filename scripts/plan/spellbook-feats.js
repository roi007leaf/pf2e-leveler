const CANTRIP_EXPANSION_SLUGS = new Set([
  'cantrip-expansion',
]);

export function getSpellbookBonusCantripSelectionCount(plan, level) {
  const feats = getPlannedFeatsForLevel(plan, level);
  let total = 0;

  for (const feat of feats) {
    if (isCantripExpansionFeat(feat)) total += 2;
  }

  return total;
}

export function isCantripExpansionFeat(feat) {
  const slug = String(feat?.slug ?? '').trim().toLowerCase();
  if (CANTRIP_EXPANSION_SLUGS.has(slug)) return true;

  const name = String(feat?.name ?? '').trim().toLowerCase();
  return name === 'cantrip expansion';
}

function getPlannedFeatsForLevel(plan, level) {
  const levelData = plan?.levels?.[level];
  if (!levelData) return [];

  const featKeys = [
    'classFeats',
    'skillFeats',
    'generalFeats',
    'ancestryFeats',
    'archetypeFeats',
    'mythicFeats',
    'dualClassFeats',
    'customFeats',
  ];

  return featKeys.flatMap((key) => levelData[key] ?? []);
}
