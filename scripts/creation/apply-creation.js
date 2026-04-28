import { getClassHandler } from './class-handlers/registry.js';
import { getClassSelectionData, getGrantedFeatChoiceValues } from './creation-model.js';
import { ClassRegistry } from '../classes/registry.js';
import { MODULE_ID, MIXED_ANCESTRY_CHOICE_FLAG, MIXED_ANCESTRY_UUID } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { debug, info, warn } from '../utils/logger.js';
import { capitalize, getCampaignFeatSectionIds, isAncestralParagonEnabled } from '../utils/pf2e-api.js';
import { format, localize } from '../utils/i18n.js';
import { findMatchingChoiceOption } from '../ui/character-wizard/choice-sets.js';
import { getMixedAncestrySelectedValue } from '../heritages/mixed-ancestry.js';
import { applyFeatGrantEntries } from '../apply/apply-feat-grants.js';
import { buildFeatGrantRequirements, getAutomaticFeatGrantEntries, mergeFeatGrantEntries } from '../plan/feat-grants.js';
import {
  extractCompendiumUuidsByCategory,
  isCompendiumUuidInCategory,
} from '../system-support/profiles.js';

export async function applyCreation(actor, data, onProgress = null) {
  info(`Applying character creation for ${actor.name}`);
  const reportProgress = (progress, message) => {
    if (typeof onProgress === 'function') onProgress({ progress, message });
  };

  reportProgress(0.05, 'Applying ancestry, background, and class...');
  if (data.ancestry) await applyItem(actor, data.ancestry, 'ancestry', getStoredChoiceSelections(data, data.ancestry.uuid));
  if (data.heritage) await applyItem(actor, data.heritage, 'heritage', getStoredChoiceSelections(data, data.heritage.uuid));
  if (data.background) await applyItem(actor, data.background, 'background', getStoredChoiceSelections(data, data.background.uuid));
  await applyClassItems(actor, data);
  const handler = getClassHandler(data.class?.slug);
  const dualClassData = projectDualClassCreationData(data);
  const dualHandler = getClassHandler(data.dualClass?.slug);
  if (data.subclass && handler.shouldApplySubclassItem(data) !== false) {
    await applyItem(actor, data.subclass, 'subclass', getStoredChoiceSelections(data, data.subclass.uuid));
  }
  if (data.dualSubclass && dualHandler.shouldApplySubclassItem(dualClassData) !== false) {
    await applyItem(actor, data.dualSubclass, 'subclass', getStoredChoiceSelections(data, data.dualSubclass.uuid));
  }
  reportProgress(0.28, 'Waiting for the PF2E system to finish initializing items...');
  await waitForSystem();

  reportProgress(0.42, 'Applying boosts, languages, and skills...');
  await applyBoosts(actor, data);
  await applyLanguages(actor, data);
  await applyDeitySkill(actor, data);

  if (data.skills.length > 0) {
    const updates = {};
    for (const skill of data.skills) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    await actor.update(updates);
    debug(`Trained ${data.skills.length} skills`);
  }

  reportProgress(0.58, 'Applying lore and level 1 feats...');
  await applyLores(actor, data);

  if (data.ancestryFeat) await applyFeat(actor, data.ancestryFeat, 'ancestry', 1);
  if (data.ancestryParagonFeat) await applyFeat(actor, data.ancestryParagonFeat, getCreationAncestryParagonGroup(), 1);
  if (data.classFeat) await applyFeat(actor, data.classFeat, 'class', 1);
  if (data.dualClassFeat) await applyFeat(actor, data.dualClassFeat, getCreationDualClassFeatGroup(), 1);
  if (data.skillFeat) await applyFeat(actor, data.skillFeat, 'skill', 1);

  reportProgress(0.72, 'Waiting for PF2E class option prompts...');
  await applySelectedItems(actor, data);
  await applySelectedFormulas(actor, data);
  await applyCreationFeatGrants(actor, data);
  await applyDirectFeatGrantedSpells(actor, data);
  await applySelectedSkillChoices(actor, data);
  await ensureGrantedFeatSectionsApplied(actor, data);
  await applyEquipment(actor, data);

  // Class-specific apply (spellcasting, focus spells, deity, divine font, etc.)
  reportProgress(0.86, 'Finalizing class-specific features...');
  await handler.applyExtras(actor, data);
  if (data.dualClass?.slug) {
    await dualHandler.applyExtras(actor, dualClassData);
  }

  reportProgress(0.97, 'Creating summary message...');
  await createCreationMessage(actor, data);
  reportProgress(1, 'Character creation complete.');

  info(`Character creation complete for ${actor.name}`);
}

async function applyCreationFeatGrants(actor, data) {
  const sourceUuids = new Set(getSelectedFeatEntries(data).map((entry) => entry.uuid));
  if (data.class?.uuid) sourceUuids.add(data.class.uuid);
  if (data.dualClass?.uuid) sourceUuids.add(data.dualClass.uuid);
  if (data.subclass?.uuid) sourceUuids.add(data.subclass.uuid);
  if (data.dualSubclass?.uuid) sourceUuids.add(data.dualSubclass.uuid);
  for (const entry of getClassSelectionSourceEntries(data, 'class')) sourceUuids.add(entry.uuid);
  for (const entry of getClassSelectionSourceEntries(data, 'dualClass')) sourceUuids.add(entry.uuid);
  for (const entry of getSelectedChoiceSourceEntries(data)) sourceUuids.add(entry.uuid);

  const detectedRequirements = await buildFeatGrantRequirements({
    actor,
    feats: [...sourceUuids].map((uuid) => ({ uuid })),
    classEntries: [data.class, data.dualClass].filter(Boolean),
    level: 1,
  });
  const automaticGrants = getAutomaticFeatGrantEntries(detectedRequirements)
    .filter((grant) => sourceUuids.has(grant?.sourceFeatUuid));
  const grants = mergeFeatGrantEntries(
    (data.featGrants ?? []).filter((grant) => sourceUuids.has(grant?.sourceFeatUuid)),
    automaticGrants,
  );
  if (grants.length === 0) return { items: [], formulas: [], spells: [] };
  return applyFeatGrantEntries(actor, grants);
}

function projectDualClassCreationData(data) {
  return {
    ...data,
    class: data.dualClass ?? null,
    subclass: data.dualSubclass ?? null,
    ...getClassSelectionData(data, 'dualClass'),
    spells: data.dualSpells ?? { cantrips: [], rank1: [] },
    curriculumSpells: data.dualCurriculumSpells ?? { cantrips: [], rank1: [] },
  };
}

