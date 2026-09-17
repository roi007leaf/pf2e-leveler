function normalizeSlug(value) {
  return String(value ?? '').trim().toLowerCase();
}

function getCollectionContents(collection) {
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (typeof collection?.filter === 'function') return collection.filter(() => true);
  return [];
}

function getActorItems(actor) {
  return getCollectionContents(actor?.items);
}

function getActorItemsOfType(actor, type) {
  const typed = getCollectionContents(actor?.itemTypes?.[type]);
  if (typed.length > 0) return typed;
  return getActorItems(actor).filter((item) => item?.type === type);
}

function getClassSlug(item) {
  return normalizeSlug(item?.slug ?? item?.system?.slug);
}

function isClassFeature(item) {
  if (String(item?.type ?? '').toLowerCase() === 'classfeature') return true;
  const category = String(item?.system?.category?.value ?? item?.system?.category ?? '').toLowerCase();
  return category === 'classfeature' || category === 'class-feature';
}

function getItemSourceId(item) {
  const sourceId = item?.sourceId
    ?? item?._stats?.compendiumSource
    ?? item?.flags?.core?.sourceId
    ?? null;
  return typeof sourceId === 'string' && sourceId.length > 0 ? sourceId : null;
}

function getFeatureIdentity(item) {
  const sourceId = getItemSourceId(item);
  if (sourceId) return `source:${sourceId}`;

  const slug = normalizeSlug(item?.slug ?? item?.system?.slug);
  if (!slug) return null;
  const level = Number(item?.system?.level?.value ?? item?.system?.level?.taken ?? 0);
  return `slug:${slug}:level:${Number.isFinite(level) ? level : 0}`;
}

function toItemSource(item) {
  return typeof item?.toObject === 'function' ? item.toObject() : item;
}

/**
 * Whether the class still owes this actor a feature at or below the target level.
 *
 * Read off the class item's own grant table (`system.items`), where each entry carries the uuid of
 * the feature it grants and the level it arrives at. `createGrantedItems` re-runs every ChoiceSet on
 * the features it builds, so calling it when nothing is owed asks the player to re-pick choices they
 * already made (a rogue's racket, a cleric's doctrine) and then discards the answers.
 *
 * Errs toward calling: a class with no readable grant table, or an entry with no uuid, counts as
 * owing something, so the worst case is the previous behaviour rather than a feature never arriving.
 */
function hasUngrantedFeatures(classItem, level, ownedSourceIds) {
  const table = classItem?.system?.items;
  if (!table || typeof table !== 'object') return true;
  const entries = Object.values(table);
  if (entries.length === 0) return false;
  return entries.some((entry) => {
    if (typeof entry?.level === 'number' && entry.level > level) return false;
    return typeof entry?.uuid !== 'string' || !ownedSourceIds.has(entry.uuid);
  });
}

export async function applyDualClassFeatures(actor, plan, level) {
  const primarySlug = normalizeSlug(plan?.classSlug);
  const dualClassSlug = normalizeSlug(plan?.dualClassSlug);
  if (!dualClassSlug || dualClassSlug === primarySlug) return [];

  const dualClass = getActorItemsOfType(actor, 'class').find((item) =>
    item !== actor?.class && getClassSlug(item) === dualClassSlug);
  if (!dualClass || typeof dualClass.createGrantedItems !== 'function') return [];

  const targetLevel = Number(level);
  if (!Number.isInteger(targetLevel) || targetLevel < 1) return [];

  const ownedFeatures = getActorItemsOfType(actor, 'feat').filter(isClassFeature);
  const ownedIdentities = new Set(ownedFeatures.map(getFeatureIdentity).filter(Boolean));
  const ownedSourceIds = new Set(ownedFeatures.map(getItemSourceId).filter(Boolean));
  if (!hasUngrantedFeatures(dualClass, targetLevel, ownedSourceIds)) return [];

  const granted = await dualClass.createGrantedItems({ level: targetLevel });
  const sources = [];

  for (const feature of granted ?? []) {
    if (!isClassFeature(feature)) continue;
    const featureLevel = Number(feature?.system?.level?.value ?? 0);
    if (Number.isFinite(featureLevel) && featureLevel > targetLevel) continue;

    const identity = getFeatureIdentity(feature);
    if (identity && ownedIdentities.has(identity)) continue;
    if (identity) ownedIdentities.add(identity);
    sources.push(toItemSource(feature));
  }

  if (sources.length === 0 || typeof actor?.createEmbeddedDocuments !== 'function') return [];
  const created = await actor.createEmbeddedDocuments('Item', sources, { keepId: true });
  return (created?.length ? created : sources).map((item) => ({
    uuid: item?.uuid ?? getItemSourceId(item),
    name: item?.name ?? 'Class Feature',
  }));
}
