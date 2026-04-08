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
    item.isRecommended = status === 'recommended';
    item.isNotRecommended = status === 'not-recommended';
    item.isDisallowed = status === 'disallowed';
  }
  return items;
}

export function annotateGuidance(items) {
  const guidance = getContentGuidance();
  for (const item of items) {
    const status = guidance[item.uuid] ?? null;
    item.isRecommended = status === 'recommended';
    item.isNotRecommended = status === 'not-recommended';
    item.isDisallowed = status === 'disallowed';
  }
  return items;
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
