import { SUBCLASS_TAGS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { capitalize } from '../utils/pf2e-api.js';
import { SUBCLASS_SPELLS, resolveSubclassSpells } from '../data/subclass-spells.js';
import { debug, warn } from '../utils/logger.js';
import {
  classUsesPhysicalSpellbook,
  collectArchetypeSpellcastingConfigs,
  ensureActorHasSpellbook,
  normalizeSpellcastingFeatRecord,
} from '../utils/spellcasting-support.js';

const ADVANCED_FOCUS_FEAT_SLUGS = ['advanced-bloodline', 'advanced-mystery', 'advanced-order', 'advanced-revelation'];
const GREATER_FOCUS_FEAT_SLUGS = ['greater-bloodline', 'greater-mystery', 'greater-order', 'greater-revelation'];
const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
const MAGUS_STUDIOUS_ENTRY_FLAG = 'magusStudiousEntry';
const SUBCLASS_FOCUS_SPELL_NAME_OVERRIDES = {
  'bloodline-draconic': {
    advanced: 'Dragon Breath',
  },
  'bloodline-wyrmblessed': {
    advanced: 'Dragon Breath',
  },
};

export async function applySpells(actor, plan, level) {
  const addedSpells = [];
  const classDefs = getTrackedSpellcastingClasses(plan);
  const archetypeEntries = await ensureArchetypeSpellcastingEntries(actor, plan, level);
  const customEntries = await ensureCustomPlannedSpellcastingEntries(actor, plan, level);
  const levelData = plan.levels[level];

  let appliedClassSpellcasting = false;
  for (const classDef of classDefs) {
    if (!classDef?.spellcasting) continue;
    const slots = classDef.spellcasting.slots[level];
    if (!slots) continue;

    const entries = await ensureSpellcastingEntries(actor, classDef);
    if (classUsesPhysicalSpellbook(classDef.slug)) await ensureActorHasSpellbook(actor);
    entries.archetypes = archetypeEntries;
    entries.custom = customEntries;
    await updateSpellSlots(actor, entries, slots, classDef, level);

    const planned = await addPlannedSpells(actor, entries, levelData, classDef.slug, classDef.slug === plan.classSlug);
    addedSpells.push(...planned);

    const grantedSpells = await addGrantedSpells(actor, entries, classDef, plan, level);
    addedSpells.push(...grantedSpells);

    const focusSpells = await addSubclassFocusSpells(actor, classDef, plan, level);
    addedSpells.push(...focusSpells);

    await updateDivineFont(actor, classDef, level);
    appliedClassSpellcasting = true;
  }

  if (!appliedClassSpellcasting && (Object.keys(archetypeEntries).length > 0 || Object.keys(customEntries).length > 0)) {
    const planned = await addPlannedSpells(actor, { archetypes: archetypeEntries, custom: customEntries }, levelData);
    addedSpells.push(...planned);
  }
  return addedSpells;
}

function getTrackedSpellcastingClasses(plan) {
  const classes = [];
  const primaryClassDef = ClassRegistry.get(plan.classSlug);
  if (primaryClassDef) classes.push(primaryClassDef);

  const dualClassSlug = String(plan?.dualClassSlug ?? '').trim().toLowerCase();
  if (dualClassSlug && dualClassSlug !== String(plan?.classSlug ?? '').trim().toLowerCase()) {
    const dualClassDef = ClassRegistry.get(dualClassSlug);
    if (dualClassDef) classes.push(dualClassDef);
  }

  return classes;
}

async function ensureCustomPlannedSpellcastingEntries(actor, plan, level) {
  const configs = collectCustomSpellcastingEntryConfigs(plan, level);
  if (configs.length === 0) return {};

  const entriesByType = {};
  for (const config of configs) {
    const entry = await findOrCreateEntry(actor, {
      name: config.name,
      tradition: config.tradition,
      prepared: config.prepared,
      ability: config.ability,
      flagKey: 'customSpellcastingEntry',
      flagValue: config.key,
    });
    entriesByType[`custom:${config.key}`] = entry;
  }
  return entriesByType;
}

async function updateDivineFont(actor, classDef, level) {
  if (classDef?.slug !== 'cleric') return;

  const fontEntry = actor.items?.find((i) =>
    i.type === 'spellcastingEntry' && i.name?.includes('Font'),
  );
  if (!fontEntry) return;

  // Font slots: 4 at level 1, 5 at level 5, 6 at level 15
  let maxSlots = 4;
  if (level >= 15) maxSlots = 6;
  else if (level >= 5) maxSlots = 5;

  // Find the highest spell rank for font slots
  const slots = classDef?.spellcasting?.slots?.[level];
  if (!slots) return;

  const ranks = Object.keys(slots).filter((k) => k !== 'cantrips').map(Number).filter((n) => !isNaN(n));
  const highestRank = Math.max(...ranks, 1);

  const update = { _id: fontEntry.id };
  // Clear old font slots
  for (let r = 1; r <= 10; r++) {
    update[`system.slots.slot${r}.max`] = 0;
    update[`system.slots.slot${r}.value`] = 0;
  }
  // Set new font slots at highest rank
  update[`system.slots.slot${highestRank}.max`] = maxSlots;
  update[`system.slots.slot${highestRank}.value`] = maxSlots;

  await actor.updateEmbeddedDocuments('Item', [update]);
  debug(`Updated divine font: ${maxSlots} slots at rank ${highestRank}`);
}

async function ensureSpellcastingEntries(actor, classDef) {
  const sc = classDef.spellcasting;
  const entries = {};
  const tradition = resolveActorTradition(actor, sc.tradition);
  const ability = resolveActorSpellAbility(actor, classDef);

  if (sc.type === 'dual') {
    entries.animist = await findOrCreateEntry(actor, {
      name: `${capitalize(classDef.slug)} Spells`,
      tradition,
      prepared: sc.animistType,
      ability,
    });
    entries.apparition = await findOrCreateEntry(actor, {
      name: 'Apparition Spells',
      tradition,
      prepared: sc.apparitionType,
      ability,
    });
  } else {
    entries.primary = await findOrCreateEntry(actor, {
      name: `${capitalize(classDef.slug)} Spells`,
      tradition,
      prepared: sc.type,
      ability,
    });
    if (classDef.slug === 'magus') {
      entries.studious = await findOrCreateEntry(actor, {
        name: 'Magus Studious Spells',
        tradition,
        prepared: sc.type,
        ability,
        flagKey: MAGUS_STUDIOUS_ENTRY_FLAG,
      });
    }
  }

  return entries;
}

async function ensureArchetypeSpellcastingEntries(actor, plan, level) {
  const configs = getArchetypeSpellcastingEntryConfigs(actor, plan, level);
  if (configs.length === 0) return {};

  const updates = [];
  const entriesByType = {};
  for (const config of configs) {
    const entry = await findOrCreateEntry(actor, config);
    if (config.requiresSpellbook) await ensureActorHasSpellbook(actor);
    entriesByType[`archetype:${config.flagValue}`] = entry;
    const update = buildArchetypeSpellcastingSlotUpdate(entry, config);
    if (update) updates.push(update);
  }

  if (updates.length > 0) {
    await actor.updateEmbeddedDocuments('Item', updates);
  }

  return entriesByType;
}

const VARIABLE_TRADITIONS = ['bloodline', 'patron'];

function resolveActorTradition(actor, tradition) {
  if (!VARIABLE_TRADITIONS.includes(tradition)) return tradition;
  const entry = actor.items?.find((i) => i.type === 'spellcastingEntry');
  return entry?.system?.tradition?.value ?? 'arcane';
}

function resolveActorSpellAbility(actor, classDef) {
  const entry = actor.items?.find((i) => i.type === 'spellcastingEntry');
  if (entry?.system?.ability?.value) return entry.system.ability.value;

  const keyAbility = classDef.keyAbility;
  return keyAbility.length === 1 ? keyAbility[0] : 'cha';
}

async function findOrCreateEntry(actor, config) {
  const existing = actor.items.find(
    (i) =>
      i.type === 'spellcastingEntry' &&
      (config.flagKey
        ? (
            (config.flagValue !== undefined
              ? i.flags?.['pf2e-leveler']?.[config.flagKey] === config.flagValue
              : i.flags?.['pf2e-leveler']?.[config.flagKey] === true)
            || (config.flagKey === MAGUS_STUDIOUS_ENTRY_FLAG && String(i.name ?? '').toLowerCase().includes('studious'))
          )
        : true) &&
      i.system.tradition?.value === config.tradition &&
      i.system.prepared?.value === config.prepared,
  );

  if (existing) {
    debug(`Found existing spellcasting entry: ${existing.name}`);
    return existing;
  }

  debug(`Creating spellcasting entry: ${config.name}`);
  const entryData = buildEntryData(config);
  const created = await actor.createEmbeddedDocuments('Item', [entryData]);
  return created[0];
}

function buildEntryData(config) {
  return {
    name: config.name,
    type: 'spellcastingEntry',
    ...(config.flagKey
      ? {
          flags: {
            'pf2e-leveler': {
              [config.flagKey]: config.flagValue ?? true,
            },
          },
        }
      : {}),
    system: {
      tradition: { value: config.tradition },
      prepared: { value: config.prepared },
      ability: { value: config.ability },
      proficiency: { value: 1 },
    },
  };
}

function getArchetypeSpellcastingEntryConfigs(actor, plan, level) {
  const feats = collectArchetypeSpellcastingFeats(actor, plan, level);
  return collectArchetypeSpellcastingConfigs(feats, level, {
    resolveTradition: (classDef, classSlug) => resolveArchetypeTradition(actor, classDef, classSlug),
    resolveAbility: (classDef) => resolveActorSpellAbility(actor, classDef),
  }).map((config) => ({
    ...config,
    flagKey: 'archetypeSpellcastingEntry',
    flagValue: config.classSlug,
  }));
}

function collectCustomSpellcastingEntryConfigs(plan, level) {
  const configs = [];
  const seen = new Set();
  for (const [rawLevel, levelData] of Object.entries(plan?.levels ?? {})) {
    if (Number(rawLevel) > Number(level)) continue;
    for (const entry of levelData?.customSpellEntries ?? []) {
      if (!entry?.key || seen.has(entry.key)) continue;
      configs.push(entry);
      seen.add(entry.key);
    }
  }
  return configs;
}

function collectArchetypeSpellcastingFeats(actor, plan, level) {
  const actorFeats = (actor.items?.filter((item) => item?.type === 'feat') ?? []).map(normalizeSpellcastingFeatRecord);
  const actorSlugs = new Set(actorFeats.map((feat) => feat.slug).filter(Boolean));
  const plannedFeats = collectPlannedArchetypeSpellcastingFeats(plan, level)
    .map(normalizeSpellcastingFeatRecord)
    .filter((feat) => feat.slug && !actorSlugs.has(feat.slug));

  return [...actorFeats, ...plannedFeats];
}

function collectPlannedArchetypeSpellcastingFeats(plan, level) {
  const levels = plan?.levels ?? {};
  const results = [];

  for (const [rawLevel, levelData] of Object.entries(levels)) {
    if (Number(rawLevel) > Number(level)) continue;
    if (!levelData) continue;
    for (const key of FEAT_KEYS) {
      const feats = levelData[key] ?? [];
      for (const feat of feats) {
        results.push({ ...feat, __plannedGroup: key, level: feat?.level ?? Number(rawLevel) });
      }
    }
  }

  return results;
}

function resolveArchetypeTradition(actor, classDef, classSlug) {
  const tradition = classDef?.spellcasting?.tradition ?? 'arcane';
  if (!VARIABLE_TRADITIONS.includes(tradition)) return tradition;

  const subclassTag = SUBCLASS_TAGS[classSlug];
  const subclassItem = actor.items?.find((item) =>
    item?.type === 'feat' && (item.system?.traits?.otherTags ?? []).includes(subclassTag),
  );
  const subclassTradition = subclassItem?.system?.tradition?.value ?? null;
  if (typeof subclassTradition === 'string' && subclassTradition.length > 0) return subclassTradition;

  const existingEntry = actor.items?.find((item) => item?.type === 'spellcastingEntry');
  return existingEntry?.system?.tradition?.value ?? 'arcane';
}

function buildArchetypeSpellcastingSlotUpdate(entry, config) {
  if (!entry?.id) return null;

  const update = { _id: entry.id };
  update['system.slots.slot0.max'] = Number(config.cantripCount ?? 0);
  update['system.slots.slot0.value'] = Number(config.cantripCount ?? 0);
  const enabledRanks = new Set(config.totalSlotRanks ?? config.slotRanks ?? []);

  for (let rank = 1; rank <= 10; rank += 1) {
    const enabled = enabledRanks.has(rank);
    update[`system.slots.slot${rank}.max`] = enabled ? 1 : 0;
    update[`system.slots.slot${rank}.value`] = enabled ? 1 : 0;
  }

  return update;
}

async function updateSpellSlots(actor, entries, slots, classDef, level) {
  const sc = classDef.spellcasting;
  const updates = [];

  if (sc.type === 'dual') {
    if (entries.animist) {
      updates.push(buildSlotUpdate(entries.animist, slots, 0));
    }
    if (entries.apparition) {
      updates.push(buildSlotUpdate(entries.apparition, slots, 1));
    }
  } else if (entries.primary) {
    if (classDef.slug === 'magus') {
      updates.push(buildBoundedPrimarySlotUpdate(entries.primary, slots));
      if (entries.studious) updates.push(buildMagusStudiousSlotUpdate(entries.studious, getMagusStudiousRankForLevel(level)));
    } else {
      updates.push(buildSlotUpdate(entries.primary, slots, 0));
    }
  }

  const validUpdates = updates.filter(Boolean);
  if (validUpdates.length > 0) {
    await actor.updateEmbeddedDocuments('Item', validUpdates);
    debug(`Updated spell slots for ${validUpdates.length} entries`);
  }
}

function buildSlotUpdate(entry, slots, slotIndex) {
  const update = { _id: entry.id };
  let hasChanges = false;

  for (const [rank, counts] of Object.entries(slots)) {
    if (rank === 'cantrips') continue;
    const newMax = Array.isArray(counts) ? counts[slotIndex] : counts;
    update[`system.slots.slot${rank}.max`] = newMax;
    update[`system.slots.slot${rank}.value`] = newMax;
    hasChanges = true;
  }

  return hasChanges ? update : null;
}

function buildBoundedPrimarySlotUpdate(entry, slots) {
  const update = { _id: entry.id };
  update['system.slots.slot0.max'] = Number(slots.cantrips ?? 0);
  update['system.slots.slot0.value'] = Number(slots.cantrips ?? 0);
  for (let rank = 1; rank <= 10; rank += 1) {
    update[`system.slots.slot${rank}.max`] = 0;
    update[`system.slots.slot${rank}.value`] = 0;
  }

  for (const [rank, counts] of Object.entries(slots)) {
    if (rank === 'cantrips') continue;
    const newMax = Array.isArray(counts) ? counts[0] : counts;
    update[`system.slots.slot${rank}.max`] = newMax;
    update[`system.slots.slot${rank}.value`] = newMax;
  }

  return update;
}

function buildMagusStudiousSlotUpdate(entry, studiousRank) {
  const update = { _id: entry.id };
  for (let rank = 1; rank <= 10; rank += 1) {
    update[`system.slots.slot${rank}.max`] = 0;
    update[`system.slots.slot${rank}.value`] = 0;
  }
  if (studiousRank > 0) {
    update[`system.slots.slot${studiousRank}.max`] = 2;
    update[`system.slots.slot${studiousRank}.value`] = 2;
  }
  return update;
}

function getMagusStudiousRankForLevel(level) {
  const numericLevel = Number(level ?? 0);
  if (numericLevel >= 13) return 4;
  if (numericLevel >= 11) return 3;
  if (numericLevel >= 7) return 2;
  return 0;
}

async function addPlannedSpells(actor, entries, levelData, classSlug = null, includeDefaultPrimary = true) {
  const plannedSpells = [...(levelData?.spells ?? []), ...(levelData?.customSpells ?? [])]
    .filter((spellPlan) => shouldApplyPlannedSpellToClass(spellPlan, classSlug, includeDefaultPrimary));
  if (!plannedSpells.length) return [];

  const added = [];

  for (const spellPlan of plannedSpells) {
    const spell = await resolveSpell(spellPlan.uuid);
    if (!spell) continue;

    const entry = resolveTargetEntry(actor, entries, spellPlan.entryType);
    if (!entry) continue;

    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: entry.id };
    if ((spellPlan.rank ?? 0) > (spell.system?.level?.value ?? 0)) {
      spellData.system.location.heightenedLevel = spellPlan.rank;
      spellData.system.heightenedLevel = spellPlan.rank;
    }

    const created = await actor.createEmbeddedDocuments('Item', [spellData]);
    if (created.length > 0) {
      added.push({ name: spellPlan.name, rank: spellPlan.rank });
      debug(`Added spell: ${spellPlan.name} to ${entry.name}`);
    }
  }

  return added;
}

