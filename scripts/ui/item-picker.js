import { MODULE_ID } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import {
  applyRarityFilter,
  applySourceFilter,
  applyTraitFilter,
  buildChipOptions,
  initializeSelectionSet,
  normalizeItemCategory,
  toggleSelectableChip,
} from './shared/picker-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CATEGORY_LABELS = {
  ammunition: 'Ammunition',
  armor: 'Armor',
  consumable: 'Consumable',
  container: 'Container',
  equipment: 'Equipment',
  shield: 'Shield',
  weapon: 'Weapon',
};

export class ItemPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, onSelect, options = {}) {
    super();
    this.actor = actor;
    this.onSelect = onSelect;
    this.allItems = options.items ?? [];
    this.filteredItems = [];
    this.searchText = '';
    this.selectedSourcePackages = new Set();
    this.selectedCategories = new Set();
    this.selectedRarities = new Set(['common', 'uncommon', 'rare', 'unique']);
    this.selectedTraits = new Set();
    this.traitLogic = 'or';
    this._sourceKeys = [];
    this._categoryValues = [];
    this._updateTimer = null;
    this._domListeners = null;
    this._loading = this.allItems.length === 0;
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
    const sourceOptions = this._getSourceOptions();
    const categoryOptions = this._getCategoryOptions();
    this.filteredItems = this._filterItems();