export async function applyItem(actor, entry, type, choices = {}) {
  if (entry?.uuid === MIXED_ANCESTRY_UUID) {
    await applyMixedAncestryHeritage(actor, entry, choices);
    return;
  }

  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) {
    warn(`Failed to resolve ${type}: ${entry.uuid}`);
    return;
  }
  const itemData = foundry.utils.deepClone(item.toObject());
  applyStoredChoices(itemData, choices);
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied ${type}: ${entry.name}`);
}

async function applyClassItems(actor, data) {
  const classEntries = [data.dualClass, data.class].filter((entry) => !!entry?.uuid);
  if (classEntries.length === 0) return;

  const itemData = [];
  const appliedNames = [];

  for (const entry of classEntries) {
    const item = await fromUuid(entry.uuid).catch(() => null);
    if (!item) {
      warn(`Failed to resolve class: ${entry.uuid}`);
      continue;
    }

    const resolvedItemData = foundry.utils.deepClone(item.toObject());
    applyStoredChoices(resolvedItemData, getStoredChoiceSelections(data, entry.uuid));
    itemData.push(resolvedItemData);
    appliedNames.push(entry.name);
  }

  normalizeDualClassHp(itemData);

  if (itemData.length === 0) return;
  await actor.createEmbeddedDocuments('Item', itemData);
  debug(`Applied classes: ${appliedNames.join(', ')}`);
}

function normalizeDualClassHp(classItemData) {
  if (!Array.isArray(classItemData) || classItemData.length < 2) return;

  const highestHp = Math.max(
    ...classItemData
      .map((item) => Number(item?.system?.hp))
      .filter(Number.isFinite),
  );
  if (!Number.isFinite(highestHp)) return;

  for (const item of classItemData) {
    item.system ??= {};
    item.system.hp = highestHp;
  }
}

async function applyMixedAncestryHeritage(actor, entry, choices = {}) {
  const selectedAncestry = await resolveAncestryFromMixedChoice(choices?.[MIXED_ANCESTRY_CHOICE_FLAG]);
  const selectedSlug = selectedAncestry?.slug
    ?? (typeof choices?.[MIXED_ANCESTRY_CHOICE_FLAG] === 'string' ? choices[MIXED_ANCESTRY_CHOICE_FLAG] : null)
    ?? null;
  const vision = normalizeMixedAncestryVision(selectedAncestry?.system?.vision ?? null);
  const itemData = {
    name: entry?.name ?? 'Mixed Ancestry',
    type: 'heritage',
    img: entry?.img ?? actor?.ancestry?.img ?? null,
    system: {
      slug: 'mixed-ancestry',
      description: {
        value: selectedAncestry?.name
          ? `<p>Mixed Ancestry tied to ${selectedAncestry.name}.</p>`
          : '<p>Mixed Ancestry.</p>',
      },
      traits: {
        value: [],
        rarity: 'uncommon',
      },
      ancestry: null,
      rules: [],
      ...(vision ? { vision } : {}),
    },
    flags: {
      [MODULE_ID]: {
        mixedAncestryHeritage: true,
        mixedAncestrySelection: selectedSlug,
      },
      pf2e: {
        rulesSelections: {
          [MIXED_ANCESTRY_CHOICE_FLAG]: selectedSlug,
        },
      },
    },
  };

  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied heritage: ${entry?.name ?? 'Mixed Ancestry'}`);
}