function shouldApplyPlannedSpellToClass(spellPlan, classSlug, includeDefaultPrimary) {
  const entryType = String(spellPlan?.entryType ?? '').trim().toLowerCase();
  if (!entryType || entryType === 'primary') return includeDefaultPrimary;
  if (entryType.startsWith('class:')) {
    return entryType.slice('class:'.length) === String(classSlug ?? '').trim().toLowerCase();
  }
  return true;
}

async function addGrantedSpells(actor, entries, classDef, _plan, level) {
  const tag = SUBCLASS_TAGS[classDef.slug];
  if (!tag) return [];

  const subclassItem = actor.items?.find((i) =>
    i.type === 'feat' && (i.system?.traits?.otherTags ?? []).includes(tag),
  );
  if (!subclassItem?.slug) return [];
  const subclassChoices = getSubclassChoices(subclassItem);

  const slots = classDef.spellcasting.slots;
  const prevSlots = slots[level - 1];
  const currentSlots = slots[level];
  if (!currentSlots) return [];

  const added = [];
  const entry = entries.primary ?? entries.animist;
  if (!entry) return [];

  for (const rank of Object.keys(currentSlots)) {
    if (rank === 'cantrips') continue;
    const rankNum = parseInt(rank);
    if (isNaN(rankNum)) continue;
    if (prevSlots?.[rank]) continue;

    const resolved = resolveSubclassSpells(subclassItem.slug, subclassChoices, rankNum);
    if (!resolved?.grantedSpell) continue;

    const spell = await resolveSpell(resolved.grantedSpell);
    if (!spell) continue;

    const existing = actor.items?.find((i) => i.type === 'spell' && i.sourceId === spell.uuid);
    if (existing) continue;

    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: entry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);
    added.push({ name: spell.name, rank: rankNum });
    debug(`Added granted spell: ${spell.name} (rank ${rankNum})`);
  }

  return added;
}

