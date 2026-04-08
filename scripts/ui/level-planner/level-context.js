import { PROFICIENCY_RANK_NAMES, SKILLS, SUBCLASS_TAGS, WEALTH_MODES, CHARACTER_WEALTH, expandPermanentItemSlots, MODULE_ID } from '../../constants.js';
import { getChoicesForLevel } from '../../classes/progression.js';
import { getLevelData } from '../../plan/plan-model.js';
import { computeBuildState } from '../../plan/build-state.js';
import { loadCompendium, loadCompendiumCategory, loadDeities } from '../character-wizard/loaders.js';
import { parseChoiceSets } from '../character-wizard/choice-sets.js';

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

export async function buildLevelContext(planner, classDef, options) {
  if (!planner.plan || !classDef) return {};

  const level = planner.selectedLevel;
  const levelData = getLevelData(planner.plan, level) ?? {};
  const choices = getChoicesForLevel(classDef, level, options);
  const choiceTypes = new Set(choices.map((choice) => choice.type));
  const classFeat = await enrichPlannerFeat(planner, extractFeat(levelData.classFeats));
  const skillFeat = await enrichPlannerFeat(planner, extractFeat(levelData.skillFeats));
  const generalFeat = await enrichPlannerFeat(planner, extractFeat(levelData.generalFeats));
  const ancestryFeat = await enrichPlannerFeat(planner, extractFeat(levelData.ancestryFeats));
  const generalFeatGrantsAncestryFeat = isAncestralParagonFeat(generalFeat);
  const generalFeatIsAdoptedAncestry = isAdoptedAncestryFeat(generalFeat);
  const adoptedAncestryOptions = generalFeatIsAdoptedAncestry
    ? await buildAdoptedAncestryOptions(planner, generalFeat)
    : [];
  const classFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, classFeat);
  const generalFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, generalFeat);
  const ancestryFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, ancestryFeat);
  const archetypeFeat = await enrichPlannerFeat(planner, extractFeat(levelData.archetypeFeats));
  const archetypeFeatChoiceSets = await buildPlannerFeatChoiceSets(planner, archetypeFeat);
  const customFeats = await buildCustomPlannerFeatEntries(planner, levelData.customFeats ?? []);
  const customSkillIncreaseGroups = buildCustomSkillIncreaseGroups(levelData.customSkillIncreases ?? []);
  const customAvailableSkills = buildCustomAvailableSkills(planner, levelData, level);
  const customSpellGroups = buildCustomSpellGroups(levelData.customSpells ?? []);

  return {
    classFeatures: getClassFeaturesForLevel(planner, level),
    showBoosts: choiceTypes.has('abilityBoosts'),
    boostCount: choices.find((choice) => choice.type === 'abilityBoosts')?.count ?? 4,
    selectedBoostCount: (levelData.abilityBoosts ?? []).length,
    attributes: planner._buildAttributeContext(levelData, choices),
    intelligenceBenefit: planner._buildIntelligenceBenefitContext(level),
    intBonusSkillOptions: planner._buildIntBonusSkillContext(levelData, level),
    intBonusLanguageOptions: planner._buildIntBonusLanguageContext(levelData, level),
    intBonusSkillCount: levelData.intBonusSkills?.length ?? 0,
    intBonusLanguageCount: levelData.intBonusLanguages?.length ?? 0,
    showClassFeat: choiceTypes.has('classFeat'),
    classFeat,
    classFeatChoiceSets,
    showSkillFeat: choiceTypes.has('skillFeat'),
    skillFeat,
    showGeneralFeat: choiceTypes.has('generalFeat'),
    generalFeat,
    generalFeatChoiceSets,
    showGeneralFeatAdoptedAncestry: generalFeatIsAdoptedAncestry,
    generalFeatAdoptedAncestryOptions: adoptedAncestryOptions,
    selectedGeneralFeatAdoptedAncestry: generalFeat?.choices?.adoptedAncestry ?? generalFeat?.adoptedAncestry ?? '',
    showAncestryFeat: choiceTypes.has('ancestryFeat') && !generalFeatGrantsAncestryFeat,
    ancestryFeat,
    ancestryFeatChoiceSets,
    showGeneralFeatGrantedAncestryFeat: generalFeatGrantsAncestryFeat,
    generalFeatGrantedAncestryFeat: ancestryFeat,
    showSkillIncrease: choiceTypes.has('skillIncrease') && !planner._shouldHideHistoricalSkillIncrease(level),
    availableSkills: planner._buildSkillContext(levelData, level),
    showArchetypeFeat: choiceTypes.has('archetypeFeat'),
    archetypeFeat,
    archetypeFeatChoiceSets,
    showMythicFeat: choiceTypes.has('mythicFeat'),
    mythicFeat: extractFeat(levelData.mythicFeats),
    showDualClassFeat: choiceTypes.has('dualClassFeat'),
    dualClassFeat: extractFeat(levelData.dualClassFeats),
    showCustomLevelPlan: true,
    customPlanOpen: planner._isCustomPlanOpen(level),
    customFeats,
    customSkillIncreaseGroups,
    customAvailableSkills,
    customSpellGroups,
    customEquipment: (levelData.customEquipment ?? []).map((entry, index) => ({ ...entry, index })),
    ...buildEquipmentContext(planner, level, levelData),
    ...buildABPContext(level, options),
    ...(await planner._buildSpellContext(classDef, level)),
  };
}

