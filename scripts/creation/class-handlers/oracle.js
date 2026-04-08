import { CasterBaseHandler } from './caster-base.js';

/**
 * Oracle handler - mystery spells are bonus spells that don't reduce base selection.
 * Mysteries grant 1 extra cantrip + 1 extra rank-1 spell on top of the base repertoire.
 */
export class OracleHandler extends CasterBaseHandler {
    async resolveGrantedSpells(data) {
        const cantrips = [];
        const rank1s = [];
        const seen = new Set();

        // Parse mystery granted spells (cantrip + rank 1)
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

                // Include mystery cantrip as granted
                if (resolved.cantrip && !seen.has(resolved.cantrip)) {
                    seen.add(resolved.cantrip);
                    const spell = await fromUuid(resolved.cantrip).catch(() => null);
                    if (spell) cantrips.push({ uuid: spell.uuid, name: spell.name, img: spell.img, source: src });
                }

                // Include mystery rank-1 spell as granted
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
        // Override to ensure mystery spells don't reduce selection
        // Add 1 to account for the mystery cantrip and rank-1 spell
        // so after subtraction, user still gets the base amount to choose
        const level1Slots = classDef.spellcasting.slots?.[1] ?? {};
        return {
            cantrips: (level1Slots.cantrips ?? 5) + 1,
            rank1: (level1Slots[1] ?? 2) + 1,
        };
    }
}

