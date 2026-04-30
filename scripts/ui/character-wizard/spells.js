import { ClassRegistry } from '../../classes/registry.js';
import { getClassHandler } from '../../creation/class-handlers/registry.js';
import { getEffectiveSubclassCurriculum } from '../../creation/creation-model.js';

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
  const curriculum = getEffectiveSubclassCurriculum(wizard.data.subclass);
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
  const spellSections = [];
  const primaryClassDef = wizard.data.class?.slug ? ClassRegistry.get(wizard.data.class.slug) : null;
  if (primaryClassDef?.spellcasting) {
    spellSections.push(await buildCasterSpellSection(wizard, {
      target: 'primary',
      classEntry: wizard.data.class,
      subclassEntry: wizard.data.subclass,
      classDef: primaryClassDef,
      classHandler: wizard.classHandler,
    }));
  }

  const secondaryClassDef = wizard.data.dualClass?.slug ? ClassRegistry.get(wizard.data.dualClass.slug) : null;
  if (secondaryClassDef?.spellcasting) {
    spellSections.push(await buildCasterSpellSection(wizard, {
      target: 'secondary',
      classEntry: wizard.data.dualClass,
      subclassEntry: wizard.data.dualSubclass,
      classDef: secondaryClassDef,
      classHandler: getClassHandler(wizard.data.dualClass.slug),
    }));
  }

  if (spellSections.length > 0) {
    const [primarySection, secondarySection] = spellSections;
    return {
      ...primarySection,
      spellSections,
      secondarySpellSection: secondarySection ?? null,
    };
  }

  if (!wizard.classHandler.needsNonCasterSpellStep(wizard.data)) {
    return { cantrips: [], rank1Spells: [], spellSections: [], secondarySpellSection: null };
  }

  const focusSpells = await resolveFocusSpells(wizard);
  const { isDevotionChoice, ...focusCtx } = wizard.classHandler.buildFocusContext(wizard.data, focusSpells);
  const renderedFocusSpells = focusCtx.focusSpells ?? focusSpells;
  const { focusCantrips, focusNonCantrips } = await splitFocusSpells(renderedFocusSpells, { isDevotionChoice });
  return {
    spellSubStep: 'focus',
    cantrips: [],
    rank1Spells: [],
    selectedCantrips: [],
    selectedRank1: [],
    grantedCantrips: [],
    grantedRank1s: [],
    focusSpells: renderedFocusSpells,
    focusCantrips,
    focusNonCantrips,
    isDevotionChoice,
    traitOptions: [],
    maxCantrips: 0,
    maxRank1: 0,
    cantripsFull: true,
    rank1Full: true,
    tradition: null,
    spellSections: [],
    secondarySpellSection: null,
  };
}