async function addSubclassFocusSpells(actor, classDef, plan, level) {
  const tag = SUBCLASS_TAGS[classDef.slug];
  if (!tag) return [];

  const subclassItem = actor.items?.find((i) =>
    i.type === 'feat' && (i.system?.traits?.otherTags ?? []).includes(tag),
  );
  if (!subclassItem?.slug) return [];

  const focusTier = getNewSubclassFocusTier(plan, level);
  if (!focusTier) return [];

  const subclassData = SUBCLASS_SPELLS[subclassItem.slug];
  const focusSpellUuid = subclassData?.focusSpells?.[focusTier];
  const focusSpellNameOverride = SUBCLASS_FOCUS_SPELL_NAME_OVERRIDES[subclassItem.slug]?.[focusTier] ?? null;
  if (!focusSpellUuid && !focusSpellNameOverride) return [];

  let spell = focusSpellUuid ? await resolveSpell(focusSpellUuid) : null;
  if (focusSpellNameOverride && spell?.name !== focusSpellNameOverride) {
    const overrideSpell = await resolveSpellByName(focusSpellNameOverride);
    if (overrideSpell) spell = overrideSpell;
  }
  if (!spell) return [];

  const existing = actor.items?.find((i) =>
    i.type === 'spell' && (i.sourceId ?? i.flags?.core?.sourceId) === spell.uuid,
  );
  if (existing) return [];

  const focusEntry = await ensureFocusEntry(actor, classDef);
  if (!focusEntry) return [];

  const spellData = foundry.utils.deepClone(spell.toObject());
  spellData.system.location = { value: focusEntry.id };
  await actor.createEmbeddedDocuments('Item', [spellData]);
  await increaseFocusPool(actor, 1);
  debug(`Added subclass focus spell: ${spell.name} (${focusTier})`);

  return [{ name: spell.name }];
}

