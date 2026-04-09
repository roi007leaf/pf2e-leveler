import { CasterBaseHandler } from './caster-base.js';

const CURRICULUM_ENTRY_FLAG = 'curriculumEntry';

/**
 * Wizard: prepared arcane caster with arcane school.
 * Main spellbook: 10 cantrips (player selects) + 5 rank-1 (player selects).
 * Curriculum spellbook additions: 1 cantrip + 2 rank-1 spells of your choice.
 * Curriculum entry: 1 cantrip slot + 1 rank-1 slot (separate from the main spellbook entry).
 */
export class WizardHandler extends CasterBaseHandler {
  shouldApplySubclassItem() {
    return false;
  }

  getExtraSteps() {
    return [
      { id: 'thesis', label: 'Arcane Thesis', visible: () => true },
    ];
  }

  getSpellbookCounts(_data, _classDef) {
    return { cantrips: 10, rank1: 5 };
  }

  async resolveGrantedSpells(_data) {
    return { cantrips: [], rank1s: [] };
  }

  async getSpellContext(data, _classDef) {
    const curriculum = data.subclass?.curriculum;
    if (!curriculum) return {};

    const curriculumCantripOptions = await this._loadCurriculumSpells(curriculum[0] ?? []);
    const rank1Options = await this._loadCurriculumSpells(curriculum[1] ?? []);
    const maxCurriculumCantrips = Math.min(1, curriculumCantripOptions.length);
    const maxCurriculumRank1 = Math.min(2, rank1Options.length);
    const needsCantripSelection = curriculumCantripOptions.length > maxCurriculumCantrips;
    const needsRank1Selection = rank1Options.length > maxCurriculumRank1;
    const selections = this._sanitizeCurriculumSelections(data);
    const curriculumCantripSelected = needsCantripSelection
      ? selections.cantrips
      : curriculumCantripOptions.slice(0, maxCurriculumCantrips);
    const curriculumRank1Selected = needsRank1Selection
      ? selections.rank1
      : rank1Options.slice(0, maxCurriculumRank1);
    const selectedCantripUuids = new Set(curriculumCantripSelected.map((s) => s.uuid));
    const selectedRank1Uuids = new Set(curriculumRank1Selected.map((s) => s.uuid));

    return {
      hasCurriculum: curriculumCantripOptions.length > 0 || rank1Options.length > 0,
      curriculumCantripOptions: curriculumCantripOptions.map((s) => ({ ...s, selected: selectedCantripUuids.has(s.uuid) })),
      curriculumCantripSelected,
      curriculumNeedsCantripSelection: needsCantripSelection,
      curriculumRank1Options: rank1Options.map((s) => ({ ...s, selected: selectedRank1Uuids.has(s.uuid) })),
      curriculumRank1Selected,
      curriculumNeedsRank1Selection: needsRank1Selection,
      maxCurriculumCantrips,
      maxCurriculumRank1,
      curriculumCantripsFull: maxCurriculumCantrips === 0 || curriculumCantripSelected.length >= maxCurriculumCantrips,
      curriculumRank1Full: maxCurriculumRank1 === 0 || curriculumRank1Selected.length >= maxCurriculumRank1,
      curriculumSelectedCount: curriculumCantripSelected.length + curriculumRank1Selected.length,
      curriculumTargetCount: maxCurriculumCantrips + maxCurriculumRank1,
    };
  }

