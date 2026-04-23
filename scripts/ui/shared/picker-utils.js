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
  const available = new Set((availableValues ?? []).filter(Boolean));
  const locked = new Set((lockedValues ?? []).filter(Boolean));
  if (!available.has(value) || locked.has(value)) return new Set(currentValues ?? []);

  const next = new Set(
    [...(currentValues instanceof Set ? currentValues : new Set(currentValues ?? []))]
      .filter((v) => available.has(v)),
  );
  if (next.has(value)) next.delete(value);
  else next.add(value);
  for (const entry of locked) next.add(entry);

  return next;
}

export function applySourceFilter(entries, selectedSources, getSource, availableValues) {
  if (isUnrestrictedSelection(selectedSources, availableValues)) return [...entries];
  return (entries ?? []).filter((entry) => selectedSources.has(getSource(entry)));
}

export function applyPublicationFilter(entries, selectedPublications, getPublication, availableValues) {
  if (isUnrestrictedSelection(selectedPublications, availableValues)) return [...entries];
  return (entries ?? []).filter((entry) => {
    const publication = String(getPublication(entry) ?? '').trim();
    return publication.length > 0 && selectedPublications.has(publication);
  });
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

export function getAvailableRarityValues(entries, getRarity, availableValues = ['common', 'uncommon', 'rare', 'unique']) {
  const normalizedAvailable = [...new Set((availableValues ?? []).map((value) => String(value).toLowerCase()).filter(Boolean))];
  if (normalizedAvailable.length === 0) return [];

  const seen = new Set();
  for (const entry of (entries ?? [])) {
    const rarity = String(getRarity(entry) ?? 'common').toLowerCase();
    if (normalizedAvailable.includes(rarity)) seen.add(rarity);
  }

  return normalizedAvailable.filter((value) => seen.has(value));
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

export function buildFilterSectionState(sectionState = {}, activeCount = 0) {
  const count = Number.isFinite(Number(activeCount)) && Number(activeCount) > 0 ? Number(activeCount) : 0;
  return {
    collapsed: sectionState !== false,
    activeCount: count,
    summary: count > 0 ? String(count) : '',
  };
}

export function buildPublicationFilterSectionState(selectedValues, availableValues, sectionState = {}) {
  const available = [...new Set((availableValues ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (available.length === 0) return buildFilterSectionState(sectionState, 0);

  const selected = selectedValues instanceof Set
    ? [...selectedValues]
    : [...new Set((selectedValues ?? []))];
  const activeCount = selected
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0 && available.includes(value))
    .length;

  if (activeCount === 0 || activeCount === available.length) return buildFilterSectionState(sectionState, 0);
  return buildFilterSectionState(sectionState, activeCount);
}

export function normalizeItemCategory(item) {
  const type = String(item?.type ?? '').toLowerCase();
  const rawCategory = item?.system?.category;
  const category = String(
    (typeof rawCategory === 'object' && rawCategory !== null ? rawCategory.value : rawCategory) ?? item?.category ?? '',
  ).toLowerCase();

  if (type === 'weapon' || category === 'weapon') return 'weapon';
  if (type === 'shield' || category === 'shield') return 'shield';
  if (type === 'armor' || category === 'armor') return 'armor';
  if (type === 'ammo' || category === 'ammunition' || category === 'ammo') return 'ammunition';
  if (type === 'consumable' || category === 'consumable') return 'consumable';
  if (type === 'backpack' || category === 'container') return 'container';
  if (['equipment', 'treasure', 'kit'].includes(type) || category === 'equipment') return 'equipment';
  return 'equipment';
}

export function normalizeSpellCategory(spell) {
  const traits = (spell?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
  if (traits.includes('ritual') || spell?.system?.ritual != null) return 'ritual';
  if (traits.includes('focus')) return 'focus';
  if (traits.includes('cantrip')) return 'cantrip';
  return 'spell';
}
