import { getGuidanceForSourceTitle } from './content-guidance.js';
import { MODULE_ID } from '../constants.js';

// Traits that mark "guns / tech" content for the optional exclusion (issue #82 #8).
// Defined once so it stays tunable in a single place.
export const NO_GUNS_TRAITS = new Set(['firearm', 'tech']);

export function isPublicationDisallowed(title) {
  return getGuidanceForSourceTitle(title) === 'disallowed';
}

export function isRemasterItem(item) {
  return item?.system?.publication?.remaster === true;
}

export function itemHasExcludedTechTrait(item) {
  const traits = item?.system?.traits?.value ?? [];
  return traits.some((trait) => NO_GUNS_TRAITS.has(String(trait).toLowerCase()));
}

function publicationOptionTitle(option) {
  return option?.title ?? option?.key ?? option?.value ?? option?.label ?? null;
}

export function filterDisallowedSourcePublications(options, { mode = 'show', isGM = false } = {}) {
  if (!Array.isArray(options) || options.length === 0) return options;
  if (mode === 'show') return options;
  if (mode === 'hide-non-gm' && isGM) return options;
  return options.filter((option) => !isPublicationDisallowed(publicationOptionTitle(option)));
}

export function getPublicationFilterMode() {
  try {
    const mode = String(game.settings.get(MODULE_ID, 'publicationFilterVisibility') ?? 'show');
    return ['show', 'hide', 'hide-non-gm'].includes(mode) ? mode : 'show';
  } catch {
    return 'show';
  }
}

export function filterPublicationsForCurrentUser(options) {
  return filterDisallowedSourcePublications(options, {
    mode: getPublicationFilterMode(),
    isGM: game.user?.isGM === true,
  });
}
