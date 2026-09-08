import { isRemasteredClass } from '../classes/editions.js';

export function isRemasteredMagus(actor, selectedClass = null) {
  return isRemasteredClass(actor, 'magus', selectedClass);
}

function isMagusStudiousEntry(item) {
  return item?.type === 'spellcastingEntry' && (
    item.flags?.['pf2e-leveler']?.magusStudiousEntry === true
    || String(item.name ?? '').toLowerCase().includes('studious')
  );
}

export function findMagusPrimaryEntry(actor) {
  const candidates = actor.items?.filter((item) => item.type === 'spellcastingEntry'
    && item.system?.tradition?.value === 'arcane'
    && item.system?.prepared?.value === 'prepared'
    && !isMagusStudiousEntry(item)
    && !item.flags?.['pf2e-leveler']?.archetypeSpellcastingEntry
    && !item.flags?.['pf2e-leveler']?.customSpellcastingEntry) ?? [];
  return candidates.find((item) => /magus/i.test(item.name ?? ''))
    ?? (candidates.length === 1 ? candidates[0] : null);
}
