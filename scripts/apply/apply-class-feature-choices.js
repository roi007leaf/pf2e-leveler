import { getLevelData } from '../plan/plan-model.js';
import { slugify } from '../utils/pf2e-api.js';

export async function applyClassFeatureChoices(actor, plan, level) {
  const levelData = getLevelData(plan, level);
  const choices = levelData?.classFeatureChoices ?? {};
  const updates = [];
  const applied = [];

  for (const [featureKey, featureChoices] of Object.entries(choices)) {
    const item = findActorClassFeature(actor, featureKey, level);
    if (!item) continue;

    const rulesSelections = normalizeClassFeatureRulesSelections(featureChoices);
    if (Object.keys(rulesSelections).length === 0) continue;

    updates.push({
      _id: item.id ?? item._id,
      'flags.pf2e.rulesSelections': {
        ...(item.flags?.pf2e?.rulesSelections ?? {}),
        ...rulesSelections,
      },
    });
    applied.push({
      uuid: item.uuid ?? item.sourceId ?? item.flags?.core?.sourceId ?? featureKey,
      name: item.name ?? featureKey,
      choices: rulesSelections,
    });
  }

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments?.('Item', updates);
  }

  return applied;
}

function findActorClassFeature(actor, featureKey, level) {
  const normalizedKey = normalizeFeatureKey(featureKey);
  return getActorItems(actor).find((item) =>
    isClassFeatureItem(item)
    && getFeatureTakenLevel(item) <= level
    && getFeatureMatchKeys(item).has(normalizedKey));
}

function normalizeClassFeatureRulesSelections(featureChoices) {
  return Object.fromEntries(
    Object.entries(featureChoices ?? {})
      .map(([flag, entry]) => [flag, typeof entry === 'object' && entry !== null ? entry.value : entry])
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .map(([flag, value]) => [flag, value]),
  );
}

function getFeatureMatchKeys(item) {
  return new Set([
    item?.slug,
    item?.system?.slug,
    item?.name,
    item?.uuid,
    item?.sourceId,
    item?.flags?.core?.sourceId,
    getCompendiumItemId(item?.uuid),
    getCompendiumItemId(item?.sourceId ?? item?.flags?.core?.sourceId),
  ].map(normalizeFeatureKey).filter(Boolean));
}

function getCompendiumItemId(uuid) {
  const match = String(uuid ?? '').match(/\.Item\.([^.]+)$/u);
  return match?.[1] ?? null;
}

function normalizeFeatureKey(value) {
  return slugify(String(value ?? ''));
}

function isClassFeatureItem(item) {
  if (!item || !['feat', 'action', 'classfeature'].includes(String(item?.type ?? '').toLowerCase())) return false;
  if (item.type === 'classfeature') return true;
  const category = String(item?.system?.category?.value ?? item?.system?.category ?? '').toLowerCase();
  return ['classfeature', 'class-feature'].includes(category);
}

function getFeatureTakenLevel(item) {
  const level = Number(item?.system?.level?.taken ?? item?.system?.level?.value ?? item?.level ?? 0);
  return Number.isFinite(level) ? level : 0;
}

function getActorItems(actor) {
  if (Array.isArray(actor?.items)) return actor.items;
  if (Array.isArray(actor?.items?.contents)) return actor.items.contents;
  if (typeof actor?.items?.filter === 'function') return actor.items.filter(() => true);
  return [];
}
