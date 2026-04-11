import { ALCHEMIST } from './alchemist.js';
import { ANIMIST } from './animist.js';
import { BARBARIAN } from './barbarian.js';
import { BARD } from './bard.js';
import { CHAMPION } from './champion.js';
import { CLERIC } from './cleric.js';
import { COMMANDER } from './commander.js';
import { DAREDEVIL } from './daredevil.js';
import { DRUID } from './druid.js';
import { EXEMPLAR } from './exemplar.js';
import { FIGHTER } from './fighter.js';
import { GUARDIAN } from './guardian.js';
import { GUNSLINGER } from './gunslinger.js';
import { INVENTOR } from './inventor.js';
import { INVESTIGATOR } from './investigator.js';
import { KINETICIST } from './kineticist.js';
import { MAGUS } from './magus.js';
import { MONK } from './monk.js';
import { ORACLE } from './oracle.js';
import { PSYCHIC } from './psychic.js';
import { RANGER } from './ranger.js';
import { ROGUE } from './rogue.js';
import { SLAYER } from './slayer.js';
import { SORCERER } from './sorcerer.js';
import { SUMMONER } from './summoner.js';
import { SWASHBUCKLER } from './swashbuckler.js';
import { THAUMATURGE } from './thaumaturge.js';
import { WITCH } from './witch.js';
import { WIZARD } from './wizard.js';
import { ClassRegistry } from './registry.js';

const DEFAULT_CLASSES = [
  ALCHEMIST, ANIMIST, BARBARIAN, BARD, CHAMPION, CLERIC, COMMANDER, DAREDEVIL, DRUID,
  EXEMPLAR, FIGHTER, GUARDIAN, GUNSLINGER, INVENTOR, INVESTIGATOR, KINETICIST,
  MAGUS, MONK, ORACLE, PSYCHIC, RANGER, ROGUE, SLAYER, SORCERER, SUMMONER,
  SWASHBUCKLER, THAUMATURGE, WITCH, WIZARD,
];

export function ensureClassRegistry() {
  if (ClassRegistry.getAll().length > 0) return ClassRegistry.getAll();

  for (const classDef of DEFAULT_CLASSES) {
    ClassRegistry.register(classDef);
  }

  return ClassRegistry.getAll();
}

export function ensureActorClassRegistered(actor) {
  ensureClassRegistry();

  const actorClass = actor?.class ?? null;
  const slug = String(actorClass?.slug ?? actorClass?.system?.slug ?? '').trim().toLowerCase();
  if (!slug) return null;
  if (ClassRegistry.has(slug)) return ClassRegistry.get(slug);

  const classDef = buildClassDefinitionFromActorClass(actorClass, slug);
  if (!classDef) return null;

  ClassRegistry.register(classDef);
  return classDef;
}

function buildClassDefinitionFromActorClass(actorClass, slug) {
  const system = actorClass?.system ?? {};
  const keyAbility = normalizeStringArray(system?.keyAbility?.value);
  const classFeatLevels = normalizeNumericArray(system?.classFeatLevels?.value);
  const skillFeatLevels = normalizeNumericArray(system?.skillFeatLevels?.value);
  const generalFeatLevels = normalizeNumericArray(system?.generalFeatLevels?.value);
  const ancestryFeatLevels = normalizeNumericArray(system?.ancestryFeatLevels?.value);
  const skillIncreaseLevels = normalizeNumericArray(system?.skillIncreaseLevels?.value);
  const classFeatures = normalizeClassFeatures(system?.items);

  if (classFeatLevels.length === 0 && skillFeatLevels.length === 0 && generalFeatLevels.length === 0) {
    return null;
  }

  return {
    slug,
    nameKey: actorClass?.name ?? slug,
    compendiumUuid: actorClass?.sourceId ?? actorClass?._stats?.compendiumSource ?? null,
    keyAbility,
    hp: Number(system?.hp ?? 0) || null,
    featSchedule: {
      class: classFeatLevels,
      skill: skillFeatLevels,
      general: generalFeatLevels,
      ancestry: ancestryFeatLevels,
    },
    skillIncreaseSchedule: skillIncreaseLevels,
    abilityBoostSchedule: [5, 10, 15, 20],
    trainedSkills: {
      fixed: normalizeStringArray(system?.trainedSkills?.value),
      additional: Number(system?.trainedSkills?.additional ?? 0) || 0,
    },
    classFeatures,
  };
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === 'string' && value.length > 0);
}

function normalizeNumericArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

function normalizeClassFeatures(features) {
  if (!features || typeof features !== 'object') return [];

  return Object.values(features)
    .map((feature) => {
      const level = Number(feature?.level);
      const name = typeof feature?.name === 'string' ? feature.name : '';
      if (!Number.isInteger(level) || !name) return null;
      return {
        level,
        name,
        key: slugifyFeatureName(name),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
}

function slugifyFeatureName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
