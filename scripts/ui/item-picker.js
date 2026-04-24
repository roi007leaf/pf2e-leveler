import { MODULE_ID } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { annotateGuidance, filterDisallowedForCurrentUser } from '../access/content-guidance.js';
import {
  applyRarityFilter,
  applySourceFilter,
  applyPublicationFilter,
  applyTraitFilter,
  buildChipOptions,
  buildFilterSectionState,
  buildPublicationFilterSectionState,
  getAvailableRarityValues,
  isUnrestrictedSelection,
  initializeSelectionSet,
  normalizeItemCategory,
  toggleSelectableChip,
} from './shared/picker-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const renderHandlebarsTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
const RARITY_VALUES = ['common', 'uncommon', 'rare', 'unique'];

const CATEGORY_LABELS = {
  ammunition: 'Ammunition',
  armor: 'Armor',
  consumable: 'Consumable',
  container: 'Container',
  equipment: 'Equipment',
  shield: 'Shield',
  weapon: 'Weapon',
};

const ARMOR_FILTER_CATEGORY_LABELS = {
  unarmored: 'Unarmored',
  light: 'Light Armor',
  medium: 'Medium Armor',
  heavy: 'Heavy Armor',
  'light-barding': 'Light Barding',
  'heavy-barding': 'Heavy Barding',
};

const WEAPON_FILTER_CATEGORY_LABELS = {
  simple: 'Simple Weapon',
  martial: 'Martial Weapon',
  advanced: 'Advanced Weapon',
  unarmed: 'Unarmed Attack',
};