async function buildCasterSpellSection(wizard, {
  target,
  classEntry,
  subclassEntry,
  classDef,
  classHandler,
}) {
  const sectionData = projectSpellSectionData(wizard.data, target);
  let tradition = classDef.spellcasting.tradition;
  if (['bloodline', 'patron'].includes(tradition)) {
    tradition = subclassEntry?.tradition ?? 'arcane';
  }

  const level1Slots = classDef.spellcasting.slots?.[1] ?? {};
  let totalCantrips = Array.isArray(level1Slots.cantrips)
    ? level1Slots.cantrips[0] + level1Slots.cantrips[1]
    : (level1Slots.cantrips ?? 5);
  let totalRank1 = Array.isArray(level1Slots[1])
    ? level1Slots[1][0] + level1Slots[1][1]
    : (level1Slots[1] ?? 2);

  const spellbookCounts = classHandler.getSpellbookCounts(sectionData, classDef);
  if (spellbookCounts) {
    totalCantrips = spellbookCounts.cantrips;
    totalRank1 = spellbookCounts.rank1;
  }

  const rawFocusSpells = await classHandler.resolveFocusSpells(sectionData);
  const focusContext = classHandler.buildFocusContext
    ? classHandler.buildFocusContext(sectionData, rawFocusSpells)
    : { focusSpells: rawFocusSpells, isDevotionChoice: classHandler.isFocusSpellChoice() };
  const { isDevotionChoice, ...focusCtx } = focusContext;
  const focusSpells = focusCtx.focusSpells ?? rawFocusSpells;
  const grantedSpells = await classHandler.resolveGrantedSpells(sectionData);
  const maxCantrips = totalCantrips - grantedSpells.cantrips.length;
  const maxRank1 = totalRank1 - grantedSpells.rank1s.length;

  const allSpells = await wizard._loadCompendiumCategory('spells');
  const grantedUuids = [
    ...grantedSpells.cantrips.map((spell) => spell.uuid),
    ...grantedSpells.rank1s.map((spell) => spell.uuid),
  ];
  const curriculum = getEffectiveSubclassCurriculum(subclassEntry) ?? {};
  const selectedCurriculum = getSanitizedCurriculumSelections(wizard, target);
  const autoCurriculumUuids = [
    ...(((curriculum[0] ?? []).length <= 1 ? (curriculum[0] ?? []).slice(0, 1) : [])),
    ...(((curriculum[1] ?? []).length <= 2 ? (curriculum[1] ?? []).slice(0, 2) : [])),
  ];
  const curriculumSelectedUuids = [
    ...selectedCurriculum.cantrips.map((spell) => spell.uuid),
    ...selectedCurriculum.rank1.map((spell) => spell.uuid),
  ];
  const selectedUuids = new Set([
    ...(sectionData.spells?.cantrips ?? []).map((spell) => spell.uuid),
    ...(sectionData.spells?.rank1 ?? []).map((spell) => spell.uuid),
    ...autoCurriculumUuids,
    ...curriculumSelectedUuids,
    ...grantedUuids,
    ...focusSpells.map((spell) => spell.uuid),
  ]);

  const matchesTradition = (spell) => {
    if (spell.traditions.length > 0) return spell.traditions.includes(tradition);
    return spell.traits.includes(tradition);
  };

  const restrictToCommonSpellOptions = classDef.slug === 'wizard';
  const matchesRarity = (spell) =>
    !restrictToCommonSpellOptions || (spell.rarity ?? 'common') === 'common';

  const cantrips = allSpells.filter(
    (spell) =>
      spell.traits.includes('cantrip')
      && matchesTradition(spell)
      && matchesRarity(spell)
      && !selectedUuids.has(spell.uuid),
  );

  const rank1Spells = allSpells.filter(
    (spell) =>
      !spell.traits.includes('cantrip')
      && spell.level === 1
      && matchesTradition(spell)
      && matchesRarity(spell)
      && !selectedUuids.has(spell.uuid),
  );

  setSpellSelectionCache(wizard, target, maxCantrips, maxRank1);
  const selectedCantrips = sectionData.spells?.cantrips ?? [];
  const selectedRank1 = sectionData.spells?.rank1 ?? [];
  const cantripsFull = selectedCantrips.length >= maxCantrips;
  const rank1Full = maxRank1 <= 0 || selectedRank1.length >= maxRank1;

  const allTraits = new Set();
  for (const spell of [...cantrips, ...rank1Spells]) {
    for (const trait of spell.traits) allTraits.add(trait);
  }
  const traitOptions = [...allTraits].filter((trait) => trait !== 'cantrip').sort();

  const { focusCantrips, focusNonCantrips } = await splitFocusSpells(focusSpells, { isDevotionChoice });

  return {
    target,
    spellSubStep: wizard.spellSubStep,
    cantrips,
    rank1Spells,
    selectedCantrips,
    selectedRank1,
    grantedCantrips: grantedSpells.cantrips,
    grantedRank1s: grantedSpells.rank1s,
    focusSpells,
    focusCantrips,
    focusNonCantrips,
    isDevotionChoice,
    traitOptions,
    maxCantrips,
    maxRank1,
    cantripsFull,
    rank1Full,
    tradition,
    className: classEntry?.name ?? 'Class',
    showSpellRarityFilters: !restrictToCommonSpellOptions,
    ...await classHandler.getSpellContext(sectionData, classDef),
  };
}

async function splitFocusSpells(focusSpells, { isDevotionChoice = false } = {}) {
  if (isDevotionChoice) {
    return { focusCantrips: [], focusNonCantrips: [...(focusSpells ?? [])] };
  }

  const focusCantrips = [];
  const focusNonCantrips = [];
  for (const spellEntry of focusSpells ?? []) {
    const spell = await fromUuid(spellEntry.uuid).catch(() => null);
    if (spell?.system?.traits?.value?.includes('cantrip')) focusCantrips.push(spellEntry);
    else focusNonCantrips.push(spellEntry);
  }
  return { focusCantrips, focusNonCantrips };
}

function projectSpellSectionData(data, target = 'primary') {
  if (target === 'secondary') {
    return {
      ...data,
      class: data.dualClass ?? null,
      subclass: data.dualSubclass ?? null,
      spells: data.dualSpells ?? { cantrips: [], rank1: [] },
      curriculumSpells: data.dualCurriculumSpells ?? { cantrips: [], rank1: [] },
    };
  }

  return {
    ...data,
    class: data.class ?? null,
    subclass: data.subclass ?? null,
    spells: data.spells ?? { cantrips: [], rank1: [] },
    curriculumSpells: data.curriculumSpells ?? { cantrips: [], rank1: [] },
  };
}

function setSpellSelectionCache(wizard, target, maxCantrips, maxRank1) {
  wizard._cachedSpellSelectionLimits ??= {};
  wizard._cachedSpellSelectionLimits[target] = { maxCantrips, maxRank1 };

  if (target === 'primary') {
    wizard._cachedMaxCantrips = maxCantrips;
    wizard._cachedMaxRank1 = maxRank1;
  } else {
    wizard._cachedDualMaxCantrips = maxCantrips;
    wizard._cachedDualMaxRank1 = maxRank1;
  }
}

export function getSanitizedCurriculumSelections(wizard, target = 'primary') {
  const sectionData = projectSpellSectionData(wizard.data, target);
  const curriculum = getEffectiveSubclassCurriculum(sectionData.subclass) ?? {};
  return {
    cantrips: limitCurriculumSelections(
      sectionData.curriculumSpells?.cantrips ?? [],
      new Set(curriculum[0] ?? []),
      Math.min(1, (curriculum[0] ?? []).length),
    ),
    rank1: limitCurriculumSelections(
      sectionData.curriculumSpells?.rank1 ?? [],
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