async function applyFeat(actor, entry, group, level) {
  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) return;
  const itemData = foundry.utils.deepClone(item.toObject());
  itemData.system.location = `${group}-${level}`;
  itemData.system.level = { ...itemData.system.level, taken: level };
  applyStoredChoices(itemData, entry.choices ?? {});
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied feat: ${entry.name} (${group}-${level})`);
}

async function applyBoosts(actor, data) {
  const ancestryBoosts = data.boosts.ancestry ?? [];
  const backgroundBoosts = data.boosts.background ?? [];
  const classBoosts = data.boosts.class ?? [];
  const freeBoosts = data.boosts.free ?? [];

  const ancestry = actor.ancestry;
  if (ancestry && data.alternateAncestryBoosts) {
    await ancestry.update({ 'system.alternateAncestryBoosts': ancestryBoosts });
  } else if (ancestry && ancestryBoosts.length) {
    const boostSlots = ancestry.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < ancestryBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = ancestryBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await ancestry.update(update);
    }
  }

  const background = actor.items?.find((i) => i.type === 'background');
  if (background && backgroundBoosts.length) {
    const boostSlots = background.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < backgroundBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = backgroundBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await background.update(update);
    }
  }

  const classItem = actor.class;
  if (classItem && classBoosts.length) {
    await classItem.update({ 'system.keyAbility.selected': classBoosts[0] });
  }

  if (freeBoosts.length) {
    const buildSource = foundry.utils.mergeObject(actor.toObject().system.build ?? {}, { attributes: { boosts: {} } });
    buildSource.attributes.boosts[1] = freeBoosts;
    await actor.update({ 'system.build': buildSource });
  }
}

async function applyLanguages(actor, data) {
  const additionalLangs = data.languages ?? [];
  if (additionalLangs.length === 0) return;

  const current = actor.system?.details?.languages?.value ?? [];
  const merged = [...new Set([...current, ...additionalLangs])];
  await actor.update({ 'system.details.languages.value': merged });
  debug(`Applied ${additionalLangs.length} additional languages: ${additionalLangs.join(', ')}`);
}

async function applyLores(actor, data) {
  const lores = [...new Set([...(data.lores ?? []), ...(data.selectedLoreSkills ?? [])])];
  if (lores.length === 0) return;

  const existingLores = actor.items?.filter((i) => i.type === 'lore').map((i) => i.name) ?? [];
  const toCreate = lores
    .filter((name) => !existingLores.includes(name))
    .map((name) => ({
      name,
      type: 'lore',
      system: {
        proficient: { value: 1 },
      },
    }));

  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments('Item', toCreate);
    debug(`Created ${toCreate.length} lore skills: ${toCreate.map((l) => l.name).join(', ')}`);
  }
}

async function applyDeitySkill(actor, data) {
  const deitySkill = data.deity?.skill;
  if (!deitySkill) return;

  const currentRank = Number(actor.system?.skills?.[deitySkill]?.rank ?? 0);
  if (currentRank >= 1) return;

  await actor.update({ [`system.skills.${deitySkill}.rank`]: 1 });
  debug(`Trained deity skill: ${deitySkill}`);
}

async function applySelectedItems(actor, data) {
  const entries = getAdditionalSelectedItems(data);
  for (const entry of entries) {
    if (entry._type === 'spell') {
      await applySelectedSpell(actor, entry, data);
      continue;
    }
    await applyItem(actor, entry, entry._type ?? 'selected item');
  }
}

async function applyEquipment(actor, data) {
  for (const entry of (data.permanentItems ?? [])) {
    if (!entry) continue;
    const item = await fromUuid(entry.uuid).catch(() => null);
    if (!item) continue;
    const itemData = foundry.utils.deepClone(item.toObject());
    await actor.createEmbeddedDocuments('Item', [itemData]);
    debug(`Applied permanent item: ${entry.name} (level ${entry.itemLevel})`);
  }
  for (const entry of (data.equipment ?? [])) {
    const item = await fromUuid(entry.uuid).catch(() => null);
    if (!item) continue;
    const itemData = foundry.utils.deepClone(item.toObject());
    itemData.system.quantity = entry.quantity ?? 1;
    await actor.createEmbeddedDocuments('Item', [itemData]);
    debug(`Applied equipment: ${entry.name} x${entry.quantity ?? 1}`);
  }
}

async function applySelectedSkillChoices(actor, data) {
  const selectedSkills = getAdditionalSelectedSkills(data);
  if (selectedSkills.length === 0) return;

  const updates = {};
  for (const skill of selectedSkills) {
    const currentRank = Number(actor.system?.skills?.[skill]?.rank ?? 0);
    if (currentRank >= 1) continue;
    updates[`system.skills.${skill}.rank`] = 1;
  }

  if (Object.keys(updates).length === 0) return;
  await actor.update(updates);
  debug(`Applied selected skill choices: ${Object.keys(updates).join(', ')}`);
}

async function ensureGrantedFeatSectionsApplied(actor, data) {
  for (const section of (data.grantedFeatSections ?? [])) {
    const uuid = section?.slot;
    if (typeof uuid !== 'string' || uuid.length === 0) continue;
    if (!shouldApplyManualGrantedSection(data, section)) continue;
    if (actorHasItemSource(actor, uuid)) continue;

    await applyMissingGrantedFeatSection(actor, data, section);
  }
}

async function applySelectedFormulas(actor, data) {
  const entries = getAdditionalSelectedFormulas(data);
  if (entries.length === 0) return;

  const current = foundry.utils.deepClone(actor.system?.crafting?.formulas ?? []);
  const known = new Set(current.map((formula) => formula?.uuid).filter(Boolean));
  let changed = false;

  for (const entry of entries) {
    if (!entry.uuid || known.has(entry.uuid)) continue;
    current.push({ uuid: entry.uuid });
    known.add(entry.uuid);
    changed = true;
  }

  if (!changed) return;
  await actor.update({ 'system.crafting.formulas': current });
  debug(`Applied selected formulas: ${entries.map((entry) => entry.name).join(', ')}`);
}

async function applyDirectFeatGrantedSpells(actor, data) {
  const entries = await getDirectFeatGrantedSpellEntries(data);
  for (const entry of entries) {
    await applySelectedSpell(actor, entry, data);
  }
}

async function applyMissingGrantedFeatSection(actor, data, section) {
  const uuid = section?.slot;
  if (typeof uuid !== 'string' || uuid.length === 0) return;

  const item = await fromUuid(uuid).catch(() => null);
  if (!item) return;

  const itemData = foundry.utils.deepClone(item.toObject());
  applyStoredChoices(itemData, getStoredChoiceSelections(data, uuid), section.choiceSets ?? []);

  const sourceSuffix = formatManualGrantedSourceSuffix(data, section?.sourceName);
  if (sourceSuffix) {
    itemData.name = `${itemData.name} (${sourceSuffix})`;
  }

  itemData.flags ??= {};
  itemData.flags[MODULE_ID] ??= {};
  itemData.flags[MODULE_ID].manualGrantedFallback = true;
  itemData.flags[MODULE_ID].manualGrantedFallbackSource = section?.sourceName ?? null;
  itemData.flags[MODULE_ID].manualGrantedFallbackOriginalName = item?.name ?? itemData.name;

  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Backfilled missing granted feat section: ${itemData.name}`);
}

export function getAdditionalSelectedItems(data) {
  const containers = [
    { choiceSets: data.subclass?.choiceSets ?? [], choices: data.subclass?.choices ?? {} },
    { choiceSets: data.ancestryFeat?.choiceSets ?? [], choices: data.ancestryFeat?.choices ?? {} },
    { choiceSets: data.ancestryParagonFeat?.choiceSets ?? [], choices: data.ancestryParagonFeat?.choices ?? {} },
    { choiceSets: data.classFeat?.choiceSets ?? [], choices: data.classFeat?.choices ?? {} },
    { choiceSets: data.skillFeat?.choiceSets ?? [], choices: data.skillFeat?.choices ?? {} },
    ...((data.grantedFeatSections ?? []).map((section) => ({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(data, section.slot),
    }))),
  ];

  const seen = new Set();
  const entries = [];

  for (const container of containers) {
    for (const choiceSet of (container.choiceSets ?? [])) {
      const selectedValue = container.choices?.[choiceSet.flag];
      if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') continue;
      const option = findMatchingChoiceOption(choiceSet.options, selectedValue);
      const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
      if (!uuid || seen.has(uuid) || !isSpellChoiceOption(option, uuid)) continue;
      seen.add(uuid);
      entries.push({
        uuid,
        name: option?.label ?? choiceSet.prompt ?? 'Selected Spell',
        _type: 'spell',
      });
    }
  }

  return entries;
}

