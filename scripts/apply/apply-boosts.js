import { getGradualBoostGroupLevels } from '../classes/progression.js';
import { isGradualBoostsEnabled } from '../utils/pf2e-api.js';

const BOOST_MILESTONES = [5, 10, 15, 20];
const ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export async function applyBoosts(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData?.abilityBoosts?.length) return [];

  const boostKey = findBoostKey(level);
  if (!boostKey) return [];

  if (actor.system?.build?.attributes?.manual === true) {
    const abilities = buildManualAbilities(actor, levelData.abilityBoosts);
    await actor.update({ 'system.abilities': abilities });
    return levelData.abilityBoosts;
  }

  const buildSource = foundry.utils.deepClone(actor.toObject().system.build ?? {});
  if (!buildSource.attributes) buildSource.attributes = {};
  if (!buildSource.attributes.boosts) buildSource.attributes.boosts = {};
  const existing = buildSource.attributes.boosts[boostKey] ?? [];
  buildSource.attributes.boosts[boostKey] = buildBoostBucket(existing, plan, level, levelData.abilityBoosts);
  await actor.update({ 'system.build': buildSource });

  return levelData.abilityBoosts;
}

function buildManualAbilities(actor, boosts) {
  const source = actor.toObject().system.abilities ?? {};
  const abilities = Object.fromEntries(
    ATTRIBUTES.map((attribute) => {
      const modifier = Number(source[attribute]?.mod ?? actor.system?.abilities?.[attribute]?.mod);
      return [attribute, { mod: Number.isFinite(modifier) ? modifier : 0 }];
    }),
  );

  for (const boost of normalizeAbilityBoostList(boosts)) {
    abilities[boost].mod = abilities[boost].mod >= 4 ? abilities[boost].mod + 0.5 : abilities[boost].mod + 1;
  }

  return abilities;
}

function findBoostKey(level) {
  return BOOST_MILESTONES.find((m) => m >= level) ?? null;
}

function buildBoostBucket(existing, plan, level, boosts) {
  if (!isGradualBoostsEnabled()) {
    return [...normalizeAbilityBoostList(existing), ...normalizeAbilityBoostList(boosts)];
  }

  const groupLevels = getGradualBoostGroupLevels(level);
  const currentIndex = groupLevels.indexOf(level);
  if (currentIndex < 0) {
    return [...normalizeAbilityBoostList(existing), ...normalizeAbilityBoostList(boosts)];
  }

  const plannedBoosts = normalizeAbilityBoostList(boosts);
  if (plannedBoosts.length > 1) return plannedBoosts.slice(0, currentIndex + 1);

  const bucket = normalizeAbilityBoostList(existing);
  for (const [index, groupLevel] of groupLevels.entries()) {
    if (index > currentIndex) break;
    const plannedBoost = normalizeAbilityBoostList(plan?.levels?.[groupLevel]?.abilityBoosts)[0];
    if (plannedBoost) bucket[index] = plannedBoost;
  }

  return bucket.slice(0, currentIndex + 1).filter(Boolean);
}

function normalizeAbilityBoostList(value) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value)
        .flatMap(([key, entry]) => normalizeAbilityBoostObjectEntry(key, entry))
      : [value];

  return entries
    .map((entry) => normalizeAbilityBoostKey(entry))
    .filter((entry) => ATTRIBUTES.includes(entry));
}

function normalizeAbilityBoostObjectEntry(key, entry) {
  if (entry === true || entry === 1 || entry === 'true' || entry === 'selected') return [key];
  if (typeof entry === 'string') return [entry];
  if (Array.isArray(entry)) return entry;
  if (!entry || typeof entry !== 'object') return [];
  if (typeof entry.selected === 'string') return [entry.selected];
  if (Array.isArray(entry.selected)) return entry.selected;
  if (typeof entry.value === 'string') return [entry.value];
  if (Array.isArray(entry.value)) return entry.value;
  return [];
}

function normalizeAbilityBoostKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const aliases = {
    strength: 'str',
    dexterity: 'dex',
    constitution: 'con',
    intelligence: 'int',
    wisdom: 'wis',
    charisma: 'cha',
  };
  return aliases[normalized] ?? normalized;
}
