import { getActiveSystemId, SYSTEM_IDS } from '../system-support/profiles.js';
import { getBuildStateAncestryFeatTraits } from '../utils/ancestry-feat-traits.js';

const SF2E_JOURNAL_PACK = 'sf2e.journals';
const ANCESTRIES_JOURNAL_KEY = 'ancestries';
const STANDARDIZED_SECTION_HEADING = /<h2\b[^>]*>\s*Standardized Ancestry Feats\s*<\/h2>/i;
const NEXT_SECTION_HEADING = /<h2\b/i;
const SF2E_FEAT_UUID = /@UUID\[(Compendium\.sf2e\.feats\.Item\.[^\]]+)\]/gi;

let cachedPack = null;
let cachedIndexPromise = null;

export function buildStandardizedAncestryFeatIndex(pages = []) {
  const featUuidsByAncestry = new Map();
  const allFeatUuids = new Set();

  for (const page of pages) {
    const ancestryKey = normalizeAncestryKey(page?.name);
    if (!ancestryKey) continue;

    const section = getStandardizedSection(page?.text?.content);
    if (!section) continue;

    const featUuids = new Set();
    for (const match of section.matchAll(SF2E_FEAT_UUID)) {
      featUuids.add(match[1]);
      allFeatUuids.add(match[1]);
    }
    if (featUuids.size > 0) featUuidsByAncestry.set(ancestryKey, featUuids);
  }

  return { featUuidsByAncestry, allFeatUuids };
}

export async function getStandardizedAncestryFeatAccess(buildState, options = {}) {
  if (getActiveSystemId(options) !== SYSTEM_IDS.SF2E) return createEmptyAccess();

  const index = options.index ?? (await loadStandardizedAncestryFeatIndex(options));
  const accessibleStandardizedAncestryFeatUuids = new Set();
  const ancestryKeys = new Set(
    [
      ...getBuildStateAncestryFeatTraits(buildState),
      buildState?.ancestrySlug,
      buildState?.ancestry?.slug,
      buildState?.ancestry?.name,
    ]
      .map(normalizeAncestryKey)
      .filter(Boolean),
  );

  for (const ancestryKey of ancestryKeys) {
    const featUuids = index.featUuidsByAncestry.get(ancestryKey);
    if (!featUuids) continue;
    for (const uuid of featUuids) accessibleStandardizedAncestryFeatUuids.add(uuid);
  }

  return {
    standardizedAncestryFeatUuids: index.allFeatUuids,
    accessibleStandardizedAncestryFeatUuids,
  };
}

async function loadStandardizedAncestryFeatIndex(options) {
  const pack = options.pack ?? globalThis.game?.packs?.get?.(SF2E_JOURNAL_PACK);
  if (!pack) return createEmptyIndex();

  if (cachedPack !== pack || !cachedIndexPromise) {
    cachedPack = pack;
    cachedIndexPromise = buildIndexFromPack(pack);
  }
  return cachedIndexPromise;
}

async function buildIndexFromPack(pack) {
  const journalIndex = await pack.getIndex({ fields: ['name'] });
  const ancestryJournalEntry = Array.from(journalIndex ?? []).find(
    (entry) => normalizeAncestryKey(entry?.name) === ANCESTRIES_JOURNAL_KEY,
  );
  const journalId = ancestryJournalEntry?._id ?? ancestryJournalEntry?.id;
  const ancestryJournal = journalId ? await pack.getDocument(journalId) : null;
  return ancestryJournal
    ? buildStandardizedAncestryFeatIndex(Array.from(ancestryJournal.pages ?? []))
    : createEmptyIndex();
}

function getStandardizedSection(content) {
  const source = String(content ?? '');
  const heading = STANDARDIZED_SECTION_HEADING.exec(source);
  if (!heading) return '';

  const remainder = source.slice(heading.index + heading[0].length);
  const nextHeading = NEXT_SECTION_HEADING.exec(remainder);
  return nextHeading ? remainder.slice(0, nextHeading.index) : remainder;
}

function normalizeAncestryKey(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createEmptyIndex() {
  return {
    featUuidsByAncestry: new Map(),
    allFeatUuids: new Set(),
  };
}

function createEmptyAccess() {
  return {
    standardizedAncestryFeatUuids: new Set(),
    accessibleStandardizedAncestryFeatUuids: new Set(),
  };
}
