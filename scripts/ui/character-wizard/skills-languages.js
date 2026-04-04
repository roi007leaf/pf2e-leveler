import { SKILLS } from '../../constants.js';

export async function buildLanguageContext(wizard) {
  const ancestryItem = wizard.data.ancestry?.uuid ? await fromUuid(wizard.data.ancestry.uuid).catch(() => null) : null;
  const grantedSlugs = ancestryItem?.system?.languages?.value ?? [];
  const suggestedSlugs = new Set(ancestryItem?.system?.additionalLanguages?.value ?? []);
  const baseCount = ancestryItem?.system?.additionalLanguages?.count ?? 0;
  const intMod = wizard._computeIntMod();
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
  const item = await fromUuid(wizard.data.background.uuid).catch(() => null);
  if (!item) return [];
  return (item.system?.trainedSkills?.lore ?? []).map((name) => ({ name, source: 'Background' }));
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
    const text = html.replace(/<[^>]+>/g, ' ');
    const loreMatch = text.match(/trained in ([^.]*?\bLore\b[^.]*)/i);
    if (loreMatch) {
      const loreText = loreMatch[1];
      const parts = loreText
        .split(/,|\band\b/gi)
        .map((part) => part.trim())
        .filter((part) => /\bLore$/i.test(part));
      for (const part of parts) lores.push(part);
    }
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
    const source = fromClass ? 'Class' : fromBg ? 'Background' : fromSubclass ? wizard.data.subclass.name : null;
    return {
      slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
      selected: wizard.data.skills.includes(slug),
      autoTrained,
      source,
    };
  });
}

export async function getBackgroundTrainedSkills(wizard) {
  if (!wizard.data.background?.uuid) return [];
  const item = await fromUuid(wizard.data.background.uuid).catch(() => null);
  if (!item) return [];
  return item.system?.trainedSkills?.value ?? [];
}
