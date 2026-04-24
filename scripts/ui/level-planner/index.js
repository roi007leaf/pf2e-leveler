import { MODULE_ID, MIN_PLAN_LEVEL, MAX_LEVEL, PLAN_STATUS, PERMANENT_ITEM_TYPES, SKILLS } from '../../constants.js';
import { ensureActorClassRegistered, ensureClassItemRegistered, ensureClassRegistry } from '../../classes/ensure.js';
import { ClassRegistry } from '../../classes/registry.js';
import { getChoicesForLevel, getGradualBoostGroupLevels, getLevelSummary } from '../../classes/progression.js';
import {
  createPlan,
  getLevelData,
  setLevelBoosts,
  setLevelFeat,
  setLevelSkillIncrease,
  toggleLevelIntBonusSkill,
  toggleLevelIntBonusLanguage,
  addLevelSpell,
  addLevelReminder,
  clearLevelReminders,
  resetLevelData,
  addLevelCustomFeat,
  removeLevelCustomFeat,
  addLevelCustomSkillIncrease,
  removeLevelCustomSkillIncrease,
  addLevelCustomSpell,
  removeLevelCustomSpell,
  addLevelCustomSpellEntry,
  removeLevelCustomSpellEntry,
  setLevelEquipmentSlot,
  clearLevelEquipmentSlot,
  addLevelCustomEquipment,
  removeLevelCustomEquipment,
  removeLevelSpell,
  upsertLevelFeatGrant,
} from '../../plan/plan-model.js';
import { getSpellbookBonusCantripSelectionCount } from '../../plan/spellbook-feats.js';
import { buildFeatGrantRequirements } from '../../plan/feat-grants.js';
import { getPlan, savePlan, clearPlan, exportPlan, importPlan } from '../../plan/plan-store.js';
import { validateLevel } from '../../plan/plan-validator.js';
import { computeBuildState } from '../../plan/build-state.js';
import { promptApplyPlan } from '../../apply/apply-manager.js';
import { isFreeArchetypeEnabled, isMythicEnabled, isABPEnabled, isGradualBoostsEnabled, isDualClassEnabled, isAncestralParagonEnabled } from '../../utils/pf2e-api.js';
import { getDedicationAliasesFromDescription } from '../../utils/feat-aliases.js';
import { extractFeatSpellcastingMetadata, FEAT_SPELLCASTING_METADATA_VERSION } from '../../utils/spellcasting-support.js';
import { localize } from '../../utils/i18n.js';
import { debug } from '../../utils/logger.js';
import { FeatPicker } from '../feat-picker.js';
import { captureScrollState, restoreScrollState } from '../shared/scroll-state.js';
import { loadFeats } from '../../feats/feat-cache.js';
import { getCreationData } from '../../creation/creation-store.js';
import {
  doesFeatMatchRequiredSecondLevelClassFeat,
  getRequiredSecondLevelClassFeatForActor,
} from '../../classes/class-archetype-requirements.js';
import {
  buildAttributeContext,
  buildIntBonusLanguageContext,
  buildIntBonusSkillContext,
  buildIntelligenceBenefitContext,
  buildSkillContext,
  getAvailableLanguages,
  getPlannedLanguagesBeforeLevel,
  localizeLanguageLabel,
} from './context.js';
import {
  annotateFeat,
  buildABPContext,
  buildLoreSkillIncreaseEntry,
  buildLevelContext,
  extractFeat,
  getClassFeaturesForLevel,
} from './level-context.js';
import { activateLevelPlannerListeners } from './listeners.js';
import {
  buildSpellContext,
  buildCustomSpellEntryOptions,
  buildSpellSlotDisplay,
  detectNewSpellRank,
  findFeatLevel,
  getDedicationSelectionLimitsForPlanner,
  getActorSpellCounts,
  getFocusSpellsForLevel,
  getGrantedSpellsForLevel,
  getHighestRank,
  getSubclassSlug,
  ordinalRank,
  resolveSpellTradition,
  shouldExcludeOwnedSpellIdentityForPlanner,
} from './spells.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const FEAT_PLAN_CATEGORIES = new Set(['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats']);
const FEAT_SKILL_RULES_VERSION = 3;
const FEAT_ALIASES_VERSION = 1;
const FEAT_SPELLCASTING_VERSION = FEAT_SPELLCASTING_METADATA_VERSION;
const INVESTIGATOR_SKILLFUL_LESSON_BASE_SKILLS = [
  'arcana',
  'crafting',
  'occultism',
  'society',
  'medicine',
  'nature',
  'religion',
  'survival',
  'deception',
  'diplomacy',
  'intimidation',
  'performance',
];
const LOCATION_TO_PLAN_CATEGORY = {
  class: 'classFeats',
  skill: 'skillFeats',
  general: 'generalFeats',
  ancestry: 'ancestryFeats',
  ancestryparagon: 'ancestryFeats',
  xdy_ancestryparagon: 'ancestryFeats',
  archetype: 'archetypeFeats',
  mythic: 'mythicFeats',
  xdy_dualclass: 'dualClassFeats',
  dualclass: 'dualClassFeats',
  dual_class: 'dualClassFeats',
};

function extractDirectFeatSkillRules(feat) {
  const result = [];
  for (const rule of feat.system?.rules ?? []) {
    if (rule.key !== 'ActiveEffectLike') continue;
    const path = rule.path;
    if (typeof path !== 'string') continue;
    const match = path.match(/^system\.skills\.([^.]+)\.rank$/);
    if (!match) continue;
    const value = rule.value;
    result.push({ skill: match[1], value, predicate: rule.predicate ?? null });
  }
  return result;
}

function extractTextualFeatSkillRules(feat) {
  const description = String(feat?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!description) return [];

  const rules = [];
  const conditionalUpgradePattern = /become trained in ([^.;]+?); if you were already trained, you become an expert instead\.?/gi;
  const genericTrainedPattern = /\b(?:you\s+)?become trained in ([^.;]+?)(?:;|\.|,?\s+and\b|$)/gi;

  for (const match of description.matchAll(conditionalUpgradePattern)) {
    const skills = resolveSkillSlugsFromText(match[1]);
    for (const skill of skills) {
      rules.push({
        skill,
        value: 1,
        valueIfAlreadyTrained: 2,
        predicate: null,
      });
    }
  }

  for (const match of description.matchAll(genericTrainedPattern)) {
    const clause = String(match[1] ?? '');
    if (!clause || /order'?s?\s+associated\s+skill/i.test(clause)) {
      const explicitPart = clause.replace(/\band\s+your\s+order'?s?\s+associated\s+skill\b/gi, '').trim();
      if (!explicitPart) continue;
      const skills = resolveSkillSlugsFromText(explicitPart);
      for (const skill of skills) {
        rules.push({
          skill,
          value: 1,
          predicate: null,
        });
      }
      continue;
    }

    const skills = resolveSkillSlugsFromText(clause);
    for (const skill of skills) {
      rules.push({
        skill,
        value: 1,
        predicate: null,
      });
    }
  }

  return rules;
}

function resolveSkillSlugsFromText(text) {
  const lookup = getSkillTextLookup();
  const normalized = String(text ?? '')
    .replace(/\b(?:the|a|an)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const segments = normalized
    .split(/\s*(?:,| and )\s*/i)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const skills = [];
  for (const segment of segments) {
    const skill = lookup.get(normalizeSkillText(segment));
    if (skill) skills.push(skill);
  }

  return [...new Set(skills)];
}

function getSkillTextLookup() {
  const skills = globalThis.CONFIG?.PF2E?.skills ?? {};
  const lookup = new Map();
  const aliases = {
    acr: 'acrobatics',
    arc: 'arcana',
    ath: 'athletics',
    cra: 'crafting',
    dec: 'deception',
    dip: 'diplomacy',
    itm: 'intimidation',
    med: 'medicine',
    nat: 'nature',
    occ: 'occultism',
    prf: 'performance',
    rel: 'religion',
    soc: 'society',
    ste: 'stealth',
    sur: 'survival',
    thi: 'thievery',
  };

  for (const [key, rawEntry] of Object.entries(skills)) {
    const canonical = aliases[key] ?? key;
    const rawLabel = typeof rawEntry === 'string' ? rawEntry : (rawEntry?.label ?? key);
    const localized = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
    for (const candidate of [key, canonical, rawLabel, localized]) {
      const normalized = normalizeSkillText(candidate);
      if (normalized) lookup.set(normalized, canonical);
    }
  }

  for (const [alias, canonical] of Object.entries(aliases)) {
    lookup.set(normalizeSkillText(alias), canonical);
    lookup.set(normalizeSkillText(canonical), canonical);
  }

  return lookup;
}

function normalizeSkillText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^pf2e\.skill/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function isArchetypeLikeFeat(feat) {
  const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).trim().toLowerCase());
  if (traits.includes('archetype') || traits.includes('dedication')) return true;

  const slug = String(feat?.slug ?? '').trim().toLowerCase();
  const name = String(feat?.name ?? '').trim().toLowerCase();
  if (slug.includes('dedication') || /\bdedication\b/.test(name)) return true;

  return getDedicationAliasesFromDescription(feat).length > 0;
}

export async function extractFeatSkillRules(feat, documentResolver = fromUuid, visited = new Set()) {
  if (!feat) return [];

  const featId = feat.uuid ?? feat.slug ?? feat.name ?? null;
  if (featId && visited.has(featId)) return [];
  if (featId) visited.add(featId);

  const results = mergeFeatSkillRules(
    extractDirectFeatSkillRules(feat),
    extractTextualFeatSkillRules(feat),
  );

  for (const rule of feat.system?.rules ?? []) {
    if (rule?.key !== 'GrantItem' || typeof rule.uuid !== 'string' || !documentResolver) continue;

    try {
      const granted = await documentResolver(rule.uuid);
      if (!granted) continue;
      const nestedRules = await extractFeatSkillRules(granted, documentResolver, visited);
      for (const nested of nestedRules) {
        if (results.some((entry) => entry.skill === nested.skill && entry.value === nested.value && JSON.stringify(entry.predicate ?? null) === JSON.stringify(nested.predicate ?? null))) continue;
        results.push(nested);
      }
    } catch {
      continue;
    }
  }

  return results;
}

function mergeFeatSkillRules(baseRules, textRules) {
  const results = [...(baseRules ?? [])];

  for (const textRule of (textRules ?? [])) {
    const index = results.findIndex((entry) =>
      entry.skill === textRule.skill
      && JSON.stringify(entry.predicate ?? null) === JSON.stringify(textRule.predicate ?? null));

    if (index >= 0) {
      results[index] = { ...results[index], ...textRule };
    } else {
      results.push(textRule);
    }
  }

  return results;
}

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

function buildClassStateForSlug(classSlug) {
  const classDef = ClassRegistry.get(classSlug);
  return {
    slug: classSlug ?? classDef?.slug ?? null,
    hp: classDef?.hp ?? null,
    keyAbility: classDef?.keyAbility ?? [],
    subclassType: null,
  };
}

