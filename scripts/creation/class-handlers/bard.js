import { CasterBaseHandler } from './caster-base.js';

const COMPOSITION_SPELLS = {
  courageousAnthem: 'Compendium.pf2e.spells-srd.Item.IAjvwqgiDr3qGYxY',
  counterPerformance: 'Compendium.pf2e.spells-srd.Item.WILXkjU5Yq3yw10r',
};

/**
 * Bard: spontaneous caster.
 * Gets Courageous Anthem + Counter Performance as focus spells from Composition Spells class feature.
 */
export class BardHandler extends CasterBaseHandler {
  async resolveFocusSpells(_data) {
    const spells = [];
    for (const uuid of Object.values(COMPOSITION_SPELLS)) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) spells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }
    return spells;
  }
}
