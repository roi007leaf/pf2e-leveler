import { MODULE_ID } from '../constants.js';
import { loadFeats } from '../feats/feat-cache.js';
import {
  getFeatsForSelection,
  collectAdditionalArchetypeFeatLevels,
  collectAdditionalArchetypeFeatTraits,
  getAdditionalArchetypeMatchKeys,
  filterByDedication,
  filterBySearch,
  filterBySkill,
  sortFeats,
} from '../feats/feat-filter.js';
import { checkPrerequisites } from '../prerequisites/prerequisite-checker.js';
import { isMythicEnabled } from '../utils/pf2e-api.js';
import {
  applyRarityFilter,
  applySourceFilter,
  applyTraitFilter,
  buildChipOptions,
  initializeSelectionSet,
  toggleSelectableChip,
} from './shared/picker-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FeatPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, category, targetLevel, buildState, onSelect, options = {}) {
    super();
    this.actor = actor;
    this.category = category;
    this.targetLevel = targetLevel;
    this.buildState = buildState;
    this.onSelect = onSelect;
    this.multiSelect = options.multiSelect === true;
    this.allFeats = [];
    this.filteredFeats = [];
    this.selectedFeatUuids = new Set();
    this.searchText = '';
    this.sortMethod = game.settings.get(MODULE_ID, 'featSortMethod');
    this.hideFailedPrereqs = false;
    this.selectedRarities = new Set(['common']);
    if (category === 'custom') {
      this.selectedRarities = new Set(['common', 'uncommon', 'rare', 'unique']);
    } else {
      if (!game.settings.get(MODULE_ID, 'hideUncommonFeats')) this.selectedRarities.add('uncommon');
      if (!game.settings.get(MODULE_ID, 'hideRareFeats')) this.selectedRarities.add('rare');
      this.selectedRarities.add('unique');
    }
    this.selectedSkills = new Set();
    this.skillLogic = 'or';
    this.showDedications = category !== 'class';
    this.showSkillFeats = false;
    this.minLevel = '';
    this.maxLevel = Number.isFinite(Number(targetLevel)) && Number(targetLevel) > 0 ? String(targetLevel) : '';
    this.selectedFeatTypes = new Set();
    this.selectedSourcePackages = new Set();
    this._sourceFilterInitialized = false;
    this.additionalArchetypeFeatLevels = new Map();
    this.additionalArchetypeFeatTraits = new Map();
    this.enforcePrerequisites = game.settings.get(MODULE_ID, 'enforcePrerequisites');
    this.selectedTraits = new Set();
    this.traitLogic = 'or';
    this.lockedTraitValues = new Set();
    this.lockedFeatTypes = new Set();
    this._prereqCache = new Map();
    this._buildStateSignature = this._createBuildStateSignature();
    this._updateListTimer = null;
    this._domListeners = null;
    this.preset = options.preset ?? null;
    this.customTitle = options.title ?? null;
    this.allowedFeatUuids = new Set();
    this._minLevelLocked = false;
    this._maxLevelLocked = false;
    this._applyPreset(this.preset);
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-feat-picker',
    classes: ['pf2e-leveler'],
    position: { width: 900, height: 650 },
    window: { resizable: true },
  };

  static PARTS = {
    picker: {
      template: `modules/${MODULE_ID}/templates/feat-picker.hbs`,
    },
  };

  get title() {
    if (typeof this.customTitle === 'string' && this.customTitle.trim().length > 0) {
      return this.customTitle.trim();
    }
    const typeNames = {
      class: 'Class Feats',
      skill: 'Skill Feats',
      general: 'General Feats',
      ancestry: 'Ancestry Feats',
      archetype: 'Archetype Feats',
      mythic: 'Mythic Feats',
      custom: 'All Feats',
    };
    return `${this.actor.name} - ${typeNames[this.category] ?? 'Feats'} | Level ${this.targetLevel}`;
  }

  async _prepareContext() {
    if (this.allFeats.length === 0) {
      const allCachedFeats = await loadFeats();
      this.additionalArchetypeFeatLevels = ['archetype', 'class', 'general', 'skill', 'custom'].includes(this.category)
        ? await collectAdditionalArchetypeFeatLevels(allCachedFeats, this.buildState?.feats ?? new Set())
        : new Map();
      this.additionalArchetypeFeatTraits = ['archetype', 'class', 'general', 'skill', 'custom'].includes(this.category)
        ? await collectAdditionalArchetypeFeatTraits(allCachedFeats, this.buildState?.feats ?? new Set())
        : new Map();
      this.allFeats = getFeatsForSelection(allCachedFeats, this.category, this.actor, this.targetLevel, {
        sortMethod: this.sortMethod,
        includeDedications: this.category === 'class',
        includeSkillFeats: this.category === 'general',
        buildState: this.buildState,
        additionalArchetypeFeatLevels: this.additionalArchetypeFeatLevels,
      });
      // Computed once — allFeats is fixed for the lifetime of this picker instance
      this._showSkillFilter = this._featsHaveSkillRelevance();
    }

    const sourceOptions = this._getSourceOptions();
    const featTypeOptions = this._getFeatTypeOptions();
    const traitOptions = this._getTraitOptions();
    const skillChips = this._getSkillChipOptions();
    this.filteredFeats = this._applyFilters();

    return {
      feats: this.filteredFeats.map((feat) => this._toTemplateFeat(feat)),
      filteredCount: this.filteredFeats.length,
      sourceOptions,
      featTypeOptions,
      levelOptions: this._getLevelOptions(),
      category: this.category,
      targetLevel: this.targetLevel,
      minLevelLocked: this._minLevelLocked,
      maxLevelLocked: this._maxLevelLocked,
      hideFailedPrereqs: this.hideFailedPrereqs,
      rarityOptions: buildChipOptions(['common', 'uncommon', 'rare', 'unique'], this.selectedRarities, {
        labels: this._getRarityLabels(),
      }),
      sortMethod: this.sortMethod,
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      showSkillFilter: this._showSkillFilter ?? false,
      showGeneralSkillToggle: false,
      showFeatTypeFilter: featTypeOptions.length > 0,
      skillChips,
      selectedSkillChips: skillChips.filter((o) => o.selected),
      skillLogic: this.skillLogic,
      showSkillFeats: this.showSkillFeats,
      enforcePrerequisites: this.enforcePrerequisites,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedFeatUuids.size,
      selectedTraits: [...this.selectedTraits],
      selectedTraitChips: traitOptions.filter((option) => option.selected),
      traitLogic: this.traitLogic,
      traitOptions,
      allVisibleSelected: this.filteredFeats.length > 0
        && this.filteredFeats.every((feat) => this.selectedFeatUuids.has(this._getFeatUuid(feat))),
    };
  }

  _onRender(_context, _options) {
    const el = this._getRootElement();
    if (!el) return;

    if (this._domListeners?.abort) this._domListeners.abort();
    this._domListeners = new AbortController();
    const { signal } = this._domListeners;

    this._activateListeners(el, signal);
    this._updateSelectionUI();
    this._updateFilterControlState();
  }

  _applyFilters() {
    let feats = [...this.allFeats];
    feats = applySourceFilter(feats, this.selectedSourcePackages, (feat) => feat.sourcePackage ?? feat.sourcePack, this._sourceKeys);
    feats = applyRarityFilter(feats, this.selectedRarities, (feat) => feat.system?.traits?.rarity ?? 'common');
    if (this.minLevel !== '') {
      const minLevel = Number(this.minLevel);
      feats = feats.filter((feat) => Number(feat.system?.level?.value ?? 0) >= minLevel);
    }
    if (this.maxLevel !== '') {
      const maxLevel = Number(this.maxLevel);
      feats = feats.filter((feat) => Number(feat.system?.level?.value ?? 0) <= maxLevel);
    }
    if (this.allowedFeatUuids.size > 0) {
      feats = feats.filter((feat) => this.allowedFeatUuids.has(this._getFeatUuid(feat)));
    }
    if (this.searchText) feats = filterBySearch(feats, this.searchText);
    if (this._showSkillFilter && this.selectedSkills.size > 0) feats = filterBySkill(feats, [...this.selectedSkills], this.skillLogic);
    if (['class', 'archetype'].includes(this.category)) feats = filterByDedication(feats, this.showDedications);
    if (this.selectedFeatTypes.size > 0) {
      const hideSkillFromGeneral = this.selectedFeatTypes.has('general') && !this.selectedFeatTypes.has('skill');
      feats = feats.filter((feat) => {
        const types = this._getFeatTypes(feat);
        if (hideSkillFromGeneral && types.includes('skill')) return false;
        return types.some((type) => this.selectedFeatTypes.has(type));
      });
    }
    this._preTraitFeats = feats;
    feats = applyTraitFilter(feats, this.selectedTraits, (feat) => this._getTraitFilterValues(feat), this.traitLogic);

    this._enrichWithPrerequisites(feats);
    if (this.hideFailedPrereqs) feats = feats.filter((f) => !f.prerequisitesFailed);
    return sortFeats(feats, this.sortMethod);
  }

  _createBuildStateSignature() {
    const feats = [...(this.buildState?.feats ?? new Set())].sort();
    const classSlug = this.buildState?.class?.slug ?? this.actor?.class?.slug ?? '';
    const level = this.buildState?.level ?? this.targetLevel ?? '';
    const divineFont = this.buildState?.divineFont ?? '';
    return `${classSlug}|${level}|${divineFont}|${feats.join(',')}`;
  }

  _enrichWithPrerequisites(feats) {
    const showPrereqs = game.settings.get(MODULE_ID, 'showPrerequisites');
    const enforcePrereqs = this.enforcePrerequisites;
    const ownedSlugs = this.buildState?.feats ?? new Set();
    const takenLevelMap = this._buildTakenLevelMap();

    for (const feat of feats) {
      const cacheKey = `${this._buildStateSignature}:${this._getFeatUuid(feat) ?? feat.slug ?? feat.name}`;
      let check = this._prereqCache.get(cacheKey);
      if (!check) {
        check = checkPrerequisites(feat, this.buildState);
        this._prereqCache.set(cacheKey, check);
      }

      feat.prereqResults = showPrereqs ? check.results : [];
      feat.hasFailedPrerequisites = check.results.some((result) => result.met === false);
      feat.hasUnknownPrerequisites = check.results.some((result) => result.met == null);
      feat.prerequisitesFailed = feat.hasFailedPrerequisites;
      feat.selectionBlocked = enforcePrereqs && feat.hasFailedPrerequisites;

      const traits = (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
      const featSlug = feat.slug ?? null;
      const existingDedications = this.buildState?.archetypeDedications ?? new Set();
      if (this.category !== 'custom'
        && traits.includes('dedication')
        && this.buildState?.canTakeNewArchetypeDedication === false
        && (!featSlug || !existingDedications.has(featSlug))) {
        const dedicationLockResult = {
          text: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.ARCHETYPE_DEDICATION_LOCK'),
          met: false,
        };
        feat.prereqResults = showPrereqs ? [...feat.prereqResults, dedicationLockResult] : feat.prereqResults;
        feat.hasFailedPrerequisites = true;
        feat.prerequisitesFailed = true;
        feat.selectionBlocked = enforcePrereqs;
      }

      const slug = feat.slug ?? null;
      const featKeys = this._getAdditionalArchetypeFeatKeys(feat);
      const isArchetypeAdditionalFeat = ['archetype', 'class', 'general', 'skill', 'custom'].includes(this.category)
        && featKeys.some((key) => this.additionalArchetypeFeatLevels.has(key));
      feat.alreadyTaken = !!slug && ownedSlugs.has(slug) && feat.system.maxTakable === 1;
      feat.takenAtLevel = feat.alreadyTaken && slug ? (takenLevelMap.get(slug) ?? null) : null;
    }
  }

  _buildTakenLevelMap() {
    if (this._takenLevelMap) return this._takenLevelMap;
    const map = new Map();
    const actorFeats = this.actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
    for (const feat of actorFeats) {
      if (feat.slug) {
        const level = feat.system?.level?.taken ?? feat.system?.level?.value ?? null;
        map.set(feat.slug, level);
      }
    }
    this._takenLevelMap = map;
    return map;
  }

  _activateListeners(el, signal) {
    const searchInput = el.querySelector('[data-action="searchFeats"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchText = e.target.value;
        this._scheduleListUpdate(120);
      }, { signal });
    }

    const prereqToggle = el.querySelector('[data-action="togglePrereqFilter"]');
    if (prereqToggle) {
      prereqToggle.addEventListener('click', () => {
        this.hideFailedPrereqs = !this.hideFailedPrereqs;
        prereqToggle.classList.toggle('active', this.hideFailedPrereqs);
        this._scheduleListUpdate();
      }, { signal });
    }

    const sortSelect = el.querySelector('[data-action="sortFeats"]');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortMethod = e.target.value;
        this._scheduleListUpdate();
      }, { signal });
    }

    const minLevelSelect = el.querySelector('[data-action="filterMinLevel"]');
    if (minLevelSelect) {
      minLevelSelect.addEventListener('change', (e) => {
        this.minLevel = e.target.value;
        if (this.minLevel !== '' && this.maxLevel !== '' && Number(this.minLevel) > Number(this.maxLevel)) {
          this.maxLevel = this.minLevel;
          const maxSelect = el.querySelector('[data-action="filterMaxLevel"]');
          if (maxSelect) maxSelect.value = this.maxLevel;
        }
        this._scheduleListUpdate();
      }, { signal });
    }

    const maxLevelSelect = el.querySelector('[data-action="filterMaxLevel"]');
    if (maxLevelSelect) {
      maxLevelSelect.addEventListener('change', (e) => {
        this.maxLevel = e.target.value;
        if (this.minLevel !== '' && this.maxLevel !== '' && Number(this.maxLevel) < Number(this.minLevel)) {
          this.minLevel = this.maxLevel;
          const minSelect = el.querySelector('[data-action="filterMinLevel"]');
          if (minSelect) minSelect.value = this.minLevel;
        }
        this._scheduleListUpdate();
      }, { signal });
    }

    const traitInput = el.querySelector('[data-action="traitInput"]');
    if (traitInput) {
      traitInput.addEventListener('keydown', (e) => {
        const dropdown = el.querySelector('[data-role="trait-autocomplete"]');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          this._navigateAutocomplete(dropdown, e.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const highlighted = dropdown?.querySelector('.highlighted');
          if (highlighted) {
            traitInput.value = highlighted.dataset.trait;
          }
          this._commitTraitInput(traitInput);
          this._closeAutocomplete(el);
          return;
        }
        if (e.key === 'Escape') {
          this._closeAutocomplete(el);
          return;
        }
      }, { signal });

      traitInput.addEventListener('input', () => {
        this._updateAutocomplete(el, traitInput.value);
      }, { signal });

      traitInput.addEventListener('blur', () => {
        setTimeout(() => this._closeAutocomplete(el), 150);
      }, { signal });

      traitInput.addEventListener('focus', () => {
        if (traitInput.value) this._updateAutocomplete(el, traitInput.value);
      }, { signal });
    }

    el.querySelector('[data-action="toggleTraitLogic"]')?.addEventListener('click', () => {
      this.traitLogic = this.traitLogic === 'and' ? 'or' : 'and';
      this._scheduleListUpdate();
    }, { signal });

    el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sourceKey = btn.dataset.package;
        if (!sourceKey) return;
        this.selectedSourcePackages = toggleSelectableChip(
          this.selectedSourcePackages,
          sourceKey,
          this._sourceKeys,
        );
        for (const chip of el.querySelectorAll('[data-action="toggleCompendiumSource"]')) {
          chip.classList.toggle('selected', this.selectedSourcePackages.has(chip.dataset.package));
        }
        this._scheduleListUpdate();
      }, { signal });
    });

    el.querySelector('[data-action="searchCompendiumSources"]')?.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
        const name = (btn.dataset.sourceName ?? btn.textContent ?? '').toLowerCase();
        btn.style.display = !query || name.includes(query) ? '' : 'none';
      });
    }, { signal });

    const skillInput = el.querySelector('[data-action="skillInput"]');
    if (skillInput) {
      skillInput.addEventListener('keydown', (e) => {
        const dropdown = el.querySelector('[data-role="skill-autocomplete"]');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          this._navigateAutocomplete(dropdown, e.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const highlighted = dropdown?.querySelector('.highlighted');
          if (highlighted) skillInput.value = highlighted.dataset.skill;
          this._commitSkillInput(skillInput);
          this._closeDropdown(el, 'skill-autocomplete');
          return;
        }
        if (e.key === 'Escape') { this._closeDropdown(el, 'skill-autocomplete'); return; }
      }, { signal });
      skillInput.addEventListener('input', () => this._updateSkillAutocomplete(el, skillInput.value), { signal });
      skillInput.addEventListener('blur', () => setTimeout(() => this._closeDropdown(el, 'skill-autocomplete'), 150), { signal });
      skillInput.addEventListener('focus', () => { if (skillInput.value) this._updateSkillAutocomplete(el, skillInput.value); }, { signal });
    }

    el.querySelector('[data-action="toggleSkillLogic"]')?.addEventListener('click', () => {
      this.skillLogic = this.skillLogic === 'and' ? 'or' : 'and';
      this._scheduleListUpdate();
    }, { signal });

    this._bindSkillChipListeners(el, signal);

    const skillFeatToggle = el.querySelector('[data-action="toggleGeneralSkillFeats"]');
    if (skillFeatToggle) {
      skillFeatToggle.addEventListener('click', () => {
        this.showSkillFeats = !this.showSkillFeats;
        skillFeatToggle.classList.toggle('active', this.showSkillFeats);
        this._scheduleListUpdate();
      }, { signal });
    }

    el.querySelectorAll('[data-action="toggleFeatType"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (!type) return;
        this.selectedFeatTypes = toggleSelectableChip(
          this.selectedFeatTypes,
          type,
          this._featTypeKeys,
          [...this.lockedFeatTypes],
        );
        for (const chip of el.querySelectorAll('[data-action="toggleFeatType"]')) {
          chip.classList.toggle('selected', this.selectedFeatTypes.has(chip.dataset.type));
        }
        this._scheduleListUpdate();
      }, { signal });
    });

    this._bindTraitChipListeners(el, signal);

    el.querySelectorAll('[data-action="toggleRarityChip"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rarity = String(btn.dataset.rarity ?? '').trim().toLowerCase();
        if (!rarity) return;
        this.selectedRarities = toggleSelectableChip(this.selectedRarities, rarity, ['common', 'uncommon', 'rare', 'unique']);
        this._scheduleListUpdate();
      }, { signal });
    });

    this._bindActionButtons(el, signal);
  }

  _getRootElement() {
    const root = this.element;
    if (!root) return null;
    if (root.matches?.('.pf2e-leveler.feat-picker')) return root;
    return root.querySelector?.('.pf2e-leveler.feat-picker') ?? root;
  }

  _scheduleListUpdate(delay = 0) {
    if (this._updateListTimer) clearTimeout(this._updateListTimer);
    this._updateListTimer = setTimeout(() => {
      this._updateListTimer = null;
      this._updateFeatList();
    }, delay);
  }

  async _updateFeatList() {
    this.filteredFeats = this._applyFilters();

    const root = this._getRootElement();
    const listContainer = root?.querySelector('.feat-list');
    if (!listContainer) return;

    const html = await renderTemplate(`modules/${MODULE_ID}/templates/feat-picker.hbs`, {
      feats: this.filteredFeats.map((feat) => this._toTemplateFeat(feat)),
      filteredCount: this.filteredFeats.length,
      category: this.category,
      targetLevel: this.targetLevel,
      sortMethod: this.sortMethod,
      selectedTraitChips: this._getTraitOptions().filter((option) => option.selected),
      selectedTraits: [...this.selectedTraits],
      traitLogic: this.traitLogic,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedFeatUuids.size,
      allVisibleSelected: this.filteredFeats.length > 0
        && this.filteredFeats.every((feat) => this.selectedFeatUuids.has(this._getFeatUuid(feat))),
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.feat-list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }

    if (this._domListeners?.signal) {
      this._bindActionButtons(root, this._domListeners.signal);
    }

    const resultCount = root?.querySelector('.picker__results-count');
    if (resultCount) resultCount.textContent = String(this.filteredFeats.length);
    this._updateFilterControlState();
    this._updateSelectionUI();
  }

  _bindActionButtons(root, signal) {
    if (!root) return;

    root.querySelectorAll('[data-action="viewFeat"], [data-action="selectFeat"], [data-action="toggleSelectAll"], [data-action="confirmSelection"], [data-action="sendToChat"]').forEach((button) => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this._handleActionClick(button);
      }, { signal });
    });
  }

  async _handleActionClick(target) {
    const action = target.dataset.action;
    const featOption = target.closest('.feat-option');
    const uuid = featOption?.dataset?.uuid || target.dataset.uuid;

    if (action === 'viewFeat') {
      if (!uuid) return;
      const item = await fromUuid(uuid);
      if (item?.sheet) item.sheet.render(true);
      return;
    }

    if (action === 'selectFeat') {
      const feat = this.filteredFeats.find((f) => this._getFeatUuid(f) === uuid);
      if (!feat || !this.onSelect) return;
      if (this.multiSelect) {
        this._toggleSelectedFeat(this._getFeatUuid(feat));
        this._updateSelectionUI();
      } else {
        await this.onSelect(feat);
        this.close();
      }
      return;
    }

    if (action === 'toggleSelectAll') {
      this._toggleSelectAllVisible();
      this._updateSelectionUI();
      return;
    }

    if (action === 'confirmSelection') {
      await this._confirmSelection();
      return;
    }

    if (action === 'sendToChat') {
      const feat = await fromUuid(uuid);
      if (feat) {
        ChatMessage.create({
          content: `@UUID[${uuid}]{${feat.name}}`,
          speaker: { alias: this.actor.name },
        });
      }
    }
  }

  _getVisibleFeatOptions() {
    const root = this._getRootElement();
    return [...(root?.querySelectorAll('.feat-option') ?? [])].filter((item) => item.style.display !== 'none');
  }

  _getVisibleFeatUuids() {
    return this._getVisibleFeatOptions()
      .map((item) => item.dataset.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
  }

  _toggleSelectedFeat(uuid) {
    if (!uuid) return;
    if (this.selectedFeatUuids.has(uuid)) this.selectedFeatUuids.delete(uuid);
    else this.selectedFeatUuids.add(uuid);
  }

  _toggleSelectAllVisible() {
    const visibleUuids = this._getVisibleFeatUuids();
    if (visibleUuids.length === 0) return;
    const allVisibleSelected = visibleUuids.every((uuid) => this.selectedFeatUuids.has(uuid));
    for (const uuid of visibleUuids) {
      if (allVisibleSelected) this.selectedFeatUuids.delete(uuid);
      else this.selectedFeatUuids.add(uuid);
    }
  }

  async _confirmSelection() {
    if (!this.multiSelect || this.selectedFeatUuids.size === 0 || !this.onSelect) return;
    const selectedFeats = this.allFeats
      .filter((feat) => this.selectedFeatUuids.has(this._getFeatUuid(feat)))
      .sort((a, b) => a.name.localeCompare(b.name));
    await this.onSelect(selectedFeats);
    this.close();
  }

  _updateSelectionUI() {
    const root = this._getRootElement();
    if (!this.multiSelect || !root) return;

    for (const option of root.querySelectorAll('.feat-option')) {
      const uuid = option.dataset.uuid;
      const selected = this.selectedFeatUuids.has(uuid);
      option.classList.toggle('spell-option--selected', selected);
      const button = option.querySelector('[data-action="selectFeat"]');
      if (button) {
        button.classList.toggle('active', selected);
        button.textContent = selected
          ? game.i18n.localize('PF2E_LEVELER.UI.SELECTED')
          : game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.SELECT');
      }
    }

    const count = this.selectedFeatUuids.size;
    const visibleCount = this._getVisibleFeatUuids().length;
    const allVisibleSelected = visibleCount > 0 && this._getVisibleFeatUuids().every((uuid) => this.selectedFeatUuids.has(uuid));
    const countEl = root.querySelector('.picker__selected-count');
    if (countEl) {
      countEl.textContent = game.i18n.format('PF2E_LEVELER.FEAT_PICKER.SELECTED_COUNT', { count });
    }

    const selectAllButton = root.querySelector('[data-action="toggleSelectAll"]');
    if (selectAllButton) {
      selectAllButton.disabled = visibleCount === 0;
      selectAllButton.textContent = game.i18n.localize(
        allVisibleSelected ? 'PF2E_LEVELER.FEAT_PICKER.DESELECT_ALL' : 'PF2E_LEVELER.FEAT_PICKER.SELECT_ALL',
      );
    }

    const confirmButton = root.querySelector('[data-action="confirmSelection"]');
    if (confirmButton) confirmButton.disabled = count === 0;
  }

  _featsHaveSkillRelevance() {
    const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
    const skillSlugs = new Set(Object.keys(configSkills).map((s) => s.toLowerCase()));
    return this.allFeats.some((feat) => {
      const traits = (feat.system?.traits?.value ?? []).map((t) => String(t).toLowerCase());
      if (traits.some((t) => skillSlugs.has(t))) return true;
      const prereqText = (feat.system?.prerequisites?.value ?? [])
        .map((p) => String(p.value ?? '').toLowerCase()).join(' ');
      return prereqText && [...skillSlugs].some((slug) => prereqText.includes(slug));
    });
  }

  _buildSkillOptionsBase() {
    if (this._skillOptionsBase) return this._skillOptionsBase;
    const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
    const options = Object.entries(configSkills).map(([slug, rawEntry]) => {
      const rawLabel = typeof rawEntry === 'string'
        ? rawEntry
        : rawEntry?.label ?? rawEntry?.short ?? rawEntry?.long ?? slug;
      const label = typeof rawLabel === 'string' && game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : String(rawLabel);
      return { slug, label };
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    this._skillOptionsBase = options;
    return options;
  }

  _getSkillChipOptions() {
    const base = this._buildSkillOptionsBase();
    const labels = Object.fromEntries(base.map((o) => [o.slug, o.label]));
    return buildChipOptions(base.map((o) => o.slug), this.selectedSkills, { labels });
  }

  _commitSkillInput(input) {
    const query = String(input?.value ?? '').trim().toLowerCase();
    if (!query) return;
    const match = this._buildSkillOptionsBase().find((o) => o.label.toLowerCase() === query || o.slug === query);
    if (match) this.selectedSkills.add(match.slug);
    if (input) input.value = '';
    this._scheduleListUpdate();
  }

  _updateSkillAutocomplete(el, query) {
    const dropdown = el.querySelector('[data-role="skill-autocomplete"]');
    if (!dropdown) return;
    const q = query.trim().toLowerCase();
    if (!q) { this._closeDropdown(el, 'skill-autocomplete'); return; }
    const skills = this._buildSkillOptionsBase()
      .filter((o) => !this.selectedSkills.has(o.slug) && (o.label.toLowerCase().includes(q) || o.slug.includes(q)));
    if (skills.length === 0) { this._closeDropdown(el, 'skill-autocomplete'); return; }
    dropdown.innerHTML = skills.map((o) => {
      const lbl = o.label.toLowerCase();
      const idx = lbl.indexOf(q);
      const highlighted = idx >= 0
        ? `${o.label.slice(0, idx)}<mark>${o.label.slice(idx, idx + q.length)}</mark>${o.label.slice(idx + q.length)}`
        : o.label;
      return `<li data-skill="${o.slug}">${highlighted}</li>`;
    }).join('');
    dropdown.classList.add('open');
    for (const li of dropdown.querySelectorAll('li')) {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const input = el.querySelector('[data-action="skillInput"]');
        if (input) input.value = li.dataset.skill;
        this._commitSkillInput(input);
        this._closeDropdown(el, 'skill-autocomplete');
      }, { signal: this._domListeners?.signal });
    }
  }

  _bindSkillChipListeners(root, signal) {
    root.querySelectorAll('[data-action="toggleSkillChip"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skill = btn.dataset.skill;
        if (!skill) return;
        if (this.selectedSkills.has(skill)) this.selectedSkills.delete(skill);
        else this.selectedSkills.add(skill);
        this._scheduleListUpdate();
      }, { signal });
    });
  }

  _getSourceOptions() {
    const unique = new Map();
    for (const feat of this.allFeats) {
      const key = feat.sourcePackage ?? feat.sourcePack ?? null;
      if (!key) continue;
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          label: feat.sourcePackageLabel ?? key,
        });
      }
    }

    const options = [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
    this._sourceKeys = options.map((entry) => entry.key);
    this.selectedSourcePackages = initializeSelectionSet(this.selectedSourcePackages, this._sourceKeys, { defaultValues: [] });
    this._sourceFilterInitialized = true;

    return options.map((entry) => ({
      ...entry,
      selected: this.selectedSourcePackages.has(entry.key),
    }));
  }

  _getFeatTypeOptions() {
    const labels = {
      class: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_CLASS'),
      ancestry: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_ANCESTRY'),
      bonus: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_BONUS'),
      general: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_GENERAL'),
      skill: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_SKILL'),
      archetype: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_ARCHETYPE'),
      mythic: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_MYTHIC'),
      other: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_OTHER'),
    };

    const seen = new Set();
    for (const feat of this.allFeats) {
      for (const type of this._getFeatTypes(feat)) seen.add(type);
    }

    const hiddenTypes = new Set(['bonus', 'other']);
    if (!isMythicEnabled()) hiddenTypes.add('mythic');

    const allOptions = [...seen]
      .filter((type) => !hiddenTypes.has(type) || this.lockedFeatTypes.has(type))
      .map((type) => ({ value: type, label: labels[type] ?? type }))
      .sort((a, b) => a.label.localeCompare(b.label));

    this._featTypeKeys = allOptions.map((entry) => entry.value);
    this.selectedFeatTypes = initializeSelectionSet(this.selectedFeatTypes, this._featTypeKeys, {
      lockedValues: [...this.lockedFeatTypes],
      defaultValues: [],
    });

    const visibleTypeSet = this.lockedFeatTypes.size > 0
      ? new Set([...this.lockedFeatTypes, ...(this._extraVisibleFeatTypes ?? [])])
      : null;
    const visibleOptions = visibleTypeSet
      ? allOptions.filter((entry) => visibleTypeSet.has(entry.value))
      : allOptions;

    return buildChipOptions(
      visibleOptions.map((entry) => entry.value),
      this.selectedFeatTypes,
      {
        lockedValues: [...this.lockedFeatTypes],
        labels: Object.fromEntries(visibleOptions.map((entry) => [entry.value, entry.label])),
      },
    );
  }

  _getLevelOptions() {
    const maxLevel = Number.isFinite(Number(this.targetLevel)) && Number(this.targetLevel) > 0
      ? Number(this.targetLevel)
      : 20;
    return Array.from({ length: maxLevel }, (_unused, index) => {
      const level = index + 1;
      return { value: String(level), label: String(level) };
    });
  }

  _getFeatTypes(feat) {
    const traits = (feat.system?.traits?.value ?? []).map((trait) => String(trait).toLowerCase());
    const ancestryTraits = this.buildState?.ancestryTraits instanceof Set
      ? [...this.buildState.ancestryTraits].map((trait) => String(trait).toLowerCase())
      : [];
    const classSlug = String(this.buildState?.class?.slug ?? this.actor?.class?.slug ?? '').toLowerCase();
    const featKeys = this._getAdditionalArchetypeFeatKeys(feat);
    const isAdditionalArchetypeFeat = featKeys.some((key) => this.additionalArchetypeFeatLevels.has(key));
    const isSkillFeat = traits.includes('skill');
    const types = [];

    if (traits.includes('mythic')) types.push('mythic');
    if (traits.includes('dedication') || ((traits.includes('archetype') || isAdditionalArchetypeFeat) && !isSkillFeat)) types.push('archetype');
    if (traits.includes('general')) types.push('general');
    if (traits.includes('skill')) types.push('skill');
    if (ancestryTraits.some((trait) => traits.includes(trait))) types.push('ancestry');
    if (classSlug && traits.includes(classSlug)) types.push('class');

    if (types.length === 0) types.push(this.category === 'custom' ? 'bonus' : 'other');
    return [...new Set(types)];
  }

  _getFeatUuid(feat) {
    if (!feat) return '';
    return feat.uuid
      || feat.sourceId
      || feat.flags?.core?.sourceId
      || (feat.sourcePack && feat.id ? `Compendium.${feat.sourcePack}.Item.${feat.id}` : '')
      || '';
  }

  _getAdditionalArchetypeFeatKeys(feat) {
    return getAdditionalArchetypeMatchKeys(feat);
  }

  _getTraitFilterValues(feat) {
    const traits = [...(feat.system?.traits?.value ?? [])].map((trait) => String(trait).toLowerCase());
    const isSkillTaggedArchetype = traits.includes('skill') && traits.includes('archetype') && !traits.includes('dedication');
    const filteredTraits = isSkillTaggedArchetype ? traits.filter((trait) => trait !== 'archetype') : traits;
    const featKeys = this._getAdditionalArchetypeFeatKeys(feat);
    const isAdditionalArchetypeFeat = featKeys.some((key) => this.additionalArchetypeFeatLevels.has(key));
    if (isAdditionalArchetypeFeat && !filteredTraits.includes('skill') && !filteredTraits.includes('archetype')) filteredTraits.push('archetype');
    for (const key of featKeys) {
      const extraTraits = this.additionalArchetypeFeatTraits.get(key);
      if (!extraTraits) continue;
      for (const trait of extraTraits) {
        if (!filteredTraits.includes(trait)) filteredTraits.push(trait);
      }
    }
    return filteredTraits;
  }

  _getAdditionalArchetypeUnlockLevel(feat) {
    const featKeys = this._getAdditionalArchetypeFeatKeys(feat);
    for (const key of featKeys) {
      const level = this.additionalArchetypeFeatLevels.get(key);
      if (level != null) return level;
    }
    return null;
  }

  _toTemplateFeat(feat) {
    const additionalArchetypeUnlockLevel = this._getAdditionalArchetypeUnlockLevel(feat);
    return {
      ...feat,
      uuid: this._getFeatUuid(feat),
      additionalArchetypeUnlockLevel,
      isAdditionalArchetypeFeat: additionalArchetypeUnlockLevel != null,
      _levelerSelected: this.selectedFeatUuids.has(this._getFeatUuid(feat)),
    };
  }

  _getTraitOptions() {
    const traits = new Set();
    for (const feat of this.allFeats) {
      for (const trait of (feat.system?.traits?.value ?? [])) traits.add(String(trait).toLowerCase());
    }
    const ordered = [...traits].sort((a, b) => a.localeCompare(b));
    return buildChipOptions(ordered, this.selectedTraits, {
      lockedValues: [...this.lockedTraitValues],
    });
  }

  _getVisibleTraits() {
    const traits = new Set();
    const featsToScan = this._preTraitFeats?.length > 0 ? this._preTraitFeats : this.allFeats;
    for (const feat of featsToScan) {
      for (const trait of (feat.system?.traits?.value ?? [])) traits.add(String(trait).toLowerCase());
    }
    for (const trait of this.selectedTraits) traits.add(trait);
    for (const trait of this.lockedTraitValues) traits.add(trait);
    return [...traits].sort((a, b) => a.localeCompare(b));
  }

  _commitTraitInput(input) {
    const trait = String(input?.value ?? '').trim().toLowerCase();
    if (!trait) return;
    this.selectedTraits.add(trait);
    if (input) input.value = '';
    this._scheduleListUpdate();
  }

  _updateFilterControlState() {
    const root = this._getRootElement();
    if (!root) return;

    const logicButton = root.querySelector('[data-action="toggleTraitLogic"]');
    if (logicButton) logicButton.textContent = this.traitLogic === 'and' ? 'AND' : 'OR';

    const skillFilterGroup = root.querySelector('[data-role="skill-filter-group"]');
    if (skillFilterGroup) skillFilterGroup.style.display = this._showSkillFilter ? '' : 'none';

    const skillLogicButton = root.querySelector('[data-action="toggleSkillLogic"]');
    if (skillLogicButton) skillLogicButton.textContent = this.skillLogic === 'and' ? 'AND' : 'OR';

    const skillChipContainer = root.querySelector('[data-role="selected-skill-chips"]');
    if (skillChipContainer) {
      const selectedSkillChips = this._buildSkillOptionsBase()
        .filter((o) => this.selectedSkills.has(o.slug))
        .map((o) => ({ value: o.slug, label: o.label }));
      skillChipContainer.style.display = selectedSkillChips.length > 0 ? '' : 'none';
      skillChipContainer.innerHTML = selectedSkillChips.map((chip) => `
        <button type="button"
          class="picker__source-chip selected"
          data-action="toggleSkillChip"
          data-skill="${chip.value}">
          <span>${chip.label}</span>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `).join('');
      if (this._domListeners?.signal) this._bindSkillChipListeners(root, this._domListeners.signal);
    }

    const traitChipContainer = root.querySelector('[data-role="selected-trait-chips"]');
    if (traitChipContainer) {
      const selectedTraitChips = this._getTraitOptions().filter((option) => option.selected);
      traitChipContainer.style.display = selectedTraitChips.length > 0 ? '' : 'none';
      traitChipContainer.innerHTML = selectedTraitChips.map((chip) => `
        <button type="button"
          class="picker__source-chip ${chip.selected ? 'selected' : ''} ${chip.locked ? 'locked' : ''}"
          data-action="toggleTraitChip"
          data-trait="${chip.value}"
          ${chip.locked ? `data-tooltip="${game.i18n.localize('PF2E_LEVELER.UI.LOCKED_FILTER_HINT')}"` : ''}>
          <span>${chip.label}</span>
          ${chip.locked ? '' : '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'}
        </button>
      `).join('');
      if (this._domListeners?.signal) this._bindTraitChipListeners(root, this._domListeners.signal);
    }

    for (const chip of root.querySelectorAll('[data-action="toggleTraitChip"]')) {
      const trait = String(chip.dataset.trait ?? '').trim().toLowerCase();
      chip.classList.toggle('selected', this.selectedTraits.has(trait));
      chip.classList.toggle('locked', this.lockedTraitValues.has(trait));
    }

    for (const chip of root.querySelectorAll('[data-action="toggleRarityChip"]')) {
      const rarity = String(chip.dataset.rarity ?? '').trim().toLowerCase();
      chip.classList.toggle('selected', this.selectedRarities.has(rarity));
    }

    for (const chip of root.querySelectorAll('[data-action="toggleFeatType"]')) {
      const type = String(chip.dataset.type ?? '').trim().toLowerCase();
      chip.classList.toggle('selected', this.selectedFeatTypes.has(type));
      chip.classList.toggle('locked', this.lockedFeatTypes.has(type));
    }

    for (const chip of root.querySelectorAll('[data-action="toggleCompendiumSource"]')) {
      const source = String(chip.dataset.package ?? '').trim();
      chip.classList.toggle('selected', this.selectedSourcePackages.has(source));
    }

    this._cachedVisibleTraits = this._getVisibleTraits();
  }

  _updateAutocomplete(el, query) {
    const dropdown = el.querySelector('[data-role="trait-autocomplete"]');
    if (!dropdown) return;
    const q = query.trim().toLowerCase();
    if (!q) { this._closeAutocomplete(el); return; }
    const traits = (this._cachedVisibleTraits ?? [])
      .filter((t) => t.includes(q) && !this.selectedTraits.has(t) && !this.lockedTraitValues.has(t));
    if (traits.length === 0) { this._closeAutocomplete(el); return; }
    dropdown.innerHTML = traits.slice(0, 15).map((t) => {
      const idx = t.indexOf(q);
      const highlighted = idx >= 0
        ? `${t.slice(0, idx)}<mark>${t.slice(idx, idx + q.length)}</mark>${t.slice(idx + q.length)}`
        : t;
      return `<li data-trait="${t}">${highlighted}</li>`;
    }).join('');
    dropdown.classList.add('open');
    for (const li of dropdown.querySelectorAll('li')) {
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const input = el.querySelector('[data-action="traitInput"]');
        if (input) input.value = li.dataset.trait;
        this._commitTraitInput(input);
        this._closeAutocomplete(el);
      }, { signal: this._domListeners?.signal });
    }
  }

  _closeDropdown(el, role) {
    const dropdown = el.querySelector(`[data-role="${role}"]`);
    if (dropdown) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; }
  }

  _closeAutocomplete(el) { this._closeDropdown(el, 'trait-autocomplete'); }

  _navigateAutocomplete(dropdown, direction) {
    if (!dropdown) return;
    const items = [...dropdown.querySelectorAll('li')];
    if (items.length === 0) return;
    const current = items.findIndex((li) => li.classList.contains('highlighted'));
    items.forEach((li) => li.classList.remove('highlighted'));
    const next = current < 0 ? (direction > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, current + direction));
    items[next].classList.add('highlighted');
    items[next].scrollIntoView({ block: 'nearest' });
  }

  _bindTraitChipListeners(root, signal) {
    root.querySelectorAll('[data-action="toggleTraitChip"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trait = String(btn.dataset.trait ?? '').trim().toLowerCase();
        if (!trait || this.lockedTraitValues.has(trait)) return;
        if (this.selectedTraits.has(trait)) this.selectedTraits.delete(trait);
        else this.selectedTraits.add(trait);
        this._scheduleListUpdate();
      }, { signal });
    });
  }

  _getRarityLabels() {
    return {
      common: game.i18n.localize('PF2E.TraitCommon'),
      uncommon: game.i18n.localize('PF2E.TraitUncommon'),
      rare: game.i18n.localize('PF2E.TraitRare'),
      unique: game.i18n.localize('PF2E.TraitUnique'),
    };
  }

  _applyPreset(preset) {
    if (!preset || typeof preset !== 'object') return;
    if (Array.isArray(preset.selectedFeatTypes)) this.selectedFeatTypes = new Set(preset.selectedFeatTypes);
    if (Array.isArray(preset.lockedFeatTypes)) this.lockedFeatTypes = new Set(preset.lockedFeatTypes);
    if (Array.isArray(preset.allowedFeatUuids)) this.allowedFeatUuids = new Set(preset.allowedFeatUuids.filter((uuid) => typeof uuid === 'string' && uuid.length > 0));
    if (Array.isArray(preset.selectedTraits)) this.selectedTraits = new Set(preset.selectedTraits.map((trait) => String(trait).toLowerCase()));
    if (Array.isArray(preset.lockedTraits)) this.lockedTraitValues = new Set(preset.lockedTraits.map((trait) => String(trait).toLowerCase()));
    if (typeof preset.traitLogic === 'string') this.traitLogic = preset.traitLogic.toLowerCase() === 'and' ? 'and' : 'or';
    if (Array.isArray(preset.extraVisibleFeatTypes)) this._extraVisibleFeatTypes = new Set(preset.extraVisibleFeatTypes);
    if (typeof preset.showDedications === 'boolean') this.showDedications = preset.showDedications;
    if (typeof preset.lockDedications === 'boolean') this._dedicationsLocked = preset.lockDedications;
    if (typeof preset.showSkillFeats === 'boolean') this.showSkillFeats = preset.showSkillFeats;
    if (preset.minLevel != null) this.minLevel = String(preset.minLevel);
    if (preset.maxLevel != null) this.maxLevel = String(preset.maxLevel);
    if (preset.lockMinLevel === true) this._minLevelLocked = true;
    if (preset.lockMaxLevel === true) this._maxLevelLocked = true;
  }
}
