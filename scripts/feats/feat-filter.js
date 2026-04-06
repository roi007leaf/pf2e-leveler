export function filterFeatsByCategory(feats, category, searchQuery, targetLevel, options = {}) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const existingFeatNames = new Set();
  const includeDedications = !!options.includeDedications;
  const includeSkillFeats = !!options.includeSkillFeats;
  const additionalArchetypeFeatLevels = options.additionalArchetypeFeatLevels ?? new Map();

  return feats.filter((feat) => {
    const traits = feat.system.traits.value.map((t) => t.toLowerCase());
    const featSlug = getFeatFilterSlug(feat);
    const matchesCategory = matchesFeatCategory(traits, category, normalizedQuery, {
      includeDedications,
      includeSkillFeats,
      featSlug,
      additionalArchetypeFeatLevels,
    });
    const levelRequirement = category === 'archetype' && featSlug && additionalArchetypeFeatLevels.has(featSlug)
      ? additionalArchetypeFeatLevels.get(featSlug)
      : feat.system.level.value;
    const withinLevel = levelRequirement <= targetLevel;
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
  const featSlug = options.featSlug ?? null;
  const additionalArchetypeFeatLevels = options.additionalArchetypeFeatLevels ?? new Map();
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
      return traits.includes('archetype')
        || (!!featSlug && additionalArchetypeFeatLevels.has(featSlug));
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
  const classTraits = buildCategoryQuery(category, actor, options.buildState);

  let result = filterFeatsByCategory(feats, category, classTraits, targetLevel, {
    includeDedications: !!options.includeDedications,
    includeSkillFeats: !!options.includeSkillFeats,
    additionalArchetypeFeatLevels: options.additionalArchetypeFeatLevels,
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

export async function collectAdditionalArchetypeFeatLevels(feats, ownedFeatSlugs, options = {}) {
  const ownedSlugs = ownedFeatSlugs instanceof Set ? ownedFeatSlugs : new Set(ownedFeatSlugs ?? []);
  const additionalFeatLevels = new Map();
  const documentResolver = options.documentResolver ?? defaultDocumentResolver;

  for (const feat of feats) {
    const slug = getFeatFilterSlug(feat);
    if (!slug || !ownedSlugs.has(slug) || !isArchetypeDedication(feat)) continue;

    const parsedEntries = await collectAdditionalFeatEntriesFromDedication(feat, documentResolver);
    for (const entry of parsedEntries) {
      const currentLevel = additionalFeatLevels.get(entry.slug);
      if (currentLevel == null || entry.level < currentLevel) {
        additionalFeatLevels.set(entry.slug, entry.level);
      }
    }
  }

  return additionalFeatLevels;
}

function buildCategoryQuery(category, actor, buildState) {
  switch (category) {
    case 'class':
      return actor?.class?.slug ?? '';
    case 'ancestry': {
      if (buildState?.ancestryTraits instanceof Set && buildState.ancestryTraits.size > 0) {
        return [...buildState.ancestryTraits];
      }
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

function getFeatFilterSlug(feat) {
  return String(feat?.slug ?? feat?.name ?? '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isArchetypeDedication(feat) {
  const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  return traits.includes('archetype') && traits.includes('dedication');
}

function parseAdditionalFeatEntries(html) {
  const uuidEntries = parseAdditionalFeatUuidEntries(html);
  if (uuidEntries.length > 0) return uuidEntries;

  const text = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = text.match(/Additional Feats:\s*(.+?)(?=(?:Special:|Access:|Prerequisites:|Requirements:|Frequency:|Trigger:|Effect:|Critical Success:|Success:|Failure:|Critical Failure:|$))/i);
  if (!match) return [];

  const entries = [];
  const pattern = /(\d+)(?:st|nd|rd|th)\s+([^,;]+?)(?=(?:,\s*\d+(?:st|nd|rd|th)\s)|(?:;\s*\d+(?:st|nd|rd|th)\s)|$)/gi;
  for (const entryMatch of match[1].matchAll(pattern)) {
    const level = Number(entryMatch[1]);
    const name = String(entryMatch[2] ?? '')
      .replace(/\s*\([^)]*\)\s*$/u, '')
      .trim();
    const slug = getFeatFilterSlug({ name });
    if (!Number.isFinite(level) || !slug) continue;
    entries.push({ level, slug, name });
  }

  return entries;
}

async function collectAdditionalFeatEntriesFromDedication(feat, documentResolver) {
  const descriptionHtml = feat.system?.description?.value ?? '';
  const directEntries = parseAdditionalFeatEntries(descriptionHtml);
  if (directEntries.length > 0) return directEntries;

  const journalUuids = collectJournalUuids(feat);
  for (const uuid of journalUuids) {
    const document = await documentResolver(uuid).catch(() => null);
    const journalEntries = parseAdditionalFeatEntries(extractJournalHtml(document));
    if (journalEntries.length > 0) return journalEntries;
  }

  return [];
}

function collectJournalUuids(feat) {
  const values = new Set();
  const sources = [
    feat?.system?.description?.value,
    feat?.system?.description?.gm,
    feat?.system?.publication?.title,
    feat?.system?.publication?.authors,
  ];

  for (const source of sources) {
    const text = String(source ?? '');
    for (const match of text.matchAll(/Compendium\.pf2e\.journals\.JournalEntry\.[A-Za-z0-9]+/g)) {
      values.add(match[0]);
    }
    for (const match of text.matchAll(/@UUID\[([^\]]*Compendium\.pf2e\.journals\.JournalEntry\.[^\]]+)\]/g)) {
      values.add(match[1]);
    }
  }

  return [...values];
}

function extractJournalHtml(document) {
  if (!document) return '';

  const pageContents = [];
  const pages = Array.isArray(document.pages)
    ? document.pages
    : Array.isArray(document.pages?.contents)
      ? document.pages.contents
      : [];

  for (const page of pages) {
    const content = page?.text?.content ?? page?.system?.text?.content ?? '';
    if (content) pageContents.push(content);
  }

  if (pageContents.length > 0) return pageContents.join('\n');
  return document?.text?.content ?? document?.system?.text?.content ?? '';
}

async function defaultDocumentResolver(uuid) {
  return fromUuid(uuid);
}

function parseAdditionalFeatUuidEntries(html) {
  const normalizedHtml = String(html ?? '');
  const match = normalizedHtml.match(/Additional Feats:\s*(.+?)(?=(?:<\/p>|<p><strong>|<strong>Special:|<strong>Access:|<strong>Prerequisites:|<strong>Requirements:|<strong>Frequency:|<strong>Trigger:|<strong>Effect:|$))/i);
  if (!match) return [];

  const entries = [];
  const patterns = [
    /(\d+)(?:st|nd|rd|th)\s+@UUID\[[^\]]+\]\{([^}]+)\}/gi,
    /(?:<strong>)?\s*(\d+)(?:st|nd|rd|th)\s*(?:<\/strong>)?\s*<a\b[^>]*data-uuid="([^"]+)"[^>]*>(?:<i\b[^>]*><\/i>)?\s*([^<]+)<\/a>/gi,
  ];

  for (const pattern of patterns) {
    for (const entryMatch of match[1].matchAll(pattern)) {
      const level = Number(entryMatch[1]);
      const name = String(entryMatch[3] ?? entryMatch[2] ?? '')
        .replace(/\s*\([^)]*\)\s*$/u, '')
        .trim();
      const slug = getFeatFilterSlug({ name });
      if (!Number.isFinite(level) || !slug) continue;
      entries.push({ level, slug, name });
    }
  }

  return entries;
}