function buildEquipmentContext(planner, level, levelData) {
  const wealthMode = game.settings.get(MODULE_ID, 'startingWealthMode') ?? WEALTH_MODES.DISABLED;
  const actorLevel = planner.actor.system?.details?.level?.value ?? 1;
  const isItemsAndCurrency = wealthMode === WEALTH_MODES.ITEMS_AND_CURRENCY;
  const showEquipment = isItemsAndCurrency && level === actorLevel && actorLevel > 1;

  if (!showEquipment) return { showEquipment: false };

  const slots = expandPermanentItemSlots(actorLevel);
  const plannedEquipment = levelData.equipment ?? [];
  const equipmentSlots = slots.map((slot, index) => ({
    index,
    maxLevel: slot.level,
    filled: plannedEquipment[index] ?? null,
  }));

  const entry = CHARACTER_WEALTH[actorLevel];
  const currencyBudgetGp = entry?.currencyGp ?? 0;

  return {
    showEquipment: true,
    equipmentSlots,
    equipmentCurrencyBudgetGp: currencyBudgetGp,
  };
}

export function buildABPContext(level, options) {
  if (!options.abp) return { showABP: false };

  const ABP_NEW_POTENCY = [3, 6, 9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_2 = [9, 13, 15, 17, 20];
  const ABP_UPGRADE_TO_3 = [17, 20];

  const hasNew = ABP_NEW_POTENCY.includes(level);
  const hasUpgrade2 = ABP_UPGRADE_TO_2.includes(level);
  const hasUpgrade3 = ABP_UPGRADE_TO_3.includes(level);

  if (!hasNew && !hasUpgrade2 && !hasUpgrade3) return { showABP: false };

  return {
    showABP: true,
    abpHasNew: hasNew,
    abpHasUpgrade2: hasUpgrade2,
    abpHasUpgrade3: hasUpgrade3,
  };
}

export function getClassFeaturesForLevel(planner, level) {
  const classItem = planner.actor.class;
  if (!classItem?.system?.items) return [];

  return Object.values(classItem.system.items)
    .filter((feature) => feature.level === level)
    .map((feature) => ({ name: feature.name, uuid: feature.uuid, img: feature.img }));
}

export function annotateFeat(feat) {
  if (!feat) return null;
  if (MANUAL_SPELL_FEATS.has(feat.slug)) {
    feat.manualSpellNote = true;
  }
  return feat;
}

export function extractFeat(feats) {
  if (!feats || feats.length === 0) return null;
  return feats[0];
}

async function buildCustomPlannerFeatEntries(planner, feats) {
  const entries = [];
  for (let index = 0; index < feats.length; index++) {
    const feat = await enrichPlannerFeat(planner, feats[index]);
    entries.push({
      index,
      feat,
      choiceSets: await buildPlannerFeatChoiceSets(planner, feat),
    });
  }
  return entries;
}

async function enrichPlannerFeat(planner, feat) {
  const annotated = annotateFeat(feat);
  if (!annotated?.uuid) return annotated;
  const preview = await buildFeatGrantPreview(planner, annotated);
  annotated.grantedItems = preview.grantedItems;
  annotated.grantChoiceSets = preview.grantChoiceSets;
  return annotated;
}

function buildCustomSkillIncreaseGroups(customSkillIncreases) {
  const entries = customSkillIncreases.map((entry, index) => ({
    index,
    skill: entry.skill,
    label: localizeSkillSlug(entry.skill),
    toRank: entry.toRank,
    rankName: PROFICIENCY_RANK_NAMES[entry.toRank] ?? String(entry.toRank ?? ''),
  }));

  return groupEntriesBy(entries, (entry) => entry.rankName, (rankName) => ({
    label: titleCase(rankName),
    sort: Number(customSkillIncreases.find((entry) => (PROFICIENCY_RANK_NAMES[entry.toRank] ?? String(entry.toRank ?? '')) === rankName)?.toRank ?? 0),
  }));
}

function buildCustomAvailableSkills(planner, levelData, level) {
  const currentSkills = computeBuildState(planner.actor, planner.plan, level).skills ?? {};
  const maxRank = level >= 15 ? 4 : level >= 7 ? 3 : 2;
  const currentIncrease = levelData?.skillIncreases?.[0];

  return SKILLS.map((slug) => {
    const rank = currentSkills[slug] ?? 0;
    const nextRank = rank + 1;
    return {
      slug,
      label: localizeSkillSlug(slug),
      nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
      disabled: nextRank > maxRank,
      selected: currentIncrease?.skill === slug,
    };
  }).filter((entry) => !entry.disabled);
}

function buildCustomSpellGroups(customSpells) {
  const entries = customSpells.map((spell, index) => ({
    ...spell,
    index,
    displayRank: spell.isCantrip ? 'Cantrip' : `Rank ${resolveSpellDisplayRank(spell)}`,
  }));

  return groupEntriesBy(entries, (entry) => entry.displayRank, (displayRank) => ({
    label: displayRank,
    sort: /^Rank\s+(\d+)$/i.test(displayRank) ? Number(displayRank.match(/^Rank\s+(\d+)$/i)?.[1] ?? 0) : -1,
  }));
}

function resolveSpellDisplayRank(spell) {
  const rank = Number(spell?.rank);
  if (Number.isFinite(rank) && rank >= 0) return rank;

  const baseRank = Number(spell?.baseRank);
  if (Number.isFinite(baseRank) && baseRank >= 0) return baseRank;

  return 0;
}

function groupEntriesBy(entries, getKey, getMeta) {
  const groups = new Map();

  for (const entry of entries) {
    const key = getKey(entry);
    if (!groups.has(key)) {
      groups.set(key, { key, ...(getMeta?.(key) ?? {}), entries: [] });
    }
    groups.get(key).entries.push(entry);
  }

  return [...groups.values()].sort((a, b) => {
    if ((a.sort ?? 0) !== (b.sort ?? 0)) return (a.sort ?? 0) - (b.sort ?? 0);
    return String(a.label ?? a.key).localeCompare(String(b.label ?? b.key));
  });
}

function titleCase(value) {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isAncestralParagonFeat(feat) {
  if (!feat) return false;
  const slug = String(feat.slug ?? '').toLowerCase();
  const name = String(feat.name ?? '').toLowerCase();
  return slug === 'ancestral-paragon' || name === 'ancestral paragon';
}

function isAdoptedAncestryFeat(feat) {
  if (!feat) return false;
  const slug = String(feat.slug ?? '').toLowerCase();
  const name = String(feat.name ?? '').toLowerCase();
  return slug === 'adopted-ancestry' || name === 'adopted ancestry';
}

async function buildAdoptedAncestryOptions(planner, feat) {
  const items = await loadCompendiumCategory(planner, 'ancestries');
  const current = feat?.choices?.adoptedAncestry ?? feat?.adoptedAncestry ?? '';
  const actorAncestry = String(planner.actor?.ancestry?.slug ?? '').toLowerCase();

  return items
    .filter((item) => item?.slug && String(item.slug).toLowerCase() !== actorAncestry)
    .filter((item) => String(item?.rarity ?? 'common').toLowerCase() === 'common')
    .map((item) => ({
      value: String(item.slug).toLowerCase(),
      label: item.name,
      img: item.img ?? null,
      rarity: String(item.rarity ?? 'common').toLowerCase(),
      selected: String(item.slug).toLowerCase() === String(current).toLowerCase(),
    }));
}

async function buildPlannerFeatChoiceSets(planner, feat) {
  if (!feat?.uuid) return [];

  const source = await fromUuid(feat.uuid).catch(() => null);
  const rules = source?.system?.rules ?? [];
  if (!Array.isArray(rules) || rules.length === 0) return [];

  if (sourceHasDeityAssociatedSkill(source)) {
    const deitySkill = await resolvePlannerDeitySkill(planner, feat?.choices?.deity ?? null);
    syncFeatDynamicSkillRules(feat, true, deitySkill);
  }

  const wizard = createPlannerChoiceWizard(planner);
  const choiceSets = await parseChoiceSets(wizard, rules, feat.choices ?? {}, source);
  const fallbackSets = hasSkillFallbackText(source?.system?.description?.value ?? '')
    ? await buildPlannerSkillFallbackChoiceSets(planner, feat, source)
    : [];
  const dedicationFallbackSets = choiceSets.length === 0
    ? await buildPlannerDedicationChoiceSetFallbacks(planner, feat, source)
    : [];

  return [...choiceSets, ...fallbackSets, ...dedicationFallbackSets]
    .map((entry) => ({
      ...entry,
      options: (entry.options ?? []).map((option) => ({
        ...option,
        selected: String(option?.value ?? '') === String(feat?.choices?.[entry.flag] ?? ''),
      })),
      choiceType: entry.options.every((option) => SKILLS.includes(String(option.value ?? '').toLowerCase())) ? 'skill' : 'item',
    }))
    .filter((entry) => entry.options.length > 0);
}

export async function buildFeatGrantPreview(planner, feat) {
  const source = await fromUuid(feat.uuid).catch(() => null);
  if (!source) return { grantedItems: [], grantChoiceSets: [] };

  const wizard = createPlannerChoiceWizard(planner);
  const grantedItems = [];
  const grantChoiceSets = [];
  const seenGranted = new Set();

  await collectGrantPreviewEntries({
    item: source,
    planner,
    wizard,
    storedChoices: feat.choices ?? {},
    grantedItems,
    grantChoiceSets,
    seenGranted,
  });

  return {
    grantedItems,
    grantChoiceSets,
  };
}

async function collectGrantPreviewEntries({
  item,
  planner,
  wizard,
  storedChoices,
  grantedItems,
  grantChoiceSets,
  seenGranted,
}) {
  if (!item) return;

  const choiceSets = await parseChoiceSets(wizard, item.system?.rules ?? [], storedChoices, item);
  for (const choiceSet of choiceSets) {
    const selectedValue = storedChoices?.[choiceSet.flag];
    if (typeof selectedValue === 'string' && selectedValue.length > 0 && selectedValue !== '[object Object]') continue;
    if (grantChoiceSets.some((entry) => entry.flag === choiceSet.flag)) continue;
    grantChoiceSets.push({
      ...choiceSet,
      choiceType: choiceSet.options.every((option) => SKILLS.includes(String(option.value ?? '').toLowerCase())) ? 'skill' : 'item',
      sourceName: item.name,
    });
  }

  for (const rule of item.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
    const ruleChoices = {
      ...(storedChoices ?? {}),
      ...extractGrantPreselectedChoices(rule),
    };
    const resolvedUuid = resolveGrantRuleUuid(rule.uuid, ruleChoices);
    if (!resolvedUuid) continue;
    const granted = await fromUuid(resolvedUuid).catch(() => null);
    if (!granted) continue;

    const dedupeKey = `${item.uuid ?? item.name}->${granted.uuid}`;
    if (!seenGranted.has(dedupeKey)) {
      seenGranted.add(dedupeKey);
      grantedItems.push({
        uuid: granted.uuid,
        name: granted.name,
        img: granted.img ?? null,
        sourceName: item.name,
      });
    }

    await collectGrantPreviewEntries({
      item: granted,
      planner,
      wizard,
      storedChoices: ruleChoices,
      grantedItems,
      grantChoiceSets,
      seenGranted,
    });
  }
}

function createPlannerChoiceWizard(planner) {
  const wizard = {
    actor: planner.actor,
    _compendiumCache: planner._compendiumCache ?? (planner._compendiumCache = {}),
    data: {
      deity: planner.actor?.items?.find?.((item) => item.type === 'deity') ?? null,
    },
    _getCachedDocument: (uuid) => fromUuid(uuid).catch(() => null),
    _loadCompendium: async (key) => loadCompendium(wizard, key),
    _loadDeities: async () => loadDeities(planner),
    async _getClassTrainedSkills() {
      const classItem = planner.actor?.class;
      if (!classItem) return [];
      const rules = classItem.system?.rules ?? [];
      return rules
        .filter((rule) => rule.key === 'ActiveEffectLike' && typeof rule.path === 'string' && rule.path.startsWith('system.skills.') && rule.path.endsWith('.rank'))
        .map((rule) => rule.path.replace('system.skills.', '').replace('.rank', ''))
        .filter(Boolean);
    },
  };
  return wizard;
}

function extractGrantPreselectedChoices(rule) {
  const rawChoices = rule?.preselectChoices ?? rule?.preselectChoice;
  if (!rawChoices || typeof rawChoices !== 'object') return {};
  return Object.fromEntries(
    Object.entries(rawChoices)
      .filter(([, value]) => ['string', 'number'].includes(typeof value))
      .map(([flag, value]) => [flag, String(value)]),
  );
}

function resolveGrantRuleUuid(uuid, choices) {
  const raw = String(uuid ?? '').trim();
  if (!raw) return null;
  if (!raw.includes('{item|flags.pf2e.rulesSelections.')) return raw;

  const resolved = raw.replace(/\{item\|flags\.pf2e\.rulesSelections\.([^}]+)\}/g, (_match, flag) => {
    const value = choices?.[flag];
    return typeof value === 'string' ? value : '';
  });

  return resolved.includes('{item|') ? null : resolved;
}

async function buildDeityChoiceOptions(planner, feat, flag) {
  const selected = String(feat?.choices?.[flag] ?? '');
  const deities = await loadDeities(planner);
  return deities.map((item) => ({
    value: item.uuid,
    label: item.name,
    img: item.img ?? null,
    selected: item.uuid === selected,
  }));
}

async function buildPlannerSkillFallbackChoiceSets(planner, feat, source) {
  const grantedSkills = await getGrantedPlannerSkillSlugs(planner, feat, source);
  if (grantedSkills.length === 0) return [];

  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const overlaps = grantedSkills.filter((skill) => (buildState.skills?.[skill] ?? 0) >= 1);
  if (overlaps.length === 0) return [];

  return overlaps.map((skill, index) => {
    const flag = `levelerSkillFallback${index + 1}`;
    return {
      flag,
      prompt: 'Select a skill.',
      choiceType: 'skill',
      options: buildPlannerSkillFallbackOptions(planner, feat, flag, grantedSkills.filter((entry) => entry !== skill)),
    };
  });
}

function buildPlannerSkillFallbackOptions(planner, feat, flag, blockedSkills) {
  const selected = String(feat?.choices?.[flag] ?? '');
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  const selectedElsewhere = new Set(
    Object.entries(feat?.choices ?? {})
      .filter(([entryFlag, value]) => /^levelerSkillFallback\d+$/i.test(entryFlag) && entryFlag !== flag && typeof value === 'string')
      .map(([, value]) => value),
  );
  const blocked = new Set(blockedSkills);

  return SKILLS.map((slug) => {
    const selectedHere = slug === selected;
    const trained = (buildState.skills?.[slug] ?? 0) >= 1;
    const disabled = !selectedHere && (trained || blocked.has(slug) || selectedElsewhere.has(slug));
    return {
      value: slug,
      label: localizeSkillSlug(slug),
      selected: selectedHere,
      disabled,
    };
  }).filter((entry) => !entry.disabled || entry.selected);
}

function isDeityChoiceRule(rule) {
  const prompt = localizeRulePrompt(rule).trim().toLowerCase();
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();
  return String(rule?.flag ?? '').toLowerCase() === 'deity'
    || filterText.includes('item:type:deity')
    || filterText.includes('item:category:deity')
    || prompt === 'select a deity.'
    || prompt === 'select a deity';
}

function localizeRulePrompt(rule) {
  const prompt = String(rule?.prompt ?? '');
  return game.i18n?.has?.(prompt) ? game.i18n.localize(prompt) : prompt;
}

function getChoiceSetFlag(rule) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return null;
}

