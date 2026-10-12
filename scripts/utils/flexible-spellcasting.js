const FLEXIBLE_CLASSES = new Set(['wizard', 'druid', 'cleric', 'witch']);

export function supportsFlexiblePreparation(classDef) {
  if (typeof classDef === 'string') return FLEXIBLE_CLASSES.has(classDef);
  return FLEXIBLE_CLASSES.has(classDef?.slug) && classDef?.spellcasting?.type === 'prepared';
}

export function getFlexibleSpellSlots(slots, level) {
  const adjusted = { cantrips: Number(level) >= 4 ? 5 : Number(level) >= 2 ? 4 : 3 };
  for (const [rank, counts] of Object.entries(slots ?? {})) {
    if (!Number.isInteger(Number(rank)) || Number(rank) < 1 || Number(rank) > 9) continue;
    const count = Array.isArray(counts) ? counts[0] : Number(counts);
    adjusted[rank] = Math.min(2, count);
  }
  return adjusted;
}

export function findClassSpellcastingEntry(actor, { classSlug, tradition, prepared, name }) {
  const entries = getActorItems(actor).filter((item) =>
    item.type === 'spellcastingEntry'
    && (!prepared || item.system?.prepared?.value === prepared)
    && (!tradition || item.system?.tradition?.value === tradition)
    && !item.flags?.['pf2e-leveler']?.archetypeSpellcastingEntry
    && !item.flags?.['pf2e-leveler']?.classRestrictedSpellcastingEntry
    && !item.flags?.['pf2e-leveler']?.customSpellcastingEntry
    && !/curriculum|font|studious|10th|tenth/i.test(item.name ?? ''),
  ) ?? [];
  const identified = entries.find((entry) => entry.flags?.['pf2e-leveler']?.classSpellcastingEntry === classSlug);
  if (identified) return identified;
  const unassigned = entries.filter((entry) => !entry.flags?.['pf2e-leveler']?.classSpellcastingEntry);
  const className = String(name ?? classSlug).trim().toLowerCase().replace(/ spells$/, '');
  const named = unassigned.find((entry) => String(entry.name ?? '').trim().toLowerCase().replace(/ spells$/, '') === className);
  if (named) return named;
  if (actor?.class?.slug && actor.class.slug !== classSlug) return null;
  const generic = unassigned.filter((entry) => !/wizard|druid|cleric|witch/i.test(entry.name ?? ''));
  return generic.length === 1 ? generic[0] : null;
}

export function isFlexibleClassEntry(entry, classDef) {
  return supportsFlexiblePreparation(classDef) && entry?.system?.prepared?.value === 'prepared' && entry.system.prepared.flexible === true;
}

export async function ensureFlexibleRank10Entry(actor, primary, classDef, slots) {
  const counts = slots?.[10];
  const max = Array.isArray(counts) ? counts[0] : Number(counts ?? 0);
  if (!max) return null;
  const items = getActorItems(actor);
  let entry = items.find((item) => item.type === 'spellcastingEntry' && item.flags?.['pf2e-leveler']?.classRestrictedSpellcastingEntry === classDef.slug);
  const prepared = primary.system?.slots?.slot10?.prepared ?? {};
  if (!entry) {
    [entry] = await actor.createEmbeddedDocuments('Item', [{
      name: `${classDef.name ?? classDef.slug} 10th-Rank Spells`,
      type: 'spellcastingEntry',
      flags: { 'pf2e-leveler': { classRestrictedSpellcastingEntry: classDef.slug } },
      system: {
        tradition: { value: primary.system.tradition.value },
        prepared: { value: 'prepared', flexible: false },
        ability: { value: primary.system.ability.value },
        proficiency: { value: primary.system.proficiency?.value ?? 1 },
      },
    }]);
  }
  const update = { _id: entry.id, 'system.slots.slot10.max': max, 'system.slots.slot10.value': max };
  if (Object.keys(prepared).length > 0 && !Object.keys(entry.system?.slots?.slot10?.prepared ?? {}).length) update['system.slots.slot10.prepared'] = prepared;
  const preparedIds = new Set(Object.values(prepared).map((slot) => slot?.id).filter(Boolean));
  const spellUpdates = items.filter((item) => item.type === 'spell' && item.system?.location?.value === primary.id && (Number(item.system?.level?.value) === 10 || preparedIds.has(item.id)))
    .map((spell) => ({ _id: spell.id, 'system.location.value': entry.id }));
  await actor.updateEmbeddedDocuments('Item', [update, ...spellUpdates]);
  return entry;
}

function getActorItems(actor) {
  if (Array.isArray(actor?.items)) return actor.items;
  if (Array.isArray(actor?.items?.contents)) return actor.items.contents;
  if (typeof actor?.items?.filter === 'function') return actor.items.filter(() => true);
  return [];
}