export function getAdditionalSelectedSkills(data) {
  const containers = [
    { choiceSets: data.ancestryFeat?.choiceSets ?? [], choices: data.ancestryFeat?.choices ?? {} },
    { choiceSets: data.ancestryParagonFeat?.choiceSets ?? [], choices: data.ancestryParagonFeat?.choices ?? {} },
    { choiceSets: data.classFeat?.choiceSets ?? [], choices: data.classFeat?.choices ?? {} },
    { choiceSets: data.skillFeat?.choiceSets ?? [], choices: data.skillFeat?.choices ?? {} },
    ...((data.grantedFeatSections ?? []).map((section) => ({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(data, section.slot),
    }))),
  ];

  const skills = new Set();

  for (const container of containers) {
    for (const choiceSet of (container.choiceSets ?? [])) {
      const selectedValue = container.choices?.[choiceSet.flag];
      if (!choiceSet?.grantsSkillTraining && !isReplacementSkillTrainingChoice(choiceSet, selectedValue)) continue;
      const skill = resolveSelectedSkillChoice(choiceSet, selectedValue);
      if (skill) skills.add(skill);
    }
  }

  return [...skills];
}

function applyStoredChoices(itemData, choices = {}, choiceSets = []) {
  const entries = Object.entries(choices)
    .filter(([, value]) => typeof value === 'string' && value !== '[object Object]')
    .map(([flag, value]) => [flag, normalizeStoredChoiceValue(itemData, flag, value, choiceSets)])
    .filter(([flag, value]) => isApplicableStoredChoice(itemData, flag, value));
  if (entries.length === 0) return;

  itemData.flags ??= {};
  itemData.flags.pf2e ??= {};
  itemData.flags.pf2e.rulesSelections = Object.fromEntries(entries);
}

function normalizeStoredChoiceValue(itemData, flag, value, choiceSets = []) {
  const choiceRule = findChoiceRuleByFlag(itemData, flag);
  if (!choiceRule) return value;

  const matchingChoiceSet = (choiceSets ?? []).find((choiceSet) => choiceSet?.flag === flag);
  const matchingOption = findMatchingChoiceOption(matchingChoiceSet?.options ?? [], value);
  if (!matchingOption) return value;

  const ruleValues = getRuleChoiceOptions(choiceRule)
    .map((option) => option?.value ?? option?.label)
    .filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

  for (const candidate of [
    matchingOption.value,
    matchingOption.slug,
    matchingOption.label,
    matchingOption.name,
  ]) {
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.startsWith('Compendium.')) continue;
    if (ruleValues.some((ruleValue) => normalizeChoiceValue(ruleValue) === normalizeChoiceValue(candidate))) {
      return candidate;
    }
  }

  return value;
}

function normalizeChoiceValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

async function getDirectFeatGrantedSpellEntries(data) {
  const featEntries = getSelectedFeatEntries(data);
  const seen = new Set();
  const entries = [];

  for (const featEntry of featEntries) {
    const feat = await fromUuid(featEntry.uuid).catch(() => null);
    if (!feat) continue;
    const featData = typeof feat.toObject === 'function' ? feat.toObject() : feat;

    for (const uuid of extractSpellUuidsFromFeat(featData)) {
      if (seen.has(uuid)) continue;
      seen.add(uuid);
      entries.push({
        uuid,
        name: featEntry.name ?? featData.name ?? 'Granted Spell',
        _type: 'spell',
      });
    }
  }

  return entries;
}

export function getAdditionalSelectedFormulas(data) {
  const containers = [
    { choiceSets: data.ancestryFeat?.choiceSets ?? [], choices: data.ancestryFeat?.choices ?? {} },
    { choiceSets: data.ancestryParagonFeat?.choiceSets ?? [], choices: data.ancestryParagonFeat?.choices ?? {} },
    { choiceSets: data.classFeat?.choiceSets ?? [], choices: data.classFeat?.choices ?? {} },
    { choiceSets: data.dualClassFeat?.choiceSets ?? [], choices: data.dualClassFeat?.choices ?? {} },
    { choiceSets: data.skillFeat?.choiceSets ?? [], choices: data.skillFeat?.choices ?? {} },
    ...((data.grantedFeatSections ?? []).map((section) => ({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(data, section.slot),
    }))),
  ];

  const seen = new Set();
  const entries = [];

  for (const container of containers) {
    for (const choiceSet of (container.choiceSets ?? [])) {
      if (!isFormulaChoiceSet(choiceSet)) continue;
      const selectedValue = container.choices?.[choiceSet.flag];
      if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') continue;
      const option = findMatchingChoiceOption(choiceSet.options, selectedValue);
      const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
      if (!uuid || seen.has(uuid)) continue;
      seen.add(uuid);
      entries.push({
        uuid,
        name: option?.label ?? choiceSet.prompt ?? 'Selected Formula',
        _type: 'formula',
      });
    }
  }

  return entries;
}

function getSelectedFeatEntries(data) {
  return [
    data.ancestryFeat,
    data.ancestryParagonFeat,
    data.classFeat,
    data.dualClassFeat,
    data.skillFeat,
    ...((data.grantedFeatSections ?? [])
      .map((section) => (section?.slot && section?.featName ? { uuid: section.slot, name: section.featName } : null))
      .filter(Boolean)),
  ].filter((entry) => !!entry?.uuid);
}

function getClassSelectionSourceEntries(data, target) {
  const bucket = getClassSelectionData(data, target);
  return [
    bucket.implement,
    bucket.innovationItem,
    bucket.innovationModification,
    bucket.secondElement,
    bucket.subconsciousMind,
    bucket.thesis,
    bucket.deity,
    bucket.devotionSpell,
    ...(bucket.tactics ?? []),
    ...(bucket.ikons ?? []),
    ...(bucket.kineticImpulses ?? []),
    ...(bucket.apparitions ?? []),
  ].filter((entry) => !!entry?.uuid);
}

function getSelectedChoiceSourceEntries(data) {
  const containers = [
    { choiceSets: data.subclass?.choiceSets ?? [], choices: data.subclass?.choices ?? {} },
    { choiceSets: data.dualSubclass?.choiceSets ?? [], choices: data.dualSubclass?.choices ?? {} },
    { choiceSets: data.ancestryFeat?.choiceSets ?? [], choices: data.ancestryFeat?.choices ?? {} },
    { choiceSets: data.ancestryParagonFeat?.choiceSets ?? [], choices: data.ancestryParagonFeat?.choices ?? {} },
    { choiceSets: data.classFeat?.choiceSets ?? [], choices: data.classFeat?.choices ?? {} },
    { choiceSets: data.dualClassFeat?.choiceSets ?? [], choices: data.dualClassFeat?.choices ?? {} },
    { choiceSets: data.skillFeat?.choiceSets ?? [], choices: data.skillFeat?.choices ?? {} },
    ...((data.grantedFeatSections ?? []).map((section) => ({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(data, section.slot),
    }))),
  ];

  return containers.flatMap((container) =>
    (container.choiceSets ?? []).map((choiceSet) => {
      const selectedValue = container.choices?.[choiceSet.flag];
      if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') return null;
      const option = findMatchingChoiceOption(choiceSet.options ?? [], selectedValue);
      const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
      if (!uuid) return null;
      return { uuid, name: option?.label ?? choiceSet.prompt ?? uuid };
    }).filter(Boolean));
}