function getNewSubclassFocusTier(plan, level) {
  const feats = getPlannedFeatsForLevel(plan, level);
  if (feats.some((feat) => ADVANCED_FOCUS_FEAT_SLUGS.includes(feat.slug))) return 'advanced';
  if (feats.some((feat) => GREATER_FOCUS_FEAT_SLUGS.includes(feat.slug))) return 'greater';
  return null;
}

function getPlannedFeatsForLevel(plan, level) {
  const levelData = plan.levels?.[level];
  if (!levelData) return [];
  return FEAT_KEYS.flatMap((key) => levelData[key] ?? []);
}

async function ensureFocusEntry(actor, classDef) {
  let focusEntry = actor.items?.find((i) => i.type === 'spellcastingEntry' && i.system?.prepared?.value === 'focus');
  if (focusEntry) return focusEntry;

  const tradition = resolveActorTradition(actor, classDef.spellcasting?.tradition ?? 'arcane');
  const ability = resolveActorSpellAbility(actor, classDef);
  const created = await actor.createEmbeddedDocuments('Item', [{
    name: `${capitalize(classDef.slug)} Focus Spells`,
    type: 'spellcastingEntry',
    system: {
      tradition: { value: tradition },
      prepared: { value: 'focus' },
      ability: { value: ability },
      proficiency: { value: 1 },
    },
  }]);

  return created[0] ?? null;
}

