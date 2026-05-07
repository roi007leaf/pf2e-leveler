import { SKILLS } from '../../constants.js';
import { getClassSelectionData, getGrantedFeatChoiceValues } from '../../creation/creation-model.js';
import {
  ANACHRONISM_MODULE_ID,
  getActiveSystemId,
  getActiveSystemProfile,
  getCampaignLanguages,
  getRulesetConfig,
  SYSTEM_IDS,
} from '../../system-support/profiles.js';
import { localize } from '../../utils/i18n.js';
import { evaluatePredicate } from '../../utils/predicate.js';
import { normalizeSkillSlug } from '../../utils/skill-slugs.js';

export async function buildLanguageContext(wizard) {
  const ancestryItem = wizard.data.ancestry?.uuid ? await wizard._getCachedDocument(wizard.data.ancestry.uuid) : null;
  const grantedSlugs = [...(ancestryItem?.system?.languages?.value ?? [])];
  const featGrants = await collectFeatLanguageGrants(wizard);
  for (const slug of featGrants.slugs) {
    if (!grantedSlugs.includes(slug)) grantedSlugs.push(slug);
  }
  const suggestedSlugs = new Set(ancestryItem?.system?.additionalLanguages?.value ?? []);
  const baseCount = ancestryItem?.system?.additionalLanguages?.count ?? 0;
  const intMod = await wizard._computeIntMod();
  const maxAdditional = Math.max(0, baseCount + intMod + featGrants.bonusSlots);
  wizard._cachedMaxLanguages = maxAdditional;

  const langMap = getLanguageMap();
  const rarityMap = getLanguageRarityMap();

  const granted = grantedSlugs.map((slug) => ({
    slug,
    label: langMap[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    rarity: rarityMap[slug] ?? 'common',
    granted: true,
    selected: false,
    source: featGrants.slugs.includes(slug) ? 'feat' : 'ancestry',
  }));

  const allLanguageSlugs = Object.keys(langMap);
  const choosable = allLanguageSlugs
    .filter((slug) => !grantedSlugs.includes(slug) && slug !== 'CommonLanguage')
    .map((slug) => ({
      slug,
      label: langMap[slug],
      rarity: rarityMap[slug] ?? 'common',
      suggested: suggestedSlugs.has(slug),
      selected: wizard.data.languages.includes(slug),
    }))
    .sort((a, b) => {
      if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

  return {
    grantedLanguages: granted,
    choosableLanguages: choosable,
    maxLanguages: maxAdditional,
    selectedLanguageCount: wizard.data.languages.length,
  };
}

export async function collectFeatLanguageGrants(wizard) {
  const result = { slugs: [], bonusSlots: 0 };
  const seen = new Set();
  for (const source of getLanguageGrantSources(wizard)) {
    if (!source?.uuid) continue;
    const item = await wizard._getCachedDocument(source.uuid);
    if (!item) continue;
    await scanItemForLanguages(wizard, item, result, seen);
  }
  return result;
}

function getLanguageGrantSources(wizard) {
  return [
    wizard.data.ancestry,
    wizard.data.heritage,
    wizard.data.background,
    wizard.data.class,
    wizard.data.dualClass,
    wizard.data.subclass,
    wizard.data.dualSubclass,
    wizard.data.ancestryFeat,
    wizard.data.ancestryParagonFeat,
    wizard.data.classFeat,
    wizard.data.dualClassFeat,
    wizard.data.skillFeat,
    ...(wizard.data.grantedFeatSections ?? []).map((section) => ({ uuid: section.slot })),
  ].filter(Boolean);
}

async function scanItemForLanguages(wizard, item, result, seen = new Set()) {
  if (!item || seen.has(item.uuid)) return;
  seen.add(item.uuid);

  const subfeatureLangs = item.system?.subfeatures?.languages;
  if (subfeatureLangs) {
    for (const slug of subfeatureLangs.granted ?? []) {
      const normalized = String(slug).toLowerCase();
      if (normalized && !result.slugs.includes(normalized)) result.slugs.push(normalized);
    }
    const slots = Number(subfeatureLangs.slots ?? 0);
    if (slots > 0) result.bonusSlots += slots;
  }

  for (const rule of item.system?.rules ?? []) {
    if (rule.key === 'ActiveEffectLike' && typeof rule.path === 'string') {
      if ((rule.path === 'system.traits.languages.value' || rule.path === 'system.languages.value') && typeof rule.value === 'string') {
        const slug = rule.value.toLowerCase();
        if (!result.slugs.includes(slug)) result.slugs.push(slug);
      }
      if (rule.path === 'system.build.languages.granted') {
        const slug = typeof rule.value === 'string' ? rule.value.toLowerCase() : (rule.value?.slug ?? '').toLowerCase();
        if (slug && !result.slugs.includes(slug)) result.slugs.push(slug);
      }
      if (rule.path === 'system.build.languages.max') {
        const bonus = parseLanguageBonusValue(rule.value);
        if (bonus > 0) result.bonusSlots += bonus;
      }
    }
    if (rule.key === 'GrantItem' && typeof rule.uuid === 'string') {
      if (!evaluatePredicate(rule.predicate, wizard?.actor?.system?.details?.level?.value ?? 1)) continue;
      const granted = await fromUuid(rule.uuid).catch(() => null);
      if (granted) await scanItemForLanguages(wizard, granted, result, seen);
    }
  }
}

function parseLanguageBonusValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (Number.isFinite(num)) return num;
    if (value.startsWith('ternary(')) return 1;
  }
  return 0;
}

export function getLanguageMap() {
  const configLangs = getRulesetConfig().languages;
  if (configLangs && typeof configLangs === 'object') {
    const map = {};
    for (const [key, value] of Object.entries(configLangs)) {
      const raw = typeof value === 'string' ? value : (value?.label ?? key);
      map[key] = game.i18n.has(raw) ? game.i18n.localize(raw) : raw;
    }
    if (Object.keys(map).length > 0) return map;
  }
  return {};
}

export function getLanguageRarityMap() {
  const map = {};
  const languageSettings = getCampaignLanguages();
  if (languageSettings) {
    const common = languageSettings.common instanceof Set
      ? languageSettings.common
      : new Set(languageSettings.common ?? []);
    const uncommon = languageSettings.uncommon instanceof Set
      ? languageSettings.uncommon
      : new Set(languageSettings.uncommon ?? []);
    const rare = languageSettings.rare instanceof Set
      ? languageSettings.rare
      : new Set(languageSettings.rare ?? []);
    const secret = languageSettings.secret instanceof Set
      ? languageSettings.secret
      : new Set(languageSettings.secret ?? []);

    for (const slug of common) map[slug] = 'common';
    for (const slug of uncommon) map[slug] = 'uncommon';
    for (const slug of rare) map[slug] = 'rare';
    for (const slug of secret) map[slug] = 'secret';
    if (languageSettings.commonLanguage) {
      map.common = 'common';
      map[languageSettings.commonLanguage] ??= 'common';
    }
  }

  const configLangs = getRulesetConfig().languages;
  if (!configLangs || typeof configLangs !== 'object') return map;

  for (const [key, value] of Object.entries(configLangs)) {
    map[key] ??= String(value?.rarity ?? value?.traits?.rarity ?? 'common').toLowerCase();
  }
  return map;
}

export async function getBackgroundLores(wizard) {
  if (!wizard.data.background?.uuid) return [];
  const item = await wizard._getCachedDocument(wizard.data.background.uuid);
  if (!item) return [];
  const source = localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background');
  const choiceContext = getSelectedBackgroundChoiceContext(wizard, item);
  const selectedDescription = extractSelectedBackgroundChoiceDescription(
    item.system?.description?.value ?? '',
    choiceContext.labels,
  );
  const dynamicLore = getDynamicBackgroundLorePlaceholder(wizard, item);
  const selectedDescriptionLores = selectedDescription
    ? parseSubclassLores([], selectedDescription)
    : [];
  const staticLores = selectedDescriptionLores.length > 0
    ? []
    : (item.system?.trainedSkills?.lore ?? []);
  const descriptionLores = dynamicLore || selectedDescriptionLores.length > 0 || choiceContext.hasChoiceSets
    ? selectedDescriptionLores
    : parseSubclassLores([], item.system?.description?.value ?? '');
  const loreNames = [
    ...staticLores,
    ...parseSubclassLores(filterBackgroundGrantRules(item.system?.rules ?? [], choiceContext), ''),
    ...descriptionLores,
  ];
  if (dynamicLore) loreNames.push(dynamicLore);

  const seen = new Set();
  return loreNames
    .filter((name) => {
      const normalized = normalizeLoreName(name);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((name) => ({ name, source }));
}

export function parseSubclassLores(rules, html) {
  const lores = [];
  for (const rule of rules) {
    if (rule.key !== 'ActiveEffectLike') continue;
    const match = rule.path?.match(/^system\.skills\.([^.]+)\.rank$/);
    if (match && rule.value >= 1) {
      const slug = match[1];
      if (!SKILLS.includes(slug) && slug.endsWith('-lore')) {
        const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        lores.push(name);
      }
    }
  }
  if (lores.length === 0 && html) {
    for (const lore of extractLoreLabels(html)) lores.push(lore);
  }
  return lores.filter((lore) => normalizeLoreName(lore) !== 'additional lore');
}

export async function buildSkillContext(wizard) {
  const primaryClassSkills = await wizard._getClassTrainedSkills() ?? [];
  const dualClassSkills = await wizard._getClassTrainedSkills('dualClass') ?? [];
  const classSkills = [...new Set([...primaryClassSkills, ...dualClassSkills])];
  const bgSkills = await getBackgroundTrainedSkills(wizard) ?? [];
  const selectedSkills = Array.isArray(wizard.data.skills) ? wizard.data.skills : [];
  const selectedSubclassChoiceSkills = getSelectedSubclassChoiceSkillMap(wizard.data);
  const subclassSkills = [
    ...(Array.isArray(wizard.data.subclass?.grantedSkills) ? wizard.data.subclass.grantedSkills : []),
    ...(Array.isArray(wizard.data.dualSubclass?.grantedSkills) ? wizard.data.dualSubclass.grantedSkills : []),
    ...selectedSubclassChoiceSkills.keys(),
  ];
  const heritageGrantedSkills = Array.isArray(wizard.data.heritage?.grantedSkills)
    ? wizard.data.heritage.grantedSkills
    : [];
  const featGrantedSkills = [
    ...(Array.isArray(wizard.data.ancestryFeat?.grantedSkills) ? wizard.data.ancestryFeat.grantedSkills : []),
    ...(Array.isArray(wizard.data.ancestryParagonFeat?.grantedSkills) ? wizard.data.ancestryParagonFeat.grantedSkills : []),
    ...(Array.isArray(wizard.data.classFeat?.grantedSkills) ? wizard.data.classFeat.grantedSkills : []),
    ...(Array.isArray(wizard.data.dualClassFeat?.grantedSkills) ? wizard.data.dualClassFeat.grantedSkills : []),
    ...(Array.isArray(wizard.data.skillFeat?.grantedSkills) ? wizard.data.skillFeat.grantedSkills : []),
  ];
  const deitySkills = await collectWizardDeitySkillMap(wizard);
  const futureSkillChoiceMap = buildFutureSkillChoiceMap(wizard);
  const featChoiceSkillSet = buildResolvedSkillChoiceSet(wizard);
  const featChoicesSource = localizeWithFallback('CREATION.FEAT_CHOICES', 'Feat Choices');
  return getActiveSkillSlugs().map((slug) => {
    const fromClass = classSkills.includes(slug);
    const fromBg = bgSkills.includes(slug);
    const fromSubclass = subclassSkills.includes(slug);
    const fromHeritage = heritageGrantedSkills.includes(slug);
    const fromDeity = deitySkills.has(slug);
    const fromFeatGrant = featGrantedSkills.includes(slug);
    const fromFeatChoices = featChoiceSkillSet.has(slug);
    const autoTrained = fromClass || fromBg || fromSubclass || fromHeritage || fromDeity || fromFeatGrant || fromFeatChoices;
    const source = fromClass
      ? localizeWithFallback('CREATION.AUTO_TRAINED_CLASS', 'Class')
      : fromBg
        ? localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background')
        : fromSubclass
          ? (selectedSubclassChoiceSkills.get(slug)
            ?? (wizard.data.subclass?.grantedSkills?.includes(slug)
              ? wizard.data.subclass.name
              : wizard.data.dualSubclass?.name))
          : fromHeritage
            ? wizard.data.heritage?.name ?? null
          : fromDeity
            ? deitySkills.get(slug)
            : fromFeatGrant
              ? getFeatGrantedSkillSource(wizard, slug)
              : fromFeatChoices
                ? featChoicesSource
                : null;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: selectedSkills.includes(slug),
      autoTrained,
      source,
      futureSkillChoices: futureSkillChoiceMap.get(slug) ?? [],
    };
  });
}

function getFeatGrantedSkillSource(wizard, slug) {
  for (const feat of [wizard.data.ancestryFeat, wizard.data.ancestryParagonFeat, wizard.data.classFeat, wizard.data.dualClassFeat, wizard.data.skillFeat]) {
    if ((feat?.grantedSkills ?? []).includes(slug)) return feat.name ?? null;
  }
  return null;
}

export function buildSelectedLoreSkillContext(wizard) {
  const selectedLoreSkills = Array.isArray(wizard.data.selectedLoreSkills) ? wizard.data.selectedLoreSkills : [];
  return selectedLoreSkills
    .map((name) => normalizeLoreSkillName(name))
    .filter(Boolean)
    .map((name) => ({
      name,
      slug: slugifyLoreSkillName(name),
      label: name,
      selected: true,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const SKILL_ID_ALIASES = {
  acr: 'acrobatics',
  arc: 'arcana',
  ath: 'athletics',
  com: 'computers',
  cra: 'crafting',
  dec: 'deception',
  dip: 'diplomacy',
  itm: 'intimidation',
  med: 'medicine',
  nat: 'nature',
  occ: 'occultism',
  pil: 'piloting',
  prf: 'performance',
  rel: 'religion',
  soc: 'society',
  ste: 'stealth',
  sur: 'survival',
  thi: 'thievery',
};

export async function getBackgroundTrainedSkills(wizard) {
  if (!wizard.data.background?.uuid) return [];
  const item = await wizard._getCachedDocument(wizard.data.background.uuid);
  if (!item) return [];
  const choiceContext = getSelectedBackgroundChoiceContext(wizard, item);
  const selectedDescription = extractSelectedBackgroundChoiceDescription(
    item.system?.description?.value ?? '',
    choiceContext.labels,
  );
  const selectedDescriptionSkills = extractExplicitTrainedSkillsFromText(selectedDescription);
  const staticSkills = selectedDescriptionSkills.length > 0
    ? (item.system?.trainedSkills?.value ?? []).filter((skill) =>
      selectedDescriptionSkills.includes(normalizeSkillSlug(skill)))
    : (item.system?.trainedSkills?.value ?? []);
  const skills = new Set(staticSkills.map((skill) => normalizeSkillSlug(skill)).filter(Boolean));

  for (const rule of filterBackgroundGrantRules(item.system?.rules ?? [], choiceContext)) {
    if (rule?.key !== 'ActiveEffectLike') continue;
    const match = String(rule?.path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
    if (!match || Number(rule?.value) < 1) continue;
    const skill = normalizeSkillSlug(match[1]);
    if (SKILLS.includes(skill)) skills.add(skill);
  }

  for (const skill of selectedDescriptionSkills) skills.add(skill);
  return [...skills];
}

function getSelectedBackgroundChoiceContext(wizard, item) {
  const rules = item?.system?.rules ?? [];
  const choiceRules = rules.filter((rule) => rule?.key === 'ChoiceSet');
  const selectedValues = new Set();
  const labels = [];
  const storedChoices = {
    ...(wizard?.data?.background?.choices ?? {}),
    ...getGrantedFeatChoiceValues(wizard?.data, item?.uuid),
  };

  const addSelection = (value) => {
    const text = String(value ?? '').trim();
    if (!text || text === '[object Object]') return;
    selectedValues.add(normalizeBackgroundChoiceIdentity(text));
    labels.push(text);
  };

  for (const rule of choiceRules) {
    const flag = getBackgroundChoiceSetFlag(rule);
    const selected = flag ? storedChoices?.[flag] : null;
    if (typeof selected !== 'string' || selected.length === 0 || selected === '[object Object]') continue;
    addSelection(selected);

    const option = findBackgroundChoiceOption(rule?.choices, selected);
    const label = getBackgroundChoiceOptionLabel(option);
    if (label) addSelection(label);
  }

  for (const label of extractParentheticalChoiceLabels(wizard?.data?.background?.name)) {
    addSelection(label);
  }

  return {
    hasChoiceSets: choiceRules.length > 0,
    selectedValues,
    labels: [...new Set(labels.filter(Boolean))],
  };
}

function filterBackgroundGrantRules(rules, choiceContext) {
  return (rules ?? []).filter((rule) => {
    if (rule?.key !== 'ActiveEffectLike') return true;
    if (!choiceContext?.hasChoiceSets) return true;
    return matchesBackgroundChoicePredicate(rule?.predicate, choiceContext.selectedValues);
  });
}

function matchesBackgroundChoicePredicate(predicate, selectedValues) {
  if (!predicate) return true;
  if (typeof predicate === 'string') {
    if (!(selectedValues instanceof Set) || selectedValues.size === 0) return false;
    const normalized = normalizeBackgroundChoiceIdentity(predicate);
    return [...selectedValues].some((value) => normalized === value || normalized.endsWith(value) || normalized.includes(value));
  }
  if (Array.isArray(predicate)) {
    return predicate.every((entry) => matchesBackgroundChoicePredicate(entry, selectedValues));
  }
  if (typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.or)) {
    return predicate.or.some((entry) => matchesBackgroundChoicePredicate(entry, selectedValues));
  }
  if (Array.isArray(predicate.and)) {
    return predicate.and.every((entry) => matchesBackgroundChoicePredicate(entry, selectedValues));
  }
  if ('not' in predicate) return !matchesBackgroundChoicePredicate(predicate.not, selectedValues);
  if (Array.isArray(predicate.nor)) {
    return predicate.nor.every((entry) => !matchesBackgroundChoicePredicate(entry, selectedValues));
  }
  return true;
}

function getBackgroundChoiceSetFlag(rule) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return null;
}

function findBackgroundChoiceOption(choices, selected) {
  if (!Array.isArray(choices)) return null;
  const normalizedSelected = normalizeBackgroundChoiceIdentity(selected);
  return choices.find((choice) =>
    getBackgroundChoiceOptionIdentities(choice).some((identity) => identity === normalizedSelected)) ?? null;
}

function getBackgroundChoiceOptionIdentities(choice) {
  return [
    choice?.value,
    choice?.value?.value,
    choice?.value?.slug,
    choice?.value?.label,
    choice?.value?.name,
    choice?.slug,
    choice?.label,
    choice?.name,
  ].map(normalizeBackgroundChoiceIdentity).filter(Boolean);
}

function getBackgroundChoiceOptionLabel(option) {
  const raw =
    option?.label ??
    option?.name ??
    option?.value?.label ??
    option?.value?.name ??
    null;
  if (!raw) return null;
  return game.i18n?.has?.(raw) ? game.i18n.localize(raw) : String(raw);
}

function extractParentheticalChoiceLabels(name) {
  const matches = String(name ?? '').matchAll(/\(([^()]+)\)/gu);
  return [...matches].map((match) => match[1].trim()).filter(Boolean);
}

function extractSelectedBackgroundChoiceDescription(html, labels) {
  if (!html || (labels?.length ?? 0) === 0) return null;
  const selected = new Set(labels.map(normalizeBackgroundChoiceIdentity).filter(Boolean));
  if (selected.size === 0) return null;

  for (const paragraph of descriptionParagraphs(html)) {
    const headingMatch = paragraph.match(/^([^:]{1,80}):\s*(.+)$/u);
    if (!headingMatch) continue;
    const heading = normalizeBackgroundChoiceIdentity(headingMatch[1]);
    if (selected.has(heading)) return paragraph;
  }

  const fullText = descriptionParagraphs(html).join(' ');
  for (const label of labels) {
    const escaped = escapeRegExp(String(label ?? '').trim());
    if (!escaped) continue;
    const sectionMatch = fullText.match(new RegExp(`(?:^|\\s)${escaped}\\s*:\\s*(.+?)(?=\\s+[A-Z][A-Za-z' -]{1,60}:\\s|$)`, 'iu'));
    if (sectionMatch) return `${label}: ${sectionMatch[1].trim()}`;
  }

  return null;
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function descriptionParagraphs(html) {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?>/giu, '\n')
    .replace(/<\/\s*p\s*>/giu, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split(/\n+/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractExplicitTrainedSkillsFromText(text) {
  const description = String(text ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!description) return [];

  const clauses = description.match(
    /\b(?:you(?:\s+are|'re)?\s+)?(?:become|are)?\s*trained\s+in\s+([^.!?]+)/giu,
  ) ?? [];
  const skills = new Set();
  for (const clause of clauses) {
    for (const skill of getActiveSkillSlugs()) {
      const label = localizeSkillSlug(skill).toLowerCase();
      const normalizedClause = clause.toLowerCase();
      if (normalizedClause.includes(label) || normalizedClause.includes(skill.toLowerCase())) {
        skills.add(skill);
      }
    }
  }
  return [...skills];
}

function normalizeBackgroundChoiceIdentity(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function localizeSkillSlug(slug) {
  const raw = getActiveSkillConfigEntry(slug);
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  if (game.i18n?.has?.(label)) return game.i18n.localize(label);
  return humanizeSkillLikeLabel(slug);
}

export async function collectWizardDeitySkillMap(wizard) {
  const primarySelections = getClassSelectionData(wizard.data, 'class');
  const dualSelections = getClassSelectionData(wizard.data, 'dualClass');
  const actorItems = wizard.actor?.items?.contents
    ?? (Array.isArray(wizard.actor?.items) ? wizard.actor.items : Array.from(wizard.actor?.items ?? []));
  const candidates = [
    wizard.data.deity,
    primarySelections.deity,
    dualSelections.deity,
    actorItems.find((item) => item?.type === 'deity') ?? null,
    wizard.actor?.system?.details?.deity ?? null,
  ].filter(Boolean);

  const entries = new Map();
  for (const deity of candidates) {
    const resolved = await resolveWizardDeitySkill(wizard, deity);
    if (resolved?.skill) entries.set(resolved.skill, resolved.name ?? 'Deity');
  }
  return entries;
}

async function resolveWizardDeitySkill(wizard, deity) {
  const directSkill = normalizeSkillSlug(deity?.skill ?? deity?.system?.skill);
  if (directSkill) return { skill: directSkill, name: deity?.name };

  const uuid = deity?.uuid ?? deity?.sourceId ?? deity?.flags?.core?.sourceId;
  if (typeof uuid === 'string' && uuid.length > 0) {
    const doc = await wizard._getCachedDocument?.(uuid)?.catch?.(() => null);
    const skill = normalizeSkillSlug(doc?.system?.skill ?? doc?.skill);
    if (skill) return { skill, name: deity?.name ?? doc?.name };
  }

  const name = String(deity?.name ?? '').trim().toLowerCase();
  if (!name) return null;
  const deities = typeof wizard._loadDeities === 'function' ? await wizard._loadDeities() : [];
  const matched = deities.find((entry) => String(entry?.name ?? '').trim().toLowerCase() === name);
  const skill = normalizeSkillSlug(matched?.skill ?? matched?.system?.skill);
  return skill ? { skill, name: deity?.name ?? matched?.name } : null;
}

export function getActiveSkillSlugs() {
  if (usesAnachronismSkillList()) {
    return [...new Set([...SKILLS, ...Object.keys(getAnachronismAdditionalSkills())])];
  }
  if (!usesStarfinderSkillList()) return [...SKILLS];

  const skills = getActiveSkillConfig();
  if (!skills || typeof skills !== 'object') return [...SKILLS];

  const slugs = Object.keys(skills)
    .map((slug) => SKILL_ID_ALIASES[slug] ?? slug)
    .filter((slug) => typeof slug === 'string' && slug.length > 0);
  return slugs.length > 0 ? [...new Set(slugs)] : [...SKILLS];
}

export function getActiveSkillConfigEntry(slug) {
  if (usesAnachronismSkillList()) {
    const additional = getAnachronismAdditionalSkills()[slug];
    if (additional) return additional;
  }

  const skills = getActiveSkillConfig();
  if (!skills || typeof skills !== 'object') return globalThis.CONFIG?.PF2E?.skills?.[slug];

  const direct = skills[slug];
  if (direct) return direct;

  const alias = Object.entries(SKILL_ID_ALIASES).find(([, canonical]) => canonical === slug)?.[0];
  return alias ? skills[alias] : undefined;
}

function usesStarfinderSkillList() {
  return getActiveSystemId() === SYSTEM_IDS.SF2E;
}

function usesAnachronismSkillList() {
  return getActiveSystemProfile().contentProfile === 'pf2e+sf2e-anachronism';
}

function getActiveSkillConfig() {
  if (usesStarfinderSkillList()) return getRulesetConfig({ systemId: SYSTEM_IDS.SF2E }).skills;
  return getRulesetConfig().skills;
}

function getAnachronismAdditionalSkills() {
  const module = globalThis.game?.modules?.get?.(ANACHRONISM_MODULE_ID)
    ?? globalThis.game?.modules?.contents?.find?.((entry) => entry?.id === ANACHRONISM_MODULE_ID)
    ?? globalThis.game?.modules?.[ANACHRONISM_MODULE_ID];
  const additional = module?.flags?.[ANACHRONISM_MODULE_ID]?.['pf2e-homebrew']?.skills?.additional;
  return additional && typeof additional === 'object' ? additional : {};
}

function extractLoreLabels(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const matches = text.match(/\b(?:[\p{Lu}][\p{L}'-]*\s+){0,3}Lore\b/gu) ?? [];
  return [...new Set(matches.map(cleanLoreLabel).filter(Boolean))];
}

function getDynamicBackgroundLorePlaceholder(wizard, item) {
  const description = String(item?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!description) return null;

  const deityLorePatterns = [
    /\blore skill for your patron deity\b/,
    /\blore skill associated with your patron deity\b/,
    /\blore in your patron deity\b/,
    /\bpatron deity lore\b/,
  ];
  if (!deityLorePatterns.some((pattern) => pattern.test(description))) return null;

  return wizard.data.deity?.name ? `${wizard.data.deity.name} Lore` : 'Deity Lore';
}

function cleanLoreLabel(label) {
  const text = String(label ?? '').trim();
  const loreMatch = text.match(/[\p{L}][\p{L}' -]*?\bLore\b/iu);
  const loreText = loreMatch?.[0]?.trim() ?? text;
  const parts = loreText.split(/\s+/).filter(Boolean);
  if (parts.length > 2) return parts.slice(-2).join(' ');
  return loreText;
}

function normalizeLoreName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function localizeWithFallback(key, fallback) {
  const value = localize(key);
  return value === key ? fallback : value;
}

function buildFutureSkillChoiceMap(wizard) {
  const map = new Map();
  const sections = [
    ...getSubclassSkillChoiceSections(wizard.data),
    wizard.data.ancestryFeat
      ? {
        sourceLabel: wizard.data.ancestryFeat.name ?? 'Ancestry Feat',
        choiceSets: wizard.data.ancestryFeat.choiceSets ?? [],
        choices: wizard.data.ancestryFeat.choices ?? {},
      }
      : null,
    wizard.data.ancestryParagonFeat
      ? {
        sourceLabel: wizard.data.ancestryParagonFeat.name ?? 'Ancestry Feat',
        choiceSets: wizard.data.ancestryParagonFeat.choiceSets ?? [],
        choices: wizard.data.ancestryParagonFeat.choices ?? {},
      }
      : null,
    wizard.data.classFeat
      ? {
        sourceLabel: wizard.data.classFeat.name ?? 'Class Feat',
        choiceSets: wizard.data.classFeat.choiceSets ?? [],
        choices: wizard.data.classFeat.choices ?? {},
      }
      : null,
    wizard.data.dualClassFeat
      ? {
        sourceLabel: wizard.data.dualClassFeat.name ?? 'Dual Class Feat',
        choiceSets: wizard.data.dualClassFeat.choiceSets ?? [],
        choices: wizard.data.dualClassFeat.choices ?? {},
      }
      : null,
    wizard.data.skillFeat
      ? {
        sourceLabel: wizard.data.skillFeat.name ?? 'Skill Feat',
        choiceSets: wizard.data.skillFeat.choiceSets ?? [],
        choices: wizard.data.skillFeat.choices ?? {},
      }
      : null,
    ...((wizard.data.grantedFeatSections ?? []).map((section) => ({
      sourceLabel: section.sourceName ?? section.featName ?? 'Choice Set',
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(wizard.data, section.slot),
    }))),
  ].filter(Boolean);

  for (const section of sections) {
    for (const choiceSet of section.choiceSets) {
      const selectedSlug = resolveSkillSlugFromValue(choiceSet, section.choices?.[choiceSet.flag]);
      if (selectedSlug) continue;
      const skillSlugs = (choiceSet?.options ?? [])
        .map((option) => resolveSkillSlug(option))
        .filter((slug) => typeof slug === 'string' && slug.length > 0);
      if (skillSlugs.length === 0 || skillSlugs.length !== (choiceSet?.options ?? []).length) continue;
      if (isUnrestrictedSkillChoiceSet(skillSlugs)) continue;

      for (const slug of skillSlugs) {
        const entries = map.get(slug) ?? [];
        const entry = { sourceLabel: section.sourceLabel, prompt: choiceSet.prompt ?? '' };
        const duplicate = entries.some((candidate) =>
          candidate.sourceLabel === entry.sourceLabel && candidate.prompt === entry.prompt);
        if (!duplicate) entries.push(entry);
        map.set(slug, entries);
      }
    }
  }

  return map;
}

function isUnrestrictedSkillChoiceSet(skillSlugs) {
  const set = new Set(skillSlugs);
  const activeSkills = getActiveSkillSlugs();
  if (set.size < activeSkills.length) return false;
  return activeSkills.every((slug) => set.has(slug));
}

function buildResolvedSkillChoiceSet(wizard) {
  const selected = new Set();
  const sections = [
    ...getSubclassSkillChoiceSections(wizard.data),
    wizard.data.ancestryFeat
      ? {
        choiceSets: wizard.data.ancestryFeat.choiceSets ?? [],
        choices: wizard.data.ancestryFeat.choices ?? {},
      }
      : null,
    wizard.data.ancestryParagonFeat
      ? {
        choiceSets: wizard.data.ancestryParagonFeat.choiceSets ?? [],
        choices: wizard.data.ancestryParagonFeat.choices ?? {},
      }
      : null,
    wizard.data.classFeat
      ? {
        choiceSets: wizard.data.classFeat.choiceSets ?? [],
        choices: wizard.data.classFeat.choices ?? {},
      }
      : null,
    wizard.data.dualClassFeat
      ? {
        choiceSets: wizard.data.dualClassFeat.choiceSets ?? [],
        choices: wizard.data.dualClassFeat.choices ?? {},
      }
      : null,
    wizard.data.skillFeat
      ? {
        choiceSets: wizard.data.skillFeat.choiceSets ?? [],
        choices: wizard.data.skillFeat.choices ?? {},
      }
      : null,
    ...((wizard.data.grantedFeatSections ?? []).map((section) => ({
      choiceSets: section.choiceSets ?? [],
      choices: getGrantedFeatChoiceValues(wizard.data, section.slot),
    }))),
  ].filter(Boolean);

  for (const section of sections) {
    for (const choiceSet of section.choiceSets) {
      const selectedSlug = resolveSkillSlugFromValue(choiceSet, section.choices?.[choiceSet.flag]);
      if (selectedSlug) selected.add(selectedSlug);
    }
  }

  return selected;
}

function resolveSkillSlugFromValue(choiceSet, selectedValue) {
  if (!selectedValue) return null;

  const direct = resolveSkillSlug({ value: selectedValue, label: selectedValue, slug: selectedValue, name: selectedValue });
  if (direct) return direct;

  const matchedOption = (choiceSet?.options ?? []).find((option) => {
    const candidates = [option?.value, option?.slug, option?.name, option?.label, option?.uuid];
    return candidates.some((candidate) => candidate === selectedValue);
  });

  return matchedOption ? resolveSkillSlug(matchedOption) : null;
}

function resolveSkillSlug(option) {
  const skillLookup = getSkillLookup();
  const candidates = [
    option?.value,
    option?.label,
    option?.slug,
    option?.name,
    option?.value?.slug,
    option?.value?.label,
    option?.value?.name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSkillIdentity(candidate);
    const slug = skillLookup.get(normalized);
    if (slug) return slug;
  }

  return null;
}

function getSkillLookup() {
  const skills = getRulesetConfig().skills ?? {};
  const lookup = new Map();

  for (const [alias, full] of Object.entries(SKILL_ID_ALIASES)) {
    lookup.set(alias, full);
    lookup.set(normalizeSkillIdentity(full), full);
  }

  for (const [slug, rawEntry] of Object.entries(skills)) {
    const rawLabel = typeof rawEntry === 'string' ? rawEntry : (rawEntry?.label ?? slug);
    const localizedLabel = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
    const canonicalSlug = SKILL_ID_ALIASES[slug] ?? slug;
    for (const candidate of [slug, canonicalSlug, rawLabel, localizedLabel]) {
      const normalized = normalizeSkillIdentity(candidate);
      if (normalized) lookup.set(normalized, canonicalSlug);
    }
  }

  return lookup;
}

function normalizeSkillIdentity(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^pf2e\.skill/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getSubclassSkillChoiceSections(data) {
  return [
    data.subclass
      ? {
        sourceLabel: data.subclass.name ?? 'Subclass',
        choiceSets: data.subclass.choiceSets ?? [],
        choices: data.subclass.choices ?? {},
      }
      : null,
    data.dualSubclass
      ? {
        sourceLabel: data.dualSubclass.name ?? 'Dual Subclass',
        choiceSets: data.dualSubclass.choiceSets ?? [],
        choices: data.dualSubclass.choices ?? {},
      }
      : null,
  ].filter((section) => (section?.choiceSets?.length ?? 0) > 0);
}

export function getSelectedSubclassChoiceSkillMap(data) {
  const selected = new Map();
  for (const section of getSubclassSkillChoiceSections(data)) {
    for (const choiceSet of section.choiceSets) {
      const selectedSlug = resolveSkillSlugFromValue(choiceSet, section.choices?.[choiceSet.flag]);
      if (selectedSlug) selected.set(selectedSlug, section.sourceLabel);
    }
  }
  return selected;
}

export function normalizeLoreSkillName(value) {
  const trimmed = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const withLore = /\blore\b/i.test(trimmed) ? trimmed : `${trimmed} Lore`;
  return withLore.replace(/\b\p{L}/gu, (char) => char.toUpperCase());
}

export function slugifyLoreSkillName(value) {
  const normalized = normalizeLoreSkillName(value);
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function humanizeSkillLikeLabel(value) {
  return String(value ?? '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
