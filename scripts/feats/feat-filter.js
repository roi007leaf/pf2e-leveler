import { slugify } from '../utils/pf2e-api.js';

export function filterFeatsByCategory(feats, category, searchQuery, targetLevel) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const existingFeatNames = new Set();

  return feats.filter((feat) => {
    const traits = feat.system.traits.value.map((t) => t.toLowerCase());
    const matchesCategory = matchesFeatCategory(traits, category, normalizedQuery);
    const withinLevel = feat.system.level.value <= targetLevel;
    const notDuplicate = checkNotDuplicate(feat, existingFeatNames);

    return matchesCategory && withinLevel && notDuplicate;
  });
}

function normalizeQuery(query) {
  if (!query) return [];
  if (Array.isArray(query)) return query.map((q) => q.toLowerCase());
  return [query.toLowerCase()];
}

function matchesFeatCategory(traits, category, queries) {
  switch (category) {
    case 'class':
      return queries.some((q) => traits.includes(q)) && !traits.includes('dedication');
    case 'ancestry':
      return queries.some((q) => traits.includes(q));
    case 'skill':
      return traits.includes('skill');
    case 'general':
      return traits.includes('general');
    case 'archetype':
      return traits.includes('archetype');
    case 'mythic':
      return traits.includes('mythic');
    default:
      return false;
  }
}

function checkNotDuplicate(feat, seen) {
  const key = feat.name.toLowerCase();
  if (seen.has(key) && feat.system.maxTakable === 1) return false;
  seen.add(key);
  return true;
}

export function filterBySearch(feats, searchText) {
  if (!searchText) return feats;
  const lower = searchText.toLowerCase();
  return feats.filter((feat) => feat.name.toLowerCase().includes(lower));
}

export function filterByRarity(feats, hideUncommon) {
  if (!hideUncommon) return feats;
  return feats.filter((feat) => feat.system.traits.rarity === 'common');
}

export function filterByRareRarity(feats, hideRare) {
  if (!hideRare) return feats;
  return feats.filter((feat) => feat.system.traits.rarity !== 'rare');
}

export function filterBySkill(feats, skillSlugs) {
  if (!skillSlugs || skillSlugs.length === 0) return feats;
  return feats.filter((feat) => {
    const prereqs = feat.system.prerequisites?.value ?? [];
    return skillSlugs.some((skill) =>
      prereqs.some((p) => p.value.toLowerCase().includes(skill)),
    );
  });
}

export function sortFeats(feats, method) {
  const sorted = [...feats];
  switch (method) {
    case 'LEVEL_DESC':
      return sorted.sort((a, b) =>
        a.system.level.value !== b.system.level.value
          ? b.system.level.value - a.system.level.value
          : a.name.localeCompare(b.name),
      );
    case 'LEVEL_ASC':
      return sorted.sort((a, b) =>
        a.system.level.value !== b.system.level.value
          ? a.system.level.value - b.system.level.value
          : a.name.localeCompare(b.name),
      );
    case 'ALPHA_ASC':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'ALPHA_DESC':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return sorted;
  }
}

export function getFeatsForSelection(feats, category, actor, targetLevel, options = {}) {
  const classTraits = buildCategoryQuery(category, actor);

  let result = filterFeatsByCategory(feats, category, classTraits, targetLevel);

  if (options.hideUncommon) {
    result = filterByRarity(result, true);
  }

  if (options.hideRare) {
    result = filterByRareRarity(result, true);
  }

  if (options.searchText) {
    result = filterBySearch(result, options.searchText);
  }

  if (options.skills?.length) {
    result = filterBySkill(result, options.skills);
  }

  return sortFeats(result, options.sortMethod ?? 'LEVEL_DESC');
}

function buildCategoryQuery(category, actor) {
  switch (category) {
    case 'class':
      return actor?.class?.slug ?? actor?.class?.name?.toLowerCase() ?? '';
    case 'ancestry': {
      const queries = [actor?.ancestry?.slug ?? actor?.ancestry?.name?.toLowerCase() ?? ''];
      const heritageSlug = actor?.heritage?.slug ?? actor?.heritage?.name?.toLowerCase();
      if (heritageSlug) queries.push(heritageSlug);
      return queries;
    }
    default:
      return '';
  }
}
