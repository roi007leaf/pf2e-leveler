import { ClassRegistry } from '../classes/registry.js';
import { debug, warn } from '../utils/logger.js';

export async function applySpells(actor, plan, level) {
  const classDef = ClassRegistry.get(plan.classSlug);
  if (!classDef?.spellcasting) return [];

  const slots = classDef.spellcasting.slots[level];
  if (!slots) return [];

  const entries = await ensureSpellcastingEntries(actor, classDef);
  await updateSpellSlots(actor, entries, slots, classDef);

  const levelData = plan.levels[level];
  const addedSpells = await addPlannedSpells(actor, entries, levelData);

  return addedSpells;
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
  if (!levelData?.spells?.length) return [];

  const added = [];

  for (const spellPlan of levelData.spells) {
    const spell = await resolveSpell(spellPlan.uuid);
    if (!spell) continue;

    const entry = resolveTargetEntry(entries, spellPlan.entryType);
    if (!entry) continue;

    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: entry.id };

    const created = await actor.createEmbeddedDocuments('Item', [spellData]);
    if (created.length > 0) {
      added.push({ name: spellPlan.name, rank: spellPlan.rank });
      debug(`Added spell: ${spellPlan.name} to ${entry.name}`);
    }
  }

  return added;
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
