import { ClassRegistry } from '../classes/registry.js';
import { capitalize } from './pf2e-api.js';

const NUMBER_WORDS = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

export const FEAT_SPELLCASTING_METADATA_VERSION = 1;

export function classUsesPhysicalSpellbook(classSlug) {
  const normalized = String(classSlug ?? '').trim().toLowerCase();
  return normalized === 'wizard' || normalized === 'magus';
}

export function getSpellcastingClassSlugs() {
  return ClassRegistry.getAll()
    .filter((classDef) => classDef?.slug && classDef?.spellcasting)
    .map((classDef) => String(classDef.slug).toLowerCase());
}

export function normalizeSpellcastingDescription(value) {
  return String(value ?? '')
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAuthoredDescription(feat) {
  return feat?._source?.system?.description?.value
    ?? feat?.system?.description?.value
    ?? feat?.description
    ?? '';
}

function parseCountToken(token) {
  const normalized = String(token ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS.get(normalized) ?? null;
}

function resolveMetadataClassSlug(feat, description) {
  const traits = (feat?.system?.traits?.value ?? feat?.traits ?? []).map((trait) => String(trait).toLowerCase());
  const aliases = (feat?.aliases ?? []).map((alias) => String(alias).toLowerCase());
  const text = `${String(feat?.name ?? '')} ${String(feat?.slug ?? '')} ${description}`.toLowerCase();

  for (const classSlug of getSpellcastingClassSlugs()) {
    if (traits.includes(classSlug)) return classSlug;
    if (aliases.includes(`${classSlug}-dedication`)) return classSlug;
    if (text.includes(`counts as ${classSlug} dedication`)) return classSlug;
    if (text.includes(`counts as the ${classSlug} dedication`)) return classSlug;

    const classDef = ClassRegistry.get(classSlug);
    const className = String(classDef?.name ?? '').toLowerCase();
    if (!className) continue;
    if (text.includes(`counts as ${className} dedication`)) return classSlug;
    if (text.includes(`counts as the ${className} dedication`)) return classSlug;
    if (text.includes(classSlug)) return classSlug;
  }

  return null;
}

function parseCantripGrant(description) {
  const normalized = String(description ?? '').toLowerCase();
  if (!normalized) return null;

  const patterns = [
    /spellbook with\s+(\w+)\s+(common|uncommon|rare|unique)?\s*(arcane|divine|occult|primal)?\s+cantrips?\s+of your choice/i,
    /gain(?:ing)?\s+(\w+)\s+(common|uncommon|rare|unique)?\s*(arcane|divine|occult|primal)?\s+cantrips?\s+of your choice/i,
    /learn(?:ing)?\s+(\w+)\s+(common|uncommon|rare|unique)?\s*(arcane|divine|occult|primal)?\s+cantrips?\s+of your choice/i,
    /(\w+)\s+(common|uncommon|rare|unique)?\s*(arcane|divine|occult|primal)?\s+cantrips?\s+of your choice/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const count = parseCountToken(match[1]);
    if (!Number.isFinite(count)) continue;
    return {
      count,
      rarity: match[2] ? String(match[2]).toLowerCase() : null,
      tradition: match[3] ? String(match[3]).toLowerCase() : null,
    };
  }

  return null;
}

function ordinalToRank(token) {
  const normalized = String(token ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const numeric = normalized.match(/^(\d+)(?:st|nd|rd|th)?$/i);
  if (numeric) return Number(numeric[1]);

  const lookup = new Map([
    ['first', 1],
    ['second', 2],
    ['third', 3],
    ['fourth', 4],
    ['fifth', 5],
    ['sixth', 6],
    ['seventh', 7],
    ['eighth', 8],
    ['ninth', 9],
    ['tenth', 10],
  ]);
  return lookup.get(normalized) ?? null;
}

function parseRankSpellGrants(description) {
  const normalized = String(description ?? '').toLowerCase();
  if (!normalized) return [];

  const patterns = [
    /(?:spellbook with|gain(?:ing)?|learn(?:ing)?)\s+(\w+)\s+(common|uncommon|rare|unique)?\s*(\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[-\s]*rank\s+(arcane|divine|occult|primal)?\s+spells?\s+of your choice/gi,
    /(\w+)\s+(common|uncommon|rare|unique)?\s*(\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[-\s]*rank\s+(arcane|divine|occult|primal)?\s+spells?\s+of your choice/gi,
  ];

  const grants = [];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const count = parseCountToken(match[1]);
      const rank = ordinalToRank(match[3]);
      if (!Number.isFinite(count) || !Number.isFinite(rank) || rank <= 0) continue;
      grants.push({
        count,
        rank,
        rarity: match[2] ? String(match[2]).toLowerCase() : null,
        tradition: match[4] ? String(match[4]).toLowerCase() : null,
      });
    }
  }

  return grants;
}

function buildLockedRarities(selectedRarity) {
  if (!selectedRarity) return null;
  const all = ['common', 'uncommon', 'rare', 'unique'];
  return all.filter((rarity) => rarity !== selectedRarity);
}

export function extractFeatSpellcastingMetadata(feat) {
  if (!feat) return null;

  const description = normalizeSpellcastingDescription(getAuthoredDescription(feat));
  const classSlug = resolveMetadataClassSlug(feat, description);
  if (!classSlug) return null;

  const classDef = ClassRegistry.get(classSlug);
  if (!classDef?.spellcasting) return null;

  const explicitCantripGrant = parseCantripGrant(description);
  const explicitRankGrants = parseRankSpellGrants(description);
  const firstRankGrantTradition = explicitRankGrants.find((grant) => grant.tradition)?.tradition ?? null;
  const tradition = explicitCantripGrant?.tradition ?? firstRankGrantTradition ?? classDef.spellcasting.tradition ?? 'arcane';
  const prepared = /\bprepare\b/i.test(description)
    ? 'prepared'
    : (classDef.spellcasting.type ?? 'prepared');
  const ability = classDef.keyAbility?.length === 1 ? classDef.keyAbility[0] : null;
  const selectedRarity = explicitCantripGrant?.rarity ?? null;
  const requiresSpellbook = classUsesPhysicalSpellbook(classSlug) || /\bspellbook\b/i.test(description);
  const rankSelectionCounts = Object.fromEntries(explicitRankGrants.map((grant) => [grant.rank, grant.count]));
  const rankRaritySelections = Object.fromEntries(
    explicitRankGrants
      .filter((grant) => grant.rarity)
      .map((grant) => [grant.rank, [grant.rarity]]),
  );
  const rankLockedRarities = Object.fromEntries(
    explicitRankGrants
      .filter((grant) => grant.rarity)
      .map((grant) => [grant.rank, buildLockedRarities(grant.rarity)]),
  );

  return {
    version: FEAT_SPELLCASTING_METADATA_VERSION,
    classSlug,
    name: `${capitalize(classSlug)} Dedication Spells`,
    tradition,
    prepared,
    ability,
    cantripCount: Number(explicitCantripGrant?.count ?? 2),
    cantripSelectionCount: Number(explicitCantripGrant?.count ?? 2),
    rankSelectionCounts,
    rankRaritySelections,
    rankLockedRarities,
    selectedRarities: selectedRarity ? [selectedRarity] : null,
    lockedRarities: buildLockedRarities(selectedRarity),
    requiresSpellbook,
  };
}

export function normalizeSpellcastingFeatRecord(feat) {
  const traits = new Set((feat?.system?.traits?.value ?? feat?.traits ?? []).map((trait) => String(trait).toLowerCase()));
  const slug = typeof feat?.slug === 'string' ? feat.slug : '';
  const name = typeof feat?.name === 'string' ? feat.name : '';
  const nameAndSlug = `${name} ${slug}`.toLowerCase();
  const metadata = feat?.spellcastingMetadata?.version === FEAT_SPELLCASTING_METADATA_VERSION
    ? feat.spellcastingMetadata
    : extractFeatSpellcastingMetadata(feat);

  if (feat?.__plannedGroup === 'archetypeFeats') traits.add('archetype');
  if (nameAndSlug.includes('dedication')) traits.add('dedication');
  if (metadata?.classSlug) traits.add(metadata.classSlug);
  for (const classSlug of getSpellcastingClassSlugs()) {
    if (nameAndSlug.includes(classSlug)) traits.add(classSlug);
  }

  return {
    ...feat,
    name,
    slug,
    spellcastingMetadata: metadata ?? null,
    system: {
      ...(feat?.system ?? {}),
      traits: {
        ...(feat?.system?.traits ?? {}),
        value: [...traits],
      },
    },
  };
}

function getSpellcastingFeatLevel(feat) {
  const directLevel = Number(feat?.level);
  if (Number.isFinite(directLevel) && directLevel > 0) return directLevel;

  const systemLevel = Number(feat?.system?.level?.taken ?? feat?.system?.level?.value);
  if (Number.isFinite(systemLevel) && systemLevel > 0) return systemLevel;

  return null;
}

function getFirstFeatSelectionLevel(feats) {
  const levels = feats
    .map((feat) => getSpellcastingFeatLevel(feat))
    .filter((level) => Number.isFinite(level));
  return levels.length > 0 ? Math.min(...levels) : null;
}

function getDedicationSpellcastingSlotRanks(feats, level) {
  const namesAndSlugs = feats.map((feat) => `${String(feat?.name ?? '').toLowerCase()} ${String(feat?.slug ?? '').toLowerCase()}`);
  const hasBasic = namesAndSlugs.some((value) => value.includes('basic') && value.includes('spellcasting'));
  const hasExpert = namesAndSlugs.some((value) => value.includes('expert') && value.includes('spellcasting'));
  const hasMaster = namesAndSlugs.some((value) => value.includes('master') && value.includes('spellcasting'));

  const ranks = [];
  if (hasBasic) {
    if (level >= 4) ranks.push(1);
    if (level >= 6) ranks.push(2);
    if (level >= 8) ranks.push(3);
  }
  if (hasExpert) {
    if (level >= 12) ranks.push(4);
    if (level >= 14) ranks.push(5);
    if (level >= 16) ranks.push(6);
  }
  if (hasMaster) {
    if (level >= 18) ranks.push(7);
    if (level >= 20) ranks.push(8);
  }

  return [...new Set(ranks)].sort((a, b) => a - b);
}

function getNewDedicationSpellcastingSlotRanks(feats, level) {
  const current = new Set(getDedicationSpellcastingSlotRanks(feats, level));
  const previous = new Set(getDedicationSpellcastingSlotRanks(feats, Math.max(0, level - 1)));
  return [...current].filter((rank) => !previous.has(rank)).sort((a, b) => a - b);
}

export function collectArchetypeSpellcastingConfigs(feats, level, options = {}) {
  const normalizedFeats = (feats ?? []).map(normalizeSpellcastingFeatRecord);
  if (normalizedFeats.length === 0) return [];

  const seen = new Set();
  const configs = [];

  for (const dedication of normalizedFeats) {
    const traits = (dedication.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    if (!traits.includes('dedication')) continue;

    const metadata = dedication.spellcastingMetadata ?? null;
    const classSlug = metadata?.classSlug ?? traits.find((trait) => {
      const classDef = ClassRegistry.get(trait);
      return !!classDef?.spellcasting;
    });
    if (!classSlug || seen.has(classSlug)) continue;

    const classDef = ClassRegistry.get(classSlug);
    if (!classDef?.spellcasting) continue;

    const classRelatedFeats = normalizedFeats.filter((feat) =>
      (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).includes(classSlug),
    );
    const dedicationLevel = getFirstFeatSelectionLevel(classRelatedFeats.filter((feat) =>
      (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).includes('dedication'),
    ));

    configs.push({
      classSlug,
      entryType: `archetype:${classSlug}`,
      name: metadata?.name ?? `${capitalize(classSlug)} Dedication Spells`,
      tradition: metadata?.tradition ?? options.resolveTradition?.(classDef, classSlug) ?? classDef.spellcasting.tradition ?? 'arcane',
      prepared: metadata?.prepared ?? classDef.spellcasting.type,
      ability: metadata?.ability ?? options.resolveAbility?.(classDef, classSlug) ?? (classDef.keyAbility?.length === 1 ? classDef.keyAbility[0] : null),
      cantripCount: Number(metadata?.cantripCount ?? 2),
      cantripSelectionCount: dedicationLevel === level ? Number(metadata?.cantripSelectionCount ?? metadata?.cantripCount ?? 2) : 0,
      rankSelectionCounts: buildRankSelectionCounts(metadata, level, dedicationLevel, classRelatedFeats),
      rankRaritySelections: dedicationLevel === level ? { ...(metadata?.rankRaritySelections ?? {}) } : {},
      rankLockedRarities: dedicationLevel === level ? { ...(metadata?.rankLockedRarities ?? {}) } : {},
      selectedRarities: metadata?.selectedRarities ?? null,
      lockedRarities: metadata?.lockedRarities ?? null,
      requiresSpellbook: metadata?.requiresSpellbook === true,
      totalSlotRanks: getDedicationSpellcastingSlotRanks(classRelatedFeats, level),
      slotRanks: getNewDedicationSpellcastingSlotRanks(classRelatedFeats, level),
    });
    seen.add(classSlug);
  }

  return configs;
}

function buildRankSelectionCounts(metadata, level, dedicationLevel, feats) {
  const counts = {};

  if (dedicationLevel === level) {
    for (const [rank, count] of Object.entries(metadata?.rankSelectionCounts ?? {})) {
      const numericRank = Number(rank);
      const numericCount = Number(count);
      if (!Number.isFinite(numericRank) || !Number.isFinite(numericCount) || numericRank <= 0 || numericCount <= 0) continue;
      counts[numericRank] = (counts[numericRank] ?? 0) + numericCount;
    }
  }

  for (const rank of getNewDedicationSpellcastingSlotRanks(feats, level)) {
    counts[rank] = (counts[rank] ?? 0) + 1;
  }

  return counts;
}

export async function ensureActorHasSpellbook(actor) {
  if (!actor) return null;

  const existing = actor.items?.find?.((item) => {
    const slug = String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase();
    const name = String(item?.name ?? '').trim().toLowerCase();
    return slug === 'spellbook' || name === 'spellbook';
  }) ?? null;
  if (existing) return existing;

  const pack = game.packs?.get?.('pf2e.equipment-srd');
  if (!pack) return null;

  let index = [];
  try {
    index = typeof pack.getIndex === 'function'
      ? Array.from(await pack.getIndex({ fields: ['system.slug', 'type', 'name'] }))
      : Array.from(pack.index ?? []);
  } catch {
    index = Array.from(pack.index ?? []);
  }

  const entry = index.find((item) => {
    const slug = String(item?.system?.slug ?? item?.slug ?? '').trim().toLowerCase();
    const name = String(item?.name ?? '').trim().toLowerCase();
    return (item?.type === 'book' || item?.type === 'equipment' || item?.type === 'backpack' || item?.type === 'treasure')
      && (slug === 'spellbook' || name === 'spellbook');
  }) ?? null;
  if (!entry?._id) return null;

  const document = await pack.getDocument(entry._id).catch(() => null);
  if (!document) return null;

  const created = await actor.createEmbeddedDocuments('Item', [foundry.utils.deepClone(document.toObject())]);
  return created[0] ?? null;
}
