import { MODULE_ID } from '../constants.js';
import {
  COMPENDIUM_CATEGORY_DEFINITIONS,
  getCompendiumKeysForCategory,
  discoverCompendiumsByCategory,
  getCompendiumCategoryKeys,
  getConfiguredCompendiumSelections,
  getDefaultCompendiumKeys,
} from '../compendiums/catalog.js';
import { createDefaultPlayerCompendiumSelections } from '../access/player-content.js';
import { invalidateCache } from '../feats/feat-cache.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CompendiumSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.activeCategory = 'ancestries';
    this.viewMode = 'categories';
    this.packSearch = '';
    this._draftSelections = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-compendium-settings`,
    classes: ['pf2e-leveler', 'pf2e-leveler-compendium-app'],
    position: { width: 860, height: 720 },
    window: { resizable: true },
  };

  static PARTS = {
    settings: {
      template: `modules/${MODULE_ID}/templates/compendium-settings.hbs`,
    },
  };

  get title() {
    return this._getMenuTitle();
  }

  async _prepareContext() {
    const configured = this._draftSelections ?? this._getConfiguredSelections();
    if (!this._draftSelections) {
      this._draftSelections = foundry.utils.deepClone(configured);
    }
    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });
    const categoryKeys = getCompendiumCategoryKeys();
    if (!categoryKeys.includes(this.activeCategory)) {
      this.activeCategory = categoryKeys[0] ?? null;
    }

    const categoryLabels = Object.fromEntries(categoryKeys.map((category) => [
      category,
      game.i18n.localize(COMPENDIUM_CATEGORY_DEFINITIONS[category].labelKey),
    ]));
    const packMap = new Map();
    for (const [category, packs] of Object.entries(discovered)) {
      for (const pack of packs ?? []) {
        if (!packMap.has(pack.key)) {
          packMap.set(pack.key, {
            key: pack.key,
            label: pack.label,
            packageName: pack.packageName,
            packageLabel: pack.packageLabel,
            packageAuthors: pack.packageAuthors,
            categories: [],
          });
        }

        packMap.get(pack.key).categories.push({
          key: category,
          label: categoryLabels[category],
          selected: pack.locked || (configured[category] ?? []).includes(pack.key),
          enforced: this._isPackEnforced(pack, category),
          autoDetected: !pack.manualCandidate,
        });
      }
    }

    const packRows = [...packMap.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((pack) => ({
        ...pack,
        categoryCount: pack.categories.filter((category) => category.selected).length,
        categories: pack.categories.sort((a, b) => a.label.localeCompare(b.label)),
        searchText: [
          pack.label,
          pack.key,
          pack.packageLabel,
          pack.packageName,
          pack.packageAuthors,
          ...pack.categories.map((category) => category.label),
        ].join(' ').toLowerCase(),
      }));

    return {
      titleText: this._getMenuTitle(),
      intro: this._getIntroText(),
      viewMode: this.viewMode,
      isPackView: this.viewMode === 'packs',
      isCategoryView: this.viewMode !== 'packs',
      categoriesViewLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.CATEGORIES_VIEW'),
      packsViewLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACK_ASSIGNMENTS_VIEW'),
      packAssignmentsTitle: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACK_ASSIGNMENTS_TITLE'),
      packAssignmentsHint: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACK_ASSIGNMENTS_HINT'),
      packSearch: this.packSearch,
      packSearchPlaceholder: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACK_SEARCH_PLACEHOLDER'),
      categoryColumnLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.CATEGORY_COLUMN'),
      sourceColumnLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SOURCE_COLUMN'),
      autoDetectedLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.AUTO_DETECTED'),
      noPackAssignmentsLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NO_PACK_ASSIGNMENTS'),
      allLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.ALL'),
      deselectAllLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.DESELECT_ALL'),
      allDisabledLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.ALL_DISABLED'),
      builtInLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.BUILT_IN'),
      noPacksLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NO_PACKS'),
      packageLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACKAGE'),
      summaryLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SUMMARY'),
      packRows,
      categories: categoryKeys.map((category) => {
        const packs = (discovered[category] ?? []).map((pack) => ({
          ...pack,
          checked: pack.locked || (configured[category] ?? []).includes(pack.key),
          enforced: this._isPackEnforced(pack, category),
        }));

        return {
          key: category,
          active: category === this.activeCategory,
          label: game.i18n.localize(COMPENDIUM_CATEGORY_DEFINITIONS[category].labelKey),
          defaultCount: getDefaultCompendiumKeys(category).length,
          selectedCount: packs.filter((pack) => pack.checked).length,
          customCount: packs.filter((pack) => !pack.enforced && pack.checked).length,
          hasSelectablePacks: packs.some((pack) => !pack.enforced),
          allSelected: packs.every((pack) => pack.enforced || pack.checked),
          packs,
        };
      }),
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    root?.querySelectorAll?.('[data-action="select-view-mode"]').forEach((button) => {
      button.addEventListener('click', () => this._setViewMode(button.dataset.viewMode));
    });
    root?.querySelectorAll?.('[data-action="select-category"]').forEach((button) => {
      button.addEventListener('click', () => this._setActiveCategory(button.dataset.category));
    });
    root?.querySelectorAll?.('[data-action="open-compendium"]').forEach((button) => {
      button.addEventListener('click', () => this._openCompendium(button.dataset.pack));
    });
    root?.querySelectorAll?.('[data-action="toggle-all-compendiums"]').forEach((button) => {
      button.addEventListener('click', () => this._toggleAllInCategory(button.dataset.category));
    });
    root?.querySelectorAll?.('.compendium-pack__check').forEach((input) => {
      input.addEventListener('change', () => this._onPackSelectionChange(input.dataset.category));
    });
    root?.querySelectorAll?.('.compendium-assignment__check').forEach((input) => {
      input.addEventListener('change', () => this._onPackAssignmentChange());
    });
    root?.querySelector('[data-action="search-pack-assignments"]')?.addEventListener('input', (event) => {
      this._onPackSearchInput(event);
    });
    this._applyPackSearchFilter(root);
    root?.querySelector('[data-action="save-compendiums"]')?.addEventListener('click', () => this._saveSelections());
    root?.querySelector('[data-action="close-compendiums"]')?.addEventListener('click', () => this.close());
  }

  async _saveSelections() {
    this._syncSelectionsFromDom();
    await game.settings.set(MODULE_ID, this._getSettingKey(), this._serializeSelections(this._draftSelections ?? {}));
    invalidateCache();
    ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SAVED'));
    this.close();
  }

  _setViewMode(viewMode) {
    if (!viewMode || viewMode === this.viewMode) return;
    this._syncSelectionsFromDom();
    this.viewMode = viewMode;
    this.render(true);
  }

  _setActiveCategory(category) {
    if (!category || category === this.activeCategory) return;
    this._syncSelectionsFromDom();
    this.activeCategory = category;
    this.render(true);
  }

  _openCompendium(packKey) {
    const pack = game.packs.get(packKey);
    if (!pack) return;
    if (typeof pack.render === 'function') {
      pack.render(true);
      return;
    }
    pack.apps?.forEach?.((app) => app.render?.(true));
  }

  _onPackSelectionChange(category) {
    if (!category) return;
    if (category !== this.activeCategory) {
      this._syncSelectionsFromDom();
      this.activeCategory = category;
    } else {
      this._syncSelectionsFromDom();
    }
    this.render(true);
  }

  _onPackAssignmentChange() {
    this._syncSelectionsFromDom();
    this.render(true);
  }

  _onPackSearchInput(event) {
    this.packSearch = String(event?.currentTarget?.value ?? '');
    this._applyPackSearchFilter(this.element);
  }

  _toggleAllInCategory(category = this.activeCategory) {
    if (!category) return;
    if (category !== this.activeCategory) {
      this._syncSelectionsFromDom();
      this.activeCategory = category;
      this.render(true);
      return;
    }

    const root = this.element;
    const inputs = Array.from(root?.querySelectorAll?.(`input[data-category="${category}"]`) ?? []);
    const selectableInputs = inputs.filter((input) => input.dataset.locked !== 'true');
    const shouldSelectAll = selectableInputs.some((input) => !input.checked);
    let changed = false;

    for (const input of selectableInputs) {
      if (input.checked === shouldSelectAll) continue;
      input.checked = shouldSelectAll;
      changed = true;
    }

    if (!changed) return;

    this._syncSelectionsFromDom();
    this.render(true);
  }

  _syncSelectionsFromDom() {
    if (this.viewMode === 'packs') {
      this._syncPackAssignmentSelections();
      return;
    }
    this._syncActiveCategorySelections();
  }

  _syncActiveCategorySelections() {
    if (!this.activeCategory) return;
    const root = this.element;
    const checked = Array.from(root?.querySelectorAll?.(`input[data-category="${this.activeCategory}"]:checked`) ?? []);
    const next = checked
      .filter((input) => input.dataset.locked !== 'true')
      .map((input) => input.dataset.pack)
      .filter(Boolean);

    if (!this._draftSelections) this._draftSelections = this._getConfiguredSelections();

    this._draftSelections[this.activeCategory] = next;
  }

  _syncPackAssignmentSelections() {
    const root = this.element;
    const inputs = Array.from(root?.querySelectorAll?.('.compendium-assignment__check') ?? []);
    if (!this._draftSelections) this._draftSelections = this._getConfiguredSelections();

    for (const category of getCompendiumCategoryKeys()) {
      this._draftSelections[category] = [];
    }

    for (const input of inputs) {
      const category = input.dataset.category;
      const pack = input.dataset.pack;
      if (!category || !pack || input.dataset.locked === 'true' || !input.checked) continue;
      this._draftSelections[category].push(pack);
    }
  }

  _applyPackSearchFilter(root = this.element) {
    if (!root || this.viewMode !== 'packs') return;
    const needle = this.packSearch.trim().toLowerCase();
    const rows = Array.from(root.querySelectorAll('.compendium-assignment'));
    let visibleCount = 0;

    for (const row of rows) {
      const haystack = String(row.dataset.searchText ?? '').toLowerCase();
      const matches = !needle || haystack.includes(needle);
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    }

    const empty = root.querySelector('[data-pack-empty-state]');
    if (empty) empty.hidden = visibleCount > 0;
  }

  _getSettingKey() {
    return 'customCompendiums';
  }

  _getMenuTitle() {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NAME');
  }

  _getConfiguredSelections() {
    return getConfiguredCompendiumSelections();
  }

  _getIntroText() {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.HINT');
  }

  _serializeSelections(selections) {
    return selections;
  }

  _isPackEnforced(pack) {
    return !!pack.locked;
  }
}

export class PlayerCompendiumAccessMenu extends CompendiumSettingsMenu {
  _getSettingKey() {
    return 'playerCompendiumAccess';
  }

  _getMenuTitle() {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.NAME');
  }

  _getConfiguredSelections() {
    const current = game.settings.get(MODULE_ID, this._getSettingKey());
    if (current?.enabled && current?.selections) return current.selections;

    const seeded = {};
    for (const category of getCompendiumCategoryKeys()) {
      seeded[category] = getCompendiumKeysForCategory(category, { includeDefaults: true });
    }
    return createDefaultPlayerCompendiumSelections(seeded);
  }

  _getIntroText() {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.HINT');
  }

  _serializeSelections(selections) {
    return {
      enabled: true,
      selections,
    };
  }

  _isPackEnforced() {
    return false;
  }
}
