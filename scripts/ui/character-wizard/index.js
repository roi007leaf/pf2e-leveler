import {
  MODULE_ID,
  MIXED_ANCESTRY_CHOICE_FLAG,
  MIXED_ANCESTRY_UUID,
  SKILLS,
  ATTRIBUTES,
  SUBCLASS_TAGS,
  ANCESTRY_TRAIT_ALIASES,
  WEALTH_MODES,
  CHARACTER_WEALTH,
  PERMANENT_ITEM_TYPES,
  expandPermanentItemSlots,
} from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { ensureClassItemRegistered } from '../../classes/ensure.js';
import {
  createCreationData,
  getClassSelectionData,
  normalizeCreationData,
  setAncestry,
  setHeritage,
  setMixedAncestry,
  setBackground,
  setClass,
  setDualClass,
  setImplement,
  setSubconsciousMind,
  setThesis,
  setDeity,
  setSkills,
  setLanguages,
  setLores,
  addSpell,
  removeSpell,
  setGrantedFeatSections,
  setAncestryFeat,
  setAncestryParagonFeat,
  setClassFeat,
  setDualClassFeat,
  setSkillFeat,
  setFeatChoice,
  getGrantedFeatChoiceValues,
  upsertCreationFeatGrant,
  addEquipment,
  removeCreationFeatGrantSelection,
  setPermanentItem,
} from '../../creation/creation-model.js';
import { buildFeatGrantRequirements, getFeatGrantCompletion, getFeatGrantSelections } from '../../plan/feat-grants.js';
import {
  getCreationData,
  saveCreationData,
  exportCreationData,
  importCreationData,
} from '../../creation/creation-store.js';
import { applyCreation } from '../../creation/apply-creation.js';
import { localize } from '../../utils/i18n.js';
import { evaluatePredicate } from '../../utils/predicate.js';
import { registerHandlebarsHelpers } from '../../hooks/lifecycle.js';
import { getClassHandler } from '../../creation/class-handlers/registry.js';
import { isAncestralParagonEnabled, isDualClassEnabled, slugify } from '../../utils/pf2e-api.js';
import { captureScrollState, restoreScrollState } from '../shared/scroll-state.js';
import { getCompendiumKeysForCategory } from '../../compendiums/catalog.js';
import {
  createMixedAncestryHeritage,
  getMixedAncestrySelectedValue,
  isMixedAncestryHeritageUuid,
} from '../../heritages/mixed-ancestry.js';
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
  isRawValueChoiceSet,
  parseChoiceSets,
  refreshGrantedFeatChoiceSections,
  buildMixedAncestryChoiceOptions,
  getSelectedHandlerChoiceSourceItems,
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
  getActiveSkillSlugs,
  getSelectedSubclassChoiceSkillMap,
  getActiveSkillConfigEntry,
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
  loadSubclassesForClass,
  loadTaggedClassFeatures,
  loadThaumaturgeImplements,
  loadTheses,
  parseCurriculum,
  parseSpellUuidsFromDescription,
  parseVesselSpell,
  resolveClassSubclassTag,
} from './loaders.js';
import {
  annotateGuidance,
  annotateGuidanceBySlug,
  filterDisallowedForCurrentUser,
  sortByGuidancePriority,
} from '../../access/content-guidance.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
registerHandlebarsHelpers();

const CREATION_CLASS_SUBCLASS_TYPES = {
  alchemist: 'research field',
  animist: 'practice',
  barbarian: 'instinct',
  bard: 'muse',
  champion: 'cause',
  cleric: 'doctrine',
  druid: 'order',
  gunslinger: 'way',
  inventor: 'innovation',
  investigator: 'methodology',
  kineticist: 'gate',
  magus: 'study',
  oracle: 'mystery',
  psychic: 'conscious mind',
  ranger: "hunter's edge",
  rogue: 'racket',
  sorcerer: 'bloodline',
  summoner: 'eidolon',
  swashbuckler: 'style',
  witch: 'patron',
  wizard: 'school',
};

