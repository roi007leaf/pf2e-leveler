import { SUBCLASS_TAGS } from '../constants.js';
import { slugify } from '../utils/pf2e-api.js';
import { debug } from '../utils/logger.js';

const REQUIRED_SECOND_LEVEL_CLASS_FEAT_PATTERN = /must\s+select\s+(.+?)\s+as\s+your\s+(?:2nd|second)\s*-\s*level\s+class\s+feat/i;

export function getSelectedSubclassItem(actor, classSlug = actor?.class?.slug ?? null) {
  const subclassTag = SUBCLASS_TAGS[classSlug];
  if (!actor || !subclassTag) return null;

  const actorItems = actor?.items?.contents
    ?? (Array.isArray(actor?.items) ? actor.items : actor?.items?.filter?.(() => true) ?? []);

  const matched = actorItems.find((item) =>
    (item?.type === 'feat' || item?.type === 'classfeature')
    && matchesTagFamily(item?.system?.traits?.otherTags ?? [], subclassTag),
  ) ?? null;

  debug('Subclass dedication requirement source lookup', {
    actor: actor?.name ?? null,
    classSlug,
    subclassTag,
    matchedName: matched?.name ?? null,
    matchedType: matched?.type ?? null,
    matchedOtherTags: matched?.system?.traits?.otherTags ?? [],
  });

  return matched;
}

export function parseRequiredSecondLevelClassFeat(value) {
  const html = String(value ?? '');
  if (!html) return null;

  const normalizedHtml = normalizeRequirementText(html);
  const match = normalizedHtml.match(REQUIRED_SECOND_LEVEL_CLASS_FEAT_PATTERN);
  if (!match) return null;

  const target = String(match[1] ?? '').trim();
  if (!target) return null;

  const linkedUuidMatch = target.match(/data-uuid="([^"]+)"/i);
  const linkedNameMatch = target.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const inlineUuidMatch = target.match(/@UUID\[([^\]]+)\]\{([^}]+)\}/i);

  const uuid = linkedUuidMatch?.[1] ?? inlineUuidMatch?.[1] ?? null;
  const rawName = linkedNameMatch?.[1]
    ?? inlineUuidMatch?.[2]
    ?? stripHtml(target);
  const name = String(rawName ?? '').replace(/\s+/g, ' ').trim();
  if (!name && !uuid) return null;

  return {
    uuid,
    name,
    slug: name ? slugify(name) : null,
    text: name || uuid,
  };
}

export function getRequiredSecondLevelClassFeatForActor(actor, classSlug = actor?.class?.slug ?? null) {
  const subclassItem = getSelectedSubclassItem(actor, classSlug);
  const requirementSources = extractRequirementSourceStrings(subclassItem);
  const requirement = requirementSources
    .map((value) => parseRequiredSecondLevelClassFeat(value))
    .find(Boolean) ?? null;
  const matchingSourceSample = requirement
    ? null
    : requirementSources.find((value) => /must\s+select|class\s+feat|2nd|second|dedication|battle harbinger/i.test(String(value ?? '')));
  const matchingSourceSamples = requirement
    ? []
    : requirementSources
      .filter((value) => /must\s+select|class\s+feat|2nd|second|dedication|battle harbinger/i.test(String(value ?? '')))
      .slice(0, 5)
      .map((value) => normalizeRequirementText(value).slice(0, 240));
  debug('Subclass dedication requirement parsed', {
    actor: actor?.name ?? null,
    classSlug,
    subclassName: subclassItem?.name ?? null,
    requirementSourceCount: requirementSources.length,
    matchingSourceSample: matchingSourceSample ? normalizeRequirementText(matchingSourceSample).slice(0, 240) : null,
    matchingSourceSamples,
    requirement,
  });
  return requirement;
}

export function doesFeatMatchRequiredSecondLevelClassFeat(feat, requirement) {
  if (!feat || !requirement) return false;

  const featUuid = String(feat?.uuid ?? feat?.sourceId ?? feat?.flags?.core?.sourceId ?? '').trim();
  const featSlug = String(feat?.slug ?? '').trim().toLowerCase();
  const featName = String(feat?.name ?? '').trim().toLowerCase();
  const requiredUuid = String(requirement?.uuid ?? '').trim();
  const requiredSlug = String(requirement?.slug ?? '').trim().toLowerCase();
  const requiredName = String(requirement?.name ?? '').trim().toLowerCase();

  if (requiredUuid && featUuid && featUuid === requiredUuid) return true;
  if (requiredSlug && featSlug && featSlug === requiredSlug) return true;
  if (requiredName && featName && featName === requiredName) return true;
  return false;
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRequirementText(value) {
  return String(value ?? '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTagFamily(tags, expected) {
  const normalizedExpected = String(expected ?? '').toLowerCase();
  return (tags ?? []).some((tag) => {
    const normalizedTag = String(tag ?? '').toLowerCase();
    return normalizedTag === normalizedExpected || normalizedTag.startsWith(`${normalizedExpected}-`);
  });
}

function extractRequirementSourceStrings(item) {
  if (!item) return [];

  const results = [];
  const seen = new Set();

  const push = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return;
    if (seen.has(text)) return;
    seen.add(text);
    results.push(text);
  };

  push(item?.system?.description?.value);
  push(item?.description);

  walkStringLeaves(item?.system, push);
  walkStringLeaves(item?._source, push);
  try {
    const objectValue = typeof item?.toObject === 'function' ? item.toObject() : null;
    walkStringLeaves(objectValue, push);
  } catch {
    // Ignore document serialization issues; live runtime data is best-effort here.
  }
  return results;
}

function walkStringLeaves(value, push, depth = 0) {
  if (depth > 6 || value == null) return;
  if (typeof value === 'string') {
    push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) walkStringLeaves(entry, push, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;

  for (const entry of Object.values(value)) {
    walkStringLeaves(entry, push, depth + 1);
  }
}
