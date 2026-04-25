const COUNT_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
const PHYSICAL_ITEM_TYPES = ['weapon', 'armor', 'shield', 'consumable', 'equipment', 'ammo'];
const FEAT_GRANT_KEYS = [
  'classFeats',
  'skillFeats',
  'generalFeats',
  'ancestryFeats',
  'archetypeFeats',
  'mythicFeats',
  'dualClassFeats',
  'customFeats',
];

export async function buildFeatGrantRequirements({ feats = [], classEntries = [], level = null, actor = null, plan = null } = {}) {
  const requirements = [];
  const context = { actor, plan, level };

  for (const featEntry of feats ?? []) {
    const feat = await resolveFeat(featEntry?.uuid);
    if (!feat) continue;

    const text = normalizeDescription(feat.system?.description?.value ?? '');
    const source = {
      uuid: featEntry?.uuid ?? feat.uuid,
      name: featEntry?.name ?? feat.name ?? 'Feat',
      slug: featEntry?.slug ?? feat.system?.slug ?? feat.slug ?? null,
    };
    requirements.push(...detectRequirements(text, source, context));
  }

  requirements.push(...buildClassDefaultGrantRequirements(classEntries, level));
  return requirements;
}

export async function buildPlanFormulaProgressionRequirements({ plan = null, level = null, actor = null } = {}) {
  const normalizedLevel = getContextLevel({ level });
  if (!plan || normalizedLevel <= 1) return [];

  const requirements = [];
  const context = { actor, plan, level: normalizedLevel };
  for (const featEntry of getPlanFeatEntriesBeforeLevel(plan, normalizedLevel)) {
    const feat = await resolveFeat(featEntry?.uuid);
    if (!feat) continue;
    const text = normalizeDescription(feat.system?.description?.value ?? '');
    const source = {
      uuid: featEntry?.uuid ?? feat.uuid,
      name: featEntry?.name ?? feat.name ?? 'Feat',
      slug: featEntry?.slug ?? feat.system?.slug ?? feat.slug ?? null,
    };
    requirements.push(...inferFormulaProgressionRequirements(text, source, context));
  }
  return dedupeRequirements(requirements);
}

