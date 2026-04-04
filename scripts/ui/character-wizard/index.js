import { MODULE_ID, SKILLS, ATTRIBUTES, SUBCLASS_TAGS } from '../../constants.js';
import { ClassRegistry } from '../../classes/registry.js';
import { createCreationData, setAncestry, setHeritage, setBackground, setClass, setImplement, setSubconsciousMind, setThesis, setDeity, setSkills, setLanguages, setLores, addSpell, setGrantedFeatSections } from '../../creation/creation-model.js';
import { getCreationData, saveCreationData, clearCreationData } from '../../creation/creation-store.js';
import { applyCreation } from '../../creation/apply-creation.js';
import { localize } from '../../utils/i18n.js';
import { getClassHandler } from '../../creation/class-handlers/registry.js';
import { captureScrollState, restoreScrollState } from '../shared/scroll-state.js';
import {
  buildFeatChoicesContext,
  buildSubclassChoicesContext,
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
  loadDeities,
  loadExemplarIkons,
  loadHeritages,
  loadInventorArmorModifications,
  loadInventorArmorOptions,
  loadInventorWeaponModifications,
  loadInventorWeaponOptions,
  loadRawHeritages,
  loadSubclasses,
  loadTaggedClassFeatures,
  loadThaumaturgeImplements,
  loadTheses,
  parseCurriculum,
  parseSpellUuidsFromDescription,
  parseVesselSpell,
} from './loaders.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STEPS = ['ancestry', 'heritage', 'background', 'class', 'deity', 'sanctification', 'divineFont', 'subclass', 'implement', 'tactics', 'ikons', 'innovationDetails', 'kineticGate', 'subconsciousMind', 'thesis', 'apparitions', 'subclassChoices', 'boosts', 'languages', 'skills', 'feats', 'featChoices', 'spells', 'summary'];
const HANDLER_STEP_IDS = new Set(['deity', 'sanctification', 'divineFont', 'implement', 'tactics', 'ikons', 'innovationDetails', 'kineticGate', 'subconsciousMind', 'thesis', 'apparitions']);

