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
    const discovered = await discoverCompendiumsByCategory();
    const categoryKeys = getCompendiumCategoryKeys();
    if (!categoryKeys.includes(this.activeCategory)) {
      this.activeCategory = categoryKeys[0] ?? null;
    }

    return {
      titleText: this._getMenuTitle(),
      intro: this._getIntroText(),
      allLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.ALL'),
      deselectAllLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.DESELECT_ALL'),
      allDisabledLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.ALL_DISABLED'),
      builtInLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.BUILT_IN'),
      noPacksLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NO_PACKS'),
      packageLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACKAGE'),
      summaryLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SUMMARY'),
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
    root?.querySelector('[data-action="save-compendiums"]')?.addEventListener('click', () => this._saveSelections());
    root?.querySelector('[data-action="close-compendiums"]')?.addEventListener('click', () => this.close());
  }

  async _saveSelections() {
    this._syncActiveCategorySelections();
    await game.settings.set(MODULE_ID, this._getSettingKey(), this._serializeSelections(this._draftSelections ?? {}));
    invalidateCache();
    ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SAVED'));
    this.close();
  }

  _setActiveCategory(category) {
    if (!category || category === this.activeCategory) return;
    this._syncActiveCategorySelections();
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
      this._syncActiveCategorySelections();
      this.activeCategory = category;
    } else {
      this._syncActiveCategorySelections();
    }
    this.render(true);
  }

  _toggleAllInCategory(category = this.activeCategory) {
    if (!category) return;
    if (category !== this.activeCategory) {
      this._syncActiveCategorySelections();
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

    this._syncActiveCategorySelections();
    this.render(true);
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
