import { ANCESTRAL_PARAGON_FEAT_LEVELS } from '../classes/progression.js';
import { ClassRegistry } from '../classes/registry.js';
import { capitalize, getCampaignFeatSectionIds, isAncestralParagonEnabled } from '../utils/pf2e-api.js';
import { warn } from '../utils/logger.js';
import {
  extractCompendiumUuidsByCategory,
  isCompendiumUuidInCategory,
} from '../system-support/profiles.js';

const CATEGORY_TO_GROUP = {
  classFeats: 'class',
  skillFeats: 'skill',
  generalFeats: 'general',
  ancestryFeats: 'ancestry',
  archetypeFeats: 'archetype',
  mythicFeats: 'mythic',
  dualClassFeats: 'class',
  customFeats: 'bonus',
};

const FEAT_KEYS = Object.keys(CATEGORY_TO_GROUP);

function getFeatGroup(key, level) {
  if (key === 'dualClassFeats') {
    return getDualClassFeatGroupId();
  }

  if (
    key === 'ancestryFeats'
    && isAncestralParagonEnabled()
    && ANCESTRAL_PARAGON_FEAT_LEVELS.includes(level)
  ) {
    if (getCampaignFeatSectionIds().includes('ancestryParagon')) {
      return 'ancestryParagon';
    }

    return 'xdy_ancestryparagon';
  }

  return CATEGORY_TO_GROUP[key];
}

function getDualClassFeatGroupId() {
  const sectionIds = getCampaignFeatSectionIds()
    .map((id) => String(id ?? '').trim())
    .filter((id) => id.length > 0);
  const matchingId = sectionIds.find((id) => ['xdy_dualclass', 'dualclass', 'dual_class'].includes(id.toLowerCase()));
  return matchingId ?? CATEGORY_TO_GROUP.dualClassFeats;
}

export async function applyFeats(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData) return [];

  const candidates = [];
  const existingSources = getActorFeatSources(actor);
  const pendingSources = new Set();

  for (const key of FEAT_KEYS) {
    const feats = levelData[key];
    if (!feats?.length) continue;

    const group = getFeatGroup(key, level);
    for (const featEntry of feats) {
      const item = await resolveFeat(featEntry.uuid);
      if (!item) continue;
      const sourceId = getItemSourceId(item);
      if (sourceId && (existingSources.has(sourceId) || pendingSources.has(sourceId))) continue;

      const featData = prepareForCreation(item, featEntry, group, level);
      candidates.push({ featData, sourceId });
      if (sourceId) pendingSources.add(sourceId);
    }
  }

  const grantedSources = await collectGrantedFeatSources(candidates.map((entry) => entry.featData));
  const itemsToCreate = candidates
    .filter((entry) => !(entry.sourceId && grantedSources.has(entry.sourceId)))
    .map((entry) => entry.featData);

  if (itemsToCreate.length === 0) return [];

  const created = await actor.createEmbeddedDocuments('Item', itemsToCreate);

  await applyFocusSpellsFromFeats(actor, plan, itemsToCreate);

  return created;
}

/**
 * Determines if a spell is a focus-like spell (focus spell, link cantrip, conflux spell, etc.)
 * These are class-specific spells that go in the focus spellcasting entry.
 * Key indicator: no traditions (regular spells always have traditions).
 * Also checks for the explicit 'focus' trait.
 */
function isFocusLikeSpell(spell) {
  const traits = spell.system?.traits?.value ?? [];
  if (traits.includes('focus')) return true;
  const traditions = spell.system?.traits?.traditions ?? [];
  return traditions.length === 0;
}

function isExplicitFocusSpell(spell) {
  return (spell.system?.traits?.value ?? []).includes('focus');
}

