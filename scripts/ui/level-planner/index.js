import { MODULE_ID, MIN_PLAN_LEVEL, MAX_LEVEL, PLAN_STATUS, PERMANENT_ITEM_TYPES } from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { getChoicesForLevel, getGradualBoostGroupLevels, getLevelSummary } from '../../classes/progression.js';
import {
  createPlan,
  getLevelData,
  setLevelBoosts,
  setLevelFeat,
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
  setLevelEquipmentSlot,
  clearLevelEquipmentSlot,
  addLevelCustomEquipment,
  removeLevelCustomEquipment,
} from '../../plan/plan-model.js';
import { getPlan, savePlan, clearPlan, exportPlan, importPlan } from '../../plan/plan-store.js';
import { validateLevel } from '../../plan/plan-validator.js';
import { computeBuildState } from '../../plan/build-state.js';
import { isFreeArchetypeEnabled, isMythicEnabled, isABPEnabled, isGradualBoostsEnabled, isDualClassEnabled, isAncestralParagonEnabled } from '../../utils/pf2e-api.js';
import { localize } from '../../utils/i18n.js';
import { debug } from '../../utils/logger.js';
import { FeatPicker } from '../feat-picker.js';
import { captureScrollState, restoreScrollState } from '../shared/scroll-state.js';
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
  buildLevelContext,
  extractFeat,
  getClassFeaturesForLevel,
} from './level-context.js';
import { activateLevelPlannerListeners } from './listeners.js';
import {
  buildSpellContext,
  buildSpellSlotDisplay,
  detectNewSpellRank,
  findFeatLevel,
  getActorSpellCounts,
  getFocusSpellsForLevel,
  getGrantedSpellsForLevel,
  getHighestRank,
  getSubclassSlug,
  ordinalRank,
  resolveSpellTradition,
} from './spells.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const FEAT_PLAN_CATEGORIES = new Set(['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats']);
const FEAT_SKILL_RULES_VERSION = 3;
const LOCATION_TO_PLAN_CATEGORY = {
  class: 'classFeats',
  skill: 'skillFeats',
  general: 'generalFeats',
  ancestry: 'ancestryFeats',
  ancestryparagon: 'ancestryFeats',
  xdy_ancestryparagon: 'ancestryFeats',
  archetype: 'archetypeFeats',
  mythic: 'mythicFeats',
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

export class LevelPlanner extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super();
    this.actor = actor;
    this._compendiumCache = {};
    this._customPlanOpenLevels = new Set();
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

      for (const key of ['customFeats', 'customSkillIncreases', 'customSpells']) {
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

    if (this._backfillMissingBoostsFromActor(plan)) {
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

  _createPlanFromActor(actor) {
    const classSlug = this._resolveClassSlug(actor);
    if (!classSlug) return null;

    const options = this._getVariantOptions();
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

  _backfillMissingBoostsFromActor(plan) {
    const actorBoosts = this.actor?.system?.build?.attributes?.boosts ?? {};
    let changed = false;

    for (const [levelKey, boosts] of Object.entries(actorBoosts)) {
      const level = Number(levelKey);
      if (!Number.isInteger(level) || level < MIN_PLAN_LEVEL || level > MAX_LEVEL) continue;

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
        skillRules: extractDirectFeatSkillRules(feat),
        skillRulesResolved: false,
        skillRulesVersion: 0,
      });
    }
  }

  _getActorFeatPlanPlacement(feat, plan, options, actorLevel) {
    const fromLocation = this._getActorFeatPlacementFromLocation(feat, plan, actorLevel);
    if (fromLocation) return fromLocation;

    const takenLevel = this._getActorFeatTakenLevel(feat);
    if (!Number.isInteger(takenLevel) || takenLevel < MIN_PLAN_LEVEL || takenLevel > actorLevel) return null;

    const category = this._inferActorFeatPlanCategory(feat, takenLevel, plan, options);
    if (!category || !Array.isArray(plan?.levels?.[takenLevel]?.[category])) return null;

    return { level: takenLevel, category };
  }

  _getActorFeatPlacementFromLocation(feat, plan, actorLevel) {
    const rawLocation = feat?.system?.location?.value ?? feat?.system?.location ?? '';
    const match = String(rawLocation ?? '').match(/^([a-zA-Z_]+)-(\d+)$/);
    if (!match) return null;

    const [, rawGroup, levelText] = match;
    const level = Number(levelText);
    if (!Number.isInteger(level) || level < MIN_PLAN_LEVEL || level > actorLevel) return null;

    const group = rawGroup.replace(/[^a-z_]/gi, '').toLowerCase();
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
    const traits = (feat?.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const levelData = plan?.levels?.[takenLevel] ?? {};

    if (traits.includes('mythic') && Array.isArray(levelData.mythicFeats)) return 'mythicFeats';
    if ((traits.includes('archetype') || traits.includes('dedication')) && Array.isArray(levelData.archetypeFeats) && options.freeArchetype) {
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
    const actorClass = actor.class;
    if (!actorClass) return null;

    const slug = actorClass.slug ?? null;
    if (ClassRegistry.has(slug)) return slug;
    return null;
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

    return {
      hasPlan: !!this.plan,
      unsupportedClass,
      actorClassName,
      selectedLevel: this.selectedLevel,
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
    return {
      freeArchetype: isFreeArchetypeEnabled(),
      mythic: isMythicEnabled(),
      abp: isABPEnabled(),
      gradualBoosts: isGradualBoostsEnabled(),
      dualClass: isDualClassEnabled(),
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
        const text = await file.text();
        const plan = importPlan(text);
        this.plan = plan;
        await savePlan(this.actor, plan);
        ui.notifications.info(game.i18n.localize('PF2E_LEVELER.NOTIFICATIONS.PLAN_IMPORTED'));
        this.render(true);
      } catch (err) {
        ui.notifications.error(
          game.i18n.format('PF2E_LEVELER.NOTIFICATIONS.IMPORT_FAILED', { error: err.message }),
        );
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

  _openSpellPicker(rank) {
    const classDef = ClassRegistry.get(this.plan.classSlug);
    if (!classDef?.spellcasting) return;

    const tradition = this._resolveSpellTradition(classDef);
    const entryType = classDef.spellcasting.type === 'dual' ? 'animist' : 'primary';
    const pickerRank = rank;
    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const excludedUuids = (levelData.spells ?? []).map((spell) => spell.uuid);
    const excludedSelections = (levelData.spells ?? []).map((spell) => ({ uuid: spell.uuid, rank: spell.rank }));
    const currentSlots = classDef.spellcasting.slots?.[this.selectedLevel] ?? {};
    const maxRank = rank === -1 ? this._getHighestRank(currentSlots) : null;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        tradition,
        pickerRank,
        (spell) => {
          const isCantrip = rank === 0 && pickerRank === 0;
          addLevelSpell(this.plan, this.selectedLevel, {
            uuid: spell.uuid,
            name: spell.name,
            img: spell.img,
            rank: isCantrip ? 0 : pickerRank,
            baseRank: spell.system.level.value,
            isCantrip,
            entryType,
          });
          this._savePlanAndRender();
        },
        { excludedUuids, excludedSelections, maxRank, preset: rank > 0 ? { selectedRanks: [rank] } : undefined },
      );
      picker.render(true);
    });
  }

  _openCustomSpellPicker(rank = -1) {
    const pickerRank = rank;
    const levelData = getLevelData(this.plan, this.selectedLevel) ?? {};
    const excludedSelections = (levelData.customSpells ?? []).map((spell) => ({ uuid: spell.uuid, rank: spell.rank ?? spell.baseRank ?? 0 }));
    const classDef = ClassRegistry.get(this.plan.classSlug);
    const currentSlots = classDef?.spellcasting?.slots?.[this.selectedLevel] ?? {};
    const levelRanks = Object.keys(currentSlots).filter((k) => k !== 'cantrips').map(Number).filter(Number.isFinite);

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
            });
          }
          await this._savePlanAndRender();
        },
        {
          exactRank: isFinite(pickerRank) && pickerRank >= 0,
          excludeOwnedByIdentity: false,
          multiSelect: true,
          excludedSelections,
          preset: levelRanks.length > 0 ? { selectedRanks: levelRanks } : undefined,
        },
      );
      picker.render(true);
    });
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

  _openFeatPicker(category, level) {
    const categoryMap = {
      classFeats: 'class',
      skillFeats: 'skill',
      generalFeats: 'general',
      ancestryFeats: 'ancestry',
      archetypeFeats: 'archetype',
      mythicFeats: 'mythic',
      customFeats: 'custom',
    };

    const buildState = computeBuildState(this.actor, this.plan, level);
    const pickerCategory = categoryMap[category] ?? 'class';
    const preset = this._buildFeatPickerPreset(category, level, buildState);

    const picker = new FeatPicker(
      this.actor,
      pickerCategory,
      level,
      buildState,
      async (feat) => {
        const slug = feat.slug ?? feat.uuid ?? null;
        const skillRules = await extractFeatSkillRules(feat);
        setLevelFeat(this.plan, level, category, {
          uuid: feat.uuid,
          name: feat.name,
          slug,
          img: feat.img,
          level: feat.system.level.value,
          traits: [...(feat.system?.traits?.value ?? [])],
          choices: {},
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
          addLevelCustomFeat(this.plan, level, {
            uuid: feat.uuid,
            name: feat.name,
            slug,
            img: feat.img,
            level: feat.system.level.value,
            traits: [...(feat.system?.traits?.value ?? [])],
            choices: {},
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
        },
      },
    );
    picker.render(true);
  }

  _buildFeatPickerPreset(category, level, buildState) {
    const classSlug = String(buildState?.class?.slug ?? this.actor?.class?.slug ?? '').toLowerCase();
    switch (category) {
      case 'classFeats':
        return {
          selectedFeatTypes: ['class'],
          lockedFeatTypes: ['class'],
          extraVisibleFeatTypes: ['archetype'],
          selectedTraits: [classSlug].filter(Boolean),
          lockedTraits: [classSlug].filter(Boolean),
          traitLogic: 'or',
          showDedications: true,
          maxLevel: level,
        };
      case 'skillFeats':
        return {
          selectedFeatTypes: ['skill'],
          lockedFeatTypes: ['skill'],
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
        const hasDedication = (buildState?.archetypeDedications?.size ?? 0) > 0;
        return {
          selectedFeatTypes: ['archetype'],
          lockedFeatTypes: ['archetype'],
          selectedTraits: hasDedication ? ['archetype', 'dedication'] : ['dedication'],
          lockedTraits: hasDedication ? ['archetype', 'dedication'] : ['dedication'],
          traitLogic: 'or',
          showDedications: true,
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

  _toggleCustomPlan(level = this.selectedLevel) {
    if (this._customPlanOpenLevels.has(level)) this._customPlanOpenLevels.delete(level);
    else this._customPlanOpenLevels.add(level);
    this._capturePlannerScroll();
    this.render(true);
  }

  _isCustomPlanOpen(level = this.selectedLevel) {
    return this._customPlanOpenLevels.has(level);
  }

  _addCustomSkillIncrease(skill) {
    if (!skill) return;
    const currentRank = computeBuildState(this.actor, this.plan, this.selectedLevel).skills?.[skill] ?? 0;
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

  async _savePlanAndRender() {
    this._capturePlannerScroll();
    this._buildStateCache = new Map();
    this._subclassSlug = undefined;
    this._subclassItem = undefined;
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
