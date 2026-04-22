import { MODULE_ID } from '../constants.js';
import { shouldRestrictContentForUser } from './player-content.js';

let cachedGuidance = null;

export function invalidateGuidanceCache() {
  cachedGuidance = null;
}

export function getContentGuidance() {
  if (cachedGuidance) return cachedGuidance;
  try {
    cachedGuidance = game.settings.get(MODULE_ID, 'gmContentGuidance') ?? {};
  } catch {
    cachedGuidance = {};
  }
  return cachedGuidance;
}

export function getGuidanceForKey(key) {
  if (!key) return null;
  const guidance = getContentGuidance();
  return guidance[key] ?? null;
}

export function normalizeSourceTitle(title) {
  return String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getSourceGuidanceKey(title) {
  const normalized = normalizeSourceTitle(title);
  return normalized ? `source-title:${normalized}` : null;
}

export function getGuidanceForSourceTitle(title) {
  const key = getSourceGuidanceKey(title);
  return key ? getGuidanceForKey(key) : null;
}

export function getGuidanceForUuid(uuid) {
  return getGuidanceForKey(uuid);
}

export function isRecommended(uuid) {
  return getGuidanceForUuid(uuid) === 'recommended';
}

export function isNotRecommended(uuid) {
  return getGuidanceForUuid(uuid) === 'not-recommended';
}

export function isDisallowed(uuid) {
  return getGuidanceForUuid(uuid) === 'disallowed';
}

export function isDisallowedForCurrentUser(uuid) {
  return isDisallowed(uuid) && shouldRestrictContentForUser();
}

export function annotateGuidanceBySlug(items, prefix) {
  const guidance = getContentGuidance();
  for (const item of items) {
    const key = `${prefix}:${item.slug}`;
    const status = guidance[key] ?? null;
    applyResolvedStatus(item, status, false);
  }
  return items;
}

export function annotateGuidance(items) {
  for (const item of items) {
    const resolved = resolveGuidanceStatus(item);
    applyResolvedStatus(item, resolved.status, resolved.inherited);
  }
  return items;
}

export function resolveGuidanceStatus(item) {
  const uuid = item?.uuid ?? null;
  const directStatus = uuid ? getGuidanceForUuid(uuid) : null;
  if (directStatus) return { status: directStatus, inherited: false };

  const publicationTitle = item?.publicationTitle
    ?? item?.system?.publication?.title
    ?? null;
  const sourceStatus = getGuidanceForSourceTitle(publicationTitle);
  if (sourceStatus) return { status: sourceStatus, inherited: true };

  return { status: null, inherited: false };
}

export function sortRecommendedFirst(items) {
  return items.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return 0;
  });
}

export function sortByGuidancePriority(items, fallback = null) {
  return items.sort((a, b) => {
    const aPriority = a.isRecommended ? 0 : a.isNotRecommended ? 2 : 1;
    const bPriority = b.isRecommended ? 0 : b.isNotRecommended ? 2 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (typeof fallback === 'function') return fallback(a, b);
    return 0;
  });
}

export function filterDisallowedForCurrentUser(items) {
  if (!shouldRestrictContentForUser()) return items;
  return items.filter((item) => !item.isDisallowed);
}

export function isGuidanceSelectionBlocked(item) {
  return item?.isDisallowed === true && shouldRestrictContentForUser();
}

export function getGuidanceSelectionTooltip(item) {
  if (item?.isDisallowed !== true) return '';
  if (shouldRestrictContentForUser()) {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_DISALLOWED');
  }
  return game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.GM_OVERRIDE_ALLOWED');
}

export async function setGuidance(uuid, status) {
  const guidance = { ...getContentGuidance() };
  if (!status || status === 'default') {
    delete guidance[uuid];
  } else {
    guidance[uuid] = status;
  }
  await game.settings.set(MODULE_ID, 'gmContentGuidance', guidance);
  cachedGuidance = guidance;
}

function applyResolvedStatus(item, status, inherited = false) {
  item.isRecommended = status === 'recommended';
  item.isNotRecommended = status === 'not-recommended';
  item.isDisallowed = status === 'disallowed';
  item.guidanceInherited = inherited === true && !!status;
  item.guidanceStatus = status ?? 'default';
  item.guidanceSelectionBlocked = isGuidanceSelectionBlocked(item);
  item.guidanceSelectionTooltip = getGuidanceSelectionTooltip(item);
}
