const COUNT_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
const PHYSICAL_ITEM_TYPES = ['weapon', 'armor', 'shield', 'consumable', 'equipment', 'ammo'];

export async function buildFeatGrantRequirements({ feats = [], classEntries = [], level = null } = {}) {
  const requirements = [];

  for (const featEntry of feats ?? []) {
    const feat = await resolveFeat(featEntry?.uuid);
    if (!feat) continue;

    const text = normalizeDescription(feat.system?.description?.value ?? '');
    const source = {
      uuid: featEntry?.uuid ?? feat.uuid,
      name: featEntry?.name ?? feat.name ?? 'Feat',
    };
    requirements.push(...detectRequirements(text, source));
  }

  requirements.push(...buildClassDefaultGrantRequirements(classEntries, level));
  return requirements;
}

export function getFeatGrantCompletion(levelData, requirements = []) {
  const stored = new Map((levelData?.featGrants ?? []).map((entry) => [entry.requirementId, entry]));
  const completion = {};

  for (const requirement of requirements ?? []) {
    const selections = stored.get(requirement.id)?.selections ?? [];
    const required = Number.isInteger(requirement.count) ? requirement.count : null;
    completion[requirement.id] = {
      selected: selections.length,
      required,
      missing: required == null ? null : Math.max(0, required - selections.length),
      complete: required != null && selections.length >= required,
    };
  }

  return completion;
}

async function resolveFeat(uuid) {
  if (!uuid) return null;
  return fromUuid(uuid).catch(() => null);
}

function detectRequirements(text, source) {
  if (!text) return [];

  const requirements = [];
  const spellGrant = inferSpellGrant(text);
  if (spellGrant) requirements.push(buildRequirement(source, 'spell', spellGrant.count, 'inferred', spellGrant.filters));

  requirements.push(...inferFormulaRequirements(text, source));

  if (/\balchemical crafting\b/.test(text) && /\bitems?\s+you\s+choose\b/.test(text)) {
    requirements.push(buildRequirement(source, 'formula', 4, 'inferred', {
      maxLevel: inferMaxLevel(text) ?? 1,
      rarity: inferRarity(text),
      traits: inferTraits(text),
    }));
  }

  const itemGrant = inferItemGrant(text);
  if (itemGrant) {
    const { itemType, count } = itemGrant;
    if (itemType && count) {
      requirements.push(buildRequirement(source, 'item', count, 'inferred', {
        maxLevel: inferLevel(text),
        rarity: inferRarity(text),
        itemTypes: [itemType],
      }));
    }
  }

  return requirements;
}

function buildRequirement(source, kind, count, confidence, filters, options = {}) {
  const idKind = options.idKind ?? kind;
  const id = `${source.uuid}:${idKind}`;
  return {
    id,
    sourceFeatUuid: source.uuid,
    sourceFeatName: options.sourceName ?? source.name,
    kind,
    count,
    confidence,
    filters: cleanFilters(filters),
  };
}

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== false;
    }),
  );
}

