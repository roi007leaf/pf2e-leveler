export function filterFeatsByCategory(feats, category, searchQuery, targetLevel, options = {}) {
  const normalizedQuery = normalizeQuery(searchQuery);
  const existingFeatNames = new Set();
  const includeDedications = !!options.includeDedications;
  const includeSkillFeats = !!options.includeSkillFeats;
  const additionalArchetypeFeatLevels = options.additionalArchetypeFeatLevels ?? new Map();

  return feats.filter((feat) => {
    const traits = feat.system.traits.value.map((t) => t.toLowerCase());
    const featMatchKeys = getAdditionalArchetypeMatchKeys(feat);
    const prerequisiteTexts = (feat.system?.prerequisites?.value ?? []).map((entry) => String(entry?.value ?? ''));
    const matchesCategory = matchesFeatCategory(traits, category, normalizedQuery, {
      includeDedications,
      includeSkillFeats,
      featMatchKeys,
      additionalArchetypeFeatLevels,
      prerequisiteTexts,
    });
    const unlockedLevel = getAdditionalArchetypeUnlockedLevel(additionalArchetypeFeatLevels, featMatchKeys);
    const hasNativeArchetypeTrait = traits.includes('archetype');
    const levelRequirement = category === 'archetype' && unlockedLevel != null && !hasNativeArchetypeTrait
      ? unlockedLevel
      : feat.system.level.value;
    const withinLevel = levelRequirement <= targetLevel;
    if (!matchesCategory || !withinLevel) return false;
    const notDuplicate = checkNotDuplicate(feat, existingFeatNames);

    return notDuplicate;
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
  const featMatchKeys = Array.isArray(options.featMatchKeys) ? options.featMatchKeys : [];
  const additionalArchetypeFeatLevels = options.additionalArchetypeFeatLevels ?? new Map();
  const isAdditionalArchetypeFeat = getAdditionalArchetypeUnlockedLevel(additionalArchetypeFeatLevels, featMatchKeys) != null;
  const prerequisiteTexts = Array.isArray(options.prerequisiteTexts) ? options.prerequisiteTexts : [];
  const hasDedicationPrerequisite = prerequisiteTexts.some((text) => /\bdedication\b/i.test(String(text ?? '')));
  const isSkillFeat = traits.includes('skill');
  switch (category) {
    case 'custom':
      return true;
    case 'class':
      return (queries.some((q) => traits.includes(q)) && !traits.includes('archetype'))
        || (includeDedications && (isAdditionalArchetypeFeat || hasDedicationPrerequisite) && !isSkillFeat)
        || (includeDedications && (traits.includes('dedication') || traits.includes('archetype')));
    case 'ancestry':
      return queries.some((q) => traits.includes(q));
    case 'skill':
      return isSkillFeat && (!traits.includes('archetype') || isAdditionalArchetypeFeat || hasDedicationPrerequisite);
    case 'general':
      return (traits.includes('general') && !traits.includes('archetype') && (includeSkillFeats || !traits.includes('skill')))
        || (includeSkillFeats && isAdditionalArchetypeFeat && traits.includes('skill'))
        || (includeSkillFeats && !traits.includes('general') && !traits.includes('archetype') && traits.includes('skill'));
    case 'archetype':
      return traits.includes('dedication')
        || ((traits.includes('archetype') || isAdditionalArchetypeFeat || hasDedicationPrerequisite) && !isSkillFeat);
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

export function filterBySkill(feats, skillSlugs, logic = 'or') {
  if (!skillSlugs || skillSlugs.length === 0) return feats;
  const normalizedSkills = skillSlugs.map((skill) => String(skill).toLowerCase());
  const skillLabels = getSkillLabels(normalizedSkills);

  return feats.filter((feat) => {
    const traits = (feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const prereqTexts = (feat.system.prerequisites?.value ?? []).map((p) => String(p.value ?? '').toLowerCase());

    const matchesSkill = (skill) => {
      const label = skillLabels.get(skill) ?? skill;
      return traits.includes(skill) || prereqTexts.some((text) => text.includes(skill) || text.includes(label));
    };

    return logic === 'and' ? normalizedSkills.every(matchesSkill) : normalizedSkills.some(matchesSkill);
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
  const existingArchetypeDedications = buildState?.archetypeDedications ?? new Set();
  const canTakeNewDedication = buildState?.canTakeNewArchetypeDedication !== false || buildState?.ignoreDedicationLock === true;

  return feats.filter((feat) => {
    const traits = (feat.system.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const isDedication = traits.includes('dedication');
    const isArchetype = traits.includes('archetype');
    const isMulticlassArchetype = isArchetype && traits.includes('multiclass');
    const isClassArchetype = isArchetype && traits.includes('class');
    const featSlug = feat.slug ?? null;

    if (isDedication && classSlug && isMulticlassArchetype && featSlug === `${classSlug}-dedication`) return false;

    if (featSlug && isDedication && !canTakeNewDedication && !existingArchetypeDedications.has(featSlug)) {
      return false;
    }

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
    const buildState = options.ignoreDedicationLock
      ? { ...(options.buildState ?? {}), ignoreDedicationLock: true }
      : options.buildState;
    result = filterByArchetypeRestrictions(result, actor, buildState);
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

    const parsedEntries = await collectAdditionalFeatEntriesFromDedication(feat, documentResolver, feats);
    for (const entry of parsedEntries) {
      const matchKeys = getAdditionalArchetypeMatchKeys(entry, feats);
      for (const key of matchKeys) {
        const currentLevel = additionalFeatLevels.get(key);
        if (currentLevel == null || entry.level < currentLevel) {
          additionalFeatLevels.set(key, entry.level);
        }
      }
    }
  }

  return additionalFeatLevels;
}

export async function collectAdditionalArchetypeFeatTraits(feats, ownedFeatSlugs, options = {}) {
  const ownedSlugs = ownedFeatSlugs instanceof Set ? ownedFeatSlugs : new Set(ownedFeatSlugs ?? []);
  const additionalFeatTraits = new Map();
  const documentResolver = options.documentResolver ?? defaultDocumentResolver;

  for (const feat of feats) {
    const slug = getFeatFilterSlug(feat);
    if (!slug || !ownedSlugs.has(slug) || !isArchetypeDedication(feat)) continue;

    const dedicationTraits = getAdditionalArchetypeTraits(feat);
    if (dedicationTraits.size === 0) continue;

    const parsedEntries = await collectAdditionalFeatEntriesFromDedication(feat, documentResolver, feats);
    for (const entry of parsedEntries) {
      for (const key of getAdditionalArchetypeMatchKeys(entry, feats)) {
        if (!additionalFeatTraits.has(key)) additionalFeatTraits.set(key, new Set());
        const target = additionalFeatTraits.get(key);
        for (const trait of dedicationTraits) target.add(trait);
      }
    }
  }

  return additionalFeatTraits;
}

function buildCategoryQuery(category, actor, buildState) {
  switch (category) {
    case 'custom':
      return '';
    case 'class':
      return buildState?.class?.slug || actor?.class?.slug || '';
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

export function getAdditionalArchetypeMatchKeys(entry, feats = null) {
  const keys = new Set();
  const featSlug = getFeatFilterSlug(entry);
  if (featSlug) keys.add(featSlug);
  if (entry?.slug) keys.add(entry.slug);
  if (entry?.uuid) keys.add(entry.uuid);
  if (entry?.sourceId) keys.add(entry.sourceId);
  if (entry?.flags?.core?.sourceId) keys.add(entry.flags.core.sourceId);

  const normalizedName = normalizeAdditionalFeatName(entry?.name);
  if (normalizedName) keys.add(`name:${normalizedName}`);

  if (normalizedName && feats) {
    for (const feat of feats ?? []) {
      const featName = normalizeAdditionalFeatName(feat?.name);
      if (featName !== normalizedName) continue;
      const featSlug = getFeatFilterSlug(feat);
      if (featSlug) keys.add(featSlug);
      if (feat?.uuid) keys.add(feat.uuid);
      if (feat?.sourceId) keys.add(feat.sourceId);
      if (feat?.flags?.core?.sourceId) keys.add(feat.flags.core.sourceId);
      keys.add(`name:${normalizedName}`);
    }
  }

  return [...keys];
}

function getAdditionalArchetypeUnlockedLevel(additionalArchetypeFeatLevels, featMatchKeys) {
  for (const key of featMatchKeys ?? []) {
    if (!key) continue;
    const level = additionalArchetypeFeatLevels.get(key);
    if (level != null) return level;
  }
  return null;
}

function normalizeAdditionalFeatName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isArchetypeDedication(feat) {
  const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  return traits.includes('archetype') && traits.includes('dedication');
}

function getAdditionalArchetypeTraits(feat) {
  const genericTraits = new Set(['archetype', 'dedication', 'class', 'multiclass', 'general', 'skill', 'mythic']);
  const traits = (feat?.system?.traits?.value ?? [])
    .map((trait) => String(trait).toLowerCase())
    .filter((trait) => trait && !genericTraits.has(trait));

  return new Set(traits);
}

function parseAdditionalFeatEntries(html) {
  const additionalSection = extractAdditionalFeatsSection(html);
  if (!additionalSection) return [];

  const uuidEntries = parseAdditionalFeatUuidEntries(additionalSection);
  if (uuidEntries.length > 0) return uuidEntries;

  const text = String(additionalSection ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const entries = [];
  for (const { level, content } of splitAdditionalFeatSegments(text)) {
    for (const rawName of splitAdditionalFeatNames(content)) {
      const name = String(rawName ?? '')
        .replace(/\s*\([^)]*\)\s*$/u, '')
        .trim();
      const slug = getFeatFilterSlug({ name });
      if (!Number.isFinite(level) || !slug) continue;
      entries.push({ level, slug, name });
    }
  }

  return entries;
}

async function collectAdditionalFeatEntriesFromDedication(feat, documentResolver, candidateFeats = []) {
  const descriptionHtml = feat.system?.description?.value ?? '';
  const directEntries = parseAdditionalFeatEntries(descriptionHtml);
  if (directEntries.length > 0) {
    return directEntries;
  }

  const journalUuids = new Set(collectJournalUuids(feat));
  if (journalUuids.size === 0) {
    const fallbackJournalUuid = await findArchetypeJournalUuid(feat);
    if (fallbackJournalUuid) journalUuids.add(fallbackJournalUuid);
  }
  if (journalUuids.size === 0) {
    return deriveDedicationEntriesFromPrerequisites(candidateFeats, feat);
  }
  const targetPageName = getArchetypeJournalLookupName(feat);
  for (const uuid of journalUuids) {
    const document = await documentResolver(uuid).catch(() => null);
    const journalHtml = extractJournalHtml(document, targetPageName);
    const journalEntries = parseAdditionalFeatEntries(journalHtml);
    const fallbackJournalEntries = journalEntries.length === 0
      ? parseArchetypeJournalFeatEntries(journalHtml, feat)
      : [];
    let resolvedEntries = journalEntries.length > 0 ? journalEntries : fallbackJournalEntries;
    const prereqFallbackEntries = resolvedEntries.length === 0
      ? deriveDedicationEntriesFromPrerequisites(candidateFeats, feat)
      : [];
    if (prereqFallbackEntries.length > 0) resolvedEntries = prereqFallbackEntries;
    if (resolvedEntries.length > 0) return resolvedEntries;
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

function extractJournalHtml(document, targetPageName = null) {
  if (!document) return '';

  const parentDocument = document?.parent;
  if (parentDocument && parentDocument !== document) {
    const parentPages = Array.isArray(parentDocument?.pages)
      ? parentDocument.pages
      : Array.isArray(parentDocument?.pages?.contents)
        ? parentDocument.pages.contents
        : [];
    if (parentPages.length > 0) {
      return extractJournalHtml(parentDocument, targetPageName);
    }
  }

  const pages = Array.isArray(document.pages)
    ? document.pages
    : Array.isArray(document.pages?.contents)
      ? document.pages.contents
      : [];

  const normalizedTarget = normalizeJournalName(targetPageName);
  if (normalizedTarget) {
    const matchingPage = pages.find((page) => normalizeJournalName(page?.name) === normalizedTarget)
      ?? pages.find((page) => normalizeJournalNameLoose(page?.name) === normalizeJournalNameLoose(targetPageName))
      ?? pages.find((page) => normalizeJournalName(page?.name).includes(normalizedTarget))
      ?? pages.find((page) => normalizeJournalNameLoose(page?.name).includes(normalizeJournalNameLoose(targetPageName)));
    if (matchingPage) {
      return matchingPage?.text?.content ?? matchingPage?.system?.text?.content ?? '';
    }
  }

  const pageContents = [];

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

async function findArchetypeJournalUuid(feat) {
  const archetypeName = getArchetypeJournalLookupName(feat);
  if (!archetypeName) return null;

  const exactMatch = await findJournalUuidByName('pf2e.journals', archetypeName);
  if (exactMatch) return exactMatch;
  const pageMatch = await findJournalUuidByPageName('pf2e.journals', archetypeName);
  if (pageMatch) return pageMatch;

  for (const pack of iterateJournalPacks()) {
    if (pack?.collection === 'pf2e.journals') continue;
    const match = await findJournalUuidByName(pack.collection, archetypeName, pack);
    if (match) return match;
    const nestedPageMatch = await findJournalUuidByPageName(pack.collection, archetypeName, pack);
    if (nestedPageMatch) return nestedPageMatch;
  }

  return null;
}

function getArchetypeJournalLookupName(feat) {
  const name = String(feat?.name ?? '').trim();
  if (!name) return null;
  return name.replace(/\s+Dedication$/i, '').trim() || null;
}

function* iterateJournalPacks() {
  const packs = game?.packs;
  if (!packs) return;

  if (typeof packs.values === 'function') {
    yield* packs.values();
    return;
  }

  if (Array.isArray(packs)) {
    yield* packs;
    return;
  }

  if (typeof packs === 'object') {
    for (const value of Object.values(packs)) yield value;
  }
}

async function findJournalUuidByName(packKey, targetName, existingPack = null) {
  const pack = existingPack ?? game?.packs?.get?.(packKey);
  if (!pack) return null;

  const metadataType = String(pack.metadata?.type ?? pack.documentName ?? '').toLowerCase();
  if (metadataType && metadataType !== 'journalentry') return null;

  const index = typeof pack.getIndex === 'function'
    ? await pack.getIndex()
    : (pack.index?.contents ?? pack.index ?? []);
  const entries = Array.isArray(index) ? index : Array.from(index ?? []);
  const normalizedTarget = normalizeJournalName(targetName);

  for (const entry of entries) {
    const entryName = normalizeJournalName(entry?.name);
    if (entryName !== normalizedTarget) continue;
    const uuid = entry?.uuid
      ?? (entry?._id ? `Compendium.${pack.collection}.JournalEntry.${entry._id}` : null);
    if (uuid) return uuid;
  }

  return null;
}

async function findJournalUuidByPageName(packKey, targetName, existingPack = null) {
  const pack = existingPack ?? game?.packs?.get?.(packKey);
  if (!pack) return null;

  const metadataType = String(pack.metadata?.type ?? pack.documentName ?? '').toLowerCase();
  if (metadataType && metadataType !== 'journalentry') return null;

  const documents = typeof pack.getDocuments === 'function'
    ? await pack.getDocuments()
    : [];
  const normalizedTarget = normalizeJournalName(targetName);

  for (const document of documents) {
    const pages = Array.isArray(document?.pages)
      ? document.pages
      : Array.isArray(document?.pages?.contents)
        ? document.pages.contents
        : [];

    if (pages.some((page) => normalizeJournalName(page?.name) === normalizedTarget)) {
      return document?.uuid
        ?? (document?._id ? `Compendium.${pack.collection}.JournalEntry.${document._id}` : null);
    }
  }

  return null;
}

function normalizeJournalName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeJournalNameLoose(name) {
  return normalizeJournalName(name)
    .replace(/\s+archetype$/i, '')
    .replace(/\s+dedication$/i, '')
    .trim();
}

function parseAdditionalFeatUuidEntries(html) {
  const entries = [];
  for (const { level, content } of splitAdditionalFeatSegments(html)) {
    const segmentEntries = [];

    for (const entryMatch of content.matchAll(/@UUID\[([^\]]+)\]\{([^}]+)\}/gi)) {
      const uuid = String(entryMatch[1] ?? '').startsWith('Compendium.')
        ? String(entryMatch[1])
        : null;
      const name = String(entryMatch[2] ?? '')
        .replace(/\s*\([^)]*\)\s*$/u, '')
        .trim();
      const slug = getFeatFilterSlug({ name });
      if (!Number.isFinite(level) || !slug) continue;
      segmentEntries.push({ level, slug, name, uuid });
    }

    for (const entryMatch of content.matchAll(/<a\b[^>]*data-uuid="([^"]+)"[^>]*>(?:<i\b[^>]*><\/i>)?\s*([^<]+)<\/a>/gi)) {
      const uuid = String(entryMatch[1] ?? '').startsWith('Compendium.')
        ? String(entryMatch[1])
        : null;
      const name = String(entryMatch[2] ?? '')
        .replace(/\s*\([^)]*\)\s*$/u, '')
        .trim();
      const slug = getFeatFilterSlug({ name });
      if (!Number.isFinite(level) || !slug) continue;
      segmentEntries.push({ level, slug, name, uuid });
    }

    const deduped = new Map();
    for (const entry of segmentEntries) {
      deduped.set(entry.uuid ?? entry.slug, entry);
    }
    entries.push(...deduped.values());
  }

  return entries;
}

function parseArchetypeJournalFeatEntries(html, dedicationFeat = null) {
  const normalizedHtml = String(html ?? '');
  const entries = [];
  const seen = new Set();
  const dedicationName = normalizeAdditionalFeatName(dedicationFeat?.name);

  for (const match of normalizedHtml.matchAll(/<a\b[^>]*data-uuid="([^"]+)"[^>]*>(?:<i\b[^>]*><\/i>)?\s*([^<]+)<\/a>([\s\S]{0,400}?)Feat\s*(\d+)/gi)) {
    const uuid = String(match[1] ?? '').startsWith('Compendium.')
      ? String(match[1])
      : null;
    const name = String(match[2] ?? '')
      .replace(/\s*\([^)]*\)\s*$/u, '')
      .trim();
    const normalizedName = normalizeAdditionalFeatName(name);
    const level = Number(match[4]);
    const slug = getFeatFilterSlug({ name });
    if (!uuid || !slug || !Number.isFinite(level)) continue;
    if (normalizedName === dedicationName) continue;

    const key = `${uuid}|${level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ level, slug, name, uuid });
  }

  return entries;
}

function deriveDedicationEntriesFromPrerequisites(feats, dedicationFeat) {
  const dedicationName = normalizeAdditionalFeatName(dedicationFeat?.name);
  const dedicationSlug = getFeatFilterSlug(dedicationFeat);
  if (!dedicationName && !dedicationSlug) return [];

  const entries = [];
  const unlockedNames = new Set([dedicationName].filter(Boolean));
  const unlockedSlugPhrases = new Set([dedicationSlug ? dedicationSlug.replace(/-/g, ' ') : null].filter(Boolean));
  const seenEntrySlugs = new Set();

  let changed = true;
  while (changed) {
    changed = false;

    for (const feat of feats ?? []) {
      if (!feat || feat === dedicationFeat) continue;
      const traits = (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
      if (!traits.includes('archetype')) continue;

      const level = Number(feat.system?.level?.value ?? NaN);
      const slug = getFeatFilterSlug(feat);
      if (!Number.isFinite(level) || !slug || seenEntrySlugs.has(slug)) continue;

      const prereqTexts = (feat.system?.prerequisites?.value ?? [])
        .map((prereq) => normalizeAdditionalFeatName(prereq?.value))
        .filter(Boolean);

      const matchesUnlocked = prereqTexts.some((text) =>
        [...unlockedNames].some((name) => text.includes(name))
        || [...unlockedSlugPhrases].some((phrase) => text.includes(phrase)),
      );
      if (!matchesUnlocked) continue;

      seenEntrySlugs.add(slug);
      entries.push({
        level,
        slug,
        name: feat.name,
        uuid: feat.uuid ?? feat.sourceId ?? feat.flags?.core?.sourceId ?? null,
      });

      const featName = normalizeAdditionalFeatName(feat.name);
      if (featName) unlockedNames.add(featName);
      unlockedSlugPhrases.add(slug.replace(/-/g, ' '));
      changed = true;
    }
  }

  return entries.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function extractAdditionalFeatsSection(html) {
  const normalizedHtml = String(html ?? '');
  const stopPattern = '(?=(?:<p>\\s*<strong>\\s*(?:Special:|Access:|Prerequisites:|Requirements:|Frequency:|Trigger:|Effect:)|<strong>\\s*(?:Special:|Access:|Prerequisites:|Requirements:|Frequency:|Trigger:|Effect:)|<(?:h1|h2|h3|h4|h5|h6)\\b[^>]*>\\s*(?:Special|Access|Prerequisites|Requirements|Frequency|Trigger|Effect)\\s*</(?:h1|h2|h3|h4|h5|h6)>|Special:|Access:|Prerequisites:|Requirements:|Frequency:|Trigger:|Effect:|Critical Success:|Success:|Failure:|Critical Failure:|$))';

  const inlineMatch = normalizedHtml.match(new RegExp(`Additional Feats\\s*:\\s*(.+?)${stopPattern}`, 'is'));
  if (inlineMatch?.[1]) return inlineMatch[1].trim();

  const headingMatch = normalizedHtml.match(new RegExp(`<(?:h1|h2|h3|h4|h5|h6)\\b[^>]*>\\s*Additional Feats\\s*</(?:h1|h2|h3|h4|h5|h6)>\\s*(.+?)${stopPattern}`, 'is'));
  if (headingMatch?.[1]) return headingMatch[1].trim();

  const boldHeadingMatch = normalizedHtml.match(new RegExp(`<p>\\s*<strong>\\s*Additional Feats\\s*</strong>\\s*</p>\\s*(.+?)${stopPattern}`, 'is'));
  if (boldHeadingMatch?.[1]) return boldHeadingMatch[1].trim();

  return '';
}

function splitAdditionalFeatSegments(text) {
  const source = String(text ?? '')
    .replace(/<strong>\s*(\d+(?:st|nd|rd|th))\s*<\/strong>/gi, '$1 ');
  const pattern = /(\d+)(?:st|nd|rd|th)\s+/gi;
  const matches = [...source.matchAll(pattern)];
  const segments = [];

  for (let index = 0; index < matches.length; index++) {
    const current = matches[index];
    const next = matches[index + 1];
    const level = Number(current[1]);
    const start = current.index + current[0].length;
    const end = next ? next.index : source.length;
    const content = source.slice(start, end)
      .replace(/^[,;\s]+|[,;\s]+$/g, '')
      .trim();
    if (!Number.isFinite(level) || !content) continue;
    segments.push({ level, content });
  }

  return segments;
}

function splitAdditionalFeatNames(text) {
  return String(text ?? '')
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