export class ItemPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, onSelect, options = {}) {
    super();
    this.actor = actor;
    this.onSelect = onSelect;
    this.multiSelect = options.multiSelect === true;
    this.allItems = options.items ?? [];
    this.filteredItems = [];
    this.selectedItemUuids = new Set();
    this.searchText = '';
    this.selectedPublications = new Set();
    this.selectedSourcePackages = new Set();
    this.selectedCategories = new Set();
    this.selectedRarities = new Set(['common', 'uncommon', 'rare', 'unique']);
    this.selectedTraits = new Set();
    this.selectedArmorFilters = new Set();
    this.selectedWeaponFilters = new Set();
    this.filterSections = {
      publications: true,
      armor: true,
      weapon: true,
    };
    this.traitLogic = 'or';
    this.armorFilterLogic = 'or';
    this.weaponFilterLogic = 'or';
    this.maxLevel = '';
    this._publicationTitles = [];
    this._sourcePackageValues = [];
    this._categoryValues = [];
    this._armorFilterValues = [];
    this._weaponFilterValues = [];
    this._updateTimer = null;
    this._domListeners = null;
    this._loading = this.allItems.length === 0;
    if (!this._loading) annotateGuidance(this.allItems);
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-item-picker',
    classes: ['pf2e-leveler'],
    position: { width: 900, height: 650 },
    window: { resizable: true },
  };

  static PARTS = {
    picker: {
      template: `modules/${MODULE_ID}/templates/item-picker.hbs`,
    },
  };

  get title() {
    return `${this.actor.name} — Equipment`;
  }

  async _prepareContext() {
    if (this._loading) {
      return { loading: true };
    }
    const publicationOptions = this._getPublicationOptions();
    const categoryOptions = this._getCategoryOptions();
    const armorFilterOptions = this._getArmorFilterOptions();
    const weaponFilterOptions = this._getWeaponFilterOptions();
    const showArmorFilters = this._shouldShowEquipmentFilters('armor');
    const showWeaponFilters = this._shouldShowEquipmentFilters('weapon');
    this._availableRarityValues = this._getAvailableRarityValues();
    this._normalizeSelectedRarities();
    this.filteredItems = this._filterItems();

    const RENDER_LIMIT = 200;
    const capped = !this._hasActiveFilter() && this.filteredItems.length > RENDER_LIMIT;
    const renderedItems = capped ? this.filteredItems.slice(0, RENDER_LIMIT) : this.filteredItems;
    return {
      loading: false,
      items: renderedItems.map((item) => this._toTemplateItem(item)),
      filteredCount: this.filteredItems.length,
      renderedCount: renderedItems.length,
      capped,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedItemUuids.size,
      allVisibleSelected: this._areAllVisibleSelected(),
      publicationOptions,
      categoryOptions,
      armorFilterOptions,
      weaponFilterOptions,
      showArmorFilters,
      showWeaponFilters,
      filterSections: this._getFilterSections(),
      rarityOptions: buildChipOptions(this._availableRarityValues, this.selectedRarities, {
        labels: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', unique: 'Unique' },
      }),
      traitOptions: this._getTraitOptions(),
      selectedTraitChips: this._getTraitOptions().filter((o) => o.selected),
      traitLogic: this.traitLogic,
      armorFilterLogic: this.armorFilterLogic,
      weaponFilterLogic: this.weaponFilterLogic,
      searchText: this.searchText,
      maxLevel: this.maxLevel,
      levelOptions: this._getLevelOptions(),
    };
  }

  _toTemplateItem(item) {
    const rarity = item.system?.traits?.rarity ?? 'common';
    const price = item.system?.price?.value;
    const pricePer = Number(item.system?.price?.per ?? 1);
    const priceLabel = price ? formatPrice(price) + (pricePer > 1 ? ` / ${pricePer}` : '') : '';
    return {
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      rarity,
      priceLabel,
      itemLevel: Number(item.system?.level?.value ?? 0),
      category: normalizeItemCategory(item),
      traits: [...new Set(item.system?.traits?.value ?? [])].filter((t) => t !== normalizeItemCategory(item)),
      equipmentTags: getEquipmentItemTags(item),
      isRecommended: item.isRecommended ?? false,
      isDisallowed: item.isDisallowed ?? false,
      guidanceSelectionBlocked: item.guidanceSelectionBlocked === true,
      guidanceSelectionTooltip: item.guidanceSelectionTooltip ?? '',
      _levelerSelected: this.selectedItemUuids.has(item.uuid),
    };
  }

  _filterItems({ ignoreRarity = false } = {}) {
    let items = filterDisallowedForCurrentUser([...this.allItems]);
    items = applySourceFilter(
      items,
      this.selectedSourcePackages,
      (item) => item.sourcePackage ?? item.sourcePack,
      this._sourcePackageValues,
    );
    items = applyPublicationFilter(
      items,
      this.selectedPublications,
      (item) => item.publicationTitle ?? item.system?.publication?.title,
      this._publicationTitles,
    );
    if (this.selectedCategories.size > 0 && !this._categoryValues.every((v) => this.selectedCategories.has(v))) {
      items = items.filter((item) => this.selectedCategories.has(normalizeItemCategory(item)));
    }
    if (this.selectedTraits.size > 0) {
      items = applyTraitFilter(items, this.selectedTraits, (item) => item.system?.traits?.value ?? [], this.traitLogic);
    }
    if (this._shouldApplyEquipmentFilters('armor')) {
      items = items.filter((item) => this._matchesEquipmentFilters(item, 'armor'));
    }
    if (this._shouldApplyEquipmentFilters('weapon')) {
      items = items.filter((item) => this._matchesEquipmentFilters(item, 'weapon'));
    }
    if (this.maxLevel !== '') {
      const max = Number(this.maxLevel);
      items = items.filter((item) => Number(item.system?.level?.value ?? 0) <= max);
    }
    if (this.searchText) {
      const query = this.searchText.toLowerCase();
      items = items.filter((item) => String(item.name ?? '').toLowerCase().includes(query));
    }
    if (!ignoreRarity) {
      items = applyRarityFilter(
        items,
        this.selectedRarities,
        (item) => item.system?.traits?.rarity ?? 'common',
        this._availableRarityValues ?? RARITY_VALUES,
      );
    }
    return items;
  }

  _getAvailableRarityValues() {
    return getAvailableRarityValues(
      this._filterItems({ ignoreRarity: true }),
      (item) => item.system?.traits?.rarity ?? 'common',
      RARITY_VALUES,
    );
  }

  _hasActiveFilter() {
    if (this.searchText) return true;
    if (this.maxLevel !== '') return true;
    if (this.selectedTraits.size > 0) return true;
    if (this._shouldApplyEquipmentFilters('armor') && !this._armorFilterValues.every((v) => this.selectedArmorFilters.has(v))) return true;
    if (this._shouldApplyEquipmentFilters('weapon') && !this._weaponFilterValues.every((v) => this.selectedWeaponFilters.has(v))) return true;
    if (!isUnrestrictedSelection(this.selectedCategories, this._categoryValues)) return true;
    if (!isUnrestrictedSelection(this.selectedSourcePackages, this._sourcePackageValues)) return true;
    if (!isUnrestrictedSelection(this.selectedPublications, this._publicationTitles)) return true;
    if (!isUnrestrictedSelection(this.selectedRarities, this._availableRarityValues ?? RARITY_VALUES)) return true;
    return false;
  }

  _getPublicationOptions() {
    const unique = new Map();
    for (const item of this.allItems) {
      const title = String(item.publicationTitle ?? item.system?.publication?.title ?? '').trim();
      if (!title || unique.has(title)) continue;
      unique.set(title, { key: title, label: title });
    }
    const options = [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
    this._publicationTitles = options.map((e) => e.key);
    this.selectedPublications = initializeSelectionSet(this.selectedPublications, this._publicationTitles, { defaultValues: [] });
    return options.map((e) => ({ ...e, selected: this.selectedPublications.has(e.key) }));
  }

  _getSourceOptions() {
    const unique = new Map();
    for (const item of this.allItems) {
      const key = String(item.sourcePackage ?? item.sourcePack ?? '').trim();
      if (!key || unique.has(key)) continue;
      unique.set(key, {
        key,
        label: String(item.sourcePackageLabel ?? item.sourceLabel ?? key).trim() || key,
      });
    }
    const options = [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
    this._sourcePackageValues = options.map((entry) => entry.key);
    this.selectedSourcePackages = initializeSelectionSet(this.selectedSourcePackages, this._sourcePackageValues, {
      defaultValues: this._sourcePackageValues,
    });
    return options.map((entry) => ({
      ...entry,
      selected: this.selectedSourcePackages.has(entry.key),
    }));
  }

  _normalizeSelectedRarities() {
    this.selectedRarities = initializeSelectionSet(this.selectedRarities, RARITY_VALUES, {
      defaultValues: RARITY_VALUES,
    });
  }

  _getCategoryOptions() {
    const seen = new Set(this.allItems.map((item) => normalizeItemCategory(item)));
    const categories = [...seen].sort((a, b) => a.localeCompare(b));
    this._categoryValues = categories;
    this.selectedCategories = initializeSelectionSet(this.selectedCategories, categories, { defaultValues: [] });
    return buildChipOptions(categories, this.selectedCategories, { labels: CATEGORY_LABELS });
  }

  _getArmorFilterOptions() {
    const values = collectEquipmentFilterValues(this.allItems, 'armor');
    this._armorFilterValues = values.map((entry) => entry.value);
    this.selectedArmorFilters = initializeSelectionSet(this.selectedArmorFilters, this._armorFilterValues, { defaultValues: [] });
    return values.map((entry) => ({
      ...entry,
      selected: this.selectedArmorFilters.has(entry.value),
    }));
  }

  _getWeaponFilterOptions() {
    const values = collectEquipmentFilterValues(this.allItems, 'weapon');
    this._weaponFilterValues = values.map((entry) => entry.value);
    this.selectedWeaponFilters = initializeSelectionSet(this.selectedWeaponFilters, this._weaponFilterValues, { defaultValues: [] });
    return values.map((entry) => ({
      ...entry,
      selected: this.selectedWeaponFilters.has(entry.value),
    }));
  }

  _getLevelOptions() {
    return Array.from({ length: 25 }, (_, i) => ({ value: String(i), label: String(i) }));
  }

  _getTraitOptions() {
    const traits = new Set();
    for (const item of this.allItems) {
      for (const trait of (item.system?.traits?.value ?? [])) traits.add(String(trait).toLowerCase());
    }
    return buildChipOptions([...traits].sort((a, b) => a.localeCompare(b)), this.selectedTraits);
  }

  _getVisibleTraits() {
    const traits = new Set();
    const source = this.filteredItems?.length > 0 ? this.filteredItems : this.allItems;
    for (const item of source) {
      for (const trait of (item.system?.traits?.value ?? [])) traits.add(String(trait).toLowerCase());
    }
    for (const trait of this.selectedTraits) traits.add(trait);
    return [...traits].sort((a, b) => a.localeCompare(b));
  }

  _commitTraitInput(input) {
    const trait = String(input?.value ?? '').trim().toLowerCase();
    if (!trait) return;
    this.selectedTraits.add(trait);
    if (input) input.value = '';
    this._updateList();
  }

  _updateAutocomplete(el, query) {
    const dropdown = el.querySelector('[data-role="trait-autocomplete"]');
    if (!dropdown) return;
    const q = query.trim().toLowerCase();
    if (!q) { this._closeAutocomplete(el); return; }
    const traits = (this._cachedVisibleTraits ?? [])
      .filter((t) => t.includes(q) && !this.selectedTraits.has(t));
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
      });
    }
  }

  _closeAutocomplete(el) {
    const dropdown = el.querySelector('[data-role="trait-autocomplete"]');
    if (dropdown) { dropdown.classList.remove('open'); dropdown.innerHTML = ''; }
  }

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
        if (!trait) return;
        if (this.selectedTraits.has(trait)) this.selectedTraits.delete(trait);
        else this.selectedTraits.add(trait);
        this._updateList();
      }, { signal });
    });
  }

  async _updateList() {
    this._availableRarityValues = this._getAvailableRarityValues();
    this._normalizeSelectedRarities();
    this.filteredItems = this._filterItems();
    const root = this._getRootElement();
    const listContainer = root?.querySelector('.item-list');
    if (!listContainer) return;
    const RENDER_LIMIT = 200;
    const capped = !this._hasActiveFilter() && this.filteredItems.length > RENDER_LIMIT;
    const renderedItems = capped ? this.filteredItems.slice(0, RENDER_LIMIT) : this.filteredItems;
    const context = {
      items: renderedItems.map((item) => this._toTemplateItem(item)),
      filteredCount: this.filteredItems.length,
      renderedCount: renderedItems.length,
      capped,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedItemUuids.size,
      allVisibleSelected: this._areAllVisibleSelected(),
      publicationOptions: this._getPublicationOptions(),
      armorFilterOptions: this._getArmorFilterOptions(),
      weaponFilterOptions: this._getWeaponFilterOptions(),
      showArmorFilters: this._shouldShowEquipmentFilters('armor'),
      showWeaponFilters: this._shouldShowEquipmentFilters('weapon'),
      filterSections: this._getFilterSections(),
      armorFilterLogic: this.armorFilterLogic,
      weaponFilterLogic: this.weaponFilterLogic,
      rarityOptions: buildChipOptions(this._availableRarityValues, this.selectedRarities, {
        labels: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', unique: 'Unique' },
      }),
    };
    const html = await renderHandlebarsTemplate(`modules/${MODULE_ID}/templates/item-picker.hbs`, context);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.item-list');
    if (newList) listContainer.innerHTML = newList.innerHTML;
    const rarityContainer = root?.querySelector('[data-role="rarity-chips"]');
    const newRarityContainer = temp.querySelector('[data-role="rarity-chips"]');
    if (rarityContainer && newRarityContainer) rarityContainer.innerHTML = newRarityContainer.innerHTML;
    const publicationSection = root?.querySelector('[data-section="publications"]');
    const newPublicationSection = temp.querySelector('[data-section="publications"]');
    if (publicationSection && newPublicationSection) publicationSection.replaceWith(newPublicationSection);
    const countEl = root?.querySelector('.picker__results-count');
    if (countEl) countEl.textContent = capped ? `${renderedItems.length}/${this.filteredItems.length}` : String(this.filteredItems.length);

    const traitChipContainer = root?.querySelector('[data-role="selected-trait-chips"]');
    if (traitChipContainer) {
      const selectedChips = this._getTraitOptions().filter((o) => o.selected);
      traitChipContainer.style.display = selectedChips.length > 0 ? '' : 'none';
      traitChipContainer.innerHTML = selectedChips.map((chip) => `
        <button type="button" class="picker__source-chip selected" data-action="toggleTraitChip" data-trait="${chip.value}">
          <span>${chip.label}</span>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `).join('');
      if (this._domListeners?.signal) this._bindTraitChipListeners(root, this._domListeners.signal);
    }

    this._cachedVisibleTraits = this._getVisibleTraits();
    this._updateFilterSectionControlStates(root);
    this._updateSelectionUI();
  }

  _matchesEquipmentFilters(item, kind) {
    const selected = kind === 'armor' ? this.selectedArmorFilters : this.selectedWeaponFilters;
    const logic = kind === 'armor' ? this.armorFilterLogic : this.weaponFilterLogic;
    const available = kind === 'armor' ? this._armorFilterValues : this._weaponFilterValues;
    if (selected.size === 0) return true;
    if (selected.size > 0 && available.every((value) => selected.has(value))) return true;

    const itemValues = getEquipmentFilterValuesForItem(item, kind);
    if (itemValues.size === 0) return false;
    if (logic === 'and') return [...selected].every((value) => itemValues.has(value));
    return [...selected].some((value) => itemValues.has(value));
  }

  _shouldShowEquipmentFilters(kind) {
    const category = kind === 'armor' ? 'armor' : 'weapon';
    const available = kind === 'armor' ? this._armorFilterValues : this._weaponFilterValues;
    return available.length > 0 && this.selectedCategories.has(category);
  }

  _shouldApplyEquipmentFilters(kind) {
    const selected = kind === 'armor' ? this.selectedArmorFilters : this.selectedWeaponFilters;
    return this._shouldShowEquipmentFilters(kind) && selected.size > 0;
  }

  _getFilterSections() {
    return {
      publications: buildPublicationFilterSectionState(
        this.selectedPublications,
        this._publicationTitles,
        this.filterSections?.publications,
      ),
      armor: this._getEquipmentFilterSectionState('armor'),
      weapon: this._getEquipmentFilterSectionState('weapon'),
    };
  }

  _getEquipmentFilterSectionState(kind) {
    const selected = kind === 'armor' ? this.selectedArmorFilters : this.selectedWeaponFilters;
    const available = kind === 'armor' ? this._armorFilterValues : this._weaponFilterValues;
    const activeCount = selected instanceof Set && !isUnrestrictedSelection(selected, available)
      ? selected.size
      : 0;
    return buildFilterSectionState(this.filterSections?.[kind], activeCount);
  }

  _toggleFilterSection(section) {
    if (!section) return;
    this.filterSections = {
      ...(this.filterSections ?? {}),
      [section]: !this.filterSections?.[section],
    };
    this.render(false);
  }

  _updateFilterSectionControlStates(root = this._getRootElement()) {
    if (!root) return;
    const states = this._getFilterSections();
    for (const [section, state] of Object.entries(states)) {
      const sectionEl = root.querySelector(`[data-section="${section}"]`);
      if (!sectionEl) continue;
      const summary = sectionEl.querySelector(`[data-section-summary="${section}"]`);
      if (summary) summary.textContent = state.activeCount > 0 ? `(${state.summary})` : '';
      for (const toggle of sectionEl.querySelectorAll('[data-action="toggleFilterSection"]')) {
        toggle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
      }
      const body = sectionEl.querySelector('.picker__section-body');
      if (body) body.hidden = state.collapsed;
    }
  }

  _scheduleUpdate() {
    if (this._updateTimer) clearTimeout(this._updateTimer);
    this._updateTimer = setTimeout(() => {
      this._updateTimer = null;
      this._updateList();
    }, 150);
  }

  _getRootElement() {
    const root = this.element;
    if (!root) return null;
    if (root.matches?.('.pf2e-leveler.item-picker')) return root;
    return root.querySelector?.('.pf2e-leveler.item-picker') ?? root;
  }

  _onRender() {
    const el = this._getRootElement();
    if (!el) return;

    if (this._loading) {
      loadItems().then((items) => {
        this.allItems = items;
        annotateGuidance(this.allItems);
        this._loading = false;
        this.render(false);
      });
      return;
    }

    if (this._domListeners?.abort) this._domListeners.abort();
    this._domListeners = new AbortController();
    const { signal } = this._domListeners;

    el.addEventListener('input', (e) => {
      if (e.target.closest?.('[data-action="searchItems"]')) {
        this.searchText = e.target.value;
        this._scheduleUpdate();
        return;
      }
      if (e.target.closest?.('[data-action="searchPublications"]')) {
        const query = e.target.value.trim().toLowerCase();
        el.querySelectorAll('[data-action="togglePublication"]').forEach((btn) => {
          const name = (btn.dataset.publicationName ?? btn.textContent ?? '').toLowerCase();
          btn.style.display = !query || name.includes(query) ? '' : 'none';
        });
      }
    }, { signal });

    const maxLevelSelect = el.querySelector('[data-action="filterMaxLevel"]');
    if (maxLevelSelect) {
      maxLevelSelect.addEventListener('change', (e) => {
        this.maxLevel = e.target.value;
        this._updateList();
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
          if (highlighted) traitInput.value = highlighted.dataset.trait;
          this._commitTraitInput(traitInput);
          this._closeAutocomplete(el);
          return;
        }
        if (e.key === 'Escape') {
          this._closeAutocomplete(el);
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

    this._bindTraitChipListeners(el, signal);

    el.addEventListener('click', async (e) => {
      const target = e.target.closest?.('[data-action]');
      if (!target || !el.contains(target)) return;

      const action = target.dataset.action;

      if (action === 'toggleCategory') {
        this.selectedCategories = toggleSelectableChip(this.selectedCategories, target.dataset.category, this._categoryValues);
        this.render(false);
        return;
      }

      if (action === 'toggleRarityChip') {
        this.selectedRarities = toggleSelectableChip(this.selectedRarities, target.dataset.rarity, this._availableRarityValues ?? RARITY_VALUES);
        target.classList.toggle('selected', this.selectedRarities.has(target.dataset.rarity));
        this._updateList();
        return;
      }

      if (action === 'toggleFilterSection') {
        this._toggleFilterSection(target.dataset.section);
        return;
      }

      if (action === 'toggleArmorFilter') {
        this.selectedArmorFilters = toggleSelectableChip(this.selectedArmorFilters, target.dataset.filter, this._armorFilterValues);
        target.classList.toggle('selected', this.selectedArmorFilters.has(target.dataset.filter));
        this._updateList();
        return;
      }

      if (action === 'toggleArmorFilterLogic') {
        this.armorFilterLogic = this.armorFilterLogic === 'and' ? 'or' : 'and';
        target.textContent = this.armorFilterLogic === 'and' ? 'AND' : 'OR';
        this._updateList();
        return;
      }

      if (action === 'toggleWeaponFilter') {
        this.selectedWeaponFilters = toggleSelectableChip(this.selectedWeaponFilters, target.dataset.filter, this._weaponFilterValues);
        target.classList.toggle('selected', this.selectedWeaponFilters.has(target.dataset.filter));
        this._updateList();
        return;
      }

      if (action === 'toggleWeaponFilterLogic') {
        this.weaponFilterLogic = this.weaponFilterLogic === 'and' ? 'or' : 'and';
        target.textContent = this.weaponFilterLogic === 'and' ? 'AND' : 'OR';
        this._updateList();
        return;
      }

      if (action === 'togglePublication') {
        this.selectedPublications = toggleSelectableChip(this.selectedPublications, target.dataset.publication, this._publicationTitles);
        target.classList.toggle('selected', this.selectedPublications.has(target.dataset.publication));
        this._updateList();
        return;
      }

      if (action === 'toggleTraitLogic') {
        this.traitLogic = this.traitLogic === 'and' ? 'or' : 'and';
        target.textContent = this.traitLogic === 'and' ? 'AND' : 'OR';
        this._updateList();
        return;
      }

      if (action === 'viewItem') {
        e.preventDefault();
        const uuid = target.closest('[data-uuid]')?.dataset.uuid ?? target.dataset.uuid;
        const item = await fromUuid(uuid).catch(() => null);
        if (item?.sheet) item.sheet.render(true);
        return;
      }

      if (action === 'selectItem') {
        e.preventDefault();
        e.stopPropagation();
        const uuid = target.closest('[data-uuid]')?.dataset.uuid ?? target.dataset.uuid;
        const item = this.allItems.find((entry) => entry.uuid === uuid) ?? await fromUuid(uuid).catch(() => null);
        if (item?.guidanceSelectionBlocked) return;
        if (item && this.onSelect) {
          if (this.multiSelect) {
            this._toggleSelectedItem(item.uuid);
            this._updateSelectionUI();
          } else {
            await this.onSelect(item);
            this.close();
          }
        }
        return;
      }

      if (action === 'toggleSelectAll') {
        e.preventDefault();
        e.stopPropagation();
        this._toggleSelectAllVisible();
        this._updateSelectionUI();
        return;
      }

      if (action === 'confirmSelection') {
        e.preventDefault();
        e.stopPropagation();
        await this._confirmSelection();
      }
    }, { signal });
  }

  _getVisibleItemOptions() {
    const el = this._getRootElement();
    if (!el) return [];
    return [...el.querySelectorAll('.item-option')].filter((item) => item.style.display !== 'none');
  }

  _getVisibleItemUuids() {
    return this._getVisibleItemOptions()
      .filter((item) => item.dataset.selectable !== 'false')
      .map((item) => item.dataset.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
  }

  _areAllVisibleSelected() {
    const visibleUuids = this._getVisibleItemUuids();
    return visibleUuids.length > 0 && visibleUuids.every((uuid) => this.selectedItemUuids.has(uuid));
  }

  _toggleSelectedItem(uuid) {
    if (!uuid) return;
    const item = this.allItems.find((entry) => entry.uuid === uuid);
    if (item?.guidanceSelectionBlocked) return;
    if (this.selectedItemUuids.has(uuid)) this.selectedItemUuids.delete(uuid);
    else this.selectedItemUuids.add(uuid);
  }

  _toggleSelectAllVisible() {
    const visibleUuids = this._getVisibleItemUuids();
    if (visibleUuids.length === 0) return;

    const allVisibleSelected = visibleUuids.every((uuid) => this.selectedItemUuids.has(uuid));
    for (const uuid of visibleUuids) {
      if (allVisibleSelected) this.selectedItemUuids.delete(uuid);
      else this.selectedItemUuids.add(uuid);
    }
  }

  async _confirmSelection() {
    if (!this.multiSelect || this.selectedItemUuids.size === 0 || !this.onSelect) return;
    const selectedItems = this.allItems
      .filter((item) => this.selectedItemUuids.has(item.uuid) && item.guidanceSelectionBlocked !== true)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (selectedItems.length === 0) return;
    await this.onSelect(selectedItems);
    this.close();
  }

  _updateSelectionUI() {
    const el = this._getRootElement();
    if (!el || !this.multiSelect) return;

    for (const option of el.querySelectorAll('.item-option')) {
      const uuid = option.dataset.uuid;
      const selected = this.selectedItemUuids.has(uuid);
      option.classList.toggle('spell-option--selected', selected);
      const button = option.querySelector('[data-action="selectItem"]');
      if (button) {
        button.classList.toggle('active', selected);
        const selectable = option.dataset.selectable !== 'false';
        button.disabled = !selectable;
        button.textContent = !selectable
          ? game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_DISALLOWED')
          : selected
            ? game.i18n.localize('PF2E_LEVELER.UI.SELECTED')
            : game.i18n.localize('PF2E_LEVELER.FEAT_PICKER.SELECT');
      }
    }

    const countEl = el.querySelector('.spell-picker__selected-count');
    if (countEl) {
      countEl.textContent = game.i18n.format('PF2E_LEVELER.SPELLS.SELECTED_COUNT', {
        count: this.selectedItemUuids.size,
      });
    }

    const selectAllButton = el.querySelector('[data-action="toggleSelectAll"]');
    if (selectAllButton) {
      selectAllButton.disabled = this._getVisibleItemUuids().length === 0;
      selectAllButton.textContent = game.i18n.localize(
        this._areAllVisibleSelected()
          ? 'PF2E_LEVELER.SPELLS.DESELECT_ALL'
          : 'PF2E_LEVELER.SPELLS.SELECT_ALL',
      );
    }

    const confirmButton = el.querySelector('[data-action="confirmSelection"]');
    if (confirmButton) {
      confirmButton.disabled = this.selectedItemUuids.size === 0;
    }
  }
}

function formatPrice(price) {
  if (!price || typeof price !== 'object') return '';
  const parts = [];
  if (price.gp) parts.push(`${price.gp} gp`);
  if (price.sp) parts.push(`${price.sp} sp`);
  if (price.cp) parts.push(`${price.cp} cp`);
  return parts.join(', ');
}

let _itemCache = null;

export async function loadItems() {
  if (_itemCache) return _itemCache;
  const keys = getCompendiumKeysForCategory('equipment');
  const items = [];
  for (const key of keys) {
    const pack = game.packs.get(key);
    if (!pack) continue;
    const docs = await pack.getDocuments().catch(() => []);
    const sourcePackage = pack.metadata?.packageName ?? pack.metadata?.package ?? '';
    const sourcePackageLabel = game.modules?.get?.(sourcePackage)?.title ?? sourcePackage ?? key;
    items.push(...docs.map((doc) => {
      doc.sourcePack = key;
      doc.sourcePackage = sourcePackage || key;
      doc.sourcePackageLabel = sourcePackageLabel || key;
      doc.publicationTitle = doc.publicationTitle ?? doc.system?.publication?.title ?? null;
      return doc;
    }));
  }
  const worldSourcePackage = 'world';
  const worldSourcePackageLabel = compactSourceOwnerLabel(game.world?.title ?? 'World');
  items.push(...getAllWorldItems()
    .filter((item) => EQUIPMENT_TYPES.has(String(item?.type ?? '').toLowerCase()))
    .map((item) => {
      item.sourcePack = item.sourcePack ?? null;
      item.sourcePackage = item.sourcePackage ?? worldSourcePackage;
      item.sourcePackageLabel = item.sourcePackageLabel ?? worldSourcePackageLabel;
      item.publicationTitle = item.publicationTitle ?? item.system?.publication?.title ?? null;
      return item;
    }));
  _itemCache = items;
  annotateGuidance(_itemCache);
  return items;
}

export function invalidateItemCache() {
  _itemCache = null;
}

const EQUIPMENT_TYPES = new Set(['weapon', 'armor', 'equipment', 'consumable', 'ammo', 'treasure', 'backpack', 'shield', 'kit']);

function getAllWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}

function compactSourceOwnerLabel(label) {
  let text = String(label ?? '').trim();
  if (!text) return '';
  if (/^pathfinder second edition$/i.test(text)) return 'PF2E';
  text = text.replace(/\s+for\s+Pathfinder\s+2e\s+by\s+Roll\s+For\s+Combat$/i, '');
  text = text.replace(/\s+by\s+Roll\s+For\s+Combat$/i, '');
  return text;
}

function collectEquipmentFilterValues(items, kind) {
  const values = new Map();
  for (const item of items ?? []) {
    for (const value of getEquipmentFilterValuesForItem(item, kind)) {
      if (!values.has(value)) {
        values.set(value, {
          value,
          label: getEquipmentFilterLabel(value, kind),
        });
      }
    }
  }
  return [...values.values()].sort(compareEquipmentFilterOptions);
}

function getEquipmentFilterValuesForItem(item, kind) {
  const values = new Set();
  const type = String(item?.type ?? '').toLowerCase();
  const category = normalizeEquipmentProperty(
    item?.system?.category?.value ?? item?.system?.category ?? item?.category ?? '',
  );
  const group = normalizeEquipmentProperty(
    item?.system?.group?.value ?? item?.system?.group ?? '',
  );
  const traits = new Set((item?.system?.traits?.value ?? []).map((trait) => normalizeEquipmentProperty(trait)).filter(Boolean));

  if (kind === 'armor') {
    if (type !== 'armor') return values;
    if (category) values.add(`category:${category}`);
    if (group) values.add(`group:${group}`);
    for (const fallback of ['chain', 'cloth', 'composite', 'leather', 'plate', 'skeletal', 'wood', 'ceramic', 'polymer']) {
      if (traits.has(fallback)) values.add(`group:${fallback}`);
    }
    return values;
  }

  if (type !== 'weapon') return values;
  if (category) values.add(`category:${category}`);
  if (group) values.add(`group:${group}`);
  return values;
}

function normalizeEquipmentProperty(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function getEquipmentFilterLabel(value, kind) {
  const [type, raw] = String(value ?? '').split(':');
  if (!raw) return value;
  if (type === 'category' && kind === 'armor') return ARMOR_FILTER_CATEGORY_LABELS[raw] ?? humanizeEquipmentFilterValue(raw);
  if (type === 'category' && kind === 'weapon') return WEAPON_FILTER_CATEGORY_LABELS[raw] ?? humanizeEquipmentFilterValue(raw);
  return humanizeEquipmentFilterValue(raw);
}

function getEquipmentItemTags(item) {
  const type = String(item?.type ?? '').toLowerCase();
  if (type !== 'armor' && type !== 'weapon') return [];

  const values = getEquipmentFilterValuesForItem(item, type);
  const tags = [];
  for (const value of values) {
    const [tagType] = String(value).split(':');
    if (tagType !== 'category' && tagType !== 'group') continue;
    const label = getEquipmentFilterLabel(value, type);
    if (!tags.includes(label)) tags.push(label);
  }
  return tags;
}

function humanizeEquipmentFilterValue(value) {
  return String(value ?? '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compareEquipmentFilterOptions(a, b) {
  const [typeA] = String(a?.value ?? '').split(':');
  const [typeB] = String(b?.value ?? '').split(':');
  if (typeA !== typeB) return typeA === 'category' ? -1 : 1;
  return String(a?.label ?? '').localeCompare(String(b?.label ?? ''));
}
