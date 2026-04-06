import { MODULE_ID } from '../constants.js';
import { loadFeats } from '../feats/feat-cache.js';
import {
  getFeatsForSelection,
  collectAdditionalArchetypeFeatLevels,
  getAdditionalArchetypeMatchKeys,
  filterByDedication,
  filterByGeneralSkillFeats,
  filterBySearch,
  filterBySkill,
  sortFeats,
} from '../feats/feat-filter.js';
import { checkPrerequisites } from '../prerequisites/prerequisite-checker.js';

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
    this.hideFailedPrereqs = category === 'archetype';
    this.showUncommon = !game.settings.get(MODULE_ID, 'hideUncommonFeats');
    this.showRare = !game.settings.get(MODULE_ID, 'hideRareFeats');
    this.selectedSkill = '';
    this.showDedications = category !== 'class';
    this.showSkillFeats = false;
    this.minLevel = '';
    this.maxLevel = Number.isFinite(Number(targetLevel)) && Number(targetLevel) > 0 ? String(targetLevel) : '';
    this.selectedFeatTypes = new Set();
    this.selectedSourcePackages = new Set();
    this._sourceFilterInitialized = false;
    this.additionalArchetypeFeatLevels = new Map();
    this.enforcePrerequisites = game.settings.get(MODULE_ID, 'enforcePrerequisites');
    this._prereqCache = new Map();
    this._buildStateSignature = this._createBuildStateSignature();
    this._updateListTimer = null;
    this._domListeners = null;
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
      this.additionalArchetypeFeatLevels = ['archetype', 'class', 'general', 'skill'].includes(this.category)
        ? await collectAdditionalArchetypeFeatLevels(allCachedFeats, this.buildState?.feats ?? new Set())
        : new Map();
      this.allFeats = getFeatsForSelection(allCachedFeats, this.category, this.actor, this.targetLevel, {
        sortMethod: this.sortMethod,
        includeDedications: this.category === 'class',
        includeSkillFeats: this.category === 'general',
        buildState: this.buildState,
        additionalArchetypeFeatLevels: this.additionalArchetypeFeatLevels,
      });
    }

    const sourceOptions = this._getSourceOptions();
    const featTypeOptions = this._getFeatTypeOptions();
    this.filteredFeats = this._applyFilters();

    return {
      feats: this.filteredFeats.map((feat) => this._toTemplateFeat(feat)),
      filteredCount: this.filteredFeats.length,
      sourceOptions,
      featTypeOptions,
      levelOptions: this._getLevelOptions(),
      category: this.category,
      targetLevel: this.targetLevel,
      hideFailedPrereqs: this.hideFailedPrereqs,
      showUncommon: this.showUncommon,
      showRare: this.showRare,
      sortMethod: this.sortMethod,
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      showSkillFilter: this.category === 'skill',
      showGeneralSkillToggle: this.category === 'general',
      showFeatTypeFilter: this.category === 'custom',
      skillOptions: this._getSkillOptions(),
      selectedSkill: this.selectedSkill,
      showDedicationToggle: ['class', 'archetype'].includes(this.category),
      showDedications: this.showDedications,
      showSkillFeats: this.showSkillFeats,
      enforcePrerequisites: this.enforcePrerequisites,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedFeatUuids.size,
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
  }

  _applyFilters() {
    let feats = [...this.allFeats];
    if (this.selectedSourcePackages.size > 0) {
      feats = feats.filter((feat) => this.selectedSourcePackages.has(feat.sourcePackage ?? feat.sourcePack));
    }
    if (!this.showUncommon) feats = feats.filter((f) => f.system.traits.rarity !== 'uncommon');
    if (!this.showRare) feats = feats.filter((f) => f.system.traits.rarity !== 'rare');
    if (this.minLevel !== '') {
      const minLevel = Number(this.minLevel);
      feats = feats.filter((feat) => Number(feat.system?.level?.value ?? 0) >= minLevel);
    }
    if (this.maxLevel !== '') {
      const maxLevel = Number(this.maxLevel);
      feats = feats.filter((feat) => Number(feat.system?.level?.value ?? 0) <= maxLevel);
    }
    if (this.searchText) feats = filterBySearch(feats, this.searchText);
    if (this.category === 'skill' && this.selectedSkill) feats = filterBySkill(feats, [this.selectedSkill]);
    if (this.category === 'general') feats = filterByGeneralSkillFeats(feats, this.showSkillFeats);
    if (['class', 'archetype'].includes(this.category)) feats = filterByDedication(feats, this.showDedications);
    if (this.category === 'custom' && this.selectedFeatTypes.size > 0) {
      feats = feats.filter((feat) => {
        const types = this._getFeatTypes(feat);
        return types.some((type) => this.selectedFeatTypes.has(type));
      });
    }

    this._enrichWithPrerequisites(feats);
    if (this.hideFailedPrereqs) feats = feats.filter((f) => !f.prerequisitesFailed);
    return sortFeats(feats, this.sortMethod);
  }

  _createBuildStateSignature() {
    const feats = [...(this.buildState?.feats ?? new Set())].sort();
    const classSlug = this.buildState?.class?.slug ?? this.actor?.class?.slug ?? '';
    const level = this.buildState?.level ?? this.targetLevel ?? '';
    return `${classSlug}|${level}|${feats.join(',')}`;
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

      const slug = feat.slug ?? null;
      const featKeys = this._getAdditionalArchetypeFeatKeys(feat);
      const isArchetypeAdditionalFeat = ['archetype', 'class', 'general', 'skill'].includes(this.category)
        && featKeys.some((key) => this.additionalArchetypeFeatLevels.has(key));
      feat.alreadyTaken = !!slug && ownedSlugs.has(slug) && feat.system.maxTakable === 1;
      feat.takenAtLevel = feat.alreadyTaken && slug ? (takenLevelMap.get(slug) ?? null) : null;

      if (isArchetypeAdditionalFeat) {
        feat.hasFailedPrerequisites = false;
        feat.prerequisitesFailed = false;
        feat.selectionBlocked = false;
      }
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

    const uncommonToggle = el.querySelector('[data-action="toggleUncommon"]');
    if (uncommonToggle) {
      uncommonToggle.addEventListener('change', (e) => {
        this.showUncommon = e.target.checked;
        this._scheduleListUpdate();
      }, { signal });
    }

    const rareToggle = el.querySelector('[data-action="toggleRare"]');
    if (rareToggle) {
      rareToggle.addEventListener('change', (e) => {
        this.showRare = e.target.checked;
        this._scheduleListUpdate();
      }, { signal });
    }

    el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sourceKey = btn.dataset.package;
        if (!sourceKey) return;
        if (this.selectedSourcePackages.has(sourceKey)) {
          if (this.selectedSourcePackages.size > 1) this.selectedSourcePackages.delete(sourceKey);
        } else {
          this.selectedSourcePackages.add(sourceKey);
        }
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

    const skillSelect = el.querySelector('[data-action="filterSkillFeats"]');
    if (skillSelect) {
      skillSelect.addEventListener('change', (e) => {
        this.selectedSkill = e.target.value;
        this._scheduleListUpdate();
      }, { signal });
    }

    const dedicationToggle = el.querySelector('[data-action="toggleDedications"]');
    if (dedicationToggle) {
      dedicationToggle.addEventListener('click', () => {
        this.showDedications = !this.showDedications;
        dedicationToggle.classList.toggle('active', this.showDedications);
        this._scheduleListUpdate();
      }, { signal });
    }

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
        if (this.selectedFeatTypes.has(type)) {
          if (this.selectedFeatTypes.size > 1) this.selectedFeatTypes.delete(type);
        } else {
          this.selectedFeatTypes.add(type);
        }
        for (const chip of el.querySelectorAll('[data-action="toggleFeatType"]')) {
          chip.classList.toggle('selected', this.selectedFeatTypes.has(chip.dataset.type));
        }
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

    const resultCount = root?.querySelector('.feat-picker__results-count');
    if (resultCount) resultCount.textContent = String(this.filteredFeats.length);
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
    const countEl = root.querySelector('.feat-picker__selected-count');
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

  _getSkillOptions() {
    if (this.category !== 'skill') return [];
    const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
    const options = Object.entries(configSkills).map(([slug, rawEntry]) => {
      const rawLabel = typeof rawEntry === 'string'
        ? rawEntry
        : rawEntry?.label ?? rawEntry?.short ?? rawEntry?.long ?? slug;
      return {
        slug,
        label: typeof rawLabel === 'string' && game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel,
      };
    });
    options.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return options;
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
    if (!this._sourceFilterInitialized) {
      this.selectedSourcePackages = new Set(options.map((entry) => entry.key));
      this._sourceFilterInitialized = true;
    }

    return options.map((entry) => ({
      ...entry,
      selected: this.selectedSourcePackages.has(entry.key),
    }));
  }

  _getFeatTypeOptions() {
    if (this.category !== 'custom') return [];

    const labels = {
      class: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_CLASS'),
      ancestry: game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.TYPE_ANCESTRY'),
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

    const options = [...seen]
      .map((type) => ({ value: type, label: labels[type] ?? type }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (this.selectedFeatTypes.size === 0) {
      this.selectedFeatTypes = new Set(options.map((entry) => entry.value));
    }

    return options.map((entry) => ({
      ...entry,
      selected: this.selectedFeatTypes.has(entry.value),
    }));
  }

  _getLevelOptions() {
    return Array.from({ length: 20 }, (_unused, index) => {
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
    const types = [];

    if (traits.includes('mythic')) types.push('mythic');
    if (traits.includes('archetype') || traits.includes('dedication')) types.push('archetype');
    if (traits.includes('general')) types.push('general');
    if (traits.includes('skill')) types.push('skill');
    if (ancestryTraits.some((trait) => traits.includes(trait))) types.push('ancestry');
    if (classSlug && traits.includes(classSlug)) types.push('class');

    if (types.length === 0) types.push('other');
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

  _toTemplateFeat(feat) {
    return {
      ...feat,
      uuid: this._getFeatUuid(feat),
      _levelerSelected: this.selectedFeatUuids.has(this._getFeatUuid(feat)),
    };
  }
}
