import { ANCESTRY_TRAIT_ALIASES, SUBCLASS_TAGS } from '../../constants.js';
import { getCompendiumKeysForCategory } from '../../compendiums/catalog.js';
import { filterEntriesByRarityForCurrentUser } from '../../access/player-content.js';

export async function loadCompendium(wizard, key) {
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
    font: d.system?.font ?? [],
    sanctification: d.system?.sanctification ?? {},
    domains: d.system?.domains ?? { primary: [], alternate: [] },
    skill: d.system?.skill ?? null,
  }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  wizard._compendiumCache[key] = items;
  return items;
}

export async function loadCompendiumCategory(wizard, category, cacheKey = `category-${category}`) {
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];

  const keys = getCompendiumKeysForCategory(category);
  const loader = typeof wizard._loadCompendium === 'function'
    ? wizard._loadCompendium.bind(wizard)
    : (key) => loadCompendium(wizard, key);
  const lists = await Promise.all(keys.map((key) => loader(key)));
  const items = filterEntriesByRarityForCurrentUser(dedupeCompendiumItems(lists.flat()))
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
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const all = await loadCompendiumCategory(wizard, 'backgrounds', cacheKey);
  const items = all
    .filter((d) => d.type === 'background')
    .map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      type: 'background',
      sourcePack: d.sourcePack,
      sourceLabel: d.sourceLabel,
      sourcePackage: d.sourcePackage,
      sourcePackageLabel: d.sourcePackageLabel,
      slug: d.slug ?? null,
      rarity: d.rarity ?? 'common',
      description: d.description ?? '',
      traits: d.traits ?? [],
    }))
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
  return all.filter((h) => {
    const heritageAncestrySlug = normalizeSlugLike(h.ancestrySlug);
    if (heritageAncestrySlug && ancestryTokens.has(heritageAncestrySlug)) return true;
    const heritageTraits = (h.traits ?? []).map(normalizeSlugLike).filter(Boolean);
    if (heritageTraits.some((trait) => ancestryTokens.has(trait))) return true;
    if (!h.ancestrySlug) return true;
    return false;
  });
}

export async function loadSubclasses(wizard) {
  const tag = SUBCLASS_TAGS[wizard.data.class?.slug];
  if (!tag) return [];
  return loadTaggedClassFeatures(wizard, tag, `subclass-${tag}`, { includeSubclassData: true });
}

export async function loadTheses(wizard) {
  if (wizard.data.class?.slug !== 'wizard') return [];
  return loadTaggedClassFeatures(wizard, 'wizard-arcane-thesis', 'wizard-theses');
}

export async function loadThaumaturgeImplements(wizard) {
  if (wizard.data.class?.slug !== 'thaumaturge') return [];
  return loadTaggedClassFeatures(wizard, 'thaumaturge-implement', 'thaumaturge-implements');
}

export async function loadCommanderTactics(wizard) {
  if (wizard.data.class?.slug !== 'commander') return [];
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
      rarity: d.system?.traits?.rarity ?? 'common',
      traits: d.system?.traits?.value ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  wizard._compendiumCache[cacheKey] = items;
  return items;
}

export async function loadExemplarIkons(wizard) {
  if (wizard.data.class?.slug !== 'exemplar') return [];
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

export async function loadTaggedClassFeatures(wizard, tag, cacheKey, { includeSubclassData = false } = {}) {
  if (wizard._compendiumCache[cacheKey]) return wizard._compendiumCache[cacheKey];
  const docs = await loadCompendiumCategory(wizard, 'classFeatures');
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
