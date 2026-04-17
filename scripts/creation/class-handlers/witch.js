import { CasterBaseHandler } from './caster-base.js';
import { capitalize } from '../../utils/pf2e-api.js';

const WITCH_HEX_SPELLS = {
  patronsPuppet: 'Compendium.pf2e.spells-srd.Item.aq1yonHeYpbaj3XI',
  phaseFamiliar: 'Compendium.pf2e.spells-srd.Item.rMOI8JFJ0nT2mrCF',
};

/**
 * Witch: prepared caster with patron subclass.
 * Familiar knows 10 chosen cantrips + 5 chosen rank-1 spells,
 * plus the patron-granted cantrip and patron-granted rank-1 spell.
 * Player chooses one of two hex focus spells at level 1:
 * Patron's Puppet or Phase Familiar.
 */
export class WitchHandler extends CasterBaseHandler {
  getSpellbookCounts(_data, _classDef) {
    return { cantrips: 11, rank1: 6 };
  }

  isFocusSpellChoice() { return true; }

  async resolveFocusSpells(_data) {
    const spells = [];
    for (const uuid of Object.values(WITCH_HEX_SPELLS)) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) spells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }
    return spells;
  }

  buildFocusContext(data, focusSpells) {
    const selectedUuid = data.devotionSpell?.uuid;
    for (const fs of focusSpells) fs.selected = fs.uuid === selectedUuid;
    return { focusSpells, isDevotionChoice: true };
  }

  isStepComplete(stepId, data) {
    if (stepId !== 'spells') return null;
    if (!data.devotionSpell) return false;
    return null; // let wizard check cantrip/rank1 counts normally
  }

  async applyExtras(actor, data) {
    await this._applySpellcasting(actor, data);
    if (data.devotionSpell) {
      await this._applyChosenHex(actor, data);
    }
  }

  async _applyChosenHex(actor, data) {
    const spell = await fromUuid(data.devotionSpell.uuid).catch(() => null);
    if (!spell) return;

    const tradition = data.subclass?.tradition ?? 'arcane';
    const focusEntryName = `${capitalize(data.class?.name ?? 'Witch')} Focus Spells`;
    let focusEntry = this._findSpellcastingEntry(actor, {
      name: focusEntryName,
      prepared: 'focus',
      tradition,
    });
    if (!focusEntry) {
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: focusEntryName,
        type: 'spellcastingEntry',
        system: {
          tradition: { value: tradition },
          prepared: { value: 'focus' },
          ability: { value: 'int' },
          proficiency: { value: 1 },
        },
      }]);
      focusEntry = created[0];
    }

    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: focusEntry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);

    const currentMax = actor.system?.resources?.focus?.max ?? 0;
    const currentValue = actor.system?.resources?.focus?.value ?? 0;
    if (currentMax < 1 || currentValue < 1) {
      await actor.update({
        'system.resources.focus.max': Math.max(1, currentMax),
        'system.resources.focus.value': Math.max(1, currentValue),
      });
    }
  }
}