export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super();
    this.actor = actor;
    this.data = getCreationData(actor) ?? createCreationData();
    this.currentStep = 0;
    this.spellSubStep = 'cantrips';
    this.classHandler = getClassHandler(this.data.class?.slug);
    this._compendiumCache = {};
    this._documentCache = new Map();
    this.isApplying = false;
    this.applyProgress = 0;
    this.applyStatus = '';
    this._applyPromptWatcher = null;
    this._activeSystemPrompt = null;
    this._featChoiceDataDirty = true;
    this._applyPromptRowsCache = null;
    this._preloadCompendiums();
  }

  _preloadCompendiums() {
    ['pf2e.feats-srd', 'pf2e.spells-srd', 'pf2e.classfeatures', 'pf2e.ancestries', 'pf2e.backgrounds', 'pf2e.classes'].forEach((key) => {
      this._loadCompendium(key);
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
      || (this.data.classFeat?.choiceSets?.length ?? 0) > 0
      || (this.data.grantedFeatSections?.length ?? 0) > 0;
  }


  async _prepareContext() {
    if (this._featChoiceDataDirty) {
      await this._refreshAllFeatChoiceData();
    }
    this._cachedMaxLanguages = await this._getAdditionalLanguageCount();
    this._cachedMaxSkills = await this._getAdditionalSkillCount();
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

    const allComplete = this.visibleSteps.filter((s) => s !== 'summary').every((s) => this._isStepComplete(s));

    const stepContext = await this._getStepContext();
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
      ...applyOverlay,
      ...stepContext,
    };
  }

  _onRender() {
    const el = this.element;
    this._restoreWizardScroll(el);
    this._activateListeners(el);
  }

  _activateListeners(el) {
    activateCharacterWizardListeners(this, el);
  }

  async _getCachedDocument(uuid) {
    if (!uuid) return null;
    if (this._documentCache.has(uuid)) return this._documentCache.get(uuid);
    const item = await fromUuid(uuid).catch(() => null);
    this._documentCache.set(uuid, item);
    return item;
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
        setDeity(this.data, { uuid: item.uuid, name: item.name, img: item.img, font, sanctification });
        break;
      }
      default:
        break;
    }

    if (['ancestry', 'heritage', 'background', 'class'].includes(this.stepId)) {
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

  _openSpellPicker(rank, isCantrip) {
    if (!this._isCaster()) return;
    const classDef = ClassRegistry.get(this.data.class.slug);
    let tradition = classDef.spellcasting.tradition;
    if (['bloodline', 'patron'].includes(tradition)) {
      tradition = this.data.subclass?.tradition ?? 'arcane';
    }

    import('../spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        tradition,
        rank,
        (spell) => {
          addSpell(this.data, spell, isCantrip);
          this._saveAndRender();
        },
      );
      picker.render(true);
    });
  }

  _filterItems(el, query) {
    el.querySelectorAll('.wizard-item, .skill-btn[data-name]').forEach((item) => {
      const name = item.dataset.name?.toLowerCase() ?? '';
      item.style.display = name.includes(query) ? '' : 'none';
    });
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
      await clearCreationData(this.actor);
      ui.notifications.info(localize('CREATION.CREATION_COMPLETE'));
      this.close();
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

  _captureWizardScroll() {
    this._scrollState = captureScrollState(this.element, {
      sidebar: '.wizard-steps',
      content: '.wizard-content',
    });
  }

  _restoreWizardScroll(root) {
    restoreScrollState(root, this._scrollState, {
      sidebar: '.wizard-steps',
      content: '.wizard-content',
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
    const intMod = this._computeIntMod();
    return Math.max(0, additional + intMod);
  }

  _getSkillsNote() {
    if (this.data.subclass) return null;
    const slug = this.data.class?.slug;
    if (SUBCLASS_TAGS[slug]) return 'Your subclass may also grant trained skills — select a subclass first.';
    return null;
  }

  _computeIntMod() {
    let mod = 0;
    for (const val of Object.values(this.data.boosts ?? {})) {
      if (Array.isArray(val)) {
        mod += val.filter((v) => v === 'int').length;
      }
    }
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
          ...[this.data.ancestryFeat, this.data.classFeat]
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
      case 'boosts': return this.data.boosts.free.length === 4;
      case 'languages': return this.data.languages.length >= (this._cachedMaxLanguages ?? 0);
      case 'skills': return this.data.skills.length >= (this._cachedMaxSkills ?? 1);
      case 'feats': return !!this.data.ancestryFeat;
      case 'spells': {
        if (!this._needsSpellSelection()) return true;
        const spellHandlerResult = this.classHandler.isStepComplete('spells', this.data);
        if (spellHandlerResult !== null) return spellHandlerResult;
        const mc = this._cachedMaxCantrips ?? 1;
        const mr = this._cachedMaxRank1 ?? 0;
        return this.data.spells.cantrips.length >= mc && (mr <= 0 || this.data.spells.rank1.length >= mr);
      }
      case 'summary': return true;
      default: return false;
    }
  }

  async _getStepContext() {
    switch (this.stepId) {
      case 'ancestry': return { items: (await this._loadCompendium('pf2e.ancestries')).filter((i) => i.uuid !== this.data.ancestry?.uuid) };
      case 'heritage': return { items: (await this._loadHeritages()).filter((i) => i.uuid !== this.data.heritage?.uuid) };
      case 'background': return { items: (await this._loadCompendium('pf2e.backgrounds')).filter((i) => i.uuid !== this.data.background?.uuid) };
      case 'class': return { items: (await this._loadCompendium('pf2e.classes')).filter((i) => i.uuid !== this.data.class?.uuid) };
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
      case 'sanctification': {
        const handlerCtx = await this.classHandler.getStepContext(this.stepId, this.data, this);
        if (handlerCtx) return handlerCtx;
        return {};
      }
      case 'boosts': return await this._buildBoostContext();
      case 'languages': return await this._buildLanguageContext();
      case 'skills': {
        const maxSkills = await this._getAdditionalSkillCount();
        this._cachedMaxSkills = maxSkills;
        const selectedCount = this.data.skills.length;
        const bgLores = await this._getBackgroundLores();
        const subclassLores = (this.data.subclass?.grantedLores ?? []).map((name) => ({ name, source: this.data.subclass.name }));
        const apparitionLores = (this.data.apparitions ?? []).flatMap((entry) =>
          (entry.lores ?? []).map((name) => ({ name, source: entry.name })),
        );
        const allLores = [...bgLores, ...subclassLores, ...apparitionLores];
        setLores(this.data, allLores.map((l) => l.name));
        return { skills: await this._buildSkillContext(), maxSkills, selectedCount, skillsNote: this._getSkillsNote(), lores: allLores };
      }
      case 'feats': return await this._buildFeatContext();
      case 'spells': return await this._buildSpellContext();
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
    const all = await this._loadCompendium('pf2e.feats-srd');
    const firstElement = data.subclass?.slug?.replace(/-gate$/, '');
    const secondElement = data.secondElement?.slug?.replace(/-gate$/, '');
    const selected = new Set((data.kineticImpulses ?? []).map((entry) => entry.uuid));
    const selectedElements = new Set((data.kineticImpulses ?? []).map((entry) => entry.element).filter(Boolean));
    const lockedElement = data.kineticGateMode === 'dual-gate' && selectedElements.size === 1
      ? [...selectedElements][0]
      : null;

    return all
      .filter((item) => item.type === 'feat')
      .filter((item) => item.level === 1)
      .filter((item) => item.traits.includes('impulse'))
      .filter((item) => !item.traits.includes('composite'))
      .filter((item) => {
        if (data.kineticGateMode === 'dual-gate') {
          return item.traits.includes(firstElement) || item.traits.includes(secondElement);
        }
        return item.traits.includes(firstElement);
      })
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

    const pack = game.packs.get('pf2e.classfeatures');
    if (!pack) return [];

    const docs = await pack.getDocuments();
    const items = docs
      .filter((d) => (d.system?.traits?.otherTags ?? []).includes('animist-apparition'))
      .map((d) => {
        const description = d.system?.description?.value ?? '';
        return {
          uuid: d.uuid,
          name: d.name,
          img: d.img,
          slug: d.slug ?? null,
          rarity: d.system?.traits?.rarity ?? 'common',
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
      const text = html.replace(/<[^>]+>/g, ' ');
      const lowerText = text.toLowerCase();
      for (const skill of SKILLS) {
        const localized = this._localizeSkillSlug(skill).toLowerCase();
        if (lowerText.includes(localized) || lowerText.includes(skill)) skills.push(skill);
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
        buildRow('class', this.data.class.name, 'Class', [], [], 1, keyAbility, this.data.boosts.class ?? []);
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
    return { boostRows, summary, alternateAncestryBoosts: this.data.alternateAncestryBoosts, hasAncestry: !!this.data.ancestry };
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
    for (const feat of [this.data.ancestryFeat, this.data.classFeat]) {
      if (!feat?.uuid) continue;
      const item = await this._getCachedDocument(feat.uuid);
      if (!item) continue;
      feat.choiceSets = await this._parseChoiceSets(item.system?.rules ?? []);
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

  async _parseChoiceSets(rules) {
    return parseChoiceSets(this, rules);
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
    const intMod = this._computeIntMod();
    return Math.max(0, baseCount + intMod);
  }

  async _getBackgroundLores() {
    return getBackgroundLores(this);
  }

  _parseSubclassLores(rules, html) {
    return parseSubclassLores(rules, html);
  }

  async _buildSkillContext() {
    return buildSkillContext(this);
  }

  async _getBackgroundTrainedSkills() {
    return getBackgroundTrainedSkills(this);
  }

  async _buildFeatContext() {
    if (!this.data.ancestry) return { ancestryFeats: [], classFeats: [] };

    const allFeats = await this._loadCompendium('pf2e.feats-srd');
    const ancestrySlug = this.data.ancestry.slug ?? null;
    const heritageSlug = this.data.heritage?.slug ?? null;
    const ancestryTraits = [ancestrySlug];
    if (heritageSlug && heritageSlug !== ancestrySlug) ancestryTraits.push(heritageSlug);

    const selectedAncestryUuid = this.data.ancestryFeat?.uuid;
    const selectedClassUuid = this.data.classFeat?.uuid;

    const ancestryFeats = allFeats
      .filter((f) => ancestryTraits.some((t) => f.traits.includes(t)) && !f.traits.includes('classfeature') && f.level <= 1)
      .map((f) => ({ ...f, taken: f.uuid === selectedAncestryUuid }));

    let classFeats = [];
    const hasClassFeat = await this._hasClassFeatAtLevel1();
    if (hasClassFeat && this.data.class) {
      const classSlug = this.data.class.slug;
      classFeats = allFeats
        .filter((f) => f.traits.includes(classSlug) && !f.traits.includes('classfeature') && f.level <= 1)
        .map((f) => ({ ...f, taken: f.uuid === selectedClassUuid }));
    }

    return { ancestryFeats, classFeats, hasClassFeat };
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