const SKILL_SLUG_ALIASES = {
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

const ATTRIBUTE_SLUG_ALIASES = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

const STEPS = [
  'ancestry',
  'heritage',
  'mixedAncestry',
  'background',
  'class',
  'deity',
  'sanctification',
  'divineFont',
  'subclass',
  'implement',
  'tactics',
  'ikons',
  'innovationDetails',
  'kineticGate',
  'subconsciousMind',
  'thesis',
  'apparitions',
  'subclassChoices',
  'boosts',
  'skills',
  'feats',
  'featChoices',
  'languages',
  'spells',
  'equipment',
  'summary',
];

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
const HANDLER_STEP_IDS = new Set([
  'deity',
  'sanctification',
  'divineFont',
  'implement',
  'tactics',
  'ikons',
  'innovationDetails',
  'kineticGate',
  'subconsciousMind',
  'thesis',
  'apparitions',
]);

export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super();
    this.actor = actor;
    const storedCreationData = getCreationData(actor);
    this.data = storedCreationData ? normalizeCreationData(storedCreationData) : createCreationData();
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
    this._backgroundSkillFilterLogic = 'or';
    this._backgroundAttributeFilterLogic = 'or';
    const sanitizedDisabledDualClassState = this._sanitizeDisabledDualClassState();
    this._featChoiceDataDirty = !this._hasReusableFeatChoiceData(this.data);
    if (sanitizedDisabledDualClassState) this._featChoiceDataDirty = true;
    this._applyPromptRowsCache = null;
    this._publicationFilters = {};
    this._publicationFilterCollapsed = true;
    this._spellLayoutObserver = null;
    this._isBooting = true;
    this._bootstrapPromise = null;
    this._missingStoredCreationData = !storedCreationData;
    this._cachedHasClassFeatAtLevel1 = null;
    this._cachedRequiredClassBoostSelections = 0;
    this._cachedBoostStepComplete = null;
    this._cachedFeatGrantRequirements = [];
  }

  _sanitizeDisabledDualClassState() {
    if (this._isDualClassCreationEnabled()) return false;

    const dualClassLabels = [
      String(this.data?.dualSubclass?.name ?? '').trim().toLowerCase(),
      String(this.data?.dualClass?.name ?? '').trim().toLowerCase(),
    ].filter(Boolean);
    const isDualClassGrantedSection = (section) => {
      const sourceName = String(section?.sourceName ?? '').trim().toLowerCase();
      return dualClassLabels.some((label) => label && sourceName.startsWith(label));
    };
    const dualClassSectionSlots = new Set(
      (this.data?.grantedFeatSections ?? [])
        .filter((section) => isDualClassGrantedSection(section))
        .map((section) => section.slot),
    );

    const hasDualClassState = !!(
      this.data?.dualClass
      || this.data?.dualSubclass
      || this.data?.dualClassFeat
      || (this.data?.dualSpells?.cantrips?.length ?? 0) > 0
      || (this.data?.dualSpells?.rank1?.length ?? 0) > 0
      || (this.data?.dualCurriculumSpells?.cantrips?.length ?? 0) > 0
      || (this.data?.dualCurriculumSpells?.rank1?.length ?? 0) > 0
      || dualClassSectionSlots.size > 0
      || [...dualClassSectionSlots].some((slot) => {
        const choices = getGrantedFeatChoiceValues(this.data, slot);
        return Object.keys(choices).length > 0;
      })
    );

    if (!hasDualClassState) return false;

    setDualClass(this.data, null);
    this.data.grantedFeatSections = (this.data.grantedFeatSections ?? []).filter(
      (section) => !dualClassSectionSlots.has(section.slot),
    );
    this.data.grantedFeatChoices = Object.fromEntries(
      Object.entries(this.data.grantedFeatChoices ?? {}).filter(([slot]) => !dualClassSectionSlots.has(slot)),
    );
    return true;
  }

  _hasReusableFeatChoiceData(data = this.data) {
    if (!data || typeof data !== 'object') return false;

    const directFeatContainers = [
      data.ancestryFeat,
      data.ancestryParagonFeat,
      data.classFeat,
      data.dualClassFeat,
      data.skillFeat,
    ];

    for (const feat of directFeatContainers) {
      if (!feat?.uuid) continue;
      if (!Array.isArray(feat.choiceSets)) return false;
      if (!Array.isArray(feat.grantedSkills)) return false;
      if (!Array.isArray(feat.grantedLores)) return false;
    }

    if (!Array.isArray(data.grantedFeatSections)) return false;
    for (const section of data.grantedFeatSections) {
      if (!section?.slot) return false;
      if (!Array.isArray(section.choiceSets)) return false;
    }

    return true;
  }

  _preloadCompendiums() {
    ['feats', 'spells', 'classFeatures', 'ancestries', 'backgrounds', 'classes'].forEach(
      (category) => {
        this._loadCompendiumCategory(category);
      },
    );
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
    const stepHandlers = this._getStepHandlers();
    const extraSteps = stepHandlers.flatMap((entry) => entry.steps);
    const extraIds = new Set(extraSteps.map((s) => s.id));
    return STEPS.filter((s) => {
      if (s === 'subclass') return this._hasSubclass();
      if (s === 'subclassChoices') return this._hasSubclassChoices();
      if (s === 'featChoices') return this._hasFeatChoices();
      if (s === 'mixedAncestry') return this._hasMixedAncestry();
      if (s === 'languages') return !!this.data.ancestry;
      if (s === 'spells') return this._needsSpellSelection();
      // Handler-managed steps (deity, sanctification, etc.)
      if (extraIds.has(s)) {
        const owners = stepHandlers.filter((entry) => entry.steps.some((step) => step.id === s));
        return owners.some((entry) => {
          const step = entry.steps.find((candidate) => candidate.id === s);
          return step?.visible?.(entry.data) ?? false;
        });
      }
      // Hide handler steps that aren't registered for this class
      if (HANDLER_STEP_IDS.has(s) && !extraIds.has(s)) return false;
      return true;
    });
  }

  _hasSubclass() {
    return !!(
      (this.data.class?.subclassTag ?? SUBCLASS_TAGS[this.data.class?.slug])
      || (this.data.dualClass?.subclassTag ?? SUBCLASS_TAGS[this.data.dualClass?.slug])
    );
  }

  _isDualClassCreationEnabled() {
    return isDualClassEnabled();
  }

  _getSelectedClassLabel() {
    const labels = [this.data.class?.name, this.data.dualClass?.name].filter(Boolean);
    return labels.length > 0 ? labels.join(' + ') : null;
  }

  _getSelectedSubclassLabel() {
    const labels = [this.data.subclass?.name, this.data.dualSubclass?.name].filter(Boolean);
    return labels.length > 0 ? labels.join(' + ') : null;
  }

  _getPendingSubclassClassEntries() {
    const entries = [];
    const primaryHasSubclass = !!(this.data.class?.subclassTag ?? SUBCLASS_TAGS[this.data.class?.slug]);
    const secondaryHasSubclass = !!(this.data.dualClass?.subclassTag ?? SUBCLASS_TAGS[this.data.dualClass?.slug]);

    if (primaryHasSubclass && !this.data.subclass) {
      entries.push({ key: 'class', classEntry: this.data.class });
    }
    if (secondaryHasSubclass && !this.data.dualSubclass) {
      entries.push({ key: 'dualClass', classEntry: this.data.dualClass });
    }

    return entries;
  }

  _hasMixedAncestry() {
    return (
      isMixedAncestryHeritageUuid(this.data.heritage?.uuid) ||
      this.data.heritage?.slug === 'mixed-ancestry'
    );
  }

  _hasSubclassChoices() {
    return this._getStepHandlers().some((entry) => entry.handler.shouldShowSubclassChoices(entry.data));
  }

  _getStepHandlers() {
    const handlers = [
      {
        key: 'class',
        classEntry: this.data.class ?? null,
        handler: this.classHandler,
        data: {
          ...this.data,
          ...getClassSelectionData(this.data, 'class'),
        },
        steps: this.classHandler.getExtraSteps(),
      },
    ];

    if (this._isDualClassCreationEnabled() && this.data.dualClass?.slug) {
      const dualHandler = getClassHandler(this.data.dualClass.slug);
      handlers.push({
        key: 'dualClass',
        classEntry: this.data.dualClass,
        handler: dualHandler,
        data: {
          ...this.data,
          class: this.data.dualClass,
          subclass: this.data.dualSubclass,
          ...getClassSelectionData(this.data, 'dualClass'),
        },
        steps: dualHandler.getExtraSteps(),
      });
    }

    return handlers;
  }

  _getCurrentHandlerTarget() {
    return this._getStepHandlers().find((entry) =>
      entry.steps.some((step) => step.id === this.stepId),
    )?.key ?? 'class';
  }

  _hasFeatChoices() {
    return (
      (this.data.ancestryFeat?.choiceSets?.length ?? 0) > 0 ||
      (this.data.ancestryParagonFeat?.choiceSets?.length ?? 0) > 0 ||
      (this.data.classFeat?.choiceSets?.length ?? 0) > 0 ||
      (this.data.dualClassFeat?.choiceSets?.length ?? 0) > 0 ||
      (this.data.skillFeat?.choiceSets?.length ?? 0) > 0 ||
      (this.data.grantedFeatSections?.length ?? 0) > 0 ||
      (this._cachedFeatGrantRequirements?.length ?? 0) > 0 ||
      (this.data.featGrants?.length ?? 0) > 0
    );
  }

  async _prepareContext() {
    await this._ensureClassMetadata();
    await this._ensureDualClassMetadata();
    await this._backfillSubclassChoiceCurricula();
    this._cachedHasClassFeatAtLevel1 = this.data.class?.uuid
      ? await this._hasClassFeatAtLevel1()
      : false;
    this._cachedHasDualClassFeatAtLevel1 = this.data.dualClass?.uuid
      ? await this._hasClassFeatAtLevel1('dualClass')
      : false;
    this._cachedRequiredClassBoostSelections = await this._getRequiredClassBoostSelections();
    this._cachedBoostStepComplete = await this._computeBoostStepComplete();
    this._cachedFeatGrantRequirements = await this._buildFeatGrantRequirements();
    const extraSteps = this._getStepHandlers().flatMap((entry) => entry.steps);
    const extraLabels = {
      featChoices: localize('CREATION.FEAT_CHOICES'),
      mixedAncestry: localize('CREATION.STEPS.MIXED_ANCESTRY'),
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
        publicationOptions: [],
        hasPublicationFilter: false,
        showGlobalPublicationFilter: false,
      };
    }

    if (this._featChoiceDataDirty) {
      await this._refreshAllFeatChoiceData();
    }
    this._cachedMaxLanguages = await this._getAdditionalLanguageCount();
    this._cachedMaxSkills = await this._getAdditionalSkillCount();
    const allComplete = this.visibleSteps
      .filter((s) => s !== 'summary')
      .every((s) => this._isStepComplete(s));
    const canApplyCreation = allComplete || game.settings.get(MODULE_ID, 'allowIncompleteCreation');

    const rawStepContext = await this._getStepContext();
    const publicationOptions = buildPublicationOptions(
      rawStepContext,
      this._publicationFilters[this.stepId] ?? [],
    );
    const publicationFilter = buildPublicationFilterState(
      publicationOptions,
      this._publicationFilterCollapsed,
    );
    const stepContext = filterStepContextByPublication(
      rawStepContext,
      publicationOptions,
    );
    const browserStep = buildBrowserStepContext(this.stepId, this.data, stepContext);
      if (browserStep?.stepId === 'background') {
        browserStep.backgroundSkillFilters = (browserStep.backgroundSkillFilters ?? []).map(
          (entry) => ({
            ...entry,
            selected: this._backgroundSkillFilters.has(entry.value),
          }),
        );
        browserStep.backgroundAttributeFilters = (browserStep.backgroundAttributeFilters ?? []).map(
          (entry) => ({
            ...entry,
            selected: this._backgroundAttributeFilters.has(entry.value),
          }),
        );
        browserStep.backgroundSkillLogic = this._backgroundSkillFilterLogic;
        browserStep.backgroundAttributeLogic = this._backgroundAttributeFilterLogic;
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
      canApplyCreation,
      browserStep,
      publicationOptions,
      publicationFilter,
      hasPublicationFilter: publicationOptions.length > 0,
      showGlobalPublicationFilter: publicationOptions.length > 0 && !browserStep,
      ...applyOverlay,
      ...stepContext,
    };
  }

  _onRender() {
    const el = this.element;
    this._restoreWizardScroll(el);
    this._activateListeners(el);
    this._applyBrowserFilters(el);
    this._ensureBootstrapped();
    this._syncSpellLayout(el);
    this._syncPublicationTooltips(el);
  }

  _activateListeners(el) {
    activateCharacterWizardListeners(this, el);
  }

  _ensureBootstrapped() {
    if (!this._isBooting || this._bootstrapPromise) return;

    this._bootstrapPromise = Promise.resolve()
      .then(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await this._recoverCreationDataFromActor();
        await this._normalizeLegacyMixedAncestrySelection();
        this._isBooting = false;
        await this.render({ force: true, parts: ['wizard'] });
        setTimeout(() => this._preloadCompendiums(), 0);
      })
      .catch((error) => {
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

  _syncPublicationTooltips(root) {
    for (const button of root.querySelectorAll('[data-action="togglePublication"]')) {
      const label = button.querySelector('.wizard-source-filter__label');
      if (!label) continue;

      const shouldTooltip = label.scrollWidth > label.clientWidth + 1;
      if (shouldTooltip) {
        button.dataset.tooltip = button.dataset.publicationName ?? label.textContent?.trim() ?? '';
      } else {
        delete button.dataset.tooltip;
      }
    }
  }

  async _getCachedDocument(uuid) {
    if (!uuid) return null;
    if (isMixedAncestryHeritageUuid(uuid)) {
      const mixedAncestry = createMixedAncestryHeritage(this.data?.ancestry ?? null);
      this._documentCache.set(uuid, mixedAncestry);
      return mixedAncestry;
    }
    if (this._documentCache.has(uuid)) return this._documentCache.get(uuid);
    const item = await fromUuid(uuid).catch(() => null);
    this._documentCache.set(uuid, item);
    return item;
  }

  _normalizeClassKeyAbilityOptions(classItem) {
    const values = classItem?.system?.keyAbility?.value;
    if (Array.isArray(values)) {
      return values.filter((value) => typeof value === 'string' && value.length > 0);
    }
    const selected = classItem?.system?.keyAbility?.selected;
    if (typeof selected === 'string' && selected.length > 0) return [selected];
    return [];
  }

  async _ensureClassMetadata(classItem = null) {
    if (!this.data.class?.uuid) return;
    const resolvedClassItem = classItem ?? (await this._getCachedDocument(this.data.class.uuid));
    if (!resolvedClassItem) return;
    ensureClassItemRegistered(resolvedClassItem, this.data.class.slug);

    const keyAbility = this._normalizeClassKeyAbilityOptions(resolvedClassItem);
    if (!Array.isArray(this.data.class.keyAbility) || this.data.class.keyAbility.length === 0) {
      this.data.class.keyAbility = keyAbility;
    }

    if (!this.data.class.subclassTag) {
      this.data.class.subclassTag = await resolveClassSubclassTag(this, resolvedClassItem);
    }
  }

  async _ensureDualClassMetadata(classItem = null) {
    if (!this.data.dualClass?.uuid) return;
    const resolvedClassItem = classItem ?? (await this._getCachedDocument(this.data.dualClass.uuid));
    if (!resolvedClassItem) return;
    ensureClassItemRegistered(resolvedClassItem, this.data.dualClass.slug);

    const keyAbility = this._normalizeClassKeyAbilityOptions(resolvedClassItem);
    if (!Array.isArray(this.data.dualClass.keyAbility) || this.data.dualClass.keyAbility.length === 0) {
      this.data.dualClass.keyAbility = keyAbility;
    }

    if (!this.data.dualClass.subclassTag) {
      this.data.dualClass.subclassTag = await resolveClassSubclassTag(this, resolvedClassItem);
    }
  }

  async _backfillSubclassChoiceCurricula() {
    await this._backfillChoiceCurriculaForEntry(this.data.subclass);
    await this._backfillChoiceCurriculaForEntry(this.data.dualSubclass);
  }

  async _backfillChoiceCurriculaForEntry(subclassEntry) {
    if (!subclassEntry?.choices || typeof subclassEntry.choices !== 'object') return;
    subclassEntry.choiceCurricula ??= {};

    for (const [flag, selectedValue] of Object.entries(subclassEntry.choices)) {
      if (subclassEntry.choiceCurricula[flag]) continue;
      if (typeof selectedValue !== 'string' || !selectedValue.startsWith('Compendium.')) continue;
      const item = await this._getCachedDocument(selectedValue);
      const curriculum = parseCurriculum(item?.system?.description?.value ?? '');
      if (curriculum) subclassEntry.choiceCurricula[flag] = curriculum;
    }
  }

  async _resolveMixedAncestryRef(value) {
    const selectedValue = getMixedAncestrySelectedValue(value);
    if (!selectedValue) return null;

    if (
      this.data?.mixedAncestry?.uuid === selectedValue ||
      this.data?.mixedAncestry?.slug === selectedValue
    ) {
      return this.data.mixedAncestry;
    }

    if (selectedValue.startsWith('Compendium.')) {
      const item = await this._getCachedDocument(selectedValue);
      if (item) return { uuid: item.uuid, name: item.name, img: item.img, slug: item.slug ?? null };
    }

    const match = (await this._loadAncestries()).find(
      (entry) =>
        String(entry?.slug ?? '')
          .trim()
          .toLowerCase() === String(selectedValue).trim().toLowerCase(),
    );
    return match
      ? { uuid: match.uuid, name: match.name, img: match.img, slug: match.slug ?? null }
      : null;
  }

  async _normalizeLegacyMixedAncestrySelection() {
    if (this.data?.mixedAncestry || !this._hasMixedAncestry()) return;
    const legacyValue = getMixedAncestrySelectedValue(
      getGrantedFeatChoiceValues(this.data, MIXED_ANCESTRY_UUID),
    );
    if (!legacyValue) return;
    const mixedAncestryRef = await this._resolveMixedAncestryRef(legacyValue);
    if (mixedAncestryRef) setMixedAncestry(this.data, mixedAncestryRef);
  }

  async _recoverCreationDataFromActor() {
    if (!this._missingStoredCreationData) return;

    const recoveredData = createCreationData();
    const ancestry = this._toRecoveredDocumentRef(this.actor?.ancestry);
    const actorHeritage = this.actor?.heritage;
    const heritage = this._toRecoveredDocumentRef(actorHeritage);
    const background = this._toRecoveredDocumentRef(this.actor?.background);
    const classItem = this._toRecoveredDocumentRef(this.actor?.class);
    const deity = this._findActorItemByType('deity');

    if (ancestry) setAncestry(recoveredData, ancestry);
    if (heritage) {
      const grantedSkills = this._parseGrantedSkills(
        actorHeritage?.system?.rules ?? [],
        actorHeritage?.system?.description?.value ?? '',
      );
      setHeritage(recoveredData, heritage, grantedSkills);
    }
    if (heritage?.uuid === MIXED_ANCESTRY_UUID) {
      const selectedMixedAncestry =
        this.actor?.heritage?.flags?.pf2e?.rulesSelections?.[MIXED_ANCESTRY_CHOICE_FLAG] ??
        this.actor?.heritage?.flags?.[MODULE_ID]?.mixedAncestrySelection ??
        null;
      const mixedAncestryRef = await this._resolveMixedAncestryRef(selectedMixedAncestry);
      if (mixedAncestryRef) {
        setMixedAncestry(recoveredData, mixedAncestryRef);
      }
    }
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
    await this._recoverFeatSlotFromActor(recoveredData, 'ancestryParagonFeat', [
      'ancestryparagon-1',
      'xdy_ancestryparagon-1',
    ]);
    await this._recoverFeatSlotFromActor(recoveredData, 'classFeat', ['class-1']);
    await this._recoverFeatSlotFromActor(recoveredData, 'dualClassFeat', [
      'xdy_dualclass-1',
      'dualclass-1',
      'dual_class-1',
    ]);
    await this._recoverFeatSlotFromActor(recoveredData, 'skillFeat', ['skill-1']);

    if (!this._hasRecoveredCreationSelections(recoveredData)) return;

    this.data = recoveredData;
    this._sanitizeDisabledDualClassState();
    await this._ensureClassMetadata(classItem);
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
    const grantedSkills = this._parseGrantedSkills(
      feat.system?.rules ?? [],
      feat.system?.description?.value ?? '',
    );
    const grantedLores = this._parseSubclassLores(
      feat.system?.rules ?? [],
      feat.system?.description?.value ?? '',
    );

    switch (slot) {
      case 'ancestryFeat':
        setAncestryFeat(data, feat, choiceSets, grantedSkills, grantedLores);
        break;
      case 'ancestryParagonFeat':
        setAncestryParagonFeat(data, feat, choiceSets, grantedSkills, grantedLores);
        break;
      case 'classFeat':
        setClassFeat(data, feat, choiceSets, grantedSkills, grantedLores);
        break;
      case 'dualClassFeat':
        setDualClassFeat(data, feat, choiceSets, grantedSkills, grantedLores);
        break;
      case 'skillFeat':
        setSkillFeat(data, feat, choiceSets, grantedSkills, grantedLores);
        break;
      default:
        break;
    }
  }

  _findActorItemByLocation(locationKeys = []) {
    const normalizedLocations = new Set(
      (locationKeys ?? []).map((value) => String(value).trim().toLowerCase()),
    );
    if (normalizedLocations.size === 0) return null;
    return this._getActorItems().find((item) =>
      normalizedLocations.has(this._getItemLocation(item)),
    );
  }

  _findActorItemByType(type) {
    const normalizedType = String(type ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedType) return null;
    return this._getActorItems().find(
      (item) =>
        String(item?.type ?? '')
          .trim()
          .toLowerCase() === normalizedType,
    );
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
    return String(value ?? '')
      .trim()
      .toLowerCase();
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
    const traits = Array.isArray(item?.traits) ? item.traits : item?.system?.traits?.value;
    if (!uuid && !slug && !name) return null;
    return {
      uuid,
      name,
      img: item.img,
      slug,
      traits: Array.isArray(traits) ? [...traits] : [],
    };
  }

  _hasRecoveredCreationSelections(data) {
    return !!(
      data?.ancestry ||
      data?.heritage ||
      data?.background ||
      data?.class ||
      data?.deity ||
      data?.ancestryFeat ||
      data?.ancestryParagonFeat ||
      data?.classFeat ||
      data?.skillFeat
    );
  }

  async _selectItem(uuid, target = null) {
    const item = await this._getCachedDocument(uuid);
    if (!item) return;

    switch (this.stepId) {
      case 'ancestry':
        setAncestry(this.data, item);
        break;
      case 'heritage':
        setHeritage(
          this.data,
          item,
          this._parseGrantedSkills(item.system?.rules ?? [], item.system?.description?.value ?? ''),
        );
        break;
      case 'mixedAncestry':
        setMixedAncestry(this.data, item);
        break;
      case 'background':
        setBackground(this.data, item);
        break;
      case 'class':
        if (this._isDualClassCreationEnabled() && target === 'dualClass') {
          setDualClass(this.data, item);
          await this._ensureDualClassMetadata(item);
        } else if (this._isDualClassCreationEnabled() && target === 'class') {
          const previousDualClass = this.data.dualClass;
          const previousDualSubclass = this.data.dualSubclass;
          const previousDualSelections = foundry.utils.deepClone(getClassSelectionData(this.data, 'dualClass'));
          const previousDualSpells = foundry.utils.deepClone(this.data.dualSpells ?? { cantrips: [], rank1: [] });
          const previousDualCurriculumSpells = foundry.utils.deepClone(this.data.dualCurriculumSpells ?? { cantrips: [], rank1: [] });
          setClass(this.data, item);
          if (previousDualClass && previousDualClass.uuid !== item.uuid) {
            this.data.dualClass = previousDualClass;
            this.data.dualSubclass = previousDualSubclass;
            this.data.classSelections.dualClass = previousDualSelections;
            this.data.dualSpells = previousDualSpells;
            this.data.dualCurriculumSpells = previousDualCurriculumSpells;
          }
          await this._ensureClassMetadata(item);
          this.classHandler = getClassHandler(item.slug);
        } else if (this._isDualClassCreationEnabled() && this.data.class && !this.data.dualClass) {
          setDualClass(this.data, item);
          await this._ensureDualClassMetadata(item);
        } else {
          setClass(this.data, item);
          await this._ensureClassMetadata(item);
          this.classHandler = getClassHandler(item.slug);
        }
        break;
      case 'implement':
        setImplement(this.data, item, target ?? this._getCurrentHandlerTarget());
        break;
      case 'subconsciousMind':
        setSubconsciousMind(this.data, item, target ?? this._getCurrentHandlerTarget());
        break;
      case 'thesis':
        setThesis(this.data, item, target ?? this._getCurrentHandlerTarget());
        break;
      case 'deity': {
        const font = item.system?.font ?? [];
        const sanctification = item.system?.sanctification ?? {};
        const domains = item.system?.domains ?? { primary: [], alternate: [] };
        const skill = item.system?.skill ?? null;
        setDeity(this.data, {
          uuid: item.uuid,
          name: item.name,
          img: item.img,
          font,
          sanctification,
          domains,
          skill,
        }, target ?? this._getCurrentHandlerTarget());
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
    const target = slot === 'dualClass' ? 'dualClass' : 'class';
    const buildState = await this._buildCreationFeatBuildState(target);

    const classSlug = String(
      (target === 'dualClass' ? this.data.dualClass?.slug : this.data.class?.slug) ?? '',
    ).toLowerCase();
    const ancestryTraits =
      buildState.ancestryTraits instanceof Set ? [...buildState.ancestryTraits] : [];
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
        maxLevel: 1,
        lockMaxLevel: true,
      },
      dualClass: {
        selectedFeatTypes: ['class'],
        lockedFeatTypes: ['class'],
        extraVisibleFeatTypes: ['archetype'],
        selectedTraits: [classSlug].filter(Boolean),
        lockedTraits: [classSlug].filter(Boolean),
        traitLogic: 'or',
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
        const grantedSkills = this._parseGrantedSkills(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        const grantedLores = this._parseSubclassLores(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        setAncestryFeat(this.data, feat, choiceSets, grantedSkills, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      paragon: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedSkills = this._parseGrantedSkills(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        const grantedLores = this._parseSubclassLores(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        setAncestryParagonFeat(this.data, feat, choiceSets, grantedSkills, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      class: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedSkills = this._parseGrantedSkills(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        const grantedLores = this._parseSubclassLores(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        setClassFeat(this.data, feat, choiceSets, grantedSkills, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      dualClass: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedSkills = this._parseGrantedSkills(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        const grantedLores = this._parseSubclassLores(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        setDualClassFeat(this.data, feat, choiceSets, grantedSkills, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
      skill: async (feat) => {
        const choiceSets = await this._parseChoiceSets(feat.system?.rules ?? [], {}, feat);
        const grantedSkills = this._parseGrantedSkills(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        const grantedLores = this._parseSubclassLores(
          feat.system?.rules ?? [],
          feat.system?.description?.value ?? '',
        );
        setSkillFeat(this.data, feat, choiceSets, grantedSkills, grantedLores);
        await this._refreshGrantedFeatChoiceSections();
        await this._saveAndRender();
      },
    };

    const categoryBySlot = {
      ancestry: 'ancestry',
      paragon: 'ancestry',
      class: 'class',
      dualClass: 'class',
      skill: 'skill',
    };
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
    const choiceSets = await this._hydrateChoiceSets(
      choiceContainer.choiceSets ?? [],
      currentChoices,
    );
    const choiceSet = choiceSets.find((entry) => entry.flag === flag);
    if (!choiceSet?.isFeatChoice) return;

    const buildState = await this._buildCreationFeatBuildState(slot === 'dualClass' ? 'dualClass' : 'class');
    const preset = this._buildFeatChoicePickerPreset(choiceSet, buildState);
    const targetLevel = Number(preset.maxLevel ?? 20) || 20;

    const { FeatPicker } = await import('../feat-picker.js');
    const picker = new FeatPicker(
      this.actor,
      'custom',
      targetLevel,
      buildState,
      async (feat) => {
        const selectedOption = findMatchingChoiceOption(
          choiceSet.options,
          feat.uuid ?? feat.sourceId ?? feat.slug ?? feat.name,
        );
        const selectedValue =
          extractChoiceValue(selectedOption) ||
          feat.uuid ||
          feat.sourceId ||
          feat.slug ||
          feat.name;
        setFeatChoice(this.data, slot, flag, selectedValue, {
          curriculum: selectedOption?.curriculum ?? null,
          target: this._inferFeatChoiceTarget(slot),
        });
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

  async _buildCreationFeatBuildState(target = 'class') {
    const classEntry = target === 'dualClass' ? this.data.dualClass : this.data.class;
    const subclassEntry = target === 'dualClass' ? this.data.dualSubclass : this.data.subclass;
    const classSelections = getClassSelectionData(this.data, target);
    const classSlug = String(classEntry?.slug ?? '').toLowerCase();
    const adoptedAncestryTraits = await getAdoptedAncestryFeatTraits(this);
    const mixedAncestryTraits = await getMixedAncestryFeatTraits(this);
    const heritageGrantedTraits = await this._collectHeritageGrantedTraits();
    const ancestryTraits = [
      ...new Set([
        ...collectAncestryFeatTraits(this.data.ancestry, this.data.heritage),
        ...adoptedAncestryTraits,
        ...mixedAncestryTraits,
        ...heritageGrantedTraits,
      ]),
    ];

    const senses = await this._collectSenses();
    const [classSkillsForState, bgSkillsForState] = await Promise.all([
      this._getClassTrainedSkills(target),
      this._getBackgroundTrainedSkills(),
    ]);
    const allTrainedSkills = [
      ...classSkillsForState,
      ...bgSkillsForState,
      ...(subclassEntry?.grantedSkills ?? []),
      ...(classSelections.deity?.skill ? [classSelections.deity.skill] : []),
      ...(this.data.ancestryFeat?.grantedSkills ?? []),
      ...(this.data.ancestryParagonFeat?.grantedSkills ?? []),
      ...(this.data.classFeat?.grantedSkills ?? []),
      ...(this.data.dualClassFeat?.grantedSkills ?? []),
      ...(this.data.skillFeat?.grantedSkills ?? []),
      ...this.data.skills,
    ];
    const skillsMap = Object.fromEntries(allTrainedSkills.map((s) => [s, 1]));
    const attributes = await this._buildCreationAbilityModifiers();
    const level = Number(this.actor?.system?.details?.level?.value ?? 1) || 1;
    const classState = {
      slug: classSlug,
      subclassType: classSlug ? CREATION_CLASS_SUBCLASS_TYPES[classSlug] ?? null : null,
    };
    const classes = classState.slug ? [classState] : [];
    const featState = this._buildCreationSelectedFeatState([
      subclassEntry,
      target === 'dualClass' ? this.data.subclass : this.data.dualSubclass,
      this.data.ancestryFeat,
      this.data.ancestryParagonFeat,
      this.data.classFeat,
      this.data.dualClassFeat,
      this.data.skillFeat,
      ...(this.data.grantedFeatSections ?? []),
    ], classState);

    return {
      level,
      class: classState,
      classes,
      feats: featState.feats,
      featAliasSources: featState.featAliasSources,
      ancestryTraits: new Set(ancestryTraits),
      senses,
      attributes,
      skills: skillsMap,
      divineFont: classSelections.divineFont,
    };
  }

  async _buildCreationAbilityModifiers() {
    const { summary } = await this._buildBoostContext();
    return Object.fromEntries(
      ATTRIBUTES.map((attribute) => [
        attribute,
        Number(summary.find((entry) => entry.key === attribute)?.mod ?? 0),
      ]),
    );
  }

  _buildCreationSelectedFeatState(entries, classState) {
    const feats = new Set();
    const featAliasSources = new Map();

    for (const entry of entries) {
      const slug = String(entry?.slug ?? '').trim().toLowerCase();
      if (!slug) continue;
      feats.add(slug);
      const alias = this._getCreationSubclassFeatAlias(slug, classState);
      if (!alias) continue;
      feats.add(alias);
      if (!featAliasSources.has(alias)) featAliasSources.set(alias, new Map());
      featAliasSources.get(alias).set(slug, entry?.name ?? slug);
    }

    return { feats, featAliasSources };
  }

  _getCreationSubclassFeatAlias(slug, classState) {
    if (!slug || !classState?.slug || !classState?.subclassType) return null;
    if (classState.slug === 'bard' && classState.subclassType === 'muse') return `${slug}-muse`;
    return null;
  }

  _getFeatChoiceContainer(slot) {
    if (slot === 'ancestry') return this.data.ancestryFeat;
    if (slot === 'ancestryParagon') return this.data.ancestryParagonFeat;
    if (slot === 'class') return this.data.classFeat;
    if (slot === 'dualClass') return this.data.dualClassFeat;
    if (slot === 'skill') return this.data.skillFeat;
    return (this.data.grantedFeatSections ?? []).find((section) => section.slot === slot) ?? null;
  }

  _getFeatChoiceValues(slot) {
    if (slot === 'ancestry') return this.data.ancestryFeat?.choices ?? {};
    if (slot === 'ancestryParagon') return this.data.ancestryParagonFeat?.choices ?? {};
    if (slot === 'class') return this.data.classFeat?.choices ?? {};
    if (slot === 'dualClass') return this.data.dualClassFeat?.choices ?? {};
    if (slot === 'skill') return this.data.skillFeat?.choices ?? {};
    return getGrantedFeatChoiceValues(this.data, slot);
  }

  _inferFeatChoiceTarget(slot) {
    if (slot === 'class') return 'class';
    if (slot === 'dualClass') return 'dualClass';

    const section = (this.data.grantedFeatSections ?? []).find((entry) => entry.slot === slot);
    const sourceName = String(section?.sourceName ?? '')
      .trim()
      .toLowerCase();
    if (!sourceName) return null;

    const candidates = [
      { target: 'dualClass', label: this.data.dualSubclass?.name ?? this.data.dualClass?.name ?? '' },
      { target: 'class', label: this.data.subclass?.name ?? this.data.class?.name ?? '' },
    ];

    for (const candidate of candidates) {
      const normalizedLabel = String(candidate.label ?? '')
        .trim()
        .toLowerCase();
      if (normalizedLabel && sourceName.startsWith(normalizedLabel)) return candidate.target;
    }

    return null;
  }

  _buildFeatChoicePickerPreset(choiceSet, buildState) {
    const options = choiceSet?.options ?? [];
    const allowedFeatUuids = options
      .map(
        (option) =>
          option.uuid ??
          (typeof option.value === 'string' && option.value.startsWith('Compendium.')
            ? option.value
            : null),
      )
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);

    const levels = [
      ...new Set(
        options
          .map((option) => Number(option.level ?? 0))
          .filter((level) => Number.isFinite(level) && level > 0),
      ),
    ].sort((a, b) => a - b);

    const featTypeSets = options
      .map((option) => inferFeatChoiceTypes(option, buildState))
      .filter((types) => types.size > 0);
    const lockedFeatTypes = intersectStringSets(featTypeSets);

    const ancestryTraits =
      buildState?.ancestryTraits instanceof Set
        ? [...buildState.ancestryTraits].map((trait) => String(trait).toLowerCase())
        : [];
    const classSlug = String(buildState?.class?.slug ?? '').toLowerCase();
    const commonTraits = intersectStringSets(
      options.map(
        (option) => new Set((option.traits ?? []).map((trait) => String(trait).toLowerCase())),
      ),
    );
    const lockedTraits = commonTraits.filter(
      (trait) => trait === classSlug || ancestryTraits.includes(trait),
    );

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
    if (mode === WEALTH_MODES.CUSTOM)
      return (game.settings.get(MODULE_ID, 'startingEquipmentGoldLimit') ?? 0) * 100;
    return 0;
  }

  _openItemPicker() {
    import('../item-picker.js').then(({ ItemPicker }) => {
      const picker = new ItemPicker(this.actor, (items) => {
        const selectedItems = Array.isArray(items) ? items : [items];
        const budgetCp = this._getGoldBudgetCp();
        let currentCp = equipmentTotalCp(this.data.equipment ?? []);
        let changed = false;
        for (const item of selectedItems) {
          if (!item) continue;
          if (budgetCp > 0 && !game.user.isGM) {
            const itemCp =
              (item.system?.price?.value?.gp ?? 0) * 100 +
              (item.system?.price?.value?.sp ?? 0) * 10 +
              (item.system?.price?.value?.cp ?? 0);
            if (currentCp + itemCp > budgetCp) {
              const limitGp = budgetCp / 100;
              ui.notifications.warn(
                game.i18n.format('PF2E_LEVELER.SETTINGS.EQUIPMENT_GOLD_LIMIT.EXCEEDED', {
                  limit: limitGp,
                }),
              );
              continue;
            }
            currentCp += itemCp;
          }
          const batchSize = Number(item.system?.price?.per ?? 1);
          addEquipment(this.data, item, batchSize > 1 ? batchSize : 1);
          changed = true;
        }
        if (changed) this._saveAndRender();
      }, { multiSelect: true });
      picker.render(true);
    });
  }

  async _openSpellChoicePicker(slot, flag) {
    const choiceContainer =
      slot === 'ancestry'
        ? this.data.ancestryFeat
        : slot === 'ancestryParagon'
          ? this.data.ancestryParagonFeat
          : slot === 'class'
            ? this.data.classFeat
            : slot === 'skill'
              ? this.data.skillFeat
              : (this.data.grantedFeatSections ?? []).find((section) => section.slot === slot);
    if (!choiceContainer) return;

    const currentChoices =
      slot === 'ancestry'
        ? (this.data.ancestryFeat?.choices ?? {})
        : slot === 'ancestryParagon'
          ? (this.data.ancestryParagonFeat?.choices ?? {})
          : slot === 'class'
            ? (this.data.classFeat?.choices ?? {})
            : slot === 'skill'
              ? (this.data.skillFeat?.choices ?? {})
              : getGrantedFeatChoiceValues(this.data, slot);
    const choiceSets = await this._hydrateChoiceSets(
      choiceContainer.choiceSets ?? [],
      currentChoices,
    );
    const choiceSet = choiceSets.find((entry) => entry.flag === flag);
    if (!choiceSet?.isSpellChoice) return;

    const allowedUuids = (choiceSet.options ?? [])
      .map((option) => option?.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.startsWith('Compendium.'));
    if (allowedUuids.length === 0) return;

    const title = `${choiceContainer.featName ?? choiceContainer.name ?? 'Spell Choice'} | ${choiceSet.prompt}`;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        'any',
        -1,
        async (spell) => {
          const selectedOption = findMatchingChoiceOption(
            choiceSet.options,
            spell.uuid ?? spell.sourceId ?? spell.slug ?? spell.name,
          );
          const selectedValue =
            extractChoiceValue(selectedOption) ||
            spell.uuid ||
            spell.sourceId ||
            spell.slug ||
            spell.name;
          setFeatChoice(this.data, slot, flag, selectedValue);
          await this._saveAndRender();
        },
        {
          allowedUuids,
          title,
          exactRank: false,
          multiSelect: false,
          selectedSpells: choiceSet.selectedOption ? [choiceSet.selectedOption] : [],
        },
      );
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
            ui.notifications.warn(
              game.i18n.format('PF2E_LEVELER.STARTING_WEALTH.LEVEL_TOO_HIGH', {
                max: maxLevel,
                item: itemLevel,
              }),
            );
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
      goldLimitLabel:
        mode === WEALTH_MODES.ITEMS_AND_CURRENCY
          ? game.i18n.format('PF2E_LEVELER.STARTING_WEALTH.CURRENCY_BUDGET', { gp: goldLimit })
          : null,
      remaining: remainingParts?.join(', ') ?? null,
      overBudget,
      permanentItemSlots,
    };
  }

  _openSpellPicker(rank, isCantrip, target = 'primary') {
    const classEntry = target === 'secondary' ? this.data.dualClass : this.data.class;
    const subclassEntry = target === 'secondary' ? this.data.dualSubclass : this.data.subclass;
    const spellStore = target === 'secondary' ? this.data.dualSpells : this.data.spells;
    if (!classEntry?.slug) return;

    const classDef = ClassRegistry.get(classEntry.slug);
    if (!classDef?.spellcasting) return;
    let tradition = classDef.spellcasting.tradition;
    if (['bloodline', 'patron'].includes(tradition)) {
      tradition = subclassEntry?.tradition ?? 'arcane';
    }

    const currentSpells = isCantrip ? (spellStore?.cantrips ?? []) : (spellStore?.rank1 ?? []);
    const limits = this._cachedSpellSelectionLimits?.[target] ?? {};
    const max = isCantrip ? (limits.maxCantrips ?? null) : (limits.maxRank1 ?? null);
    const remaining = max != null ? max - currentSpells.length : null;

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        tradition,
        rank,
        (spells) => {
          for (const spell of spells) addSpell(this.data, spell, isCantrip, target);
          this._saveAndRender();
        },
        {
          exactRank: true,
          multiSelect: true,
          excludedUuids: currentSpells.map((s) => s.uuid),
          selectedSpells: currentSpells,
          onRemoveSelected: async (spell) => {
            removeSpell(this.data, spell?.uuid, isCantrip, target);
            this._applyPromptRowsCache = null;
            await saveCreationData(this.actor, this.data);
            await this.render({ force: true, parts: ['wizard'] });
          },
          maxSelect: remaining,
        },
      );
      picker.render(true);
    });
  }

  _filterItems(el, query) {
    const effectiveQuery =
      typeof query === 'string'
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
    let visibleCount = 0;
    el.querySelectorAll('.wizard-item, .skill-btn[data-name]').forEach((item) => {
      const name = item.dataset.name?.toLowerCase() ?? '';
      const rarity = item.dataset.rarity || 'common';
      const itemSkills = String(item.dataset.skills ?? '')
        .split(',')
        .map((value) => normalizeBackgroundSkillValue(value))
        .filter(Boolean);
      const itemAttributes = String(item.dataset.attributes ?? '')
        .split(',')
        .map((value) => normalizeBackgroundAttributeValue(value))
        .filter(Boolean);
      const matchesQuery = name.includes(effectiveQuery);
      const matchesRarity = !hiddenRarities.has(rarity);
      const matchesSkills = this._matchesBackgroundFilterSet(
        itemSkills,
        requiredSkills,
        this._backgroundSkillFilterLogic,
      );
      const matchesAttributes = this._matchesBackgroundFilterSet(
        itemAttributes,
        requiredAttributes,
        this._backgroundAttributeFilterLogic,
      );
      const visible = matchesQuery && matchesRarity && matchesSkills && matchesAttributes;
      item.style.display = visible ? '' : 'none';
      if (visible && item.classList.contains('wizard-item')) visibleCount += 1;
    });

    const countEl = el.querySelector?.('.wizard-browser__count');
    if (countEl) countEl.textContent = String(visibleCount);
  }

  _toggleBackgroundSkillFilter(skill) {
    if (!skill) return;
    if (this._backgroundSkillFilters.has(skill)) this._backgroundSkillFilters.delete(skill);
    else this._backgroundSkillFilters.add(skill);
    this._filterItems(this.element, '');
  }

  _toggleBackgroundAttributeFilter(attribute) {
    if (!attribute) return;
    if (this._backgroundAttributeFilters.has(attribute))
      this._backgroundAttributeFilters.delete(attribute);
    else this._backgroundAttributeFilters.add(attribute);
    this._filterItems(this.element, '');
  }

  _toggleBackgroundSkillFilterLogic() {
    this._backgroundSkillFilterLogic = this._backgroundSkillFilterLogic === 'and' ? 'or' : 'and';
    this.render(true);
  }

  _setBackgroundSkillFilterLogic(logic) {
    const normalized = logic === 'and' ? 'and' : 'or';
    if (this._backgroundSkillFilterLogic === normalized) return;
    this._backgroundSkillFilterLogic = normalized;
    this.render(true);
  }

  _toggleBackgroundAttributeFilterLogic() {
    this._backgroundAttributeFilterLogic =
      this._backgroundAttributeFilterLogic === 'and' ? 'or' : 'and';
    this.render(true);
  }

  _setBackgroundAttributeFilterLogic(logic) {
    const normalized = logic === 'and' ? 'and' : 'or';
    if (this._backgroundAttributeFilterLogic === normalized) return;
    this._backgroundAttributeFilterLogic = normalized;
    this.render(true);
  }

  _applyBrowserFilters(el = this.element) {
    if (!el || this.stepId !== 'background') return;
    if (!el.querySelector?.('.wizard-browser')) return;
    this._filterItems(el, null);
  }

  _matchesBackgroundFilterSet(itemValues, requiredValues, logic = 'or') {
    if (!(requiredValues instanceof Set) || requiredValues.size === 0) return true;
    const normalizedItemValues = new Set((itemValues ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
    if (normalizedItemValues.size === 0) return false;
    if (logic === 'and') return [...requiredValues].every((value) => normalizedItemValues.has(String(value).trim().toLowerCase()));
    return [...requiredValues].some((value) => normalizedItemValues.has(String(value).trim().toLowerCase()));
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
      nextPrompt?.app?.bringToTop?.();
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
      .map((app) => ({ app, title: String(app.title).trim() }))
      .filter((entry) => entry.title.length > 0);
    return candidates.at(-1) ?? null;
  }

  async _saveAndRender() {
    this._captureWizardScroll();
    this._applyPromptRowsCache = null;
    await saveCreationData(this.actor, this.data);
    await this.render({ force: true, parts: ['wizard'] });
  }

  _togglePublicationFilter(publication, allPublications = []) {
    if (!publication) return;
    const available = new Set((allPublications ?? []).filter(Boolean));
    const current = new Set(
      (this._publicationFilters[this.stepId] ?? []).filter((entry) => available.has(entry)),
    );

    if (current.has(publication)) {
      current.delete(publication);
    } else {
      current.add(publication);
    }

    this._publicationFilters[this.stepId] = [...current];
    this.render(true);
  }

  _togglePublicationFilterSection() {
    this._publicationFilterCollapsed = !this._publicationFilterCollapsed;
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
        const sanitizedDisabledDualClassState = this._sanitizeDisabledDualClassState();
        this.classHandler = getClassHandler(this.data.class?.slug);
        this._featChoiceDataDirty = !this._hasReusableFeatChoiceData(this.data);
        if (sanitizedDisabledDualClassState) this._featChoiceDataDirty = true;
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
      content: '.wizard-main',
      browserFilters: '.wizard-browser__filters',
      browserResults: '.wizard-browser__results',
    });
  }

  _restoreWizardScroll(root) {
    restoreScrollState(root, this._scrollState, {
      sidebar: '.wizard-steps',
      content: '.wizard-main',
      browserFilters: '.wizard-browser__filters',
      browserResults: '.wizard-browser__results',
    });
  }

  _isCaster() {
    const primaryClassDef = this.data.class?.slug ? ClassRegistry.get(this.data.class.slug) : null;
    const secondaryClassDef = this.data.dualClass?.slug ? ClassRegistry.get(this.data.dualClass.slug) : null;
    return !!primaryClassDef?.spellcasting || !!secondaryClassDef?.spellcasting;
  }

  _needsSpellSelection() {
    const primaryClassDef = this.data.class?.slug ? ClassRegistry.get(this.data.class.slug) : null;
    const primaryNeeds = !!this.data.class?.slug
      && this.classHandler.needsSpellSelection(this.data, primaryClassDef);
    if (primaryNeeds) return true;
    if (!this.data.dualClass?.slug) return false;

    const secondaryClassDef = ClassRegistry.get(this.data.dualClass.slug);
    const secondaryHandler = getClassHandler(this.data.dualClass.slug);
    return secondaryHandler.needsSpellSelection({
      ...this.data,
      class: this.data.dualClass,
      subclass: this.data.dualSubclass,
      spells: this.data.dualSpells ?? { cantrips: [], rank1: [] },
      curriculumSpells: this.data.dualCurriculumSpells ?? { cantrips: [], rank1: [] },
    }, secondaryClassDef);
  }

  async _hasClassFeatAtLevel1(target = 'class') {
    const classEntry = target === 'dualClass' ? this.data.dualClass : this.data.class;
    if (!classEntry?.uuid) return false;
    const classItem = await this._getCachedDocument(classEntry.uuid);
    if (!classItem) return false;
    const classFeatLevels = classItem.system?.classFeatLevels?.value ?? [];
    return classFeatLevels.includes(1);
  }

  async _getAdditionalSkillCount() {
    const classItems = await Promise.all(
      [this.data.class?.uuid, this.data.dualClass?.uuid]
        .filter((uuid) => typeof uuid === 'string' && uuid.length > 0)
        .map((uuid) => this._getCachedDocument(uuid)),
    );
    const resolvedClassItems = classItems.filter(Boolean);
    if (resolvedClassItems.length === 0) return 3;
    const additional = Math.max(
      ...resolvedClassItems.map((item) => Number(item.system?.trainedSkills?.additional ?? 3)),
    );
    const intMod = await this._computeIntMod();
    const duplicateAutoTrainedSkills = await this._getDuplicateAutoTrainedSkillCount(resolvedClassItems);
    return Math.max(0, additional + intMod + duplicateAutoTrainedSkills);
  }

  async _getDuplicateAutoTrainedSkillCount(classItems = null) {
    const resolvedClassItems = Array.isArray(classItems)
      ? classItems.filter(Boolean)
      : [
        classItems ??
        (this.data.class?.uuid ? await this._getCachedDocument(this.data.class.uuid) : null),
        this.data.dualClass?.uuid ? await this._getCachedDocument(this.data.dualClass.uuid) : null,
      ].filter(Boolean);

    const dualSelections = getClassSelectionData(this.data, 'dualClass');
    const autoTrainedSkills = new Set([
      ...resolvedClassItems.flatMap((item) =>
        (item.system?.trainedSkills?.value ?? []).filter(
          (s) => typeof s === 'string' && s.length > 0,
        )),
      ...(this.data.subclass?.grantedSkills ?? []).filter(
        (s) => typeof s === 'string' && s.length > 0,
      ),
      ...(this.data.dualSubclass?.grantedSkills ?? []).filter(
        (s) => typeof s === 'string' && s.length > 0,
      ),
      ...getSelectedSubclassChoiceSkillMap(this.data).keys(),
      ...(this.data.deity?.skill ? [this.data.deity.skill] : []),
      ...(dualSelections.deity?.skill ? [dualSelections.deity.skill] : []),
    ]);
    if (autoTrainedSkills.size === 0) return 0;

    const backgroundSkills = await this._getBackgroundTrainedSkills();
    return backgroundSkills.filter((skill) => autoTrainedSkills.has(skill)).length;
  }

  _getSkillsNote() {
    if (!this._getPendingSubclassClassEntries().length) return null;
    const pendingSubclass = this._getPendingSubclassClassEntries().some((entry) => {
      const slug = entry.classEntry?.slug;
      return !!(entry.classEntry?.subclassTag ?? SUBCLASS_TAGS[slug]);
    });
    if (pendingSubclass)
      return 'Your subclass may also grant trained skills — select a subclass first.';
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
        mod -= this._extractFixedValues(ancestry?.system?.flaws).filter(
          (value) => value === 'int',
        ).length;
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

  async _getClassTrainedSkills(target = 'class') {
    const classEntry = target === 'dualClass' ? this.data.dualClass : this.data.class;
    if (!classEntry?.uuid) return [];
    const classItem = await this._getCachedDocument(classEntry.uuid);
    if (!classItem) return [];
    return [
      ...new Set([
        ...((classItem.system?.trainedSkills?.value ?? []).filter(
          (skill) => typeof skill === 'string' && skill.length > 0,
        )),
        ...this._parseGrantedSkills(
          classItem.system?.rules ?? [],
          classItem.system?.description?.value ?? '',
        ),
      ]),
    ];
  }

  _isStepComplete(stepId) {
    const handlerOwners = this._getStepHandlers().filter((entry) =>
      entry.steps.some((step) => step.id === stepId),
    );
    if (handlerOwners.length > 0) {
      const results = handlerOwners
        .map((entry) => entry.handler.isStepComplete(stepId, entry.data))
        .filter((result) => result !== null);
      if (results.length > 0) return results.every(Boolean);
    } else {
      const handlerResult = this.classHandler.isStepComplete(stepId, this.data);
      if (handlerResult !== null) return handlerResult;
    }

    switch (stepId) {
      case 'ancestry':
        return !!this.data.ancestry;
      case 'heritage':
        return !!this.data.heritage;
      case 'mixedAncestry':
        return !this._hasMixedAncestry() || !!this.data.mixedAncestry;
      case 'background':
        return !!this.data.background;
      case 'class':
        return !!this.data.class && (!this._isDualClassCreationEnabled() || !!this.data.dualClass);
      case 'subclass':
        return this._getPendingSubclassClassEntries().length === 0;
      case 'subclassChoices': {
        if (!this._hasSubclassChoices()) return true;
        const sections = [
          this.data.subclass
            ? { choiceSets: this.data.subclass.choiceSets ?? [], choices: this.data.subclass.choices ?? {} }
            : null,
          this.data.dualSubclass
            ? { choiceSets: this.data.dualSubclass.choiceSets ?? [], choices: this.data.dualSubclass.choices ?? {} }
            : null,
        ].filter((section) => (section?.choiceSets?.length ?? 0) > 0);
        return sections.every((section) => section.choiceSets.every((cs) => {
          const val = section.choices[cs.flag];
          return typeof val === 'string' && val !== '[object Object]';
        }));
      }
      case 'featChoices': {
        if (!this._hasFeatChoices()) return true;
        const grantCompletion = getFeatGrantCompletion(
          { featGrants: this.data.featGrants ?? [] },
          this._cachedFeatGrantRequirements ?? [],
        );
        const grantsComplete = Object.values(grantCompletion).every((entry) => entry.complete);
        const sections = [
          ...[
            this.data.ancestryFeat,
            this.data.ancestryParagonFeat,
            this.data.classFeat,
            this.data.dualClassFeat,
            this.data.skillFeat,
          ]
            .filter(Boolean)
            .map((feat) => ({ choiceSets: feat.choiceSets ?? [], choices: feat.choices ?? {} })),
          ...(this.data.grantedFeatSections ?? []).map((section) => ({
            choiceSets: section.choiceSets ?? [],
            choices: getGrantedFeatChoiceValues(this.data, section.slot),
          })),
        ];
        return sections.every((section) =>
          section.choiceSets.every((cs) => {
            const val = section.choices?.[cs.flag];
            return typeof val === 'string' && val !== '[object Object]';
          }),
        ) && grantsComplete;
      }
      case 'boosts':
        if (typeof this._cachedBoostStepComplete === 'boolean')
          return this._cachedBoostStepComplete;
        return (
          this.data.boosts.free.length === 4 &&
          (this.data.boosts.class?.length ?? 0) >= (this._cachedRequiredClassBoostSelections ?? 0)
        );
      case 'languages':
        return this.data.languages.length >= (this._cachedMaxLanguages ?? 0);
      case 'skills':
        return (this.data.skills?.length ?? 0) >= (this._cachedMaxSkills ?? 1);
      case 'feats':
        return (
          !!this.data.ancestryFeat &&
          (!isAncestralParagonEnabled() || !!this.data.ancestryParagonFeat) &&
          (!this._needsLevel1ClassFeatSelection() || !!this.data.classFeat) &&
          (!this._needsLevel1DualClassFeatSelection() || !!this.data.dualClassFeat) &&
          (!this._needsLevel1SkillFeatSelection() || !!this.data.skillFeat)
        );
      case 'spells': {
        if (!this._needsSpellSelection()) return true;
        const spellHandlerResult = this.classHandler.isStepComplete('spells', this.data);
        if (spellHandlerResult !== null) return spellHandlerResult;
        const primaryClassDef = this.data.class?.slug ? ClassRegistry.get(this.data.class.slug) : null;
        const secondaryClassDef = this.data.dualClass?.slug ? ClassRegistry.get(this.data.dualClass.slug) : null;
        const primaryLimits = this._cachedSpellSelectionLimits?.primary ?? {};
        const secondaryLimits = this._cachedSpellSelectionLimits?.secondary ?? {};
        const primaryComplete = !primaryClassDef?.spellcasting
          || (
            (this.data.spells?.cantrips?.length ?? 0) >= (primaryLimits.maxCantrips ?? 0)
            && (
              (primaryLimits.maxRank1 ?? 0) <= 0
              || (this.data.spells?.rank1?.length ?? 0) >= (primaryLimits.maxRank1 ?? 0)
            )
          );
        const secondaryComplete = !secondaryClassDef?.spellcasting
          || (
            (this.data.dualSpells?.cantrips?.length ?? 0) >= (secondaryLimits.maxCantrips ?? 0)
            && (
              (secondaryLimits.maxRank1 ?? 0) <= 0
              || (this.data.dualSpells?.rank1?.length ?? 0) >= (secondaryLimits.maxRank1 ?? 0)
            )
          );
        return primaryComplete && secondaryComplete;
      }
      case 'equipment':
        return true;
      case 'summary':
        return true;
      default:
        return false;
    }
  }

  async _getStepContext() {
    switch (this.stepId) {
      case 'ancestry':
        return {
          items: (await this._loadAncestries())
            .filter((i) => i.type === 'ancestry')
            .filter((i) => i.uuid !== this.data.ancestry?.uuid),
        };
      case 'heritage':
        return {
          items: (await this._loadHeritages())
            .filter((i) => i.type === 'heritage')
            .filter((i) => i.uuid !== this.data.heritage?.uuid),
        };
      case 'mixedAncestry':
        return {
          items: (await buildMixedAncestryChoiceOptions(this))
            .filter((i) => i.type === 'ancestry')
            .filter((i) => i.uuid !== this.data.mixedAncestry?.uuid),
        };
      case 'background':
        return {
          items: (await this._loadBackgrounds())
            .filter((i) => i.type === 'background')
            .filter((i) => i.uuid !== this.data.background?.uuid),
        };
      case 'class':
        if (!this._isDualClassCreationEnabled()) {
          return {
            items: (await this._loadClasses())
              .filter((i) => i.type === 'class')
              .filter((i) => i.uuid !== this.data.class?.uuid),
            selected: this.data.class
              ? {
                  ...this.data.class,
                  img: this.data.class.img ?? null,
                }
              : null,
          };
        }
        {
          const allClasses = (await this._loadClasses()).filter((i) => i.type === 'class');
          const classGroups = [
            {
              key: 'class',
              slotLabel: 'Class',
              selected: this.data.class ?? null,
              items: allClasses
                .filter((i) => i.uuid !== this.data.class?.uuid)
                .filter((i) => i.uuid !== this.data.dualClass?.uuid)
                .map((entry) => ({ ...entry, targetKey: 'class' })),
            },
            {
              key: 'dualClass',
              slotLabel: 'Dual Class',
              selected: this.data.dualClass ?? null,
              items: allClasses
                .filter((i) => i.uuid !== this.data.class?.uuid)
                .filter((i) => i.uuid !== this.data.dualClass?.uuid)
                .map((entry) => ({ ...entry, targetKey: 'dualClass' })),
            },
          ];
          return {
            items: classGroups.flatMap((group) => group.items),
            classGroups,
            selected: null,
          };
        }
      case 'subclass': {
        const pendingEntries = this._getPendingSubclassClassEntries();
        if (pendingEntries.length === 0) {
          const subclassGroups = [
            this.data.subclass
              ? {
                  key: 'class',
                  className: this.data.class?.name ?? 'Class',
                  selected: this.data.subclass,
                  items: [],
                }
              : null,
            this.data.dualSubclass
              ? {
                  key: 'dualClass',
                  className: this.data.dualClass?.name ?? 'Dual Class',
                  selected: this.data.dualSubclass,
                  items: [],
                }
              : null,
          ].filter(Boolean);
          return {
            items: [],
            subclassGroups,
            selected: this._getSelectedSubclassLabel()
              ? {
                  name: this._getSelectedSubclassLabel(),
                  img: this.data.subclass?.img ?? this.data.dualSubclass?.img ?? null,
                }
              : null,
          };
        }
        const subclassGroups = [];
        for (const pendingEntry of pendingEntries) {
          const pendingData = pendingEntry.key === 'dualClass'
            ? {
                ...this.data,
                class: this.data.dualClass,
                subclass: this.data.dualSubclass,
              }
            : this.data;
          const pendingHandler = pendingEntry.key === 'dualClass'
            ? getClassHandler(this.data.dualClass?.slug)
            : this.classHandler;
          let subclasses = (await this._loadSubclassesForClass(pendingEntry.classEntry)).filter(
            (i) => i.uuid !== this.data.subclass?.uuid && i.uuid !== this.data.dualSubclass?.uuid,
          );
          subclasses = pendingHandler.filterSubclasses(subclasses, pendingData);
          subclassGroups.push({
            key: pendingEntry.key,
            className: pendingEntry.classEntry?.name ?? 'Class',
            items: subclasses.map((entry) => ({ ...entry, targetKey: pendingEntry.key })),
          });
        }
        return {
          items: subclassGroups.flatMap((group) => group.items),
          subclassGroups,
          selected: this._getSelectedSubclassLabel()
            ? {
                name: this._getSelectedSubclassLabel(),
                img: this.data.subclass?.img ?? this.data.dualSubclass?.img ?? null,
              }
            : null,
        };
      }
      case 'subclassChoices':
        return await this._buildSubclassChoicesContext();
      case 'featChoices':
        return await this._buildFeatChoicesContext();
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
        const handlerOwner = this._getStepHandlers().find((entry) =>
          entry.steps.some((step) => step.id === this.stepId),
        );
        const handlerCtx = handlerOwner
          ? await handlerOwner.handler.getStepContext(this.stepId, handlerOwner.data, this)
          : await this.classHandler.getStepContext(this.stepId, this.data, this);
        if (handlerCtx) {
          return {
            ...handlerCtx,
            data: handlerOwner?.data ?? this.data,
            handlerTarget: handlerOwner?.key ?? 'class',
          };
        }
        return {};
      }
      case 'boosts':
        return await this._buildBoostContext();
      case 'languages': {
        const langCtx = await this._buildLanguageContext();
        annotateGuidanceBySlug(langCtx.choosableLanguages, 'language');
        langCtx.choosableLanguages = filterDisallowedForCurrentUser(langCtx.choosableLanguages);
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
        const subclassLores = (this.data.subclass?.grantedLores ?? []).map((name) => ({
          name,
          source: this.data.subclass.name,
        }));
        const dualSubclassLores = (this.data.dualSubclass?.grantedLores ?? []).map((name) => ({
          name,
          source: this.data.dualSubclass.name,
        }));
        const featLores = [
          this.data.ancestryFeat
            ? {
                source: this.data.ancestryFeat.name,
                lores: this.data.ancestryFeat.grantedLores ?? [],
              }
            : null,
          this.data.ancestryParagonFeat
            ? {
                source: this.data.ancestryParagonFeat.name,
                lores: this.data.ancestryParagonFeat.grantedLores ?? [],
              }
            : null,
          this.data.classFeat
            ? { source: this.data.classFeat.name, lores: this.data.classFeat.grantedLores ?? [] }
            : null,
          this.data.skillFeat
            ? { source: this.data.skillFeat.name, lores: this.data.skillFeat.grantedLores ?? [] }
            : null,
        ]
          .filter(Boolean)
          .flatMap((entry) => entry.lores.map((name) => ({ name, source: entry.source })));
        const apparitionLores = (this.data.apparitions ?? []).flatMap((entry) =>
          (entry.lores ?? []).map((name) => ({ name, source: entry.name })),
        );
        const allLores = dedupeLores([
          ...bgLores,
          ...subclassLores,
          ...dualSubclassLores,
          ...featLores,
          ...apparitionLores,
        ]);
        setLores(
          this.data,
          allLores.map((l) => l.name),
        );
        const skills = await this._buildSkillContext();
        annotateGuidanceBySlug(skills, 'skill');
        const visibleSkills = filterDisallowedForCurrentUser(skills);
        sortByGuidancePriority(visibleSkills, (a, b) => a.label.localeCompare(b.label));
        return {
          skills: visibleSkills,
          maxSkills,
          selectedCount,
          skillsNote: this._getSkillsNote(),
          lores: allLores,
        };
      }
      case 'feats':
        return await this._buildFeatContext();
      case 'spells':
        return await this._buildSpellContext();
      case 'equipment':
        return this._buildEquipmentContext();
      case 'summary':
        return buildSummaryContext(this);
      default:
        return {};
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

  async _loadSubclassesForClass(classEntry) {
    return loadSubclassesForClass(this, classEntry);
  }

  async _loadTheses(classEntry = this.data.class) {
    return loadTheses(this, classEntry);
  }

  async _loadThaumaturgeImplements(classEntry = this.data.class) {
    return loadThaumaturgeImplements(this, classEntry);
  }

  async _loadCommanderTactics(classEntry = this.data.class) {
    return loadCommanderTactics(this, classEntry);
  }

  async _loadExemplarIkons(classEntry = this.data.class) {
    return loadExemplarIkons(this, classEntry);
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

  async _loadPsychicSubconsciousMinds(classEntry = this.data.class) {
    if (classEntry?.slug !== 'psychic') return [];
    const items = await this._loadTaggedClassFeatures(
      'psychic-subconscious-mind',
      'psychic-subconscious-minds',
    );
    return items.map((item) => ({
      ...item,
      keyAbility: this._parsePsychicKeyAbility(item.description ?? ''),
    }));
  }

  async _loadApparitions(classEntry = this.data.class) {
    if (classEntry?.slug !== 'animist') return [];
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
      if (!match || Number(rule.value) < 1) continue;
      const normalizedSkill = SKILL_SLUG_ALIASES[match[1]] ?? match[1];
      if (getActiveSkillSlugs().includes(normalizedSkill)) skills.push(normalizedSkill);
    }
    if (skills.length === 0 && html) {
      const rawText = String(html)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const text = rawText.toLowerCase();
      const clauses = text.match(/\b(?:you\s+)?(?:become|are)\s+trained\s+in\s+([^.!?]+)/gu) ?? [];
      for (const clause of clauses) {
        for (const skill of getActiveSkillSlugs()) {
          const localized = this._localizeSkillSlug(skill).toLowerCase();
          if (clause.includes(localized) || clause.includes(skill.toLowerCase())) {
            skills.push(skill);
          }
        }
      }

      const patronSkillMatch = rawText.match(/patron\s+skill\s*[:-]?\s*([A-Za-z]+)/i);
      if (patronSkillMatch) {
        const normalized = patronSkillMatch[1].trim().toLowerCase();
        for (const skill of getActiveSkillSlugs()) {
          const localized = this._localizeSkillSlug(skill).toLowerCase();
          if (normalized === localized || normalized === skill.toLowerCase()) {
            skills.push(skill);
          }
        }
      }
    }
    return [...new Set(skills)];
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
      if (
        rule.key === 'ActiveEffectLike' &&
        typeof rule.path === 'string' &&
        rule.path.includes('proficiencies.aliases')
      ) {
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
    const raw = getActiveSkillConfigEntry(slug);
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
        buildRow(
          'ancestry',
          item?.name ?? '',
          'Ancestry (Alternate)',
          [],
          [],
          2,
          [...ATTRIBUTES],
          this.data.boosts.ancestry ?? [],
        );
      } else {
        const sets = this._parseBoostSets(item?.system?.boosts);
        const flaws = this._extractFixedValues(item?.system?.flaws);
        const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
        const choices = sets.filter((s) => s.type === 'choice');
        const totalFree = choices.length;
        const allOptions =
          totalFree > 0
            ? choices.some((c) => c.options.length === 6)
              ? [...ATTRIBUTES]
              : choices[0].options
            : [];
        buildRow(
          'ancestry',
          item?.name ?? '',
          'Ancestry',
          fixed,
          flaws,
          totalFree,
          allOptions,
          this.data.boosts.ancestry ?? [],
        );
      }
    }

    if (this.data.background?.uuid) {
      const item = await this._getCachedDocument(this.data.background.uuid);
      const sets = this._parseBoostSets(item?.system?.boosts);
      const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
      const choices = sets.filter((s) => s.type === 'choice');
      const totalFree = choices.length;
      const restricted = choices.find((c) => c.options.length < 6)?.options ?? [];
      buildRow(
        'background',
        item?.name ?? '',
        'Background',
        fixed,
        [],
        totalFree,
        [...ATTRIBUTES],
        this.data.boosts.background ?? [],
      );
      boostRows[boostRows.length - 1].restricted = restricted;
    }

    if (this.data.class?.slug) {
      const classDef = ClassRegistry.get(this.data.class.slug);
      const keyAbility = await this.classHandler.getKeyAbilityOptions(this.data, classDef);
      if (this.data.class.slug === 'psychic' && this.data.subconsciousMind?.keyAbility) {
        this.data.boosts.class = [this.data.subconsciousMind.keyAbility];
        buildRow(
          'class',
          this.data.class.name,
          'Class',
          [this.data.subconsciousMind.keyAbility],
          [],
          0,
          [],
          [],
        );
        boostRows[boostRows.length - 1].keyAbility = this.data.subconsciousMind.keyAbility;
      } else if (keyAbility.length === 1) {
        this.data.boosts.class = [keyAbility[0]];
        buildRow('class', this.data.class.name, 'Class', [keyAbility[0]], [], 0, [], []);
        boostRows[boostRows.length - 1].keyAbility = keyAbility[0];
      } else if (keyAbility.length > 1) {
        this.data.boosts.class ??= [];
        buildRow(
          'class',
          this.data.class.name,
          'Class',
          [],
          [],
          1,
          keyAbility,
          this.data.boosts.class,
        );
        boostRows[boostRows.length - 1].isKeyChoice = true;
      } else {
        buildRow('class', this.data.class.name, 'Class', [], [], 0, [], []);
      }
    }

    buildRow('free', 'Level 1', 'Free', [], [], 4, [...ATTRIBUTES], this.data.boosts.free ?? []);

    const allBoosts = [
      ...boostRows.flatMap((r) => r.fixed),
      ...boostRows.flatMap((r) => r.selected),
    ];
    const allFlaws = boostRows.flatMap((r) => r.flaws);
    const totals = {};
    for (const a of ATTRIBUTES) totals[a] = 0;
    for (const b of allBoosts) if (totals[b] !== undefined) totals[b]++;
    for (const f of allFlaws) if (totals[f] !== undefined) totals[f]--;

    for (const row of boostRows) {
      const restricted = row.restricted ?? [];
      const hasRestrictedPick =
        restricted.length > 0 && row.selected.some((s) => restricted.includes(s));

      row.cells = ATTRIBUTES.map((key) => {
        const hasFlaw = row.flaws.includes(key);
        if (row.keyAbility === key) return { key, type: 'key' };
        if (row.fixed.includes(key)) return { key, type: 'fixed' };
        if (!row.options.includes(key))
          return hasFlaw ? { key, type: 'flaw' } : { key, type: 'empty' };

        const selected = row.selected.includes(key);
        const isRestricted = restricted.includes(key);
        const locked = restricted.length > 0 && !hasRestrictedPick && !isRestricted;

        return { key, type: 'option', selected, source: row.source, locked, isRestricted, hasFlaw };
      });
    }

    const summary = ATTRIBUTES.map((key) => ({ key, label: key.toUpperCase(), mod: totals[key] }));
    this._cachedBoostStepComplete = boostRows.every((row) => row.complete);
    return {
      boostRows,
      summary,
      alternateAncestryBoosts: this.data.alternateAncestryBoosts,
      hasAncestry: !!this.data.ancestry,
    };
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
      for (const v of b.value ?? []) {
        if (ATTRIBUTES.includes(v)) result.push(v);
      }
    }
    return result;
  }

  async _buildSubclassChoicesContext() {
    return buildSubclassChoicesContext(this);
  }

  async _buildFeatChoicesContext() {
    return {
      ...await buildFeatChoicesContext(this),
      ...await this._buildFeatGrantChoicesContext(),
    };
  }

  async _buildFeatGrantRequirements() {
    return buildFeatGrantRequirements({
      actor: this.actor,
      feats: this._getCreationFeatGrantSources(),
      classEntries: [this.data.class, this.data.dualClass].filter(Boolean),
      level: 1,
    });
  }

  async _buildFeatGrantChoicesContext() {
    const requirements = this._cachedFeatGrantRequirements?.length
      ? this._cachedFeatGrantRequirements
      : await this._buildFeatGrantRequirements();
    const completion = getFeatGrantCompletion({ featGrants: this.data.featGrants ?? [] }, requirements);

    return {
      featGrantRequirements: requirements.map((requirement) => {
        const state = completion[requirement.id] ?? {};
        return {
          ...requirement,
          selectedCount: state.selected ?? 0,
          requiredCount: state.required,
          missingCount: state.missing,
          complete: state.complete === true,
          selections: getFeatGrantSelections({ featGrants: this.data.featGrants ?? [] }, requirement),
        };
      }),
    };
  }

  _getCreationFeatGrantSources() {
    const sources = [
      this.data.ancestryFeat,
      this.data.ancestryParagonFeat,
      this.data.classFeat,
      this.data.dualClassFeat,
      this.data.skillFeat,
      ...(this.data.grantedFeatSections ?? []).map((section) =>
        section?.slot ? { uuid: section.slot, name: section.featName } : null),
      this.data.subclass,
      this.data.dualSubclass,
      ...this._getSelectedChoiceGrantSources(),
      ...getSelectedHandlerChoiceSourceItems(this),
    ];
    const seen = new Set();
    return sources.filter((entry) => {
      if (!entry?.uuid || seen.has(entry.uuid)) return false;
      seen.add(entry.uuid);
      return true;
    });
  }

  _getSelectedChoiceGrantSources() {
    const containers = [
      { choiceSets: this.data.subclass?.choiceSets ?? [], choices: this.data.subclass?.choices ?? {} },
      { choiceSets: this.data.dualSubclass?.choiceSets ?? [], choices: this.data.dualSubclass?.choices ?? {} },
      { choiceSets: this.data.ancestryFeat?.choiceSets ?? [], choices: this.data.ancestryFeat?.choices ?? {} },
      { choiceSets: this.data.ancestryParagonFeat?.choiceSets ?? [], choices: this.data.ancestryParagonFeat?.choices ?? {} },
      { choiceSets: this.data.classFeat?.choiceSets ?? [], choices: this.data.classFeat?.choices ?? {} },
      { choiceSets: this.data.dualClassFeat?.choiceSets ?? [], choices: this.data.dualClassFeat?.choices ?? {} },
      { choiceSets: this.data.skillFeat?.choiceSets ?? [], choices: this.data.skillFeat?.choices ?? {} },
      ...((this.data.grantedFeatSections ?? []).map((section) => ({
        choiceSets: section.choiceSets ?? [],
        choices: getGrantedFeatChoiceValues(this.data, section.slot),
      }))),
    ];

    return containers.flatMap((container) =>
      (container.choiceSets ?? []).map((choiceSet) => {
        if (isRawValueChoiceSet(choiceSet)) return null;
        const selectedValue = container.choices?.[choiceSet.flag];
        if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') return null;
        const option = findMatchingChoiceOption(choiceSet.options ?? [], selectedValue);
        const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
        if (!uuid) return null;
        return { uuid, name: option?.label ?? choiceSet.prompt ?? uuid };
      }).filter(Boolean));
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
    const stored = (this.data.featGrants ?? []).find((entry) => entry?.requirementId === requirementId);
    const requirements = this._cachedFeatGrantRequirements?.length
      ? this._cachedFeatGrantRequirements
      : await this._buildFeatGrantRequirements();
    const detected = requirements.find((entry) => entry?.id === requirementId) ?? null;
    if (stored?.manual) return mergeStoredManualFeatGrantRequirement(stored, detected, requirementId);
    return detected;
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
    upsertCreationFeatGrant(this.data, {
      requirementId: requirement.id,
      sourceFeatUuid: requirement.sourceFeatUuid,
      sourceFeatName: requirement.sourceFeatName,
      kind: result.kind,
      manual: { count: result.count, filters: {} },
      selections: [],
    });
    await this._saveAndRender();
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
        await this._saveAndRender();
      },
      {
        items: await loadItems(),
        multiSelect: true,
        maxSelect,
        takenItems: requirement.kind === 'formula' ? this._getTakenFormulaGrantSelections() : [],
        title: buildFeatGrantPickerTitle(requirement),
        preset: buildItemGrantPickerPreset(requirement, {
          maxLevelCap: requirement.kind === 'formula' ? 1 : null,
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
        await this._saveAndRender();
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
    return (this.data.featGrants ?? []).find((entry) => entry?.requirementId === requirementId)?.selections ?? [];
  }

  _getTakenFormulaGrantSelections() {
    const selections = [];
    for (const grant of this.data.featGrants ?? []) {
      if (grant?.kind !== 'formula') continue;
      selections.push(...(grant.selections ?? []));
    }
    return dedupeGrantSelections(selections);
  }

  _storeFeatGrantSelections(requirement, documents) {
    const existing = this._getStoredFeatGrantSelections(requirement.id);
    const selections = dedupeGrantSelections([
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

    upsertCreationFeatGrant(this.data, {
      requirementId: requirement.id,
      sourceFeatUuid: requirement.sourceFeatUuid,
      sourceFeatName: requirement.sourceFeatName,
      kind: requirement.kind,
      manual: requirement.confidence === 'manual' ? { count: requirement.count, filters: requirement.filters ?? {} } : undefined,
      selections,
    });
  }

  async _removeFeatGrantSelection(requirementId, uuid) {
    removeCreationFeatGrantSelection(this.data, requirementId, uuid);
    await this._saveAndRender();
  }

  async _hydrateChoiceSets(choiceSets, currentChoices) {
    return hydrateChoiceSets(this, choiceSets, currentChoices);
  }

  async _getSelectedSubclassChoiceLabels() {
    return getSelectedSubclassChoiceLabels(this);
  }

  async _getSelectedDualSubclassChoiceLabels() {
    return getSelectedChoiceLabels(this, this.data.dualSubclass);
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
    for (const feat of [
      this.data.ancestryFeat,
      this.data.ancestryParagonFeat,
      this.data.classFeat,
      this.data.dualClassFeat,
      this.data.skillFeat,
    ]) {
      if (!feat?.uuid) continue;
      const item = await this._getCachedDocument(feat.uuid);
      if (!item) continue;
      feat.choiceSets = await this._parseChoiceSets(
        item.system?.rules ?? [],
        feat.choices ?? {},
        item,
      );
      feat.grantedSkills = this._parseGrantedSkills(
        item.system?.rules ?? [],
        item.system?.description?.value ?? '',
      );
      feat.grantedLores = this._parseSubclassLores(
        item.system?.rules ?? [],
        item.system?.description?.value ?? '',
      );
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
    const ancestryItem = this.data.ancestry?.uuid
      ? await this._getCachedDocument(this.data.ancestry.uuid)
      : null;
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
        if (!evaluatePredicate(rule.predicate, this.actor?.system?.details?.level?.value ?? 1))
          continue;
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
    const heritageItem = this.data.heritage?.uuid
      ? await this._getCachedDocument(this.data.heritage.uuid)
      : null;
    if (!heritageItem) return [];
    const traits = [];
    for (const trait of heritageItem.system?.traits?.value ?? []) {
      traits.push(String(trait).toLowerCase());
    }
    for (const rule of heritageItem.system?.rules ?? []) {
      if (
        rule.key !== 'ActiveEffectLike' ||
        typeof rule.path !== 'string' ||
        typeof rule.value !== 'string'
      )
        continue;
      if (rule.path === 'system.traits.value' || rule.path === 'system.details.ancestry.trait') {
        traits.push(rule.value.toLowerCase());
      }
    }
    return traits;
  }

  async _collectSenses() {
    const senses = new Set();
    const ancestryItem = this.data.ancestry?.uuid
      ? await this._getCachedDocument(this.data.ancestry.uuid)
      : null;
    const heritageItem = this.data.heritage?.uuid
      ? await this._getCachedDocument(this.data.heritage.uuid)
      : null;
    for (const item of [ancestryItem, heritageItem]) {
      if (!item) continue;
      const vision = item.system?.vision;
      if (vision === 'darkvision') senses.add('darkvision');
      else if (vision === 'lowLightVision' || vision === 'low-light-vision')
        senses.add('low-light-vision');
      for (const rule of item.system?.rules ?? []) {
        if (rule.key === 'Sense' && typeof rule.selector === 'string') {
          senses.add(
            rule.selector
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase()
              .replace(/^-/, ''),
          );
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
    const hasClassFeat = typeof this._cachedHasClassFeatAtLevel1 === 'boolean'
      ? this._cachedHasClassFeatAtLevel1
      : await this._hasClassFeatAtLevel1();
    this._cachedHasClassFeatAtLevel1 = hasClassFeat;
    const hasDualClassFeat = typeof this._cachedHasDualClassFeatAtLevel1 === 'boolean'
      ? this._cachedHasDualClassFeatAtLevel1
      : await this._hasClassFeatAtLevel1('dualClass');
    this._cachedHasDualClassFeatAtLevel1 = hasDualClassFeat;
    const hasSkillFeat = this._needsLevel1SkillFeatSelection();

    const featSlots = [
      this.data.ancestryFeat,
      this.data.ancestryParagonFeat,
      this.data.classFeat,
      this.data.dualClassFeat,
      this.data.skillFeat,
    ];
    for (const feat of featSlots) {
      if (feat?.uuid) feat.grantedItems = await this._collectGrantedItems(feat.uuid);
    }

    return {
      hasClassFeat,
      hasDualClassFeat,
      hasSkillFeat,
      ancestralParagonEnabled,
      dualClassFeatLabel: this.data.dualClass?.name
        ? `${this.data.dualClass.name} Class Feat`
        : 'Dual Class Feat',
    };
  }

  async _buildSpellContext() {
    return buildSpellContext(this);
  }

  _getSanitizedCurriculumSelections(target = 'primary') {
    return getSanitizedCurriculumSelections(this, target);
  }

  _limitCurriculumSelections(list, validUuids, max) {
    return limitCurriculumSelections(list, validUuids, max);
  }

  _needsLevel1ClassFeatSelection() {
    if (typeof this._cachedHasClassFeatAtLevel1 === 'boolean')
      return this._cachedHasClassFeatAtLevel1;

    const classItem = this.data.class?.uuid ? this._documentCache.get(this.data.class.uuid) : null;
    const classFeatLevels = classItem?.system?.classFeatLevels?.value ?? [];
    return classFeatLevels.includes(1);
  }

  _needsLevel1DualClassFeatSelection() {
    if (typeof this._cachedHasDualClassFeatAtLevel1 === 'boolean')
      return this._cachedHasDualClassFeatAtLevel1;

    const classItem = this.data.dualClass?.uuid ? this._documentCache.get(this.data.dualClass.uuid) : null;
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

  addAncestryFeatTraitTokens(traits, ancestrySlug);
  addAncestryFeatTraitTokens(traits, heritageSlug);

  return [...traits];
}

function addAncestryFeatTraitTokens(target, value) {
  if (!value) return;
  if (typeof value === 'string') {
    addAncestryFeatTraitAliases(target, value);
    return;
  }

  for (const candidate of [
    value.slug ?? null,
    value.name ?? null,
    ...(Array.isArray(value.traits) ? value.traits : (value.system?.traits?.value ?? [])),
  ]) {
    addAncestryFeatTraitAliases(target, candidate);
  }
}

function addAncestryFeatTraitAliases(target, value) {
  const normalized = slugify(String(value ?? '').toLowerCase());
  if (!normalized) return;
  const aliases = ANCESTRY_TRAIT_ALIASES[normalized] ?? [normalized];
  for (const alias of aliases) target.add(alias);
}

async function getAdoptedAncestryFeatTraits(wizard) {
  const traits = new Set();

  for (const section of wizard.data.grantedFeatSections ?? []) {
    if (
      String(section?.featName ?? '')
        .trim()
        .toLowerCase() !== 'adopted ancestry'
    )
      continue;

    const currentChoices = getGrantedFeatChoiceValues(wizard.data, section.slot);
    for (const choiceSet of section.choiceSets ?? []) {
      const selectedValue = currentChoices?.[choiceSet.flag];
      if (typeof selectedValue !== 'string' || selectedValue.length === 0) continue;

      const matchedOption = (choiceSet.options ?? []).find(
        (option) =>
          normalizeAncestryChoiceIdentity(option?.value) ===
            normalizeAncestryChoiceIdentity(selectedValue) ||
          normalizeAncestryChoiceIdentity(option?.uuid) ===
            normalizeAncestryChoiceIdentity(selectedValue),
      );

      const selectedSlug =
        matchedOption?.value && !String(matchedOption.value).startsWith('Compendium.')
          ? String(matchedOption.value)
          : await resolveAncestrySlugFromChoice(wizard, matchedOption?.uuid ?? selectedValue);

      if (!selectedSlug) continue;
      for (const trait of collectAncestryFeatTraits(selectedSlug, null)) traits.add(trait);
    }
  }

  return [...traits];
}

async function getMixedAncestryFeatTraits(wizard) {
  const traits = new Set();
  if (
    wizard.data.heritage?.uuid !== MIXED_ANCESTRY_UUID &&
    wizard.data.heritage?.slug !== 'mixed-ancestry'
  )
    return [];

  const selectedValue =
    getMixedAncestrySelectedValue(wizard.data.mixedAncestry) ??
    getMixedAncestrySelectedValue(getGrantedFeatChoiceValues(wizard.data, MIXED_ANCESTRY_UUID));
  if (typeof selectedValue !== 'string' || selectedValue.length === 0) return [];
  const selectedSlug =
    wizard.data.mixedAncestry?.slug ?? (await resolveAncestrySlugFromChoice(wizard, selectedValue));

  if (!selectedSlug) return [];
  for (const trait of collectAncestryFeatTraits(selectedSlug, null)) traits.add(trait);
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
  const ancestryTraits =
    buildState?.ancestryTraits instanceof Set
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

  return [...normalizedSets[0]].filter((value) => normalizedSets.every((set) => set.has(value)));
}

const PUBLICATION_FILTERABLE_KEYS = new Set([
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

export function buildPublicationOptions(stepContext, storedSelection = []) {
  const publications = collectPublications(stepContext);
  if (publications.length === 0) return [];

  const allKeys = new Set(publications.map((publication) => publication.key));
  const selectedKeys = new Set((storedSelection ?? []).filter((key) => allKeys.has(key)));

  return publications.map((publication) => ({
    ...publication,
    selected: selectedKeys.has(publication.key),
  }));
}

export function buildPublicationFilterState(publicationOptions = [], collapsed = true) {
  const selected = (publicationOptions ?? []).filter((option) => option.selected);
  return {
    collapsed: collapsed !== false,
    activeCount: selected.length,
    summary: selected.length > 0 ? String(selected.length) : '',
  };
}

export function filterStepContextByPublication(stepContext, publicationOptions = []) {
  const selectedKeys = new Set(
    publicationOptions.filter((option) => option.selected).map((option) => option.key),
  );
  if (selectedKeys.size === 0) return stepContext;

  return filterPublicationValue(stepContext, selectedKeys);
}

function collectPublications(value, found = new Map()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectPublications(entry, found);
    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  if (!value || typeof value !== 'object')
    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));

  const title = String(value.publicationTitle ?? '').trim();
  if (title.length > 0) {
    found.set(title, {
      key: title,
      label: title,
    });
  }

  for (const nested of Object.values(value)) {
    collectPublications(nested, found);
  }

  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function filterPublicationValue(value, selectedKeys, parentKey = null) {
  if (Array.isArray(value)) {
    if (PUBLICATION_FILTERABLE_KEYS.has(parentKey)) {
      return value.filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const publicationTitle = String(entry.publicationTitle ?? '').trim();
        if (!publicationTitle) return true;
        return selectedKeys.has(publicationTitle);
      });
    }

    return value.map((entry) => filterPublicationValue(entry, selectedKeys, parentKey));
  }

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      filterPublicationValue(nested, selectedKeys, key),
    ]),
  );
}

export function buildCompendiumSourceOptions(stepId, stepContext, storedSelection = []) {
  const sources = collectCompendiumSources(stepId, stepContext);
  if (sources.length === 0) return [];

  const allKeys = new Set(sources.map((source) => source.key));
  const selectedKeys = new Set(
    (storedSelection?.length ? storedSelection : [...allKeys]).filter((key) => allKeys.has(key)),
  );

  return sources.map((source) => ({
    ...source,
    selected: selectedKeys.has(source.key),
  }));
}

export function filterStepContextByCompendiumSource(stepContext, sourceOptions = []) {
  const selectedKeys = new Set(
    sourceOptions.filter((option) => option.selected).map((option) => option.key),
  );
  if (selectedKeys.size === 0) return stepContext;

  return filterCompendiumSourceValue(stepContext, selectedKeys);
}

function collectCompendiumSources(stepId, value, found = new Map()) {
  const category = LEGACY_BROWSER_STEP_COMPENDIUM_CATEGORIES[stepId];
  const configuredKeys = category ? getCompendiumKeysForCategory(category) : [];
  if (configuredKeys.length > 0) {
    for (const key of configuredKeys) {
      const pack = game.packs?.get?.(key);
      if (!pack) continue;
      const packageName = pack.metadata?.packageName ?? pack.metadata?.package ?? key;
      const label = game.modules?.get?.(packageName)?.title ?? packageName;
      if (!found.has(packageName)) {
        found.set(packageName, { key: packageName, label });
      }
    }
  }

  return collectSourceEntries(value, found);
}

const LEGACY_BROWSER_STEP_COMPENDIUM_CATEGORIES = {
  ancestry: 'ancestries',
  heritage: 'heritages',
  mixedAncestry: 'ancestries',
  background: 'backgrounds',
  class: 'classes',
  subclass: 'classFeatures',
};

function collectSourceEntries(value, found = new Map()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectSourceEntries(entry, found);
    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  if (!value || typeof value !== 'object') {
    return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  const sourceKey = String(value.sourcePackage ?? value.sourcePack ?? '').trim();
  if (sourceKey) {
    const label = String(value.sourcePackageLabel ?? value.sourceLabel ?? sourceKey).trim() || sourceKey;
    if (!found.has(sourceKey)) found.set(sourceKey, { key: sourceKey, label });
  }

  for (const nested of Object.values(value)) {
    collectSourceEntries(nested, found);
  }

  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function filterCompendiumSourceValue(value, selectedKeys, parentKey = null) {
  if (Array.isArray(value)) {
    if (PUBLICATION_FILTERABLE_KEYS.has(parentKey)) {
      return value.filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const sourceKey = String(entry.sourcePackage ?? entry.sourcePack ?? '').trim();
        if (!sourceKey) return true;
        return selectedKeys.has(sourceKey);
      });
    }

    return value.map((entry) => filterCompendiumSourceValue(entry, selectedKeys, parentKey));
  }

  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      filterCompendiumSourceValue(nested, selectedKeys, key),
    ]),
  );
}

function buildBrowserStepContext(stepId, data, stepContext) {
  const config = BROWSER_STEP_CONFIG[stepId];
  if (!config) return null;

  const groupedItems =
    Array.isArray(stepContext?.classGroups)
      ? stepContext.classGroups.flatMap((group) => group.items ?? [])
      : Array.isArray(stepContext?.subclassGroups)
        ? stepContext.subclassGroups.flatMap((group) => group.items ?? [])
        : null;
  const baseItems = Array.isArray(stepContext?.items) ? stepContext.items : [];
  const items = sortByGuidancePriority(
    filterDisallowedForCurrentUser(annotateGuidance(groupedItems ?? baseItems)).map((item) => ({
      ...item,
      trainedSkillsText: Array.isArray(item?.trainedSkills) ? item.trainedSkills.join(',') : '',
      boostsText: Array.isArray(item?.backgroundAttributes) ? item.backgroundAttributes.join(',') : '',
    })),
    (a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')),
  );
  const context = {
    stepId,
    title: config.title ? config.title : localize(config.titleKey),
    resultsLabel: config.resultsLabel ? config.resultsLabel : localize(config.resultsKey),
    items,
    selected: stepContext?.selected ?? (config.selectedKey ? (data[config.selectedKey] ?? null) : null),
    clearAction: stepContext?.clearAction ?? config.clearAction,
    showSearch: config.showSearch !== false,
    showRarityFilters: config.showRarityFilters !== false,
    showTraits: config.showTraits === true,
    selectAction: config.selectAction ?? 'selectItem',
  };

  const browserGroups = stepContext?.classGroups ?? stepContext?.subclassGroups ?? null;
  if (Array.isArray(browserGroups) && browserGroups.length > 0) {
    const selectedGroups = browserGroups
      .filter((group) => group.selected)
      .map((group) => ({
        key: group.key,
        label:
          stepId === 'subclass'
            ? (group.className ?? group.slotLabel ?? 'Subclass')
            : (group.slotLabel ?? group.className ?? 'Selection'),
        selected: group.selected,
        target: group.key,
        clearAction:
          stepId === 'class'
            ? 'clearClass'
            : stepId === 'subclass'
              ? 'clearSubclass'
              : null,
      }));
    if (selectedGroups.length > 0) context.selectedGroups = selectedGroups;
    context.groups = browserGroups.map((group) => ({
      label: group.className ?? group.slotLabel ?? 'Group',
      slotLabel: group.slotLabel,
      selected: group.selected ?? null,
      items: sortByGuidancePriority(
        filterDisallowedForCurrentUser(annotateGuidance(group.items ?? [])).map((item) => ({
          ...item,
          trainedSkillsText: Array.isArray(item?.trainedSkills) ? item.trainedSkills.join(',') : '',
          boostsText: Array.isArray(item?.backgroundAttributes) ? item.backgroundAttributes.join(',') : '',
        })),
        (a, b) => String(a?.name ?? '').localeCompare(String(b?.name ?? '')),
      ),
    }));
  }

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
    context.backgroundSkillFilters = buildBackgroundFilterOptions(
      items,
      'trainedSkills',
      SKILLS,
      globalThis.CONFIG?.PF2E?.skills ?? {},
    );
    context.backgroundAttributeFilters = buildBackgroundFilterOptions(items, 'boosts', ATTRIBUTES, {
      fieldValues: (item) => item?.backgroundAttributes ?? item?.boosts ?? [],
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

function getRemainingGrantSelections(requirement, currentSelections) {
  const required = Number(requirement?.count ?? requirement?.manual?.count);
  if (!Number.isFinite(required) || required <= 0) return null;
  return Math.max(0, required - (currentSelections?.length ?? 0));
}

function buildFeatGrantPickerTitle(requirement) {
  const sourceName = String(requirement?.sourceFeatName ?? '').trim();
  if (!sourceName) return requirement?.kind === 'formula' ? 'Choose Formulas' : 'Choose Granted Items';
  return `${sourceName}: ${requirement?.kind === 'formula' ? 'Formula' : 'Item'}`;
}

function buildItemGrantPickerPreset(requirement, { maxLevelCap = null } = {}) {
  const filters = requirement?.filters ?? {};
  const rarityValues = ['common', 'uncommon', 'rare', 'unique'];
  const rarityFilter = normalizeRarityFilter(filters.rarity, rarityValues);
  return {
    ...(Array.isArray(filters.itemTypes) && filters.itemTypes.length > 0 ? { selectedCategories: filters.itemTypes } : {}),
    ...(Array.isArray(filters.traits) && filters.traits.length > 0 ? { selectedTraits: filters.traits } : {}),
    ...(Array.isArray(filters.requiredTraits) && filters.requiredTraits.length > 0 ? { requiredTraits: filters.requiredTraits } : {}),
    ...(typeof filters.traitLogic === 'string' ? { traitLogic: filters.traitLogic } : {}),
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
    grantingSourceUuid: detected?.grantingSourceUuid ?? null,
    grantingSourceName: detected?.grantingSourceName ?? null,
    kind: stored.kind ?? detected?.kind,
    count: Number.isFinite(Number(stored.manual?.count)) ? Number(stored.manual.count) : detected?.count,
    confidence: 'manual',
    filters: {
      ...(detected?.filters ?? {}),
      ...(stored.manual?.filters ?? {}),
    },
  };
}

function dedupeGrantSelections(selections) {
  const seen = new Set();
  const deduped = [];
  for (const selection of selections ?? []) {
    if (!selection?.uuid || seen.has(selection.uuid)) continue;
    seen.add(selection.uuid);
    deduped.push(selection);
  }
  return deduped;
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
  mixedAncestry: {
    titleKey: 'CREATION.STEPS.MIXED_ANCESTRY',
    resultsKey: 'SETTINGS.COMPENDIUM_CATEGORIES.ANCESTRIES',
    selectedKey: 'mixedAncestry',
    clearAction: 'clearMixedAncestry',
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

function _compactSourceOwnerLabel(label) {
  let text = String(label ?? '').trim();
  if (!text) return '';

  if (/^pathfinder second edition$/i.test(text)) return 'PF2E';

  text = text.replace(/\s+for\s+Pathfinder\s+2e\s+by\s+Roll\s+For\s+Combat$/i, '');
  text = text.replace(/\s+by\s+Roll\s+For\s+Combat$/i, '');

  return text;
}

function buildBackgroundFilterOptions(items, field, allowedValues, labels) {
  const resolveValues =
    typeof labels?.fieldValues === 'function'
      ? labels.fieldValues
      : (item) => item?.[field] ?? [];
  const available = new Set();
  for (const item of items) {
    for (const value of resolveValues(item)) {
      const normalized =
        field === 'trainedSkills'
          ? normalizeBackgroundSkillValue(value)
          : normalizeBackgroundAttributeValue(value);
      if (allowedValues.includes(normalized)) available.add(normalized);
    }
  }

  return [...available]
    .sort((a, b) => String(labels[a] ?? a).localeCompare(String(labels[b] ?? b)))
    .map((value) => ({
      value,
      label:
        typeof labels[value] === 'string'
          ? game.i18n?.has?.(labels[value])
            ? game.i18n.localize(labels[value])
            : labels[value]
          : value.toUpperCase(),
    }));
}

function normalizeBackgroundSkillValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return SKILL_SLUG_ALIASES[normalized] ?? normalized;
}

function normalizeBackgroundAttributeValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ATTRIBUTE_SLUG_ALIASES[normalized] ?? normalized;
}
