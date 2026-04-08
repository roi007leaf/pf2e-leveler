import { CasterBaseHandler } from './caster-base.js';

const COMPOSITION_SPELLS = {
  courageousAnthem: 'Compendium.pf2e.spells-srd.Item.IAjvwqgiDr3qGYxY',
  counterPerformance: 'Compendium.pf2e.spells-srd.Item.WILXkjU5Yq3yw10r',
};

/**
 * Bard: spontaneous caster.
 * Gets Courageous Anthem + Counter Performance as focus spells from Composition Spells class feature.
 * Muse spells are bonus spells that don't reduce base selection.
 */
export class BardHandler extends CasterBaseHandler {
  async resolveGrantedSpells(data) {
    const cantrips = [];
    const rank1s = [];
    const seen = new Set();

    // Parse muse granted spells
    // These are returned so they show in the UI, but getSpellbookCounts overrides
    // to not reduce selection
    const subSlug = data.subclass?.slug;
    if (subSlug) {
      const { resolveSubclassSpells } = await import('../../data/subclass-spells.js');
      const rawChoices = data.subclass?.choices ?? {};
      const choices = {};
      for (const [k, v] of Object.entries(rawChoices)) {
        if (typeof v === 'string' && v !== '[object Object]') choices[k] = v;
      }

      const resolved = resolveSubclassSpells(subSlug, choices);
      if (resolved) {
        const src = data.subclass.name;

        // Include muse cantrip as granted
        if (resolved.cantrip && !seen.has(resolved.cantrip)) {
          seen.add(resolved.cantrip);
          const spell = await fromUuid(resolved.cantrip).catch(() => null);
          if (spell) cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: src });
        }

        // Include muse rank-1 spell as granted
        if (resolved.rank1 && !seen.has(resolved.rank1)) {
          seen.add(resolved.rank1);
          const spell = await fromUuid(resolved.rank1).catch(() => null);
          if (spell) rank1s.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: src });
        }
      }
    }

    return { cantrips, rank1s };
  }

  getSpellbookCounts(_data, classDef) {
    // Override to ensure muse spells don't reduce selection
    // Add 1 to account for the muse cantrip and rank-1 spell
    // so after subtraction, user still gets the base amount to choose
    const level1Slots = classDef.spellcasting.slots?.[1] ?? {};
    return {
      cantrips: (level1Slots.cantrips ?? 5),
      rank1: (level1Slots[1] ?? 2) + 1,
    };
  }

  async resolveFocusSpells(_data) {
    const spells = [];
    for (const uuid of Object.values(COMPOSITION_SPELLS)) {
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) spells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
    }
    return spells;
  }
}
