import { slugify } from './pf2e-api.js';

export function getDedicationAliasesFromDescription(feat) {
  const overrides = getDedicationAliasOverrides(feat);
  if (overrides.length > 0) return overrides;

  const description = String(feat?.system?.description?.value ?? feat?.description ?? '')
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!description || !description.includes('counts as')) return [];

  const aliases = new Set();
  const dedicationMatches = description.match(/counts as (?:the )?([a-z' -]+?) dedication/g) ?? [];
  for (const match of dedicationMatches) {
    const name = match.replace(/^counts as (?:the )?/i, '').replace(/\s+dedication$/i, '').trim();
    if (!name) continue;
    aliases.add(`${slugify(name)}-dedication`);
    aliases.add(slugify(`${name} dedication`));
  }

  const archetypeMatches = description.match(/counts as (?:the )?([a-z' -]+?) archetype/g) ?? [];
  for (const match of archetypeMatches) {
    const name = match.replace(/^counts as (?:the )?/i, '').replace(/\s+archetype$/i, '').trim();
    if (!name) continue;
    aliases.add(`${slugify(name)}-dedication`);
    aliases.add(slugify(`${name} archetype`));
  }

  return [...aliases];
}

function getDedicationAliasOverrides(feat) {
  const slug = String(feat?.slug ?? '').toLowerCase();
  const map = {
    'spellshot-dedication': ['wizard-dedication'],
  };
  return map[slug] ?? [];
}
