import { SPELLBOOK_CLASSES } from '../../constants.js';
import { BaseClassHandler } from './base.js';
import { resolveSubclassSpells } from '../../data/subclass-spells.js';
import { ClassRegistry } from '../../classes/registry.js';
import { capitalize } from '../../utils/pf2e-api.js';
import { classUsesPhysicalSpellbook, ensureActorHasSpellbook } from '../../utils/spellcasting-support.js';

const MAGUS_STUDIOUS_ENTRY_FLAG = 'magusStudiousEntry';

/**
 * Shared base for classes with spellcasting.
 * Handles granted spells (from data file + curriculum) and focus spells.
 * Subclasses override for class-specific behavior.
 */
export class CasterBaseHandler extends BaseClassHandler {
  needsSpellSelection(data, classDef) {
    if (data.subclass?.spellUuids?.length > 0) return true;
    if (!classDef?.spellcasting) return false;
    return classDef.spellcasting.type === 'spontaneous' || SPELLBOOK_CLASSES.includes(classDef.slug);
  }

  isSpellsComplete(data, maxCantrips, maxRank1) {
    const mc = maxCantrips ?? 1;
    const mr = maxRank1 ?? 0;
    return data.spells.cantrips.length >= mc && (mr <= 0 || data.spells.rank1.length >= mr);
  }

  needsNonCasterSpellStep(data) {
    return (data.subclass?.spellUuids?.length ?? 0) > 0;
  }

  getSpellbookCounts(_data, classDef) {
    if (classDef.slug === 'magus') {
      return { cantrips: 8, rank1: 4 };
    }
    return null;
  }

  getSpellContext(_data, classDef) {
    return { isMagus: classDef?.slug === 'magus' };
  }

  async resolveGrantedSpells(data) {
    const cantrips = [];
    const rank1s = [];
    const seen = new Set();

    await this._resolveCurriculum(data, cantrips, rank1s, seen);
    await this._resolveFromDataFile(data, cantrips, rank1s, seen);

    return { cantrips, rank1s };
  }

  async resolveFocusSpells(data) {
    const focusSpells = [];
    const seen = new Set();

    await this._resolveFocusFromDataFile(data, focusSpells, seen);
    if (focusSpells.length === 0) {
      await this._resolveFocusFromDescription(data, focusSpells, seen);
    }

    return focusSpells;
  }

  // ── Internal helpers ──────────────────────────────────────────────

