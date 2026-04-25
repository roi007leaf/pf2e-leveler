import { getLevelData } from '../plan/plan-model.js';
import {
  buildFeatGrantRequirements,
  buildPlanFormulaProgressionRequirements,
  getAutomaticFeatGrantEntries,
  mergeFeatGrantEntries,
} from '../plan/feat-grants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { ClassRegistry } from '../classes/registry.js';
import { capitalize, slugify } from '../utils/pf2e-api.js';
import { warn } from '../utils/logger.js';
import { classUsesPhysicalSpellbook, ensureActorHasSpellbook } from '../utils/spellcasting-support.js';
import { ensureArchetypeSpellcastingEntries } from './apply-spells.js';

export async function applyFeatGrants(actor, plan, level) {
  const levelData = getLevelData(plan, level);
  const archetypeEntries = await ensureArchetypeSpellcastingEntries(actor, plan, level);
  const requirements = [
    ...await buildFeatGrantRequirements({
      actor,
      plan,
      level,
      feats: getLevelFeatEntries(levelData),
    }),
    ...await buildPlanFormulaProgressionRequirements({
      actor,
      plan,
      level,
    }),
  ];
  const grants = mergeFeatGrantEntries(
    levelData?.featGrants ?? [],
    getAutomaticFeatGrantEntries(requirements),
  );
  return applyFeatGrantEntries(actor, grants, { archetypeEntries, levelData });
}

export async function applyFeatGrantEntries(actor, grants = [], context = {}) {
  const applied = { items: [], formulas: [], spells: [] };

  for (const grant of grants) {
    const selections = Array.isArray(grant?.selections) ? grant.selections : [];
    if (selections.length === 0) continue;

    if (grant.kind === 'formula') {
      applied.formulas.push(...(await applyFormulaSelections(actor, selections)));
    } else if (grant.kind === 'item') {
      if (isAlchemicalFormulaSelectionGrant(selections)) {
        applied.formulas.push(...(await applyFormulaSelections(actor, selections)));
      } else {
        applied.items.push(...(await applyItemSelections(actor, selections)));
      }
    } else if (grant.kind === 'spell') {
      applied.spells.push(...(await applySpellSelections(actor, selections, grant, context)));
    }
  }

  return applied;
}

async function applyFormulaSelections(actor, selections) {
  const current = Array.isArray(actor?.system?.crafting?.formulas)
    ? foundry.utils.deepClone(actor.system.crafting.formulas)
    : [];
  const known = new Set(current.map((entry) => entry?.uuid).filter(Boolean));
  const added = [];

  for (const selection of selections) {
    const resolved = await resolveFormulaSelection(selection);
    if (!resolved?.uuid || known.has(resolved.uuid)) continue;
    current.push({ uuid: resolved.uuid });
    known.add(resolved.uuid);
    added.push({ uuid: resolved.uuid, name: resolved.name ?? resolved.uuid });
  }

  if (added.length > 0) {
    await actor.update({ 'system.crafting.formulas': current });
  }

  return added;
}

function getLevelFeatEntries(levelData) {
  return [
    'classFeats',
    'skillFeats',
    'generalFeats',
    'ancestryFeats',
    'archetypeFeats',
    'mythicFeats',
    'dualClassFeats',
    'customFeats',
  ].flatMap((key) => levelData?.[key] ?? []);
}

async function resolveFormulaSelection(selection) {
  if (!selection) return null;
  if (selection.uuid) return selection;
  const item = await findFormulaItem(selection);
  if (!item) return null;
  return {
    ...selection,
    uuid: item.uuid ?? item.sourceId ?? item.flags?.core?.sourceId,
    name: selection.name ?? item.name,
  };
}

async function findFormulaItem(selection) {
  const targetSlug = slugify(selection?.slug ?? selection?.name ?? '');
  const targetName = String(selection?.name ?? '').trim().toLowerCase();
  if (!targetSlug && !targetName) return null;

  for (const item of await loadFormulaItems()) {
    const itemSlug = slugify(item?.slug ?? item?.system?.slug ?? item?.name ?? '');
    const itemName = String(item?.name ?? '').trim().toLowerCase();
    if ((targetSlug && itemSlug === targetSlug) || (targetName && itemName === targetName)) return item;
  }
  return null;
}

