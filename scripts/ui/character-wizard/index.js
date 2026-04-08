import { MODULE_ID, SKILLS, ATTRIBUTES, SUBCLASS_TAGS, ANCESTRY_TRAIT_ALIASES, WEALTH_MODES, CHARACTER_WEALTH, PERMANENT_ITEM_TYPES, expandPermanentItemSlots } from '../../constants.js';
import { getCompendiumKeysForCategory } from '../../compendiums/catalog.js';
import { ClassRegistry } from '../../classes/registry.js';
import { createCreationData, setAncestry, setHeritage, setBackground, setClass, setImplement, setSubconsciousMind, setThesis, setDeity, setSkills, setLanguages, setLores, addSpell, setGrantedFeatSections, setAncestryFeat, setAncestryParagonFeat, setClassFeat, setSkillFeat, setFeatChoice, addEquipment, setPermanentItem } from '../../creation/creation-model.js';
import { getCreationData, saveCreationData, exportCreationData, importCreationData } from '../../creation/creation-store.js';
import { applyCreation } from '../../creation/apply-creation.js';
import { localize } from '../../utils/i18n.js';
import { registerHandlebarsHelpers } from '../../hooks/lifecycle.js';
import { getClassHandler } from '../../creation/class-handlers/registry.js';
import { isAncestralParagonEnabled } from '../../utils/pf2e-api.js';
import { captureScrollState, restoreScrollState } from '../shared/scroll-state.js';
import {
  buildFeatChoicesContext,
  buildSubclassChoicesContext,
  extractChoiceValue,
  findMatchingChoiceOption,
  formatChoiceLabel,
  getPendingChoices,
  getSelectedChoiceLabels,
  getSelectedFeatChoiceLabels,
  getSelectedSubclassChoiceLabels,
  hydrateChoiceSets,
  parseChoiceSets,
  refreshGrantedFeatChoiceSections,
} from './choice-sets.js';
import {
  buildApplyOverlayContext,
  getApplyPromptRows,
  getPromptMatchTexts,
  matchActivePromptRow,
  normalizePromptText,
  resolvePromptSelectionLabel,
} from './apply-overlay.js';
import { buildSummaryContext } from './summary.js';
import {
  buildLanguageContext,
  buildSkillContext,
  collectFeatLanguageGrants,
  getBackgroundLores,
  getBackgroundTrainedSkills,
  getLanguageMap,
  parseSubclassLores,
} from './skills-languages.js';
import { activateCharacterWizardListeners } from './listeners.js';
import {
  buildSpellContext,
  getSanitizedCurriculumSelections,
  limitCurriculumSelections,
  resolveFocusSpells,
  resolveGrantedSpells,
  resolveSummaryCurriculumSpells,
  resolveSummaryFocusSpells,
} from './spells.js';
import {
  loadCommanderTactics,
  loadCompendium,
  loadCompendiumCategory,
  loadAncestries,
  loadBackgrounds,
  loadClasses,
  loadDeities,
  loadExemplarIkons,
  loadHeritages,
  loadInventorArmorModifications,
  loadInventorArmorOptions,
  loadInventorWeaponModifications,
  loadInventorWeaponOptions,
  loadKineticImpulses,
  loadRawHeritages,
  loadSubclasses,
  loadTaggedClassFeatures,
  loadThaumaturgeImplements,
  loadTheses,
  parseCurriculum,
  parseSpellUuidsFromDescription,
  parseVesselSpell,
} from './loaders.js';
import { annotateGuidance, annotateGuidanceBySlug, sortByGuidancePriority } from '../../access/content-guidance.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
registerHandlebarsHelpers();

const STEPS = ['ancestry', 'heritage', 'background', 'class', 'deity', 'sanctification', 'divineFont', 'subclass', 'implement', 'tactics', 'ikons', 'innovationDetails', 'kineticGate', 'subconsciousMind', 'thesis', 'apparitions', 'subclassChoices', 'boosts', 'skills', 'feats', 'featChoices', 'languages', 'spells', 'equipment', 'summary'];

function equipmentTotalCp(equipment) {
  let cp = 0;
  for (const entry of equipment) {
    if (!entry.price) continue;
    const qty = entry.quantity ?? 1;
    const per = entry.pricePer ?? 1;
    const unitCp = (entry.price.gp ?? 0) * 100 + (entry.price.sp ?? 0) * 10 + (entry.price.cp ?? 0);
    cp += Math.ceil((qty / per) * unitCp);
  }
  return cp;
}

function normalizeCp(totalCp) {
  const gp = Math.floor(totalCp / 100);
  const sp = Math.floor((totalCp % 100) / 10);
  const cp = totalCp % 10;
  return { gp, sp, cp };
}
const HANDLER_STEP_IDS = new Set(['deity', 'sanctification', 'divineFont', 'implement', 'tactics', 'ikons', 'innovationDetails', 'kineticGate', 'subconsciousMind', 'thesis', 'apparitions']);

