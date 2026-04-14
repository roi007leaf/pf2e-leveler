import { MODULE_ID } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { isRarityAllowedForCurrentUser, getAllowedRaritiesForCurrentUser } from '../access/player-content.js';
import {
  applyRarityFilter,
  applySourceFilter,
  applyTraitFilter,
  buildChipOptions,
  initializeSelectionSet,
  normalizeSpellCategory,
  toggleSelectableChip,
} from './shared/picker-utils.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const renderHandlebarsTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

let cachedSpells = null;
let cachedSpellSourceSignature = '';

export class SpellPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, tradition, rank, onSelect, options = {}) {
    super();
    this.actor = actor;
    this.tradition = tradition;
    this.rank = rank;
    this.isCantrip = rank === 0;
    this.exactRank = options.exactRank === true;
    this.multiSelect = options.multiSelect === true;
    this.excludeOwnedByIdentity = options.excludeOwnedByIdentity === true;
    this.onSelect = onSelect;
    this.onRemoveSelected = typeof options.onRemoveSelected === 'function' ? options.onRemoveSelected : null;
    this.excludedUuids = new Set(options.excludedUuids ?? []);
    this.excludedSelections = new Set((options.excludedSelections ?? []).map((entry) => `${entry.uuid}:${entry.rank}`));
    this.maxRank = Number.isInteger(options.maxRank) ? options.maxRank : null;
    this.allowedUuids = new Set(options.allowedUuids ?? []);
    this.allSpells = [];
    this.filteredSpells = [];
    this.selectedSpellUuids = new Set();
    this.selectedSpells = options.selectedSpells ?? [];
    this.maxSelect = options.maxSelect ?? null;
    this.selectedRanks = new Set();
    this.selectedTraditions = new Set();
    this.lockedTraditions = new Set(tradition && tradition !== 'any' ? [tradition.toLowerCase()] : []);
    this.selectedCategories = new Set();
    this.lockedCategories = new Set(rank === 0 ? ['cantrip'] : (options.exactRank && rank > 0 ? ['spell'] : []));
    this.lockedRanks = new Set(options.exactRank && rank > 0 ? [rank] : []);
    this.selectedTraits = new Set();
    this.traitLogic = 'or';
    this.selectedRarities = getAllowedRaritiesForCurrentUser();
    this.lockedRarities = new Set();
    this.selectedSourcePackages = new Set();
    this._sourceFilterInitialized = false;
    this.searchText = '';
    this.sortMode = options.sortMode ?? this._getDefaultSortMode();
    this._updateListTimer = null;
    this._domListeners = null;
    this.preset = options.preset ?? null;
    this.customTitle = typeof options.title === 'string' && options.title.trim().length > 0
      ? options.title.trim()
      : null;
    this._applyPreset(this.preset);
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-spell-picker',
    classes: ['pf2e-leveler'],
    position: { width: 900, height: 650 },
    window: { resizable: true },
  };

  static PARTS = {
    picker: {
      template: `modules/${MODULE_ID}/templates/spell-picker.hbs`,
    },
  };

  get title() {
    if (this.customTitle) return this.customTitle;
    if (this.isCantrip) return `${this.actor.name} - Cantrips`;
    if (this.rank === -1) return `${this.actor.name} - ${this._capitalize(this.tradition)} Spellbook`;
    const ordinal = this._ordinal(this.rank);
    return `${this.actor.name} - ${ordinal}-Rank ${this._capitalize(this.tradition)} Spells`;
  }

  async _prepareContext() {
    const ownedSpells = getOwnedSpells(this.actor);
    const ownedSelections = new Set(
      ownedSpells.map((spell) => `${spell.uuid}:${spell.rank}`),
    );
    this._ownedIdentityKeys = new Set(
      ownedSpells.flatMap((spell) => spell.keys),
    );

    if (this.allSpells.length === 0) {
      const all = await loadSpells();
      const directAllowed = this.allowedUuids.size > 0
        ? await Promise.all([...this.allowedUuids].map(async (uuid) => {
          try {
            return await fromUuid(uuid);
          } catch {
            return null;
          }
        }))
        : [];
      const merged = dedupeSpellsByUuid([...all, ...directAllowed.filter(Boolean)]);

      this.allSpells = merged.filter((s) => {
        if (this.allowedUuids.size > 0 && !this.allowedUuids.has(s.uuid)) return false;
        if (!this._matchesTradition(s)) return false;
        const isCantrip = s.system.traits?.value?.includes('cantrip');
        const spellRank = getSpellRank(s.system ?? {});
        if (this.isCantrip) return isCantrip;
        if (this.rank === -1) {
          if ((!this.excludeOwnedByIdentity && ownedSelections.has(`${s.uuid}:${spellRank}`)) || this.excludedUuids.has(s.uuid)) return false;
          if (this.allowedUuids.size > 0) return true;
          if (isCantrip) return false;
          if (this.maxRank != null) return spellRank >= 1 && spellRank <= this.maxRank;
          return spellRank >= 1;
        }
        if (isCantrip) return false;
        if ((!this.excludeOwnedByIdentity && ownedSelections.has(`${s.uuid}:${this.rank}`)) || this.excludedSelections.has(`${s.uuid}:${this.rank}`)) return false;
        if (this.exactRank) return spellRank === this.rank;
        return spellRank <= this.rank;
      });
    }

    const sourceOptions = this._getSourceOptions();
    const rankOptions = this._getRankOptions();
    const traditionOptions = this._getTraditionOptions();
    const categoryOptions = this._getCategoryOptions();

    const allTraits = new Set();
    for (const spell of this.allSpells) {
      for (const trait of (spell.system?.traits?.value ?? [])) allTraits.add(trait);
    }
    this._allTraitOptions = [...allTraits].filter((trait) => trait !== 'cantrip').sort();
    this.filteredSpells = this._filterSpells();
    this._sortSpells(this.filteredSpells);

    return {
      spells: this.filteredSpells.map((spell) => this._toTemplateSpell(spell)),
      sourceOptions,
      rankOptions,
      traditionOptions,
      categoryOptions,
      allVisibleSelected: this.filteredSpells.length > 0
        && this.filteredSpells.every((spell) => this.selectedSpellUuids.has(spell.uuid)),
      filteredCount: this.filteredSpells.length,
      traitOptions: buildChipOptions(this._allTraitOptions, this.selectedTraits),
      selectedTraitChips: buildChipOptions(this._allTraitOptions, this.selectedTraits).filter((option) => option.selected),
      rarityOptions: buildChipOptions(['common', 'uncommon', 'rare', 'unique'], this.selectedRarities, {
        labels: this._getRarityLabels(),
        lockedValues: this._getLockedRarities(),
      }),
      traitLogic: this.traitLogic,
      rank: this.rank,
      tradition: this.tradition,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedSpellUuids.size,
      sortMode: this.sortMode,
      sortOptions: this._getSortOptions(),
      selectedSpells: this.selectedSpells.map((spell, index) => this._toSelectedTemplateSpell(spell, index)),
      maxSelect: this.maxSelect,
      remainingSlots: this.maxSelect != null ? this.maxSelect - this.selectedSpellUuids.size : null,
    };
  }

  _onRender() {
    const el = this._getRootElement();
    if (!el) return;

    if (this._domListeners?.abort) this._domListeners.abort();
    this._domListeners = new AbortController();
    const { signal } = this._domListeners;

    el.addEventListener('input', (e) => {
      const searchInput = e.target.closest?.('[data-action="searchSpells"]');
      if (searchInput) {
        this.searchText = e.target.value.toLowerCase();
        this._scheduleListUpdate(100);
        return;
      }

      const sourceSearch = e.target.closest?.('[data-action="searchCompendiumSources"]');
      if (sourceSearch) {
        const query = e.target.value.trim().toLowerCase();
        el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
          const name = (btn.dataset.sourceName ?? btn.textContent ?? '').toLowerCase();
          btn.style.display = !query || name.includes(query) ? '' : 'none';
        });
      }
    }, { signal });

    el.addEventListener('keydown', (e) => {
      const traitInput = e.target.closest?.('[data-action="traitInput"]');
      if (!traitInput) return;
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
        const trait = traitInput.value.trim().toLowerCase();
        if (!trait) return;
        traitInput.value = '';
        this.selectedTraits.add(trait);
        this._closeAutocomplete(el);
        this._scheduleListUpdate();
        return;
      }
      if (e.key === 'Escape') {
        this._closeAutocomplete(el);
      }
    }, { signal });

    el.addEventListener('input', (e) => {
      const traitInput = e.target.closest?.('[data-action="traitInput"]');
      if (traitInput) this._updateAutocomplete(el, traitInput.value);
    }, { signal });

    el.addEventListener('change', (e) => {
      const sortSelect = e.target.closest?.('[data-action="changeSort"]');
      if (sortSelect) {
        this.sortMode = sortSelect.value || this._getDefaultSortMode();
        this._scheduleListUpdate();
        return;
      }

      const toggle = e.target.closest?.('[data-action="toggleRarityChip"]');
      if (toggle) {
        const rarity = String(toggle.dataset.rarity ?? '').trim().toLowerCase();
        const lockedRarities = this._getLockedRarities();
        if (!lockedRarities.includes(rarity)) {
          this.selectedRarities = toggleSelectableChip(this.selectedRarities, rarity, ['common', 'uncommon', 'rare', 'unique'], lockedRarities);
          for (const chip of el.querySelectorAll('[data-action="toggleRarityChip"]')) {
            const chipRarity = String(chip.dataset.rarity ?? '').trim().toLowerCase();
            chip.classList.toggle('selected', this.selectedRarities.has(chipRarity));
          }
          this._scheduleListUpdate();
        }
      }
    }, { signal });

    el.addEventListener('click', async (e) => {
      const target = e.target.closest?.('[data-action]');
      if (!target || !el.contains(target)) return;

      const action = target.dataset.action;
      const uuid = target.closest('.spell-option')?.dataset?.uuid || target.dataset.uuid;

      if (action === 'selectSpell') {
        e.preventDefault();
        e.stopPropagation();
        const spell = this.filteredSpells.find((s) => s.uuid === uuid);
        if (spell && this.onSelect) {
          if (this.multiSelect) {
            this._toggleSelectedSpell(spell.uuid);
            this._updateSelectionUI();
          } else {
            await this.onSelect(spell);
            this.close();
          }
        }
        return;
      }

      if (action === 'viewSpell') {
        e.preventDefault();
        e.stopPropagation();
        if (!uuid) return;
        const item = await fromUuid(uuid);
        if (item?.sheet) item.sheet.render(true);
        return;
      }

      if (action === 'removeSelectedSpell') {
        e.preventDefault();
        e.stopPropagation();
        const index = Number(target.dataset.index);
        await this._removeSelectedSpell(index);
        return;
      }

      if (action === 'confirmSelection') {
        e.preventDefault();
        e.stopPropagation();
        await this._confirmSelection();
        return;
      }

      if (action === 'toggleSelectAll') {
        e.preventDefault();
        e.stopPropagation();
        this._toggleSelectAllVisible();
        this._updateSelectionUI();
        return;
      }

      if (action === 'toggleCompendiumSource') {
        e.preventDefault();
        e.stopPropagation();
        const sourceKey = target.dataset.package;
        if (!sourceKey) return;
        this.selectedSourcePackages = toggleSelectableChip(this.selectedSourcePackages, sourceKey, this._sourceKeys);
        for (const chip of el.querySelectorAll('[data-action="toggleCompendiumSource"]')) {
          chip.classList.toggle('selected', this.selectedSourcePackages.has(chip.dataset.package));
        }
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleSpellRank') {
        e.preventDefault();
        e.stopPropagation();
        const rank = Number(target.dataset.rank);
        if (!Number.isFinite(rank) || this.lockedRanks.has(rank)) return;
        this.selectedRanks = toggleSelectableChip(this.selectedRanks, rank, this._rankValues, [...this.lockedRanks]);
        for (const chip of el.querySelectorAll('[data-action="toggleSpellRank"]')) {
          chip.classList.toggle('selected', this.selectedRanks.has(Number(chip.dataset.rank)));
        }
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleSpellTradition') {
        e.preventDefault();
        e.stopPropagation();
        const tradition = String(target.dataset.tradition ?? '').trim().toLowerCase();
        if (!tradition) return;
        this.selectedTraditions = toggleSelectableChip(this.selectedTraditions, tradition, this._traditionValues, [...this.lockedTraditions]);
        for (const chip of el.querySelectorAll('[data-action="toggleSpellTradition"]')) {
          const chipTradition = String(chip.dataset.tradition ?? '').trim().toLowerCase();
          chip.classList.toggle('selected', this.selectedTraditions.has(chipTradition));
        }
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleSpellCategory') {
        e.preventDefault();
        e.stopPropagation();
        const category = String(target.dataset.category ?? '').trim().toLowerCase();
        if (!category || this.lockedCategories.has(category)) return;
        this.selectedCategories = toggleSelectableChip(this.selectedCategories, category, this._categoryValues);
        for (const chip of el.querySelectorAll('[data-action="toggleSpellCategory"]')) {
          const chipCategory = String(chip.dataset.category ?? '').trim().toLowerCase();
          chip.classList.toggle('selected', this.selectedCategories.has(chipCategory));
        }
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleRarityChip') {
        e.preventDefault();
        e.stopPropagation();
        const rarity = String(target.dataset.rarity ?? '').trim().toLowerCase();
        const lockedRarities = this._getLockedRarities();
        if (!rarity || lockedRarities.includes(rarity)) return;
        this.selectedRarities = toggleSelectableChip(this.selectedRarities, rarity, ['common', 'uncommon', 'rare', 'unique'], lockedRarities);
        for (const chip of el.querySelectorAll('[data-action="toggleRarityChip"]')) {
          const chipRarity = String(chip.dataset.rarity ?? '').trim().toLowerCase();
          chip.classList.toggle('selected', this.selectedRarities.has(chipRarity));
        }
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleTraitLogic') {
        e.preventDefault();
        e.stopPropagation();
        this.traitLogic = this.traitLogic === 'and' ? 'or' : 'and';
        this._scheduleListUpdate();
        return;
      }

      if (action === 'toggleTraitChip') {
        e.preventDefault();
        e.stopPropagation();
        const trait = String(target.dataset.trait ?? '').trim().toLowerCase();
        if (!trait) return;
        if (this.selectedTraits.has(trait)) this.selectedTraits.delete(trait);
        else this.selectedTraits.add(trait);
        this._scheduleListUpdate();
      }
    }, { signal });

    this._updateResultCount();
    this._updateFilterControlState();
    this._updateSelectionUI();
  }

  _matchesTradition(spell) {
    if (this.tradition === 'any') return true;
    const traits = spell.system.traits?.value ?? [];
    if (traits.includes('ritual') || spell.system?.ritual != null) return true;
    const traditions = spell.system.traits?.traditions ?? spell.system.traditions?.value ?? [];
    if (traditions.includes(this.tradition)) return true;
    return traits.includes(this.tradition);
  }

  async _updateList() {
    this.filteredSpells = this._filterSpells();
    this._sortSpells(this.filteredSpells);

    const root = this._getRootElement();
    const listContainer = root?.querySelector('.spell-picker__list');
    if (!listContainer) return;

    const html = await renderHandlebarsTemplate(`modules/${MODULE_ID}/templates/spell-picker.hbs`, {
      spells: this.filteredSpells.map((spell) => this._toTemplateSpell(spell)),
      sourceOptions: this._getSourceOptions(),
      rankOptions: this._getRankOptions(),
      traditionOptions: this._getTraditionOptions(),
      categoryOptions: this._getCategoryOptions(),
      allVisibleSelected: this.filteredSpells.length > 0
        && this.filteredSpells.every((spell) => this.selectedSpellUuids.has(spell.uuid)),
      filteredCount: this.filteredSpells.length,
      selectedTraitChips: buildChipOptions(this._allTraitOptions ?? [], this.selectedTraits).filter((option) => option.selected),
      rarityOptions: buildChipOptions(['common', 'uncommon', 'rare', 'unique'], this.selectedRarities, {
        labels: this._getRarityLabels(),
        lockedValues: this._getLockedRarities(),
      }),
      traitLogic: this.traitLogic,
      rank: this.rank,
      tradition: this.tradition,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedSpellUuids.size,
      sortMode: this.sortMode,
      sortOptions: this._getSortOptions(),
      selectedSpells: this.selectedSpells.map((spell, index) => this._toSelectedTemplateSpell(spell, index)),
      maxSelect: this.maxSelect,
      remainingSlots: this.maxSelect != null ? this.maxSelect - this.selectedSpellUuids.size : null,
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.spell-picker__list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }

    this._updateResultCount();
    this._updateFilterControlState();
    this._updateSelectionUI();
  }

  _filterSpells() {
    let spells = [...this.allSpells];
    spells = applySourceFilter(spells, this.selectedSourcePackages, (spell) => spell.sourcePackage ?? spell.sourcePack, this._sourceKeys);
    spells = applyRarityFilter(spells, this.selectedRarities, (spell) => spell.system?.traits?.rarity ?? 'common');
    if (this.selectedTraditions.size > 0 && !this._allSelected(this.selectedTraditions, this._traditionValues)) {
      spells = spells.filter((spell) => {
        const traits = spell.system?.traits?.value ?? [];
        if (traits.includes('ritual') || spell.system?.ritual != null) return true;
        const traditions = getSpellTraditions(spell.system ?? {});
        return traditions.some((tradition) => this.selectedTraditions.has(tradition));
      });
    }
    if (this.selectedRanks.size > 0 && !this._allSelected(this.selectedRanks, this._rankValues)) {
      spells = spells.filter((spell) => this.selectedRanks.has(getSpellRank(spell.system ?? {})));
    }
    if (this.selectedCategories.size > 0 && !this._allSelected(this.selectedCategories, this._categoryValues)) {
      spells = spells.filter((spell) => this.selectedCategories.has(normalizeSpellCategory(spell)));
    }
    spells = applyTraitFilter(spells, this.selectedTraits, (spell) => spell.system?.traits?.value ?? [], this.traitLogic);
    if (this.searchText) spells = spells.filter((s) => (s._levelerSearchName ?? s.name.toLowerCase()).includes(this.searchText));
    if (this.multiSelect) {
      const preSelectedUuids = new Set(this.selectedSpells.map((s) => s.uuid));
      spells = spells.filter((spell) => !this.selectedSpellUuids.has(spell.uuid) && !preSelectedUuids.has(spell.uuid));
    }
    return spells;
  }

  _sortSpells(spells) {
    spells.sort((a, b) => {
      if (this.sortMode === 'rank-desc') {
        return compareSpellRank(b, a) || compareSpellName(a, b);
      }
      if (this.sortMode === 'rank-asc') {
        return compareSpellRank(a, b) || compareSpellName(a, b);
      }
      if (this.sortMode === 'alpha-desc') {
        return compareSpellName(b, a) || compareSpellRank(a, b);
      }
      return compareSpellName(a, b) || compareSpellRank(a, b);
    });
  }

  _updateResultCount() {
    const el = this._getRootElement();
    if (!el) return;
    const visibleCount = this._getVisibleSpellOptions().length;
    const resultCount = el.querySelector('.picker__results-count');
    if (resultCount) resultCount.textContent = String(visibleCount);
  }

  _getVisibleSpellOptions() {
    const el = this._getRootElement();
    if (!el) return [];
    return [...el.querySelectorAll('.spell-option')].filter((item) => item.style.display !== 'none');
  }

  _getVisibleSpellUuids() {
    return this._getVisibleSpellOptions()
      .filter((item) => item.dataset.selectable !== 'false')
      .map((item) => item.dataset.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
  }

  _areAllVisibleSelected() {
    const visibleUuids = this._getVisibleSpellUuids();
    return visibleUuids.length > 0 && visibleUuids.every((uuid) => this.selectedSpellUuids.has(uuid));
  }

  _toggleSelectedSpell(uuid) {
    if (!uuid) return;
    if (this.selectedSpellUuids.has(uuid)) {
      this.selectedSpellUuids.delete(uuid);
    } else {
      if (this.maxSelect != null && this.selectedSpellUuids.size >= this.maxSelect) return;
      this.selectedSpellUuids.add(uuid);
    }
  }

  _toggleSelectAllVisible() {
    const visibleUuids = this._getVisibleSpellUuids();
    if (visibleUuids.length === 0) return;

    const allVisibleSelected = visibleUuids.every((uuid) => this.selectedSpellUuids.has(uuid));
    for (const uuid of visibleUuids) {
      if (allVisibleSelected) {
        this.selectedSpellUuids.delete(uuid);
      } else {
        if (this.maxSelect != null && this.selectedSpellUuids.size >= this.maxSelect) break;
        this.selectedSpellUuids.add(uuid);
      }
    }
  }

  async _confirmSelection() {
    if (!this.multiSelect || this.selectedSpellUuids.size === 0 || !this.onSelect) return;
    const selectedSpells = this.allSpells
      .filter((spell) => this.selectedSpellUuids.has(spell.uuid))
      .sort((a, b) => a.name.localeCompare(b.name));
    await this.onSelect(selectedSpells);
    this.close();
  }

  _updateSelectionUI() {
    const el = this._getRootElement();
    if (!el || !this.multiSelect) return;

    const count = this.selectedSpellUuids.size;
    const atMax = this.maxSelect != null && count >= this.maxSelect;

    for (const option of el.querySelectorAll('.spell-option')) {
      const uuid = option.dataset.uuid;
      const selected = this.selectedSpellUuids.has(uuid);
      const alreadyTaken = option.dataset.alreadyTaken === 'true';
      option.classList.toggle('spell-option--selected', selected);
      const button = option.querySelector('[data-action="selectSpell"]');
      if (button) {
        button.classList.toggle('active', selected);
        button.disabled = alreadyTaken || (!selected && atMax);
        button.textContent = alreadyTaken
          ? game.i18n.localize('PF2E_LEVELER.SPELLS.TAKEN')
          : selected
            ? game.i18n.localize('PF2E_LEVELER.UI.SELECTED')
            : game.i18n.localize('PF2E_LEVELER.SPELLS.SELECT');
      }
    }

    const visibleCount = this._getVisibleSpellUuids().length;
    const allVisibleSelected = this._areAllVisibleSelected();
    const countEl = el.querySelector('.spell-picker__selected-count');
    if (countEl) {
      countEl.textContent = this.maxSelect != null
        ? `${count} / ${this.maxSelect}`
        : game.i18n.format('PF2E_LEVELER.SPELLS.SELECTED_COUNT', { count });
    }

    const selectAllButton = el.querySelector('[data-action="toggleSelectAll"]');
    if (selectAllButton) {
      selectAllButton.disabled = visibleCount === 0;
      selectAllButton.textContent = game.i18n.localize(
        allVisibleSelected ? 'PF2E_LEVELER.SPELLS.DESELECT_ALL' : 'PF2E_LEVELER.SPELLS.SELECT_ALL',
      );
    }

    const confirmButton = el.querySelector('[data-action="confirmSelection"]');
    if (confirmButton) {
      confirmButton.disabled = count === 0;
    }
  }

  _updateFilterControlState() {
    const root = this._getRootElement();
    if (!root) return;

    const logicButton = root.querySelector('[data-action="toggleTraitLogic"]');
    if (logicButton) logicButton.textContent = this.traitLogic === 'and' ? 'AND' : 'OR';

    const traitChipContainer = root.querySelector('[data-role="selected-trait-chips"]');
    if (traitChipContainer) {
      const selectedTraitChips = buildChipOptions(this._allTraitOptions ?? [], this.selectedTraits).filter((option) => option.selected);
      traitChipContainer.style.display = selectedTraitChips.length > 0 ? '' : 'none';
      traitChipContainer.innerHTML = selectedTraitChips.map((chip) => `
        <button type="button"
          class="picker__source-chip ${chip.selected ? 'selected' : ''}"
          data-action="toggleTraitChip"
          data-trait="${chip.value}">
          <span>${chip.label}</span>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `).join('');
    }
  }

  _scheduleListUpdate(delay = 0) {
    if (this._updateListTimer) clearTimeout(this._updateListTimer);
    this._updateListTimer = setTimeout(() => {
      this._updateListTimer = null;
      this._updateList();
    }, delay);
  }

  _ordinal(n) {
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${n}${suffixes[n] || 'th'}`;
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  _getDefaultSortMode() {
    if (this.rank === -1) return 'rank-desc';
    if (!this.isCantrip && !this.exactRank && this.rank > 1) return 'rank-desc';
    return 'alpha-asc';
  }

  _getSortOptions() {
    return [
      { value: 'rank-desc', label: game.i18n.localize('PF2E_LEVELER.SPELLS.SORT_RANK_DESC') },
      { value: 'rank-asc', label: game.i18n.localize('PF2E_LEVELER.SPELLS.SORT_RANK_ASC') },
      { value: 'alpha-asc', label: game.i18n.localize('PF2E_LEVELER.SPELLS.SORT_ALPHA_ASC') },
      { value: 'alpha-desc', label: game.i18n.localize('PF2E_LEVELER.SPELLS.SORT_ALPHA_DESC') },
    ].map((option) => ({
      ...option,
      selected: option.value === this.sortMode,
    }));
  }

  _toTemplateSpell(spell) {
    const alreadyTaken = this.excludeOwnedByIdentity && this._matchesOwnedSpellIdentity(spell, this._ownedIdentityKeys ?? new Set());
    return {
      uuid: spell.uuid ?? spell.sourceId ?? spell.flags?.core?.sourceId ?? '',
      name: spell.name ?? '',
      img: spell.img ?? '',
      system: spell.system ?? {},
      _levelerSelected: this.selectedSpellUuids.has(spell.uuid),
      alreadyTaken,
    };
  }

  _toSelectedTemplateSpell(spell, index) {
    const displayRank = Number(spell?.displayRank ?? spell?.rank ?? spell?.baseRank ?? spell?.system?.level?.value ?? 0);
    return {
      ...this._toTemplateSpell(spell),
      index,
      displayRank,
      displayRankLabel: displayRank > 0
        ? game.i18n.format('PF2E_LEVELER.SPELLS.RANK_NUMBER', { rank: displayRank })
        : null,
      canRemove: this.onRemoveSelected != null,
    };
  }

  async _removeSelectedSpell(index) {
    if (!this.onRemoveSelected || !Number.isInteger(index) || index < 0 || index >= this.selectedSpells.length) return;
    const spell = this.selectedSpells[index];
    await this.onRemoveSelected(spell, index);
    this.selectedSpells.splice(index, 1);
    this.selectedSpellUuids.delete(spell?.uuid);
    if (this.maxSelect != null) this.maxSelect += 1;
    await this.render(true);
  }

  _getSourceOptions() {
    const unique = new Map();
    for (const spell of this.allSpells) {
      const key = spell.sourcePackage ?? spell.sourcePack ?? null;
      if (!key) continue;
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          label: spell.sourcePackageLabel ?? key,
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

  _getRankOptions() {
    const ranks = [...new Set(this.allSpells.map((spell) => getSpellRank(spell.system ?? {})))].sort((a, b) => a - b);
    this._rankValues = ranks;
    this.selectedRanks = initializeSelectionSet(this.selectedRanks, ranks, {
      lockedValues: [...this.lockedRanks],
      defaultValues: [],
    });

    const visibleRanks = this.lockedRanks.size > 0
      ? ranks.filter((r) => this.lockedRanks.has(r))
      : ranks;

    return visibleRanks.map((rank) => ({
      value: rank,
      label: rank === 0
        ? game.i18n.localize('PF2E_LEVELER.SPELLS.CANTRIP')
        : game.i18n.format('PF2E_LEVELER.SPELLS.RANK_NUMBER', { rank }),
      selected: this.selectedRanks.has(rank),
      locked: this.lockedRanks.has(rank),
    }));
  }

  _getTraditionOptions() {
    const allTraditions = [...new Set(
      this.allSpells.flatMap((spell) => getSpellTraditions(spell.system ?? {})),
    )].sort((a, b) => a.localeCompare(b));

    const traditions = this.lockedTraditions.size > 0
      ? allTraditions.filter((t) => this.lockedTraditions.has(t))
      : allTraditions;

    this._traditionValues = allTraditions;
    this.selectedTraditions = initializeSelectionSet(this.selectedTraditions, allTraditions, {
      lockedValues: [...this.lockedTraditions],
      defaultValues: [],
    });

    return traditions.map((tradition) => ({
      value: tradition,
      label: getTraditionLabel(tradition),
      selected: this.selectedTraditions.has(tradition),
      locked: this.lockedTraditions.has(tradition),
    }));
  }

  _getRootElement() {
    const root = this.element;
    if (!root) return null;
    if (root.matches?.('.pf2e-leveler.spell-picker')) return root;
    return root.querySelector?.('.pf2e-leveler.spell-picker') ?? root;
  }

  _matchesOwnedSpellIdentity(spell, ownedIdentityKeys) {
    const keys = getSpellMatchKeys(spell);
    return keys.some((key) => ownedIdentityKeys.has(key));
  }

  _getCategoryOptions() {
    const categories = [...new Set(this.allSpells.map((spell) => normalizeSpellCategory(spell)))].sort((a, b) => a.localeCompare(b));
    this._categoryValues = categories;
    this.selectedCategories = initializeSelectionSet(this.selectedCategories, categories, {
      lockedValues: [...this.lockedCategories],
      defaultValues: [],
    });
    const labels = {
      spell: game.i18n.localize('PF2E_LEVELER.SPELLS.CATEGORY_SPELL'),
      cantrip: game.i18n.localize('PF2E_LEVELER.SPELLS.CATEGORY_CANTRIP'),
      focus: game.i18n.localize('PF2E_LEVELER.SPELLS.CATEGORY_FOCUS'),
      ritual: game.i18n.localize('PF2E_LEVELER.SPELLS.CATEGORY_RITUAL'),
    };

    const visibleCategories = this.lockedCategories.size > 0
      ? categories.filter((c) => this.lockedCategories.has(c))
      : categories;

    return buildChipOptions(visibleCategories, this.selectedCategories, { labels, lockedValues: [...this.lockedCategories] });
  }

  _getRarityLabels() {
    return {
      common: game.i18n.localize('PF2E.TraitCommon'),
      uncommon: game.i18n.localize('PF2E.TraitUncommon'),
      rare: game.i18n.localize('PF2E.TraitRare'),
      unique: game.i18n.localize('PF2E.TraitUnique'),
    };
  }

  _getLockedRarities() {
    const allowed = getAllowedRaritiesForCurrentUser();
    return ['common', 'uncommon', 'rare', 'unique'].filter((r) => !allowed.has(r) || this.lockedRarities.has(r));
  }

  _allSelected(selected, available) {
    return Array.isArray(available) && available.length > 0 && available.every((value) => selected.has(value));
  }

  _applyPreset(preset) {
    if (!preset || typeof preset !== 'object') return;
    if (Array.isArray(preset.selectedTraditions)) this.selectedTraditions = new Set(preset.selectedTraditions);
    if (Array.isArray(preset.selectedCategories)) this.selectedCategories = new Set(preset.selectedCategories);
    if (Array.isArray(preset.selectedRanks)) this.selectedRanks = new Set(preset.selectedRanks);
    if (Array.isArray(preset.lockedCategories)) this.lockedCategories = new Set(preset.lockedCategories.map((c) => String(c).toLowerCase()));
    if (Array.isArray(preset.lockedRanks)) this.lockedRanks = new Set(preset.lockedRanks);
    if (Array.isArray(preset.lockedTraditions)) this.lockedTraditions = new Set(preset.lockedTraditions.map((t) => String(t).toLowerCase()));
    if (Array.isArray(preset.selectedTraits)) this.selectedTraits = new Set(preset.selectedTraits.map((trait) => String(trait).toLowerCase()));
    if (Array.isArray(preset.selectedRarities)) this.selectedRarities = new Set(preset.selectedRarities.map((rarity) => String(rarity).toLowerCase()));
    if (Array.isArray(preset.lockedRarities)) this.lockedRarities = new Set(preset.lockedRarities.map((rarity) => String(rarity).toLowerCase()));
    if (typeof preset.traitLogic === 'string') this.traitLogic = preset.traitLogic.toLowerCase() === 'and' ? 'and' : 'or';
  }

  _updateAutocomplete(el, query) {
    const dropdown = el.querySelector('[data-role="trait-autocomplete"]');
    if (!dropdown) return;
    const q = query.trim().toLowerCase();
    if (!q) { this._closeAutocomplete(el); return; }
    const traits = (this._allTraitOptions ?? [])
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
        if (input) input.value = '';
        this.selectedTraits.add(li.dataset.trait);
        this._closeAutocomplete(el);
        this._scheduleListUpdate();
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
}

function dedupeSpellsByUuid(spells) {
  const seen = new Set();
  const results = [];

  for (const spell of spells ?? []) {
    const uuid = String(spell?.uuid ?? '');
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    results.push(spell);
  }

  return results;
}

function getOwnedSpells(actor) {
  const items = actor?.items?.filter?.((i) => i.type === 'spell')
    ?? actor?.items?.contents?.filter?.((i) => i.type === 'spell')
    ?? [];

  return items.map((spell) => ({
    uuid: spell.sourceId ?? spell.flags?.core?.sourceId ?? spell.uuid,
    rank: getSpellRank(spell.system ?? {}),
    keys: getSpellMatchKeys(spell),
  }));
}

function compareSpellName(a, b) {
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
}

function compareSpellRank(a, b) {
  return getSpellRank(a?.system ?? {}) - getSpellRank(b?.system ?? {});
}

function getSpellMatchKeys(spell) {
  const keys = new Set();
  const sourceId = spell?.sourceId ?? spell?.flags?.core?.sourceId ?? spell?.uuid ?? null;
  const slug = spell?.slug ?? spell?.system?.slug ?? null;
  const name = typeof spell?.name === 'string' ? spell.name.trim().toLowerCase() : null;

  if (sourceId) keys.add(`uuid:${sourceId}`);
  if (slug) keys.add(`slug:${slug}`);
  if (name) keys.add(`name:${name}`);

  return [...keys];
}

function getSpellRank(system) {
  return Number(
    system?.location?.heightenedLevel
    ?? system?.heightenedLevel
    ?? system?.level?.value
    ?? 0,
  );
}

function getSpellTraditions(system) {
  const traditions = system?.traits?.traditions ?? system?.traditions?.value ?? [];
  return [...new Set(
    traditions
      .map((tradition) => String(tradition ?? '').trim().toLowerCase())
      .filter(Boolean),
  )];
}

function getTraditionLabel(tradition) {
  const key = `PF2E.Trait${tradition.charAt(0).toUpperCase()}${tradition.slice(1)}`;
  return game.i18n?.has?.(key) ? game.i18n.localize(key) : tradition.charAt(0).toUpperCase() + tradition.slice(1);
}

export async function loadSpells() {
  const keys = getCompendiumKeysForCategory('spells');
  const worldSignature = getAllWorldItems()
    .filter((item) => item?.type === 'spell')
    .map((item) => String(item?.uuid ?? item?.id ?? ''))
    .filter(Boolean)
    .sort()
    .join('|');
  const signature = `${keys.join('|')}::${worldSignature}`;
  if (cachedSpells && cachedSpellSourceSignature === signature) return cachedSpells;

  const allDocs = [];
  for (const key of keys) {
    const compendium = game.packs.get(key);
    if (!compendium) continue;
    const docs = await compendium.getDocuments().catch(() => []);
    const sourcePackage = compendium.metadata?.packageName ?? compendium.metadata?.package ?? '';
    const sourcePackageLabel = getSourceOwnerLabel(sourcePackage);
    allDocs.push(...docs
      .filter((doc) => doc.type === 'spell')
      .filter((spell) => isRarityAllowedForCurrentUser(spell.system?.traits?.rarity ?? 'common'))
      .map((spell) => {
        spell.sourcePack = key;
        spell.sourcePackage = sourcePackage || key;
        spell.sourcePackageLabel = sourcePackageLabel || key;
        return spell;
      }));
  }

  const worldSourcePackage = 'world';
  const worldSourcePackageLabel = getWorldSourceLabel();
  allDocs.push(...getAllWorldItems()
    .filter((item) => item?.type === 'spell')
    .filter((spell) => isRarityAllowedForCurrentUser(spell.system?.traits?.rarity ?? 'common'))
    .map((spell) => {
      spell.sourcePack = spell.sourcePack ?? null;
      spell.sourcePackage = spell.sourcePackage ?? worldSourcePackage;
      spell.sourcePackageLabel = spell.sourcePackageLabel ?? worldSourcePackageLabel;
      return spell;
    }));

  cachedSpells = dedupeSpellDocuments(allDocs);
  cachedSpellSourceSignature = signature;
  for (const spell of cachedSpells) {
    spell._levelerSearchName = spell.name.toLowerCase();
  }
  return cachedSpells;
}

function dedupeSpellDocuments(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = spell?.uuid ?? spell?.id ?? null;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function clearSpellPickerCache() {
  cachedSpells = null;
  cachedSpellSourceSignature = '';
}

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

function getAllWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}

function getWorldSourceLabel() {
  return compactSourceOwnerLabel(game.world?.title ?? 'World');
}
