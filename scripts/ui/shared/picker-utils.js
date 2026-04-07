export function initializeSelectionSet(current, availableValues, { lockedValues = [], defaultValues = null } = {}) {
  const available = new Set((availableValues ?? []).filter(Boolean));
  const locked = new Set((lockedValues ?? []).filter((value) => available.has(value)));
  const selected = new Set(
    [...(current instanceof Set ? current : new Set(current ?? []))]
      .filter((value) => available.has(value)),
  );

  for (const value of locked) selected.add(value);

  if (selected.size === 0) {
    const fallback = Array.isArray(defaultValues) ? defaultValues : availableValues;
    for (const value of (fallback ?? [])) {
      if (available.has(value)) selected.add(value);
    }
    for (const value of locked) selected.add(value);
  }

  return selected;
}

export function isUnrestrictedSelection(selectedValues, availableValues) {
  const available = (availableValues ?? []).filter(Boolean);
  if (available.length === 0) return true;
  if (!(selectedValues instanceof Set) || selectedValues.size === 0) return true;
  return available.every((value) => selectedValues.has(value));
}

export function toggleSelectableChip(currentValues, value, availableValues, lockedValues = []) {
  const available = (availableValues ?? []).filter(Boolean);
  const locked = new Set((lockedValues ?? []).filter(Boolean));
  if (!available.includes(value) || locked.has(value)) return new Set(currentValues ?? []);

  const current = initializeSelectionSet(currentValues, available, { lockedValues: [...locked] });
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  for (const entry of locked) next.add(entry);

  if (next.size === 0) return new Set(available);
  return next;
}

export function applySourceFilter(entries, selectedSources, getSource, availableValues) {
  if (isUnrestrictedSelection(selectedSources, availableValues)) return [...entries];
  return (entries ?? []).filter((entry) => selectedSources.has(getSource(entry)));
}

export function applyTraitFilter(entries, selectedTraits, getTraits, logic = 'or') {
  const traits = [...(selectedTraits ?? [])].filter(Boolean);
  if (traits.length === 0) return [...entries];

  const normalizedLogic = String(logic ?? 'or').toLowerCase() === 'and' ? 'and' : 'or';
  return (entries ?? []).filter((entry) => {
    const entryTraits = new Set((getTraits(entry) ?? []).map((trait) => String(trait).toLowerCase()));
    if (normalizedLogic === 'and') return traits.every((trait) => entryTraits.has(String(trait).toLowerCase()));
    return traits.some((trait) => entryTraits.has(String(trait).toLowerCase()));
  });
}

export function applyRarityFilter(entries, selectedRarities, getRarity, availableValues = ['common', 'uncommon', 'rare', 'unique']) {
  if (isUnrestrictedSelection(selectedRarities, availableValues)) return [...entries];
  return (entries ?? []).filter((entry) => selectedRarities.has(String(getRarity(entry) ?? 'common').toLowerCase()));
}

export function buildChipOptions(availableValues, selectedValues, { lockedValues = [], labels = {} } = {}) {
  const locked = new Set(lockedValues ?? []);
  return (availableValues ?? []).map((value) => ({
    value,
    label: labels[value] ?? value,
    selected: selectedValues instanceof Set ? selectedValues.has(value) : false,
    locked: locked.has(value),
  }));
}

export function normalizeItemCategory(item) {
  const type = String(item?.type ?? '').toLowerCase();
  const category = String(item?.system?.category?.value ?? item?.category ?? '').toLowerCase();

  if (type === 'weapon' || category === 'weapon') return 'weapon';
  if (type === 'shield' || category === 'shield') return 'shield';
  if (type === 'armor' || category === 'armor') return 'armor';
  if (type === 'consumable' || category === 'consumable') return 'consumable';
  if (type === 'backpack' || category === 'container') return 'container';
  if (category === 'ammunition' || type === 'ammunition') return 'ammunition';
  if (['equipment', 'treasure', 'kit'].includes(type) || category === 'equipment') return 'equipment';
  return 'equipment';
}

export function normalizeSpellCategory(spell) {
  const traits = (spell?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  if (traits.includes('ritual')) return 'ritual';
  if (traits.includes('focus')) return 'focus';
  if (traits.includes('cantrip')) return 'cantrip';
  return 'spell';
}
