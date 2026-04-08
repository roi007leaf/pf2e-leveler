import { MODULE_ID, SKILLS } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { getContentGuidance, invalidateGuidanceCache } from '../access/content-guidance.js';
import { getLanguageMap } from './character-wizard/skills-languages.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const GUIDANCE_CATEGORIES = [
  { key: 'ancestries', type: 'ancestry' },
  { key: 'heritages', type: 'heritage' },
  { key: 'backgrounds', type: 'background' },
  { key: 'classes', type: 'class' },
  { key: 'skills', type: null },
  { key: 'languages', type: null },
];

export class ContentGuidanceMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.activeCategory = 'ancestries';
    this.searchText = '';
    this._draft = null;
    this._itemCache = {};
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-content-guidance`,
    classes: ['pf2e-leveler', 'pf2e-leveler-compendium-app'],
    position: { width: 900, height: 720 },
    window: { resizable: true },
  };

  static PARTS = {
    settings: {
      template: `modules/${MODULE_ID}/templates/content-guidance-menu.hbs`,
    },
  };

  get title() {
    return game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.NAME');
  }

  async _prepareContext() {
    if (!this._draft) {
      this._draft = foundry.utils.deepClone(getContentGuidance());
    }

    const items = await this._loadCategoryItems(this.activeCategory);
    const query = this.searchText.toLowerCase();
    const filtered = query
      ? items.filter((item) => item.name.toLowerCase().includes(query))
      : items;

    const categories = GUIDANCE_CATEGORIES.map((cat) => {
      const label = game.i18n.localize(`PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.${cat.key.toUpperCase()}`);
      const count = Object.entries(this._draft).filter(([uuid]) => {
        const cached = this._findCachedItem(uuid);
        return cached?.categoryKey === cat.key;
      }).length;
      return {
        key: cat.key,
        label,
        active: cat.key === this.activeCategory,
        markedCount: count,
      };
    });

    const totalMarked = Object.keys(this._draft).length;

    return {
      categories,
      items: filtered.map((item) => ({
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        rarity: item.rarity ?? 'common',
        level: item.level ?? null,
        status: this._draft[item.uuid] ?? 'default',
        isRecommended: this._draft[item.uuid] === 'recommended',
        isDisallowed: this._draft[item.uuid] === 'disallowed',
      })),
      searchText: this.searchText,
      totalMarked,
      countLabel: game.i18n.format('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.COUNT', { count: totalMarked }),
      intro: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.INTRO'),
      searchPlaceholder: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.SEARCH'),
    };
  }

  _findCachedItem(uuid) {
    for (const [categoryKey, items] of Object.entries(this._itemCache)) {
      const found = items.find((item) => item.uuid === uuid);
      if (found) return { ...found, categoryKey };
    }
    return null;
  }

  async _loadCategoryItems(categoryKey) {
    if (this._itemCache[categoryKey]) return this._itemCache[categoryKey];

    const catDef = GUIDANCE_CATEGORIES.find((c) => c.key === categoryKey);
    if (!catDef) return [];

    if (categoryKey === 'skills') {
      const items = SKILLS.map((slug) => {
        const raw = globalThis.CONFIG?.PF2E?.skills?.[slug];
        const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
        const localized = game.i18n?.has?.(label) ? game.i18n.localize(label) : slug.charAt(0).toUpperCase() + slug.slice(1);
        return { uuid: `skill:${slug}`, name: localized, img: null, rarity: 'common', level: null };
      });
      this._itemCache[categoryKey] = items;
      return items;
    }

    if (categoryKey === 'languages') {
      const langMap = getLanguageMap();
      const items = Object.entries(langMap)
        .map(([slug, label]) => ({ uuid: `language:${slug}`, name: label, img: null, rarity: 'common', level: null }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this._itemCache[categoryKey] = items;
      return items;
    }

    const keys = getCompendiumKeysForCategory(catDef.key);
    const items = [];
    for (const key of keys) {
      const pack = game.packs.get(key);
      if (!pack) continue;
      const docs = await pack.getDocuments().catch(() => []);
      items.push(...docs
        .filter((doc) => doc.type === catDef.type)
        .map((doc) => ({
          uuid: doc.uuid,
          name: doc.name,
          img: doc.img,
          rarity: doc.system?.traits?.rarity ?? 'common',
          level: doc.system?.level?.value ?? null,
        })),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    this._itemCache[categoryKey] = items;
    return items;
  }

  _onRender() {
    const root = this.element;
    if (!root) return;

    root.querySelectorAll('[data-action="select-category"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        if (category && category !== this.activeCategory) {
          this.activeCategory = category;
          this.searchText = '';
          this.render(true);
        }
      });
    });

    root.querySelectorAll('[data-action="cycle-guidance"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uuid = btn.dataset.uuid;
        if (!uuid) return;
        const current = this._draft[uuid] ?? 'default';
        const next = current === 'default' ? 'recommended' : current === 'recommended' ? 'disallowed' : 'default';
        if (next === 'default') {
          delete this._draft[uuid];
        } else {
          this._draft[uuid] = next;
        }
        this.render(true);
      });
    });

    root.querySelector('[data-action="search-guidance"]')?.addEventListener('input', (e) => {
      this.searchText = e.target.value ?? '';
      this._updateListOnly();
    });

    root.querySelector('[data-action="save-guidance"]')?.addEventListener('click', () => this._save());
    root.querySelector('[data-action="close-guidance"]')?.addEventListener('click', () => this.close());

    root.querySelector('[data-action="clear-all-guidance"]')?.addEventListener('click', () => {
      this._draft = {};
      this.render(true);
    });
  }

  _updateListOnly() {
    const root = this.element;
    if (!root) return;
    const query = this.searchText.toLowerCase();
    root.querySelectorAll('.guidance-item').forEach((el) => {
      const name = el.querySelector('.guidance-item__name')?.textContent?.toLowerCase() ?? '';
      el.style.display = !query || name.includes(query) ? '' : 'none';
    });
  }

  async _save() {
    await game.settings.set(MODULE_ID, 'gmContentGuidance', this._draft ?? {});
    invalidateGuidanceCache();
    ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.SAVED'));
    this.close();
  }
}