function extractSpellUuidsFromFeat(feat) {
  const uuids = new Set();

  for (const rule of feat?.system?.rules ?? []) {
    if (rule?.key === 'GrantItem' && typeof rule?.uuid === 'string' && isCompendiumUuidInCategory(rule.uuid, 'spells')) {
      uuids.add(rule.uuid);
    }
  }

  const html = String(feat?.system?.description?.value ?? '');
  if (!html) return [...uuids];
  if (hasEmbeddedSpellChoiceDescription(html)) return [...uuids];

  for (const uuid of extractCompendiumUuidsByCategory(html, 'spells')) uuids.add(uuid);

  return [...uuids];
}

function hasEmbeddedSpellChoiceDescription(html) {
  const text = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return /\b(?:choose|select|pick)\b/.test(text)
    && (/\bspell(?:book|s)?\b/.test(text) || /\brepertoire\b/.test(text))
    && extractCompendiumUuidsByCategory(html, 'spells').length > 0;
}

function isApplicableStoredChoice(itemData, flag, value) {
  const choiceRule = findChoiceRuleByFlag(itemData, flag);
  if (!choiceRule) return true;
  if (!isSkillChoiceRule(choiceRule)) return true;

  const normalizedValue = normalizeSkillChoice(value);
  if (!normalizedValue) return true;

  const options = getRuleChoiceOptions(choiceRule);
  if (options.length === 0) return true;

  return options.some((option) => normalizeSkillChoice(option?.value ?? option?.label) === normalizedValue);
}

function findChoiceRuleByFlag(itemData, targetFlag) {
  const rules = itemData?.system?.rules ?? [];
  for (const [index, rule] of rules.entries()) {
    if (rule?.key !== 'ChoiceSet') continue;
    if (getChoiceSetFlag(rule, index) === targetFlag) return rule;
  }
  return null;
}

function getChoiceSetFlag(rule, index = 0) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return typeof index === 'number' ? `choiceSet${index + 1}` : null;
}

function isSkillChoiceRule(rule) {
  if (!rule || rule.key !== 'ChoiceSet') return false;
  if (rule?.choices?.config === 'skills') return true;
  return Array.isArray(rule?.choices) && rule.choices.length > 0
    && rule.choices.every((option) => !!normalizeSkillChoice(option?.value ?? option?.label));
}

function getRuleChoiceOptions(rule) {
  return Array.isArray(rule?.choices) ? rule.choices : [];
}

function getStoredChoiceSelections(data, uuid) {
  if (!uuid) return {};
  if (data.subclass?.uuid === uuid) return data.subclass.choices ?? {};
  if (data.ancestryFeat?.uuid === uuid) return data.ancestryFeat.choices ?? {};
  if (data.ancestryParagonFeat?.uuid === uuid) return data.ancestryParagonFeat.choices ?? {};
  if (data.classFeat?.uuid === uuid) return data.classFeat.choices ?? {};
  if (data.skillFeat?.uuid === uuid) return data.skillFeat.choices ?? {};
  if (uuid === MIXED_ANCESTRY_UUID) {
    const selected = getMixedAncestrySelectedValue(data.mixedAncestry)
      ?? getMixedAncestrySelectedValue(getGrantedFeatChoiceValues(data, MIXED_ANCESTRY_UUID));
    return selected ? { [MIXED_ANCESTRY_CHOICE_FLAG]: selected } : {};
  }
  return getGrantedFeatChoiceValues(data, uuid);
}

function actorHasItemSource(actor, uuid) {
  const items = Array.isArray(actor?.items)
    ? actor.items
    : Array.isArray(actor?.items?.contents)
      ? actor.items.contents
      : [];

  return items.some((item) => {
    const sourceId = item?.sourceId ?? item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? null;
    return sourceId === uuid || item?.uuid === uuid;
  });
}

function formatManualGrantedSourceSuffix(data, sourceName) {
  const normalized = String(sourceName ?? '').trim();
  if (!normalized) return '';

  const segments = normalized.split('->').map((part) => part.trim()).filter(Boolean);
  if (segments.length === 0) return '';
  const primary = segments[0];

  const typedSource = [
    ['Ancestry', data?.ancestry?.name],
    ['Heritage', data?.heritage?.name],
    ['Background', data?.background?.name],
    ['Class', data?.class?.name],
    ['Subclass', data?.subclass?.name],
    ['Ancestry Feat', data?.ancestryFeat?.name],
    ['Ancestry Paragon', data?.ancestryParagonFeat?.name],
    ['Class Feat', data?.classFeat?.name],
    ['Skill Feat', data?.skillFeat?.name],
  ].find(([, name]) => String(name ?? '').trim() === primary);

  if (typedSource) return `${typedSource[0]}: ${typedSource[1]}`;
  return primary;
}

function shouldApplyManualGrantedSection(data, section) {
  if (!isAssuranceSection(section)) return !isSelectedFeatGrantChain(data, section);

  const sourceSection = findManualGrantedSourceSection(data, section);
  if (!sourceSection) return true;

  const sourceChoices = getGrantedFeatChoiceValues(data, sourceSection.slot);
  const sourceChoiceSet = (sourceSection.choiceSets ?? []).find((choiceSet) =>
    Array.isArray(choiceSet?.options) && choiceSet.options.length > 0 && choiceSet.flag,
  );
  if (!sourceChoiceSet) return true;

  const selectedValue = sourceChoices?.[sourceChoiceSet.flag];
  if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') {
    return false;
  }

  return !findMatchingChoiceOption(sourceChoiceSet.options ?? [], selectedValue);
}

