import { SKILLS } from '../../constants.js';
import { localize } from '../../utils/i18n.js';

export async function buildLanguageContext(wizard) {
  const ancestryItem = wizard.data.ancestry?.uuid ? await wizard._getCachedDocument(wizard.data.ancestry.uuid) : null;
  const grantedSlugs = ancestryItem?.system?.languages?.value ?? [];
  const suggestedSlugs = new Set(ancestryItem?.system?.additionalLanguages?.value ?? []);
  const baseCount = ancestryItem?.system?.additionalLanguages?.count ?? 0;
  const intMod = await wizard._computeIntMod();
  const maxAdditional = Math.max(0, baseCount + intMod);
  wizard._cachedMaxLanguages = maxAdditional;

  const langMap = getLanguageMap();

  const granted = grantedSlugs.map((slug) => ({
    slug,
    label: langMap[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    granted: true,
    selected: false,
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
  return (item.system?.trainedSkills?.lore ?? []).map((name) => ({ name, source: localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background') }));
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
  return lores;
}

export async function buildSkillContext(wizard) {
  const classSkills = await wizard._getClassTrainedSkills();
  const bgSkills = await getBackgroundTrainedSkills(wizard);
  const subclassSkills = wizard.data.subclass?.grantedSkills ?? [];
  return SKILLS.map((slug) => {
    const fromClass = classSkills.includes(slug);
    const fromBg = bgSkills.includes(slug);
    const fromSubclass = subclassSkills.includes(slug);
    const autoTrained = fromClass || fromBg || fromSubclass;
    const source = fromClass
      ? localizeWithFallback('CREATION.AUTO_TRAINED_CLASS', 'Class')
      : fromBg
        ? localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background')
        : fromSubclass
          ? wizard.data.subclass.name
          : null;
    return {
      slug,
      label: localizeSkillSlug(slug),
      selected: wizard.data.skills.includes(slug),
      autoTrained,
      source,
    };
  });
}

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

function cleanLoreLabel(label) {
  const text = String(label ?? '').trim();
  const loreMatch = text.match(/[\p{L}][\p{L}' -]*?\bLore\b/iu);
  const loreText = loreMatch?.[0]?.trim() ?? text;
  const parts = loreText.split(/\s+/).filter(Boolean);
  if (parts.length > 2) return parts.slice(-2).join(' ');
  return loreText;
}

function localizeWithFallback(key, fallback) {
  const value = localize(key);
  return value === key ? fallback : value;
}
