import { MAX_LEVEL, MIN_PLAN_LEVEL, SPELLBOOK_CLASSES, SUBCLASS_TAGS } from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { computeBuildState } from '../../plan/build-state.js';
import { getAllPlannedFeats, getLevelData, getPlanApparitions } from '../../plan/plan-model.js';
import { getSpellbookBonusCantripSelectionCount } from '../../plan/spellbook-feats.js';
import { loadCompendiumCategory } from '../character-wizard/loaders.js';
import { SUBCLASS_SPELLS, resolveSubclassSpells } from '../../data/subclass-spells.js';
import { collectArchetypeSpellcastingConfigs, normalizeSpellcastingFeatRecord } from '../../utils/spellcasting-support.js';

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
  const classSpellSections = await buildClassSpellSections(planner, classDef, level);
  const classFocusSections = await buildClassFocusSections(planner, classDef, level);

  if (!classDef.spellcasting) {
    const focusOnly = await getFocusSpellsForLevel(planner, level);
    const levelData = getLevelData(planner.plan, level) ?? {};
    const plannedSpells = normalizePlannedSpellsForDisplay(levelData.spells ?? []);
    const dedicationSpellSections = buildDedicationSpellSections(planner, level, plannedSpells);
    return {
      showSpells: classSpellSections.length > 0 || classFocusSections.length > 0 || focusOnly.showFocusSpells || dedicationSpellSections.length > 0,
      classSpellSections,
      classFocusSections,
      dedicationSpellSections,
      ...focusOnly,
    };
  }

  const primarySection = classSpellSections[0] ?? null;
  if (!primarySection) return { showSpells: false, classSpellSections: [] };

  const apparitionContext = await buildApparitionContext(planner, classDef, level);
  const levelData = getLevelData(planner.plan, level) ?? {};
  const plannedSpells = normalizePlannedSpellsForDisplay(levelData.spells ?? []);
  const dedicationSpellSections = buildDedicationSpellSections(planner, level, plannedSpells);
  const focusSpellData = await getFocusSpellsForLevel(planner, level);

  return {
    showSpells: true,
    classSpellSections,
    classFocusSections,
    spellTradition: primarySection.spellTradition,
    spellType: primarySection.spellType,
    isSpontaneous: primarySection.isSpontaneous,
    hasRankSpellSelections: primarySection.hasRankSpellSelections,
    hasSpellbook: primarySection.hasSpellbook,
    spellbookSelectionCount: primarySection.spellbookSelectionCount,
    spellbookCantripSelectionCount: primarySection.spellbookCantripSelectionCount,
    spellbookTotalSelectionCount: primarySection.spellbookTotalSelectionCount,
    plannedSpellbookSelectionCount: primarySection.plannedSpellbookSelectionCount,
    plannedSpellbookCantripCount: primarySection.plannedSpellbookCantripCount,
    showCustomSpellRankReminder: primarySection.showCustomSpellRankReminder,
    spellSlots: primarySection.spellSlots,
    hasNewRank: primarySection.hasNewRank,
    newRank: primarySection.newRank,
    plannedSpells: primarySection.plannedSpells,
    plannedSpellbookCantripSpells: primarySection.plannedSpellbookCantripSpells,
    dedicationSpellSections,
    highestRank: primarySection.highestRank,
    grantedSpells: primarySection.grantedSpells,
    showGrantedSpells: primarySection.showGrantedSpells,
    ...focusSpellData,
    ...apparitionContext,
  };
}

async function buildClassFocusSections(planner, classDef, level) {
  const sections = [];

  if (classDef?.spellcasting) {
    const primaryFocus = await getFocusSpellsForLevel(planner, level, classDef.slug);
    if (primaryFocus.showFocusSpells) {
      sections.push({
        classSlug: classDef.slug,
        ...primaryFocus,
      });
    }
  }

  const dualClassSlug = String(planner?.plan?.dualClassSlug ?? '').trim().toLowerCase();
  const primaryClassSlug = String(planner?.plan?.classSlug ?? '').trim().toLowerCase();
  if (dualClassSlug && dualClassSlug !== primaryClassSlug && ClassRegistry.has(dualClassSlug)) {
    const dualClassDef = ClassRegistry.get(dualClassSlug);
    if (dualClassDef?.spellcasting) {
      const secondaryFocus = await getFocusSpellsForLevel(planner, level, dualClassSlug);
      if (secondaryFocus.showFocusSpells) {
        sections.push({
          classSlug: dualClassSlug,
          ...secondaryFocus,
        });
      }
    }
  }

  return sections;
}

