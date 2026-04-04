import { CasterBaseHandler } from './caster-base.js';
import { ClassRegistry } from '../../classes/registry.js';

/**
 * Animist: dual spellcasting at level 1.
 * Prepared entry: 2 cantrips + 1 rank-1 spell of your choice.
 * Apparition entry: 2 apparition cantrips + 1 rank-1 slot from the two attuned apparitions.
 * Focus entry: vessel spell from the primary apparition.
 */
export class AnimistHandler extends CasterBaseHandler {
  getExtraSteps() {
    return [
      { id: 'apparitions', label: 'Apparitions', visible: () => true },
    ];
  }

  needsSpellSelection(_data, _classDef) {
    return true;
  }

  getSpellbookCounts(_data, _classDef) {
    return { cantrips: 2, rank1: 1 };
  }

  isStepComplete(stepId, data) {
    if (stepId === 'apparitions') {
      return (data.apparitions?.length ?? 0) === 2
        && !!data.primaryApparition
        && data.apparitions.some((entry) => entry.uuid === data.primaryApparition);
    }
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'apparitions') return null;

    const apparitions = await wizard._loadApparitions();
    const selectedUuids = new Set((data.apparitions ?? []).map((entry) => entry.uuid));

    return {
      apparitions: apparitions.map((entry) => ({
        ...entry,
        selected: selectedUuids.has(entry.uuid),
        primary: data.primaryApparition === entry.uuid,
      })),
      selectedApparitions: data.apparitions ?? [],
      selectedApparitionsCount: (data.apparitions ?? []).length,
      primaryApparition: data.primaryApparition,
      maxApparitions: 2,
    };
  }

  async resolveGrantedSpells(_data) {
    return { cantrips: [], rank1s: [] };
  }

  async resolveFocusSpells(data) {
    const primary = (data.apparitions ?? []).find((entry) => entry.uuid === data.primaryApparition);
    if (!primary?.vesselSpell) return [];

    const spell = await fromUuid(primary.vesselSpell).catch(() => null);
    if (!spell) return [];

    return [{ uuid: spell.uuid, name: spell.name, img: spell.img }];
  }

  async applyExtras(actor, data) {
    await this._applyPreparedSpellcasting(actor, data);
    await this._applyApparitionSpellcasting(actor, data);
    await this._applyFocusSpells(actor, data);
  }

  async _applyPreparedSpellcasting(actor, data) {
    const classDef = data.class?.slug ? ClassRegistry.get(data.class.slug) : null;
    if (!classDef?.spellcasting) return;

    const entry = await this._getOrCreateEntry(actor, 'Animist Spells', {
      tradition: { value: 'divine' },
      prepared: { value: 'prepared' },
      ability: { value: 'wis' },
      proficiency: { value: 1 },
    });

    await this._updateSlots(actor, entry, {
      slot0: { max: 2, value: 2 },
      slot1: { max: 1, value: 1 },
    });

    for (const spellEntry of [...(data.spells?.cantrips ?? []), ...(data.spells?.rank1 ?? [])]) {
      const spell = await fromUuid(spellEntry.uuid).catch(() => null);
      if (!spell) continue;
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: entry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }
  }

  async _applyApparitionSpellcasting(actor, data) {
    const apparitionSpells = this._getApparitionSpellSelections(data);
    if (apparitionSpells.cantrips.length === 0 && apparitionSpells.rank1.length === 0) return;

    const entry = await this._getOrCreateEntry(actor, 'Apparition Spells', {
      tradition: { value: 'divine' },
      prepared: { value: 'spontaneous' },
      ability: { value: 'wis' },
      proficiency: { value: 1 },
    });

    await this._updateSlots(actor, entry, {
      slot0: { max: 2, value: 2 },
      slot1: { max: 1, value: 1 },
    });

    for (const uuid of [...apparitionSpells.cantrips, ...apparitionSpells.rank1]) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (!spell) continue;
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: entry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }
  }

  async _getOrCreateEntry(actor, name, system) {
    let entry = actor.items?.find((item) => item.type === 'spellcastingEntry' && item.name === name);
    if (entry) return entry;

    const created = await actor.createEmbeddedDocuments('Item', [{
      name,
      type: 'spellcastingEntry',
      system,
    }]);
    return created[0];
  }

  async _updateSlots(actor, entry, slots) {
    await actor.updateEmbeddedDocuments('Item', [{
      _id: entry.id,
      ...Object.fromEntries(
        Object.entries(slots).flatMap(([slot, values]) => ([
          [`system.slots.${slot}.max`, values.max],
          [`system.slots.${slot}.value`, values.value],
        ])),
      ),
    }]);
  }

  _getApparitionSpellSelections(data) {
    const cantrips = new Set();
    const rank1 = new Set();

    for (const apparition of (data.apparitions ?? [])) {
      const spells = apparition.spells ?? {};
      for (const uuid of (spells[0] ?? []).slice(0, 1)) cantrips.add(uuid);
      for (const uuid of (spells[1] ?? []).slice(0, 1)) rank1.add(uuid);
    }

    return {
      cantrips: [...cantrips],
      rank1: [...rank1],
    };
  }
}
