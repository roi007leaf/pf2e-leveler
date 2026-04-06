import { ANCESTRAL_PARAGON_FEAT_LEVELS } from '../classes/progression.js';
import { ClassRegistry } from '../classes/registry.js';
import { capitalize, getCampaignFeatSectionIds, isAncestralParagonEnabled } from '../utils/pf2e-api.js';
import { debug, warn } from '../utils/logger.js';

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

export async function applyFeats(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData) return [];

  const itemsToCreate = [];

  for (const key of FEAT_KEYS) {
    const feats = levelData[key];
    if (!feats?.length) continue;

    const group = getFeatGroup(key, level);
    for (const featEntry of feats) {
      const item = await resolveFeat(featEntry.uuid);
      if (!item) continue;

      const featData = prepareForCreation(item, group, level);
      itemsToCreate.push(featData);
    }
  }

  if (itemsToCreate.length === 0) return [];

  const created = await actor.createEmbeddedDocuments('Item', itemsToCreate);
  debug(`Applied ${created.length} feats at level ${level}`);

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

async function applyFocusSpellsFromFeats(actor, plan, featDatas) {
  const focusSpells = [];

  for (const featData of featDatas) {
    const rules = featData.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || typeof rule.uuid !== 'string') continue;
      if (!rule.uuid.includes('spells-srd')) continue;
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
      const re1 = /@UUID\[Compendium\.pf2e\.spells-srd\.Item\.([^\]]+)\]/g;
      const re2 = /data-uuid="(Compendium\.pf2e\.spells-srd\.Item\.[^"]+)"/g;
      const descUuids = new Set();
      let m;
      while ((m = re1.exec(html)) !== null) descUuids.add(`Compendium.pf2e.spells-srd.Item.${m[1]}`);
      while ((m = re2.exec(html)) !== null) descUuids.add(m[1]);
      for (const uuid of descUuids) {
        if (focusSpells.some((s) => s.uuid === uuid)) continue;
        const spell = await fromUuid(uuid).catch(() => null);
        if (spell && isFocusLikeSpell(spell)) focusSpells.push(spell);
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
    debug('Created focus spellcasting entry from feat');
  }

  for (const spell of focusSpells) {
    const existing = actor.items?.find((i) => i.type === 'spell' && (i.sourceId ?? i.flags?.core?.sourceId) === spell.uuid);
    if (existing) continue;
    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: focusEntry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);
    debug(`Added focus spell from feat: ${spell.name}`);
  }

  const currentMax = actor.system?.resources?.focus?.max ?? 0;
  const currentValue = actor.system?.resources?.focus?.value ?? 0;
  const newMax = Math.min(3, currentMax + focusSpells.length);
  const newValue = Math.max(currentValue, newMax);
  if (newMax > currentMax || newValue > currentValue) {
    await actor.update({ 'system.resources.focus.max': newMax, 'system.resources.focus.value': newValue });
    debug(`Updated focus pool: ${currentMax}/${currentValue} -> ${newMax}/${newValue}`);
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

function prepareForCreation(item, group, level) {
  const data = foundry.utils.deepClone(item.toObject());
  data.system.location = `${group}-${level}`;
  data.system.level = { ...data.system.level, taken: level };
  return data;
}
