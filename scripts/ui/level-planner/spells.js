import { MAX_LEVEL, MIN_PLAN_LEVEL, SPELLBOOK_CLASSES, SUBCLASS_TAGS } from '../../constants.js';
import { computeBuildState } from '../../plan/build-state.js';
import { getLevelData } from '../../plan/plan-model.js';
import { SUBCLASS_SPELLS, resolveSubclassSpells } from '../../data/subclass-spells.js';

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
  const plannedSpells = levelData.spells ?? [];
  const grantedSpells = await getGrantedSpellsForLevel(planner, classDef, level);
  const spellSlots = buildSpellSlotDisplay(planner, currentSlots, prevSlots, plannedSpells, grantedSpells);
  const hasNewRank = detectNewSpellRank(currentSlots, prevSlots);
  const highestRank = getHighestRank(currentSlots);
  const newRank = hasNewRank ? ordinalRank(highestRank) : null;

  const apparitionContext = buildApparitionContext(classDef, level);

  const hasSpellbook = SPELLBOOK_CLASSES.includes(classDef.slug);
  const isSpontaneous = classDef.spellcasting.type === 'spontaneous';
  const hasRankSpellSelections = isSpontaneous;
  const spellbookSelectionCount = hasSpellbook ? 2 : 0;

  const focusSpellData = await getFocusSpellsForLevel(planner, level);

  return {
    showSpells: true,
    spellTradition: classDef.spellcasting.tradition,
    spellType: classDef.spellcasting.type,
    isSpontaneous,
    hasRankSpellSelections,
    hasSpellbook,
    spellbookSelectionCount,
    spellSlots,
    hasNewRank,
    newRank,
    plannedSpells: (isSpontaneous || hasSpellbook) ? plannedSpells : [],
    highestRank,
    grantedSpells,
    showGrantedSpells: grantedSpells.length > 0,
    ...focusSpellData,
    ...apparitionContext,
  };
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

export function buildApparitionContext(classDef, level) {
  if (!classDef.apparitions) return { showApparitions: false };

  const progression = classDef.apparitions.attunementProgression;
  const attunementSlots = progression[level];
  if (!attunementSlots) return { showApparitions: false };

  const focusPoolProgression = classDef.apparitions.focusPoolProgression;
  const newFocusPool = focusPoolProgression[level];

  return {
    showApparitions: true,
    attunementSlots,
    newFocusPool,
    availableApparitions: classDef.apparitions.list,
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