  async _resolveCurriculum(data, cantrips, rank1s, seen) {
    const curriculum = data.subclass?.curriculum;
    if (!curriculum) return;

    for (const uuid of (curriculum[0] ?? [])) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell?.system?.traits?.value?.includes('cantrip')) {
        cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: 'Curriculum' });
      }
    }
    for (const uuid of (curriculum[1] ?? [])) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell && (spell.system?.level?.value ?? 0) === 1) {
        rank1s.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: 'Curriculum' });
      }
    }
  }

  async _resolveFromDataFile(data, cantrips, rank1s, seen) {
    const subSlug = data.subclass?.slug;
    if (!subSlug) return;

    const rawChoices = data.subclass?.choices ?? {};
    const choices = {};
    for (const [k, v] of Object.entries(rawChoices)) {
      if (typeof v === 'string' && v !== '[object Object]') choices[k] = v;
    }

    const resolved = resolveSubclassSpells(subSlug, choices);
    if (!resolved) return;

    const src = data.subclass.name;
    if (resolved.cantrip && !seen.has(resolved.cantrip)) {
      seen.add(resolved.cantrip);
      const spell = await fromUuid(resolved.cantrip).catch(() => null);
      if (spell) cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: src });
    }
    if (resolved.rank1 && !seen.has(resolved.rank1)) {
      seen.add(resolved.rank1);
      const spell = await fromUuid(resolved.rank1).catch(() => null);
      if (spell) rank1s.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: src });
    }
  }

  async _resolveFocusFromDataFile(data, focusSpells, seen) {
    const subSlug = data.subclass?.slug;
    if (!subSlug) return;

    const resolved = resolveSubclassSpells(subSlug, data.subclass?.choices ?? {});
    if (!resolved?.focusSpell) return;

    const spell = await fromUuid(resolved.focusSpell).catch(() => null);
    if (spell) {
      seen.add(resolved.focusSpell);
      focusSpells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }
  }

  async applyExtras(actor, data) {
    await this._applySpellcasting(actor, data);
    await this._applyFocusSpells(actor, data);
  }

  async _applySpellcasting(actor, data) {
    const grantedUuids = new Set();

    const curriculum = data.subclass?.curriculum;
    if (curriculum) {
      for (const uuid of (curriculum[0] ?? [])) grantedUuids.add(uuid);
      for (const uuid of (curriculum[1] ?? [])) grantedUuids.add(uuid);
    }

    const subSlug = data.subclass?.slug;
    if (subSlug) {
      const resolved = resolveSubclassSpells(subSlug, data.subclass?.choices ?? {});
      if (resolved?.cantrip && data.class?.slug !== 'psychic') grantedUuids.add(resolved.cantrip);
      if (resolved?.rank1) grantedUuids.add(resolved.rank1);
    }

    const grantedEntries = [...grantedUuids].map((uuid) => ({ uuid, name: 'Granted' }));
    const allSpells = [...grantedEntries, ...data.spells.cantrips, ...data.spells.rank1];

    const classDef = data.class?.slug ? ClassRegistry.get(data.class.slug) : null;
    if (allSpells.length === 0 && !classDef?.spellcasting) return;

    await new Promise((r) => setTimeout(r, 200));

    let entry = actor.items?.find((i) => i.type === 'spellcastingEntry');

    if (entry && data.subclass?.tradition) {
      await entry.update({ 'system.tradition.value': data.subclass.tradition });
    }

    if (!entry && classDef?.spellcasting) {
      const sc = classDef.spellcasting;
      const tradition = this._resolveTradition(sc.tradition, data.subclass);
      const ability = classDef.keyAbility.length === 1 ? classDef.keyAbility[0] : 'cha';
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: `${capitalize(data.class.name)} Spells`,
        type: 'spellcastingEntry',
        system: {
          tradition: { value: tradition },
          prepared: { value: sc.type === 'dual' ? 'prepared' : sc.type },
          ability: { value: ability },
          proficiency: { value: 1 },
        },
      }]);
      entry = created[0];
    }

    if (!entry) return;

    if (classUsesPhysicalSpellbook(classDef?.slug)) {
      await ensureActorHasSpellbook(actor);
    }

    const actorLevel = Number(actor.system?.details?.level?.value ?? 1);
    const currentSlots = classDef?.spellcasting?.slots?.[actorLevel] ?? classDef?.spellcasting?.slots?.[1] ?? null;
    if (currentSlots) {
      const slotUpdate = this._buildPrimarySlotUpdate(entry, currentSlots, classDef);
      await actor.updateEmbeddedDocuments('Item', [slotUpdate]);
    }

    if (classDef?.slug === 'magus') {
      await this._ensureMagusStudiousEntry(actor, data, classDef, actorLevel);
    }

    for (const spellEntry of allSpells) {
      const spell = await fromUuid(spellEntry.uuid).catch(() => null);
      if (!spell) continue;
      const traits = spell.system?.traits?.value ?? [];
      if (traits.includes('focus')) continue;
      const rank = spell.system?.level?.value ?? 0;
      if (!traits.includes('cantrip') && rank > 1) continue;
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: entry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }
  }

  async _applyFocusSpells(actor, data) {
    const resolved = await this.resolveFocusSpells(data);
    const focusSpells = [];
    for (const entry of resolved) {
      const spell = await fromUuid(entry.uuid).catch(() => null);
      if (spell) focusSpells.push(spell);
    }

    if (focusSpells.length === 0) return;

    const classDef = data.class?.slug ? ClassRegistry.get(data.class.slug) : null;
    const tradition = classDef?.spellcasting
      ? this._resolveTradition(classDef.spellcasting.tradition, data.subclass)
      : 'arcane';
    const ability = classDef?.keyAbility?.length === 1 ? classDef.keyAbility[0] : 'cha';

    let focusEntry = actor.items?.find((i) => i.type === 'spellcastingEntry' && i.system?.prepared?.value === 'focus');
    if (!focusEntry) {
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: `${capitalize(data.class?.name ?? 'Focus')} Focus Spells`,
        type: 'spellcastingEntry',
        system: {
          tradition: { value: tradition },
          prepared: { value: 'focus' },
          ability: { value: ability },
          proficiency: { value: 1 },
        },
      }]);
      focusEntry = created[0];
    }

    for (const spell of focusSpells) {
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: focusEntry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }

    const currentMax = actor.system?.resources?.focus?.max ?? 0;
    const currentValue = actor.system?.resources?.focus?.value ?? 0;
    if (currentMax < 1 || currentValue < 1) {
      await actor.update({
        'system.resources.focus.max': Math.max(1, currentMax),
        'system.resources.focus.value': Math.max(1, currentValue),
      });
    }
  }

  _resolveTradition(tradition, subclass) {
    if (['bloodline', 'patron'].includes(tradition)) {
      return subclass?.tradition ?? 'arcane';
    }
    return tradition;
  }

  async _resolveFocusFromDescription(data, focusSpells, seen) {
    const uuids = data.subclass?.spellUuids ?? [];
    for (const uuid of uuids) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      const spell = await fromUuid(uuid).catch(() => null);
      if (!spell) continue;
      if (spell.system?.traits?.value?.includes('focus') && (spell.system?.level?.value ?? 0) <= 1) {
        focusSpells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
      }
    }
  }

  _buildPrimarySlotUpdate(entry, slots, classDef) {
    const update = { _id: entry.id };
    const shouldClearMissingRanks = classDef?.slug === 'magus';

    if (shouldClearMissingRanks) {
      update['system.slots.slot0.max'] = Number(slots.cantrips ?? 0);
      update['system.slots.slot0.value'] = Number(slots.cantrips ?? 0);
      for (let rank = 1; rank <= 10; rank += 1) {
        update[`system.slots.slot${rank}.max`] = 0;
        update[`system.slots.slot${rank}.value`] = 0;
      }
    }

    for (const [rank, counts] of Object.entries(slots)) {
      const max = Array.isArray(counts)
        ? (classDef?.slug === 'magus' ? counts[0] : counts[0] + counts[1])
        : counts;
      if (rank === 'cantrips') {
        update['system.slots.slot0.max'] = max;
        update['system.slots.slot0.value'] = max;
      } else {
        update[`system.slots.slot${rank}.max`] = max;
        update[`system.slots.slot${rank}.value`] = max;
      }
    }

    return update;
  }

  async _ensureMagusStudiousEntry(actor, data, classDef, actorLevel) {
    const studiousRank = getMagusStudiousRank(actorLevel);
    const existing = actor.items?.find((item) => this._isMagusStudiousEntry(item)) ?? null;

    if (!studiousRank) {
      if (existing?.id) {
        const clearUpdate = { _id: existing.id };
        for (let rank = 1; rank <= 10; rank += 1) {
          clearUpdate[`system.slots.slot${rank}.max`] = 0;
          clearUpdate[`system.slots.slot${rank}.value`] = 0;
        }
        await actor.updateEmbeddedDocuments('Item', [clearUpdate]);
      }
      return;
    }

    const tradition = this._resolveTradition(classDef.spellcasting.tradition, data.subclass);
    const ability = classDef.keyAbility.length === 1 ? classDef.keyAbility[0] : 'cha';
    let entry = existing;

    if (!entry) {
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: 'Magus Studious Spells',
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            [MAGUS_STUDIOUS_ENTRY_FLAG]: true,
          },
        },
        system: {
          tradition: { value: tradition },
          prepared: { value: classDef.spellcasting.type },
          ability: { value: ability },
          proficiency: { value: 1 },
        },
      }]);
      entry = created[0];
    }

    const update = { _id: entry.id };
    for (let rank = 1; rank <= 10; rank += 1) {
      update[`system.slots.slot${rank}.max`] = 0;
      update[`system.slots.slot${rank}.value`] = 0;
    }
    update[`system.slots.slot${studiousRank}.max`] = 2;
    update[`system.slots.slot${studiousRank}.value`] = 2;
    await actor.updateEmbeddedDocuments('Item', [update]);
  }

  _isMagusStudiousEntry(item) {
    if (item?.type !== 'spellcastingEntry') return false;
    if (item.flags?.['pf2e-leveler']?.[MAGUS_STUDIOUS_ENTRY_FLAG] === true) return true;
    return String(item?.name ?? '').toLowerCase().includes('studious');
  }
}

function getMagusStudiousRank(level) {
  const numericLevel = Number(level ?? 0);
  if (numericLevel >= 13) return 4;
  if (numericLevel >= 11) return 3;
  if (numericLevel >= 7) return 2;
  return 0;
}