async function increaseFocusPool(actor, addedSpells) {
  if (addedSpells <= 0) return;

  const currentMax = actor.system?.resources?.focus?.max ?? 0;
  const currentValue = actor.system?.resources?.focus?.value ?? 0;
  const newMax = Math.min(3, currentMax + addedSpells);
  const newValue = Math.max(currentValue, newMax);

  if (newMax > currentMax || newValue > currentValue) {
    await actor.update({
      'system.resources.focus.max': newMax,
      'system.resources.focus.value': newValue,
    });
  }
}

function getSubclassChoices(subclassItem) {
  const rawChoices = subclassItem?.flags?.pf2e?.rulesSelections ?? {};
  const choices = {};

  for (const [key, value] of Object.entries(rawChoices)) {
    if (typeof value === 'string' && value !== '[object Object]') {
      choices[key] = value;
    }
  }

  return choices;
}

function resolveTargetEntry(actor, entries, entryType) {
  if (entryType === 'apparition') return entries.apparition;
  if (entryType === 'animist') return entries.animist;
  if (typeof entryType === 'string' && entryType.startsWith('existing:')) {
    const itemId = entryType.slice('existing:'.length);
    return actor.items?.find?.((item) => item?.type === 'spellcastingEntry' && item.id === itemId) ?? null;
  }
  if (typeof entryType === 'string' && entryType.startsWith('custom:')) {
    const stagedEntry = entries?.custom?.[entryType];
    if (stagedEntry) return stagedEntry;
    const customKey = entryType.slice('custom:'.length);
    return actor.items?.find?.((item) =>
      item?.type === 'spellcastingEntry'
      && item?.flags?.['pf2e-leveler']?.customSpellcastingEntry === customKey,
    ) ?? null;
  }
  if (typeof entryType === 'string' && entryType.startsWith('archetype:')) {
    const stagedEntry = entries?.archetypes?.[entryType];
    if (stagedEntry) return stagedEntry;
    const classSlug = entryType.split(':')[1] ?? '';
    return actor.items?.find?.((item) =>
      item?.type === 'spellcastingEntry'
      && item?.flags?.['pf2e-leveler']?.archetypeSpellcastingEntry === classSlug,
    ) ?? null;
  }
  return entries.primary ?? entries.animist;
}

async function resolveSpell(uuid) {
  try {
    return await fromUuid(uuid);
  } catch {
    warn(`Failed to resolve spell: ${uuid}`);
    return null;
  }
}

async function resolveSpellByName(name) {
  const pack = game?.packs?.get?.('pf2e.spells-srd')
    ?? [...(game?.packs ?? [])].find((entry) => entry?.collection === 'pf2e.spells-srd');
  if (!pack) return null;

  const index = typeof pack.getIndex === 'function'
    ? await pack.getIndex({ fields: ['name'] })
    : (pack.index ?? []);
  const match = [...index].find((entry) => String(entry?.name ?? '').trim().toLowerCase() === String(name).trim().toLowerCase());
  if (!match) return null;

  const uuid = typeof match.uuid === 'string' && match.uuid.length > 0
    ? match.uuid
    : (typeof match._id === 'string' && match._id.length > 0 ? `Compendium.pf2e.spells-srd.Item.${match._id}` : null);
  return uuid ? resolveSpell(uuid) : null;
}
