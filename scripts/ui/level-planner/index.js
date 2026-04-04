import { MODULE_ID, MIN_PLAN_LEVEL, MAX_LEVEL, PLAN_STATUS } from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { getChoicesForLevel, getLevelSummary } from '../../classes/progression.js';
import { createPlan, getLevelData, setLevelBoosts, setLevelFeat, toggleLevelIntBonusSkill, toggleLevelIntBonusLanguage, addLevelSpell, addLevelReminder, clearLevelReminders } from '../../plan/plan-model.js';
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
  buildApparitionContext,
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

const MANUAL_SPELL_FEATS = new Set([
  'advanced-qi-spells',
  'master-qi-spells',
  'grandmaster-qi-spells',
  'advanced-warden',
  'masterful-warden',
]);

export class LevelPlanner extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super();
    this.actor = actor;
    this.plan = this._loadOrCreatePlan(actor);
    const actorLevel = actor.system?.details?.level?.value ?? 1;
    this.selectedLevel = Math.max(actorLevel, MIN_PLAN_LEVEL);
  }

  _loadOrCreatePlan(actor) {
    const existing = getPlan(actor);
    if (!existing) return this._createPlanFromActor(actor);

    const classSlug = this._resolveClassSlug(actor);
    if (existing.classSlug !== classSlug) return this._createPlanFromActor(actor);

    this._migratePlan(existing, classSlug);
    return existing;
  }

  _migratePlan(plan, classSlug) {
    const classDef = ClassRegistry.get(classSlug);
    if (!classDef) return;

    const options = this._getVariantOptions();
    let changed = false;

    for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
      const choices = getChoicesForLevel(classDef, level, options);
      if (choices.length === 0) continue;

      if (!plan.levels[level]) {
        plan.levels[level] = {};
        changed = true;
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

    if (changed) savePlan(this.actor, plan);
  }

  _createPlanFromActor(actor) {
    const classSlug = this._resolveClassSlug(actor);
    if (!classSlug) return null;

    const options = this._getVariantOptions();
    const plan = createPlan(classSlug, options);
    savePlan(actor, plan);
    debug(`Auto-created plan for ${actor.name} (${classSlug})`);
    return plan;
  }

  _resolveClassSlug(actor) {
    const actorClass = actor.class;
    if (!actorClass) return null;

    const slug = actorClass.slug ?? actorClass.name?.toLowerCase().replace(/\s+/g, '-');
    if (ClassRegistry.has(slug)) return slug;

    const allClasses = ClassRegistry.getAll();
    const match = allClasses.find(
      (c) => c.slug === slug || actorClass.name?.toLowerCase() === game.i18n.localize(c.nameKey).toLowerCase(),
    );
    return match?.slug ?? null;
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
    const options = this._getVariantOptions();
    const classDef = this.plan ? ClassRegistry.get(this.plan.classSlug) : null;
    const actorClassName = this.actor.class?.name ?? null;
    const unsupportedClass = actorClassName && !this.plan;

    return {
      hasPlan: !!this.plan,
      unsupportedClass,
      actorClassName,
      selectedLevel: this.selectedLevel,
      sidebarLevels: this._buildSidebarLevels(classDef, options),
      availableClasses: ClassRegistry.getAll(),
      ...(await this._buildLevelContext(classDef, options)),
    };
  }

  _onRender(_context, _options) {
    const html = this.element;
    this._restorePlannerScroll(html);
    this._activateListeners(html);
  }

  _getVariantOptions() {
    return {
      freeArchetype: isFreeArchetypeEnabled(),
      mythic: isMythicEnabled(),
      abp: isABPEnabled(),
      gradualBoosts: isGradualBoostsEnabled(),
      dualClass: isDualClassEnabled(),
      ancestralParagon: isAncestralParagonEnabled(),
    };
  }

  _buildSidebarLevels(classDef, options) {
    const levels = [];
    for (let level = MIN_PLAN_LEVEL; level <= MAX_LEVEL; level++) {
      const summary = classDef ? getLevelSummary(classDef, level, options) : '';
      const status = this.plan && classDef
        ? validateLevel(this.plan, classDef, level, options, this.actor).status
        : PLAN_STATUS.EMPTY;

      const actorLevel = this.actor.system?.details?.level?.value ?? 1;
      levels.push({
        level,
        summary,
        status,
        active: level === this.selectedLevel,
        isCurrent: level === actorLevel,
      });
    }
    return levels;
  }

  async _buildLevelContext(classDef, options) {
    return buildLevelContext(this, classDef, options);
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

  _buildApparitionContext(classDef, level) {
    return buildApparitionContext(classDef, level);
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

  _openSpellPicker(rank) {
    const classDef = ClassRegistry.get(this.plan.classSlug);
    if (!classDef?.spellcasting) return;

    const tradition = this._resolveSpellTradition(classDef);
    const entryType = classDef.spellcasting.type === 'dual' ? 'animist' : 'primary';
    const pickerRank = classDef.slug === 'wizard' && rank === 0 ? -1 : rank;

    import('./spell-picker.js').then(({ SpellPicker }) => {
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
            rank: isCantrip ? 0 : spell.system.level.value,
            isCantrip,
            entryType,
          });
          this._savePlanAndRender();
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

    if (boosts.includes(attr)) {
      boosts = boosts.filter((b) => b !== attr);
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
    };

    const buildState = computeBuildState(this.actor, this.plan, level);

    const picker = new FeatPicker(
      this.actor,
      categoryMap[category] ?? 'class',
      level,
      buildState,
      (feat) => {
        const slug = feat.slug ?? feat.name.toLowerCase().replace(/\s+/g, '-');
        setLevelFeat(this.plan, level, category, {
          uuid: feat.uuid,
          name: feat.name,
          slug,
          img: feat.img,
          level: feat.system.level.value,
        });
        clearLevelReminders(this.plan, level, slug);
        if (MANUAL_SPELL_FEATS.has(slug)) {
          addLevelReminder(this.plan, level, {
            featSlug: slug,
            featName: feat.name,
            message: game.i18n.localize('PF2E_LEVELER.UI.MANUAL_SPELL_NOTE'),
          });
        }
        this._savePlanAndRender();
      },
    );
    picker.render(true);
  }

  async _savePlanAndRender() {
    this._capturePlannerScroll();
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
