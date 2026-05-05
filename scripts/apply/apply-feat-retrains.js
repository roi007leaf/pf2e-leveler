const CATEGORY_TO_GROUP = {
  classFeats: 'class',
  skillFeats: 'skill',
  generalFeats: 'general',
  ancestryFeats: 'ancestry',
  archetypeFeats: 'archetype',
  mythicFeats: 'mythic',
  dualClassFeats: 'class',
  customFeats: 'bonus',
};

export async function applyFeatRetrains(actor, plan, level) {
  const retrains = plan?.levels?.[level]?.retrainedFeats ?? [];
  if (retrains.length === 0) return [];

  const applied = [];
  for (const retrain of retrains) {
    const original = findOriginalFeat(actor, retrain?.original);
    if (!original || !retrain?.replacement?.uuid) continue;

    const replacementDoc = await fromUuid(retrain.replacement.uuid).catch(() => null);
    if (!replacementDoc) continue;

    const originalId = original.id ?? original._id;
    if (!originalId) continue;
    const originalName = retrain.original?.name ?? original.name;
    const itemData = foundry.utils.deepClone(replacementDoc.toObject());
    const location = getFeatLocation(original, retrain);
    itemData.system ??= {};
    itemData.system.location = location;
    itemData.system.level = {
      ...(itemData.system.level ?? {}),
      taken: retrain.fromLevel,
    };

    const choices = Object.entries(retrain.replacement?.choices ?? {})
      .filter(([, value]) => ['string', 'number'].includes(typeof value));
    if (choices.length > 0) {
      itemData.flags ??= {};
      itemData.flags.pf2e ??= {};
      itemData.flags.pf2e.rulesSelections = Object.fromEntries(
        choices.map(([key, value]) => [key, String(value)]),
      );
    }

    await actor.deleteEmbeddedDocuments('Item', [originalId]);
    const created = await actor.createEmbeddedDocuments('Item', [itemData]);
    if (!created?.length) continue;

    applied.push({
      original: { name: originalName },
      replacement: {
        uuid: retrain.replacement.uuid,
        name: retrain.replacement.name ?? replacementDoc.name,
      },
    });
  }

  return applied;
}

function getFeatLocation(original, retrain) {
  const location = normalizeFeatLocation(original?.system?.location ?? retrain?.original?.location);
  if (location) return location;
  return `${CATEGORY_TO_GROUP[retrain?.category] ?? 'bonus'}-${retrain?.fromLevel}`;
}

function normalizeFeatLocation(location) {
  if (typeof location === 'string') return location.trim();
  if (location && typeof location === 'object') {
    return normalizeFeatLocation(location.value);
  }
  return '';
}

function findOriginalFeat(actor, original) {
  if (!original) return null;
  const feats = actor?.items?.filter?.((item) => item?.type === 'feat') ?? [];
  return feats.find((item) => (
    (original.actorItemId && [item.id, item._id].includes(original.actorItemId)) ||
    (original.uuid && item.uuid === original.uuid) ||
    (original.sourceId && (item.sourceId === original.sourceId || item.flags?.core?.sourceId === original.sourceId)) ||
    (original.slug && item.slug === original.slug)
  )) ?? null;
}
