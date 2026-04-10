import { MODULE_ID } from '../constants.js';
import {
  COMPENDIUM_CATEGORY_DEFINITIONS,
  getCompendiumKeysForCategory,
  discoverCompendiumsByCategory,
  getCompendiumCategoryKeys,
  getVisibleCompendiumCategoryKeys,
  getConfiguredCompendiumSelections,
  getDefaultCompendiumKeys,
} from '../compendiums/catalog.js';
import { createDefaultPlayerCompendiumSelections } from '../access/player-content.js';
import { invalidateCache, loadFeats } from '../feats/feat-cache.js';
import { invalidateItemCache, loadItems } from './item-picker.js';
import { clearSpellPickerCache, loadSpells } from './spell-picker.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CompendiumSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.activeCategory = 'ancestries';
    this.viewMode = 'categories';
    this.packSearch = '';
    this._draftSelections = null;
    this._isSaving = false;
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
    const categoryKeys = getVisibleCompendiumCategoryKeys();
    if (!categoryKeys.includes(this.activeCategory)) {
      this.activeCategory = categoryKeys[0] ?? null;
    }

    const categoryLabels = Object.fromEntries(categoryKeys.map((category) => [
      category,
      game.i18n.localize(COMPENDIUM_CATEGORY_DEFINITIONS[category].labelKey),
    ]));
    const packMap = new Map();
    for (const [category, packs] of Object.entries(discovered)) {
      if (!categoryLabels[category]) continue;
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
        ].join(' ').toLowerCase(),
      }));

    const packMetadataLookup = new Map();
    for (const pack of game.packs?.values?.() ?? []) {
      const key = pack.collection ?? pack.metadata?.id ?? '';
      if (!key) continue;
      const packageName = pack.metadata?.packageName ?? pack.metadata?.package ?? '';
      packMetadataLookup.set(key, {
        key,
        label: pack.metadata?.label ?? pack.title ?? pack.collection ?? key,
        packageName,
        packageLabel: this._resolvePackageLabel(packageName),
        lockedCategories: new Set(
          Object.entries(COMPENDIUM_CATEGORY_DEFINITIONS)
            .filter(([, definition]) => (definition.defaultKeys ?? []).includes(key))
            .map(([category]) => category),
        ),
      });
    }

    return {
      isSaving: this._isSaving,
      titleText: this._getMenuTitle(),
      intro: this._getIntroText(),
      viewMode: this.viewMode,
      showViewModeTabs: this._showViewModeTabs(),
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
        const selectedKeys = configured[category] ?? [];
        const visibleKeys = this._getVisiblePackKeys(category, configured);
        const packs = visibleKeys.map((key) => {
          const discoveredPack = (discovered[category] ?? []).find((pack) => pack.key === key);
          const metadataPack = packMetadataLookup.get(key);
          const pack = discoveredPack ?? metadataPack ?? {
            key,
            label: key,
            packageName: '',
            packageLabel: '',
            lockedCategories: new Set(),
          };

          return {
            ...pack,
            checked: (pack.locked ?? pack.lockedCategories?.has?.(category) ?? false) || selectedKeys.includes(key),
            locked: pack.locked ?? pack.lockedCategories?.has?.(category) ?? false,
            enforced: this._isPackEnforced({
              ...pack,
              locked: pack.locked ?? pack.lockedCategories?.has?.(category) ?? false,
            }, category),
          };
        });

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
      input.addEventListener('change', () => this._onPackAssignmentChange(input));
    });
    root?.querySelector('[data-action="search-pack-assignments"]')?.addEventListener('input', (event) => {
      this._onPackSearchInput(event);
    });
    this._applyPackSearchFilter(root);
    root?.querySelector('[data-action="save-compendiums"]')?.addEventListener('click', () => this._saveSelections());
    root?.querySelector('[data-action="close-compendiums"]')?.addEventListener('click', () => this.close());
  }

  async _saveSelections() {
    if (this._isSaving) return;
    this._syncSelectionsFromDom();
    const nextSelections = this._serializeSelections(this._draftSelections ?? {});
    const currentSelections = this._serializeSelections(this._getConfiguredSelections());
    if (JSON.stringify(nextSelections) === JSON.stringify(currentSelections)) {
      ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SAVED'));
      this.close();
      return;
    }
    this._isSaving = true;
    this.render(false);
    await new Promise((resolve) => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
    try {
      await game.settings.set(MODULE_ID, this._getSettingKey(), nextSelections);
      invalidateCache();
      invalidateItemCache();
      clearSpellPickerCache();
      await Promise.allSettled([
        loadFeats(),
        loadItems(),
        loadSpells(),
      ]);
      ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SAVED'));
      this.close();
    } finally {
      this._isSaving = false;
      if (this.rendered) this.render(false);
    }
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

  _onPackAssignmentChange(input) {
    this._syncSelectionsFromDom();
    this._updatePackAssignmentChipState(input);
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

  _updatePackAssignmentChipState(input) {
    if (!input) return;
    const chip = input.closest('.compendium-assignment__chip');
    if (!chip) return;
    chip.classList.toggle('is-selected', input.checked);
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

  _getVisiblePackKeys(category, configuredSelections = {}) {
    const selectedKeys = configuredSelections[category] ?? [];
    return [...new Set([
      ...getDefaultCompendiumKeys(category),
      ...selectedKeys,
    ])];
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

  _showViewModeTabs() {
    return true;
  }

  _resolvePackageLabel(packageName) {
    if (!packageName) return '';
    if (game.system?.id === packageName) return game.system.title ?? packageName;
    return game.modules?.get?.(packageName)?.title ?? packageName;
  }
}

export class PlayerCompendiumAccessMenu extends CompendiumSettingsMenu {
  constructor(options = {}) {
    super(options);
    this.viewMode = 'categories';
  }

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

  _getVisiblePackKeys(category) {
    return [...new Set([
      ...getDefaultCompendiumKeys(category),
      ...(getConfiguredCompendiumSelections()[category] ?? []),
    ])];
  }

  _showViewModeTabs() {
    return false;
  }
}
