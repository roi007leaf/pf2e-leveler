import { MODULE_ID } from '../constants.js';
import { shouldRestrictContentForUser } from './player-content.js';

let cachedGuidance = null;

export const PLAYER_DISALLOWED_CONTENT_MODES = {
  HIDDEN: 'hidden',
  UNSELECTABLE: 'unselectable',
};

export const GUIDANCE_STATUSES = {
  DEFAULT: 'default',
  ALLOWED: 'allowed',
  RECOMMENDED: 'recommended',
  NOT_RECOMMENDED: 'not-recommended',
  DISALLOWED: 'disallowed',
};

export const CATEGORY_DEFAULT_POLICIES = {
  ALLOWED: 'allowed',
  DISALLOWED: 'disallowed',
};

const CATEGORY_DEFAULT_PREFIX = 'category-default:';
const VALID_STATUSES = new Set(Object.values(GUIDANCE_STATUSES));
const GENERIC_CLASS_ARCHETYPE_TRAITS = new Set([
  'archetype',
  'class',
  'class-archetype',
  'dedication',
  'general',
  'multiclass',
  'mythic',
  'skill',
]);
const DEFAULTABLE_CATEGORIES = new Set([
  'ancestries',
  'heritages',
  'backgrounds',
  'classes',
  'classArchetypes',
  'skills',
  'languages',
  'sources',
]);

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
  return normalizeGuidanceEntry(getRawGuidanceEntry(key)).status;
}

