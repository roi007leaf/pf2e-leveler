import { ClassRegistry } from '../../classes/registry.js';

export async function resolveGrantedSpells(wizard) {
  return wizard.classHandler.resolveGrantedSpells(wizard.data);
}

export async function resolveFocusSpells(wizard) {
  return wizard.classHandler.resolveFocusSpells(wizard.data);
}

export async function resolveSummaryFocusSpells(wizard) {
  if (wizard.classHandler.isFocusSpellChoice() && wizard.data.devotionSpell) {
    return [wizard.data.devotionSpell];
  }
  return wizard.classHandler.resolveFocusSpells(wizard.data);
}

export async function resolveSummaryCurriculumSpells(wizard) {
  const curriculum = wizard.data.subclass?.curriculum;
  if (!curriculum) return [];
  const selectedCurriculum = getSanitizedCurriculumSelections(wizard);

  const cantripUuids = curriculum[0] ?? [];
  const rank1Uuids = curriculum[1] ?? [];
  const uuids = [];

  if (cantripUuids.length > 1) {
    uuids.push(...selectedCurriculum.cantrips.map((spell) => spell.uuid));
  } else {
    uuids.push(...cantripUuids.slice(0, 1));
  }

  if (rank1Uuids.length > 2) {
    uuids.push(...selectedCurriculum.rank1.map((spell) => spell.uuid));
  } else {
    uuids.push(...rank1Uuids.slice(0, 2));
  }

  const spells = [];
  for (const uuid of uuids) {
    const spell = await fromUuid(uuid).catch(() => null);
    if (spell) spells.push({ uuid: spell.uuid, name: spell.name, img: spell.img });
  }

  return spells;
}

