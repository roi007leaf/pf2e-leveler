import { CasterBaseHandler } from './caster-base.js';
import { applyItem } from '../apply-creation.js';

const FONT_SPELL_UUIDS = {
  heal: 'Compendium.pf2e.spells-srd.Item.rfZpqmj0AIIdkVIs',
  harm: 'Compendium.pf2e.spells-srd.Item.wdA52JJnsuQWeyqz',
};

/**
 * Cleric: prepared divine caster with doctrine subclass.
 * Requires deity selection, deity sanctification when applicable, and divine font choice.
 */
export class ClericHandler extends CasterBaseHandler {
  getExtraSteps() {
    return [
      { id: 'deity', visible: () => true },
      { id: 'sanctification', label: 'Sanctification', visible: (data) => {
        const what = data.deity?.sanctification?.what ?? [];
        return what.length > 0;
      }},
      { id: 'divineFont', label: 'Divine Font', visible: (data) => {
        const font = data.deity?.font ?? [];
        return font.length > 1;
      }},
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId === 'deity') return !!data.deity;
    if (stepId === 'sanctification') {
      const what = data.deity?.sanctification?.what ?? [];
      if (what.length <= 0) return true;
      return !!data.sanctification;
    }
    if (stepId === 'divineFont') {
      const font = data.deity?.font ?? [];
      if (font.length <= 1) return true;
      return !!data.divineFont;
    }
    return null;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId === 'deity') {
      return { items: await wizard._loadDeities() };
    }
    if (stepId === 'sanctification') {
      const what = data.deity?.sanctification?.what ?? [];
      const modal = data.deity?.sanctification?.modal ?? 'can';
      return {
        sanctificationOptions: [
          ...what.map((v) => ({
            value: v,
            label: v.charAt(0).toUpperCase() + v.slice(1),
            selected: data.sanctification === v,
          })),
          ...(modal === 'must' ? [] : [{
            value: 'none',
            label: 'None',
            selected: data.sanctification === 'none',
          }]),
        ],
        modal,
        deityName: data.deity?.name,
        stepTitle: 'Sanctification',
      };
    }
    if (stepId === 'divineFont') {
      const font = data.deity?.font ?? [];
      return {
        divineFontOptions: font.map((v) => ({
          value: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
          selected: data.divineFont === v,
        })),
        stepTitle: 'Divine Font',
        stepHint: 'Choose your divine font. This determines whether you channel heal or harm spells.',
      };
    }
    return null;
  }

  async applyExtras(actor, data) {
    if (data.deity) await applyItem(actor, data.deity, 'deity');
    await super.applyExtras(actor, data);
    await this._applyDivineFont(actor, data);
  }

  async _applyDivineFont(actor, data) {
    if (!data.divineFont) return;

    const fontSpellUuid = FONT_SPELL_UUIDS[data.divineFont];
    if (!fontSpellUuid) return;

    const spell = await fromUuid(fontSpellUuid).catch(() => null);
    if (!spell) return;

    let fontEntry = actor.items?.find((i) =>
      i.type === 'spellcastingEntry' && i.name?.includes('Font'),
    );

    if (!fontEntry) {
      const label = data.divineFont.charAt(0).toUpperCase() + data.divineFont.slice(1);
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: `Divine Font (${label})`,
        type: 'spellcastingEntry',
        system: {
          tradition: { value: 'divine' },
          prepared: { value: 'prepared' },
          ability: { value: 'wis' },
          proficiency: { value: 1 },
          slots: { slot1: { max: 4, value: 4 } },
        },
      }]);
      fontEntry = created[0];
    }

    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: fontEntry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);
  }
}