async function buildClassSpellSections(planner, classDef, level) {
  const sections = [];

  if (classDef?.spellcasting) {
    const primaryEntryType = classDef.spellcasting.type === 'dual' ? 'animist' : 'primary';
    const primarySection = await buildClassSpellSection(planner, classDef, level, primaryEntryType, classDef.slug);
    if (primarySection) sections.push(primarySection);
  }

  const dualClassSlug = String(planner?.plan?.dualClassSlug ?? '').trim().toLowerCase();
  const primaryClassSlug = String(planner?.plan?.classSlug ?? '').trim().toLowerCase();
  if (dualClassSlug && dualClassSlug !== primaryClassSlug && ClassRegistry.has(dualClassSlug)) {
    const dualClassDef = ClassRegistry.get(dualClassSlug);
    if (dualClassDef?.spellcasting) {
      const secondarySection = await buildClassSpellSection(planner, dualClassDef, level, `class:${dualClassSlug}`, dualClassSlug);
      if (secondarySection) sections.push(secondarySection);
    }
  }

  return sections;
}

async function buildClassSpellSection(planner, classDef, level, entryType, classSlug) {
  const slots = classDef?.spellcasting?.slots ?? {};
  const currentSlots = slots[level];
  if (!currentSlots) return null;

  const prevSlots = slots[level - 1] ?? getActorSpellCounts(planner);
  const levelData = getLevelData(planner.plan, level) ?? {};
  const allPlannedSpells = normalizePlannedSpellsForDisplay(levelData.spells ?? []);
  const sectionPlannedSpells = allPlannedSpells.filter((spell) => normalizeSectionEntryType(spell, classDef) === entryType);
  const rankSpells = sectionPlannedSpells.filter((spell) => !(spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0));
  const cantripSpells = sectionPlannedSpells.filter((spell) => spell.isCantrip === true || spell.rank === 0 || spell.displayRank === 0);
  const grantedSpells = await getGrantedSpellsForLevel(planner, classDef, level, classSlug);
  const spellSlots = buildSpellSlotDisplay(planner, currentSlots, prevSlots, sectionPlannedSpells, grantedSpells);
  const hasNewRank = detectNewSpellRank(currentSlots, prevSlots);
  const highestRank = getHighestRank(currentSlots);
  const hasSpellbook = SPELLBOOK_CLASSES.includes(classDef.slug);
  const isSpontaneous = classDef.spellcasting.type === 'spontaneous';
  const spellbookSelectionCount = hasSpellbook ? 2 : 0;
  const spellbookCantripSelectionCount = hasSpellbook ? getSpellbookBonusCantripSelectionCount(planner.plan, level) : 0;

  return {
    classSlug,
    label: classSlug,
    entryType,
    spellTradition: classDef.spellcasting.tradition,
    spellType: classDef.spellcasting.type,
    isSpontaneous,
    hasRankSpellSelections: isSpontaneous,
    hasSpellbook,
    spellbookSelectionCount,
    spellbookCantripSelectionCount,
    spellbookTotalSelectionCount: spellbookSelectionCount + spellbookCantripSelectionCount,
    plannedSpellbookSelectionCount: hasSpellbook ? rankSpells.length : 0,
    plannedSpellbookCantripCount: hasSpellbook ? cantripSpells.length : 0,
    showCustomSpellRankReminder: hasNewRank && !hasSpellbook,
    spellSlots,
    hasNewRank,
    newRank: hasNewRank ? ordinalRank(highestRank) : null,
    plannedSpells: isSpontaneous ? sectionPlannedSpells : hasSpellbook ? rankSpells : sectionPlannedSpells,
    plannedSpellbookCantripSpells: hasSpellbook ? cantripSpells : [],
    highestRank,
    grantedSpells,
    showGrantedSpells: grantedSpells.length > 0,
  };
}

function normalizeSectionEntryType(spell, classDef) {
  const entryType = String(spell?.entryType ?? '').trim();
  if (entryType) return entryType;
  return classDef?.spellcasting?.type === 'dual' ? 'animist' : 'primary';
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
    const rankRows = Object.entries(config.rankSelectionCounts ?? {}).map(([rawRank, rawCount]) => {
      const rank = Number(rawRank);
      const count = Number(rawCount ?? 0);
      const planned = rankSpells.filter((spell) => Number(spell.displayRank ?? spell.rank ?? spell.baseRank ?? -1) === rank).length;
      return {
        rank,
        label: ordinalRank(rank),
        count,
        planned,
        remaining: Math.max(0, count - planned),
        isFull: planned >= count,
      };
    }).sort((a, b) => a.rank - b.rank);

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
  return collectArchetypeSpellcastingConfigs(feats, level, {
    resolveTradition: (classDef, classSlug) => resolveDedicationTradition(planner, classDef, classSlug),
  });
}