export class LevelPlanner extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super();
    ensureClassRegistry();
    ensureActorClassRegistered(actor);
    this.actor = actor;
    this._compendiumCache = {};
    this._customPlanOpenLevels = new Set();
    this._isImportingPlan = false;
    this.plan = this._loadOrCreatePlan(actor);
    const actorLevel = actor.system?.details?.level?.value ?? 1;

    if (options.sequentialMode && actorLevel > 1 && this.plan) {
      this.plan.sequentialMode = { active: true, targetLevel: actorLevel, currentLevel: MIN_PLAN_LEVEL };
      savePlan(this.actor, this.plan);
    }

    const seq = this.plan?.sequentialMode;
    if (seq?.active) {
      this.selectedLevel = seq.currentLevel;
    } else {
      this.selectedLevel = Math.max(actorLevel, MIN_PLAN_LEVEL);
    }
  }

  _loadOrCreatePlan(actor) {
    const existing = getPlan(actor);
    if (!existing) return this._createPlanFromActor(actor);

    const classSlug = this._resolveClassSlug(actor);
    if (existing.classSlug !== classSlug) return this._createPlanFromActor(actor);

    // Deep clone so this.plan is always mutable — actor flags are frozen in Foundry v12
    const plan = foundry.utils.deepClone(existing);
    this._migratePlan(plan, classSlug);
    return plan;
  }

  _migratePlan(plan, classSlug) {
    const classDef = ClassRegistry.get(classSlug);
    if (!classDef) return;

    const options = this._getVariantOptions();
    const actorLevel = Number(this.actor?.system?.details?.level?.value ?? 1);
    let changed = false;

    if (!Object.hasOwn(plan, 'dualClassSlug')) {
      plan.dualClassSlug = null;
      changed = true;
    }
    const inferredDualClassSlug = this._inferStoredDualClassSlug(this.actor, classSlug);
    if (!plan.dualClassSlug && inferredDualClassSlug) {
      plan.dualClassSlug = inferredDualClassSlug;
      changed = true;
    }

    // Migrate per-level apparitions (old format) to plan-level cumulative list
    if (!plan.apparitions && classDef.apparitions) {
      const merged = [];
      for (const levelData of Object.values(plan.levels)) {
        for (const slug of (levelData.apparitions ?? [])) {
          if (!merged.includes(slug)) merged.push(slug);
        }
      }
      plan.apparitions = merged;
      for (const levelData of Object.values(plan.levels)) {
        delete levelData.apparitions;
      }
      changed = true;
    }

    for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
      const choices = getChoicesForLevel(classDef, level, options);
      if (choices.length === 0 && !plan.levels[level]) continue;

      if (!plan.levels[level]) {
        plan.levels[level] = {};
        changed = true;
      }

      for (const key of ['customFeats', 'customSkillIncreases', 'customSpells', 'customSpellEntries']) {
        if (!Array.isArray(plan.levels[level][key])) {
          plan.levels[level][key] = [];
          changed = true;
        }
      }

      for (const choice of choices) {
        if (choice.type === 'spells' && !plan.levels[level].spells) {
          plan.levels[level].spells = [];
          changed = true;
        }
        if (choice.type === 'abilityBoosts' && !plan.levels[level].abilityBoosts) {
          plan.levels[level].abilityBoosts = [];
          changed = true;
        }
        if (choice.type === 'abilityBoosts' && !plan.levels[level].intBonusSkills) {
          plan.levels[level].intBonusSkills = [];
          changed = true;
        }
        if (choice.type === 'abilityBoosts' && !plan.levels[level].intBonusLanguages) {
          plan.levels[level].intBonusLanguages = [];
          changed = true;
        }
      }
    }

    if (this._shouldClearImportedFromActor(plan, actorLevel)) {
      delete plan.importedFromActor;
      changed = true;
    } else if (this._shouldMarkPlanAsImportedFromActor(plan, classDef, actorLevel)) {
      plan.importedFromActor = {
        actorLevel,
        hideHistoricalSkillIncreases: true,
      };
      changed = true;
    }

    if (this._backfillMissingBoostsFromActor(plan, options)) {
      changed = true;
    }

    if (changed) savePlan(this.actor, plan);

    // Flag if any stored feats are missing skillRules (pre-1.3.5 plans)
    const SKILL_RULES_FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
    outer: for (const levelData of Object.values(plan.levels)) {
      for (const key of SKILL_RULES_FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.skillRulesResolved !== true || feat.skillRulesVersion !== FEAT_SKILL_RULES_VERSION) {
            this._needsSkillRulesBackfill = true;
            break outer;
          }
        }
      }
    }

    // Flag if any stored feats are missing alias resolution.
    outerAliases: for (const levelData of Object.values(plan.levels)) {
      for (const key of SKILL_RULES_FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.aliasesResolved !== true || feat.aliasesVersion !== FEAT_ALIASES_VERSION) {
            this._needsFeatAliasesBackfill = true;
            break outerAliases;
          }
        }
      }
    }

    outerSpellcasting: for (const levelData of Object.values(plan.levels)) {
      for (const key of SKILL_RULES_FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.spellcastingMetadataVersion !== FEAT_SPELLCASTING_VERSION) {
            this._needsSpellcastingMetadataBackfill = true;
            break outerSpellcasting;
          }
        }
      }
    }
  }

  async _backfillFeatSkillRules() {
    const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
    for (const levelData of Object.values(this.plan.levels ?? {})) {
      for (const key of FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.skillRulesResolved === true && feat.skillRulesVersion === FEAT_SKILL_RULES_VERSION) continue;
          if (!feat.uuid) {
            feat.skillRules = [];
            feat.skillRulesResolved = true;
            feat.skillRulesVersion = FEAT_SKILL_RULES_VERSION;
            continue;
          }
          try {
            const doc = await fromUuid(feat.uuid);
            feat.skillRules = doc ? await extractFeatSkillRules(doc) : [];
          } catch {
            feat.skillRules = [];
          }
          feat.skillRulesResolved = true;
          feat.skillRulesVersion = FEAT_SKILL_RULES_VERSION;
        }
      }
    }
    await savePlan(this.actor, this.plan);
  }

  async _backfillFeatAliases() {
    const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
    for (const levelData of Object.values(this.plan.levels ?? {})) {
      for (const key of FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.aliasesResolved === true && feat.aliasesVersion === FEAT_ALIASES_VERSION) continue;
          if (!feat.uuid) {
            feat.aliases = [];
            feat.aliasesResolved = true;
            feat.aliasesVersion = FEAT_ALIASES_VERSION;
            continue;
          }
          try {
            const doc = await fromUuid(feat.uuid);
            feat.aliases = doc ? getDedicationAliasesFromDescription(doc) : [];
          } catch {
            feat.aliases = [];
          }
          feat.aliasesResolved = true;
          feat.aliasesVersion = FEAT_ALIASES_VERSION;
        }
      }
    }
    await savePlan(this.actor, this.plan);
  }

  async _backfillFeatSpellcastingMetadata() {
    const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];
    for (const levelData of Object.values(this.plan.levels ?? {})) {
      for (const key of FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.spellcastingMetadataVersion === FEAT_SPELLCASTING_VERSION) continue;
          if (!feat.uuid) {
            feat.spellcastingMetadata = null;
            feat.spellcastingMetadataVersion = FEAT_SPELLCASTING_VERSION;
            continue;
          }
          try {
            const doc = await fromUuid(feat.uuid);
            feat.spellcastingMetadata = doc ? extractFeatSpellcastingMetadata({
              ...doc,
              aliases: Array.isArray(feat.aliases) ? feat.aliases : [],
            }) : null;
          } catch {
            feat.spellcastingMetadata = null;
          }
          feat.spellcastingMetadataVersion = FEAT_SPELLCASTING_VERSION;
        }
      }
    }
    await savePlan(this.actor, this.plan);
  }

  _createPlanFromActor(actor) {
    const classSlug = this._resolveClassSlug(actor);
    if (!classSlug) return null;

    const options = {
      ...this._getVariantOptions(),
      dualClassSlug: this._inferStoredDualClassSlug(actor, classSlug),
    };
    const plan = createPlan(classSlug, options);
    const actorLevel = Number(actor?.system?.details?.level?.value ?? 1);
    if (actorLevel > 1) {
      plan.importedFromActor = {
        actorLevel,
        hideHistoricalSkillIncreases: true,
      };
    }
    this._seedPlanFromActor(actor, plan, options);
    savePlan(actor, plan);
    debug(`Auto-created plan for ${actor.name} (${classSlug})`);
    return plan;
  }

  _inferStoredDualClassSlug(actor, primaryClassSlug = null) {
    const primarySlug = String(primaryClassSlug ?? '').trim().toLowerCase();
    const trackedSlug = this._getTrackedPlanDualClassSlug(actor, primarySlug);
    if (trackedSlug) return trackedSlug;
    const storedSlug = this._getStoredDualClassSlug(actor, primarySlug);
    if (storedSlug) return storedSlug;
    return this._inferActorDualClassSlug(actor, primarySlug);
  }

  _getTrackedPlanDualClassSlug(actor, primaryClassSlug) {
    const dualClassSlug = String(this.plan?.dualClassSlug ?? '').trim().toLowerCase();
    if (!dualClassSlug || dualClassSlug === primaryClassSlug) return null;
    if (!ClassRegistry.has(dualClassSlug)) {
      const matchingClassItem = this._getActorClassItems(actor)
        .find((item) => String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase() === dualClassSlug);
      if (!matchingClassItem) return null;
      ensureClassItemRegistered(matchingClassItem, dualClassSlug);
    }
    return ClassRegistry.has(dualClassSlug) ? dualClassSlug : null;
  }

  _getStoredDualClassSlug(actor, primaryClassSlug) {
    if (!actor || typeof actor.getFlag !== 'function') return null;
    const dualClassSlug = String(getCreationData(actor)?.dualClass?.slug ?? '').trim().toLowerCase();
    if (!dualClassSlug || dualClassSlug === primaryClassSlug) return null;
    if (!ClassRegistry.has(dualClassSlug)) {
      const matchingClassItem = this._getActorClassItems(actor)
        .find((item) => String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase() === dualClassSlug);
      if (!matchingClassItem) return null;
      ensureClassItemRegistered(matchingClassItem, dualClassSlug);
    }
    return ClassRegistry.has(dualClassSlug) ? dualClassSlug : null;
  }

  _inferActorDualClassSlug(actor, primaryClassSlug) {
    const secondaryClassItem = this._getActorClassItems(actor)
      .find((item) => {
        const slug = String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase();
        return slug && slug !== primaryClassSlug;
      });
    if (!secondaryClassItem) return null;

    const dualClassSlug = String(secondaryClassItem?.slug ?? secondaryClassItem?.system?.slug ?? '').trim().toLowerCase();
    if (!dualClassSlug) return null;
    ensureClassItemRegistered(secondaryClassItem, dualClassSlug);
    return ClassRegistry.has(dualClassSlug) ? dualClassSlug : null;
  }

  _getActorClassItems(actor) {
    const items = actor?.items;
    if (Array.isArray(items)) {
      return items.filter((item) => item?.type === 'class');
    }
    if (typeof items?.filter === 'function') {
      return items.filter((item) => item?.type === 'class');
    }
    return [];
  }

  _ensureResolvedDualClassSlug() {
    if (!this.plan) return null;
    const currentSlug = String(this.plan.dualClassSlug ?? '').trim().toLowerCase() || null;
    const resolvedSlug = this._inferStoredDualClassSlug(this.actor, this.plan.classSlug);
    if (resolvedSlug !== currentSlug) {
      this.plan.dualClassSlug = resolvedSlug;
      void savePlan(this.actor, this.plan);
    }
    return resolvedSlug;
  }

  _seedPlanFromActor(actor, plan, options) {
    this._seedPlanBoostsFromActor(actor, plan);
    this._seedPlanFeatsFromActor(actor, plan, options);
  }

  _seedPlanBoostsFromActor(actor, plan) {
    const actorBoosts = actor?.system?.build?.attributes?.boosts ?? {};

    for (const [levelKey, boosts] of Object.entries(actorBoosts)) {
      const level = Number(levelKey);
      if (!Number.isInteger(level) || level < MIN_PLAN_LEVEL || level > MAX_LEVEL) continue;
      if (!Array.isArray(plan?.levels?.[level]?.abilityBoosts)) continue;
      const normalizedBoosts = normalizeActorBoostEntries(boosts);
      if (normalizedBoosts.length === 0) continue;

      const normalized = [...new Set(normalizedBoosts.filter((boost) =>
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(normalizeAbilityBoostKey(boost)),
      ))];
      if (normalized.length > 0) setLevelBoosts(plan, level, normalized);
    }
  }

  _backfillMissingBoostsFromActor(plan, options = this._getVariantOptions()) {
    const actorBoosts = this.actor?.system?.build?.attributes?.boosts ?? {};
    const classDef = ClassRegistry.get(plan?.classSlug ?? this.plan?.classSlug);
    let changed = false;

    for (const [levelKey, boosts] of Object.entries(actorBoosts)) {
      const level = Number(levelKey);
      if (!Number.isInteger(level) || level < MIN_PLAN_LEVEL || level > MAX_LEVEL) continue;
      if (classDef) {
        const boostChoice = getChoicesForLevel(classDef, level, options).find((choice) => choice.type === 'abilityBoosts');
        if (options.gradualBoosts && boostChoice?.count === 1) continue;
      }

      const plannedBoosts = plan?.levels?.[level]?.abilityBoosts;
      if (!Array.isArray(plannedBoosts) || plannedBoosts.length > 0) continue;

      const normalizedBoosts = normalizeActorBoostEntries(boosts);
      if (normalizedBoosts.length === 0) continue;

      const normalized = [...new Set(normalizedBoosts.filter((boost) =>
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(normalizeAbilityBoostKey(boost)),
      ))];
      if (normalized.length === 0) continue;

      setLevelBoosts(plan, level, normalized);
      changed = true;
    }

    return changed;
  }

  _shouldMarkPlanAsImportedFromActor(plan, classDef, actorLevel) {
    if (plan?.importedFromActor?.hideHistoricalSkillIncreases === true) return false;
    if (!classDef || actorLevel <= 1) return false;
    if (this._hasPlannedSelectionsBeyondActorLevel(plan, actorLevel)) return false;

    const pastSkillIncreaseLevels = classDef.skillIncreaseSchedule
      .filter((level) => level >= MIN_PLAN_LEVEL && level <= actorLevel);
    if (pastSkillIncreaseLevels.length === 0) return false;

    return pastSkillIncreaseLevels.every((level) => {
      const increases = plan?.levels?.[level]?.skillIncreases;
      return !Array.isArray(increases) || increases.length === 0;
    });
  }

  _shouldClearImportedFromActor(plan, actorLevel) {
    if (plan?.importedFromActor?.hideHistoricalSkillIncreases !== true) return false;
    return this._hasPlannedSelectionsBeyondActorLevel(plan, actorLevel);
  }

  _hasPlannedSelectionsBeyondActorLevel(plan, actorLevel) {
    for (let level = actorLevel + 1; level <= MAX_LEVEL; level++) {
      const levelData = plan?.levels?.[level];
      if (!levelData) continue;
      if (levelHasSelections(levelData)) return true;
    }
    return false;
  }

  _seedPlanFeatsFromActor(actor, plan, options) {
    const actorLevel = Number(actor?.system?.details?.level?.value ?? 1);
    const actorItems = actor?.items?.contents
      ?? (Array.isArray(actor?.items) ? actor.items : []);
    const actorFeats = actorItems
      .filter((item) => item?.type === 'feat' && String(item?.system?.category ?? '').toLowerCase() !== 'classfeature')
      .sort((a, b) => this._getActorFeatTakenLevel(a) - this._getActorFeatTakenLevel(b));

    for (const feat of actorFeats) {
      const placement = this._getActorFeatPlanPlacement(feat, plan, options, actorLevel);
      if (!placement) continue;
      const { level, category } = placement;
      if (!plan.levels[level] || !FEAT_PLAN_CATEGORIES.has(category)) continue;
      if ((plan.levels[level][category] ?? []).length > 0) continue;

      setLevelFeat(plan, level, category, {
        uuid: feat.sourceId ?? feat.flags?.core?.sourceId ?? feat.uuid,
        name: feat.name,
        slug: feat.slug ?? feat.uuid ?? null,
        img: feat.img ?? null,
        level: feat.system?.level?.value ?? null,
        traits: [...(feat.system?.traits?.value ?? [])],
        choices: { ...(feat.flags?.pf2e?.rulesSelections ?? {}) },
        aliases: getDedicationAliasesFromDescription(feat),
        aliasesResolved: true,
        aliasesVersion: FEAT_ALIASES_VERSION,
        spellcastingMetadata: extractFeatSpellcastingMetadata(feat),
        spellcastingMetadataVersion: FEAT_SPELLCASTING_VERSION,
        skillRules: extractDirectFeatSkillRules(feat),
        skillRulesResolved: false,
        skillRulesVersion: 0,
      });
    }
  }

  _getActorFeatPlanPlacement(feat, plan, options, actorLevel) {
    const fromLocation = this._getActorFeatPlacementFromLocation(feat, plan, options, actorLevel);
    if (fromLocation) return fromLocation;

    const takenLevel = this._getActorFeatTakenLevel(feat);
    if (!Number.isInteger(takenLevel) || takenLevel < MIN_PLAN_LEVEL || takenLevel > actorLevel) return null;

    const category = this._inferActorFeatPlanCategory(feat, takenLevel, plan, options);
    if (!category || !Array.isArray(plan?.levels?.[takenLevel]?.[category])) return null;

    return { level: takenLevel, category };
  }

  _getActorFeatPlacementFromLocation(feat, plan, options, actorLevel) {
    const rawLocation = feat?.system?.location?.value ?? feat?.system?.location ?? '';
    const match = String(rawLocation ?? '').match(/^([a-zA-Z_]+)-(\d+)$/);
    if (!match) return null;

    const [, rawGroup, levelText] = match;
    const level = Number(levelText);
    if (!Number.isInteger(level) || level < MIN_PLAN_LEVEL || level > actorLevel) return null;

    const group = rawGroup.replace(/[^a-z_]/gi, '').toLowerCase();
    if (
      options?.freeArchetype
      && group === 'class'
      && Array.isArray(plan?.levels?.[level]?.archetypeFeats)
      && isArchetypeLikeFeat(feat)
    ) {
      return { level, category: 'archetypeFeats' };
    }

    const category = LOCATION_TO_PLAN_CATEGORY[group] ?? null;
    if (!category || !Array.isArray(plan?.levels?.[level]?.[category])) return null;

    return { level, category };
  }

  _getActorFeatTakenLevel(feat) {
    const takenLevel = Number(feat?.system?.level?.taken ?? NaN);
    if (Number.isInteger(takenLevel)) return takenLevel;

    const rawLocation = feat?.system?.location?.value ?? feat?.system?.location ?? '';
    const match = String(rawLocation ?? '').match(/-(\d+)$/);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
  }

  _inferActorFeatPlanCategory(feat, takenLevel, plan, options) {
    const category = String(feat?.system?.category?.value ?? feat?.system?.category ?? '').toLowerCase();
    const levelData = plan?.levels?.[takenLevel] ?? {};
    const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());

    if (traits.includes('mythic') && Array.isArray(levelData.mythicFeats)) return 'mythicFeats';
    if (isArchetypeLikeFeat(feat) && Array.isArray(levelData.archetypeFeats) && options.freeArchetype) {
      return 'archetypeFeats';
    }
    if (category === 'ancestry' && Array.isArray(levelData.ancestryFeats)) return 'ancestryFeats';
    if (category === 'skill' && Array.isArray(levelData.skillFeats)) return 'skillFeats';
    if (category === 'general' && Array.isArray(levelData.generalFeats)) return 'generalFeats';
    if (category === 'class' && Array.isArray(levelData.classFeats)) return 'classFeats';
    if (category === 'general' && traits.includes('skill') && Array.isArray(levelData.skillFeats)) return 'skillFeats';
    return null;
  }

  _resolveClassSlug(actor) {
    ensureClassRegistry();
    ensureActorClassRegistered(actor);
    const storedPrimarySlug = this._getStoredPrimaryClassSlug(actor);
    if (storedPrimarySlug) return storedPrimarySlug;
    const actorClass = actor.class;
    if (!actorClass) return null;

    const slug = actorClass.slug ?? null;
    if (ClassRegistry.has(slug)) return slug;
    return null;
  }

  _getStoredPrimaryClassSlug(actor) {
    if (!actor || typeof actor.getFlag !== 'function') return null;
    const creationData = getCreationData(actor);
    const primaryClassSlug = String(creationData?.class?.slug ?? '').trim().toLowerCase();
    if (!primaryClassSlug) return null;
    if (ClassRegistry.has(primaryClassSlug)) return primaryClassSlug;

    const matchingClassItem = this._getActorClassItems(actor)
      .find((item) => String(item?.slug ?? item?.system?.slug ?? '').trim().toLowerCase() === primaryClassSlug);
    if (!matchingClassItem) return null;
    ensureClassItemRegistered(matchingClassItem, primaryClassSlug);
    return ClassRegistry.has(primaryClassSlug) ? primaryClassSlug : null;
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-planner',
    classes: ['pf2e-leveler'],
    position: { width: 800, height: 650 },
    window: { resizable: true },
  };

  static PARTS = {
    planner: {
      template: `modules/${MODULE_ID}/templates/level-planner.hbs`,
    },
  };

  get title() {
    return `${this.actor.name} — ${localize('UI.OPEN_PLANNER')}`;
  }

  async _prepareContext() {
    if (this._needsSkillRulesBackfill) {
      this._needsSkillRulesBackfill = false;
      await this._backfillFeatSkillRules();
    }
    if (this._needsFeatAliasesBackfill) {
      this._needsFeatAliasesBackfill = false;
      await this._backfillFeatAliases();
    }
    if (this._needsSpellcastingMetadataBackfill) {
      this._needsSpellcastingMetadataBackfill = false;
      await this._backfillFeatSpellcastingMetadata();
    }
    this._buildStateCache = new Map();
    const options = this._getVariantOptions();
    const classDef = this.plan ? ClassRegistry.get(this.plan.classSlug) : null;
    const actorClassName = this.actor.class?.name ?? null;
    const unsupportedClass = actorClassName && !this.plan;

    const seq = this.plan?.sequentialMode;
    const isSequential = seq?.active === true;
    const validationOptions = this._getPlannerValidationOptions(options);
    const currentLevelStatus = isSequential && classDef
      ? validateLevel(this.plan, classDef, seq.currentLevel, validationOptions, this.actor).status
      : null;
    const sequentialLevelComplete = currentLevelStatus != null && currentLevelStatus !== PLAN_STATUS.INCOMPLETE;
    const isLastSequentialLevel = isSequential && seq.currentLevel >= seq.targetLevel;
    const resolvedDualClassSlug = this._ensureResolvedDualClassSlug();

    return {
      hasPlan: !!this.plan,
      isImportingPlan: this._isImportingPlan,
      unsupportedClass,
      actorClassName,
      selectedLevel: this.selectedLevel,
      dualClassEnabled: options.dualClass,
      dualClassOptions: this._buildDualClassOptions(),
      selectedDualClassSlug: resolvedDualClassSlug ?? '',
      sidebarLevels: this._buildSidebarLevels(classDef, options),
      availableClasses: ClassRegistry.getAll(),
      sequentialMode: isSequential,
      sequentialTargetLevel: seq?.targetLevel ?? 0,
      sequentialCurrentLevel: seq?.currentLevel ?? 0,
      showNextLevel: isSequential && sequentialLevelComplete && !isLastSequentialLevel,
      showFinishSequential: isSequential && sequentialLevelComplete && isLastSequentialLevel,
      ...(await this._buildLevelContext(classDef, options)),
    };
  }

  _onRender(_context, _options) {
    const html = this.element;
    this._restorePlannerScroll(html);
    this._activateListeners(html);
  }

  _getVariantOptions() {
    const ancestryParagonFeatLevels = this._getAncestryParagonFeatLevels();
    const dualClassSlug = String(this._ensureResolvedDualClassSlug() ?? '').trim().toLowerCase();
    return {
      freeArchetype: isFreeArchetypeEnabled(),
      mythic: isMythicEnabled(),
      abp: isABPEnabled(),
      gradualBoosts: isGradualBoostsEnabled(),
      dualClass: isDualClassEnabled(),
      dualClassDef: dualClassSlug && ClassRegistry.has(dualClassSlug) ? ClassRegistry.get(dualClassSlug) : null,
      ancestralParagon: isAncestralParagonEnabled(),
      ancestryParagonFeatLevels,
    };
  }

  _getAncestryParagonFeatLevels() {
    if (!this.plan) return [];
    const FEAT_KEYS = ['generalFeats', 'classFeats', 'skillFeats', 'ancestryFeats', 'archetypeFeats'];
    const levels = [];
    for (const [levelStr, levelData] of Object.entries(this.plan.levels ?? {})) {
      for (const key of FEAT_KEYS) {
        for (const feat of levelData[key] ?? []) {
          if (feat.slug === 'ancestry-paragon') {
            levels.push(Number(levelStr));
          }
        }
      }
    }
    return levels;
  }

  _buildSidebarLevels(classDef, options) {
    const levels = [];
    const validationOptions = this._getPlannerValidationOptions(options);
    const seq = this.plan?.sequentialMode;
    const isSequential = seq?.active === true;
    for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
      const summary = classDef ? getLevelSummary(classDef, level, options) : '';
      const status = this.plan && classDef
        ? validateLevel(this.plan, classDef, level, validationOptions, this.actor).status
        : PLAN_STATUS.EMPTY;

      const actorLevel = this.actor.system?.details?.level?.value ?? 1;
      levels.push({
        level,
        summary,
        status,
        active: level === this.selectedLevel,
        isCurrent: level === actorLevel,
        locked: isSequential && level !== seq.currentLevel,
      });
    }
    return levels;
  }

  async _buildLevelContext(classDef, options) {
    return buildLevelContext(this, classDef, options);
  }

  _getPlannerValidationOptions(options = {}) {
    return {
      ...options,
      skipHistoricalSkillIncreaseLevels: this._getHistoricalSkillIncreaseLevelsToHide(),
    };
  }

  _getHistoricalSkillIncreaseLevelsToHide() {
    const importedActorLevel = Number(this.plan?.importedFromActor?.actorLevel ?? 0);
    const shouldHide = this.plan?.importedFromActor?.hideHistoricalSkillIncreases === true;
    if (!shouldHide || importedActorLevel < MIN_PLAN_LEVEL) return new Set();

    const hidden = new Set();
    for (let level = MIN_PLAN_LEVEL; level <= importedActorLevel; level++) {
      hidden.add(level);
    }
    return hidden;
  }

  _shouldHideHistoricalSkillIncrease(level) {
    return this._getHistoricalSkillIncreaseLevelsToHide().has(level);
  }

  _buildAttributeContext(levelData, choices) {
    return buildAttributeContext(this, levelData, choices);
  }

  _buildIntelligenceBenefitContext(level) {
    return buildIntelligenceBenefitContext(this, level);
  }

  _buildIntBonusSkillContext(levelData, level) {
    return buildIntBonusSkillContext(this, levelData, level);
  }

  _buildIntBonusLanguageContext(levelData, level) {
    return buildIntBonusLanguageContext(this, levelData, level);
  }

  _getPlannedLanguagesBeforeLevel(level) {
    return getPlannedLanguagesBeforeLevel(this, level);
  }

  _getAvailableLanguages() {
    return getAvailableLanguages();
  }

  _localizeLanguageLabel(label) {
    return localizeLanguageLabel(label);
  }

  _buildSkillContext(levelData, level) {
    return buildSkillContext(this, levelData, level);
  }

  async _promptLoreSkillIncrease({ custom = false } = {}) {
    const loreSlug = await this._promptLoreSlug();
    if (!loreSlug) return;

    const seed = buildLoreSkillIncreaseEntry(loreSlug, 0);
    const currentRank = computeBuildState(this.actor, this.plan, this.selectedLevel).lores?.[seed.skill] ?? 0;
    const entry = buildLoreSkillIncreaseEntry(loreSlug, currentRank);
    if (!entry.label) return;

    if (custom) {
      addLevelCustomSkillIncrease(this.plan, this.selectedLevel, { skill: entry.skill, toRank: entry.toRank });
    } else {
      setLevelSkillIncrease(this.plan, this.selectedLevel, { skill: entry.skill, toRank: entry.toRank });
    }
    this._savePlanAndRender();
  }

  async _promptLoreSlug() {
    const dialogClass = foundry?.applications?.api?.DialogV2 ?? globalThis.Dialog;
    if (!dialogClass?.prompt) return '';

    const value = await dialogClass.prompt({
      window: { title: game.i18n?.localize?.('PF2E_LEVELER.CREATION.LORE_SKILLS') ?? 'Lore Skills' },
      content: `
        <div class="form-group">
          <label>${game.i18n?.localize?.('PF2E_LEVELER.UI.NAME') ?? 'Name'}</label>
          <input type="text" name="lore-name" autofocus />
        </div>
      `,
      ok: {
        label: game.i18n?.localize?.('PF2E_LEVELER.UI.ADD') ?? 'Add',
        callback: (event, button, dialog) => {
          const root = dialog?.element ?? dialog ?? button?.form ?? event?.currentTarget?.closest?.('.application');
          return root?.querySelector?.('input[name="lore-name"]')?.value ?? '';
        },
      },
    });

    return buildLoreSkillIncreaseEntry(value, 0).skill ?? '';
  }

  async _promptIntBonusLoreSkill() {
    const benefit = this._buildIntelligenceBenefitContext(this.selectedLevel);
    const max = benefit?.count ?? 0;
    if (max <= 0) return;

    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const selected = [...(levelData.intBonusSkills ?? [])];
    if (selected.length >= max) return;

    const loreSlug = await this._promptLoreSlug();
    if (!loreSlug || selected.includes(loreSlug)) return;

    levelData.intBonusSkills = [...selected, loreSlug];
    this._savePlanAndRender();
  }

  async _promptPlannedFeatLoreChoice({ category, flag, index = null } = {}) {
    const levelData = getLevelData(this.plan, this.selectedLevel);
    const featList = category ? levelData?.[category] : null;
    const feat = Array.isArray(featList)
      ? featList[Number.isInteger(index) && index >= 0 ? index : 0]
      : null;
    if (!feat || !flag) return;

    const loreSlug = await this._promptLoreSlug();
    if (!loreSlug) return;

    const sourceKey = `choice:${String(flag ?? '').toLowerCase()}`;
    feat.choices = { ...(feat.choices ?? {}), [flag]: loreSlug };
    feat.dynamicSkillRules = Array.isArray(feat.dynamicSkillRules)
      ? feat.dynamicSkillRules.filter((rule) => rule?.source !== sourceKey)
      : [];
    feat.dynamicLoreRules = [
      ...(Array.isArray(feat.dynamicLoreRules) ? feat.dynamicLoreRules.filter((rule) => rule?.source !== sourceKey) : []),
      { skill: loreSlug, value: 1, source: sourceKey },
    ];
    this._savePlanAndRender();
  }

  async _buildSpellContext(classDef, level) {
    return buildSpellContext(this, classDef, level);
  }

  async _getFocusSpellsForLevel(level) {
    return getFocusSpellsForLevel(this, level);
  }

  _getSubclassSlug() {
    return getSubclassSlug(this);
  }

  async _getGrantedSpellsForLevel(classDef, level) {
    return getGrantedSpellsForLevel(this, classDef, level);
  }

  _findFeatLevel(slugs) {
    return findFeatLevel(this, slugs);
  }

  _buildSpellSlotDisplay(currentSlots, prevSlots, plannedSpells) {
    return buildSpellSlotDisplay(this, currentSlots, prevSlots, plannedSpells);
  }

  _detectNewSpellRank(currentSlots, prevSlots) {
    return detectNewSpellRank(currentSlots, prevSlots);
  }

  _getHighestRank(slots) {
    return getHighestRank(slots);
  }

  _ordinalRank(n) {
    return ordinalRank(n);
  }

  _buildABPContext(level, options) {
    return buildABPContext(level, options);
  }

  _getActorSpellCounts() {
    return getActorSpellCounts(this);
  }

  _getClassFeaturesForLevel(level) {
    return getClassFeaturesForLevel(this, level);
  }

  _annotateFeat(feat) {
    return annotateFeat(feat);
  }

  _extractFeat(feats) {
    return extractFeat(feats);
  }

  _activateListeners(html) {
    activateLevelPlannerListeners(this, html);
  }

  _exportPlan() {
    const json = exportPlan(this.plan);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.actor.name}-level-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.notifications.info(game.i18n.localize('PF2E_LEVELER.NOTIFICATIONS.PLAN_EXPORTED'));
  }

  async _importPlan() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this._isImportingPlan = true;
        await this.render(true);
        const text = await file.text();
        const plan = importPlan(text);
        this.plan = plan;
        await savePlan(this.actor, plan);
        ui.notifications.info(game.i18n.localize('PF2E_LEVELER.NOTIFICATIONS.PLAN_IMPORTED'));
      } catch (err) {
        ui.notifications.error(
          game.i18n.format('PF2E_LEVELER.NOTIFICATIONS.IMPORT_FAILED', { error: err.message }),
        );
      } finally {
        this._isImportingPlan = false;
        await this.render(true);
      }
    });
    input.click();
  }

  async _clearPlan() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('PF2E_LEVELER.UI.CLEAR') },
      content: `<p>${game.i18n.localize('PF2E_LEVELER.UI.CONFIRM_CLEAR')}</p>`,
      modal: true,
    });
    if (!confirmed) return;
    await clearPlan(this.actor);
    this.plan = this._createPlanFromActor(this.actor);
    this.render(true);
  }

  async _clearSelectedLevel() {
    const classDef = ClassRegistry.get(this.plan?.classSlug);
    if (!classDef) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('PF2E_LEVELER.UI.CLEAR_LEVEL') },
      content: `<p>${game.i18n.format('PF2E_LEVELER.UI.CONFIRM_CLEAR_LEVEL', { level: this.selectedLevel })}</p>`,
      modal: true,
    });
    if (!confirmed) return;

    resetLevelData(this.plan, this.selectedLevel, classDef, this._getVariantOptions());
    this._savePlanAndRender();
  }

  _openSpellPicker(rank, entryType = 'primary') {
    const classDef = this._getSpellcastingClassForEntryType(entryType);
    const isArchetypeEntry = typeof entryType === 'string' && entryType.startsWith('archetype:');
    if (!classDef?.spellcasting && !isArchetypeEntry) return;

    const availableTraditions = this._getAvailableSpellPickerTraditions(classDef, entryType);
    const tradition = availableTraditions.length === 1 ? availableTraditions[0] : 'any';
    const resolvedEntryType = entryType === 'primary' && classDef?.spellcasting?.type === 'dual' ? 'animist' : entryType;
    const pickerRank = rank;
    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const sectionSpells = (levelData.spells ?? []).filter((spell) => (spell.entryType ?? 'primary') === resolvedEntryType);
    const excludedUuids = sectionSpells.map((spell) => spell.uuid);
    const excludedSelections = sectionSpells.map((spell) => ({ uuid: spell.uuid, rank: spell.rank }));
    const currentSlots = classDef?.spellcasting?.slots?.[this.selectedLevel] ?? {};
    const maxRank = rank === -1 ? this._getHighestRank(currentSlots) : null;
    const currentRankSelections = sectionSpells.filter((spell) => !this._isPlannedCantripSpell(spell));
    const currentCantripSelections = sectionSpells.filter((spell) => this._isPlannedCantripSpell(spell));
    const maxSelect = this._getSpellPickerMaxSelections(resolvedEntryType, rank, currentRankSelections, currentCantripSelections);
    const selectedSpells = rank === 0 ? currentCantripSelections : rank === -1 ? currentRankSelections : sectionSpells.filter((spell) => Number(spell.rank ?? spell.baseRank ?? -1) === rank);
    const multiSelect = maxSelect != null;
    if (maxSelect != null && maxSelect <= 0) return;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const dedicationLimits = typeof resolvedEntryType === 'string' && resolvedEntryType.startsWith('archetype:')
        ? getDedicationSelectionLimitsForPlanner(this, this.selectedLevel, resolvedEntryType)
        : null;
      const picker = new SpellPicker(
        this.actor,
        tradition,
        pickerRank,
        async (spells) => {
          const selected = Array.isArray(spells) ? spells : [spells];
          const isCantrip = rank === 0 && pickerRank === 0;
          for (const spell of selected) {
            addLevelSpell(this.plan, this.selectedLevel, {
              uuid: spell.uuid,
              name: spell.name,
              img: spell.img,
              rank: isCantrip ? 0 : pickerRank,
              baseRank: spell.system.level.value,
              isCantrip,
              entryType: resolvedEntryType,
              traits: [...(spell.system?.traits?.value ?? []), ...(spell.system?.traits?.traditions ?? [])],
            });
          }
          this._savePlanAndRender();
        },
        {
          excludedUuids,
          excludedSelections,
          excludeOwnedByIdentity: shouldExcludeOwnedSpellIdentityForPlanner(classDef),
          maxRank,
          multiSelect,
          selectedSpells,
          onRemoveSelected: async (spell) => {
            const removalRank = Number(spell?.displayRank ?? spell?.baseRank ?? spell?.rank ?? spell?.system?.level?.value ?? -1);
            removeLevelSpell(this.plan, this.selectedLevel, spell?.uuid, {
              entryType: resolvedEntryType,
              rank: removalRank,
            });
            this._buildStateCache = new Map();
            this._subclassSlugCache = new Map();
            this._subclassItemCache = new Map();
            await savePlan(this.actor, this.plan);
            await this.render({ force: true, parts: ['planner'] });
          },
          maxSelect,
          preset: {
            ...(rank > 0 ? { selectedRanks: [rank] } : {}),
            ...(availableTraditions.length > 0 ? {
              selectedTraditions: availableTraditions,
              lockedTraditions: availableTraditions,
            } : {}),
            ...(Array.isArray(rank > 0 ? dedicationLimits?.rankRaritySelections?.[rank] : dedicationLimits?.selectedRarities) ? {
              selectedRarities: rank > 0 ? dedicationLimits.rankRaritySelections[rank] : dedicationLimits.selectedRarities,
            } : {}),
            ...(Array.isArray(rank > 0 ? dedicationLimits?.rankLockedRarities?.[rank] : dedicationLimits?.lockedRarities) ? {
              lockedRarities: rank > 0 ? dedicationLimits.rankLockedRarities[rank] : dedicationLimits.lockedRarities,
            } : {}),
          },
        },
      );
      picker.render(true);
    });
  }

  _getAvailableSpellPickerTraditions(classDef, entryType = 'primary') {
    if (typeof entryType === 'string' && entryType.startsWith('archetype:')) {
      const classSlug = entryType.split(':')[1] ?? '';
      const archetypeClass = ClassRegistry.get(classSlug);
      const tradition = archetypeClass?.spellcasting?.tradition ?? null;
      return tradition ? [tradition] : [];
    }

    const classTradition = this._resolveSpellTradition(classDef);
    if (typeof classTradition === 'string' && classTradition.length > 0 && classTradition !== 'any') {
      return [classTradition];
    }
    return [];
  }

  _getSpellcastingClassForEntryType(entryType = 'primary') {
    if (typeof entryType === 'string' && entryType.startsWith('class:')) {
      const classSlug = entryType.slice('class:'.length);
      return ClassRegistry.get(classSlug) ?? null;
    }

    return ClassRegistry.get(this.plan.classSlug);
  }

  _isPlannedCantripSpell(spell) {
    return spell?.isCantrip === true || spell?.rank === 0 || spell?.baseRank === 0;
  }

  _getRemainingSpellbookSelections(currentCount) {
    return Math.max(0, 2 - Number(currentCount ?? 0));
  }

  _getRemainingSpellbookCantripSelections(currentCount) {
    return Math.max(0, getSpellbookBonusCantripSelectionCount(this.plan, this.selectedLevel) - Number(currentCount ?? 0));
  }

  _getSpellPickerMaxSelections(entryType, rank, currentRankSelections, currentCantripSelections) {
    if (typeof entryType === 'string' && entryType.startsWith('archetype:')) {
      const limits = getDedicationSelectionLimitsForPlanner(this, this.selectedLevel, entryType);
      if (rank === 0) return Math.max(0, Number(limits.cantripSelectionCount ?? 0) - currentCantripSelections.length);
      if (rank > 0) {
        const currentAtRank = currentRankSelections.filter((spell) => Number(spell.rank ?? spell.baseRank ?? -1) === rank).length;
        const requiredAtRank = Number(limits.rankSelectionCounts?.[rank] ?? 0);
        return Math.max(0, requiredAtRank - currentAtRank);
      }
      return null;
    }

    if (rank === 0) {
      return this._getRemainingSpellbookCantripSelections(currentCantripSelections.length);
    }
    if (rank === -1) {
      return this._getRemainingSpellbookSelections(currentRankSelections.length);
    }

    return null;
  }

  async _openCustomSpellPicker(rank = -1, entryType = 'primary') {
    const pickerRank = rank;
    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const excludedSelections = (levelData.customSpells ?? [])
      .filter((spell) => (spell.entryType ?? 'primary') === entryType)
      .map((spell) => ({ uuid: spell.uuid, rank: spell.rank ?? spell.baseRank ?? 0 }));
    const classDef = this._getSpellcastingClassForEntryType(entryType);
    const currentSlots = classDef?.spellcasting?.slots?.[this.selectedLevel] ?? {};
    const levelRanks = Object.keys(currentSlots).filter((k) => k !== 'cantrips').map(Number).filter(Number.isFinite);
    const customEntryOptions = buildCustomSpellEntryOptions(this, this.selectedLevel);
    const selectedEntry = customEntryOptions.find((entry) => entry.entryType === entryType) ?? null;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        'any',
        pickerRank,
        async (spells) => {
          const selectedSpells = Array.isArray(spells) ? spells : [spells];
          const isCantrip = pickerRank === 0;
          for (const spell of selectedSpells) {
            addLevelCustomSpell(this.plan, this.selectedLevel, {
              uuid: spell.uuid,
              name: spell.name,
              slug: spell.slug ?? null,
              img: spell.img,
              rank: isCantrip ? 0 : Number(spell.system?.level?.value ?? 0),
              baseRank: Number(spell.system?.level?.value ?? 0),
              isCantrip,
              traits: [...(spell.system?.traits?.value ?? []), ...(spell.system?.traits?.traditions ?? [])],
              entryType,
              entryLabel: selectedEntry?.label ?? null,
            });
          }
          await this._savePlanAndRender();
        },
        {
          exactRank: isFinite(pickerRank) && pickerRank >= 0,
          excludeOwnedByIdentity: false,
          multiSelect: true,
          excludedSelections,
          preset: {
            ...(levelRanks.length > 0 ? { selectedRanks: levelRanks } : {}),
            ...(selectedEntry?.tradition ? { selectedTraditions: [selectedEntry.tradition], lockedTraditions: [selectedEntry.tradition] } : {}),
          },
        },
      );
      picker.render(true);
    });
  }

  async _promptCustomSpellEntry() {
    const dialogClass = foundry?.applications?.api?.DialogV2 ?? globalThis.Dialog;
    if (!dialogClass?.prompt) return;

    const result = await dialogClass.prompt({
      window: { title: game.i18n?.localize?.('PF2E_LEVELER.UI.ADD_SPELLCASTING_ENTRY') ?? 'Add Spellcasting Entry' },
      content: `
        <div class="form-group">
          <label>${game.i18n?.localize?.('PF2E_LEVELER.UI.NAME') ?? 'Name'}</label>
          <input type="text" name="entry-name" autofocus />
        </div>
        <div class="form-group">
          <label>${game.i18n?.localize?.('PF2E_LEVELER.UI.TRADITION') ?? 'Tradition'}</label>
          <select name="entry-tradition">
            <option value="arcane">Arcane</option>
            <option value="divine">Divine</option>
            <option value="occult">Occult</option>
            <option value="primal">Primal</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n?.localize?.('PF2E_LEVELER.UI.SPELLCASTING_TYPE') ?? 'Spellcasting Type'}</label>
          <select name="entry-prepared">
            <option value="prepared">Prepared</option>
            <option value="spontaneous">Spontaneous</option>
            <option value="innate">Innate</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n?.localize?.('PF2E_LEVELER.UI.KEY_ABILITY') ?? 'Key Ability'}</label>
          <select name="entry-ability">
            <option value="int">INT</option>
            <option value="wis">WIS</option>
            <option value="cha" selected>CHA</option>
          </select>
        </div>
      `,
      ok: {
        label: game.i18n?.localize?.('PF2E_LEVELER.UI.ADD') ?? 'Add',
        callback: (event, button, dialog) => {
          const root = dialog?.element ?? dialog ?? button?.form ?? event?.currentTarget?.closest?.('.application');
          const read = (selector) => root?.querySelector?.(selector)?.value ?? '';
          return {
            name: read('input[name="entry-name"]').trim(),
            tradition: read('select[name="entry-tradition"]'),
            prepared: read('select[name="entry-prepared"]'),
            ability: read('select[name="entry-ability"]'),
          };
        },
      },
    });

    if (!result?.name || !result?.tradition || !result?.prepared || !result?.ability) return;

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addLevelCustomSpellEntry(this.plan, this.selectedLevel, {
      key,
      name: result.name,
      tradition: result.tradition,
      prepared: result.prepared,
      ability: result.ability,
    });
    this._savePlanAndRender();
  }

  _removeCustomSpellEntry(key) {
    if (!key) return;
    removeLevelCustomSpellEntry(this.plan, this.selectedLevel, key);
    this._savePlanAndRender();
  }

  _resolveSpellTradition(classDef) {
    return resolveSpellTradition(this, classDef);
  }

  _handleBoostToggle(attr) {
    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    let boosts = [...(levelData.abilityBoosts ?? [])];
    const options = this._getVariantOptions();
    const classDef = ClassRegistry.get(this.plan.classSlug);
    const choices = getChoicesForLevel(classDef, this.selectedLevel, options);
    const maxBoosts = choices.find((c) => c.type === 'abilityBoosts')?.count ?? 4;
    const usedBoostsInSet = this._getUsedBoostsInSet(this.selectedLevel, options.gradualBoosts);

    if (boosts.includes(attr)) {
      boosts = boosts.filter((b) => b !== attr);
    } else if (usedBoostsInSet.has(attr)) {
      return;
    } else if (boosts.length < maxBoosts) {
      boosts.push(attr);
    }

    setLevelBoosts(this.plan, this.selectedLevel, boosts);
    const benefit = this._buildIntelligenceBenefitContext(this.selectedLevel);
    const max = benefit?.count ?? 0;
    const selectedLevelData = getLevelData(this.plan, this.selectedLevel);
    if ((selectedLevelData?.intBonusSkills?.length ?? 0) > max) {
      selectedLevelData.intBonusSkills = selectedLevelData.intBonusSkills.slice(0, max);
    }
    if ((selectedLevelData?.intBonusLanguages?.length ?? 0) > max) {
      selectedLevelData.intBonusLanguages = selectedLevelData.intBonusLanguages.slice(0, max);
    }
    this._savePlanAndRender();
  }

  _getUsedBoostsInSet(level, gradualBoosts = this._getVariantOptions().gradualBoosts) {
    if (!gradualBoosts) return new Set();
    const used = new Set();
    for (const groupLevel of getGradualBoostGroupLevels(level)) {
      if (groupLevel === level) continue;
      const boosts = this.plan?.levels?.[groupLevel]?.abilityBoosts ?? [];
      for (const boost of boosts) used.add(boost);
    }
    return used;
  }

  _handleIntBonusSkillToggle(skill) {
    const benefit = this._buildIntelligenceBenefitContext(this.selectedLevel);
    const max = benefit?.count ?? 0;
    if (max <= 0) return;

    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const selected = [...(levelData.intBonusSkills ?? [])];

    if (selected.includes(skill)) {
      toggleLevelIntBonusSkill(this.plan, this.selectedLevel, skill);
    } else if (max === 1) {
      levelData.intBonusSkills = [skill];
    } else if (selected.length < max) {
      toggleLevelIntBonusSkill(this.plan, this.selectedLevel, skill);
    } else {
      return;
    }

    this._savePlanAndRender();
  }

  _handleIntBonusLanguageToggle(language) {
    const benefit = this._buildIntelligenceBenefitContext(this.selectedLevel);
    const max = benefit?.count ?? 0;
    if (max <= 0) return;

    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const selected = [...(levelData.intBonusLanguages ?? [])];

    if (selected.includes(language)) {
      toggleLevelIntBonusLanguage(this.plan, this.selectedLevel, language);
    } else if (max === 1) {
      levelData.intBonusLanguages = [language];
    } else if (selected.length < max) {
      toggleLevelIntBonusLanguage(this.plan, this.selectedLevel, language);
    } else {
      return;
    }

    this._savePlanAndRender();
  }

  async _openFeatPicker(category, level) {
    const categoryMap = {
      classFeats: 'class',
      dualClassFeats: 'dualClass',
      skillFeats: 'skill',
      generalFeats: 'general',
      ancestryFeats: 'ancestry',
      archetypeFeats: 'archetype',
      mythicFeats: 'mythic',
      customFeats: 'custom',
    };

    const buildState = computeBuildState(this.actor, this.plan, level);
    const pickerBuildState = category === 'dualClassFeats'
      ? this._buildDualClassPickerState(buildState)
      : buildState;
    if (category === 'dualClassFeats' && !pickerBuildState) {
      ui.notifications?.warn?.(game.i18n.localize('PF2E_LEVELER.NOTIFICATIONS.DUAL_CLASS_REQUIRED'));
      return;
    }
    const pickerCategory = categoryMap[category] ?? 'class';
    const preset = await this._buildFeatPickerPreset(category, level, pickerBuildState ?? buildState);

    const picker = new FeatPicker(
      this.actor,
      pickerCategory,
      level,
      pickerBuildState ?? buildState,
      async (feat) => {
        const slug = feat.slug ?? feat.uuid ?? null;
        const skillRules = await extractFeatSkillRules(feat);
        const aliases = getDedicationAliasesFromDescription(feat);
        setLevelFeat(this.plan, level, category, {
          uuid: feat.uuid,
          name: feat.name,
          slug,
          img: feat.img,
          level: feat.system.level.value,
          traits: [...(feat.system?.traits?.value ?? [])],
          choices: {},
          aliases,
          aliasesResolved: true,
          aliasesVersion: FEAT_ALIASES_VERSION,
          spellcastingMetadata: extractFeatSpellcastingMetadata({ ...feat, aliases }),
          spellcastingMetadataVersion: FEAT_SPELLCASTING_VERSION,
          skillRules,
          skillRulesResolved: true,
          skillRulesVersion: FEAT_SKILL_RULES_VERSION,
        });
        clearLevelReminders(this.plan, level, slug);
        if (MANUAL_SPELL_FEATS.has(slug)) {
          addLevelReminder(this.plan, level, {
            featSlug: slug,
            featName: feat.name,
            message: game.i18n.localize('PF2E_LEVELER.UI.MANUAL_SPELL_NOTE'),
          });
        }
        await this._savePlanAndRender();
      },
      { preset },
    );
    picker.render(true);
  }

  _openCustomFeatPicker(level, index = null) {
    const buildState = computeBuildState(this.actor, this.plan, level);
    const existingFeatUuids = new Set();
    for (const levelData of Object.values(this.plan?.levels ?? {})) {
      for (const key of ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats']) {
        for (const feat of levelData?.[key] ?? []) {
          if (typeof feat?.uuid === 'string' && feat.uuid.length > 0) existingFeatUuids.add(feat.uuid);
        }
      }
    }

    const picker = new FeatPicker(
      this.actor,
      'custom',
      level,
      buildState,
      async (feats) => {
        const selectedFeats = Array.isArray(feats) ? feats : [feats];
        const replaceMode = Number.isInteger(index);
        for (let offset = 0; offset < selectedFeats.length; offset++) {
          const feat = selectedFeats[offset];
          const slug = feat.slug ?? feat.uuid ?? null;
          const skillRules = await extractFeatSkillRules(feat);
          const aliases = getDedicationAliasesFromDescription(feat);
          addLevelCustomFeat(this.plan, level, {
            uuid: feat.uuid,
            name: feat.name,
            slug,
            img: feat.img,
            level: feat.system.level.value,
            traits: [...(feat.system?.traits?.value ?? [])],
            choices: {},
            aliases,
            aliasesResolved: true,
            aliasesVersion: FEAT_ALIASES_VERSION,
            spellcastingMetadata: extractFeatSpellcastingMetadata({ ...feat, aliases }),
            spellcastingMetadataVersion: FEAT_SPELLCASTING_VERSION,
            skillRules,
            skillRulesResolved: true,
            skillRulesVersion: FEAT_SKILL_RULES_VERSION,
          }, replaceMode && offset === 0 ? index : null);
        }
        await this._savePlanAndRender();
      },
      {
        multiSelect: index == null,
        preset: {
          selectedFeatTypes: ['class', 'ancestry', 'general', 'skill', 'archetype', 'mythic', 'bonus', 'other'],
          excludedFeatUuids: [...existingFeatUuids],
        },
      },
    );
    picker.render(true);
  }

  async _buildFeatPickerPreset(category, level, buildState) {
    const classSlug = String(buildState?.class?.slug ?? this.actor?.class?.slug ?? '').toLowerCase();
    switch (category) {
      case 'classFeats': {
        const enforceSubclassDedicationRequirement = game.settings.get(MODULE_ID, 'enforceSubclassDedicationRequirement') === true;
        const requiredSecondLevelFeat = level === 2 && enforceSubclassDedicationRequirement
          ? getRequiredSecondLevelClassFeatForActor(this.actor, classSlug)
          : null;
        const allowedFeatUuids = requiredSecondLevelFeat
          ? await this._resolveRequiredSecondLevelClassFeatUuids(requiredSecondLevelFeat)
          : [];
        debug('Level planner class feat preset', {
          actor: this.actor?.name ?? null,
          level,
          classSlug,
          enforceSubclassDedicationRequirement,
          requiredSecondLevelFeat,
          allowedFeatUuids,
        });
        return {
          selectedFeatTypes: ['class', 'archetype'],
          lockedFeatTypes: ['class'],
          extraVisibleFeatTypes: ['archetype'],
          allowedFeatUuids,
          requiredFeatLimitation: !!requiredSecondLevelFeat,
          maxLevel: level,
        };
      }
      case 'dualClassFeats':
        return {
          selectedFeatTypes: ['class'],
          lockedFeatTypes: ['class'],
          maxLevel: level,
        };
      case 'skillFeats':
        return {
          selectedFeatTypes: ['skill'],
          lockedFeatTypes: ['skill'],
          ...await this._buildInvestigatorSkillFeatLimitations(level, buildState),
          maxLevel: level,
        };
      case 'generalFeats':
        return {
          selectedFeatTypes: ['general', 'skill'],
          lockedFeatTypes: ['general'],
          extraVisibleFeatTypes: ['skill'],
          showSkillFeats: true,
          maxLevel: level,
        };
      case 'ancestryFeats':
        return {
          selectedFeatTypes: ['ancestry'],
          lockedFeatTypes: ['ancestry'],
          maxLevel: level,
        };
      case 'archetypeFeats': {
        const isFreeArchetypeEntryLevel = level === 2;
        return {
          selectedFeatTypes: ['archetype'],
          lockedFeatTypes: ['archetype'],
          selectedTraits: isFreeArchetypeEntryLevel ? ['archetype', 'dedication'] : ['archetype'],
          excludedTraits: isFreeArchetypeEntryLevel ? undefined : ['dedication'],
          lockedTraits: isFreeArchetypeEntryLevel ? ['archetype'] : ['archetype', 'dedication'],
          traitLogic: 'and',
          maxLevel: level,
        };
      }
      case 'mythicFeats':
        return {
          selectedFeatTypes: ['mythic'],
          lockedFeatTypes: ['mythic'],
          maxLevel: level,
        };
      default:
        return { maxLevel: level };
    }
  }

  async _resolveRequiredSecondLevelClassFeatUuids(requirement) {
    if (!requirement) return [];
    if (requirement.uuid) return [requirement.uuid];

    const allFeats = await loadFeats();
    return allFeats
      .filter((feat) => doesFeatMatchRequiredSecondLevelClassFeat(feat, requirement))
      .map((feat) => feat.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
  }

  _toggleCustomPlan(level = this.selectedLevel) {
    if (this._customPlanOpenLevels.has(level)) this._customPlanOpenLevels.delete(level);
    else this._customPlanOpenLevels.add(level);
    this._capturePlannerScroll();
    this.render(true);
  }

  async _buildInvestigatorSkillFeatLimitations(level, buildState) {
    const classSlug = String(buildState?.class?.slug ?? this.actor?.class?.slug ?? '').toLowerCase();
    if (classSlug !== 'investigator' || level < 3 || level % 2 === 0) return {};

    const requiredSkills = new Set(INVESTIGATOR_SKILLFUL_LESSON_BASE_SKILLS);
    for (const skill of await this._getInvestigatorMethodologySkills()) {
      requiredSkills.add(skill);
    }

    return {
      requiredSkills: [...requiredSkills],
      selectedSkills: [...requiredSkills],
    };
  }

  async _getInvestigatorMethodologySkills() {
    const items = Array.isArray(this.actor?.items)
      ? this.actor.items
      : Array.isArray(this.actor?.items?.contents)
        ? this.actor.items.contents
        : [];
    const methodologyItems = items.filter((item) => this._isInvestigatorMethodologyItem(item));
    const skills = new Set();

    for (const item of methodologyItems) {
      const rules = await extractFeatSkillRules(item).catch(() => []);
      for (const rule of rules) {
        const skill = String(rule?.skill ?? '').trim().toLowerCase();
        const value = Number(rule?.value ?? 0);
        if (!SKILLS.includes(skill) || !Number.isFinite(value) || value < 1) continue;
        skills.add(skill);
      }
    }

    return [...skills];
  }

  _isInvestigatorMethodologyItem(item) {
    const otherTags = [
      ...(item?.otherTags ?? []),
      ...(item?.system?.traits?.otherTags ?? []),
    ].map((tag) => String(tag ?? '').trim().toLowerCase());

    return otherTags.some((tag) => tag === 'investigator-methodology' || tag.startsWith('investigator-methodology-'));
  }

  _buildDualClassOptions() {
    const dualClassSlug = this._ensureResolvedDualClassSlug();
    const primaryClassSlug = String(this.plan?.classSlug ?? '').toLowerCase();
    return ClassRegistry.getAll()
      .filter((classDef) => String(classDef?.slug ?? '').toLowerCase() !== primaryClassSlug)
      .map((classDef) => ({
        value: classDef.slug,
        label: classDef.name ?? classDef.slug,
        selected: classDef.slug === dualClassSlug,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  _buildDualClassPickerState(buildState) {
    const dualClassSlug = String(this._ensureResolvedDualClassSlug() ?? '').trim().toLowerCase();
    if (!dualClassSlug) return null;
    if (!ClassRegistry.has(dualClassSlug)) return null;

    return {
      ...buildState,
      classSlug: dualClassSlug,
      class: buildClassStateForSlug(dualClassSlug),
    };
  }

  async _setDualClassSlug(classSlug) {
    const normalized = String(classSlug ?? '').trim().toLowerCase() || null;
    const nextSlug = normalized && ClassRegistry.has(normalized) ? normalized : null;
    if (this.plan.dualClassSlug === nextSlug) return;

    this.plan.dualClassSlug = nextSlug;
    for (const levelData of Object.values(this.plan.levels ?? {})) {
      if (Array.isArray(levelData?.dualClassFeats)) {
        levelData.dualClassFeats = [];
      }
    }
    await this._savePlanAndRender();
  }

  _isCustomPlanOpen(level = this.selectedLevel) {
    return this._customPlanOpenLevels.has(level);
  }

  _addCustomSkillIncrease(skill) {
    if (!skill) return;
    const state = computeBuildState(this.actor, this.plan, this.selectedLevel);
    const currentRank = state.skills?.[skill] ?? state.lores?.[skill] ?? 0;
    addLevelCustomSkillIncrease(this.plan, this.selectedLevel, {
      skill,
      toRank: currentRank + 1,
    });
    this._savePlanAndRender();
  }

  _removeCustomFeat(index) {
    removeLevelCustomFeat(this.plan, this.selectedLevel, index);
    this._savePlanAndRender();
  }

  _removeCustomSkillIncrease(index) {
    removeLevelCustomSkillIncrease(this.plan, this.selectedLevel, index);
    this._savePlanAndRender();
  }

  _removeCustomSpell(index) {
    removeLevelCustomSpell(this.plan, this.selectedLevel, index);
    this._savePlanAndRender();
  }

  async _advanceSequentialLevel() {
    const seq = this.plan?.sequentialMode;
    if (!seq?.active) return;
    seq.currentLevel = Math.min(seq.currentLevel + 1, seq.targetLevel);
    this.selectedLevel = seq.currentLevel;
    await this._savePlanAndRender();
  }

  async _finishSequentialMode() {
    if (this.plan?.sequentialMode) {
      this.plan.sequentialMode.active = false;
    }
    await this._savePlanAndRender();
  }

  async _applySelectedPlan() {
    if (!this.plan || !Number.isInteger(this.selectedLevel)) return;
    await promptApplyPlan(this.actor, this.plan, this.selectedLevel, this.selectedLevel - 1);
  }

  async _openEquipmentSlotPicker(slotIndex, maxLevel) {
    const { ItemPicker } = await import('../item-picker.js');
    const picker = new ItemPicker(
      this.actor,
      async (item) => {
        const itemType = String(item.type ?? '').toLowerCase();
        const itemLevel = Number(item.system?.level?.value ?? 0);
        if (!game.user.isGM) {
          if (!PERMANENT_ITEM_TYPES.has(itemType)) {
            ui.notifications.warn(game.i18n.localize('PF2E_LEVELER.STARTING_WEALTH.NOT_PERMANENT'));
            return;
          }
          if (itemLevel > maxLevel) {
            ui.notifications.warn(game.i18n.format('PF2E_LEVELER.STARTING_WEALTH.LEVEL_TOO_HIGH', { item: itemLevel, max: maxLevel }));
            return;
          }
        }
        const pricePer = Number(item.system?.price?.per ?? 1);
        setLevelEquipmentSlot(this.plan, this.selectedLevel, slotIndex, {
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          itemLevel,
          price: item.system?.price?.value,
          category: itemType,
          quantity: pricePer > 1 ? pricePer : 1,
        });
        await this._savePlanAndRender();
      },
    );
    picker.render(true);
  }

  async _removeEquipmentSlot(slotIndex) {
    clearLevelEquipmentSlot(this.plan, this.selectedLevel, slotIndex);
    await this._savePlanAndRender();
  }

  async _openCustomEquipmentPicker(level, index = null) {
    const { ItemPicker } = await import('../item-picker.js');
    const picker = new ItemPicker(
      this.actor,
      async (items) => {
        const selectedItems = Array.isArray(items) ? items : [items];
        const replaceMode = Number.isInteger(index);
        for (let offset = 0; offset < selectedItems.length; offset++) {
          const item = selectedItems[offset];
          const pricePer = Number(item.system?.price?.per ?? 1);
          addLevelCustomEquipment(this.plan, level, {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            itemLevel: Number(item.system?.level?.value ?? 0),
            price: item.system?.price?.value,
            category: String(item.type ?? ''),
            quantity: pricePer > 1 ? pricePer : 1,
          }, replaceMode && offset === 0 ? index : null);
        }
        await this._savePlanAndRender();
      },
      { multiSelect: index == null },
    );
    picker.render(true);
  }

  async _removeCustomEquipment(index) {
    removeLevelCustomEquipment(this.plan, this.selectedLevel, index);
    await this._savePlanAndRender();
  }

  async _openFeatGrantPicker(requirementId) {
    const requirement = await this._getFeatGrantRequirement(requirementId);
    if (!requirement) return;

    if (requirement.confidence === 'manual-required' && !Number.isFinite(Number(requirement.count))) {
      await this._configureManualFeatGrant(requirement);
      return;
    }

    if (requirement.kind === 'spell') {
      await this._openFeatGrantSpellPicker(requirement);
    } else if (requirement.kind === 'formula' || requirement.kind === 'item') {
      await this._openFeatGrantItemPicker(requirement);
    }
  }

  async _getFeatGrantRequirement(requirementId) {
    const levelData = getLevelData(this.plan, this.selectedLevel);
    if (!levelData) return null;

    const stored = (levelData.featGrants ?? []).find((entry) => entry?.requirementId === requirementId);
    const detected = await this._findDetectedFeatGrantRequirement(levelData, requirementId);
    if (stored?.manual) return mergeStoredManualFeatGrantRequirement(stored, detected, requirementId);
    return detected;
  }

  async _findDetectedFeatGrantRequirement(levelData, requirementId) {
    for (const feat of this._getLevelFeatEntries(levelData)) {
      const requirement = (feat?.grantRequirements ?? []).find((entry) => entry?.id === requirementId);
      if (requirement) return requirement;
    }

    const detected = await buildFeatGrantRequirements({
      actor: this.actor,
      plan: this.plan,
      level: this.selectedLevel,
      feats: this._getLevelFeatEntries(levelData),
    });
    const requirement = detected.find((entry) => entry?.id === requirementId);
    if (requirement) return requirement;

    return null;
  }

  _getLevelFeatEntries(levelData) {
    return [
      'classFeats',
      'skillFeats',
      'generalFeats',
      'ancestryFeats',
      'archetypeFeats',
      'mythicFeats',
      'dualClassFeats',
      'customFeats',
    ].flatMap((key) => levelData?.[key] ?? []);
  }

  async _configureManualFeatGrant(requirement) {
    const dialogClass = foundry?.applications?.api?.DialogV2 ?? globalThis.Dialog;
    if (!dialogClass?.prompt) return;

    const result = await dialogClass.prompt({
      window: { title: 'Configure Grant Choice' },
      content: `
        <div class="form-group">
          <label>Kind</label>
          <select name="kind">
            <option value="formula" ${requirement.kind === 'formula' ? 'selected' : ''}>Formula</option>
            <option value="item" ${requirement.kind === 'item' ? 'selected' : ''}>Item</option>
            <option value="spell" ${requirement.kind === 'spell' ? 'selected' : ''}>Spell</option>
          </select>
        </div>
        <div class="form-group">
          <label>Count</label>
          <input type="number" name="count" min="1" value="1" />
        </div>
      `,
      ok: {
        label: game.i18n?.localize?.('PF2E_LEVELER.UI.ADD') ?? 'Add',
        callback: (event, button, dialog) => {
          const root = dialog?.element ?? dialog ?? button?.form ?? event?.currentTarget?.closest?.('.application');
          return {
            kind: root?.querySelector?.('select[name="kind"]')?.value ?? requirement.kind ?? 'item',
            count: Math.max(1, Number(root?.querySelector?.('input[name="count"]')?.value ?? 1)),
          };
        },
      },
    });

    if (!result?.kind || !Number.isFinite(result.count)) return;
    upsertLevelFeatGrant(this.plan, this.selectedLevel, {
      requirementId: requirement.id,
      sourceFeatUuid: requirement.sourceFeatUuid,
      sourceFeatName: requirement.sourceFeatName,
      kind: result.kind,
      manual: { count: result.count, filters: {} },
      selections: [],
    });
    await this._savePlanAndRender();
    await this._openFeatGrantPicker(requirement.id);
  }

  async _openFeatGrantItemPicker(requirement) {
    const { ItemPicker, loadItems } = await import('../item-picker.js');
    const currentSelections = this._getStoredFeatGrantSelections(requirement.id);
    const maxSelect = getRemainingGrantSelections(requirement, currentSelections);
    if (maxSelect <= 0) return;

    const picker = new ItemPicker(
      this.actor,
      async (items) => {
        this._storeFeatGrantSelections(requirement, Array.isArray(items) ? items : [items]);
        await this._savePlanAndRender();
      },
      {
        items: await loadItems(),
        multiSelect: true,
        maxSelect,
        title: requirement.kind === 'formula' ? 'Choose Formulas' : 'Choose Granted Items',
        preset: buildItemGrantPickerPreset(requirement, {
          maxLevelCap: requirement.kind === 'formula' ? this.selectedLevel : null,
        }),
      },
    );
    picker.render(true);
  }

  async _openFeatGrantSpellPicker(requirement) {
    const { SpellPicker } = await import('../spell-picker.js');
    const currentSelections = this._getStoredFeatGrantSelections(requirement.id);
    const maxSelect = getRemainingGrantSelections(requirement, currentSelections);
    if (maxSelect <= 0) return;

    const filters = requirement.filters ?? {};
    const rank = Number.isFinite(Number(filters.rank)) ? Number(filters.rank) : -1;
    const picker = new SpellPicker(
      this.actor,
      filters.tradition ?? 'any',
      rank,
      async (spells) => {
        this._storeFeatGrantSelections(requirement, Array.isArray(spells) ? spells : [spells]);
        await this._savePlanAndRender();
      },
      {
        multiSelect: true,
        maxSelect,
        preset: {
          ...(Number.isFinite(Number(filters.rank)) ? { selectedRanks: [Number(filters.rank)] } : {}),
          ...(filters.tradition ? { selectedTraditions: [filters.tradition], lockedTraditions: [filters.tradition] } : {}),
          ...(Array.isArray(filters.rarity) ? { selectedRarities: filters.rarity, lockedRarities: ['common', 'uncommon', 'rare', 'unique'].filter((rarity) => !filters.rarity.includes(rarity)) } : {}),
        },
      },
    );
    picker.render(true);
  }

  _getStoredFeatGrantSelections(requirementId) {
    const levelData = getLevelData(this.plan, this.selectedLevel);
    return (levelData?.featGrants ?? []).find((entry) => entry?.requirementId === requirementId)?.selections ?? [];
  }

  _storeFeatGrantSelections(requirement, documents) {
    const existing = this._getStoredFeatGrantSelections(requirement.id);
    const selections = dedupeSelections([
      ...existing,
      ...documents.map((doc) => ({
        uuid: doc.uuid,
        name: doc.name,
        img: doc.img ?? null,
        rank: Number(doc.system?.level?.value ?? doc.rank ?? 0),
        baseRank: Number(doc.system?.level?.value ?? doc.baseRank ?? 0),
        itemType: doc.type ?? null,
        traits: [...(doc.system?.traits?.value ?? []), ...(doc.system?.traits?.traditions ?? [])],
      })),
    ]);

    upsertLevelFeatGrant(this.plan, this.selectedLevel, {
      requirementId: requirement.id,
      sourceFeatUuid: requirement.sourceFeatUuid,
      sourceFeatName: requirement.sourceFeatName,
      kind: requirement.kind,
      manual: requirement.confidence === 'manual' ? { count: requirement.count, filters: requirement.filters ?? {} } : undefined,
      selections,
    });
  }

  async _savePlanAndRender() {
    this._capturePlannerScroll();
    this._buildStateCache = new Map();
    this._subclassSlugCache = new Map();
    this._subclassItemCache = new Map();
    await savePlan(this.actor, this.plan);
    this.render(true);
  }

  _capturePlannerScroll() {
    this._scrollState = captureScrollState(this.element, {
      sidebar: '.sidebar-levels',
      content: '.planner-content',
    });
  }

  _restorePlannerScroll(root) {
    restoreScrollState(root, this._scrollState, {
      sidebar: '.sidebar-levels',
      content: '.planner-content',
    });
  }
}

function getRemainingGrantSelections(requirement, currentSelections) {
  const required = Number(requirement?.count ?? requirement?.manual?.count);
  if (!Number.isFinite(required) || required <= 0) return null;
  return Math.max(0, required - (currentSelections?.length ?? 0));
}

function buildItemGrantPickerPreset(requirement, { maxLevelCap = null } = {}) {
  const filters = requirement?.filters ?? {};
  const rarityValues = ['common', 'uncommon', 'rare', 'unique'];
  const rarityFilter = normalizeRarityFilter(filters.rarity, rarityValues);
  return {
    ...(Array.isArray(filters.itemTypes) && filters.itemTypes.length > 0 ? { selectedCategories: filters.itemTypes } : {}),
    ...(Array.isArray(filters.traits) && filters.traits.length > 0 ? { selectedTraits: filters.traits } : {}),
    ...(rarityFilter.length > 0 ? {
      selectedRarities: rarityFilter,
      lockedRarities: rarityValues.filter((rarity) => !rarityFilter.includes(rarity)),
    } : {}),
    ...(Number.isFinite(Number(maxLevelCap)) ? { maxLevel: Number(maxLevelCap), maxLevelCap: Number(maxLevelCap) } : (
      Number.isFinite(Number(filters.maxLevel)) ? { maxLevel: Number(filters.maxLevel) } : {}
    )),
  };
}

function normalizeRarityFilter(value, allowedValues) {
  const values = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  const allowed = new Set(allowedValues);
  return [...new Set(values.map((entry) => String(entry).toLowerCase()).filter((entry) => allowed.has(entry)))];
}

function mergeStoredManualFeatGrantRequirement(stored, detected, requirementId) {
  return {
    id: requirementId,
    sourceFeatUuid: stored.sourceFeatUuid ?? detected?.sourceFeatUuid,
    sourceFeatName: stored.sourceFeatName ?? detected?.sourceFeatName,
    kind: stored.kind ?? detected?.kind,
    count: Number.isFinite(Number(stored.manual?.count)) ? Number(stored.manual.count) : detected?.count,
    confidence: 'manual',
    filters: {
      ...(detected?.filters ?? {}),
      ...(stored.manual?.filters ?? {}),
    },
  };
}

function dedupeSelections(selections) {
  const seen = new Set();
  const deduped = [];
  for (const selection of selections ?? []) {
    if (!selection?.uuid || seen.has(selection.uuid)) continue;
    seen.add(selection.uuid);
    deduped.push(selection);
  }
  return deduped;
}

function normalizeActorBoostEntries(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeAbilityBoostKey(entry)).filter(Boolean);
  }
  if (!value || typeof value !== 'object') return [];

  const flattened = [];
  for (const entry of Object.values(value)) {
    if (typeof entry === 'string') {
      flattened.push(entry);
      continue;
    }
    if (Array.isArray(entry)) {
      flattened.push(...entry);
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.selected === 'string') {
      flattened.push(entry.selected);
      continue;
    }
    if (Array.isArray(entry.selected)) {
      flattened.push(...entry.selected);
      continue;
    }
    if (typeof entry.value === 'string') {
      flattened.push(entry.value);
    }
  }

  return flattened.map((entry) => normalizeAbilityBoostKey(entry)).filter(Boolean);
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

function levelHasSelections(levelData) {
  if (!levelData || typeof levelData !== 'object') return false;

  for (const [key, value] of Object.entries(levelData)) {
    if (key === 'reminders') {
      if (Array.isArray(value) && value.length > 0) return true;
      continue;
    }
    if (Array.isArray(value) && value.length > 0) return true;
  }

  return false;
}
