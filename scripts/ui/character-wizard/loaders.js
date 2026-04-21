import { ANCESTRY_TRAIT_ALIASES, SUBCLASS_TAGS } from '../../constants.js';
import { getCompendiumKeysForCategory } from '../../compendiums/catalog.js';
import { filterEntriesByRarityForCurrentUser } from '../../access/player-content.js';
import { createMixedAncestryHeritage } from '../../heritages/mixed-ancestry.js';
import { slugify } from '../../utils/pf2e-api.js';

let compendiumCacheVersion = 0;

export function invalidateCharacterWizardCompendiumCaches() {
  compendiumCacheVersion += 1;
}

export async function loadCompendium(wizard, key) {
  ensureFreshCompendiumCache(wizard);
  if (wizard._compendiumCache[key]) return wizard._compendiumCache[key];
  const pack = game.packs.get(key);
  if (!pack) return [];
  const sourceLabel = pack.metadata?.label ?? pack.title ?? key;
  const sourcePackage = pack.metadata?.packageName ?? pack.metadata?.package ?? pack.collection ?? key;
  const sourcePackageLabel = resolveCompendiumPackageLabel(sourcePackage);
  const docs = await pack.getDocuments();
  const items = docs.map((d) => ({
    uuid: d.uuid,
    name: d.name,
    img: d.img,
    sourcePack: key,
    sourceLabel,
    sourcePackage,
    sourcePackageLabel,
    type: d.type,
    slug: d.slug ?? null,
    publicationTitle: d.system?.publication?.title ?? null,
    description: d.system?.description?.value?.substring(0, 150) ?? '',
    traits: d.system?.traits?.value ?? [],
    otherTags: d.system?.traits?.otherTags ?? [],
    traditions: d.system?.traits?.traditions ?? d.system?.traditions?.value ?? [],
    rarity: d.system?.traits?.rarity ?? 'common',
    level: d.system?.level?.value ?? 0,
    category: d.system?.category ?? null,
    ancestrySlug: d.system?.ancestry?.slug ?? null,
    usage: d.system?.usage?.value ?? null,
    range: normalizeRangeValue(d.system?.range ?? null),
    isRanged: isRangedWeaponData(d.system),
    damageTypes: extractDamageTypes(d),
    isMagical: (d.system?.traits?.value ?? []).includes('magical'),
    trainedSkills: d.system?.trainedSkills?.value ?? [],
    boosts: normalizeBoostEntries(d.system?.boosts ?? {}),
    boostSets: normalizeBoostChoiceSets(d.system?.boosts ?? {}),
    font: d.system?.font ?? [],
    sanctification: d.system?.sanctification ?? {},
    domains: d.system?.domains ?? { primary: [], alternate: [] },
    skill: d.system?.skill ?? null,
    keyAbility: normalizeKeyAbilityOptions(d.system?.keyAbility ?? null),
  }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[key] = items;
  return items;
}

export async function loadCompendiumCategory(wizard, category, cacheKey = `category-${category}`) {
  ensureFreshCompendiumCache(wizard);
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];

  const keys = getCompendiumKeysForCategory(category);
  const loader = typeof wizard._loadCompendium === 'function'
    ? wizard._loadCompendium.bind(wizard)
    : (key) => loadCompendium(wizard, key);
  const lists = await Promise.all(keys.map((key) => loader(key)));
  const worldItems = getWorldItemsForCategory(category);
  const items = filterEntriesByRarityForCurrentUser(dedupeCompendiumItems([...lists.flat(), ...worldItems]))
    .sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadAncestries(wizard) {
  const cacheKey = 'ancestries';
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const all = await loadCompendiumCategory(wizard, 'ancestries', cacheKey);
  const items = all
    .filter((d) => d.type === 'ancestry')
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      type: 'ancestry',
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      slug: d.slug ?? null,
      publicationTitle: d.publicationTitle ?? null,
      traits: d.traits ?? [],
      rarity: d.rarity ?? 'common',
      description: d.description ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadBackgrounds(wizard) {
  const cacheKey = 'backgrounds';
  if (wizard._compendiumCache[cacheKey]) {
    wizard._compendiumCache[cacheKey] = wizard._compendiumCache[cacheKey].map(normalizeBackgroundEntry);
    return wizard._compendiumCache[cacheKey];
  }
  const all = await loadCompendiumCategory(wizard, 'backgrounds', cacheKey);
  const items = all
    .filter((d) => d.type === 'background')
    .map(normalizeBackgroundEntry)
    .sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadClasses(wizard) {
  const cacheKey = 'classes';
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const all = await loadCompendiumCategory(wizard, 'classes', cacheKey);
  const items = all
    .filter((d) => d.type === 'class')
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      type: 'class',
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      slug: d.slug ?? null,
      publicationTitle: d.publicationTitle ?? null,
      rarity: d.rarity ?? 'common',
      description: d.description ?? '',
      traits: d.traits ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadDeities(wizard) {
  const cacheKey = 'deities';
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const all = await loadCompendiumCategory(wizard, 'deities', cacheKey);
  const items = all
    .filter((d) => d.type === 'deity' || d.category === 'deity')
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      type: 'heritage',
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      publicationTitle: d.publicationTitle ?? null,
      font: d.font ?? [],
      sanctification: d.sanctification ?? {},
      domains: d.domains ?? { primary: [], alternate: [] },
      skill: d.skill ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

function extractDamageTypes(item) {
  const damageTypes = [];
  const rawDamage = item?.system?.damage;
  if (typeof rawDamage?.damageType === 'string') damageTypes.push(rawDamage.damageType);
  if (Array.isArray(rawDamage?.instances)) {
    for (const instance of rawDamage.instances) {
      if (typeof instance?.type === 'string') damageTypes.push(instance.type);
      if (typeof instance?.damageType === 'string') damageTypes.push(instance.damageType);
    }
  }
  return [...new Set(damageTypes.filter((type) => typeof type === 'string' && type.length > 0))];
}

function normalizeRangeValue(range) {
  if (!range) return null;
  if (typeof range === 'number' && range > 0) return String(range);
  if (typeof range === 'string') return range.trim() || null;
  if (typeof range?.value === 'number' && range.value > 0) return String(range.value);
  if (typeof range?.value === 'string' && range.value.trim().length > 0) return range.value.trim();
  if (typeof range?.increment === 'number' && range.increment > 0) return String(range.increment);
  if (typeof range?.increment === 'string' && range.increment.trim().length > 0) return range.increment.trim();
  if (typeof range?.max === 'number' && range.max > 0) return String(range.max);
  if (typeof range?.max === 'string' && range.max.trim().length > 0) return range.max.trim();
  return null;
}

function normalizeBoostEntries(boosts) {
  return Object.values(boosts ?? {})
    .flatMap((entry) => {
      if (Array.isArray(entry?.value)) return entry.value;
      if (typeof entry?.selected === 'string') return [entry.selected];
      return [];
    })
    .filter((value) => typeof value === 'string' && value.length > 0);
}

function normalizeBoostChoiceSets(boosts) {
  return Object.values(boosts ?? {})
    .map((entry) => {
      if (Array.isArray(entry?.value)) return entry.value;
      if (typeof entry?.selected === 'string') return [entry.selected];
      return [];
    })
    .map((values) => normalizeAttributeChoices(values))
    .filter((values) => values.length > 0);
}

function normalizeBackgroundEntry(d) {
  const boosts = normalizeAttributeChoices(d?.boosts);
  const keyAbility = normalizeAttributeChoices(d?.keyAbility);
  const boostSets = Array.isArray(d?.boostSets)
    ? d.boostSets.map((values) => normalizeAttributeChoices(values)).filter((values) => values.length > 0)
    : [];
  return {
    uuid: d.uuid,
    name: d.name,
    img: d.img,
    type: 'background',
    sourcePack: d.sourcePack,
    sourceLabel: d.sourceLabel,
    sourcePackage: d.sourcePackage,
    sourcePackageLabel: d.sourcePackageLabel,
    slug: d.slug ?? null,
    publicationTitle: d.publicationTitle ?? null,
    keyAbility,
    rarity: d.rarity ?? 'common',
    description: d.description ?? '',
    traits: d.traits ?? [],
    trainedSkills: d.trainedSkills ?? [],
    boosts,
    boostSets,
    backgroundAttributes: deriveBackgroundAttributes({ boosts, boostSets, keyAbility }),
  };
}

function normalizeKeyAbilityOptions(keyAbility) {
  if (Array.isArray(keyAbility?.value)) {
    return normalizeAttributeChoices(keyAbility.value);
  }
  if (typeof keyAbility?.selected === 'string' && keyAbility.selected.length > 0) {
    return normalizeAttributeChoices([keyAbility.selected]);
  }
  return [];
}

const ATTRIBUTE_SLUG_ALIASES = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const ALL_BACKGROUND_ATTRIBUTES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function normalizeAttributeChoices(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .map((value) => {
        if (typeof value !== 'string') return null;
        const normalized = String(value).trim().toLowerCase();
        return ATTRIBUTE_SLUG_ALIASES[normalized] ?? normalized;
      })
      .filter((value) => ALL_BACKGROUND_ATTRIBUTES.includes(value)),
  )];
}

function deriveBackgroundAttributes({ boosts = [], boostSets = [], keyAbility = [] } = {}) {
  const normalizedBoosts = normalizeAttributeChoices(boosts);
  const normalizedKeyAbility = normalizeAttributeChoices(keyAbility);
  const normalizedBoostSets = boostSets
    .map((values) => normalizeAttributeChoices(values))
    .filter((values) => values.length > 0);

  const specificBoostChoices = [...new Set(
    normalizedBoostSets
      .filter((values) => values.length > 0 && values.length < ALL_BACKGROUND_ATTRIBUTES.length)
      .flat(),
  )];

  const intersectedBoostChoices = normalizedBoostSets.reduce((common, values) => {
    if (!common) return [...values];
    return common.filter((value) => values.includes(value));
  }, null) ?? [];

  const candidates = [specificBoostChoices, intersectedBoostChoices, normalizedKeyAbility, normalizedBoosts]
    .map((values) => [...new Set(values)])
    .filter((values, index, all) =>
      values.length > 0
      && all.findIndex((other) => other.length === values.length && other.every((value, i) => value === values[i])) === index,
    );

  const preferredSpecific = candidates
    .filter((values) => values.length < ALL_BACKGROUND_ATTRIBUTES.length)
    .sort((a, b) => a.length - b.length)[0];

  return preferredSpecific ?? candidates[0] ?? [];
}

function isRangedWeaponData(system) {
  const traits = system?.traits?.value ?? [];
  const hasThrownMeleeTrait = traits.some((trait) => /^thrown(?:-\d+)?$/i.test(String(trait)));
  const hasRange = normalizeRangeValue(system?.range ?? null) !== null;
  return hasRange && !hasThrownMeleeTrait;
}

export async function loadHeritages(wizard) {
  if (!wizard.data.ancestry) return [];
  const ancestryTokens = collectAncestryMatchTokens(wizard.data.ancestry);
  if (ancestryTokens.size === 0) return [];
  const all = await loadRawHeritages(wizard);
  const filtered = all.filter((h) => {
    const heritageAncestrySlug = normalizeSlugLike(h.ancestrySlug);
    if (heritageAncestrySlug && ancestryTokens.has(heritageAncestrySlug)) return true;
    const heritageTraits = (h.traits ?? []).map(normalizeSlugLike).filter(Boolean);
    if (heritageTraits.some((trait) => ancestryTokens.has(trait))) return true;
    if (!h.ancestrySlug) return true;
    return false;
  });

  const mixedAncestry = createMixedAncestryHeritage(wizard.data.ancestry);
  if (!filtered.some((entry) => entry.uuid === mixedAncestry.uuid)) {
    filtered.push(mixedAncestry);
  }
  wizard._documentCache?.set?.(mixedAncestry.uuid, mixedAncestry);
  return filtered;
}

export async function loadSubclasses(wizard) {
  const tag = wizard.data.class?.subclassTag ?? SUBCLASS_TAGS[wizard.data.class?.slug];
  if (!tag) return [];
  return loadTaggedClassFeatures(wizard, tag, `subclass-${tag}`, {
    includeSubclassData: true,
    packageName: wizard.data.class?.sourcePackage ?? null,
  });
}

export async function loadSubclassesForClass(wizard, classEntry) {
  const tag = classEntry?.subclassTag ?? SUBCLASS_TAGS[classEntry?.slug];
  if (!tag) return [];
  return loadTaggedClassFeatures(wizard, tag, `subclass-${tag}`, {
    includeSubclassData: true,
    packageName: classEntry?.sourcePackage ?? null,
  });
}

export async function resolveClassSubclassTag(wizard, classItem) {
  const explicitTag = classItem?.subclassTag ?? SUBCLASS_TAGS[classItem?.slug];
  if (typeof explicitTag === 'string' && explicitTag.length > 0) return explicitTag;
  if (!classItem?.slug) return null;

  const candidates = [...new Set(
    Object.values(classItem.system?.items ?? {})
      .filter((feature) => feature && feature.level <= 1 && typeof feature.name === 'string' && feature.name.trim().length > 0)
      .map((feature) => `${classItem.slug}-${slugify(feature.name)}`)
      .filter(Boolean),
  )];
  if (candidates.length === 0) return null;

  const docs = await loadClassFeatureDocsForClass(wizard, classItem);
  const matches = candidates
    .map((candidate) => ({
      candidate,
      count: docs.filter((doc) => (doc.otherTags ?? []).includes(candidate)).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.candidate.localeCompare(b.candidate));

  return matches[0]?.candidate ?? null;
}

export async function loadTheses(wizard, classEntry = wizard.data.class) {
  if (classEntry?.slug !== 'wizard') return [];
  return loadTaggedClassFeatures(wizard, 'wizard-arcane-thesis', 'wizard-theses');
}

export async function loadThaumaturgeImplements(wizard, classEntry = wizard.data.class) {
  if (classEntry?.slug !== 'thaumaturge') return [];
  return loadTaggedClassFeatures(wizard, 'thaumaturge-implement', 'thaumaturge-implements');
}

export async function loadCommanderTactics(wizard, classEntry = wizard.data.class) {
  if (classEntry?.slug !== 'commander') return [];
  const cacheKey = 'commander-tactics';
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];

  const docs = await loadCompendiumCategory(wizard, 'actions', cacheKey);
  const items = docs
    .filter((d) => d.type === 'action')
    .filter((d) => (d.traits ?? []).includes('tactic'))
    .filter((d) => {
      const tags = d.otherTags ?? [];
      return tags.includes('commander-mobility-tactic') || tags.includes('commander-offensive-tactic');
    })
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      slug: d.slug ?? null,
      publicationTitle: d.publicationTitle ?? null,
      rarity: d.system?.traits?.rarity ?? 'common',
      traits: d.system?.traits?.value ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadExemplarIkons(wizard, classEntry = wizard.data.class) {
  if (classEntry?.slug !== 'exemplar') return [];
  return loadTaggedClassFeatures(wizard, 'exemplar-ikon', 'exemplar-ikons');
}

export async function loadInventorWeaponOptions(wizard) {
  const all = await loadCompendiumCategory(wizard, 'equipment');
  return all
    .filter((item) => item.type === 'weapon')
    .filter((item) => item.level === 0)
    .filter((item) => ['simple', 'martial', 'advanced'].includes(item.category))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadInventorArmorOptions(wizard) {
  const all = await loadCompendiumCategory(wizard, 'equipment');
  const allowed = new Set(['power-suit', 'subterfuge-suit']);
  return all
    .filter((item) => item.type === 'armor' && allowed.has(item.slug))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadInventorWeaponModifications(wizard, selectedItem) {
  const all = await loadCompendiumCategory(wizard, 'classFeatures');
  const slugs = ['advanced-design', 'blunt-shot', 'complex-simplicity', 'dynamic-weighting', 'entangling-form', 'hampering-spikes', 'hefty-composition', 'modular-head', 'pacification-tools', 'razor-prongs', 'segmented-frame'];
  const item = selectedItem ?? {};
  const category = item.category;
  const traits = new Set(item.traits ?? []);
  const isAdvanced = category === 'advanced';
  const isSimple = category === 'simple';
  const isMelee = !item.range;
  const isRanged = !!item.range;
  const isThrown = [...traits].some((trait) => trait.startsWith('thrown-'));
  const isOneHand = item.usage === 'held-in-one-hand';

  return all
    .filter((entry) => slugs.includes(entry.slug))
    .filter((entry) => {
      switch (entry.slug) {
        case 'advanced-design': return true;
        case 'blunt-shot': return isRanged && !isThrown && !isAdvanced;
        case 'complex-simplicity': return isSimple;
        case 'dynamic-weighting': return isOneHand && isMelee && !isAdvanced && !traits.has('agile') && !traits.has('attached') && !traits.has('free-hand');
        case 'entangling-form':
        case 'hampering-spikes':
        case 'hefty-composition':
        case 'pacification-tools':
        case 'razor-prongs':
          return isMelee && !isAdvanced;
        case 'modular-head':
        case 'segmented-frame':
          return !isAdvanced;
        default:
          return true;
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadInventorArmorModifications(wizard, selectedItem) {
  const all = await loadCompendiumCategory(wizard, 'classFeatures');
  const slugs = ['harmonic-oscillator', 'metallic-reactance', 'muscular-exoskeleton', 'otherworldly-protection', 'phlogistonic-regulator', 'speed-boosters', 'subtle-dampeners'];
  const armorSlug = selectedItem?.slug ?? null;
  return all
    .filter((entry) => slugs.includes(entry.slug))
    .filter((entry) => {
      if (entry.slug === 'muscular-exoskeleton') return armorSlug === 'power-suit';
      if (entry.slug === 'subtle-dampeners') return armorSlug === 'subterfuge-suit';
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadKineticImpulses(wizard, data) {
  const all = await loadCompendiumCategory(wizard, 'feats');
  const firstElement = data.subclass?.slug?.replace(/-gate$/, '');
  const secondElement = data.secondElement?.slug?.replace(/-gate$/, '');
  const selected = new Set((data.kineticImpulses ?? []).map((entry) => entry.uuid));
  const selectedElements = new Set((data.kineticImpulses ?? []).map((entry) => entry.element).filter(Boolean));
  const lockedElement = data.kineticGateMode === 'dual-gate' && selectedElements.size === 1 ? [...selectedElements][0] : null;

  return all
    .filter((item) => item.type === 'feat')
    .filter((item) => item.level === 1)
    .filter((item) => item.traits.includes('impulse'))
    .filter((item) => !item.traits.includes('composite'))
    .filter((item) => data.kineticGateMode === 'dual-gate'
      ? item.traits.includes(firstElement) || item.traits.includes(secondElement)
      : item.traits.includes(firstElement))
    .filter((item) => {
      if (!lockedElement || selected.has(item.uuid)) return true;
      const element = item.traits.find((trait) => [firstElement, secondElement].includes(trait)) ?? null;
      return element !== lockedElement;
    })
    .map((item) => ({
      ...item,
      element: item.traits.find((trait) => [firstElement, secondElement].includes(trait)) ?? null,
      selected: selected.has(item.uuid),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTaggedClassFeatures(wizard, tag, cacheKey, { includeSubclassData = false, packageName = null } = {}) {
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const docs = packageName
    ? await loadClassFeatureDocsForClass(wizard, { sourcePackage: packageName })
    : await loadCompendiumCategory(wizard, 'classFeatures');
  const items = await Promise.all(docs
    .filter((d) => (d.otherTags ?? []).includes(tag))
    .map(async (d) => {
      const base = {
        uuid: d.uuid,
        name: d.name,
        img: d.img,
        sourcePack: d.sourcePack,
        sourceLabel: d.sourceLabel,
        sourcePackage: d.sourcePackage,
        sourcePackageLabel: d.sourcePackageLabel,
        slug: d.slug ?? null,
        publicationTitle: d.publicationTitle ?? null,
        description: d.description ?? '',
        traits: d.traits ?? [],
        rarity: d.rarity ?? 'common',
      };
      if (!includeSubclassData) return base;
      const source = await wizard._getCachedDocument(d.uuid);
      return {
        ...base,
        tradition: wizard._resolveSubclassTradition(source),
        spellUuids: parseSpellUuidsFromDescription(source?.system?.rules ?? [], source?.system?.description?.value ?? ''),
        choiceSets: await wizard._parseChoiceSets(source?.system?.rules ?? []),
        grantedSkills: wizard._parseGrantedSkills(source?.system?.rules ?? [], source?.system?.description?.value ?? ''),
        grantedLores: wizard._parseSubclassLores(source?.system?.rules ?? [], source?.system?.description?.value ?? ''),
        curriculum: parseCurriculum(source?.system?.description?.value ?? ''),
      };
    }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

async function loadClassFeatureDocsForClass(wizard, classItem) {
  const packageName = classItem?.sourcePackage ?? null;
  const docs = await loadCompendiumCategory(wizard, 'classFeatures');
  if (!packageName) return docs;

  const configuredKeys = new Set(getCompendiumKeysForCategory('classFeatures'));
  const loader = typeof wizard._loadCompendium === 'function'
    ? wizard._loadCompendium.bind(wizard)
    : (key) => loadCompendium(wizard, key);

  const allPacks = typeof game.packs?.values === 'function'
    ? [...game.packs.values()]
    : Array.isArray(game.packs?.contents)
      ? [...game.packs.contents]
      : [];

  const extraKeys = allPacks
    .filter((pack) => pack?.documentName === 'Item' || pack?.metadata?.type === 'Item' || pack?.metadata?.documentName === 'Item')
    .filter((pack) => (pack.metadata?.packageName ?? pack.metadata?.package ?? '') === packageName)
    .map((pack) => pack.collection ?? pack.metadata?.id ?? '')
    .filter((key) => key && !configuredKeys.has(key));

  if (extraKeys.length === 0) return docs;

  const extraLists = await Promise.all(extraKeys.map((key) => loader(key)));
  return dedupeCompendiumItems([...docs, ...extraLists.flat()]);
}

export function parseVesselSpell(html) {
  if (!html) return null;
  const uuids = [...extractSpellUuids(html)];
  return uuids.at(-1) ?? null;
}

export function parseCurriculum(html) {
  if (!html) return null;

  const normalized = normalizeSpellSectionText(html);
  const curriculum = parseRankedSpellLines(normalized, { stopOnSectionBreak: true, ignoreSingleSpellLines: true });
  return Object.keys(curriculum).length > 0 ? curriculum : null;
}

export async function loadRawHeritages(wizard) {
  ensureFreshCompendiumCache(wizard);
  const cacheKey = 'heritages';
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const docs = await loadCompendiumCategory(wizard, 'heritages', cacheKey);
  const items = docs
    .filter((d) => d.type === 'heritage')
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      type: 'heritage',
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      slug: d.slug ?? null,
      publicationTitle: d.publicationTitle ?? null,
      traits: d.traits ?? [],
      rarity: d.rarity ?? 'common',
      ancestrySlug: d.ancestrySlug ?? null,
    }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export function parseSpellUuidsFromDescription(rules, html) {
  const uuids = new Set();
  for (const rule of rules) {
    if (rule.key === 'GrantItem' && typeof rule.uuid === 'string' && rule.uuid.includes('spells-srd')) {
      uuids.add(rule.uuid);
    }
  }
  if (html) {
    const re1 = /data-uuid="(Compendium\.pf2e\.spells-srd\.Item\.[^"]+)"/g;
    const re2 = /@UUID\[Compendium\.pf2e\.spells-srd\.Item\.([^\]]+)\]/g;
    let match;
    while ((match = re1.exec(html)) !== null) uuids.add(match[1]);
    while ((match = re2.exec(html)) !== null) uuids.add(`Compendium.pf2e.spells-srd.Item.${match[1]}`);
  }
  return [...uuids];
}

function* extractSpellUuids(text) {
  const uuidPattern = /@UUID\[Compendium\.pf2e\.spells-srd\.Item\.([^\]]+)\]|data-uuid="(Compendium\.pf2e\.spells-srd\.Item\.[^"]+)"/gi;
  let match;
  while ((match = uuidPattern.exec(text)) !== null) {
    yield match[2] ?? `Compendium.pf2e.spells-srd.Item.${match[1]}`;
  }
}

function normalizeSpellSectionText(html) {
  return html
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:ul|ol|p|strong|em)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ');
}

function parseRankedSpellLines(text, { stopOnSectionBreak = false, ignoreSingleSpellLines = false } = {}) {
  const ranks = {};
  const rankMap = {
    cantrip: 0,
    cantrips: 0,
    '1st': 1,
    '2nd': 2,
    '3rd': 3,
    '4th': 4,
    '5th': 5,
    '6th': 6,
    '7th': 7,
    '8th': 8,
    '9th': 9,
  };

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim().replace(/^[*\-\u2022]\s*/, '').trim();
    if (!line) continue;

    const rankMatch = line.match(/^(cantrips?|1st|2nd|3rd|4th|5th|6th|7th|8th|9th)(?:-rank)?(?:\s*:|\s+)/i);
    if (!rankMatch) {
      if (stopOnSectionBreak && Object.keys(ranks).length > 0) break;
      continue;
    }

    const entries = [...extractSpellUuids(line)];
    if (entries.length === 0) continue;
    if (ignoreSingleSpellLines && entries.length === 1 && /\binitial\b|\badvanced\b/i.test(line)) continue;

    const rank = rankMap[rankMatch[1].toLowerCase()];
    ranks[rank] = entries;
  }

  return ranks;
}

function dedupeCompendiumItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.uuid || seen.has(item.uuid)) return false;
    seen.add(item.uuid);
    return true;
  });
}

function getWorldItemsForCategory(category) {
  const allItems = getAllWorldItems();
  const sourcePackage = 'world';
  const sourcePackageLabel = compactSourceOwnerLabel(game.world?.title ?? 'World');

  return allItems
    .filter((item) => matchesWorldCategory(item, category))
    .map((item) => ({
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      sourcePack: item.sourcePack ?? null,
      sourceLabel: sourcePackageLabel,
      sourcePackage: item.sourcePackage ?? sourcePackage,
      sourcePackageLabel: item.sourcePackageLabel ?? sourcePackageLabel,
      type: item.type,
      slug: item.slug ?? null,
      publicationTitle: item.system?.publication?.title ?? null,
      description: item.system?.description?.value?.substring(0, 150) ?? '',
      traits: item.system?.traits?.value ?? [],
      otherTags: item.system?.traits?.otherTags ?? [],
      traditions: item.system?.traits?.traditions ?? item.system?.traditions?.value ?? [],
      rarity: item.system?.traits?.rarity ?? 'common',
      level: item.system?.level?.value ?? 0,
      category: item.system?.category ?? null,
      ancestrySlug: item.system?.ancestry?.slug ?? null,
      usage: item.system?.usage?.value ?? null,
      range: normalizeRangeValue(item.system?.range ?? null),
      isRanged: isRangedWeaponData(item.system),
      damageTypes: extractDamageTypes(item),
      isMagical: (item.system?.traits?.value ?? []).includes('magical'),
      trainedSkills: item.system?.trainedSkills?.value ?? [],
      boosts: normalizeBoostEntries(item.system?.boosts ?? {}),
      font: item.system?.font ?? [],
      sanctification: item.system?.sanctification ?? {},
      domains: item.system?.domains ?? { primary: [], alternate: [] },
      skill: item.system?.skill ?? null,
      keyAbility: normalizeKeyAbilityOptions(item.system?.keyAbility ?? null),
    }));
}

function matchesWorldCategory(item, category) {
  const type = String(item?.type ?? '').toLowerCase();
  if (category === 'classes') return type === 'class';
  if (category === 'spells') return type === 'spell';
  if (category === 'equipment') return EQUIPMENT_TYPES.has(type);
  if (category === 'feats') return type === 'feat' && !isClassFeatureCategory(item?.system?.category);
  return false;
}

function isClassFeatureCategory(category) {
  const normalized = String(
    (typeof category === 'object' && category !== null ? category.value : category) ?? '',
  ).toLowerCase();
  return ['classfeature', 'class-feature', 'ancestryfeature', 'ancestry-feature'].includes(normalized);
}

function getAllWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'equipment', 'consumable', 'ammo', 'treasure', 'backpack', 'shield', 'kit']);

function collectAncestryMatchTokens(ancestry) {
  const baseTokens = new Set();
  const addToken = (value) => {
    const normalized = normalizeSlugLike(value);
    if (normalized) baseTokens.add(normalized);
  };

  addToken(ancestry?.slug);
  addToken(ancestry?.name);

  const uuidParts = String(ancestry?.uuid ?? '')
    .split(/[./]/)
    .map((part) => normalizeSlugLike(part))
    .filter(Boolean);
  for (const part of uuidParts) addToken(part);

  const expanded = new Set();
  for (const token of baseTokens) {
    const aliases = ANCESTRY_TRAIT_ALIASES[token] ?? [token];
    for (const alias of aliases) {
      const normalized = normalizeSlugLike(alias);
      if (normalized) expanded.add(normalized);
    }
  }

  return expanded;
}

function normalizeSlugLike(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveCompendiumPackageLabel(packageKey) {
  if (!packageKey) return '';
  if (game.system?.id === packageKey) return compactSourceOwnerLabel(game.system.title ?? packageKey);
  return compactSourceOwnerLabel(game.modules?.get?.(packageKey)?.title ?? packageKey);
}

function compactSourceOwnerLabel(label) {
  let text = String(label ?? '').trim();
  if (!text) return '';

  if (/^pathfinder second edition$/i.test(text)) return 'PF2E';

  text = text.replace(/\s+for\s+Pathfinder\s+2e\s+by\s+Roll\s+For\s+Combat$/i, '');
  text = text.replace(/\s+by\s+Roll\s+For\s+Combat$/i, '');

  return text;
}

function ensureFreshCompendiumCache(wizard) {
  if (!wizard) return;
  if (wizard._compendiumCacheVersion == null) {
    wizard._compendiumCacheVersion = compendiumCacheVersion;
    if (!wizard._compendiumCache) wizard._compendiumCache = {};
    return;
  }
  if (wizard._compendiumCacheVersion === compendiumCacheVersion && wizard._compendiumCache) return;
  wizard._compendiumCache = {};
  wizard._compendiumCacheVersion = compendiumCacheVersion;
}
