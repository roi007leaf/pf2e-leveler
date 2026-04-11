import { MAX_LEVEL, MIN_PLAN_LEVEL, SPELLBOOK_CLASSES, SUBCLASS_TAGS } from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { computeBuildState } from '../../plan/build-state.js';
import { getAllPlannedFeats, getLevelData, getPlanApparitions } from '../../plan/plan-model.js';
import { getSpellbookBonusCantripSelectionCount } from '../../plan/spellbook-feats.js';
import { loadCompendiumCategory } from '../character-wizard/loaders.js';
import { SUBCLASS_SPELLS, resolveSubclassSpells } from '../../data/subclass-spells.js';
import { capitalize } from '../../utils/pf2e-api.js';

function getCachedBuildState(planner, level) {
  planner._buildStateCache ??= new Map();
  if (!planner._buildStateCache.has(level)) {
    planner._buildStateCache.set(level, computeBuildState(planner.actor, planner.plan, level));
  }
  return planner._buildStateCache.get(level);
}

async function resolveDocuments(uuids) {
  return Promise.all((uuids ?? []).map((uuid) => fromUuid(uuid).catch(() => null)));
}

export async function buildSpellContext(planner, classDef, level) {
  if (!classDef.spellcasting) {
    const focusOnly = await getFocusSpellsForLevel(planner, level);
    return { showSpells: focusOnly.showFocusSpells, ...focusOnly };
  }

  const slots = classDef.spellcasting.slots;
  const currentSlots = slots[level];
  if (!currentSlots) return { showSpells: false };
  const prevSlots = slots[level - 1] ?? getActorSpellCounts(planner);

  const levelData = getLevelData(planner.plan, level) ?? {};
  const plannedSpells = normalizePlannedSpellsForDisplay(levelData.spells ?? []);
  const primaryPlannedSpells = plannedSpells.filter((spell) => (spell.entryType ?? 'primary') === 'primary');
  const primaryPlannedRankSpells = primaryPlannedSpells.filter((spell) => !(spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0));
  const primaryPlannedCantripSpells = primaryPlannedSpells.filter((spell) => spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0);
  const grantedSpells = await getGrantedSpellsForLevel(planner, classDef, level);
  const spellSlots = buildSpellSlotDisplay(planner, currentSlots, prevSlots, primaryPlannedSpells, grantedSpells);
  const hasNewRank = detectNewSpellRank(currentSlots, prevSlots);
  const highestRank = getHighestRank(currentSlots);
  const newRank = hasNewRank ? ordinalRank(highestRank) : null;

  const apparitionContext = await buildApparitionContext(planner, classDef, level);

  const hasSpellbook = SPELLBOOK_CLASSES.includes(classDef.slug);
  const isSpontaneous = classDef.spellcasting.type === 'spontaneous';
  const hasRankSpellSelections = isSpontaneous;
  const spellbookSelectionCount = hasSpellbook ? 2 : 0;
  const spellbookCantripSelectionCount = hasSpellbook
    ? getSpellbookBonusCantripSelectionCount(planner.plan, level)
    : 0;
  const spellbookTotalSelectionCount = spellbookSelectionCount + spellbookCantripSelectionCount;
  const plannedSpellbookSelectionCount = hasSpellbook
    ? primaryPlannedRankSpells.length
    : 0;
  const plannedSpellbookCantripCount = hasSpellbook
    ? primaryPlannedCantripSpells.length
    : 0;
  const showCustomSpellRankReminder = hasNewRank && !hasSpellbook;
  const dedicationSpellSections = buildDedicationSpellSections(planner, level, plannedSpells);

  const focusSpellData = await getFocusSpellsForLevel(planner, level);

  return {
    showSpells: true,
    spellTradition: classDef.spellcasting.tradition,
    spellType: classDef.spellcasting.type,
    isSpontaneous,
    hasRankSpellSelections,
    hasSpellbook,
    spellbookSelectionCount,
    spellbookCantripSelectionCount,
    spellbookTotalSelectionCount,
    plannedSpellbookSelectionCount,
    plannedSpellbookCantripCount,
    showCustomSpellRankReminder,
    spellSlots,
    hasNewRank,
    newRank,
    plannedSpells: isSpontaneous ? primaryPlannedSpells : hasSpellbook ? primaryPlannedRankSpells : [],
    plannedSpellbookCantripSpells: hasSpellbook ? primaryPlannedCantripSpells : [],
    dedicationSpellSections,
    highestRank,
    grantedSpells,
    showGrantedSpells: grantedSpells.length > 0,
    ...focusSpellData,
    ...apparitionContext,
  };
}

