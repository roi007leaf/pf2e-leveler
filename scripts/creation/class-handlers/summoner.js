import { CasterBaseHandler } from './caster-base.js';

const LINK_SPELLS = {
  evolutionSurge: 'Compendium.pf2e.spells-srd.Item.lV8FkHZtzZu7Cy6j',
  boostEidolon: 'Compendium.pf2e.spells-srd.Item.HStu2Yhw3iQER9tY',
};

/**
 * Summoner: spontaneous caster with eidolon subclass.
 * Gets Evolution Surge (focus) + Boost Eidolon (link cantrip) from
 * the "Link Spells" class feature at level 1 - these are universal,
 * not eidolon-specific.
 */
export class SummonerHandler extends CasterBaseHandler {
  async resolveFocusSpells(data) {
    const focusSpells = await super.resolveFocusSpells(data);

    for (const uuid of [LINK_SPELLS.evolutionSurge, LINK_SPELLS.boostEidolon]) {
      if (focusSpells.some((s) => s.uuid === uuid)) continue;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) focusSpells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }

    return focusSpells;
  }
}
