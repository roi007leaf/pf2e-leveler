import { SKILLS } from '../../constants.js';
import { localize } from '../../utils/i18n.js';

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

  const granted = grantedSlugs.map((slug) => ({
    slug,
    label: langMap[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1),
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
  const slugs = [];
  let bonusSlots = 0;
  const feats = [wizard.data.ancestryFeat, wizard.data.ancestryParagonFeat, wizard.data.classFeat, wizard.data.skillFeat].filter(Boolean);
  for (const feat of feats) {
    if (!feat.uuid) continue;
    const item = await wizard._getCachedDocument(feat.uuid);
    if (!item) continue;
    const result = { slugs: [], bonusSlots: 0 };
    await scanItemForLanguages(wizard, item, result);
    slugs.push(...result.slugs);
    bonusSlots += result.bonusSlots;
  }
  return { slugs, bonusSlots };
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
  const configLangs = globalThis.CONFIG?.PF2E?.languages;
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

export async function getBackgroundLores(wizard) {
  if (!wizard.data.background?.uuid) return [];
  const item = await wizard._getCachedDocument(wizard.data.background.uuid);
  if (!item) return [];
  const source = localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background');
  const lores = (item.system?.trainedSkills?.lore ?? []).map((name) => ({ name, source }));
  const dynamicLore = getDynamicBackgroundLorePlaceholder(wizard, item);
  if (dynamicLore && !lores.some((entry) => entry.name === dynamicLore)) {
    lores.push({ name: dynamicLore, source });
  }
  return lores;
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
  const classSkills = await wizard._getClassTrainedSkills();
  const bgSkills = await getBackgroundTrainedSkills(wizard);
  const subclassSkills = wizard.data.subclass?.grantedSkills ?? [];
  const deitySkill = wizard.data.deity?.skill ?? null;
  const futureSkillChoiceMap = buildFutureSkillChoiceMap(wizard);
  return SKILLS.map((slug) => {
    const fromClass = classSkills.includes(slug);
    const fromBg = bgSkills.includes(slug);
    const fromSubclass = subclassSkills.includes(slug);
    const fromDeity = deitySkill === slug;
    const autoTrained = fromClass || fromBg || fromSubclass || fromDeity;
    const source = fromClass
      ? localizeWithFallback('CREATION.AUTO_TRAINED_CLASS', 'Class')
      : fromBg
        ? localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background')
        : fromSubclass
          ? wizard.data.subclass.name
          : fromDeity
            ? (wizard.data.deity?.name ?? 'Deity')
            : null;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: wizard.data.skills.includes(slug),
      autoTrained,
      source,
      futureSkillChoices: futureSkillChoiceMap.get(slug) ?? [],
    };
  });
}

const SKILL_ID_ALIASES = {
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

export async function getBackgroundTrainedSkills(wizard) {
  if (!wizard.data.background?.uuid) return [];
  const item = await wizard._getCachedDocument(wizard.data.background.uuid);
  if (!item) return [];
  return item.system?.trainedSkills?.value ?? [];
}

function localizeSkillSlug(slug) {
  const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
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
    wizard.data.ancestryFeat
      ? {
        sourceLabel: wizard.data.ancestryFeat.name ?? 'Ancestry Feat',
        choiceSets: wizard.data.ancestryFeat.choiceSets ?? [],
      }
      : null,
    wizard.data.ancestryParagonFeat
      ? {
        sourceLabel: wizard.data.ancestryParagonFeat.name ?? 'Ancestry Feat',
        choiceSets: wizard.data.ancestryParagonFeat.choiceSets ?? [],
      }
      : null,
    wizard.data.classFeat
      ? {
        sourceLabel: wizard.data.classFeat.name ?? 'Class Feat',
        choiceSets: wizard.data.classFeat.choiceSets ?? [],
      }
      : null,
    wizard.data.skillFeat
      ? {
        sourceLabel: wizard.data.skillFeat.name ?? 'Skill Feat',
        choiceSets: wizard.data.skillFeat.choiceSets ?? [],
      }
      : null,
    ...((wizard.data.grantedFeatSections ?? []).map((section) => ({
      sourceLabel: section.sourceName ?? section.featName ?? 'Choice Set',
      choiceSets: section.choiceSets ?? [],
    }))),
  ].filter(Boolean);

  for (const section of sections) {
    for (const choiceSet of section.choiceSets) {
      const skillSlugs = (choiceSet?.options ?? [])
        .map((option) => resolveSkillSlug(option))
        .filter((slug) => typeof slug === 'string' && slug.length > 0);
      if (skillSlugs.length === 0 || skillSlugs.length !== (choiceSet?.options ?? []).length) continue;

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
  const skills = globalThis.CONFIG?.PF2E?.skills ?? {};
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