export function buildCustomSpellEntryOptions(planner, level) {
  const entries = [];

  for (const item of planner.actor.items ?? []) {
    if (item?.type !== 'spellcastingEntry') continue;
    if (item?.system?.prepared?.value === 'focus') continue;

    const archetypeKey = item?.flags?.['pf2e-leveler']?.archetypeSpellcastingEntry;
    entries.push({
      entryType: archetypeKey ? `archetype:${archetypeKey}` : `existing:${item.id}`,
      label: item.name ?? 'Spellcasting Entry',
      tradition: item.system?.tradition?.value ?? null,
      prepared: item.system?.prepared?.value ?? null,
      ability: item.system?.ability?.value ?? null,
      abilityLabel: String(item.system?.ability?.value ?? '').toUpperCase() || null,
      isCustom: false,
    });
  }

  for (let currentLevel = MIN_PLAN_LEVEL; currentLevel <= level; currentLevel++) {
    const levelData = getLevelData(planner.plan, currentLevel);
    for (const entry of levelData?.customSpellEntries ?? []) {
      if (!entry?.key) continue;
      entries.push({
        entryType: `custom:${entry.key}`,
        customKey: entry.key,
        label: entry.name ?? 'Spellcasting Entry',
        tradition: entry.tradition ?? null,
        prepared: entry.prepared ?? null,
        ability: entry.ability ?? null,
        abilityLabel: String(entry.ability ?? '').toUpperCase() || null,
        isCustom: true,
        createdAtLevel: currentLevel,
      });
    }
  }

  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.entryType)) return false;
    seen.add(entry.entryType);
    return true;
  });
}

function buildDedicationSpellSections(planner, level, plannedSpells) {
  const configs = collectDedicationSpellcastingConfigs(planner, level);
  return configs.map((config) => {
    const sectionSpells = plannedSpells.filter((spell) => spell.entryType === config.entryType);
    const cantripSpells = sectionSpells.filter((spell) => spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0);
    const rankSpells = sectionSpells.filter((spell) => !(spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0));
    const rankRows = config.slotRanks.map((rank) => {
      const planned = rankSpells.filter((spell) => Number(spell.displayRank ?? spell.rank ?? spell.baseRank ?? -1) === rank).length;
      return {
        rank,
        label: ordinalRank(rank),
        count: 1,
        planned,
        remaining: Math.max(0, 1 - planned),
        isFull: planned >= 1,
      };
    });

    return {
      ...config,
      plannedSpells: rankSpells,
      plannedCantripSpells: cantripSpells,
      plannedCantripCount: cantripSpells.length,
      remainingCantripSelections: Math.max(0, config.cantripSelectionCount - cantripSpells.length),
      rankRows,
    };
  }).filter((section) =>
    section.plannedSpells.length > 0
    || section.cantripSelectionCount > 0
    || section.rankRows.length > 0,
  );
}

export function getCustomSpellEntryLabel(planner, level, entryType) {
  return buildCustomSpellEntryOptions(planner, level).find((entry) => entry.entryType === entryType)?.label ?? null;
}