async function loadFormulaItems() {
  const items = [];
  for (const key of getCompendiumKeysForCategory('equipment')) {
    const pack = game.packs.get(key);
    if (!pack) continue;
    items.push(...(await pack.getDocuments().catch(() => [])));
  }
  items.push(...getWorldItems());
  return items;
}

function getWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}

async function applyItemSelections(actor, selections) {
  const ownedSources = getOwnedSourceIds(actor);
  const toCreate = [];
  const applied = [];

  for (const selection of selections) {
    if (!selection?.uuid || ownedSources.has(selection.uuid)) continue;
    const item = await resolveUuid(selection.uuid);
    if (!item) continue;
    const itemData = foundry.utils.deepClone(item.toObject());
    toCreate.push(itemData);
    ownedSources.add(selection.uuid);
    applied.push({ uuid: selection.uuid, name: selection.name ?? item.name ?? selection.uuid });
  }

  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments('Item', toCreate);
  }

  return applied;
}

async function applySpellSelections(actor, selections, grant, context = {}) {
  const entry = await resolveSpellcastingEntry(actor, grant, context);
  if (!entry) {
    warn('Cannot apply feat-granted spells: no spellcasting entry found');
    return [];
  }

  const ownedSources = getOwnedSourceIds(actor);
  const toCreate = [];
  const applied = [];

  for (const selection of selections) {
    if (!selection?.uuid || ownedSources.has(selection.uuid)) continue;
    const spell = await resolveUuid(selection.uuid);
    if (!spell) continue;
    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system ??= {};
    spellData.system.location = { value: entry.id };
    toCreate.push(spellData);
    ownedSources.add(selection.uuid);
    applied.push({ uuid: selection.uuid, name: selection.name ?? spell.name ?? selection.uuid });
  }

  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments('Item', toCreate);
  }

  return applied;
}

async function resolveSpellcastingEntry(actor, grant, context = {}) {
  const targetEntryId = grant?.targetEntryId ?? grant?.manual?.targetEntryId ?? null;
  const items = getActorItems(actor);
  if (targetEntryId) {
    const target = items.find((item) => item?.type === 'spellcastingEntry' && item.id === targetEntryId);
    if (target) return target;
  }

  const archetypeClassSlug = inferGrantArchetypeClassSlug(grant, context);
  if (archetypeClassSlug) {
    const staged = context.archetypeEntries?.[`archetype:${archetypeClassSlug}`];
    if (staged) return staged;
    const existing = items.find((item) =>
      item?.type === 'spellcastingEntry'
      && item?.flags?.['pf2e-leveler']?.archetypeSpellcastingEntry === archetypeClassSlug,
    );
    if (existing) {
      await ensureGrantArchetypeCantripSlots(actor, existing, grant);
      return existing;
    }

    const created = await createGrantArchetypeSpellcastingEntry(actor, archetypeClassSlug, grant);
    if (created) return created;
  }

  return items.find((item) =>
    item?.type === 'spellcastingEntry'
    && item?.system?.prepared?.value !== 'focus',
  ) ?? null;
}

async function createGrantArchetypeSpellcastingEntry(actor, classSlug, grant) {
  const classDef = ClassRegistry.get(classSlug);
  if (!classDef?.spellcasting) return null;

  const cantripSlots = getGrantCantripSlotCount(grant);
  const entryData = {
    name: `${capitalize(classSlug)} Dedication Spells`,
    type: 'spellcastingEntry',
    flags: {
      'pf2e-leveler': {
        archetypeSpellcastingEntry: classSlug,
      },
    },
    system: {
      tradition: { value: classDef.spellcasting.tradition ?? 'arcane' },
      prepared: { value: classDef.spellcasting.type ?? 'prepared' },
      ability: { value: classDef.keyAbility?.length === 1 ? classDef.keyAbility[0] : null },
      proficiency: { value: 1 },
      slots: {
        slot0: { max: cantripSlots, value: cantripSlots },
      },
    },
  };

  const created = await actor.createEmbeddedDocuments('Item', [entryData]);
  if (classUsesPhysicalSpellbook(classSlug)) await ensureActorHasSpellbook(actor);
  return created?.[0] ?? null;
}

