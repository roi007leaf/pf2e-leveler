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
const renderHandlebarsTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

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
    this.maxLevel = '';
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
      isRecommended: item.isRecommended ?? false,
      isDisallowed: item.isDisallowed ?? false,
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
    if (this.maxLevel !== '') {
      const max = Number(this.maxLevel);
      items = items.filter((item) => Number(item.system?.level?.value ?? 0) <= max);
    }
    if (this.searchText) {
      const query = this.searchText.toLowerCase();
      items = items.filter((item) => String(item.name ?? '').toLowerCase().includes(query));
    }
    return items;
  }

  _hasActiveFilter() {
    if (this.searchText) return true;
    if (this.maxLevel !== '') return true;
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
    this.selectedSourcePackages = initializeSelectionSet(this.selectedSourcePackages, this._sourceKeys, { defaultValues: [] });
    return options.map((e) => ({ ...e, selected: this.selectedSourcePackages.has(e.key) }));
  }

  _getCategoryOptions() {
    const seen = new Set(this.allItems.map((item) => normalizeItemCategory(item)));
    const categories = [...seen].sort((a, b) => a.localeCompare(b));
    this._categoryValues = categories;
    this.selectedCategories = initializeSelectionSet(this.selectedCategories, categories, { defaultValues: [] });
    return buildChipOptions(categories, this.selectedCategories, { labels: CATEGORY_LABELS });
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
    const html = await renderHandlebarsTemplate(`modules/${MODULE_ID}/templates/item-picker.hbs`, context);
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

    this._cachedVisibleTraits = this._getVisibleTraits();
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
    items.push(...docs.map((doc) => {
      doc.sourcePack = key;
      doc.sourcePackage = sourcePackage || key;
      doc.sourcePackageLabel = sourcePackageLabel || key;
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
      return item;
    }));
  _itemCache = items;
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