    const RENDER_LIMIT = 200;
    const capped = !this._hasActiveFilter() && this.filteredItems.length > RENDER_LIMIT;
    return {
      loading: false,
      items: (capped ? this.filteredItems.slice(0, RENDER_LIMIT) : this.filteredItems).map((item) => this._toTemplateItem(item)),
      filteredCount: this.filteredItems.length,
      capped,
      sourceOptions,
      categoryOptions,
      rarityOptions: buildChipOptions(['common', 'uncommon', 'rare', 'unique'], this.selectedRarities, {
        labels: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', unique: 'Unique' },
      }),
      traitOptions: this._getTraitOptions(),
      selectedTraitChips: this._getTraitOptions().filter((o) => o.selected),
      traitLogic: this.traitLogic,
      searchText: this.searchText,
    };
  }

  _toTemplateItem(item) {
    const rarity = item.system?.traits?.rarity ?? 'common';
    const price = item.system?.price?.value;
    const priceLabel = price ? formatPrice(price) : '';
    return {
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      rarity,
      priceLabel,
      category: normalizeItemCategory(item),
      traits: (item.system?.traits?.value ?? []).slice(0, 4),
    };
  }

  _filterItems() {
    let items = [...this.allItems];
    items = applySourceFilter(items, this.selectedSourcePackages, (item) => item.sourcePackage ?? item.sourcePack, this._sourceKeys);
    items = applyRarityFilter(items, this.selectedRarities, (item) => item.system?.traits?.rarity ?? 'common');
    if (this.selectedCategories.size > 0 && !this._categoryValues.every((v) => this.selectedCategories.has(v))) {
      items = items.filter((item) => this.selectedCategories.has(normalizeItemCategory(item)));
    }
    if (this.selectedTraits.size > 0) {
      items = applyTraitFilter(items, this.selectedTraits, (item) => item.system?.traits?.value ?? [], this.traitLogic);
    }
    if (this.searchText) {
      const query = this.searchText.toLowerCase();
      items = items.filter((item) => String(item.name ?? '').toLowerCase().includes(query));
    }
    return items;
  }

  _hasActiveFilter() {
    if (this.searchText) return true;
    if (this.selectedTraits.size > 0) return true;
    if (this.selectedCategories.size > 0 && !this._categoryValues.every((v) => this.selectedCategories.has(v))) return true;
    if (this._sourceKeys.length > 0 && !this._sourceKeys.every((k) => this.selectedSourcePackages.has(k))) return true;
    if (!['common', 'uncommon', 'rare', 'unique'].every((r) => this.selectedRarities.has(r))) return true;
    return false;
  }

  _getSourceOptions() {
    const unique = new Map();
    for (const item of this.allItems) {
      const key = item.sourcePackage ?? item.sourcePack ?? null;
      if (!key || unique.has(key)) continue;
      unique.set(key, { key, label: item.sourcePackageLabel ?? key });
    }
    const options = [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
    this._sourceKeys = options.map((e) => e.key);
    this.selectedSourcePackages = initializeSelectionSet(this.selectedSourcePackages, this._sourceKeys);
    return options.map((e) => ({ ...e, selected: this.selectedSourcePackages.has(e.key) }));
  }

  _getCategoryOptions() {
    const seen = new Set(this.allItems.map((item) => normalizeItemCategory(item)));
    const categories = [...seen].sort((a, b) => a.localeCompare(b));
    this._categoryValues = categories;
    this.selectedCategories = initializeSelectionSet(this.selectedCategories, categories);
    return buildChipOptions(categories, this.selectedCategories, { labels: CATEGORY_LABELS });
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
    this.filteredItems = this._filterItems();
    const root = this._getRootElement();
    const listContainer = root?.querySelector('.item-list');
    if (!listContainer) return;
    const RENDER_LIMIT = 200;
    const capped = !this._hasActiveFilter() && this.filteredItems.length > RENDER_LIMIT;
    const context = {
      items: (capped ? this.filteredItems.slice(0, RENDER_LIMIT) : this.filteredItems).map((item) => this._toTemplateItem(item)),
      filteredCount: this.filteredItems.length,
      capped,
    };
    const html = await renderTemplate(`modules/${MODULE_ID}/templates/item-picker.hbs`, context);
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.item-list');
    if (newList) listContainer.innerHTML = newList.innerHTML;
    const countEl = root?.querySelector('.picker__results-count');
    if (countEl) countEl.textContent = String(this.filteredItems.length);

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

    const datalist = root?.querySelector('#item-trait-options');
    if (datalist) {
      datalist.innerHTML = this._getVisibleTraits().map((t) => `<option value="${t}">`).join('');
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
      }
    }, { signal });

    const traitInput = el.querySelector('[data-action="traitInput"]');
    if (traitInput) {
      traitInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._commitTraitInput(e.currentTarget); }
      }, { signal });
      traitInput.addEventListener('change', (e) => { this._commitTraitInput(e.currentTarget); }, { signal });
      traitInput.addEventListener('blur', (e) => { this._commitTraitInput(e.currentTarget); }, { signal });
    }

    this._bindTraitChipListeners(el, signal);

    el.addEventListener('click', async (e) => {
      const target = e.target.closest?.('[data-action]');
      if (!target || !el.contains(target)) return;

      const action = target.dataset.action;

      if (action === 'toggleCategory') {
        this.selectedCategories = toggleSelectableChip(this.selectedCategories, target.dataset.category, this._categoryValues);
        target.classList.toggle('selected', this.selectedCategories.has(target.dataset.category));
        this._updateList();
        return;
      }

      if (action === 'toggleRarityChip') {
        this.selectedRarities = toggleSelectableChip(this.selectedRarities, target.dataset.rarity, ['common', 'uncommon', 'rare', 'unique']);
        target.classList.toggle('selected', this.selectedRarities.has(target.dataset.rarity));
        this._updateList();
        return;
      }

      if (action === 'toggleCompendiumSource') {
        this.selectedSourcePackages = toggleSelectableChip(this.selectedSourcePackages, target.dataset.package, this._sourceKeys);
        target.classList.toggle('selected', this.selectedSourcePackages.has(target.dataset.package));
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
        const item = await fromUuid(uuid).catch(() => null);
        if (item && this.onSelect) {
          await this.onSelect(item);
          this.close();
        }
      }
    }, { signal });
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
    items.push(...docs.map((doc) => ({
      ...doc,
      uuid: doc.uuid,
      sourcePack: key,
      sourcePackage: sourcePackage || key,
      sourcePackageLabel: sourcePackageLabel || key,
    })));
  }
  _itemCache = items;
  return items;
}