export function getFeatGrantCompletion(levelData, requirements = []) {
  const completion = {};

  for (const requirement of requirements ?? []) {
    const selections = getFeatGrantSelections(levelData, requirement);
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

export function getFeatGrantSelections(levelData, requirement) {
  const stored = (levelData?.featGrants ?? []).find((entry) => entry?.requirementId === requirement?.id);
  return dedupeGrantSelections([
    ...(requirement?.fixedSelections ?? []),
    ...(stored?.selections ?? []),
  ]);
}

export function getAutomaticFeatGrantEntries(requirements = []) {
  return (requirements ?? [])
    .filter((requirement) => Array.isArray(requirement?.fixedSelections) && requirement.fixedSelections.length > 0)
    .map((requirement) => ({
      requirementId: requirement.id,
      sourceFeatUuid: requirement.sourceFeatUuid,
      sourceFeatName: requirement.sourceFeatName,
      kind: requirement.kind,
      selections: requirement.fixedSelections,
    }));
}

export function mergeFeatGrantEntries(storedGrants = [], automaticGrants = []) {
  const merged = new Map();
  for (const grant of [...(storedGrants ?? []), ...(automaticGrants ?? [])]) {
    if (!grant?.requirementId) continue;
    const existing = merged.get(grant.requirementId);
    if (!existing) {
      merged.set(grant.requirementId, {
        ...grant,
        selections: dedupeGrantSelections(grant.selections ?? []),
      });
      continue;
    }
    merged.set(grant.requirementId, {
      ...existing,
      ...grant,
      manual: existing.manual ?? grant.manual,
      selections: dedupeGrantSelections([
        ...(existing.selections ?? []),
        ...(grant.selections ?? []),
      ]),
    });
  }
  return [...merged.values()];
}

async function resolveFeat(uuid) {
  if (!uuid) return null;
  return fromUuid(uuid).catch(() => null);
}

function detectRequirements(text, source, context = {}) {
  if (!text) return [];

  const requirements = [];
  const spellGrant = inferSpellGrant(text);
  if (spellGrant) requirements.push(buildRequirement(source, 'spell', spellGrant.count, 'inferred', spellGrant.filters));

  requirements.push(...inferFixedFormulaRequirements(text, source));
  requirements.push(...inferFormulaRequirements(text, source, context));

  if (/\balchemical crafting\b/.test(text) && /\bitems?\s+you\s+choose\b/.test(text) && !hasFixedAlchemicalCraftingFormulaOverride(text)) {
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
    ...(Array.isArray(options.fixedSelections) ? { fixedSelections: options.fixedSelections } : {}),
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
  const match = String(text ?? '').match(/\b(one|two|three|four|five|six|seven|eight|nine|[1-9])\b/);
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

function inferFormulaRequirements(text, source, context = {}) {
  if (!/\bformulas?\b/.test(text)) return [];
  if (isPassiveFormulaKnowledgeGrant(text)) return [];
  const specialRequirements = inferSpecialFormulaRequirements(text, source, context);
  if (specialRequirements) return specialRequirements;
  const hasFixedSelections = inferFixedFormulaSelections(text).length > 0;
  if (hasFixedAlchemicalCraftingFormulaOverride(text)) {
    const count = inferFormulaCount(text) ?? inferCount(text);
    return [buildFormulaRequirement(source, count, text)];
  }
  if (/\balchemical crafting\b/.test(text) && /\bformula book\b/.test(text)) {
    return [
      buildFormulaRequirement(source, 4, text, { idKind: 'alchemical-crafting-formula', sourceName: 'Alchemical Crafting' }),
      buildFormulaRequirement(source, 2, text, { idKind: 'formula-book-formula', sourceName: 'Formula Book' }),
    ];
  }

  const count = inferScalingFormulaCount(text, context) ?? inferFormulaCount(text) ?? inferCount(text);
  if (hasFixedSelections && !count) return [];
  return [buildFormulaRequirement(source, count, text)];
}

function inferFixedFormulaRequirements(text, source) {
  const selections = inferFixedFormulaSelections(text);
  if (selections.length === 0) return [];
  return [
    buildRequirement(source, 'formula', selections.length, 'fixed', {}, {
      idKind: 'fixed-formula',
      fixedSelections: selections,
    }),
  ];
}

function inferFixedFormulaSelections(text) {
  const selections = [];
  if (/\bblack\s+powder\b/.test(text)) {
    selections.push({ slug: 'black-powder', name: 'Black Powder' });
  }
  if (/\blesser\s+antidote\b/.test(text)) {
    selections.push({ slug: 'lesser-antidote', name: 'Lesser Antidote' });
  }
  if (/\blesser\s+antiplague\b/.test(text)) {
    selections.push({ slug: 'lesser-antiplague', name: 'Lesser Antiplague' });
  }
  if (/\bminor\s+elixir\s+of\s+life\b/.test(text)) {
    selections.push({ slug: 'minor-elixir-of-life', name: 'Minor Elixir of Life' });
  }
  if (/\bphilosopher'?s\s+stone\b/.test(text)) {
    selections.push({ slug: 'philosophers-stone', name: "Philosopher's Stone" });
  }
  if (/\bpit\s+illusion\s+snare\b/.test(text)) {
    selections.push({ slug: 'pit-illusion-snare', name: 'Pit Illusion Snare' });
  }
  if (/\bshadow\s+cloak\s+snare\b/.test(text)) {
    selections.push({ slug: 'shadow-cloak-snare', name: 'Shadow Cloak Snare' });
  }
  return dedupeGrantSelections(selections);
}

function hasFixedAlchemicalCraftingFormulaOverride(text) {
  return /\blesser\s+antidote\b/.test(text)
    || /\blesser\s+antiplague\b/.test(text)
    || /\bminor\s+elixir\s+of\s+life\b/.test(text);
}

function buildFormulaRequirement(source, count, text, options = {}) {
  return buildRequirement(source, 'formula', count, count ? 'inferred' : 'manual-required', inferFormulaFilters(text), options);
}

function isPassiveFormulaKnowledgeGrant(text) {
  const normalized = String(text ?? '');
  return /\bknow\s+the\s+formulas?\s+for\s+all\b/.test(normalized)
    || /\bformulas?\s+for\s+all\b/.test(normalized)
    || /\bdon'?t\s+need\s+a\s+formula\s+book\b/.test(normalized);
}

function inferSpecialFormulaRequirements(text, source, context = {}) {
  if (isCauldronFormulaGrant(text)) return buildCauldronFormulaRequirements(source, context);
  if (isImprobableElixirsFormulaGrant(text)) return [buildImprobableElixirsFormulaRequirement(source, context)];
  if (isBrastlewarkSnareEngineeringGrant(text)) return [buildBrastlewarkSnareFormulaRequirement(source, context)];
  if (isAlchemicalScholarFormulaGrant(text)) return [buildAlchemicalScholarFormulaRequirement(source, context)];
  return null;
}

function inferFormulaProgressionRequirements(text, source, context = {}) {
  if (!/\bformulas?\b/.test(text)) return [];
  if (isPassiveFormulaKnowledgeGrant(text)) return [];
  if (isCauldronFormulaGrant(text)) {
    const progression = buildCauldronProgressionRequirement(source, context);
    return progression ? [progression] : [];
  }
  if (isAlchemicalScholarFormulaGrant(text) && getContextLevel(context) > 1) {
    return [buildAlchemicalScholarFormulaRequirement(source, context)];
  }
  return [];
}

function isCauldronFormulaGrant(text) {
  return /\bcauldron\b/.test(text)
    || (/\boils?\s+or\s+potions?\b/.test(text) && /\bat\s+4th\s+level\b/.test(text));
}

function buildCauldronFormulaRequirements(source, context = {}) {
  const requirements = [
    buildRequirement(source, 'formula', 4, 'inferred', {
      maxLevel: 1,
      rarity: ['common'],
      traits: ['oil', 'potion'],
      traitLogic: 'or',
    }),
  ];
  const progression = buildCauldronProgressionRequirement(source, context);
  if (progression) requirements.push(progression);
  return requirements;
}

function buildCauldronProgressionRequirement(source, context = {}) {
  const level = getContextLevel(context);
  if (level < 4 || level % 2 !== 0) return null;
  return buildRequirement(source, 'formula', 1, 'inferred', {
    maxLevel: level,
    rarity: ['common'],
    traits: ['oil', 'potion'],
    traitLogic: 'or',
  }, { idKind: `cauldron-level-${level}-formula` });
}

function isImprobableElixirsFormulaGrant(text) {
  return /\bimprobable\s+elixirs\b/.test(text)
    || (/\bpotions?\s+equal\s+to\s+your\s+intelligence\s+modifier\b/.test(text) && /\b9th\s+level\s+or\s+lower\b/.test(text));
}

function buildImprobableElixirsFormulaRequirement(source, context = {}) {
  return buildRequirement(source, 'formula', Math.max(1, getIntModifier(context)), 'inferred', {
    maxLevel: 9,
    traits: ['potion'],
  });
}

function isBrastlewarkSnareEngineeringGrant(text) {
  return /\bbrastlewark\s+snare\s+engineering\b/.test(text)
    || (/\bpit\s+illusion\s+snare\b/.test(text) && /\bshadow\s+cloak\s+snare\b/.test(text));
}

function buildBrastlewarkSnareFormulaRequirement(source, context = {}) {
  return buildRequirement(source, 'formula', 2, 'inferred', {
    maxLevel: getContextLevel(context) || null,
    rarity: ['uncommon'],
    traits: ['magical', 'snare'],
    traitLogic: 'and',
  });
}

function isAlchemicalScholarFormulaGrant(text) {
  return /\balchemical\s+scholar\b/.test(text)
    || (/\ban\s+additional\s+common\s+1st-level\s+alchemical\s+formula\b/.test(text)
      && /\beach\s+time\s+you\s+gain\s+a\s+level\s+beyond\s+1st\b/.test(text));
}

function buildAlchemicalScholarFormulaRequirement(source, context = {}) {
  const level = getContextLevel(context);
  const isProgression = level > 1;
  return buildRequirement(source, 'formula', 1, 'inferred', {
    maxLevel: isProgression ? level : 1,
    rarity: ['common'],
    traits: ['alchemical'],
  }, isProgression ? { idKind: `alchemical-scholar-level-${level}-formula` } : {});
}

function getContextLevel(context = {}) {
  const level = Number(context?.level);
  return Number.isFinite(level) ? level : 0;
}

function getIntModifier(context = {}) {
  const ability = context?.actor?.system?.abilities?.int ?? {};
  const modifier = Number(ability.mod ?? ability.modifier ?? ability.value ?? 0);
  return Number.isFinite(modifier) ? modifier : 0;
}

function inferFormulaFilters(text) {
  const formulaText = getFormulaFilterText(text);
  const traits = inferTraits(formulaText);
  const requiredTraits = inferRequiredFormulaTraits(formulaText, traits);
  const selectableTraits = requiredTraits.length > 0
    ? traits.filter((trait) => !requiredTraits.includes(trait))
    : traits;
  const traitLogic = inferFormulaTraitLogic(formulaText, selectableTraits);

  return {
    maxLevel: inferFormulaMaxLevel(formulaText),
    rarity: inferRarity(formulaText),
    requiredTraits,
    traits: selectableTraits,
    traitLogic,
  };
}

function getFormulaFilterText(text) {
  const formulaSentences = splitSentences(text).filter((sentence) => /\bformulas?\b/.test(sentence));
  return formulaSentences.length > 0 ? formulaSentences.join(' ') : text;
}

function splitSentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+|;\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function inferFormulaCount(text) {
  const normalized = String(text ?? '');
  const countPattern = '(one|two|three|four|five|six|seven|eight|nine|[1-9])';
  const formulaItemPattern = '(?:items?|mutagens?|elixirs?|poisons?|bombs?|gadgets?|oils?|potions?|talismans?|snares?|tattoos?|grafts?|ammunition|ammo)';
  const patterns = [
    new RegExp(`\\bformulas?\\s+(?:for\\s+)?${countPattern}\\b`, 'u'),
    new RegExp(`\\b${countPattern}\\s+(?:common|uncommon|rare|unique|or\\s+uncommon|common\\s+or\\s+uncommon|magical)?\\s*(?:\\d+(?:st|nd|rd|th)?[-\\s]*level\\s+)?(?:types?\\s+of\\s+)?(?:common\\s+or\\s+uncommon\\s+)?(?:alchemical\\s+)?${formulaItemPattern}\\b`, 'u'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const raw = match[1];
    return COUNT_WORDS[raw] ?? Number(raw);
  }

  if (/\ban\s+additional\b.*\bformula\b/.test(normalized)) return 1;
  if (/\ba\s+fourth\b.*\bformula\b/.test(normalized)) return 1;

  return null;
}

function inferScalingFormulaCount(text, context = {}) {
  const craftingRank = getCraftingRank(context);
  if (/\bgadget\s+specialist\b|\bgadgets?\b.*\bmaster\s+in\s+crafting\b/.test(text)) {
    if (craftingRank >= 4) return 9;
    if (craftingRank >= 3) return 6;
    return 3;
  }
  if (/\bsnare\s+specialist\b/.test(text)
    || (/\bsnares?\b/.test(text) && /\bexpert\b/.test(text) && /\bmaster\b/.test(text) && /\blegendary\b/.test(text))) {
    if (craftingRank >= 4) return 9;
    if (craftingRank >= 3) return 6;
    return 3;
  }
  return null;
}

function getCraftingRank(context = {}) {
  const skills = context?.actor?.system?.skills ?? {};
  const rank = skills.crafting?.rank ?? skills.cra?.rank ?? 0;
  const numeric = Number(rank);
  return Number.isFinite(numeric) ? numeric : 0;
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

function inferFormulaMaxLevel(text) {
  const sentence = splitSentences(text).find((entry) => /\bformulas?\b/.test(entry)) ?? text;
  return inferFirstLevel(sentence) ?? inferMaxLevel(text);
}

function inferFirstLevel(text) {
  const match = String(text ?? '').match(/\b(\d+)(?:st|nd|rd|th)?[-\s]*level\b/u);
  return match ? Number(match[1]) : null;
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
  const patterns = [
    ['alchemical', /\balchemical\b/],
    ['food', /\bfood\b/],
    ['mutagen', /\bmutagens?\b/],
    ['bomb', /\bbombs?\b/],
    ['elixir', /\belixirs?\b/],
    ['healing', /\bhealing(?:\s+trait)?\b/],
    ['poison', /\bpoisons?\b/],
    ['gadget', /\bgadgets?\b/],
    ['oil', /\boils?\b/],
    ['potion', /\bpotions?\b/],
    ['talisman', /\btalismans?\b/],
    ['snare', /\bsnares?\b/],
    ['magical', /\bmagical\b/],
    ['tattoo', /\btattoos?\b/],
    ['graft', /\bgrafts?\b/],
    ['ammunition', /\b(?:ammunition|ammo)\b/],
  ];
  return patterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([trait]) => trait);
}

function inferRequiredFormulaTraits(text, traits) {
  if (/\balchemical\s+ammunition\s+or\s+bombs?\b/.test(text) && traits.includes('alchemical')) {
    return ['alchemical'];
  }
  return [];
}

function inferFormulaTraitLogic(text, traits) {
  if (traits.length <= 1) return null;
  if (/\b(?:ammunition\s+or\s+bombs?|oils?\s+or\s+potions?)\b/.test(text)) return 'or';
  return 'and';
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
      requirements.push(buildRequirement(source, 'formula', 2, 'inferred', {
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
  const countPattern = '(one|two|three|four|five|six|seven|eight|nine|[1-9])';
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

function getPlanFeatEntriesBeforeLevel(plan, level) {
  const entries = [];
  for (const [levelKey, levelData] of Object.entries(plan?.levels ?? {})) {
    const entryLevel = Number(levelKey);
    if (!Number.isFinite(entryLevel) || entryLevel >= level) continue;
    for (const key of FEAT_GRANT_KEYS) {
      entries.push(...(levelData?.[key] ?? []));
    }
  }
  return entries;
}

function dedupeRequirements(requirements) {
  const seen = new Set();
  const deduped = [];
  for (const requirement of requirements ?? []) {
    if (!requirement?.id || seen.has(requirement.id)) continue;
    seen.add(requirement.id);
    deduped.push(requirement);
  }
  return deduped;
}

function dedupeGrantSelections(selections) {
  const seen = new Set();
  const deduped = [];
  for (const selection of selections ?? []) {
    const key = selection?.uuid ?? selection?.slug ?? selection?.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(selection);
  }
  return deduped;
}