function isSelectedFeatGrantChain(data, section) {
  const sourceName = String(section?.sourceName ?? '').trim();
  if (!sourceName.includes('->')) return false;

  const [primarySource] = sourceName.split('->').map((part) => part.trim()).filter(Boolean);
  if (!primarySource) return false;

  return [
    data?.ancestryFeat,
    data?.ancestryParagonFeat,
    data?.classFeat,
    data?.dualClassFeat,
    data?.skillFeat,
  ].some((feat) => String(feat?.name ?? '').trim() === primarySource);
}

function isAssuranceSection(section) {
  const featName = String(section?.featName ?? '').trim().toLowerCase();
  const sourceName = String(section?.sourceName ?? '').trim().toLowerCase();
  return featName === 'assurance' || sourceName.endsWith('-> assurance');
}

function findManualGrantedSourceSection(data, section) {
  const sourceName = String(section?.sourceName ?? '').trim();
  if (!sourceName.includes('->')) return null;

  const [primarySource] = sourceName.split('->').map((part) => part.trim()).filter(Boolean);
  if (!primarySource) return null;

  return (data?.grantedFeatSections ?? []).find((candidate) =>
    candidate !== section
    && String(candidate?.featName ?? '').trim() === primarySource,
  ) ?? null;
}

async function resolveAncestryFromMixedChoice(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.startsWith('Compendium.')) return fromUuid(value).catch(() => null);

  for (const key of getCompendiumKeysForCategory('ancestries')) {
    const pack = game.packs.get(key);
    if (!pack) continue;
    const documents = await pack.getDocuments();
    const match = documents.find((entry) => String(entry?.slug ?? '').toLowerCase() === value.toLowerCase());
    if (match) return match;
  }

  return null;
}

function normalizeMixedAncestryVision(vision) {
  if (vision === 'lowLightVision' || vision === 'low-light-vision') return 'lowLightVision';
  return null;
}

function getCreationAncestryParagonGroup() {
  if (!isAncestralParagonEnabled()) return 'ancestry';
  if (getCampaignFeatSectionIds().includes('ancestryParagon')) return 'ancestryParagon';
  return 'xdy_ancestryparagon';
}

function getCreationDualClassFeatGroup() {
  const sectionIds = getCampaignFeatSectionIds()
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0);
  const matchingId = sectionIds.find((id) => ['xdy_dualclass', 'dualclass', 'dual_class'].includes(id.toLowerCase()));
  return matchingId ?? 'dualclass';
}

function resolveSelectedSkillChoice(choiceSet, selectedValue) {
  if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') {
    return null;
  }

  const option = choiceSet.options?.find((candidate) => candidate.value === selectedValue);
  const candidates = [
    selectedValue,
    option?.value,
    option?.label,
    option?.slug,
    option?.name,
  ];

  for (const candidate of candidates) {
    const slug = normalizeSkillChoice(candidate);
    if (slug) return slug;
  }

  return null;
}

function isReplacementSkillTrainingChoice(choiceSet, selectedValue) {
  if (!isStoredSkillChoiceSet(choiceSet)) return false;
  if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') return false;
  if (findMatchingChoiceOption(choiceSet.options ?? [], selectedValue)) return false;
  return !!resolveSelectedSkillChoice(choiceSet, selectedValue);
}

function normalizeSkillChoice(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^pf2e\.skill/i, '')
    .replace(/[^a-z0-9]+/g, '');
  if (!normalized) return null;

  const aliases = {
    acr: 'acrobatics',
    arc: 'arcana',
    ath: 'athletics',
    cra: 'crafting',
    dec: 'deception',
    dip: 'diplomacy',
    itm: 'intimidation',
    med: 'medicine',
    nat: 'nature',
    occ: 'occultism',
    prf: 'performance',
    rel: 'religion',
    soc: 'society',
    ste: 'stealth',
    sur: 'survival',
    thi: 'thievery',
  };
  if (aliases[normalized]) return aliases[normalized];
  if ([
    'acrobatics',
    'arcana',
    'athletics',
    'crafting',
    'deception',
    'diplomacy',
    'intimidation',
    'medicine',
    'nature',
    'occultism',
    'performance',
    'religion',
    'society',
    'stealth',
    'survival',
    'thievery',
  ].includes(normalized)) return normalized;

  const skills = globalThis.CONFIG?.PF2E?.skills ?? {};
  for (const [slug, rawEntry] of Object.entries(skills)) {
    const rawLabel = typeof rawEntry === 'string' ? rawEntry : (rawEntry?.label ?? slug);
    const localizedLabel = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
    for (const candidate of [slug, rawLabel, localizedLabel]) {
      const candidateId = String(candidate ?? '')
        .trim()
        .toLowerCase()
        .replace(/^pf2e\.skill/i, '')
        .replace(/[^a-z0-9]+/g, '');
      if (candidateId === normalized) return aliases[slug] ?? slug;
    }
  }

  return null;
}

function isStoredSkillChoiceSet(choiceSet) {
  if (choiceSet?.grantsSkillTraining === true) return true;
  if (choiceSet?.syntheticType === 'skill-training-fallback') return true;

  const options = Array.isArray(choiceSet?.options) ? choiceSet.options : [];
  return options.length > 0 && options.every((option) => !!normalizeSkillChoice(option?.value ?? option?.label));
}

function isSpellChoiceOption(option, uuid) {
  if (option?.type === 'spell') return true;
  if (isCompendiumUuidInCategory(option?.uuid, 'spells')) return true;
  return isCompendiumUuidInCategory(uuid, 'spells');
}

function isFormulaChoiceSet(choiceSet) {
  if (choiceSet?.syntheticType === 'formula-choice') return true;
  const prompt = String(choiceSet?.prompt ?? '').toLowerCase();
  if (prompt.includes('formula')) return true;
  return false;
}

async function applySelectedSpell(actor, entry, data) {
  const spell = await fromUuid(entry.uuid).catch(() => null);
  if (!spell) return;

  const existing = actor.items?.find((item) =>
    item.type === 'spell' && (item.sourceId ?? item.flags?.core?.sourceId ?? item.uuid) === spell.uuid,
  );
  if (existing) return;

  const focusLike = isFocusLikeSpell(spell);
  const spellEntry = await ensureSpellcastingEntry(actor, spell, data, { focusLike });
  const spellData = foundry.utils.deepClone(spell.toObject());
  spellData.system.location = { value: spellEntry.id };
  await actor.createEmbeddedDocuments('Item', [spellData]);

  if (focusLike) {
    await ensureFocusPool(actor);
  }

  debug(`Applied selected spell choice: ${spell.name}`);
}

