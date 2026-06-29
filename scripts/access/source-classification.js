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

export const PUBLICATION_GROUPS = [
  {
    id: 'adventure-paths',
    labelKey: 'PF2E_LEVELER.UI.PUB_GROUP_AP',
    match: (title) =>
      /^Pathfinder #\d+:/.test(title)
      || /^Pathfinder Adventure Path:/.test(title)
      || /Hardcover Compilation$/.test(title)
      || /^Pathfinder Wake the Dead/.test(title),
  },
  {
    id: 'ap-players-guides',
    labelKey: 'PF2E_LEVELER.UI.PUB_GROUP_AP_GUIDE',
    match: (title) => /Player'?s Guide/i.test(title) && !/Advanced Player'?s Guide/i.test(title),
  },
  {
    id: 'standalone-adventures',
    labelKey: 'PF2E_LEVELER.UI.PUB_GROUP_STANDALONE',
    match: (title) => /^Pathfinder Adventure:/.test(title),
  },
  {
    id: 'blogs',
    labelKey: 'PF2E_LEVELER.UI.PUB_GROUP_BLOG',
    match: (title) => /\bBlog\b/i.test(title),
  },
  {
    id: 'lost-omens',
    labelKey: 'PF2E_LEVELER.UI.PUB_GROUP_LOST_OMENS',
    match: (title) => /Lost Omens/i.test(title),
  },
];

export function getPublicationGroupMembers(groupId, publicationTitles) {
  const group = PUBLICATION_GROUPS.find((entry) => entry.id === groupId);
  if (!group) return [];
  const titles = Array.isArray(publicationTitles) ? publicationTitles : [...(publicationTitles ?? [])];
  return titles.filter((title) => group.match(String(title ?? '')));
}

export function buildPublicationGroupChips(publicationTitles, selectedPublications) {
  const titles = Array.isArray(publicationTitles) ? publicationTitles : [...(publicationTitles ?? [])];
  const selected = selectedPublications instanceof Set ? selectedPublications : new Set(selectedPublications ?? []);
  const chips = [];
  for (const group of PUBLICATION_GROUPS) {
    const members = titles.filter((title) => group.match(String(title ?? '')));
    if (members.length === 0) continue;
    const selectedCount = members.filter((title) => selected.has(title)).length;
    chips.push({
      id: group.id,
      label: game.i18n.localize(group.labelKey),
      selected: selectedCount === members.length,
      partial: selectedCount > 0 && selectedCount < members.length,
    });
  }
  return chips;
}
