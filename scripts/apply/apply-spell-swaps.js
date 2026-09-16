export async function applySpellSwaps(actor, plan, level) {
  const swaps = plan?.levels?.[level]?.spellSwaps ?? [];
  const applied = [];

  for (const swap of swaps) {
    const original = findOriginalSpell(actor, swap?.original);
    if (!original || !swap?.replacement?.uuid) continue;

    const originalRank = Number(swap.original?.rank ?? getSpellRank(original));
    const replacementRank = Number(swap.replacement?.rank);
    if (!Number.isFinite(originalRank) || replacementRank !== originalRank) continue;

    const replacementDoc = await fromUuid(swap.replacement.uuid).catch(() => null);
    if (!replacementDoc) continue;

    const originalId = original.id ?? original._id;
    const entryId = swap.original?.entryId ?? original.system?.location?.value;
    if (!originalId || !entryId) continue;

    const itemData = foundry.utils.deepClone(replacementDoc.toObject());
    itemData.system ??= {};
    itemData.system.location = {
      value: entryId,
      ...(replacementRank > Number(replacementDoc.system?.level?.value ?? 0)
        ? { heightenedLevel: replacementRank }
        : {}),
    };
    if (replacementRank > Number(replacementDoc.system?.level?.value ?? 0)) {
      itemData.system.heightenedLevel = replacementRank;
    }

    const created = await actor.createEmbeddedDocuments('Item', [itemData]);
    if (!created?.length) continue;
    try {
      await actor.deleteEmbeddedDocuments('Item', [originalId]);
    } catch (error) {
      const createdIds = created.map((item) => item?.id ?? item?._id).filter(Boolean);
      if (createdIds.length > 0) {
        await actor.deleteEmbeddedDocuments('Item', createdIds).catch(() => {});
      }
      throw error;
    }

    applied.push({
      original: { name: swap.original?.name ?? original.name },
      replacement: {
        uuid: swap.replacement.uuid,
        name: swap.replacement.name ?? replacementDoc.name,
        rank: replacementRank,
      },
    });
  }

  return applied;
}

function findOriginalSpell(actor, original) {
  if (!original) return null;
  const spells = actor?.items?.filter?.((item) => item?.type === 'spell') ?? [];
  return spells.find((item) => (
    (original.actorItemId && [item.id, item._id].includes(original.actorItemId))
    || (
      original.sourceId
      && (item.sourceId === original.sourceId || item.flags?.core?.sourceId === original.sourceId)
      && (!original.entryId || item.system?.location?.value === original.entryId)
    )
  )) ?? null;
}

function getSpellRank(spell) {
  return Number(
    spell?.system?.location?.heightenedLevel
    ?? spell?.system?.heightenedLevel
    ?? spell?.system?.level?.value,
  );
}