function isFocusLikeSpell(spell) {
  const traits = spell.system?.traits?.value ?? [];
  if (traits.includes('focus')) return true;
  const traditions = spell.system?.traits?.traditions ?? [];
  return traditions.length === 0;
}

async function ensureSpellcastingEntry(actor, spell, data, { focusLike = false } = {}) {
  const existing = actor.items?.find((item) =>
    item.type === 'spellcastingEntry' && (focusLike ? item.system?.prepared?.value === 'focus' : true),
  );
  if (existing) return existing;

  const classDef = data.class?.slug ? ClassRegistry.get(data.class.slug) : null;
  const tradition = resolveSpellTradition(spell, data, classDef, focusLike);
  const ability = classDef?.keyAbility?.length === 1 ? classDef.keyAbility[0] : 'cha';
  const name = focusLike ? `${capitalize(data.class?.slug ?? 'Focus')} Focus Spells` : 'Innate Spells';
  const prepared = focusLike ? 'focus' : (classDef?.spellcasting ? classDef.spellcasting.type : 'innate');

  const created = await actor.createEmbeddedDocuments('Item', [{
    name,
    type: 'spellcastingEntry',
    system: {
      tradition: { value: tradition },
      prepared: { value: prepared },
      ability: { value: ability },
      proficiency: { value: 1 },
    },
  }]);

  return created[0];
}

function resolveSpellTradition(spell, data, classDef, focusLike) {
  if (focusLike && data.subclass?.tradition) return data.subclass.tradition;
  if (classDef?.spellcasting?.tradition && !['bloodline', 'patron'].includes(classDef.spellcasting.tradition)) {
    return classDef.spellcasting.tradition;
  }
  if (data.subclass?.tradition) return data.subclass.tradition;
  const traditions = spell.system?.traits?.traditions ?? [];
  return traditions[0] ?? 'arcane';
}

async function ensureFocusPool(actor) {
  const currentMax = actor.system?.resources?.focus?.max ?? 0;
  const currentValue = actor.system?.resources?.focus?.value ?? 0;
  const newMax = Math.min(3, Math.max(1, currentMax + 1));
  const newValue = Math.max(currentValue, newMax);
  await actor.update({
    'system.resources.focus.max': newMax,
    'system.resources.focus.value': newValue,
  });
}

function waitForSystem() {
  return new Promise((resolve) => setTimeout(resolve, 600));
}

async function createCreationMessage(actor, data) {
  const sections = [];
  const subclassChoiceLabels = await getSelectedSubclassChoiceLabels(data.subclass);
  const identityRows = [];
  if (data.ancestry) identityRows.push({ label: localize('CREATION.STEPS.ANCESTRY'), value: formatChatLink(data.ancestry) });
  if (data.heritage) identityRows.push({ label: localize('CREATION.STEPS.HERITAGE'), value: formatChatLink(data.heritage) });
  if (data.background) identityRows.push({ label: localize('CREATION.STEPS.BACKGROUND'), value: formatChatLink(data.background) });
  if (data.class) identityRows.push({ label: localize('CREATION.STEPS.CLASS'), value: formatChatLink(data.class) });
  if (data.subclass) {
    const subclassLabel = subclassChoiceLabels.length > 0
      ? `${formatChatLink(data.subclass)} (${subclassChoiceLabels.join(', ')})`
      : formatChatLink(data.subclass);
    identityRows.push({ label: localize('CREATION.STEPS.SUBCLASS'), value: subclassLabel });
  }
  if (identityRows.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.CHARACTER'), identityRows));
  }

  const classChoices = [];
  if (data.implement) classChoices.push({ label: localize('CREATION.CHAT.IMPLEMENT'), value: formatChatLink(data.implement) });
  if (data.tactics?.length) classChoices.push({ label: localize('CREATION.CHAT.TACTICS'), value: data.tactics.map((entry) => formatChatLink(entry)).join(', ') });
  if (data.ikons?.length) classChoices.push({ label: localize('CREATION.CHAT.IKONS'), value: data.ikons.map((entry) => formatChatLink(entry)).join(', ') });
  if (data.innovationItem) classChoices.push({ label: localize('CREATION.CHAT.INNOVATION_ITEM'), value: formatChatLink(data.innovationItem) });
  if (data.innovationModification) classChoices.push({ label: localize('CREATION.CHAT.INNOVATION_MOD'), value: formatChatLink(data.innovationModification) });
  if (data.kineticGateMode) classChoices.push({ label: localize('CREATION.CHAT.KINETIC_GATE'), value: data.kineticGateMode === 'dual-gate' ? localize('CREATION.CHAT.DUAL_GATE') : localize('CREATION.CHAT.SINGLE_GATE') });
  if (data.secondElement) classChoices.push({ label: localize('CREATION.CHAT.SECOND_ELEMENT'), value: formatChatLink(data.secondElement) });
  if (data.kineticImpulses?.length) classChoices.push({ label: localize('CREATION.CHAT.IMPULSES'), value: data.kineticImpulses.map((entry) => formatChatLink(entry)).join(', ') });
  if (data.subconsciousMind) classChoices.push({ label: localize('CREATION.CHAT.SUBCONSCIOUS_MIND'), value: formatChatLink(data.subconsciousMind) });
  if (data.thesis) classChoices.push({ label: localize('CREATION.CHAT.ARCANE_THESIS'), value: formatChatLink(data.thesis) });
  if (data.apparitions?.length) {
    const labels = data.apparitions.map((entry) =>
      entry.uuid === data.primaryApparition ? `${formatChatLink(entry)} (Primary)` : formatChatLink(entry),
    );
    classChoices.push({ label: localize('CREATION.CHAT.APPARITIONS'), value: labels.join(', ') });
  }
  if (data.deity) classChoices.push({ label: localize('CREATION.STEPS.DEITY'), value: formatChatLink(data.deity) });
  if (data.sanctification) {
    const handler = getClassHandler(data.class?.slug);
    const sanctStep = handler.getExtraSteps().find((s) => s.id === 'sanctification');
    const sanctLabel = sanctStep?.label ?? 'Sanctification';
    classChoices.push({ label: sanctLabel, value: data.sanctification === 'none' ? localize('CREATION.CHAT.NONE') : capitalize(data.sanctification) });
  }
  if (data.divineFont) {
    const handler = getClassHandler(data.class?.slug);
    const fontStep = handler.getExtraSteps().find((s) => s.id === 'divineFont');
    const fontLabel = fontStep?.label ?? 'Divine Font';
    classChoices.push({ label: fontLabel, value: formatDivineFontValue(data.divineFont) });
  }
  if (classChoices.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.CHOICES'), classChoices));
  }

  const training = [];
  if (data.languages?.length) training.push({ label: localize('CREATION.STEPS.LANGUAGES'), value: data.languages.map((slug) => localizeLanguageSlug(slug)).join(', ') });
  if (data.lores?.length) training.push({ label: localize('CREATION.LORE_SKILLS'), value: data.lores.join(', ') });
  if (data.devotionSpell) {
    training.push({ label: localize('CREATION.CHAT.FOCUS_SPELL'), value: formatChatLink(data.devotionSpell) });
  } else {
    const handler = getClassHandler(data.class?.slug);
    const focusSpells = await handler.resolveFocusSpells(data);
    if (focusSpells.length > 0) {
      training.push({ label: localize('CREATION.CHAT.FOCUS_SPELLS'), value: focusSpells.map((s) => formatChatLink(s)).join(', ') });
    }
  }
  if (data.ancestryFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.ancestryFeat);
    training.push({ label: localize('SECTIONS.ANCESTRY_FEAT'), value: labels.length ? `${formatChatLink(data.ancestryFeat)} (${labels.join(', ')})` : formatChatLink(data.ancestryFeat) });
  }
  if (data.ancestryParagonFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.ancestryParagonFeat);
    const value = labels.length ? `${formatChatLink(data.ancestryParagonFeat)} (${labels.join(', ')})` : formatChatLink(data.ancestryParagonFeat);
    training.push({ label: `${localize('SECTIONS.ANCESTRY_FEAT')} (Paragon)`, value });
  }
  if (data.classFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.classFeat);
    training.push({ label: localize('SECTIONS.CLASS_FEAT'), value: labels.length ? `${formatChatLink(data.classFeat)} (${labels.join(', ')})` : formatChatLink(data.classFeat) });
  }
  if (data.skillFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.skillFeat);
    training.push({ label: localize('SECTIONS.SKILL_FEAT'), value: labels.length ? `${formatChatLink(data.skillFeat)} (${labels.join(', ')})` : formatChatLink(data.skillFeat) });
  }
  for (const section of (data.grantedFeatSections ?? [])) {
    const labels = await getSelectedSubclassChoiceLabels({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(data, section.slot),
    });
    if (labels.length > 0) {
      const sourceSuffix = section.sourceName ? ` (${section.sourceName})` : '';
      training.push({ label: localize('CREATION.CHAT.GRANTED_FEAT_CHOICE'), value: `${formatChatLink({ uuid: section.slot, name: section.featName })}${sourceSuffix}: ${labels.join(', ')}` });
    }
  }
  if (training.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.STARTING_BENEFITS'), training));
  }

  const equipmentRows = (data.equipment ?? []).map((entry) => ({
    label: entry.quantity > 1 ? `x${entry.quantity}` : '',
    value: formatChatLink(entry),
  }));
  if (equipmentRows.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.EQUIPMENT'), equipmentRows));
  }

  const content = buildChatCard({
    eyebrow: localize('CREATION.CHAT.CHARACTER_CREATED'),
    title: format('CREATION.CHAT.CHARACTER_READY', { actorName: actor.name }),
    accent: '#c6a15b',
    sections,
  });
  const whisper = [];
  for (const user of game.users) {
    if (user.isGM || actor.testUserPermission(user, 'OWNER')) whisper.push(user.id);
  }
  await ChatMessage.create({ content, speaker: { alias: actor.name }, whisper });
}

