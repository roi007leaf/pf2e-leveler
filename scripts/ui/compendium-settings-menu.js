import { MODULE_ID } from '../constants.js';
import {
  COMPENDIUM_CATEGORY_DEFINITIONS,
  discoverCompendiumsByCategory,
  getCompendiumCategoryKeys,
  getConfiguredCompendiumSelections,
  getDefaultCompendiumKeys,
} from '../compendiums/catalog.js';
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
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NAME');
  }

  async _prepareContext() {
    const configured = this._draftSelections ?? getConfiguredCompendiumSelections();
    if (!this._draftSelections) {
      this._draftSelections = foundry.utils.deepClone(configured);
    }
    const discovered = await discoverCompendiumsByCategory();
    const categoryKeys = getCompendiumCategoryKeys();
    if (!categoryKeys.includes(this.activeCategory)) {
      this.activeCategory = categoryKeys[0] ?? null;
    }

    return {
      intro: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.HINT'),
      builtInLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.BUILT_IN'),
      noPacksLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NO_PACKS'),
      packageLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.PACKAGE'),
      summaryLabel: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.SUMMARY'),
      categories: categoryKeys.map((category) => {
        const packs = (discovered[category] ?? []).map((pack) => ({
          ...pack,
          checked: pack.locked || (configured[category] ?? []).includes(pack.key),
        }));

        return {
          key: category,
          active: category === this.activeCategory,
          label: game.i18n.localize(COMPENDIUM_CATEGORY_DEFINITIONS[category].labelKey),
          defaultCount: getDefaultCompendiumKeys(category).length,
          selectedCount: packs.filter((pack) => pack.checked).length,
          customCount: packs.filter((pack) => !pack.locked && pack.checked).length,
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
    root?.querySelector('[data-action="save-compendiums"]')?.addEventListener('click', () => this._saveSelections());
    root?.querySelector('[data-action="close-compendiums"]')?.addEventListener('click', () => this.close());
  }

  async _saveSelections() {
    this._syncActiveCategorySelections();
    await game.settings.set(MODULE_ID, 'customCompendiums', this._draftSelections ?? {});
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

  _syncActiveCategorySelections() {
    if (!this.activeCategory) return;
    const root = this.element;
    const checked = Array.from(root?.querySelectorAll?.(`input[data-category="${this.activeCategory}"]:checked`) ?? []);
    const next = checked
      .filter((input) => input.dataset.locked !== 'true')
      .map((input) => input.dataset.pack)
      .filter(Boolean);

    if (!this._draftSelections) {
      this._draftSelections = getConfiguredCompendiumSelections();
    }

    this._draftSelections[this.activeCategory] = next;
  }
}