function collectDedicationSpellcastingConfigs(planner, level) {
  const feats = collectPlannerSpellcastingFeats(planner, level);
  if (feats.length === 0) return [];

  const seen = new Set();
  const configs = [];

  for (const dedication of feats) {
    const traits = (dedication.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    if (!traits.includes('dedication')) continue;

    const classSlug = traits.find((trait) => {
      const classDef = ClassRegistry.get(trait);
      return !!classDef?.spellcasting;
    });
    if (!classSlug || seen.has(classSlug)) continue;

    const classDef = ClassRegistry.get(classSlug);
    if (!classDef?.spellcasting) continue;

    const relatedFeats = feats.filter((feat) =>
      (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).includes(classSlug),
    );
    const dedicationLevel = getFirstFeatSelectionLevel(relatedFeats.filter((feat) =>
      (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase()).includes('dedication'),
    ));

    configs.push({
      entryType: `archetype:${classSlug}`,
      name: `${capitalize(classSlug)} Dedication Spells`,
      tradition: resolveDedicationTradition(planner, classDef, classSlug),
      prepared: classDef.spellcasting.type,
      cantripSelectionCount: dedicationLevel === level ? 2 : 0,
      slotRanks: getNewDedicationSpellcastingSlotRanks(relatedFeats, level),
    });
    seen.add(classSlug);
  }

  return configs;
}

function collectPlannerSpellcastingFeats(planner, level) {
  const actorFeats = (planner.actor.items?.filter?.((item) => item?.type === 'feat') ?? []).map(normalizeSpellcastingFeatRecord);
  const actorSlugs = new Set(actorFeats.map((feat) => feat.slug).filter(Boolean));
  const plannedFeats = getAllPlannedFeats(planner.plan, level)
    .map((feat) => ({ ...feat, __plannedGroup: inferFeatPlanGroup(feat) }))
    .map(normalizeSpellcastingFeatRecord)
    .filter((feat) => feat.slug && !actorSlugs.has(feat.slug));

  return [...actorFeats, ...plannedFeats];
}

function inferFeatPlanGroup(feat) {
  const traits = (feat?.traits ?? feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  if (traits.includes('archetype')) return 'archetypeFeats';
  return null;
}

function normalizeSpellcastingFeatRecord(feat) {
  const traits = new Set((feat?.system?.traits?.value ?? feat?.traits ?? []).map((trait) => String(trait).toLowerCase()));
  const slug = typeof feat?.slug === 'string' ? feat.slug : '';
  const name = typeof feat?.name === 'string' ? feat.name : '';
  const nameAndSlug = `${name} ${slug}`.toLowerCase();

  if (feat?.__plannedGroup === 'archetypeFeats') traits.add('archetype');
  if (nameAndSlug.includes('dedication')) traits.add('dedication');

  for (const classDef of ClassRegistry.getAll()) {
    if (!classDef?.slug || !classDef?.spellcasting) continue;
    if (nameAndSlug.includes(classDef.slug)) traits.add(classDef.slug);
  }

  return {
    ...feat,
    name,
    slug,
    system: {
      ...(feat?.system ?? {}),
      traits: {
        ...(feat?.system?.traits ?? {}),
        value: [...traits],
      },
    },
  };
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

function getFirstFeatSelectionLevel(feats) {
  const levels = feats
    .map((feat) => getSpellcastingFeatLevel(feat))
    .filter((level) => Number.isFinite(level));
  return levels.length > 0 ? Math.min(...levels) : null;
}

function getSpellcastingFeatLevel(feat) {
  const directLevel = Number(feat?.level);
  if (Number.isFinite(directLevel) && directLevel > 0) return directLevel;

  const systemLevel = Number(feat?.system?.level?.taken ?? feat?.system?.level?.value);
  if (Number.isFinite(systemLevel) && systemLevel > 0) return systemLevel;

  return null;
}

export function getDedicationSelectionLimitsForPlanner(planner, level, entryType) {
  const config = collectDedicationSpellcastingConfigs(planner, level)
    .find((entry) => entry.entryType === entryType);

  return {
    cantripSelectionCount: config?.cantripSelectionCount ?? 0,
    slotRanks: config?.slotRanks ?? [],
  };
}

function resolveDedicationTradition(planner, classDef, _classSlug) {
  const tradition = classDef?.spellcasting?.tradition ?? 'arcane';
  if (!['bloodline', 'patron'].includes(tradition)) return tradition;
  const entry = planner.actor.items?.find?.((item) => item.type === 'spellcastingEntry');
  return entry?.system?.tradition?.value ?? 'arcane';
}

export function shouldExcludeOwnedSpellIdentityForPlanner(classDef) {
  return SPELLBOOK_CLASSES.includes(classDef?.slug)
    && classDef?.spellcasting?.type !== 'spontaneous';
}

function normalizePlannedSpellsForDisplay(plannedSpells) {
  return (plannedSpells ?? []).map((spell) => {
    const rank = Number(spell?.rank);
    const baseRank = Number(spell?.baseRank);
    const displayRank = Number.isFinite(rank) && rank >= 0
      ? rank
      : (Number.isFinite(baseRank) ? baseRank : rank);

    return {
      ...spell,
      displayRank,
    };
  });
}

export async function getFocusSpellsForLevel(planner, level) {
  const subclassSlug = getSubclassSlug(planner);
  if (!subclassSlug) return { focusSpells: [], showFocusSpells: false };

  const data = SUBCLASS_SPELLS[subclassSlug];
  if (!data?.focusSpells) return { focusSpells: [], showFocusSpells: false };

  const buildState = getCachedBuildState(planner, level);
  const ownedFeats = buildState.feats ?? new Set();

  const advancedFeatSlugs = ['advanced-bloodline', 'advanced-mystery', 'advanced-order', 'advanced-revelation'];
  const greaterFeatSlugs = ['greater-bloodline', 'greater-mystery', 'greater-order', 'greater-revelation'];

  const hasAdvanced = advancedFeatSlugs.some((slug) => ownedFeats.has(slug));
  const hasGreater = greaterFeatSlugs.some((slug) => ownedFeats.has(slug));

  const entries = [];
  if (data.focusSpells.initial && level === 1) {
    entries.push({ uuid: data.focusSpells.initial, tier: 'Initial' });
  }
  if (data.focusSpells.advanced && hasAdvanced) {
    const featLevel = findFeatLevel(planner, advancedFeatSlugs);
    if (featLevel === level) entries.push({ uuid: data.focusSpells.advanced, tier: 'Advanced' });
  }
  if (data.focusSpells.greater && hasGreater) {
    const featLevel = findFeatLevel(planner, greaterFeatSlugs);
    if (featLevel === level) entries.push({ uuid: data.focusSpells.greater, tier: 'Greater' });
  }

  const resolvedSpells = await resolveDocuments(entries.map((entry) => entry.uuid));
  const spells = entries.map((entry, index) => {
    const spell = resolvedSpells[index];
    return {
      uuid: entry.uuid,
      name: spell?.name ?? `${entry.tier} Focus Spell`,
      img: spell?.img ?? 'icons/svg/mystery-man.svg',
      tier: entry.tier,
    };
  });

  return {
    focusSpells: spells,
    showFocusSpells: spells.length > 0,
    newFocusSpell: spells.length > 0,
  };
}

export function getSubclassSlug(planner) {
  if (planner._subclassSlug !== undefined) return planner._subclassSlug;
  const subclassTag = SUBCLASS_TAGS[planner.plan.classSlug];
  if (!subclassTag) {
    planner._subclassSlug = null;
    return null;
  }

  const subItem = planner.actor.items?.find((item) =>
    item.type === 'feat' && (item.system?.traits?.otherTags ?? []).includes(subclassTag),
  );
  planner._subclassSlug = subItem?.slug ?? null;
  return planner._subclassSlug;
}

export function getSubclassItem(planner) {
  if (planner._subclassItem !== undefined) return planner._subclassItem;
  const subclassTag = SUBCLASS_TAGS[planner.plan.classSlug];
  if (!subclassTag) {
    planner._subclassItem = null;
    return null;
  }

  planner._subclassItem = planner.actor.items?.find((item) =>
    item.type === 'feat' && (item.system?.traits?.otherTags ?? []).includes(subclassTag),
  ) ?? null;

  return planner._subclassItem;
}

export function getSubclassChoices(planner) {
  const item = getSubclassItem(planner);
  const rawChoices = item?.flags?.pf2e?.rulesSelections ?? {};
  const choices = {};

  for (const [key, value] of Object.entries(rawChoices)) {
    if (typeof value === 'string' && value !== '[object Object]') {
      choices[key] = value;
    }
  }

  return choices;
}

export async function getGrantedSpellsForLevel(planner, classDef, level) {
  const subclassSlug = getSubclassSlug(planner);
  if (!subclassSlug || !classDef?.spellcasting) return [];
  const subclassChoices = getSubclassChoices(planner);

  const slots = classDef.spellcasting.slots;
  const currentSlots = slots[level];
  const prevSlots = slots[level - 1];
  if (!currentSlots) return [];

  const grantedEntries = [];

  for (const rank of Object.keys(currentSlots)) {
    if (rank === 'cantrips') continue;
    const rankNum = parseInt(rank);
    if (Number.isNaN(rankNum)) continue;

    const prevHas = prevSlots?.[rank];
    if (prevHas) continue;

    const resolved = resolveSubclassSpells(subclassSlug, subclassChoices, rankNum);
    if (!resolved?.grantedSpell) continue;

    grantedEntries.push({ uuid: resolved.grantedSpell, rank: rankNum });
  }

  const resolvedSpells = await resolveDocuments(grantedEntries.map((entry) => entry.uuid));
  return grantedEntries.flatMap((entry, index) => {
    const spell = resolvedSpells[index];
    if (!spell) return [];
    return [{
      uuid: spell.uuid,
      name: spell.name,
      img: spell.img,
      rank: entry.rank,
    }];
  });
}

export function findFeatLevel(planner, slugs) {
  if (!planner.plan?.levels) return null;
  const featKeys = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats'];
  for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
    const levelData = planner.plan.levels[level];
    if (!levelData) continue;
    for (const key of featKeys) {
      const feats = levelData[key];
      if (!feats) continue;
      for (const feat of feats) {
        if (slugs.includes(feat.slug)) return level;
      }
    }
  }

  for (const item of planner.actor.items ?? []) {
    if (item.type === 'feat' && slugs.includes(item.slug)) {
      return item.system?.level?.taken ?? 1;
    }
  }
  return null;
}

export function buildSpellSlotDisplay(planner, currentSlots, prevSlots, plannedSpells, grantedSpells = []) {
  const plannedByRank = {};
  for (const spell of plannedSpells) {
    plannedByRank[spell.rank] = (plannedByRank[spell.rank] ?? 0) + 1;
  }
  const grantedByRank = {};
  for (const spell of grantedSpells) {
    grantedByRank[spell.rank] = (grantedByRank[spell.rank] ?? 0) + 1;
  }

  const display = [];
  for (const [rank, counts] of Object.entries(currentSlots)) {
    const isDual = Array.isArray(counts);
    const total = isDual ? counts[0] + counts[1] : counts;
    const primary = isDual ? counts[0] : counts;
    const secondary = isDual ? counts[1] : 0;

    if (rank === 'cantrips') {
      const prevCantrips = prevSlots?.cantrips;
      const prevTotal = prevCantrips == null ? 0 : (Array.isArray(prevCantrips) ? prevCantrips[0] + prevCantrips[1] : prevCantrips);
      const newCantrips = total - prevTotal;
      const planned = plannedByRank[0] ?? 0;
      display.push({
        rank: 'Cantrips',
        isCantrips: true,
        total,
        newSlots: newCantrips,
        planned,
        isFull: newCantrips <= 0 || planned >= newCantrips,
        hasNew: newCantrips > 0,
        isDual,
      });
      continue;
    }

    const rankNum = Number(rank);
    const prevVal = prevSlots?.[rank];
    const prevTotal = prevVal == null ? null : (Array.isArray(prevVal) ? prevVal[0] + prevVal[1] : prevVal);
    const isNew = prevTotal === null;
    const gainedSlots = isNew ? total : total - prevTotal;
    const grantedCount = grantedByRank[rankNum] ?? 0;
    const newSlots = Math.max(0, gainedSlots - grantedCount);
    const changed = isNew || prevTotal !== total;
    const planned = plannedByRank[rankNum] ?? 0;
    const isFull = planned >= newSlots;

    display.push({
      rank: planner._ordinalRank(rankNum),
      rankNum,
      primary,
      secondary,
      total,
      newSlots,
      gainedSlots,
      grantedCount,
      planned,
      hasNew: newSlots > 0,
      isFull,
      isDual,
      isNew,
      changed,
    });
  }
  return display;
}

export function detectNewSpellRank(currentSlots, prevSlots) {
  if (!prevSlots) return true;
  const currentRanks = Object.keys(currentSlots).filter((rank) => rank !== 'cantrips');
  const prevRanks = Object.keys(prevSlots).filter((rank) => rank !== 'cantrips');
  return currentRanks.length > prevRanks.length;
}

export function getHighestRank(slots) {
  const ranks = Object.keys(slots).filter((rank) => rank !== 'cantrips').map(Number);
  return Math.max(...ranks);
}

export function ordinalRank(rank) {
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${rank}${suffixes[rank] || 'th'}`;
}

export async function buildApparitionContext(planner, classDef, level) {
  if (!classDef.apparitions) return { showApparitions: false };

  const progression = classDef.apparitions.attunementProgression;
  const attunementSlots = progression[level];
  if (!attunementSlots) return { showApparitions: false };

  const focusPoolProgression = classDef.apparitions.focusPoolProgression;
  const newFocusPool = focusPoolProgression[level];

  const selected = planner?.plan ? getPlanApparitions(planner.plan) : [];
  const atMax = selected.length >= attunementSlots;

  const uuidMap = new Map();
  if (planner) {
    const docs = await loadCompendiumCategory(planner, 'classFeatures');
    for (const d of docs) {
      if (d.otherTags?.includes('animist-apparition') && d.slug) {
        uuidMap.set(d.slug, d.uuid);
      }
    }
  }

  return {
    showApparitions: true,
    attunementSlots,
    newFocusPool,
    availableApparitions: classDef.apparitions.list.map((a) => ({
      ...a,
      uuid: uuidMap.get(a.slug) ?? null,
      selected: selected.includes(a.slug),
      disabled: atMax && !selected.includes(a.slug),
    })),
    apparitionSelectedCount: selected.length,
  };
}

export function getActorSpellCounts(planner) {
  const spells = planner.actor.items?.filter?.((item) => item.type === 'spell') ?? [];
  if (spells.length === 0) return null;

  const counts = {};
  let cantripCount = 0;

  for (const spell of spells) {
    const isCantrip = spell.system?.traits?.value?.includes('cantrip');
    if (isCantrip) {
      cantripCount++;
    } else {
      const rank = spell.system?.level?.value ?? 0;
      if (rank > 0) counts[rank] = (counts[rank] ?? 0) + 1;
    }
  }

  if (cantripCount > 0) counts.cantrips = cantripCount;

  return Object.keys(counts).length > 0 ? counts : null;
}

export function resolveSpellTradition(planner, classDef) {
  const tradition = classDef.spellcasting.tradition;
  if (!['bloodline', 'patron'].includes(tradition)) return tradition;
  const entry = planner.actor.items?.find?.((item) => item.type === 'spellcastingEntry');
  return entry?.system?.tradition?.value ?? 'arcane';
}