export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super();
    this.actor = actor;
    const storedCreationData = getCreationData(actor);
    this.data = storedCreationData ?? createCreationData();
    this.currentStep = 0;
    this.featSubStep = 'ancestry';
    this.spellSubStep = 'cantrips';
    this.classHandler = getClassHandler(this.data.class?.slug);
    this._compendiumCache = {};
    this._documentCache = new Map();
    this.isApplying = false;
    this.applyProgress = 0;
    this.applyStatus = '';
    this._applyPromptWatcher = null;
    this._activeSystemPrompt = null;
    this._backgroundSkillFilters = new Set();
    this._backgroundAttributeFilters = new Set();
    this._featChoiceDataDirty = true;
    this._applyPromptRowsCache = null;
    this._compendiumSourceFilters = {};
    this._spellLayoutObserver = null;
    this._isBooting = true;
    this._bootstrapPromise = null;
    this._missingStoredCreationData = !storedCreationData;
    this._cachedHasClassFeatAtLevel1 = null;
    this._cachedRequiredClassBoostSelections = 0;
    this._cachedBoostStepComplete = null;
  }

  _preloadCompendiums() {
    ['feats', 'spells', 'classFeatures', 'ancestries', 'backgrounds', 'classes'].forEach((category) => {
      this._loadCompendiumCategory(category);
    });
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-wizard',
    classes: ['pf2e-leveler'],
    position: { width: 850, height: 700 },
    window: { resizable: true },
  };

  static PARTS = {
    wizard: { template: `modules/${MODULE_ID}/templates/character-wizard.hbs` },
  };

  get title() {
    return `${this.actor.name} — ${localize('CREATION.TITLE')}`;
  }

  get stepId() {
    return STEPS[this.currentStep];
  }

  get visibleSteps() {
    const handler = this.classHandler;
    const extraSteps = handler.getExtraSteps();
    const extraIds = new Set(extraSteps.map((s) => s.id));
    return STEPS.filter((s) => {
      if (s === 'subclass') return this._hasSubclass();
      if (s === 'subclassChoices') return this._hasSubclassChoices();
      if (s === 'featChoices') return this._hasFeatChoices();
      if (s === 'languages') return !!this.data.ancestry;
      if (s === 'spells') return this._needsSpellSelection();
      // Handler-managed steps (deity, sanctification, etc.)
      if (extraIds.has(s)) return extraSteps.find((e) => e.id === s).visible(this.data);
      // Hide handler steps that aren't registered for this class
      if (HANDLER_STEP_IDS.has(s) && !extraIds.has(s)) return false;
      return true;
    });
  }

  _hasSubclass() {
    return !!SUBCLASS_TAGS[this.data.class?.slug];
  }

  _hasSubclassChoices() {
    return this.classHandler.shouldShowSubclassChoices(this.data);
  }

  _hasFeatChoices() {
    return (this.data.ancestryFeat?.choiceSets?.length ?? 0) > 0
      || (this.data.ancestryParagonFeat?.choiceSets?.length ?? 0) > 0
      || (this.data.classFeat?.choiceSets?.length ?? 0) > 0
      || (this.data.skillFeat?.choiceSets?.length ?? 0) > 0
      || (this.data.grantedFeatSections?.length ?? 0) > 0;
  }


  async _prepareContext() {
    this._cachedHasClassFeatAtLevel1 = this.data.class?.uuid ? await this._hasClassFeatAtLevel1() : false;
    this._cachedRequiredClassBoostSelections = await this._getRequiredClassBoostSelections();
    this._cachedBoostStepComplete = await this._computeBoostStepComplete();
    const extraSteps = this.classHandler.getExtraSteps();
    const extraLabels = {
      featChoices: localize('CREATION.FEAT_CHOICES'),
      ...Object.fromEntries(extraSteps.filter((s) => s.label).map((s) => [s.id, s.label])),
    };
    const steps = this.visibleSteps.map((id) => ({
      id,
      label: extraLabels[id] ?? localize(`CREATION.STEPS.${id.toUpperCase()}`),
      active: STEPS.indexOf(id) === this.currentStep,
      complete: this._isStepComplete(id),
      index: STEPS.indexOf(id),
    }));

    if (this._isBooting) {
      return {
        steps,
        stepId: this.stepId,
        data: this.data,
        isApplying: false,
        isBooting: true,
        applyProgressPercent: 0,
        applyStatus: '',
        isFirst: this.currentStep === 0,
        isLast: this.currentStep === STEPS.length - 1,
        isSummary: this.stepId === 'summary',
        allComplete: false,
        browserStep: null,
        compendiumSourceOptions: [],
        hasCompendiumSourceFilter: false,
        showGlobalCompendiumSourceFilter: false,
      };
    }

    if (this._featChoiceDataDirty) {
      await this._refreshAllFeatChoiceData();
    }
    this._cachedMaxLanguages = await this._getAdditionalLanguageCount();
    this._cachedMaxSkills = await this._getAdditionalSkillCount();
    const allComplete = this.visibleSteps.filter((s) => s !== 'summary').every((s) => this._isStepComplete(s));

    const rawStepContext = await this._getStepContext();
    const compendiumSourceOptions = buildCompendiumSourceOptions(
      this.stepId,
      rawStepContext,
      this._compendiumSourceFilters[this.stepId] ?? [],
    );
    const stepContext = filterStepContextByCompendiumSource(rawStepContext, compendiumSourceOptions);
    const browserStep = buildBrowserStepContext(this.stepId, this.data, stepContext);
    if (browserStep?.stepId === 'background') {
      browserStep.backgroundSkillFilters = (browserStep.backgroundSkillFilters ?? []).map((entry) => ({
        ...entry,
        selected: this._backgroundSkillFilters.has(entry.value),
      }));
      browserStep.backgroundAttributeFilters = (browserStep.backgroundAttributeFilters ?? []).map((entry) => ({
        ...entry,
        selected: this._backgroundAttributeFilters.has(entry.value),
      }));
    }
    const applyOverlay = this.isApplying ? await this._buildApplyOverlayContext() : {};

    return {
      steps,
      stepId: this.stepId,
      data: this.data,
      isApplying: this.isApplying,
      applyProgressPercent: Math.round((this.applyProgress ?? 0) * 100),
      applyStatus: this.applyStatus,
      isFirst: this.currentStep === 0,
      isLast: this.currentStep === STEPS.length - 1,
      isSummary: this.stepId === 'summary',
      allComplete,
      browserStep,
      compendiumSourceOptions,
      hasCompendiumSourceFilter: compendiumSourceOptions.length > 0,
      showGlobalCompendiumSourceFilter: compendiumSourceOptions.length > 0 && !browserStep,
      ...applyOverlay,
      ...stepContext,
    };
  }

  _onRender() {
    const el = this.element;
    this._restoreWizardScroll(el);
    this._activateListeners(el);
    this._ensureBootstrapped();
    this._syncSpellLayout(el);
  }

  _activateListeners(el) {
    activateCharacterWizardListeners(this, el);
  }

  _ensureBootstrapped() {
    if (!this._isBooting || this._bootstrapPromise) return;

    this._bootstrapPromise = Promise.resolve().then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await this._recoverCreationDataFromActor();
      this._isBooting = false;
      await this.render({ force: true, parts: ['wizard'] });
      setTimeout(() => this._preloadCompendiums(), 0);
    }).catch((error) => {
      console.error(`${MODULE_ID} | Failed to bootstrap character wizard`, error);
      this._isBooting = false;
    });
  }

  _syncSpellLayout(root) {
    this._spellLayoutObserver?.disconnect?.();
    this._spellLayoutObserver = null;

    if (this.stepId !== 'spells') return;

    const results = root.querySelector('.wizard-browser--spells .wizard-browser__results');
    if (!results) return;

    // Let CSS own the split layout. Previous JS width forcing could lock the
    // spell results pane wider than the actual available space and collapse the
    // visible list into a narrow strip.
    results.style.removeProperty('flex');
    results.style.removeProperty('width');
    results.style.removeProperty('max-width');
    results.style.removeProperty('min-width');
  }

  async _getCachedDocument(uuid) {
    if (!uuid) return null;
    if (this._documentCache.has(uuid)) return this._documentCache.get(uuid);
    const item = await fromUuid(uuid).catch(() => null);
    this._documentCache.set(uuid, item);
    return item;
  }

  async _recoverCreationDataFromActor() {
    if (!this._missingStoredCreationData) return;

    const recoveredData = createCreationData();
    const ancestry = this._toRecoveredDocumentRef(this.actor?.ancestry);
    const heritage = this._toRecoveredDocumentRef(this.actor?.heritage);
    const background = this._toRecoveredDocumentRef(this.actor?.background);
    const classItem = this._toRecoveredDocumentRef(this.actor?.class);
    const deity = this._findActorItemByType('deity');

    if (ancestry) setAncestry(recoveredData, ancestry);
    if (heritage) setHeritage(recoveredData, heritage);
    if (background) setBackground(recoveredData, background);
    if (classItem) setClass(recoveredData, classItem);
    if (deity) {
      setDeity(recoveredData, {
        uuid: this._getItemDocumentUuid(deity),
        name: deity.name,
        img: deity.img,
        font: deity.system?.font ?? [],
        sanctification: deity.system?.sanctification ?? {},
        domains: deity.system?.domains ?? { primary: [], alternate: [] },
        skill: deity.system?.skill ?? null,
      });
    }

    await this._recoverFeatSlotFromActor(recoveredData, 'ancestryFeat', ['ancestry-1']);
    await this._recoverFeatSlotFromActor(recoveredData, 'ancestryParagonFeat', ['ancestryparagon-1', 'xdy_ancestryparagon-1']);
    await this._recoverFeatSlotFromActor(recoveredData, 'classFeat', ['class-1']);
    await this._recoverFeatSlotFromActor(recoveredData, 'skillFeat', ['skill-1']);

    if (!this._hasRecoveredCreationSelections(recoveredData)) return;

    this.data = recoveredData;
    this.classHandler = getClassHandler(this.data.class?.slug);
    this._missingStoredCreationData = false;
    await this._refreshGrantedFeatChoiceSections();
    await saveCreationData(this.actor, this.data);
  }

  async _recoverFeatSlotFromActor(data, slot, locationKeys) {
    const actorItem = this._findActorItemByLocation(locationKeys);
    if (!actorItem) return;

    const sourceUuid = this._getItemDocumentUuid(actorItem);
    const sourceItem = sourceUuid ? await this._getCachedDocument(sourceUuid) : null;
    const feat = sourceItem ?? actorItem;
    const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
    const grantedLores = this._parseSubclassLores(feat.system?.rules ?? [], feat.system?.description?.value ?? '');

    switch (slot) {
      case 'ancestryFeat':
        setAncestryFeat(data, feat, choiceSets, grantedLores);
        break;
      case 'ancestryParagonFeat':
        setAncestryParagonFeat(data, feat, choiceSets, grantedLores);
        break;
      case 'classFeat':
        setClassFeat(data, feat, choiceSets, grantedLores);
        break;
      case 'skillFeat':
        setSkillFeat(data, feat, choiceSets, grantedLores);
        break;
      default:
        break;
    }
  }

  _findActorItemByLocation(locationKeys = []) {
    const normalizedLocations = new Set((locationKeys ?? []).map((value) => String(value).trim().toLowerCase()));
    if (normalizedLocations.size === 0) return null;
    return this._getActorItems().find((item) => normalizedLocations.has(this._getItemLocation(item)));
  }

  _findActorItemByType(type) {
    const normalizedType = String(type ?? '').trim().toLowerCase();
    if (!normalizedType) return null;
    return this._getActorItems().find((item) => String(item?.type ?? '').trim().toLowerCase() === normalizedType);
  }

  _getActorItems() {
    const actorItems = this.actor?.items;
    if (Array.isArray(actorItems)) return actorItems;
    if (Array.isArray(actorItems?.contents)) return actorItems.contents;
    return [];
  }

  _getItemLocation(item) {
    const location = item?.system?.location;
    const value = typeof location === 'string' ? location : location?.value;
    return String(value ?? '').trim().toLowerCase();
  }

  _getItemDocumentUuid(item) {
    const sourceId = item?.sourceId ?? item?.flags?.core?.sourceId ?? null;
    if (typeof sourceId === 'string' && sourceId.length > 0) return sourceId;
    const uuid = item?.uuid ?? null;
    return typeof uuid === 'string' && uuid.length > 0 ? uuid : null;
  }

  _toRecoveredDocumentRef(item) {
    if (!item) return null;
    const uuid = this._getItemDocumentUuid(item);
    const name = typeof item.name === 'string' ? item.name : '';
    const slug = item.slug ?? item.system?.slug ?? null;
    if (!uuid && !slug && !name) return null;
    return {
      uuid,
      name,
      img: item.img,
      slug,
    };
  }

  _hasRecoveredCreationSelections(data) {
    return !!(
      data?.ancestry
      || data?.heritage
      || data?.background
      || data?.class
      || data?.deity
      || data?.ancestryFeat
      || data?.ancestryParagonFeat
      || data?.classFeat
      || data?.skillFeat
    );
  }

  async _selectItem(uuid) {
    const item = await this._getCachedDocument(uuid);
    if (!item) return;

    switch (this.stepId) {
      case 'ancestry':
        setAncestry(this.data, item);
        break;
      case 'heritage':
        setHeritage(this.data, item);
        break;
      case 'background':
        setBackground(this.data, item);
        break;
      case 'class':
        setClass(this.data, item);
        this.classHandler = getClassHandler(item.slug);
        break;
      case 'implement':
        setImplement(this.data, item);
        break;
      case 'subconsciousMind':
        setSubconsciousMind(this.data, item);
        break;
      case 'thesis':
        setThesis(this.data, item);
        break;
      case 'deity': {
        const font = item.system?.font ?? [];
        const sanctification = item.system?.sanctification ?? {};
        const domains = item.system?.domains ?? { primary: [], alternate: [] };
        const skill = item.system?.skill ?? null;
        setDeity(this.data, { uuid: item.uuid, name: item.name, img: item.img, font, sanctification, domains, skill });
        break;
      }
      default:
        break;
    }

    if (['ancestry', 'heritage', 'background', 'class', 'deity'].includes(this.stepId)) {
      await this._refreshGrantedFeatChoiceSections();
    }

    await this._saveAndRender();
  }

  _toggleBoost(attr, source) {
    const max = this._boostMaxForSource[source] ?? 0;
    const boosts = [...(this.data.boosts[source] ?? [])];
    const idx = boosts.indexOf(attr);
    if (idx >= 0) {
      boosts.splice(idx, 1);
    } else if (boosts.length < max) {
      boosts.push(attr);
    }
    this.data.boosts[source] = boosts;
    this._saveAndRender();
  }

  async _toggleSkill(skill) {
    let skills = [...this.data.skills];
    if (skills.includes(skill)) {
      skills = skills.filter((s) => s !== skill);
    } else {
      const maxSkills = await this._getAdditionalSkillCount();
      if (skills.length < maxSkills) {
        skills.push(skill);
      }
    }
    setSkills(this.data, skills);
    this._featChoiceDataDirty = true;
    this._saveAndRender();
  }

  async _toggleLanguage(lang) {
    let languages = [...this.data.languages];
    if (languages.includes(lang)) {
      languages = languages.filter((l) => l !== lang);
    } else {
      const max = await this._getAdditionalLanguageCount();
      if (languages.length < max) {
        languages.push(lang);
      }
    }
    setLanguages(this.data, languages);
    this._saveAndRender();
  }

  async _openFeatPicker(slot) {
    const buildState = await this._buildCreationFeatBuildState();

    const classSlug = String(this.data.class?.slug ?? '').toLowerCase();
    const ancestryTraits = buildState.ancestryTraits instanceof Set ? [...buildState.ancestryTraits] : [];
    const presets = {
      ancestry: {
        selectedFeatTypes: ['ancestry'],
        lockedFeatTypes: ['ancestry'],
        selectedTraits: ancestryTraits,
        lockedTraits: ancestryTraits,
        traitLogic: 'or',
        maxLevel: 1,
        lockMaxLevel: true,
      },
      paragon: {
        selectedFeatTypes: ['ancestry'],
        lockedFeatTypes: ['ancestry'],
        selectedTraits: ancestryTraits,
        lockedTraits: ancestryTraits,
        traitLogic: 'or',
        maxLevel: 1,
        lockMaxLevel: true,
      },
      class: {
        selectedFeatTypes: ['class'],
        lockedFeatTypes: ['class'],
        extraVisibleFeatTypes: ['archetype'],
        selectedTraits: [classSlug].filter(Boolean),
        lockedTraits: [classSlug].filter(Boolean),
        traitLogic: 'or',
        showDedications: true,
        maxLevel: 1,
        lockMaxLevel: true,
      },
      skill: {
        selectedFeatTypes: ['skill'],
        lockedFeatTypes: ['skill'],
        maxLevel: 1,
        lockMaxLevel: true,
      },
    };

    const callbacks = {
      ancestry: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedLores = this._parseSubclassLores(feat.system?.rules ?? [], feat.system?.description?.value ?? '');
        setAncestryFeat(this.data, feat, choiceSets, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      paragon: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedLores = this._parseSubclassLores(feat.system?.rules ?? [], feat.system?.description?.value ?? '');
        setAncestryParagonFeat(this.data, feat, choiceSets, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      class: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedLores = this._parseSubclassLores(feat.system?.rules ?? [], feat.system?.description?.value ?? '');
        setClassFeat(this.data, feat, choiceSets, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      skill: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedLores = this._parseSubclassLores(feat.system?.rules ?? [], feat.system?.description?.value ?? '');
        setSkillFeat(this.data, feat, choiceSets, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
    };

    const categoryBySlot = { ancestry: 'ancestry', paragon: 'ancestry', class: 'class', skill: 'skill' };
    const { FeatPicker } = await import('../feat-picker.js');
    const picker = new FeatPicker(
      this.actor,
      categoryBySlot[slot] ?? 'ancestry',
      1,
      buildState,
      callbacks[slot],
      { preset: presets[slot] },
    );
    picker.render(true);
  }

  async _openFeatChoicePicker(slot, flag) {
    const choiceContainer = this._getFeatChoiceContainer(slot);
    if (!choiceContainer) return;

    const currentChoices = this._getFeatChoiceValues(slot);
    const choiceSets = await this._hydrateChoiceSets(choiceContainer.choiceSets ?? [], currentChoices);
    const choiceSet = choiceSets.find((entry) => entry.flag === flag);
    if (!choiceSet?.isFeatChoice) return;

    const buildState = await this._buildCreationFeatBuildState();
    const preset = this._buildFeatChoicePickerPreset(choiceSet, buildState);
    const targetLevel = Number(preset.maxLevel ?? 20) || 20;

    const { FeatPicker } = await import('../feat-picker.js');
    const picker = new FeatPicker(
      this.actor,
      'custom',
      targetLevel,
      buildState,
      async (feat) => {
        const selectedOption = findMatchingChoiceOption(choiceSet.options, feat.uuid ?? feat.sourceId ?? feat.slug ?? feat.name);
        const selectedValue = extractChoiceValue(selectedOption) || feat.uuid || feat.sourceId || feat.slug || feat.name;
        setFeatChoice(this.data, slot, flag, selectedValue);
        this._featChoiceDataDirty = true;
        await this._saveAndRender();
      },
      {
        preset,
        title: `${choiceContainer.featName ?? choiceContainer.name ?? 'Feat Choice'} | ${choiceSet.prompt}`,
      },
    );
    picker.render(true);
  }

  async _buildCreationFeatBuildState() {
    const classSlug = String(this.data.class?.slug ?? '').toLowerCase();
    const ancestrySlug = this.data.ancestry?.slug ?? null;
    const heritageSlug = this.data.heritage?.slug ?? null;
    const adoptedAncestryTraits = await getAdoptedAncestryFeatTraits(this);
    const heritageGrantedTraits = await this._collectHeritageGrantedTraits();
    const ancestryTraits = [...new Set([
      ...collectAncestryFeatTraits(ancestrySlug, heritageSlug),
      ...adoptedAncestryTraits,
      ...heritageGrantedTraits,
    ])];

    const senses = await this._collectSenses();
    const [classSkillsForState, bgSkillsForState] = await Promise.all([
      this._getClassTrainedSkills(),
      this._getBackgroundTrainedSkills(),
    ]);
    const allTrainedSkills = [
      ...classSkillsForState,
      ...bgSkillsForState,
      ...(this.data.subclass?.grantedSkills ?? []),
      ...(this.data.deity?.skill ? [this.data.deity.skill] : []),
      ...this.data.skills,
    ];
    const skillsMap = Object.fromEntries(allTrainedSkills.map((s) => [s, 1]));

    return {
      class: { slug: classSlug },
      feats: new Set(),
      ancestryTraits: new Set(ancestryTraits),
      senses,
      skills: skillsMap,
      divineFont: this.data.divineFont,
    };
  }

  _getFeatChoiceContainer(slot) {
    if (slot === 'ancestry') return this.data.ancestryFeat;
    if (slot === 'ancestryParagon') return this.data.ancestryParagonFeat;
    if (slot === 'class') return this.data.classFeat;
    if (slot === 'skill') return this.data.skillFeat;
    return (this.data.grantedFeatSections ?? []).find((section) => section.slot === slot) ?? null;
  }

  _getFeatChoiceValues(slot) {
    if (slot === 'ancestry') return this.data.ancestryFeat?.choices ?? {};
    if (slot === 'ancestryParagon') return this.data.ancestryParagonFeat?.choices ?? {};
    if (slot === 'class') return this.data.classFeat?.choices ?? {};
    if (slot === 'skill') return this.data.skillFeat?.choices ?? {};
    return this.data.grantedFeatChoices?.[slot] ?? {};
  }

  _buildFeatChoicePickerPreset(choiceSet, buildState) {
    const options = choiceSet?.options ?? [];
    const allowedFeatUuids = options
      .map((option) => option.uuid ?? (typeof option.value === 'string' && option.value.startsWith('Compendium.') ? option.value : null))
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);

    const levels = [...new Set(options
      .map((option) => Number(option.level ?? 0))
      .filter((level) => Number.isFinite(level) && level > 0))]
      .sort((a, b) => a - b);

    const featTypeSets = options
      .map((option) => inferFeatChoiceTypes(option, buildState))
      .filter((types) => types.size > 0);
    const lockedFeatTypes = intersectStringSets(featTypeSets);

    const ancestryTraits = buildState?.ancestryTraits instanceof Set
      ? [...buildState.ancestryTraits].map((trait) => String(trait).toLowerCase())
      : [];
    const classSlug = String(buildState?.class?.slug ?? '').toLowerCase();
    const commonTraits = intersectStringSets(options.map((option) =>
      new Set((option.traits ?? []).map((trait) => String(trait).toLowerCase()))));
    const lockedTraits = commonTraits.filter((trait) => trait === classSlug || ancestryTraits.includes(trait));

    const exactLevel = levels.length === 1 ? levels[0] : null;
    const maxLevel = levels.length > 0 ? levels[levels.length - 1] : 20;

    return {
      allowedFeatUuids,
      selectedFeatTypes: lockedFeatTypes,
      lockedFeatTypes,
      selectedTraits: lockedTraits,
      lockedTraits,
      minLevel: exactLevel ?? null,
      maxLevel,
      lockMinLevel: exactLevel != null,
      lockMaxLevel: exactLevel != null,
    };
  }

  _getWealthMode() {
    return game.settings.get(MODULE_ID, 'startingWealthMode') ?? WEALTH_MODES.DISABLED;
  }

  _getGoldBudgetCp() {
    const mode = this._getWealthMode();
    const level = this.actor.system?.details?.level?.value ?? 1;
    const entry = CHARACTER_WEALTH[level];
    if (mode === WEALTH_MODES.LUMP_SUM && entry) return entry.lumpSumGp * 100;
    if (mode === WEALTH_MODES.ITEMS_AND_CURRENCY && entry) return entry.currencyGp * 100;
    if (mode === WEALTH_MODES.CUSTOM) return (game.settings.get(MODULE_ID, 'startingEquipmentGoldLimit') ?? 0) * 100;
    return 0;
  }

  _openItemPicker() {
    import('../item-picker.js').then(({ ItemPicker }) => {
      const picker = new ItemPicker(this.actor, (item) => {
        const budgetCp = this._getGoldBudgetCp();
        if (budgetCp > 0 && !game.user.isGM) {
          const currentCp = equipmentTotalCp(this.data.equipment ?? []);
          const itemCp = ((item.system?.price?.value?.gp ?? 0) * 100)
            + ((item.system?.price?.value?.sp ?? 0) * 10)
            + (item.system?.price?.value?.cp ?? 0);
          if (currentCp + itemCp > budgetCp) {
            const limitGp = budgetCp / 100;
            ui.notifications.warn(game.i18n.format('PF2E_LEVELER.SETTINGS.EQUIPMENT_GOLD_LIMIT.EXCEEDED', { limit: limitGp }));
            return;
          }
        }
        const batchSize = Number(item.system?.price?.per ?? 1);
        addEquipment(this.data, item, batchSize > 1 ? batchSize : 1);
        this._saveAndRender();
      });
      picker.render(true);
    });
  }

  _openPermanentItemPicker(slotIndex, maxLevel) {
    import('../item-picker.js').then(({ ItemPicker }) => {
      const picker = new ItemPicker(this.actor, (item) => {
        const itemLevel = item.system?.level?.value ?? 0;
        const itemType = item.type;
        if (!game.user.isGM) {
          if (!PERMANENT_ITEM_TYPES.has(itemType)) {
            ui.notifications.warn(game.i18n.localize('PF2E_LEVELER.STARTING_WEALTH.NOT_PERMANENT'));
            return;
          }
          if (itemLevel > maxLevel) {
            ui.notifications.warn(game.i18n.format('PF2E_LEVELER.STARTING_WEALTH.LEVEL_TOO_HIGH', { max: maxLevel, item: itemLevel }));
            return;
          }
        }
        setPermanentItem(this.data, slotIndex, item);
        this._saveAndRender();
      });
      picker.render(true);
    });
  }

  _buildEquipmentContext() {
    const mode = this._getWealthMode();
    const level = this.actor.system?.details?.level?.value ?? 1;
    const entry = CHARACTER_WEALTH[level];

    const equipment = this.data.equipment ?? [];
    const totalCp = equipmentTotalCp(equipment);
    const totals = normalizeCp(totalCp);
    const totalParts = [];
    if (totals.gp) totalParts.push(`${totals.gp} gp`);
    if (totals.sp) totalParts.push(`${totals.sp} sp`);
    if (totals.cp) totalParts.push(`${totals.cp} cp`);

    const budgetCp = this._getGoldBudgetCp();
    const goldLimit = budgetCp > 0 ? budgetCp / 100 : null;
    const overBudget = goldLimit !== null && totalCp > budgetCp;
    const remainingCp = goldLimit !== null ? Math.max(0, budgetCp - totalCp) : null;
    const remaining = remainingCp !== null ? normalizeCp(remainingCp) : null;
    const remainingParts = remaining ? [] : null;
    if (remainingParts) {
      if (remaining.gp) remainingParts.push(`${remaining.gp} gp`);
      if (remaining.sp) remainingParts.push(`${remaining.sp} sp`);
      if (remaining.cp) remainingParts.push(`${remaining.cp} cp`);
      if (!remainingParts.length) remainingParts.push('0 gp');
    }

    let permanentItemSlots = null;
    if (mode === WEALTH_MODES.ITEMS_AND_CURRENCY && entry) {
      const slots = expandPermanentItemSlots(level);
      const stored = this.data.permanentItems ?? [];
      permanentItemSlots = slots.map((slot, i) => ({
        index: i,
        maxLevel: slot.level,
        filled: stored[i] ?? null,
      }));
    }

    return {
      wealthMode: mode,
      characterLevel: level,
      equipment: equipment.map((entry) => ({ ...entry })),
      equipmentTotal: totalParts.join(', ') || null,
      goldLimit,
      goldLimitLabel: mode === WEALTH_MODES.ITEMS_AND_CURRENCY
        ? game.i18n.format('PF2E_LEVELER.STARTING_WEALTH.CURRENCY_BUDGET', { gp: goldLimit })
        : null,
      remaining: remainingParts?.join(', ') ?? null,
      overBudget,
      permanentItemSlots,
    };
  }

  _openSpellPicker(rank, isCantrip) {
    if (!this._isCaster()) return;
    const classDef = ClassRegistry.get(this.data.class.slug);
    let tradition = classDef.spellcasting.tradition;
    if (['bloodline', 'patron'].includes(tradition)) {
      tradition = this.data.subclass?.tradition ?? 'arcane';
    }

    const currentSpells = isCantrip ? this.data.spells.cantrips : this.data.spells.rank1;
    const max = isCantrip ? (this._cachedMaxCantrips ?? null) : (this._cachedMaxRank1 ?? null);
    const remaining = max != null ? max - currentSpells.length : null;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        tradition,
        rank,
        (spells) => {
          for (const spell of spells) addSpell(this.data, spell, isCantrip);
          this._saveAndRender();
        },
        {
          exactRank: true,
          multiSelect: true,
          excludedUuids: currentSpells.map((s) => s.uuid),
          selectedSpells: currentSpells,
          maxSelect: remaining,
        },
      );
      picker.render(true);
    });
  }

  _filterItems(el, query) {
    const effectiveQuery = typeof query === 'string'
      ? query
      : (el.querySelector?.('[data-action="searchItems"]')?.value?.toLowerCase() ?? '');
    const hiddenRarities = new Set(
      [...(el.querySelectorAll?.('[data-action="toggleRarity"]') ?? [])]
        .filter((toggle) => !toggle.checked)
        .map((toggle) => toggle.dataset.rarity),
    );
    const requiredSkills = el.querySelector?.('[data-action="toggleBackgroundSkillFilter"]')
      ? new Set(this._backgroundSkillFilters)
      : new Set();
    const requiredAttributes = el.querySelector?.('[data-action="toggleBackgroundAttributeFilter"]')
      ? new Set(this._backgroundAttributeFilters)
      : new Set();

    el.querySelectorAll('.wizard-item, .skill-btn[data-name]').forEach((item) => {
      const name = item.dataset.name?.toLowerCase() ?? '';
      const rarity = item.dataset.rarity || 'common';
      const itemSkills = String(item.dataset.skills ?? '').split(',').filter(Boolean);
      const itemAttributes = String(item.dataset.attributes ?? '').split(',').filter(Boolean);
      const matchesQuery = name.includes(effectiveQuery);
      const matchesRarity = !hiddenRarities.has(rarity);
      const matchesSkills = requiredSkills.size === 0 || itemSkills.some((skill) => requiredSkills.has(skill));
      const matchesAttributes = requiredAttributes.size === 0 || itemAttributes.some((attr) => requiredAttributes.has(attr));
      item.style.display = matchesQuery && matchesRarity && matchesSkills && matchesAttributes ? '' : 'none';
    });
  }

  _toggleBackgroundSkillFilter(skill) {
    if (!skill) return;
    if (this._backgroundSkillFilters.has(skill)) this._backgroundSkillFilters.delete(skill);
    else this._backgroundSkillFilters.add(skill);
    this._filterItems(this.element, '');
  }

  _toggleBackgroundAttributeFilter(attribute) {
    if (!attribute) return;
    if (this._backgroundAttributeFilters.has(attribute)) this._backgroundAttributeFilters.delete(attribute);
    else this._backgroundAttributeFilters.add(attribute);
    this._filterItems(this.element, '');
  }

  _prevStep() {
    if (this.isApplying) return;
    const visible = this.visibleSteps;
    const currentVisible = visible.indexOf(this.stepId);
    if (currentVisible > 0) {
      this.currentStep = STEPS.indexOf(visible[currentVisible - 1]);
      this.render(true);
    }
  }

  _nextStep() {
    if (this.isApplying) return;
    const visible = this.visibleSteps;
    const currentVisible = visible.indexOf(this.stepId);
    if (currentVisible < visible.length - 1) {
      this.currentStep = STEPS.indexOf(visible[currentVisible + 1]);
      this.render(true);
    }
  }

  async _apply() {
    if (this.isApplying) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CREATION.CONFIRM_TITLE') },
      content: `<p>${localize('CREATION.CONFIRM_BODY')}</p>`,
      modal: true,
    });
    if (!confirmed) return;

    try {
      this.isApplying = true;
      this.applyProgress = 0.02;
      this.applyStatus = 'Starting character creation...';
      this._applyPromptRowsCache = null;
      this._startApplyPromptWatcher();
      this.render(true);

      await applyCreation(this.actor, this.data, ({ progress, message }) => {
        this.applyProgress = progress;
        this.applyStatus = message;
        this.render(true);
      });
      await saveCreationData(this.actor, this.data);
      ui.notifications.info(localize('CREATION.CREATION_COMPLETE'));
      this.close();

      const actorLevel = this.actor.system?.details?.level?.value ?? 1;
      if (actorLevel > 1) {
        const { LevelPlanner } = await import('../level-planner/index.js');
        new LevelPlanner(this.actor, { sequentialMode: true }).render(true);
      }
    } finally {
      this._stopApplyPromptWatcher();
      this.isApplying = false;
      this.applyProgress = 0;
      this.applyStatus = '';
    }
  }

  _startApplyPromptWatcher() {
    this._stopApplyPromptWatcher();
    this._activeSystemPrompt = null;
    this._applyPromptWatcher = setInterval(() => {
      const nextPrompt = this._detectActiveSystemPrompt();
      if ((nextPrompt?.title ?? null) === (this._activeSystemPrompt?.title ?? null)) return;
      this._activeSystemPrompt = nextPrompt;
      if (this.isApplying) this.render({ parts: ['wizard'] });
    }, 350);
  }

  _stopApplyPromptWatcher() {
    if (this._applyPromptWatcher) clearInterval(this._applyPromptWatcher);
    this._applyPromptWatcher = null;
    this._activeSystemPrompt = null;
  }

  _detectActiveSystemPrompt() {
    const windows = Object.values(ui.windows ?? {});
    const currentTitle = this.title;
    const candidates = windows
      .filter((app) => app && app.title && app.title !== currentTitle)
      .map((app) => ({ title: String(app.title).trim() }))
      .filter((entry) => entry.title.length > 0);
    return candidates.at(-1) ?? null;
  }

  async _saveAndRender() {
    this._captureWizardScroll();
    this._applyPromptRowsCache = null;
    await saveCreationData(this.actor, this.data);
    await this.render({ force: true, parts: ['wizard'] });
  }

  _toggleCompendiumSourceFilter(pack, allPacks = []) {
    if (!pack) return;
    const current = new Set(this._compendiumSourceFilters[this.stepId]?.length
      ? this._compendiumSourceFilters[this.stepId]
      : allPacks);

    if (current.has(pack)) {
      if (current.size > 1) current.delete(pack);
    } else {
      current.add(pack);
    }

    this._compendiumSourceFilters[this.stepId] = current.size === allPacks.length
      ? []
      : [...current];
    this.render(true);
  }

  _exportCreationData() {
    const json = exportCreationData(this.data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.actor.name}-creation-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
    ui.notifications.info(localize('NOTIFICATIONS.CREATION_EXPORTED'));
  }

  async _importCreationData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        this.data = importCreationData(text);
        this.classHandler = getClassHandler(this.data.class?.slug);
        this._featChoiceDataDirty = true;
        this._applyPromptRowsCache = null;
        await saveCreationData(this.actor, this.data);
        ui.notifications.info(localize('NOTIFICATIONS.CREATION_IMPORTED'));
        this.render(true);
      } catch (err) {
        ui.notifications.error(
          game.i18n.format('PF2E_LEVELER.NOTIFICATIONS.IMPORT_FAILED', { error: err.message }),
        );
      }
    });
    input.click();
  }

  _captureWizardScroll() {
    this._scrollState = captureScrollState(this.element, {
      sidebar: '.wizard-steps',
      content: '.wizard-content',
      browserFilters: '.wizard-browser__filters',
      browserResults: '.wizard-browser__results',
    });
  }

  _restoreWizardScroll(root) {
    restoreScrollState(root, this._scrollState, {
      sidebar: '.wizard-steps',
      content: '.wizard-content',
      browserFilters: '.wizard-browser__filters',
      browserResults: '.wizard-browser__results',
    });
  }

  _isCaster() {
    if (!this.data.class?.slug) return false;
    const classDef = ClassRegistry.get(this.data.class.slug);
    return !!classDef?.spellcasting;
  }

  _needsSpellSelection() {
    if (!this.data.class?.slug) return false;
    const classDef = ClassRegistry.get(this.data.class.slug);
    return this.classHandler.needsSpellSelection(this.data, classDef);
  }

  async _hasClassFeatAtLevel1() {
    if (!this.data.class?.uuid) return false;
    const classItem = await this._getCachedDocument(this.data.class.uuid);
    if (!classItem) return false;
    const classFeatLevels = classItem.system?.classFeatLevels?.value ?? [];
    return classFeatLevels.includes(1);
  }

  async _getAdditionalSkillCount() {
    if (!this.data.class?.uuid) return 3;
    const classItem = await this._getCachedDocument(this.data.class.uuid);
    if (!classItem) return 3;
    const additional = classItem.system?.trainedSkills?.additional ?? 3;
    const intMod = await this._computeIntMod();
    const duplicateAutoTrainedSkills = await this._getDuplicateAutoTrainedSkillCount(classItem);
    return Math.max(0, additional + intMod + duplicateAutoTrainedSkills);
  }

  async _getDuplicateAutoTrainedSkillCount(classItem = null) {
    const resolvedClassItem = classItem ?? (this.data.class?.uuid ? await this._getCachedDocument(this.data.class.uuid) : null);

    const autoTrainedSkills = new Set([
      ...(resolvedClassItem?.system?.trainedSkills?.value ?? []).filter((s) => typeof s === 'string' && s.length > 0),
      ...(this.data.subclass?.grantedSkills ?? []).filter((s) => typeof s === 'string' && s.length > 0),
      ...(this.data.deity?.skill ? [this.data.deity.skill] : []),
    ]);
    if (autoTrainedSkills.size === 0) return 0;

    const backgroundSkills = await this._getBackgroundTrainedSkills();
    return backgroundSkills.filter((skill) => autoTrainedSkills.has(skill)).length;
  }

  _getSkillsNote() {
    if (this.data.subclass) return null;
    const slug = this.data.class?.slug;
    if (SUBCLASS_TAGS[slug]) return 'Your subclass may also grant trained skills — select a subclass first.';
    return null;
  }

  async _computeIntMod() {
    let mod = 0;

    if (this.data.ancestry?.uuid) {
      const ancestry = await this._getCachedDocument(this.data.ancestry.uuid);
      if (this.data.alternateAncestryBoosts) {
        mod += (this.data.boosts.ancestry ?? []).filter((value) => value === 'int').length;
      } else {
        const sets = this._parseBoostSets(ancestry?.system?.boosts);
        mod += sets.filter((set) => set.type === 'fixed' && set.attr === 'int').length;
        mod += (this.data.boosts.ancestry ?? []).filter((value) => value === 'int').length;
        mod -= this._extractFixedValues(ancestry?.system?.flaws).filter((value) => value === 'int').length;
      }
    }

    if (this.data.background?.uuid) {
      const background = await this._getCachedDocument(this.data.background.uuid);
      const sets = this._parseBoostSets(background?.system?.boosts);
      mod += sets.filter((set) => set.type === 'fixed' && set.attr === 'int').length;
      mod += (this.data.boosts.background ?? []).filter((value) => value === 'int').length;
    }

    mod += (this.data.boosts.class ?? []).filter((value) => value === 'int').length;
    mod += (this.data.boosts.free ?? []).filter((value) => value === 'int').length;

    return mod;
  }

  async _getClassTrainedSkills() {
    if (!this.data.class?.uuid) return [];
    const classItem = await this._getCachedDocument(this.data.class.uuid);
    if (!classItem) return [];
    return classItem.system?.trainedSkills?.value ?? [];
  }

  _isStepComplete(stepId) {
    const handlerResult = this.classHandler.isStepComplete(stepId, this.data);
    if (handlerResult !== null) return handlerResult;

    switch (stepId) {
      case 'ancestry': return !!this.data.ancestry;
      case 'heritage': return !!this.data.heritage;
      case 'background': return !!this.data.background;
      case 'class': return !!this.data.class;
      case 'subclass': return !this._hasSubclass() || !!this.data.subclass;
      case 'subclassChoices': {
        if (!this._hasSubclassChoices()) return true;
        const choices = this.data.subclass?.choices ?? {};
        return this.data.subclass.choiceSets.every((cs) => {
          const val = choices[cs.flag];
          return typeof val === 'string' && val !== '[object Object]';
        });
      }
      case 'featChoices': {
        if (!this._hasFeatChoices()) return true;
        const sections = [
          ...[this.data.ancestryFeat, this.data.ancestryParagonFeat, this.data.classFeat, this.data.skillFeat]
            .filter(Boolean)
            .map((feat) => ({ choiceSets: feat.choiceSets ?? [], choices: feat.choices ?? {} })),
          ...(this.data.grantedFeatSections ?? []).map((section) => ({
            choiceSets: section.choiceSets ?? [],
            choices: this.data.grantedFeatChoices?.[section.slot] ?? {},
          })),
        ];
        return sections.every((section) => section.choiceSets.every((cs) => {
          const val = section.choices?.[cs.flag];
          return typeof val === 'string' && val !== '[object Object]';
        }));
      }
      case 'boosts':
        if (typeof this._cachedBoostStepComplete === 'boolean') return this._cachedBoostStepComplete;
        return this.data.boosts.free.length === 4
          && (this.data.boosts.class?.length ?? 0) >= (this._cachedRequiredClassBoostSelections ?? 0);
      case 'languages': return this.data.languages.length >= (this._cachedMaxLanguages ?? 0);
      case 'skills': return this.data.skills.length >= (this._cachedMaxSkills ?? 1);
      case 'feats':
        return !!this.data.ancestryFeat
          && (!isAncestralParagonEnabled() || !!this.data.ancestryParagonFeat)
          && (!this._needsLevel1ClassFeatSelection() || !!this.data.classFeat)
          && (!this._needsLevel1SkillFeatSelection() || !!this.data.skillFeat);
      case 'spells': {
        if (!this._needsSpellSelection()) return true;
        const spellHandlerResult = this.classHandler.isStepComplete('spells', this.data);
        if (spellHandlerResult !== null) return spellHandlerResult;
        const mc = this._cachedMaxCantrips ?? 1;
        const mr = this._cachedMaxRank1 ?? 0;
        return this.data.spells.cantrips.length >= mc && (mr <= 0 || this.data.spells.rank1.length >= mr);
      }
      case 'equipment': return true;
      case 'summary': return true;
      default: return false;
    }
  }

  async _getStepContext() {
    switch (this.stepId) {
      case 'ancestry': return {
        items: (await this._loadAncestries())
          .filter((i) => i.type === 'ancestry')
          .filter((i) => i.uuid !== this.data.ancestry?.uuid),
      };
      case 'heritage': return {
        items: (await this._loadHeritages())
          .filter((i) => i.type === 'heritage')
          .filter((i) => i.uuid !== this.data.heritage?.uuid),
      };
      case 'background': return {
        items: (await this._loadBackgrounds())
          .filter((i) => i.type === 'background')
          .filter((i) => i.uuid !== this.data.background?.uuid),
      };
      case 'class': return {
        items: (await this._loadClasses())
          .filter((i) => i.type === 'class')
          .filter((i) => i.uuid !== this.data.class?.uuid),
      };
      case 'subclass': {
        let subclasses = (await this._loadSubclasses()).filter((i) => i.uuid !== this.data.subclass?.uuid);
        subclasses = this.classHandler.filterSubclasses(subclasses, this.data);
        return { items: subclasses };
      }
      case 'subclassChoices': return await this._buildSubclassChoicesContext();
      case 'featChoices': return await this._buildFeatChoicesContext();
      case 'implement':
      case 'tactics':
      case 'ikons':
      case 'innovationDetails':
      case 'kineticGate':
      case 'subconsciousMind':
      case 'thesis':
      case 'apparitions':
      case 'deity':
      case 'sanctification':
      case 'divineFont': {
        const handlerCtx = await this.classHandler.getStepContext(this.stepId, this.data, this);
        if (handlerCtx) return handlerCtx;
        return {};
      }
      case 'boosts': return await this._buildBoostContext();
      case 'languages': {
        const langCtx = await this._buildLanguageContext();
        annotateGuidanceBySlug(langCtx.choosableLanguages, 'language');
        sortByGuidancePriority(langCtx.choosableLanguages, (a, b) => {
          if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
          return a.label.localeCompare(b.label);
        });
        return langCtx;
      }
      case 'skills': {
        const maxSkills = await this._getAdditionalSkillCount();
        this._cachedMaxSkills = maxSkills;
        const selectedCount = this.data.skills.length;
        const bgLores = await this._getBackgroundLores();
        const subclassLores = (this.data.subclass?.grantedLores ?? []).map((name) => ({ name, source: this.data.subclass.name }));
        const featLores = [
          this.data.ancestryFeat ? { source: this.data.ancestryFeat.name, lores: this.data.ancestryFeat.grantedLores ?? [] } : null,
          this.data.ancestryParagonFeat ? { source: this.data.ancestryParagonFeat.name, lores: this.data.ancestryParagonFeat.grantedLores ?? [] } : null,
          this.data.classFeat ? { source: this.data.classFeat.name, lores: this.data.classFeat.grantedLores ?? [] } : null,
          this.data.skillFeat ? { source: this.data.skillFeat.name, lores: this.data.skillFeat.grantedLores ?? [] } : null,
        ]
          .filter(Boolean)
          .flatMap((entry) => entry.lores.map((name) => ({ name, source: entry.source })));
        const apparitionLores = (this.data.apparitions ?? []).flatMap((entry) =>
          (entry.lores ?? []).map((name) => ({ name, source: entry.name })),
        );
        const allLores = dedupeLores([...bgLores, ...subclassLores, ...featLores, ...apparitionLores]);
        setLores(this.data, allLores.map((l) => l.name));
        const skills = await this._buildSkillContext();
        annotateGuidanceBySlug(skills, 'skill');
        sortByGuidancePriority(skills, (a, b) => a.label.localeCompare(b.label));
        return { skills, maxSkills, selectedCount, skillsNote: this._getSkillsNote(), lores: allLores };
      }
      case 'feats': return await this._buildFeatContext();
      case 'spells': return await this._buildSpellContext();
      case 'equipment': return this._buildEquipmentContext();
      case 'summary': return buildSummaryContext(this);
      default: return {};
    }
  }

  async _buildApplyOverlayContext() {
    return buildApplyOverlayContext(this);
  }

  _matchActivePromptRow(promptRows) {
    return matchActivePromptRow(this, promptRows);
  }

  _normalizePromptText(text) {
    return normalizePromptText(text);
  }

  _getPromptMatchTexts(row) {
    return getPromptMatchTexts(row);
  }

  async _getApplyPromptRows() {
    if (this._applyPromptRowsCache) return this._applyPromptRowsCache;
    this._applyPromptRowsCache = await getApplyPromptRows(this);
    return this._applyPromptRowsCache;
  }

  async _resolvePromptSelectionLabel(rule, optionSource = null) {
    return resolvePromptSelectionLabel(this, rule, optionSource);
  }

  async _loadCompendium(key) {
    return loadCompendium(this, key);
  }

  async _loadCompendiumCategory(category) {
    return loadCompendiumCategory(this, category);
  }

  async _loadAncestries() {
    return loadAncestries(this);
  }

  async _loadBackgrounds() {
    return loadBackgrounds(this);
  }

  async _loadClasses() {
    return loadClasses(this);
  }

  async _loadDeities() {
    return loadDeities(this);
  }

  async _loadHeritages() {
    return loadHeritages(this);
  }

  async _loadSubclasses() {
    return loadSubclasses(this);
  }

  async _loadTheses() {
    return loadTheses(this);
  }

  async _loadThaumaturgeImplements() {
    return loadThaumaturgeImplements(this);
  }

  async _loadCommanderTactics() {
    return loadCommanderTactics(this);
  }

  async _loadExemplarIkons() {
    return loadExemplarIkons(this);
  }

  async _loadInventorWeaponOptions() {
    return loadInventorWeaponOptions(this);
  }

  async _loadInventorArmorOptions() {
    return loadInventorArmorOptions(this);
  }

  async _loadInventorWeaponModifications(selectedItem) {
    return loadInventorWeaponModifications(this, selectedItem);
  }

  async _loadInventorArmorModifications(selectedItem) {
    return loadInventorArmorModifications(this, selectedItem);
  }

  async _loadKineticImpulses(data) {
    return loadKineticImpulses(this, data);
  }

  async _loadPsychicSubconsciousMinds() {
    if (this.data.class?.slug !== 'psychic') return [];
    const items = await this._loadTaggedClassFeatures('psychic-subconscious-mind', 'psychic-subconscious-minds');
    return items.map((item) => ({
      ...item,
      keyAbility: this._parsePsychicKeyAbility(item.description ?? ''),
    }));
  }

  async _loadApparitions() {
    if (this.data.class?.slug !== 'animist') return [];
    const cacheKey = 'animist-apparitions';
    if (this._compendiumCache[cacheKey]) return this._compendiumCache[cacheKey];

    const docs = await this._loadCompendiumCategory('classFeatures');
    const items = docs
      .filter((d) => (d.otherTags ?? []).includes('animist-apparition'))
      .map((d) => {
        const description = d.description ?? '';
        return {
          uuid: d.uuid,
          name: d.name,
          img: d.img,
          sourcePack: d.sourcePack,
          sourceLabel: d.sourceLabel,
          sourcePackage: d.sourcePackage,
          sourcePackageLabel: d.sourcePackageLabel,
          slug: d.slug ?? null,
          rarity: d.rarity ?? 'common',
          lores: this._parseApparitionLores(description),
          spells: this._parseApparitionSpells(description),
          vesselSpell: this._parseVesselSpell(description),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    this._compendiumCache[cacheKey] = items;
    return items;
  }

  async _loadTaggedClassFeatures(tag, cacheKey, { includeSubclassData = false } = {}) {
    return loadTaggedClassFeatures(this, tag, cacheKey, { includeSubclassData });
  }

  _parseApparitionLores(html) {
    if (!html) return [];
    return extractLoreLabels(html, { stopBeforeSpells: true });
  }

  _parseApparitionSpells(html) {
    return parseCurriculum(html) ?? {};
  }

  _parseVesselSpell(html) {
    return parseVesselSpell(html);
  }

  async _resolveGrantedSpells() {
    return resolveGrantedSpells(this);
  }

  _parseCurriculum(html) {
    return parseCurriculum(html);
  }

  _parseGrantedSkills(rules, html) {
    const skills = [];
    for (const rule of rules) {
      if (rule.key !== 'ActiveEffectLike') continue;
      const match = rule.path?.match(/^system\.skills\.(\w+)\.rank$/);
      if (match && rule.value >= 1) skills.push(match[1]);
    }
    if (skills.length === 0 && html) {
      const text = html.replace(/<[^>]+>/g, ' ').toLowerCase();
      for (const skill of SKILLS) {
        const localized = this._localizeSkillSlug(skill).toLowerCase();
        const pattern = new RegExp(`(?:trained|expert|master|legendary)\\s+in\\s+(?:[\\w,\\s]+,\\s*)?(?:${localized}|${skill})`, 'i');
        if (pattern.test(text)) skills.push(skill);
      }
    }
    return skills;
  }

  _resolveSubclassTradition(item) {
    const rules = item.system?.rules ?? [];
    const traitTraditions = item.system?.traits?.traditions ?? item.system?.traditions?.value ?? [];
    const firstTraitTradition = Array.isArray(traitTraditions)
      ? traitTraditions.find((trad) => isSpellTradition(trad))
      : null;
    if (firstTraitTradition) return firstTraitTradition;

    const directTradition = item.system?.spellcasting?.tradition?.value;
    if (isSpellTradition(directTradition)) return directTradition;

    for (const rule of rules) {
      if (rule.key === 'ActiveEffectLike' && typeof rule.path === 'string' && rule.path.includes('proficiencies.aliases')) {
        return rule.value;
      }
    }

    for (const rule of rules) {
      if (rule.key === 'RollOption' && typeof rule.option === 'string') {
        const match = rule.option.match(/tradition:(\w+)/);
        if (match) return match[1];
      }
    }

    const desc = item.system?.description?.value ?? '';
    const descTradition = extractTraditionFromText(desc);
    if (descTradition) return descTradition;

    return null;
  }

  _localizeSkillSlug(slug) {
    const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
    const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
    return game.i18n?.has?.(label) ? game.i18n.localize(label) : slug;
  }

  async _loadRawHeritages() {
    return loadRawHeritages(this);
  }

  async _buildBoostContext() {
    const boostRows = [];
    this._boostMaxForSource = {};

    const buildRow = (source, label, type, fixed, flaws, freeCount, options, selected) => {
      this._boostMaxForSource[source] = freeCount;
      const complete = freeCount === 0 || selected.length >= freeCount;
      boostRows.push({ source, label, type, fixed, flaws, freeCount, options, selected, complete });
    };

    if (this.data.ancestry?.uuid) {
      const item = await this._getCachedDocument(this.data.ancestry.uuid);
      if (this.data.alternateAncestryBoosts) {
        buildRow('ancestry', item?.name ?? '', 'Ancestry (Alternate)', [], [], 2, [...ATTRIBUTES], this.data.boosts.ancestry ?? []);
      } else {
        const sets = this._parseBoostSets(item?.system?.boosts);
        const flaws = this._extractFixedValues(item?.system?.flaws);
        const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
        const choices = sets.filter((s) => s.type === 'choice');
        const totalFree = choices.length;
        const allOptions = totalFree > 0 ? (choices.some((c) => c.options.length === 6) ? [...ATTRIBUTES] : choices[0].options) : [];
        buildRow('ancestry', item?.name ?? '', 'Ancestry', fixed, flaws, totalFree, allOptions, this.data.boosts.ancestry ?? []);
      }
    }

    if (this.data.background?.uuid) {
      const item = await this._getCachedDocument(this.data.background.uuid);
      const sets = this._parseBoostSets(item?.system?.boosts);
      const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
      const choices = sets.filter((s) => s.type === 'choice');
      const totalFree = choices.length;
      const restricted = choices.find((c) => c.options.length < 6)?.options ?? [];
      buildRow('background', item?.name ?? '', 'Background', fixed, [], totalFree, [...ATTRIBUTES], this.data.boosts.background ?? []);
      boostRows[boostRows.length - 1].restricted = restricted;
    }

      if (this.data.class?.slug) {
        const classDef = ClassRegistry.get(this.data.class.slug);
        const keyAbility = await this.classHandler.getKeyAbilityOptions(this.data, classDef);
        if (this.data.class.slug === 'psychic' && this.data.subconsciousMind?.keyAbility) {
          this.data.boosts.class = [this.data.subconsciousMind.keyAbility];
        buildRow('class', this.data.class.name, 'Class', [this.data.subconsciousMind.keyAbility], [], 0, [], []);
        boostRows[boostRows.length - 1].keyAbility = this.data.subconsciousMind.keyAbility;
      } else if (keyAbility.length === 1) {
        this.data.boosts.class = [keyAbility[0]];
        buildRow('class', this.data.class.name, 'Class', [keyAbility[0]], [], 0, [], []);
        boostRows[boostRows.length - 1].keyAbility = keyAbility[0];
        } else if (keyAbility.length > 1) {
          this.data.boosts.class ??= [];
          buildRow('class', this.data.class.name, 'Class', [], [], 1, keyAbility, this.data.boosts.class);
          boostRows[boostRows.length - 1].isKeyChoice = true;
        } else {
          buildRow('class', this.data.class.name, 'Class', [], [], 0, [], []);
        }
      }

    buildRow('free', 'Level 1', 'Free', [], [], 4, [...ATTRIBUTES], this.data.boosts.free ?? []);

    const allBoosts = [...boostRows.flatMap((r) => r.fixed), ...boostRows.flatMap((r) => r.selected)];
    const allFlaws = boostRows.flatMap((r) => r.flaws);
    const totals = {};
    for (const a of ATTRIBUTES) totals[a] = 0;
    for (const b of allBoosts) if (totals[b] !== undefined) totals[b]++;
    for (const f of allFlaws) if (totals[f] !== undefined) totals[f]--;

    for (const row of boostRows) {
      const restricted = row.restricted ?? [];
      const hasRestrictedPick = restricted.length > 0 && row.selected.some((s) => restricted.includes(s));

      row.cells = ATTRIBUTES.map((key) => {
        if (row.keyAbility === key) return { key, type: 'key' };
        if (row.fixed.includes(key)) return { key, type: 'fixed' };
        if (row.flaws.includes(key)) return { key, type: 'flaw' };
        if (!row.options.includes(key)) return { key, type: 'empty' };

        const selected = row.selected.includes(key);
        const isRestricted = restricted.includes(key);
        const locked = restricted.length > 0 && !hasRestrictedPick && !isRestricted;

        return { key, type: 'option', selected, source: row.source, locked, isRestricted };
      });
    }

    const summary = ATTRIBUTES.map((key) => ({ key, label: key.toUpperCase(), mod: totals[key] }));
    this._cachedBoostStepComplete = boostRows.every((row) => row.complete);
    return { boostRows, summary, alternateAncestryBoosts: this.data.alternateAncestryBoosts, hasAncestry: !!this.data.ancestry };
  }

  async _computeBoostStepComplete() {
    const { boostRows } = await this._buildBoostContext();
    return boostRows.every((row) => row.complete);
  }

  async _getRequiredClassBoostSelections() {
    if (!this.data.class?.slug) return 0;
    const classDef = ClassRegistry.get(this.data.class.slug);
    const keyAbility = await this.classHandler.getKeyAbilityOptions(this.data, classDef);

    if (this.data.class.slug === 'psychic' && this.data.subconsciousMind?.keyAbility) return 0;
    return keyAbility.length > 1 ? 1 : 0;
  }

  _parseBoostSets(boostObj) {
    if (!boostObj) return [];
    const sets = [];
    for (const b of Object.values(boostObj)) {
      const vals = b.value ?? [];
      if (vals.length === 1 && ATTRIBUTES.includes(vals[0])) {
        sets.push({ type: 'fixed', attr: vals[0] });
      } else if (vals.length > 1) {
        sets.push({ type: 'choice', options: vals.length === 6 ? [...ATTRIBUTES] : vals });
      }
    }
    return sets;
  }

  _extractFixedValues(obj) {
    if (!obj) return [];
    const result = [];
    for (const b of Object.values(obj)) {
      for (const v of (b.value ?? [])) {
        if (ATTRIBUTES.includes(v)) result.push(v);
      }
    }
    return result;
  }

  async _buildSubclassChoicesContext() {
    return buildSubclassChoicesContext(this);
  }

  async _buildFeatChoicesContext() {
    return buildFeatChoicesContext(this);
  }

  async _hydrateChoiceSets(choiceSets, currentChoices) {
    return hydrateChoiceSets(this, choiceSets, currentChoices);
  }

  async _getSelectedSubclassChoiceLabels() {
    return getSelectedSubclassChoiceLabels(this);
  }

  async _getSelectedFeatChoiceLabels(slot) {
    return getSelectedFeatChoiceLabels(this, slot);
  }

  async _getSelectedChoiceLabels(choiceContainer) {
    return getSelectedChoiceLabels(this, choiceContainer);
  }

  _formatChoiceLabel(value) {
    return formatChoiceLabel(value);
  }

  async _getPendingChoices() {
    return getPendingChoices(this);
  }

  async _refreshGrantedFeatChoiceSections() {
    setGrantedFeatSections(this.data, await refreshGrantedFeatChoiceSections(this));
    this._featChoiceDataDirty = false;
  }

  async _refreshAllFeatChoiceData() {
    for (const feat of [this.data.ancestryFeat, this.data.ancestryParagonFeat, this.data.classFeat, this.data.skillFeat]) {
      if (!feat?.uuid) continue;
      const item = await this._getCachedDocument(feat.uuid);
      if (!item) continue;
      feat.choiceSets = await this._parseChoiceSets(item.system?.rules ?? [], feat.choices ?? {}, item);
      feat.grantedLores = this._parseSubclassLores(item.system?.rules ?? [], item.system?.description?.value ?? '');
    }
    await this._refreshGrantedFeatChoiceSections();
    this._featChoiceDataDirty = false;
  }

  async _buildLanguageContext() {
    return buildLanguageContext(this);
  }

  _getLanguageMap() {
    return getLanguageMap();
  }

  _parsePsychicKeyAbility(html) {
    const text = html.replace(/<[^>]+>/g, ' ');
    const match = text.match(/\((Cha|Int)\)/i);
    return match ? match[1].toLowerCase() : null;
  }

  async _parseChoiceSets(rules, currentChoices = {}, sourceItem = null) {
    return parseChoiceSets(this, rules, currentChoices, sourceItem);
  }

  _parseSpellUuidsFromDescription(rules, html) {
    return parseSpellUuidsFromDescription(rules, html);
  }

  async _resolveFocusSpells() {
    return resolveFocusSpells(this);
  }

  async _resolveSummaryFocusSpells() {
    return resolveSummaryFocusSpells(this);
  }

  async _resolveSummaryCurriculumSpells() {
    return resolveSummaryCurriculumSpells(this);
  }

  async _getAdditionalLanguageCount() {
    const ancestryItem = this.data.ancestry?.uuid ? await this._getCachedDocument(this.data.ancestry.uuid) : null;
    const baseCount = ancestryItem?.system?.additionalLanguages?.count ?? 0;
    const intMod = await this._computeIntMod();
    const featGrants = await collectFeatLanguageGrants(this);
    return Math.max(0, baseCount + intMod + featGrants.bonusSlots);
  }

  async _getBackgroundLores() {
    return getBackgroundLores(this);
  }

  _parseSubclassLores(rules, html) {
    return parseSubclassLores(rules, html);
  }

  async _collectGrantedItems(uuid) {
    const source = await this._getCachedDocument(uuid);
    if (!source) return [];
    const items = [];
    const seen = new Set();
    const scan = async (item) => {
      for (const rule of item?.system?.rules ?? []) {
        if (rule.key !== 'GrantItem' || typeof rule.uuid !== 'string') continue;
        const granted = await fromUuid(rule.uuid).catch(() => null);
        if (!granted || seen.has(granted.uuid)) continue;
        seen.add(granted.uuid);
        items.push({ uuid: granted.uuid, name: granted.name, img: granted.img });
        await scan(granted);
      }
    };
    await scan(source);
    return items;
  }

  async _collectHeritageGrantedTraits() {
    const heritageItem = this.data.heritage?.uuid ? await this._getCachedDocument(this.data.heritage.uuid) : null;
    if (!heritageItem) return [];
    const traits = [];
    for (const trait of heritageItem.system?.traits?.value ?? []) {
      traits.push(String(trait).toLowerCase());
    }
    for (const rule of heritageItem.system?.rules ?? []) {
      if (rule.key !== 'ActiveEffectLike' || typeof rule.path !== 'string' || typeof rule.value !== 'string') continue;
      if (rule.path === 'system.traits.value' || rule.path === 'system.details.ancestry.trait') {
        traits.push(rule.value.toLowerCase());
      }
    }
    return traits;
  }

  async _collectSenses() {
    const senses = new Set();
    const ancestryItem = this.data.ancestry?.uuid ? await this._getCachedDocument(this.data.ancestry.uuid) : null;
    const heritageItem = this.data.heritage?.uuid ? await this._getCachedDocument(this.data.heritage.uuid) : null;
    for (const item of [ancestryItem, heritageItem]) {
      if (!item) continue;
      const vision = item.system?.vision;
      if (vision === 'darkvision') senses.add('darkvision');
      else if (vision === 'lowLightVision' || vision === 'low-light-vision') senses.add('low-light-vision');
      for (const rule of item.system?.rules ?? []) {
        if (rule.key === 'Sense' && typeof rule.selector === 'string') {
          senses.add(rule.selector.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''));
        }
      }
    }
    return senses;
  }

  async _buildSkillContext() {
    return buildSkillContext(this);
  }

  async _getBackgroundTrainedSkills() {
    return getBackgroundTrainedSkills(this);
  }

  async _buildFeatContext() {
    const ancestralParagonEnabled = isAncestralParagonEnabled();
    const hasClassFeat = await this._hasClassFeatAtLevel1();
    this._cachedHasClassFeatAtLevel1 = hasClassFeat;
    const hasSkillFeat = this._needsLevel1SkillFeatSelection();

    const featSlots = [this.data.ancestryFeat, this.data.ancestryParagonFeat, this.data.classFeat, this.data.skillFeat];
    for (const feat of featSlots) {
      if (feat?.uuid) feat.grantedItems = await this._collectGrantedItems(feat.uuid);
    }

    return {
      hasClassFeat,
      hasSkillFeat,
      ancestralParagonEnabled,
    };
  }

  async _buildSpellContext() {
    return buildSpellContext(this);
  }

  _getSanitizedCurriculumSelections() {
    return getSanitizedCurriculumSelections(this);
  }

  _limitCurriculumSelections(list, validUuids, max) {
    return limitCurriculumSelections(list, validUuids, max);
  }

  _needsLevel1ClassFeatSelection() {
    if (typeof this._cachedHasClassFeatAtLevel1 === 'boolean') return this._cachedHasClassFeatAtLevel1;

    const classItem = this.data.class?.uuid ? this._documentCache.get(this.data.class.uuid) : null;
    const classFeatLevels = classItem?.system?.classFeatLevels?.value ?? [];
    return classFeatLevels.includes(1);
  }

  _needsLevel1SkillFeatSelection() {
    return this.data.class?.slug === 'rogue';
  }
}

function extractLoreLabels(html, { stopBeforeSpells = false } = {}) {
  let text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (stopBeforeSpells) {
    const firstSpellUuid = text.search(/Compendium\.pf2e\.spells-srd\.Item\./i);
    if (firstSpellUuid >= 0) text = text.slice(0, firstSpellUuid);
  }
  const matches = text.match(/\b(?:[\p{Lu}][\p{L}'-]*\s+){0,3}Lore\b/gu) ?? [];
  return [...new Set(matches.map(cleanLoreLabel).filter(Boolean))];
}

function isSpellTradition(value) {
  return ['arcane', 'divine', 'occult', 'primal'].includes(String(value ?? '').toLowerCase());
}

function cleanLoreLabel(label) {
  const text = String(label ?? '').trim();
  const loreMatch = text.match(/[\p{L}][\p{L}' -]*?\bLore\b/iu);
  const loreText = loreMatch?.[0]?.trim() ?? text;
  const parts = loreText.split(/\s+/).filter(Boolean);
  if (parts.length > 2) return parts.slice(-2).join(' ');
  return loreText;
}

function extractTraditionFromText(html) {
  const normalized = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  for (const tradition of ['arcane', 'divine', 'occult', 'primal']) {
    const localized = localizeTradition(tradition);
    if (normalized.includes(tradition) || (localized && normalized.includes(localized))) {
      return tradition;
    }
  }

  return null;
}

function localizeTradition(tradition) {
  const candidates = [
    `PF2E.Trait${tradition.charAt(0).toUpperCase()}${tradition.slice(1)}`,
    `PF2E.MagicTradition${tradition.charAt(0).toUpperCase()}${tradition.slice(1)}`,
  ];

  for (const key of candidates) {
    if (game.i18n?.has?.(key)) {
      return game.i18n.localize(key).toLowerCase();
    }
  }

  return null;
}

function collectAncestryFeatTraits(ancestrySlug, heritageSlug) {
  const traits = new Set();

  for (const slug of [ancestrySlug, heritageSlug]) {
    if (!slug) continue;
    const normalized = String(slug).toLowerCase();
    const aliases = ANCESTRY_TRAIT_ALIASES[normalized] ?? [normalized];
    for (const alias of aliases) traits.add(alias);
  }

  return [...traits];
}

async function getAdoptedAncestryFeatTraits(wizard) {
  const traits = new Set();

  for (const section of (wizard.data.grantedFeatSections ?? [])) {
    if (String(section?.featName ?? '').trim().toLowerCase() !== 'adopted ancestry') continue;

    const currentChoices = wizard.data.grantedFeatChoices?.[section.slot] ?? {};
    for (const choiceSet of (section.choiceSets ?? [])) {
      const selectedValue = currentChoices?.[choiceSet.flag];
      if (typeof selectedValue !== 'string' || selectedValue.length === 0) continue;

      const matchedOption = (choiceSet.options ?? []).find((option) =>
        normalizeAncestryChoiceIdentity(option?.value) === normalizeAncestryChoiceIdentity(selectedValue)
        || normalizeAncestryChoiceIdentity(option?.uuid) === normalizeAncestryChoiceIdentity(selectedValue));

      const selectedSlug = matchedOption?.value && !String(matchedOption.value).startsWith('Compendium.')
        ? String(matchedOption.value)
        : await resolveAncestrySlugFromChoice(wizard, matchedOption?.uuid ?? selectedValue);

      if (!selectedSlug) continue;
      for (const trait of collectAncestryFeatTraits(selectedSlug, null)) traits.add(trait);
    }
  }

  return [...traits];
}

async function resolveAncestrySlugFromChoice(wizard, value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!value.startsWith('Compendium.')) return value.toLowerCase();

  const item = await wizard._getCachedDocument(value);
  return item?.slug ? String(item.slug).toLowerCase() : null;
}

function normalizeAncestryChoiceIdentity(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function dedupeLores(lores) {
  const seen = new Set();
  const result = [];

  for (const entry of lores ?? []) {
    const name = String(entry?.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, source: entry?.source ?? null });
  }

  return result;
}

function inferFeatChoiceTypes(option, buildState) {
  const traits = (option?.traits ?? []).map((trait) => String(trait).toLowerCase());
  const ancestryTraits = buildState?.ancestryTraits instanceof Set
    ? [...buildState.ancestryTraits].map((trait) => String(trait).toLowerCase())
    : [];
  const classSlug = String(buildState?.class?.slug ?? '').toLowerCase();
  const types = new Set();

  if (traits.includes('mythic')) types.add('mythic');
  if (traits.includes('archetype') || traits.includes('dedication')) types.add('archetype');
  if (traits.includes('general')) types.add('general');
  if (traits.includes('skill')) types.add('skill');
  if (ancestryTraits.some((trait) => traits.includes(trait))) types.add('ancestry');
  if (classSlug && traits.includes(classSlug)) types.add('class');

  return types;
}

function intersectStringSets(sets) {
  const normalizedSets = (sets ?? []).filter((set) => set instanceof Set && set.size > 0);
  if (normalizedSets.length === 0) return [];

  return [...normalizedSets[0]].filter((value) =>
    normalizedSets.every((set) => set.has(value)));
}

const SOURCE_FILTERABLE_KEYS = new Set([
  'items',
  'options',
  'ancestryFeats',
  'classFeats',
  'cantrips',
  'rank1Spells',
  'curriculumCantripOptions',
  'curriculumRank1Options',
  'focusSpells',
]);

export function buildCompendiumSourceOptions(stepId, stepContext, storedSelection = []) {
  const configuredSources = getConfiguredStepCompendiumSources(stepId);
  const sources = configuredSources.length > 0 ? configuredSources : collectCompendiumSources(stepContext);
  if (sources.length === 0) return [];

  const allKeys = new Set(sources.map((source) => source.key));
  const selectedKeys = new Set((storedSelection?.length ? storedSelection : [...allKeys])
    .filter((key) => allKeys.has(key)));

  return sources.map((source) => ({
    ...source,
    selected: selectedKeys.has(source.key),
  }));
}

function getConfiguredStepCompendiumSources(stepId) {
  const categories = STEP_SOURCE_CATEGORIES[stepId] ?? [];
  const sources = [];

  for (const category of categories) {
    for (const key of getCompendiumKeysForCategory(category)) {
      const pack = game.packs.get(key);
      const packageKey = pack?.metadata?.packageName ?? pack?.metadata?.package ?? key;
      sources.push({
        key: packageKey,
        label: getSourceOwnerLabel(packageKey),
      });
    }
  }

  const unique = new Map();
  for (const source of sources) {
    if (!unique.has(source.key)) unique.set(source.key, source);
  }

  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function filterStepContextByCompendiumSource(stepContext, sourceOptions = []) {
  const selectedKeys = new Set(sourceOptions.filter((option) => option.selected).map((option) => option.key));
  if (selectedKeys.size === 0) return stepContext;

  return filterCompendiumSourceValue(stepContext, selectedKeys);
}

function collectCompendiumSources(value, found = new Map()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectCompendiumSources(entry, found);
    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  if (!value || typeof value !== 'object') return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));

  const sourceKey = typeof value.sourcePackage === 'string' && value.sourcePackage.length > 0
    ? value.sourcePackage
    : value.sourcePack;
  if (typeof sourceKey === 'string' && sourceKey.length > 0) {
    found.set(sourceKey, {
      key: sourceKey,
      label: value.sourcePackageLabel ?? value.sourceLabel ?? getSourceOwnerLabel(sourceKey),
    });
  }

  for (const nested of Object.values(value)) {
    collectCompendiumSources(nested, found);
  }

  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function filterCompendiumSourceValue(value, selectedKeys, parentKey = null) {
  if (Array.isArray(value)) {
    if (SOURCE_FILTERABLE_KEYS.has(parentKey) && value.every((entry) => isCompendiumSourcedRecord(entry))) {
      return value.filter((entry) => selectedKeys.has(entry.sourcePackage ?? entry.sourcePack));
    }

    return value.map((entry) => filterCompendiumSourceValue(entry, selectedKeys, parentKey));
  }

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    filterCompendiumSourceValue(nested, selectedKeys, key),
  ]));
}

function isCompendiumSourcedRecord(value) {
  return !!value
    && typeof value === 'object'
    && typeof value.uuid === 'string'
    && (
      (typeof value.sourcePackage === 'string' && value.sourcePackage.length > 0)
      || (typeof value.sourcePack === 'string' && value.sourcePack.length > 0)
    );
}

const STEP_SOURCE_CATEGORIES = {
  ancestry: ['ancestries'],
  heritage: ['heritages'],
  background: ['backgrounds'],
  class: ['classes'],
  subclass: ['classFeatures'],
  deity: ['deities'],
  implement: ['classFeatures'],
  tactics: ['actions'],
  ikons: ['classFeatures'],
  innovationDetails: ['equipment', 'classFeatures'],
  kineticGate: ['feats', 'classFeatures'],
  subconsciousMind: ['classFeatures'],
  thesis: ['classFeatures'],
  apparitions: ['classFeatures'],
  feats: ['feats'],
  spells: ['spells'],
};

function buildBrowserStepContext(stepId, data, stepContext) {
  const config = BROWSER_STEP_CONFIG[stepId];
  if (!config) return null;

  const baseItems = Array.isArray(stepContext?.items) ? stepContext.items : [];
  const items = sortByGuidancePriority(annotateGuidance(baseItems).map((item) => ({
    ...item,
    trainedSkillsText: Array.isArray(item?.trainedSkills) ? item.trainedSkills.join(',') : '',
    boostsText: Array.isArray(item?.boosts) ? item.boosts.join(',') : '',
  })), (a, b) => a.name.localeCompare(b.name));
  const context = {
    stepId,
    title: localize(config.titleKey),
    resultsLabel: localize(config.resultsKey),
    items,
    selected: config.selectedKey ? data[config.selectedKey] ?? null : null,
    clearAction: config.clearAction,
    showSearch: config.showSearch !== false,
    showRarityFilters: config.showRarityFilters !== false,
    showTraits: config.showTraits === true,
    selectAction: config.selectAction ?? 'selectItem',
  };

  if (stepId === 'heritage' && items.length > 0) {
    const ancestry = items.filter((h) => !!h.ancestrySlug);
    const versatile = items.filter((h) => !h.ancestrySlug);
    if (versatile.length > 0 && ancestry.length > 0) {
      context.groups = [
        { label: localize('CREATION.HERITAGE_GROUP_ANCESTRY'), items: ancestry },
        { label: localize('CREATION.HERITAGE_GROUP_VERSATILE'), items: versatile },
      ];
    }
  }

  if (stepId === 'background' && items.length > 0) {
    context.backgroundSkillFilters = buildBackgroundFilterOptions(items, 'trainedSkills', SKILLS, globalThis.CONFIG?.PF2E?.skills ?? {});
    context.backgroundAttributeFilters = buildBackgroundFilterOptions(items, 'boosts', ATTRIBUTES, {
      str: 'STR',
      dex: 'DEX',
      con: 'CON',
      int: 'INT',
      wis: 'WIS',
      cha: 'CHA',
    });
  }

  return context;
}

const BROWSER_STEP_CONFIG = {
  ancestry: {
    titleKey: 'CREATION.STEPS.ANCESTRY',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.ANCESTRIES',
    selectedKey: 'ancestry',
    clearAction: 'clearAncestry',
    showRarityFilters: true,
  },
  heritage: {
    titleKey: 'CREATION.STEPS.HERITAGE',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.HERITAGES',
    selectedKey: 'heritage',
    clearAction: 'clearHeritage',
    showRarityFilters: true,
    showTraits: true,
  },
  background: {
    titleKey: 'CREATION.STEPS.BACKGROUND',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.BACKGROUNDS',
    selectedKey: 'background',
    clearAction: 'clearBackground',
    showRarityFilters: true,
  },
  class: {
    titleKey: 'CREATION.STEPS.CLASS',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.CLASSES',
    selectedKey: 'class',
    clearAction: 'clearClass',
    showRarityFilters: false,
  },
  subclass: {
    titleKey: 'CREATION.STEPS.SUBCLASS',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.CLASS_FEATURES',
    selectedKey: 'subclass',
    clearAction: 'clearSubclass',
    showRarityFilters: true,
    selectAction: 'selectSubclass',
  },
};

function getSourceOwnerLabel(packageKey) {
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

function buildBackgroundFilterOptions(items, field, allowedValues, labels) {
  const available = new Set();
  for (const item of items) {
    for (const value of item?.[field] ?? []) {
      const normalized = String(value ?? '').toLowerCase();
      if (allowedValues.includes(normalized)) available.add(normalized);
    }
  }

  return [...available]
    .sort((a, b) => String(labels[a] ?? a).localeCompare(String(labels[b] ?? b)))
    .map((value) => ({
      value,
      label: typeof labels[value] === 'string'
        ? (game.i18n?.has?.(labels[value]) ? game.i18n.localize(labels[value]) : labels[value])
        : value.toUpperCase(),
    }));
}