  isStepComplete(stepId, data) {
    if (stepId === 'thesis') return !!data.thesis;
    if (stepId !== 'spells') return null;
    const curriculum = data.subclass?.curriculum;
    if (!curriculum) return null;
    const selections = this._sanitizeCurriculumSelections(data);

    const cantripCount = (curriculum[0] ?? []).length;
    const rank1Count = (curriculum[1] ?? []).length;

    if (cantripCount > 1 && selections.cantrips.length < 1) return false;
    if (rank1Count > 2 && selections.rank1.length < 2) return false;
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'thesis') return null;
    const theses = await wizard._loadTheses();
    return { items: theses.filter((i) => i.uuid !== data.thesis?.uuid) };
  }

  async applyExtras(actor, data) {
    await this._applySpellcasting(actor, data);
    await this._applyFocusSpells(actor, data);
    await this._applyCurriculumEntry(actor, data);
  }

  async _applySpellcasting(actor, data) {
    const mainData = foundry.utils.deepClone(data);
    const curriculumSpellUuids = this._resolveCurriculumEntrySpells(data);
    const curriculumCantrips = await this._loadCurriculumSpells(curriculumSpellUuids.cantrips);
    const curriculumRank1 = await this._loadCurriculumSpells(curriculumSpellUuids.rank1);

    mainData.spells.cantrips = this._mergeUniqueSpells(data.spells.cantrips, curriculumCantrips);
    mainData.spells.rank1 = this._mergeUniqueSpells(data.spells.rank1, curriculumRank1);

    if (mainData.subclass) {
      mainData.subclass = { ...mainData.subclass, curriculum: null, slug: null };
    }

    await super._applySpellcasting(actor, mainData);
  }

  async _applyCurriculumEntry(actor, data) {
    const curriculum = data.subclass?.curriculum;
    if (!curriculum) return;

    const schoolName = data.subclass?.name ?? 'Arcane School';

    let curriculumEntry = actor.items?.find((i) => this._isCurriculumEntry(i));

    if (!curriculumEntry) {
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: `${schoolName} Curriculum`,
        type: 'spellcastingEntry',
        flags: {
          'pf2e-leveler': {
            [CURRICULUM_ENTRY_FLAG]: true,
          },
        },
        system: {
          tradition: { value: 'arcane' },
          prepared: { value: 'prepared' },
          ability: { value: 'int' },
          proficiency: { value: 1 },
          slots: {
            slot0: { max: 1, value: 1 },
            slot1: { max: 1, value: 1 },
          },
        },
      }]);
      curriculumEntry = created[0];
    }

    const entrySpells = this._resolveCurriculumEntrySpells(data);

    for (const uuid of entrySpells.cantrips) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (!spell) continue;
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: curriculumEntry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }

    for (const uuid of entrySpells.rank1) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (!spell) continue;
      const spellData = foundry.utils.deepClone(spell.toObject());
      spellData.system.location = { value: curriculumEntry.id };
      await actor.createEmbeddedDocuments('Item', [spellData]);
    }
  }

  async _loadCurriculumSpells(uuids) {
    const results = [];
    for (const uuid of uuids) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) results.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }
    return results;
  }

  _mergeUniqueSpells(...lists) {
    const merged = [];
    const seen = new Set();

    for (const list of lists) {
      for (const spell of (list ?? [])) {
        if (!spell?.uuid || seen.has(spell.uuid)) continue;
        seen.add(spell.uuid);
        merged.push(spell);
      }
    }

    return merged;
  }

  _sanitizeCurriculumSelections(data) {
    const curriculum = data.subclass?.curriculum ?? {};
    return {
      cantrips: this._limitSelections(
        data.curriculumSpells?.cantrips ?? [],
        new Set(curriculum[0] ?? []),
        Math.min(1, (curriculum[0] ?? []).length),
      ),
      rank1: this._limitSelections(
        data.curriculumSpells?.rank1 ?? [],
        new Set(curriculum[1] ?? []),
        Math.min(2, (curriculum[1] ?? []).length),
      ),
    };
  }

  _resolveCurriculumEntrySpells(data) {
    const curriculum = data.subclass?.curriculum ?? {};
    const selections = this._sanitizeCurriculumSelections(data);
    const cantripUuids = curriculum[0] ?? [];
    const rank1Uuids = curriculum[1] ?? [];

    return {
      cantrips: cantripUuids.length > 1
        ? selections.cantrips.map((spell) => spell.uuid)
        : cantripUuids.slice(0, 1),
      rank1: rank1Uuids.length > 2
        ? selections.rank1.map((spell) => spell.uuid)
        : rank1Uuids.slice(0, 2),
    };
  }

  _limitSelections(list, validUuids, max) {
    const limited = [];
    const seen = new Set();

    for (const spell of list) {
      if (limited.length >= max) break;
      if (!spell?.uuid || seen.has(spell.uuid) || !validUuids.has(spell.uuid)) continue;
      seen.add(spell.uuid);
      limited.push(spell);
    }

    return limited;
  }

  _isCurriculumEntry(item) {
    if (item?.type !== 'spellcastingEntry') return false;
    if (item.flags?.['pf2e-leveler']?.[CURRICULUM_ENTRY_FLAG] === true) return true;
    return item.name?.includes?.('Curriculum') === true;
  }
}