async function ensureGrantArchetypeCantripSlots(actor, entry, grant) {
  const cantripSlots = getGrantCantripSlotCount(grant);
  if (cantripSlots <= 0 || !entry?.id) return;

  const currentMax = Number(entry.system?.slots?.slot0?.max ?? 0);
  const currentValue = Number(entry.system?.slots?.slot0?.value ?? 0);
  if (currentMax >= cantripSlots && currentValue >= cantripSlots) return;

  await actor.updateEmbeddedDocuments?.('Item', [{
    _id: entry.id,
    'system.slots.slot0.max': Math.max(currentMax, cantripSlots),
    'system.slots.slot0.value': Math.max(currentValue, cantripSlots),
  }]);
}

function inferGrantArchetypeClassSlug(grant, context = {}) {
  const sourceFeat = getSourceFeatEntry(grant, context);
  const fields = [
    grant?.sourceFeatName,
    sourceFeat?.name,
    sourceFeat?.slug,
    grant?.sourceFeatSlug,
    grant?.sourceFeatUuid,
    grant?.requirementId,
  ].map((value) => String(value ?? '').toLowerCase());

  for (const field of fields) {
    const match = field.match(/\b([a-z0-9-]+)-dedication\b/u)
      ?? field.match(/\b([a-z0-9-]+)\s+dedication\b/u);
    if (match?.[1]) return match[1].replace(/\s+/gu, '-');
  }

  return null;
}

function getGrantCantripSlotCount(grant) {
  const selections = Array.isArray(grant?.selections) ? grant.selections : [];
  const hasCantrips = selections.some((selection) => {
    const traits = (selection?.traits ?? []).map((trait) => String(trait).toLowerCase());
    if (traits.includes('cantrip')) return true;
    const rank = Number(selection?.rank ?? selection?.baseRank ?? selection?.system?.level?.value);
    return Number.isFinite(rank) && rank === 0;
  });
  return hasCantrips ? 2 : 0;
}

function isAlchemicalFormulaSelectionGrant(selections) {
  return selections.length > 0 && selections.every((selection) =>
    (selection?.traits ?? []).map((trait) => String(trait).toLowerCase()).includes('alchemical'));
}

function getSourceFeatEntry(grant, context = {}) {
  const sourceUuid = String(grant?.sourceFeatUuid ?? '').trim();
  const requirementPrefix = String(grant?.requirementId ?? '').split(':')[0] ?? '';
  const candidates = [
    'classFeats',
    'skillFeats',
    'generalFeats',
    'ancestryFeats',
    'archetypeFeats',
    'mythicFeats',
    'dualClassFeats',
    'customFeats',
  ].flatMap((key) => context.levelData?.[key] ?? []);

  return candidates.find((feat) =>
    (sourceUuid && feat?.uuid === sourceUuid)
    || (requirementPrefix && feat?.uuid === requirementPrefix),
  ) ?? null;
}

function getOwnedSourceIds(actor) {
  return new Set(
    getActorItems(actor)
      .map((item) => item?.sourceId ?? item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.uuid)
      .filter(Boolean),
  );
}

function getActorItems(actor) {
  if (Array.isArray(actor?.items)) return actor.items;
  if (Array.isArray(actor?.items?.contents)) return actor.items.contents;
  if (typeof actor?.items?.filter === 'function') return actor.items.filter(() => true);
  return [];
}

async function resolveUuid(uuid) {
  if (!uuid || typeof fromUuid !== 'function') return null;
  try {
    return await fromUuid(uuid);
  } catch {
    warn(`Failed to resolve feat grant UUID: ${uuid}`);
    return null;
  }
}
