import { BaseClassHandler } from './base.js';
import { CHAMPION_DEVOTION_SPELLS } from '../../data/subclass-spells.js';
import { applyItem } from '../apply-creation.js';

const CAUSE_SANCTIFICATION = {
  justice: 'holy',
  liberation: 'holy',
  redemption: 'holy',
  desecration: 'unholy',
  iniquity: 'unholy',
};

/**
 * Champion: martial class with deity, sanctification, cause, and devotion spells.
 * No standard spellcasting — focus spells only via devotion.
 */
export class ChampionHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      { id: 'deity', visible: () => true },
      { id: 'sanctification', visible: (data) => (data.deity?.sanctification?.what?.length ?? 0) > 0 },
    ];
  }

  isStepComplete(stepId, data) {
    if (stepId === 'deity') return !!data.deity;
    if (stepId === 'sanctification') {
      const what = data.deity?.sanctification?.what ?? [];
      if (what.length === 0) return true;
      return !!data.sanctification;
    }
    if (stepId === 'spells') return !!data.devotionSpell;
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
      };
    }
    return null;
  }

  needsSpellSelection(data) {
    return !!data.deity;
  }

  needsNonCasterSpellStep(data) {
    return !!data.deity;
  }

  filterSubclasses(subclasses, data) {
    if (!data.sanctification || data.sanctification === 'none') return subclasses;
    return subclasses.filter((s) => {
      const required = CAUSE_SANCTIFICATION[s.slug];
      if (!required) return true;
      return required === data.sanctification;
    });
  }

  async resolveFocusSpells(data) {
    const focusSpells = [];
    if (!data.deity) return focusSpells;

    const font = data.deity.font ?? [];
    const shield = await fromUuid(CHAMPION_DEVOTION_SPELLS.shieldsOfTheSpirit).catch(() => null);
    if (shield) focusSpells.push({ uuid: shield.uuid, name: shield.name, img: shield.img });
    if (font.includes('healing') || font.includes('heal')) {
      const loh = await fromUuid(CHAMPION_DEVOTION_SPELLS.layOnHands).catch(() => null);
      if (loh) focusSpells.push({ uuid: loh.uuid, name: loh.name, img: loh.img });
    }
    if (font.includes('harmful') || font.includes('harm')) {
      const tov = await fromUuid(CHAMPION_DEVOTION_SPELLS.touchOfTheVoid).catch(() => null);
      if (tov) focusSpells.push({ uuid: tov.uuid, name: tov.name, img: tov.img });
    }

    return focusSpells;
  }

  isFocusSpellChoice() { return true; }

  buildFocusContext(data, focusSpells) {
    const selectedUuid = data.devotionSpell?.uuid;
    for (const fs of focusSpells) fs.selected = fs.uuid === selectedUuid;
    return { focusSpells, isDevotionChoice: true };
  }

  async applyExtras(actor, data) {
    if (data.deity) await applyItem(actor, data.deity, 'deity');

    if (data.devotionSpell) {
      const spell = await fromUuid(data.devotionSpell.uuid).catch(() => null);
      if (spell) {
        let focusEntry = actor.items?.find((i) => i.type === 'spellcastingEntry' && i.system?.prepared?.value === 'focus');
        if (!focusEntry) {
          const created = await actor.createEmbeddedDocuments('Item', [{
            name: 'Champion Focus Spells',
            type: 'spellcastingEntry',
            system: {
              tradition: { value: 'divine' },
              prepared: { value: 'focus' },
              ability: { value: 'cha' },
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
  }
}
