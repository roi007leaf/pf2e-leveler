import { extractCompendiumUuidsByCategory } from '../system-support/profiles.js';

const DESCRIPTION_BLOCK_TAGS = 'p|li|div|section|article|tr|td|h[1-6]';

export function getEmbeddedSpellChoiceContexts(html, category = 'spells') {
  return getDescriptionBlocks(html)
    .map((block) => ({
      text: normalizeDescriptionText(block),
      uuids: extractCompendiumUuidsByCategory(block, category),
    }))
    .filter((context) => context.uuids.length > 0 && hasEmbeddedSpellChoiceText(context.text));
}

export function hasEmbeddedSpellChoiceDescription(html, category = 'spells') {
  return getEmbeddedSpellChoiceContexts(html, category).length > 0;
}

function getDescriptionBlocks(html) {
  const value = String(html ?? '').trim();
  if (!value) return [];

  const withBreaks = value
    .replace(/<\s*br\s*\/?\s*>/giu, '\n')
    .replace(new RegExp(`<\\s*\\/\\s*(?:${DESCRIPTION_BLOCK_TAGS})\\s*>`, 'giu'), '\n')
    .replace(new RegExp(`<\\s*(?:${DESCRIPTION_BLOCK_TAGS})\\b[^>]*>`, 'giu'), '\n');

  const blocks = withBreaks
    .split(/\n+/u)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.length > 0 ? blocks : [value];
}

function normalizeDescriptionText(html) {
  return String(html ?? '')
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/gu, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasEmbeddedSpellChoiceText(text) {
  if (!text) return false;

  return (/\b(?:choose|select|pick)\b/u.test(text)
      && (/\bspell(?:book|s)?\b/u.test(text) || /\brepertoire\b/u.test(text)))
    || /\bor another\b.{0,120}\b(?:cantrip|spell|focus spell|innate spell)\b/u.test(text);
}