async function getGrantedPlannerSkillSlugs(planner, feat, source) {
  const skills = new Set(
    [...(feat?.skillRules ?? []), ...(feat?.dynamicSkillRules ?? [])]
      .map((rule) => rule?.skill)
      .filter((skill) => SKILLS.includes(skill)),
  );

  if (sourceHasDeityAssociatedSkill(source)) {
    const deityUuid = feat?.choices?.deity ?? null;
    const deitySkill = await resolvePlannerDeitySkill(planner, deityUuid);
    syncFeatDynamicSkillRules(feat, true, deitySkill);
    if (SKILLS.includes(deitySkill)) skills.add(deitySkill);
  }

  return [...skills];
}

async function resolvePlannerDeitySkill(planner, deityUuid) {
  if (typeof deityUuid !== 'string' || deityUuid.length === 0) return null;
  const deities = await loadDeities(planner);
  return deities.find((entry) => entry.uuid === deityUuid)?.skill ?? null;
}

function sourceHasDeityAssociatedSkill(entry) {
  const description = String(entry?.system?.description?.value ?? entry?.description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return /\byour deity'?s associated skill\b/.test(description);
}

async function buildPlannerDedicationChoiceSetFallbacks(planner, feat, source) {
  const rules = Array.isArray(source?.system?.rules) ? source.system.rules : [];
  const choiceRules = rules.filter((rule) => rule?.key === 'ChoiceSet' && rule?.choices && typeof rule.choices === 'object');
  if (choiceRules.length === 0) return [];

  const archetypeSlug = getPlannerDedicationArchetypeSlug(feat, source);
  const subclassTag = SUBCLASS_TAGS[archetypeSlug];
  if (!subclassTag) return [];

  const wizard = createPlannerChoiceWizard(planner);
  const classFeatures = await loadCompendiumCategory(wizard, 'classFeatures');
  const feats = await loadCompendiumCategory(wizard, 'feats');
  const candidates = [...classFeatures, ...feats];

  return choiceRules
    .filter((rule) => JSON.stringify(rule?.choices?.filter ?? []).toLowerCase().includes(`item:tag:${subclassTag}`))
    .map((rule) => {
      const filters = rule?.choices?.filter ?? [];
      const excludeClassArchetype = JSON.stringify(filters).toLowerCase().includes('item:tag:class-archetype');
      const options = candidates
        .filter((entry) => matchesTagFamily(entry?.otherTags ?? [], subclassTag))
        .filter((entry) => !excludeClassArchetype || !matchesTagFamily(entry?.otherTags ?? [], 'class-archetype'))
        .map((entry) => ({
          value: entry.uuid ?? entry.slug,
          label: entry.name,
          uuid: entry.uuid ?? null,
          img: entry.img ?? null,
          traits: entry.traits ?? [],
          rarity: entry.rarity ?? 'common',
          type: entry.type ?? null,
          category: entry.category ?? null,
          range: entry.range ?? null,
          isRanged: !!entry.isRanged,
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));

      if (options.length === 0) return null;

      const prompt = String(rule?.prompt ?? '').trim();
      return {
        flag: String(rule?.flag ?? ''),
        prompt: game.i18n?.has?.(prompt) ? game.i18n.localize(prompt) : prompt,
        options,
      };
    })
    .filter((entry) => entry?.flag && entry.options.length > 0);
}

function getPlannerDedicationArchetypeSlug(feat, source) {
  const genericTraits = new Set(['archetype', 'dedication', 'class', 'multiclass', 'general', 'skill', 'mythic']);
  const traits = [
    ...(Array.isArray(feat?.traits) ? feat.traits : []),
    ...(source?.system?.traits?.value ?? []),
    ...(feat?.system?.traits?.value ?? []),
  ]
    .map((trait) => String(trait).toLowerCase())
    .filter((trait) => trait && !genericTraits.has(trait));

  if (traits.length > 0) return traits[0];

  const slug = String(feat?.slug ?? source?.slug ?? '').toLowerCase();
  if (slug.endsWith('-dedication')) return slug.replace(/-dedication$/u, '');
  return '';
}

function matchesTagFamily(tags, expected) {
  const normalizedExpected = String(expected ?? '').toLowerCase();
  return (tags ?? []).some((tag) => {
    const normalizedTag = String(tag ?? '').toLowerCase();
    return normalizedTag === normalizedExpected || normalizedTag.startsWith(`${normalizedExpected}-`);
  });
}

function hasSkillFallbackText(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return false;

  return [
    /if you would automatically become trained in one of those skills(?:\s*\([^)]*\))?,?\s+you instead become trained in a skill of your choice\.?/,
    /for each of these skills in which you were already trained,?\s+you instead become trained in a skill of your choice\.?/,
  ].some((pattern) => pattern.test(description));
}

function syncFeatDynamicSkillRules(feat, shouldAdd, deitySkill) {
  if (!feat) return;
  const otherRules = (feat.dynamicSkillRules ?? []).filter((rule) => rule?.source !== 'deity-associated-skill');
  if (shouldAdd && SKILLS.includes(deitySkill)) {
    otherRules.push({ skill: deitySkill, value: 1, source: 'deity-associated-skill' });
  }
  feat.dynamicSkillRules = otherRules;
}

function localizeSkillSlug(slug) {
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
}