function formatDivineFontValue(value) {
  if (value === 'healing') return 'Healing';
  if (value === 'harmful') return 'Harmful';
  return capitalize(value);
}

async function getSelectedSubclassChoiceLabels(subclass) {
  const currentChoices = subclass?.choices ?? {};
  const labels = [];

  for (const choiceSet of (subclass?.choiceSets ?? [])) {
    const selectedValue = currentChoices[choiceSet.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') continue;

    const match = choiceSet.options?.find((option) => option.value === selectedValue);
    if (match?.label) {
      labels.push(match.label);
      continue;
    }

    if (selectedValue.startsWith('Compendium.')) {
      const item = await fromUuid(selectedValue).catch(() => null);
      if (item?.name) {
        labels.push(item.name);
        continue;
      }
    }

    labels.push(formatChoiceLabel(selectedValue));
  }

  return labels.filter((label) => typeof label === 'string' && label.length > 0);
}

function formatChoiceLabel(value) {
  return value
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildChatCard({ eyebrow, title, accent, sections }) {
  return `
    <section style="border:1px solid rgba(0,0,0,0.15); border-left:4px solid ${accent}; border-radius:12px; padding:12px 14px; background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,245,245,0.96)); box-shadow:0 2px 10px rgba(0,0,0,0.08);">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${accent}; margin-bottom:4px;">${eyebrow}</div>
      <div style="font-size:30px; font-weight:800; line-height:0.95; margin-bottom:12px; color:#1f1f1f;">${title}</div>
      <div style="display:grid; gap:10px;">${sections.join('')}</div>
    </section>
  `;
}

function buildChatRowsSection(label, rows) {
  return `
    <div style="padding:10px 12px; background:rgba(255,255,255,0.72); border:1px solid rgba(0,0,0,0.08); border-radius:10px;">
      <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#666; margin-bottom:8px;">${label}</div>
      <div style="display:grid; gap:6px;">
        ${rows.map((row) => `
          <div style="display:grid; grid-template-columns:minmax(92px, 120px) minmax(0, 1fr); gap:10px; align-items:start;">
            <div style="font-size:12px; font-weight:700; color:#555; min-width:0;">${row.label}</div>
            <div style="font-size:12px; font-weight:600; color:#222; min-width:0; overflow-wrap:anywhere; word-break:break-word;">${row.value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function localizeLanguageSlug(slug) {
  const raw = CONFIG.PF2E?.languages?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
}

function formatChatLink(entry) {
  if (!entry) return '';
  const uuid = typeof entry.uuid === 'string' ? entry.uuid : null;
  const name = typeof entry.name === 'string' ? entry.name : uuid ?? '';
  if (!uuid || !name) return name;
  return `@UUID[${uuid}]{${name}}`;
}
