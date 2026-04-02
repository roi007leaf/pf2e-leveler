import { MODULE_ID, MIN_PLAN_LEVEL, MAX_LEVEL, ATTRIBUTES, PROFICIENCY_RANK_NAMES, PLAN_STATUS } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { getChoicesForLevel, getLevelSummary } from '../classes/progression.js';
import { createPlan, getLevelData, setLevelBoosts, setLevelFeat, clearLevelFeat, setLevelSkillIncrease, addLevelSpell, removeLevelSpell, addLevelReminder, clearLevelReminders } from '../plan/plan-model.js';
import { getPlan, savePlan, clearPlan, exportPlan, importPlan } from '../plan/plan-store.js';
import { validateLevel } from '../plan/plan-validator.js';
import { computeBuildState } from '../plan/build-state.js';
import { getMaxSkillRank, isFreeArchetypeEnabled, isMythicEnabled, isABPEnabled, isGradualBoostsEnabled, isDualClassEnabled } from '../utils/pf2e-api.js';
import { localize } from '../utils/i18n.js';
import { debug } from '../utils/logger.js';
import { FeatPicker } from './feat-picker.js';

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
      ...this._buildLevelContext(classDef, options),
    };
  }

  _onRender(_context, _options) {
    const html = this.element;
    this._activateListeners(html);
  }

  _getVariantOptions() {
    return {
      freeArchetype: isFreeArchetypeEnabled(),
      mythic: isMythicEnabled(),
      abp: isABPEnabled(),
      gradualBoosts: isGradualBoostsEnabled(),
      dualClass: isDualClassEnabled(),
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

  _buildLevelContext(classDef, options) {
    if (!this.plan || !classDef) return {};

    const level = this.selectedLevel;
    const levelData = getLevelData(this.plan, level) ?? {};
    const choices = getChoicesForLevel(classDef, level, options);
    const choiceTypes = new Set(choices.map((c) => c.type));

    return {
      classFeatures: this._getClassFeaturesForLevel(level),
      showBoosts: choiceTypes.has('abilityBoosts'),
      boostCount: choices.find((c) => c.type === 'abilityBoosts')?.count ?? 4,
      attributes: this._buildAttributeContext(levelData, choices),
      showClassFeat: choiceTypes.has('classFeat'),
      classFeat: this._annotateFeat(this._extractFeat(levelData.classFeats)),
      showSkillFeat: choiceTypes.has('skillFeat'),
      skillFeat: this._annotateFeat(this._extractFeat(levelData.skillFeats)),
      showGeneralFeat: choiceTypes.has('generalFeat'),
      generalFeat: this._annotateFeat(this._extractFeat(levelData.generalFeats)),
      showAncestryFeat: choiceTypes.has('ancestryFeat'),
      ancestryFeat: this._annotateFeat(this._extractFeat(levelData.ancestryFeats)),
      showSkillIncrease: choiceTypes.has('skillIncrease'),
      availableSkills: this._buildSkillContext(levelData, level),
      showArchetypeFeat: choiceTypes.has('archetypeFeat'),
      archetypeFeat: this._extractFeat(levelData.archetypeFeats),
      showMythicFeat: choiceTypes.has('mythicFeat'),
      mythicFeat: this._extractFeat(levelData.mythicFeats),
      showDualClassFeat: choiceTypes.has('dualClassFeat'),
      dualClassFeat: this._extractFeat(levelData.dualClassFeats),
      ...this._buildABPContext(level, options),
      ...this._buildSpellContext(classDef, level),
    };
  }

  _buildAttributeContext(levelData, choices) {
    const selectedBoosts = levelData.abilityBoosts ?? [];
    const buildState = computeBuildState(this.actor, this.plan, this.selectedLevel - 1);
    const maxBoosts = choices?.find((c) => c.type === 'abilityBoosts')?.count ?? 4;
    const boostsRemaining = maxBoosts - selectedBoosts.length;

    return ATTRIBUTES.map((key) => {
      const mod = buildState.attributes[key] ?? 0;
      const isPartial = mod >= 4;
      const selected = selectedBoosts.includes(key);
      const newMod = selected ? mod + 1 : mod;
      return {
        key,
        label: key.toUpperCase(),
        mod,
        newMod,
        selected,
        partial: isPartial,
        cost: 1,
        disabled: !selected && boostsRemaining <= 0,
      };
    });
  }

  _buildSkillContext(levelData, level) {
    const maxRank = getMaxSkillRank(level);
    const buildState = computeBuildState(this.actor, this.plan, level - 1);
    const currentIncrease = levelData.skillIncreases?.[0];

    const skills = Object.entries(buildState.skills).map(([slug, rank]) => {
      const nextRank = rank + 1;
      return {
        slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        rank,
        rankName: PROFICIENCY_RANK_NAMES[rank],
        nextRankName: PROFICIENCY_RANK_NAMES[Math.min(nextRank, 4)],
        maxed: nextRank > maxRank,
        selected: currentIncrease?.skill === slug,
      };
    });

    return skills.filter((s) => !s.maxed || s.selected);
  }

  _buildSpellContext(classDef, level) {
    if (!classDef.spellcasting) return { showSpells: false };

    const slots = classDef.spellcasting.slots;
    const currentSlots = slots[level];
    if (!currentSlots) return { showSpells: false };
    const prevSlots = slots[level - 1] ?? this._getActorSpellCounts();

    const levelData = getLevelData(this.plan, level) ?? {};
    const plannedSpells = levelData.spells ?? [];
    const spellSlots = this._buildSpellSlotDisplay(currentSlots, prevSlots, plannedSpells);
    const hasNewRank = this._detectNewSpellRank(currentSlots, prevSlots);
    const highestRank = this._getHighestRank(currentSlots);
    const newRank = hasNewRank ? this._ordinalRank(highestRank) : null;

    const apparitionContext = this._buildApparitionContext(classDef, level);

    const canSelectSpells = classDef.spellcasting.type === 'spontaneous' || classDef.slug === 'wizard';
    const isWizard = classDef.slug === 'wizard';
    const wizardSpellbookCount = isWizard ? 2 : 0;

    return {
      showSpells: true,
      spellTradition: classDef.spellcasting.tradition,
      spellType: classDef.spellcasting.type,
      isSpontaneous: canSelectSpells,
      isWizard,
      wizardSpellbookCount,
      spellSlots,
      hasNewRank,
      newRank,
      plannedSpells: canSelectSpells ? plannedSpells : [],
      highestRank: this._getHighestRank(currentSlots),
      ...apparitionContext,
    };
  }

  _buildSpellSlotDisplay(currentSlots, prevSlots, plannedSpells) {
    const plannedByRank = {};
    for (const spell of plannedSpells) {
      plannedByRank[spell.rank] = (plannedByRank[spell.rank] ?? 0) + 1;
    }

    const display = [];
    for (const [rank, counts] of Object.entries(currentSlots)) {
      const isDual = Array.isArray(counts);
      const total = isDual ? counts[0] + counts[1] : counts;
      const primary = isDual ? counts[0] : counts;
      const secondary = isDual ? counts[1] : 0;

      if (rank === 'cantrips') {
        const prevCantrips = prevSlots?.cantrips;
        const prevTotal = prevCantrips == null ? 0 : (Array.isArray(prevCantrips) ? prevCantrips[0] + prevCantrips[1] : prevCantrips);
        const newCantrips = total - prevTotal;
        const planned = plannedByRank[0] ?? 0;
        display.push({
          rank: 'Cantrips',
          isCantrips: true,
          total,
          newSlots: newCantrips,
          planned,
          isFull: newCantrips <= 0 || planned >= newCantrips,
          hasNew: newCantrips > 0,
          isDual,
        });
        continue;
      }

      const rankNum = Number(rank);
      const prevVal = prevSlots?.[rank];
      const prevTotal = prevVal == null ? null : (Array.isArray(prevVal) ? prevVal[0] + prevVal[1] : prevVal);
      const isNew = prevTotal === null;
      const newSlots = isNew ? total : total - prevTotal;
      const changed = isNew || prevTotal !== total;
      const planned = plannedByRank[rankNum] ?? 0;
      const isFull = planned >= newSlots;

      display.push({
        rank: this._ordinalRank(rankNum),
        rankNum,
        primary,
        secondary,
        total,
        newSlots,
        planned,
        hasNew: newSlots > 0,
        isFull,
        isDual,
        isNew,
        changed,
      });
    }
    return display;
  }

  _detectNewSpellRank(currentSlots, prevSlots) {
    if (!prevSlots) return true;
    const currentRanks = Object.keys(currentSlots).filter((k) => k !== 'cantrips');
    const prevRanks = Object.keys(prevSlots).filter((k) => k !== 'cantrips');
    return currentRanks.length > prevRanks.length;
  }

  _getHighestRank(slots) {
    const ranks = Object.keys(slots).filter((k) => k !== 'cantrips').map(Number);
    return Math.max(...ranks);
  }

  _ordinalRank(n) {
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${n}${suffixes[n] || 'th'}`;
  }

  _buildABPContext(level, options) {
    if (!options.abp) return { showABP: false };

    const ABP_NEW_POTENCY = [3, 6, 9, 13, 15, 17, 20];
    const ABP_UPGRADE_TO_2 = [9, 13, 15, 17, 20];
    const ABP_UPGRADE_TO_3 = [17, 20];

    const hasNew = ABP_NEW_POTENCY.includes(level);
    const hasUpgrade2 = ABP_UPGRADE_TO_2.includes(level);
    const hasUpgrade3 = ABP_UPGRADE_TO_3.includes(level);

    if (!hasNew && !hasUpgrade2 && !hasUpgrade3) return { showABP: false };

    return {
      showABP: true,
      abpHasNew: hasNew,
      abpHasUpgrade2: hasUpgrade2,
      abpHasUpgrade3: hasUpgrade3,
    };
  }

  _buildApparitionContext(classDef, level) {
    if (!classDef.apparitions) return { showApparitions: false };

    const prog = classDef.apparitions.attunementProgression;
    const newAttunement = prog[level];
    if (!newAttunement) return { showApparitions: false };

    const focusProg = classDef.apparitions.focusPoolProgression;
    const newFocusPool = focusProg[level];

    return {
      showApparitions: true,
      attunementSlots: newAttunement,
      newFocusPool,
      availableApparitions: classDef.apparitions.list,
    };
  }

  _getActorSpellCounts() {
    const spells = this.actor.items?.filter?.((i) => i.type === 'spell') ?? [];
    if (spells.length === 0) return null;

    const counts = {};
    let cantripCount = 0;

    for (const spell of spells) {
      const isCantrip = spell.system?.traits?.value?.includes('cantrip');
      if (isCantrip) {
        cantripCount++;
      } else {
        const rank = spell.system?.level?.value ?? 0;
        if (rank > 0) counts[rank] = (counts[rank] ?? 0) + 1;
      }
    }

    if (cantripCount > 0) counts.cantrips = cantripCount;

    return Object.keys(counts).length > 0 ? counts : null;
  }

  _getClassFeaturesForLevel(level) {
    const classItem = this.actor.class;
    if (!classItem?.system?.items) return [];

    return Object.values(classItem.system.items)
      .filter((f) => f.level === level)
      .map((f) => ({ name: f.name, uuid: f.uuid, img: f.img }));
  }

  _annotateFeat(feat) {
    if (!feat) return null;
    if (MANUAL_SPELL_FEATS.has(feat.slug)) {
      feat.manualSpellNote = true;
    }
    return feat;
  }

  _extractFeat(feats) {
    if (!feats || feats.length === 0) return null;
    return feats[0];
  }

  _activateListeners(html) {
    const el = html.querySelectorAll ? html : html[0];

    el.querySelectorAll('[data-action="selectLevel"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const level = Number(e.currentTarget.dataset.level);
        this.selectedLevel = level;
        this.render(true);
      });
    });

    el.querySelectorAll('[data-action="toggleBoost"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const attr = e.currentTarget.dataset.attr;
        this._handleBoostToggle(attr);
      });
    });

    el.querySelectorAll('[data-action="viewFeat"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uuid = e.currentTarget.dataset.uuid;
        if (!uuid) return;
        const item = await fromUuid(uuid);
        if (item?.sheet) item.sheet.render(true);
      });
    });

    el.querySelectorAll('[data-action="openFeatPicker"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const category = e.currentTarget.dataset.category;
        const level = Number(e.currentTarget.dataset.level);
        this._openFeatPicker(category, level);
      });
    });

    el.querySelectorAll('[data-action="clearFeat"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = e.currentTarget.dataset.category;
        const level = Number(e.currentTarget.dataset.level);
        const levelData = getLevelData(this.plan, level);
        const feat = levelData?.[category]?.[0];
        if (feat?.slug) clearLevelReminders(this.plan, level, feat.slug);
        clearLevelFeat(this.plan, level, category);
        this._savePlanAndRender();
      });
    });

    el.querySelectorAll('[data-action="selectSkillIncrease"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slug = btn.dataset.skill;
        if (!slug) return;
        const buildState = computeBuildState(this.actor, this.plan, this.selectedLevel - 1);
        const currentRank = buildState.skills[slug] ?? 0;
        setLevelSkillIncrease(this.plan, this.selectedLevel, {
          skill: slug,
          toRank: currentRank + 1,
        });
        this._savePlanAndRender();
      });
    });

    el.querySelectorAll('[data-action="openSpellPicker"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rank = Number(btn.dataset.rank);
        this._openSpellPicker(rank);
      });
    });

    el.querySelectorAll('[data-action="removeSpell"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btn.dataset.uuid;
        removeLevelSpell(this.plan, this.selectedLevel, uuid);
        this._savePlanAndRender();
      });
    });

    el.querySelector('[data-action="exportPlan"]')?.addEventListener('click', () => {
      this._exportPlan();
    });

    el.querySelector('[data-action="importPlan"]')?.addEventListener('click', () => {
      this._importPlan();
    });

    el.querySelector('[data-action="clearPlan"]')?.addEventListener('click', () => {
      this._clearPlan();
    });
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
    const tradition = classDef.spellcasting.tradition;
    if (!['bloodline', 'patron'].includes(tradition)) return tradition;
    const entry = this.actor.items?.find?.((i) => i.type === 'spellcastingEntry');
    return entry?.system?.tradition?.value ?? 'arcane';
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
    await savePlan(this.actor, this.plan);
    this.render(true);
  }
}