export async function buildSpellContext(wizard) {
  if (!wizard._isCaster() && !wizard.classHandler.needsNonCasterSpellStep(wizard.data)) {
    return { cantrips: [], rank1Spells: [] };
  }

  if (!wizard._isCaster()) {
    const focusSpells = await resolveFocusSpells(wizard);
    const { isDevotionChoice, ...focusCtx } = wizard.classHandler.buildFocusContext(wizard.data, focusSpells);
    return {
      spellSubStep: 'focus',
      cantrips: [],
      rank1Spells: [],
      selectedCantrips: [],
      selectedRank1: [],
      grantedCantrips: [],
      grantedRank1s: [],
      focusSpells: focusCtx.focusSpells,
      isDevotionChoice,
      traitOptions: [],
      maxCantrips: 0,
      maxRank1: 0,
      cantripsFull: true,
      rank1Full: true,
      tradition: null,
    };
  }

  const classDef = ClassRegistry.get(wizard.data.class.slug);
  let tradition = classDef.spellcasting.tradition;
  if (['bloodline', 'patron'].includes(tradition)) {
    tradition = wizard.data.subclass?.tradition ?? 'arcane';
  }

  const level1Slots = classDef.spellcasting.slots?.[1] ?? {};
  let totalCantrips = Array.isArray(level1Slots.cantrips) ? level1Slots.cantrips[0] + level1Slots.cantrips[1] : (level1Slots.cantrips ?? 5);
  let totalRank1 = Array.isArray(level1Slots[1]) ? level1Slots[1][0] + level1Slots[1][1] : (level1Slots[1] ?? 2);

  const spellbookCounts = wizard.classHandler.getSpellbookCounts(wizard.data, classDef);
  if (spellbookCounts) {
    totalCantrips = spellbookCounts.cantrips;
    totalRank1 = spellbookCounts.rank1;
  }

  const grantedSpells = await resolveGrantedSpells(wizard);
  const maxCantrips = totalCantrips - grantedSpells.cantrips.length;
  const maxRank1 = totalRank1 - grantedSpells.rank1s.length;

  const allSpells = await wizard._loadCompendiumCategory('spells');
  const grantedUuids = [...grantedSpells.cantrips.map((s) => s.uuid), ...grantedSpells.rank1s.map((s) => s.uuid)];
  const curriculum = wizard.data.subclass?.curriculum ?? {};
  const selectedCurriculum = getSanitizedCurriculumSelections(wizard);
  const autoCurriculumUuids = [
    ...(((curriculum[0] ?? []).length <= 1 ? (curriculum[0] ?? []).slice(0, 1) : [])),
    ...(((curriculum[1] ?? []).length <= 2 ? (curriculum[1] ?? []).slice(0, 2) : [])),
  ];
  const curriculumSelectedUuids = [
    ...selectedCurriculum.cantrips.map((s) => s.uuid),
    ...selectedCurriculum.rank1.map((s) => s.uuid),
  ];
  const selectedUuids = new Set([
    ...wizard.data.spells.cantrips.map((s) => s.uuid),
    ...wizard.data.spells.rank1.map((s) => s.uuid),
    ...autoCurriculumUuids,
    ...curriculumSelectedUuids,
    ...grantedUuids,
  ]);

  const matchesTradition = (s) => {
    if (s.traditions.length > 0) return s.traditions.includes(tradition);
    return s.traits.includes(tradition);
  };

  const restrictToCommonSpellOptions = classDef.slug === 'wizard';
  const matchesRarity = (spell) => !restrictToCommonSpellOptions || (spell.rarity ?? 'common') === 'common';

  const cantrips = allSpells.filter(
    (s) => s.traits.includes('cantrip') && matchesTradition(s) && matchesRarity(s) && !selectedUuids.has(s.uuid),
  );

  const rank1Spells = allSpells.filter(
    (s) => !s.traits.includes('cantrip') && s.level === 1 && matchesTradition(s) && matchesRarity(s) && !selectedUuids.has(s.uuid),
  );

  wizard._cachedMaxCantrips = maxCantrips;
  wizard._cachedMaxRank1 = maxRank1;
  const cantripsFull = wizard.data.spells.cantrips.length >= maxCantrips;
  const rank1Full = maxRank1 <= 0 || wizard.data.spells.rank1.length >= maxRank1;

  const allTraits = new Set();
  for (const spell of [...cantrips, ...rank1Spells]) {
    for (const trait of spell.traits) allTraits.add(trait);
  }
  const traitOptions = [...allTraits].filter((trait) => trait !== 'cantrip').sort();

  const focusSpells = await resolveFocusSpells(wizard);
  const isDevotionChoice = wizard.classHandler.isFocusSpellChoice();

  return {
    spellSubStep: wizard.spellSubStep,
    cantrips,
    rank1Spells,
    selectedCantrips: wizard.data.spells.cantrips,
    selectedRank1: wizard.data.spells.rank1,
    grantedCantrips: grantedSpells.cantrips,
    grantedRank1s: grantedSpells.rank1s,
    focusSpells,
    isDevotionChoice,
    traitOptions,
    maxCantrips,
    maxRank1,
    cantripsFull,
    rank1Full,
    tradition,
    showSpellRarityFilters: !restrictToCommonSpellOptions,
    ...await wizard.classHandler.getSpellContext(wizard.data, classDef),
  };
}

export function getSanitizedCurriculumSelections(wizard) {
  const curriculum = wizard.data.subclass?.curriculum ?? {};
  return {
    cantrips: limitCurriculumSelections(
      wizard.data.curriculumSpells?.cantrips ?? [],
      new Set(curriculum[0] ?? []),
      Math.min(1, (curriculum[0] ?? []).length),
    ),
    rank1: limitCurriculumSelections(
      wizard.data.curriculumSpells?.rank1 ?? [],
      new Set(curriculum[1] ?? []),
      Math.min(2, (curriculum[1] ?? []).length),
    ),
  };
}

export function limitCurriculumSelections(list, validUuids, max) {
  const limited = [];
  const seen = new Set();

  for (const spell of list) {
    if (limited.length >= max) break;
    if (!spell?.uuid || seen.has(spell.uuid) || !validUuids.has(spell.uuid)) continue;
    seen.add(spell.uuid);
    limited.push(spell);
  }

  return limited;
}