function collectPlannerSpellcastingFeats(planner, level) {
  const actorFeats = (planner.actor.items?.filter?.((item) => item?.type === 'feat') ?? []).map(normalizeSpellcastingFeatRecord);
  const actorSlugs = new Set(actorFeats.map((feat) => feat.slug).filter(Boolean));
  const plannedFeats = getAllPlannedFeats(planner.plan, level)
    .map((feat) => ({ ...feat, __plannedGroup: inferFeatPlanGroup(feat), level: feat?.level ?? findFeatLevel(planner, [feat?.slug].filter(Boolean)) ?? level }))
    .map(normalizeSpellcastingFeatRecord)
    .filter((feat) => feat.slug && !actorSlugs.has(feat.slug));

  return [...actorFeats, ...plannedFeats];
}

function inferFeatPlanGroup(feat) {
  const traits = (feat?.traits ?? feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  if (traits.includes('archetype')) return 'archetypeFeats';
  return null;
}

export function getDedicationSelectionLimitsForPlanner(planner, level, entryType) {
  const config = collectDedicationSpellcastingConfigs(planner, level)
    .find((entry) => entry.entryType === entryType);

  return {
    cantripSelectionCount: config?.cantripSelectionCount ?? 0,
    slotRanks: config?.slotRanks ?? [],
    rankSelectionCounts: config?.rankSelectionCounts ?? {},
    rankRaritySelections: config?.rankRaritySelections ?? {},
    rankLockedRarities: config?.rankLockedRarities ?? {},
    selectedRarities: config?.selectedRarities ?? null,
    lockedRarities: config?.lockedRarities ?? null,
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

export async function getFocusSpellsForLevel(planner, level, classSlug = null) {
  const subclassSlug = getSubclassSlug(planner, classSlug);
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

export function getSubclassSlug(planner, classSlug = null) {
  const targetClassSlug = String(classSlug ?? planner.plan.classSlug ?? '').trim().toLowerCase();
  planner._subclassSlugCache ??= new Map();
  if (planner._subclassSlugCache.has(targetClassSlug)) return planner._subclassSlugCache.get(targetClassSlug);
  const subclassTag = SUBCLASS_TAGS[targetClassSlug];
  if (!subclassTag) {
    planner._subclassSlugCache.set(targetClassSlug, null);
    return null;
  }

  const subItem = planner.actor.items?.find((item) =>
    item.type === 'feat' && (item.system?.traits?.otherTags ?? []).includes(subclassTag),
  );
  const resolved = subItem?.slug ?? null;
  planner._subclassSlugCache.set(targetClassSlug, resolved);
  return resolved;
}

export function getSubclassItem(planner, classSlug = null) {
  const targetClassSlug = String(classSlug ?? planner.plan.classSlug ?? '').trim().toLowerCase();
  planner._subclassItemCache ??= new Map();
  if (planner._subclassItemCache.has(targetClassSlug)) return planner._subclassItemCache.get(targetClassSlug);
  const subclassTag = SUBCLASS_TAGS[targetClassSlug];
  if (!subclassTag) {
    planner._subclassItemCache.set(targetClassSlug, null);
    return null;
  }

  const resolved = planner.actor.items?.find((item) =>
    item.type === 'feat' && (item.system?.traits?.otherTags ?? []).includes(subclassTag),
  ) ?? null;
  planner._subclassItemCache.set(targetClassSlug, resolved);
  return resolved;
}

export function getSubclassChoices(planner, classSlug = null) {
  const item = getSubclassItem(planner, classSlug);
  const rawChoices = item?.flags?.pf2e?.rulesSelections ?? {};
  const choices = {};

  for (const [key, value] of Object.entries(rawChoices)) {
    if (typeof value === 'string' && value !== '[object Object]') {
      choices[key] = value;
    }
  }

  return choices;
}

export async function getGrantedSpellsForLevel(planner, classDef, level, classSlug = null) {
  const subclassSlug = getSubclassSlug(planner, classSlug);
  if (!subclassSlug || !classDef?.spellcasting) return [];
  const subclassChoices = getSubclassChoices(planner, classSlug);

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