async function applyFocusSpellsFromFeats(actor, plan, featDatas) {
  const focusSpells = [];

  for (const featData of featDatas) {
    const rules = featData.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || typeof rule.uuid !== 'string') continue;
      if (!isCompendiumUuidInCategory(rule.uuid, 'spells')) continue;
      const spell = await fromUuid(rule.uuid).catch(() => null);
      if (!spell) continue;
      if (!isFocusLikeSpell(spell)) continue;
      if (!focusSpells.some((s) => s.uuid === spell.uuid)) {
        focusSpells.push(spell);
      }
    }

    // Also scan description for spell UUID references
    const html = featData.system?.description?.value ?? '';
    if (html) {
      const descUuids = extractCompendiumUuidsByCategory(html, 'spells');
      for (const uuid of descUuids) {
        if (focusSpells.some((s) => s.uuid === uuid)) continue;
        const spell = await fromUuid(uuid).catch(() => null);
        if (spell && isExplicitFocusSpell(spell)) focusSpells.push(spell);
      }
    }
  }

  if (focusSpells.length === 0) return;

  const classDef = ClassRegistry.get(plan.classSlug);
  const tradition = classDef?.spellcasting?.tradition ?? 'arcane';
  const ability = classDef?.keyAbility?.length === 1 ? classDef.keyAbility[0] : 'cha';

  let focusEntry = actor.items?.find((i) => i.type === 'spellcastingEntry' && i.system?.prepared?.value === 'focus');
  if (!focusEntry) {
    const created = await actor.createEmbeddedDocuments('Item', [{
      name: `${capitalize(plan.classSlug)} Focus Spells`,
      type: 'spellcastingEntry',
      system: {
        tradition: { value: tradition },
        prepared: { value: 'focus' },
        ability: { value: ability },
        proficiency: { value: 1 },
      },
    }]);
    focusEntry = created[0];
  }

  for (const spell of focusSpells) {
    const existing = actor.items?.find((i) => i.type === 'spell' && (i.sourceId ?? i.flags?.core?.sourceId) === spell.uuid);
    if (existing) continue;
    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: focusEntry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);
  }

  const currentMax = actor.system?.resources?.focus?.max ?? 0;
  const currentValue = actor.system?.resources?.focus?.value ?? 0;
  const newMax = Math.min(3, currentMax + focusSpells.length);
  const newValue = Math.max(currentValue, newMax);
  if (newMax > currentMax || newValue > currentValue) {
    await actor.update({ 'system.resources.focus.max': newMax, 'system.resources.focus.value': newValue });
  }
}

async function resolveFeat(uuid) {
  try {
    return await fromUuid(uuid);
  } catch (err) {
    warn(`Failed to resolve feat UUID: ${uuid}`);
    return null;
  }
}

function prepareForCreation(item, featEntry, group, level) {
  const data = foundry.utils.deepClone(item.toObject());
  data.system.location = `${group}-${level}`;
  data.system.level = { ...data.system.level, taken: level };
  const choiceEntries = Object.entries(featEntry?.choices ?? {}).filter(([, value]) => ['string', 'number'].includes(typeof value));
  if (choiceEntries.length > 0) {
    data.flags ??= {};
    data.flags.pf2e ??= {};
    data.flags.pf2e.rulesSelections = Object.fromEntries(choiceEntries.map(([key, value]) => [key, String(value)]));
  }
  return data;
}

function getActorFeatSources(actor) {
  const items = Array.isArray(actor?.items)
    ? actor.items
    : Array.isArray(actor?.items?.contents)
      ? actor.items.contents
      : [];

  return new Set(
    items
      .map((item) => getItemSourceId(item))
      .filter(Boolean),
  );
}

function getItemSourceId(item) {
  return item?.sourceId
    ?? item?.flags?.core?.sourceId
    ?? item?._stats?.compendiumSource
    ?? null;
}

async function collectGrantedFeatSources(items) {
  const grantedSources = new Set();
  const visited = new Set();

  for (const item of items) {
    await collectGrantedFeatSourcesFromItem(item, grantedSources, visited);
  }

  return grantedSources;
}

async function collectGrantedFeatSourcesFromItem(item, grantedSources, visited) {
  const itemKey = getItemSourceId(item);
  if (itemKey && visited.has(itemKey)) return;
  if (itemKey) visited.add(itemKey);

  for (const rule of item?.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
    const grantedUuid = resolveGrantRuleUuid(rule.uuid, item?.flags?.pf2e?.rulesSelections ?? {});
    if (!grantedUuid) continue;

    const granted = await resolveFeat(grantedUuid);
    if (!granted) continue;

    const grantedSourceId = getItemSourceId(granted);
    if (grantedSourceId) grantedSources.add(grantedSourceId);

    const grantedData = typeof granted.toObject === 'function' ? granted.toObject() : granted;
    await collectGrantedFeatSourcesFromItem(grantedData, grantedSources, visited);
  }
}

function resolveGrantRuleUuid(uuid, selections) {
  const raw = String(uuid ?? '').trim();
  if (!raw) return null;
  if (!raw.includes('{item|flags.')) return raw;

  const resolved = raw.replace(/\{item\|flags\.(?:pf2e|system)\.rulesSelections\.([^}]+)\}/g, (_match, flag) => {
    const value = selections?.[flag];
    return typeof value === 'string' ? value : '';
  });

  return resolved.includes('{item|') ? null : resolved;
}
