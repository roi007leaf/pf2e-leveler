import { SUBCLASS_TAGS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { capitalize } from '../utils/pf2e-api.js';
import { SUBCLASS_SPELLS, resolveSubclassSpells } from '../data/subclass-spells.js';
import { debug, warn } from '../utils/logger.js';

const ADVANCED_FOCUS_FEAT_SLUGS = ['advanced-bloodline', 'advanced-mystery', 'advanced-order', 'advanced-revelation'];
const GREATER_FOCUS_FEAT_SLUGS = ['greater-bloodline', 'greater-mystery', 'greater-order', 'greater-revelation'];
const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];

export async function applySpells(actor, plan, level) {
  const classDef = ClassRegistry.get(plan.classSlug);
  if (!classDef?.spellcasting) return [];

  const slots = classDef.spellcasting.slots[level];
  if (!slots) return [];

  const entries = await ensureSpellcastingEntries(actor, classDef);
  await updateSpellSlots(actor, entries, slots, classDef);

  const levelData = plan.levels[level];
  const addedSpells = await addPlannedSpells(actor, entries, levelData);

  // Add subclass granted spells for new ranks at this level
  const grantedSpells = await addGrantedSpells(actor, entries, classDef, plan, level);
  addedSpells.push(...grantedSpells);

  const focusSpells = await addSubclassFocusSpells(actor, classDef, plan, level);
  addedSpells.push(...focusSpells);

  // Scale divine font slots for Cleric
  await updateDivineFont(actor, plan, level);

  return addedSpells;
}

async function updateDivineFont(actor, plan, level) {
  if (plan.classSlug !== 'cleric') return;

  const fontEntry = actor.items?.find((i) =>
    i.type === 'spellcastingEntry' && i.name?.includes('Font'),
  );
  if (!fontEntry) return;

  // Font slots: 4 at level 1, 5 at level 5, 6 at level 15
  let maxSlots = 4;
  if (level >= 15) maxSlots = 6;
  else if (level >= 5) maxSlots = 5;

  // Find the highest spell rank for font slots
  const classDef = ClassRegistry.get(plan.classSlug);
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
  }

  return entries;
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
    system: {
      tradition: { value: config.tradition },
      prepared: { value: config.prepared },
      ability: { value: config.ability },
      proficiency: { value: 1 },
    },
  };
}

async function updateSpellSlots(actor, entries, slots, classDef) {
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
    updates.push(buildSlotUpdate(entries.primary, slots, 0));
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

async function addPlannedSpells(actor, entries, levelData) {
  const plannedSpells = [...(levelData?.spells ?? []), ...(levelData?.customSpells ?? [])];
  if (!plannedSpells.length) return [];

  const added = [];

  for (const spellPlan of plannedSpells) {
    const spell = await resolveSpell(spellPlan.uuid);
    if (!spell) continue;

    const entry = resolveTargetEntry(entries, spellPlan.entryType);
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
  if (!focusSpellUuid) return [];

  const spell = await resolveSpell(focusSpellUuid);
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

function resolveTargetEntry(entries, entryType) {
  if (entryType === 'apparition') return entries.apparition;
  if (entryType === 'animist') return entries.animist;
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