export function getRawGuidanceEntry(key) {
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

export function getCategoryDefaultGuidanceKey(categoryKey) {
  const normalized = String(categoryKey ?? '').trim();
  return normalized ? `${CATEGORY_DEFAULT_PREFIX}${normalized}` : null;
}

export function getGuidanceForSourceTitle(title) {
  const key = getSourceGuidanceKey(title);
  return key ? getGuidanceForKey(key) : null;
}

export function getGuidanceForUuid(uuid) {
  return getGuidanceForKey(uuid);
}

export function getPlayerDisallowedContentMode() {
  try {
    const mode = String(game.settings.get(MODULE_ID, 'playerDisallowedContentMode') ?? '').trim().toLowerCase();
    return Object.values(PLAYER_DISALLOWED_CONTENT_MODES).includes(mode)
      ? mode
      : PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE;
  } catch {
    return PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE;
  }
}

export function shouldHideDisallowedForCurrentUser() {
  return shouldRestrictContentForUser() && getPlayerDisallowedContentMode() === PLAYER_DISALLOWED_CONTENT_MODES.HIDDEN;
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

export function annotateGuidanceBySlug(items, prefix, options = {}) {
  return annotateGuidanceWithResolver(items, (item) => {
    const key = `${prefix}:${item.slug}`;
    return resolveGuidanceStatus({ ...item, uuid: key }, {
      categoryKey: getGuidanceCategoryKeyForSlugPrefix(prefix),
      ignoreCategoryDefaultDisallowed: options.ignoreCategoryDefaultDisallowed === true,
    });
  }, options);
}

export function annotateGuidance(items, options = {}) {
  return annotateGuidanceWithResolver(
    items,
    (item) => resolveGuidanceStatus(item, {
      ignoreCategoryDefaultDisallowed: options.ignoreCategoryDefaultDisallowed === true,
    }),
    options,
  );
}

export function resolveGuidanceStatus(item, { categoryKey = null, ignoreCategoryDefaultDisallowed = false } = {}) {
  const uuid = item?.uuid ?? null;
  const resolvedCategoryKey = categoryKey ?? getGuidanceCategoryKeyForItem(item);
  const direct = normalizeGuidanceEntry(uuid ? getRawGuidanceEntry(uuid) : null);
  if (direct.status || direct.exclusive || direct.freeArchetypeExclusive) {
    return {
      status: direct.status,
      inherited: false,
      exclusive: direct.exclusive,
      exclusiveInherited: false,
      exclusiveScope: direct.exclusive ? (resolvedCategoryKey ?? '__list') : null,
      freeArchetypeExclusive: direct.freeArchetypeExclusive,
      freeArchetypeExclusiveInherited: false,
      freeArchetypeExclusiveScope: direct.freeArchetypeExclusive ? (resolvedCategoryKey ?? '__list') : null,
      categoryKey: resolvedCategoryKey,
    };
  }

  const publicationTitle = item?.publicationTitle
    ?? item?.system?.publication?.title
    ?? null;
  const sourceKey = getSourceGuidanceKey(publicationTitle);
  const source = normalizeGuidanceEntry(sourceKey ? getRawGuidanceEntry(sourceKey) : null);
  if (source.status || source.exclusive || source.freeArchetypeExclusive) {
    return {
      status: source.status,
      inherited: true,
      exclusive: source.exclusive,
      exclusiveInherited: source.exclusive,
      exclusiveScope: source.exclusive ? '__list' : null,
      freeArchetypeExclusive: source.freeArchetypeExclusive,
      freeArchetypeExclusiveInherited: source.freeArchetypeExclusive,
      freeArchetypeExclusiveScope: source.freeArchetypeExclusive ? '__list' : null,
      categoryKey: resolvedCategoryKey,
    };
  }

  if (sourceKey && getCategoryDefaultPolicy('sources') === CATEGORY_DEFAULT_POLICIES.DISALLOWED) {
    return {
      status: GUIDANCE_STATUSES.DISALLOWED,
      inherited: true,
      exclusive: false,
      exclusiveInherited: false,
      exclusiveScope: null,
      freeArchetypeExclusive: false,
      freeArchetypeExclusiveInherited: false,
      freeArchetypeExclusiveScope: null,
      categoryKey: resolvedCategoryKey,
    };
  }

  const categoryDefault = getCategoryDefaultPolicy(resolvedCategoryKey);
  if (!ignoreCategoryDefaultDisallowed && categoryDefault === CATEGORY_DEFAULT_POLICIES.DISALLOWED) {
    return {
      status: GUIDANCE_STATUSES.DISALLOWED,
      inherited: true,
      exclusive: source.exclusive,
      exclusiveInherited: source.exclusive,
      exclusiveScope: source.exclusive ? '__list' : null,
      freeArchetypeExclusive: source.freeArchetypeExclusive,
      freeArchetypeExclusiveInherited: source.freeArchetypeExclusive,
      freeArchetypeExclusiveScope: source.freeArchetypeExclusive ? '__list' : null,
      categoryKey: resolvedCategoryKey,
    };
  }

  return {
    status: null,
    inherited: false,
    exclusive: source.exclusive,
    exclusiveInherited: source.exclusive,
    exclusiveScope: source.exclusive ? '__list' : null,
    freeArchetypeExclusive: source.freeArchetypeExclusive,
    freeArchetypeExclusiveInherited: source.freeArchetypeExclusive,
    freeArchetypeExclusiveScope: source.freeArchetypeExclusive ? '__list' : null,
    categoryKey: resolvedCategoryKey,
  };
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
    const aPriority = getGuidanceSortPriority(a);
    const bPriority = getGuidanceSortPriority(b);
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (typeof fallback === 'function') return fallback(a, b);
    return 0;
  });
}

export function filterDisallowedForCurrentUser(items) {
  if (!shouldHideDisallowedForCurrentUser()) return items;
  return items.filter((item) => !item.isDisallowed);
}

export function isGuidanceSelectionBlocked(item) {
  return item?.isDisallowed === true && shouldRestrictContentForUser();
}