function normalizeDescription(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function inferCount(text) {
  const match = String(text ?? '').match(/\b(one|two|three|four|five|six|[1-6])\b/);
  if (!match) return null;
  return COUNT_WORDS[match[1]] ?? Number(match[1]);
}

function inferSpellGrant(text) {
  const sentences = splitSentences(text).filter((sentence) => /\b(?:spell|spells|cantrip|cantrips)\b/.test(sentence));
  for (const sentence of sentences) {
    const count = inferCount(sentence);
    if (!count) continue;
    const grantsSpellChoice = /\b(?:add|adds|gain|gains|learn|learns|choose|select)\b/.test(sentence);
    const targetSpellList = /\b(?:spellbook|repertoire)\b|\bof your choice\b/.test(sentence);
    if (!grantsSpellChoice || !targetSpellList) continue;
    return {
      count,
      filters: {
        rank: inferRank(sentence),
        rarity: inferRarity(sentence),
        tradition: inferTradition(sentence),
        spellbook: /\bspellbook\b/.test(sentence),
        repertoire: /\brepertoire\b/.test(sentence),
      },
    };
  }
  return null;
}

function inferFormulaRequirements(text, source) {
  if (!/\bformulas?\b/.test(text)) return [];
  if (/\balchemical crafting\b/.test(text) && /\bformula book\b/.test(text)) {
    return [
      buildFormulaRequirement(source, 4, text, { idKind: 'alchemical-crafting-formula', sourceName: 'Alchemical Crafting' }),
      buildFormulaRequirement(source, 4, text, { idKind: 'formula-book-formula', sourceName: 'Formula Book' }),
    ];
  }

  const count = inferFormulaCount(text) ?? inferCount(text);
  return [buildFormulaRequirement(source, count, text)];
}

function buildFormulaRequirement(source, count, text, options = {}) {
  return buildRequirement(source, 'formula', count, count ? 'inferred' : 'manual-required', {
    maxLevel: inferMaxLevel(text),
    rarity: inferRarity(text),
    traits: inferTraits(text),
  }, options);
}

function splitSentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+|;\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function inferFormulaCount(text) {
  const normalized = String(text ?? '');
  const countPattern = '(one|two|three|four|five|six|[1-6])';
  const patterns = [
    new RegExp(`\\bformulas?\\s+(?:for\\s+)?${countPattern}\\b`, 'u'),
    new RegExp(`\\b${countPattern}\\s+(?:common|uncommon|rare|unique)?\\s*(?:\\d+(?:st|nd|rd|th)?[-\\s]*level\\s+)?(?:alchemical\\s+)?(?:items?|mutagens?)\\b`, 'u'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const raw = match[1];
    return COUNT_WORDS[raw] ?? Number(raw);
  }

  return null;
}

function inferRank(text) {
  if (/\bcantrips?\b/.test(String(text ?? ''))) return 0;
  const match = String(text ?? '').match(/\b(\d+)(?:st|nd|rd|th)?[-\s]*rank\b/);
  return match ? Number(match[1]) : null;
}

function inferLevel(text) {
  const match = String(text ?? '').match(/\b(\d+)(?:st|nd|rd|th)?[-\s]*level\b/);
  return match ? Number(match[1]) : null;
}

function inferMaxLevel(text) {
  const matches = [...String(text ?? '').matchAll(/\b(\d+)(?:st|nd|rd|th)?[-\s]*level\b/gu)]
    .map((match) => Number(match[1]))
    .filter((level) => Number.isFinite(level));
  return matches.length > 0 ? Math.max(...matches) : null;
}

function inferRarity(text) {
  const rarities = ['common', 'uncommon', 'rare', 'unique'].filter((rarity) =>
    new RegExp(`\\b${rarity}\\b`).test(text));
  return rarities;
}

function inferTradition(text) {
  return TRADITIONS.find((tradition) => new RegExp(`\\b${tradition}\\b`).test(text)) ?? null;
}

function inferTraits(text) {
  const traits = [];
  if (/\balchemical\b/.test(text)) traits.push('alchemical');
  if (/\bfood\b/.test(text)) traits.push('food');
  if (/\bmutagens?\b/.test(text)) traits.push('mutagen');
  if (/\bbombs?\b/.test(text)) traits.push('bomb');
  return traits;
}

export function buildClassDefaultGrantRequirements(classEntries, level) {
  const requirements = [];
  const normalizedLevel = Number(level);
  for (const classEntry of classEntries ?? []) {
    const slug = String(classEntry?.slug ?? '').toLowerCase();
    if (slug !== 'alchemist') continue;
    const source = {
      uuid: classEntry?.uuid ?? `class:${slug}`,
      name: classEntry?.name ?? 'Alchemist',
    };
    if (normalizedLevel === 1) {
      requirements.push(buildRequirement(source, 'formula', 4, 'inferred', {
        maxLevel: 1,
        rarity: ['common'],
        traits: ['alchemical'],
      }, { idKind: 'alchemical-crafting-formula', sourceName: 'Alchemical Crafting' }));
      requirements.push(buildRequirement(source, 'formula', 4, 'inferred', {
        maxLevel: 1,
        rarity: ['common'],
        traits: ['alchemical'],
      }, { idKind: 'formula-book-formula', sourceName: 'Formula Book' }));
    } else if (normalizedLevel > 1) {
      requirements.push(buildRequirement(source, 'formula', 2, 'inferred', {
        maxLevel: normalizedLevel,
        rarity: ['common'],
        traits: ['alchemical'],
      }, { idKind: `formula-book-level-${normalizedLevel}-formula`, sourceName: 'Formula Book' }));
    }
  }
  return requirements;
}

function inferItemGrant(text) {
  const normalized = String(text ?? '');
  const countPattern = '(one|two|three|four|five|six|[1-6])';
  const rarityPattern = '(?:(?:common|uncommon|rare|unique)\\s+)?';
  const levelPattern = '(?:(?:\\d+)(?:st|nd|rd|th)?[-\\s]*level(?:\\s+or\\s+lower)?\\s+)?';
  const typePattern = `(${PHYSICAL_ITEM_TYPES.map((type) => `${type}s?`).join('|')})`;
  const patterns = [
    new RegExp(`\\b(?:gain|receive|obtain)\\s+${countPattern}\\s+${rarityPattern}${levelPattern}${typePattern}\\b`, 'u'),
    new RegExp(`\\b(?:choose|select)\\s+${countPattern}\\s+${rarityPattern}${levelPattern}${typePattern}\\b`, 'u'),
    new RegExp(`\\b${countPattern}\\s+${rarityPattern}${levelPattern}${typePattern}\\s+of\\s+your\\s+choice\\b`, 'u'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    return {
      count: COUNT_WORDS[match[1]] ?? Number(match[1]),
      itemType: normalizeItemType(match[2]),
    };
  }

  return null;
}

function normalizeItemType(value) {
  const normalized = String(value ?? '').replace(/s$/u, '');
  return PHYSICAL_ITEM_TYPES.includes(normalized) ? normalized : null;
}
