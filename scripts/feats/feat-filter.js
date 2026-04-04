export function filterFeatsByCategory(feats, category, searchQuery, targetLevel, options = {}) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const existingFeatNames = new Set();
  const includeDedications = !!options.includeDedications;
  const includeSkillFeats = !!options.includeSkillFeats;

  return feats.filter((feat) => {
    const traits = feat.system.traits.value.map((t) => t.toLowerCase());
    const matchesCategory = matchesFeatCategory(traits, category, normalizedQuery, { includeDedications, includeSkillFeats });
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

function matchesFeatCategory(traits, category, queries, options = {}) {
  const includeDedications = !!options.includeDedications;
  const includeSkillFeats = !!options.includeSkillFeats;
  switch (category) {
    case 'class':
      return (queries.some((q) => traits.includes(q)) && !traits.includes('archetype'))
        || (includeDedications && (traits.includes('dedication') || traits.includes('archetype')));
    case 'ancestry':
      return queries.some((q) => traits.includes(q));
    case 'skill':
      return traits.includes('skill');
    case 'general':
      return (traits.includes('general') && (includeSkillFeats || !traits.includes('skill')))
        || (includeSkillFeats && !traits.includes('general') && traits.includes('skill'));
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
  return feats.filter((feat) => {
    const name = feat.name.toLowerCase();
    const traits = (feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).join(' ');
    return name.includes(lower) || traits.includes(lower);
  });
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
  const normalizedSkills = skillSlugs.map((skill) => String(skill).toLowerCase());
  const skillLabels = getSkillLabels(normalizedSkills);

  return feats.filter((feat) => {
    const prereqs = feat.system.prerequisites?.value ?? [];
    const traits = feat.system.traits?.value?.map((trait) => String(trait).toLowerCase()) ?? [];
    const prereqTexts = prereqs.map((p) => String(p.value ?? '').toLowerCase());

    return normalizedSkills.some((skill) => {
      const label = skillLabels.get(skill) ?? skill;
      return traits.includes(skill)
        || prereqTexts.some((text) => text.includes(skill) || text.includes(label));
    });
  });
}

export function filterByDedication(feats, showDedications) {
  if (showDedications) return feats;
  return feats.filter((feat) => !(feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).includes('dedication'));
}

export function filterByGeneralSkillFeats(feats, showSkillFeats) {
  if (showSkillFeats) return feats;
  return feats.filter((feat) => {
    const traits = (feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    return traits.includes('general') && !traits.includes('skill');
  });
}

export function filterByArchetypeRestrictions(feats, actor, buildState) {
  const classSlug = String(buildState?.classSlug ?? actor?.class?.slug ?? '').toLowerCase();
  const existingClassArchetypeDedications = buildState?.classArchetypeDedications ?? new Set();

  return feats.filter((feat) => {
    const traits = (feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const isDedication = traits.includes('dedication');
    const isArchetype = traits.includes('archetype');
    const isMulticlassArchetype = isArchetype && traits.includes('multiclass');
    const isClassArchetype = isArchetype && traits.includes('class');
    const featSlug = feat.slug ?? null;

    if (isDedication && classSlug && isMulticlassArchetype && featSlug === `${classSlug}-dedication`) return false;

    if (featSlug && isDedication && isClassArchetype && existingClassArchetypeDedications.size > 0) {
      return existingClassArchetypeDedications.has(featSlug);
    }

    return true;
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

  let result = filterFeatsByCategory(feats, category, classTraits, targetLevel, {
    includeDedications: !!options.includeDedications,
    includeSkillFeats: !!options.includeSkillFeats,
  });

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

  if (actor && (category === 'class' || category === 'archetype')) {
    result = filterByArchetypeRestrictions(result, actor, options.buildState);
  }

  return sortFeats(result, options.sortMethod ?? 'LEVEL_DESC');
}

function buildCategoryQuery(category, actor) {
  switch (category) {
    case 'class':
      return actor?.class?.slug ?? '';
    case 'ancestry': {
      const queries = [actor?.ancestry?.slug ?? ''];
      const heritageSlug = actor?.heritage?.slug ?? null;
      if (heritageSlug) queries.push(heritageSlug);
      return queries;
    }
    default:
      return '';
  }
}

function getSkillLabels(skillSlugs) {
  const labels = new Map();
  const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
  for (const skill of skillSlugs) {
    const rawEntry = configSkills[skill];
    const rawLabel = typeof rawEntry === 'string'
      ? rawEntry
      : rawEntry?.label ?? rawEntry?.short ?? rawEntry?.long ?? null;
    if (!rawLabel) continue;
    const localized = typeof rawLabel === 'string' && game?.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
    labels.set(skill, String(localized).toLowerCase());
  }
  return labels;
}