export function getGuidanceSelectionTooltip(item) {
  if (item?.isDisallowed !== true) return '';
  if (shouldRestrictContentForUser()) {
    if (
      item?.guidanceExclusiveFiltered === true ||
      item?.guidanceFreeArchetypeExclusiveFiltered === true
    ) {
      return game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_EXCLUSIVE_REQUIRED');
    }
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

export function normalizeGuidanceEntry(entry) {
  if (typeof entry === 'string') {
    const status = normalizeGuidanceStatus(entry);
    return { status, exclusive: false, freeArchetypeExclusive: false };
  }
  if (!entry || typeof entry !== 'object') {
    return { status: null, exclusive: false, freeArchetypeExclusive: false };
  }

  const status = normalizeGuidanceStatus(entry.status);
  const exclusive = entry.exclusive === true && status !== GUIDANCE_STATUSES.DISALLOWED;
  const freeArchetypeExclusive =
    entry.freeArchetypeExclusive === true && status !== GUIDANCE_STATUSES.DISALLOWED;
  return { status, exclusive, freeArchetypeExclusive };
}

export function buildGuidanceEntry(status, exclusive = false, freeArchetypeExclusive = false) {
  const normalizedStatus = normalizeGuidanceStatus(status);
  const normalizedExclusive = exclusive === true && normalizedStatus !== GUIDANCE_STATUSES.DISALLOWED;
  const normalizedFreeArchetypeExclusive =
    freeArchetypeExclusive === true && normalizedStatus !== GUIDANCE_STATUSES.DISALLOWED;
  if (!normalizedStatus && !normalizedExclusive && !normalizedFreeArchetypeExclusive) return null;
  if (!normalizedExclusive && !normalizedFreeArchetypeExclusive) return normalizedStatus;
  return {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(normalizedExclusive ? { exclusive: true } : {}),
    ...(normalizedFreeArchetypeExclusive ? { freeArchetypeExclusive: true } : {}),
  };
}

export function getCategoryDefaultPolicy(categoryKey) {
  if (!DEFAULTABLE_CATEGORIES.has(String(categoryKey ?? ''))) return CATEGORY_DEFAULT_POLICIES.ALLOWED;
  const key = getCategoryDefaultGuidanceKey(categoryKey);
  const status = getGuidanceForKey(key);
  return status === CATEGORY_DEFAULT_POLICIES.DISALLOWED
    ? CATEGORY_DEFAULT_POLICIES.DISALLOWED
    : CATEGORY_DEFAULT_POLICIES.ALLOWED;
}

function annotateGuidanceWithResolver(items, resolver, options = {}) {
  const freeArchetypeScopeActive = options.freeArchetype === true;
  const resolvedEntries = items.map((item) => ({
    item,
    resolved: resolver(item),
  }));
  if (!freeArchetypeScopeActive) {
    for (const { resolved } of resolvedEntries) {
      clearInactiveFreeArchetypeExclusiveResolution(resolved);
    }
  }
  applyClassArchetypeExclusiveFamilies(resolvedEntries, {
    flag: 'exclusive',
    inheritedFlag: 'exclusiveInherited',
    scopeFlag: 'exclusiveScope',
  });
  if (freeArchetypeScopeActive) {
    applyClassArchetypeExclusiveFamilies(resolvedEntries, {
      flag: 'freeArchetypeExclusive',
      inheritedFlag: 'freeArchetypeExclusiveInherited',
      scopeFlag: 'freeArchetypeExclusiveScope',
    });
  }

  const exclusiveScopes = new Set();
  for (const { resolved } of resolvedEntries) {
    if (resolved.exclusive && resolved.exclusiveScope) {
      exclusiveScopes.add(resolved.exclusiveScope);
    }
  }
  const freeArchetypeExclusiveScopes = new Set();
  if (freeArchetypeScopeActive) {
    for (const { resolved } of resolvedEntries) {
      if (resolved.freeArchetypeExclusive && resolved.freeArchetypeExclusiveScope) {
        freeArchetypeExclusiveScopes.add(resolved.freeArchetypeExclusiveScope);
      }
    }
  }

  for (const { item, resolved } of resolvedEntries) {
    const globallyResolved = applyExclusiveGate(resolved, exclusiveScopes, {
      flag: 'exclusive',
      filteredFlag: 'exclusiveFiltered',
    });
    const scopedResolved = freeArchetypeScopeActive
      ? applyExclusiveGate(globallyResolved, freeArchetypeExclusiveScopes, {
        flag: 'freeArchetypeExclusive',
        filteredFlag: 'freeArchetypeExclusiveFiltered',
      })
      : globallyResolved;
    applyResolvedStatus(item, scopedResolved);
  }
  return items;
}

function clearInactiveFreeArchetypeExclusiveResolution(resolved) {
  if (
    resolved?.freeArchetypeExclusive !== true &&
    resolved?.freeArchetypeExclusiveFiltered !== true
  ) {
    return;
  }

  resolved.freeArchetypeExclusive = false;
  resolved.freeArchetypeExclusiveInherited = false;
  resolved.freeArchetypeExclusiveScope = null;
  resolved.freeArchetypeExclusiveFiltered = false;
  resolved.exclusive = false;
  resolved.exclusiveInherited = false;
  resolved.exclusiveScope = null;
  resolved.exclusiveFiltered = false;
}

function applyClassArchetypeExclusiveFamilies(resolvedEntries, {
  flag,
  inheritedFlag,
  scopeFlag,
} = {}) {
  const exclusiveFamilies = new Set();
  for (const { item, resolved } of resolvedEntries) {
    if (!resolved?.[flag] || !isArchetypeDedicationGuidanceItem(item)) continue;
    for (const family of getClassArchetypeFamilyKeys(item)) {
      exclusiveFamilies.add(family);
    }
  }
  if (!exclusiveFamilies.size) return;

  for (const { item, resolved } of resolvedEntries) {
    if (!resolved || resolved[flag] || !isClassArchetypeGuidanceItem(item)) continue;
    if (!getClassArchetypeFamilyKeys(item).some((family) => exclusiveFamilies.has(family))) continue;
    if (resolved.status === GUIDANCE_STATUSES.DISALLOWED && resolved.inherited !== true) continue;

    resolved[flag] = true;
    resolved[inheritedFlag] = true;
    resolved[scopeFlag] = resolved.categoryKey ?? 'classArchetypes';
    if (resolved.status === GUIDANCE_STATUSES.DISALLOWED && resolved.inherited === true) {
      resolved.status = null;
      resolved.inherited = false;
    }
  }
}

function applyExclusiveGate(resolved, exclusiveScopes, {
  flag,
  filteredFlag,
} = {}) {
  if (resolved[flag] || exclusiveScopes.size === 0) return resolved;
  const itemScope = resolved.categoryKey ?? '__list';
  const blockedByExclusive = exclusiveScopes.has('__list') || exclusiveScopes.has(itemScope);
  if (!blockedByExclusive) return resolved;

  return {
    ...resolved,
    status: GUIDANCE_STATUSES.DISALLOWED,
    inherited: true,
    [filteredFlag]: true,
  };
}

function applyResolvedStatus(item, resolved) {
  const status = resolved?.status ?? null;
  item.isAllowed = status === GUIDANCE_STATUSES.ALLOWED;
  item.isRecommended = status === GUIDANCE_STATUSES.RECOMMENDED;
  item.isNotRecommended = status === GUIDANCE_STATUSES.NOT_RECOMMENDED;
  item.isDisallowed = status === GUIDANCE_STATUSES.DISALLOWED;
  item.isExclusive = resolved?.exclusive === true;
  item.isFreeArchetypeExclusive = resolved?.freeArchetypeExclusive === true;
  item.guidanceExclusiveFiltered = resolved?.exclusiveFiltered === true;
  item.guidanceFreeArchetypeExclusiveFiltered = resolved?.freeArchetypeExclusiveFiltered === true;
  item.guidanceInherited = resolved?.inherited === true && !!status;
  item.guidanceStatus = status ?? GUIDANCE_STATUSES.DEFAULT;
  item.guidanceSelectionBlocked = isGuidanceSelectionBlocked(item);
  item.guidanceSelectionTooltip = getGuidanceSelectionTooltip(item);
  item.guidanceDisallowedTooltip = getGuidanceDisallowedTooltip(item);
}

function getGuidanceDisallowedTooltip(item) {
  if (item?.isDisallowed !== true) return '';
  const source = item?.publicationTitle ?? item?.system?.publication?.title ?? null;
  if (item?.guidanceInherited === true && source) {
    return game.i18n.format('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.DISALLOWED_SOURCE_REASON', { source });
  }
  return game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.DISALLOWED_ITEM_REASON');
}

function normalizeGuidanceStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (!normalized || normalized === GUIDANCE_STATUSES.DEFAULT) return null;
  return VALID_STATUSES.has(normalized) ? normalized : null;
}

function getGuidanceSortPriority(item) {
  if (item?.isRecommended) return 0;
  if (item?.isExclusive || item?.isFreeArchetypeExclusive || item?.isAllowed) return 1;
  if (item?.isNotRecommended) return 3;
  if (item?.isDisallowed) return 4;
  return 2;
}

function getGuidanceCategoryKeyForSlugPrefix(prefix) {
  if (prefix === 'skill') return 'skills';
  if (prefix === 'language') return 'languages';
  return null;
}

function getGuidanceCategoryKeyForItem(item) {
  const explicit = item?.guidanceCategoryKey ?? item?.categoryKey ?? null;
  if (explicit) return String(explicit);

  const uuid = String(item?.uuid ?? '');
  if (uuid.startsWith('skill:')) return 'skills';
  if (uuid.startsWith('language:')) return 'languages';
  if (uuid.startsWith('source-title:')) return 'sources';

  const type = String(item?.type ?? '').trim().toLowerCase();
  if (type === 'ancestry') return 'ancestries';
  if (type === 'heritage') return 'heritages';
  if (type === 'background') return 'backgrounds';
  if (type === 'class') return 'classes';
  if (type === 'feat') return isClassArchetypeGuidanceItem(item) ? 'classArchetypes' : 'feats';
  if (type === 'spell') return 'spells';
  if (['weapon', 'armor', 'equipment', 'consumable', 'ammo', 'treasure', 'backpack', 'shield', 'kit'].includes(type)) {
    return 'equipment';
  }
  if (type === 'action') return 'actions';
  if (type === 'deity') return 'deities';
  return null;
}

function isClassArchetypeGuidanceItem(item) {
  const category = String(item?.system?.category ?? item?.category ?? '').trim().toLowerCase();
  if (category !== 'class') return false;
  const traits = getGuidanceTraitValues(item);
  return ['class-archetype', 'archetype', 'multiclass', 'dedication'].some((trait) => traits.includes(trait));
}

function isArchetypeDedicationGuidanceItem(item) {
  const traits = getGuidanceTraitValues(item);
  return isClassArchetypeGuidanceItem(item) && traits.includes('archetype') && traits.includes('dedication');
}

function getClassArchetypeFamilyKeys(item) {
  const keys = new Set();
  for (const trait of getGuidanceTraitValues(item)) {
    if (!GENERIC_CLASS_ARCHETYPE_TRAITS.has(trait)) keys.add(trait);
  }

  const slug = normalizeSlug(item?.slug ?? item?.system?.slug ?? uuidTail(item?.uuid));
  if (slug.endsWith('-dedication')) keys.add(slug.replace(/-dedication$/, ''));

  const nameKey = normalizeSlug(String(item?.name ?? '').replace(/\s+Dedication$/i, ''));
  if (String(item?.name ?? '').trim().match(/\s+Dedication$/i) && nameKey) keys.add(nameKey);

  return [...keys].filter(Boolean);
}

function getGuidanceTraitValues(item) {
  return [
    ...normalizeStringArray(item?.traits),
    ...normalizeStringArray(item?.system?.traits?.value),
    ...normalizeStringArray(item?.system?.traits?.otherTags),
    ...normalizeStringArray(item?.otherTags),
  ];
}

function normalizeSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uuidTail(uuid) {
  const value = String(uuid ?? '');
  return value.includes('.') ? value.split('.').pop() : value;
}

function normalizeStringArray(values) {
  return Array.isArray(values) ? values.map((value) => String(value).toLowerCase()) : [];
}
