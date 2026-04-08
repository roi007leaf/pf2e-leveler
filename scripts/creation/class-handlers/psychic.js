import { CasterBaseHandler } from './caster-base.js';
import { resolvePsychicLevelOneSpells } from '../../data/subclass-spells.js';

export class PsychicHandler extends CasterBaseHandler {
  getExtraSteps() {
    return [
      { id: 'subconsciousMind', label: 'Subconscious Mind', visible: () => true },
    ];
  }

  getSpellbookCounts(_data, _classDef) {
    return { cantrips: 3, rank1: 3 };
  }

  isStepComplete(stepId, data) {
    if (stepId === 'subconsciousMind') return !!data.subconsciousMind;
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'subconsciousMind') return null;

    const items = await wizard._loadPsychicSubconsciousMinds();
    return { items: items.filter((item) => item.uuid !== data.subconsciousMind?.uuid) };
  }

  async resolveGrantedSpells(data) {
    const base = await super.resolveGrantedSpells(data);
    const subSlug = data.subclass?.slug;
    if (!subSlug) return base;

    return {
      cantrips: base.cantrips,
      rank1s: base.rank1s,
    };
  }

  async resolveFocusSpells(data) {
    const base = await super.resolveFocusSpells(data);
    const subSlug = data.subclass?.slug;
    if (!subSlug) return base;

    const consciousMind = resolvePsychicLevelOneSpells(subSlug);
    return [
      ...base,
      ...await this._resolveEntries(consciousMind.cantrips, data.subclass?.name),
    ];
  }

  async _resolveEntries(uuids, source) {
    const entries = [];
    const seen = new Set();

    for (const uuid of (uuids ?? [])) {
      if (!uuid || seen.has(uuid)) continue;
      seen.add(uuid);
      const spell = await fromUuid(uuid).catch(() => null);
      if (!spell) continue;
      entries.push({
        uuid: spell.uuid,
        name: spell.name,
        img: spell.img,
        source,
      });
    }

    return entries;
  }
}
