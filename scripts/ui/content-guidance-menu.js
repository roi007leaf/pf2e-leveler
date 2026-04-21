import { MODULE_ID, SKILLS } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import {
  getContentGuidance,
  getSourceGuidanceKey,
  invalidateGuidanceCache,
} from '../access/content-guidance.js';
import { getLanguageMap, getLanguageRarityMap } from './character-wizard/skills-languages.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const GUIDANCE_CATEGORIES = [
  { key: 'ancestries', type: 'ancestry' },
  { key: 'heritages', type: 'heritage' },
  { key: 'backgrounds', type: 'background' },
  { key: 'classes', type: 'class' },
  { key: 'sources', type: null, labelKey: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.SOURCES' },
  { key: 'skills', type: null },
  { key: 'languages', type: null },
];

const BULK_GUIDANCE_STATES = ['recommended', 'not-recommended', 'disallowed', 'default'];
const SOURCE_SCAN_CATEGORIES = [
  ['ancestries', (doc) => doc.type === 'ancestry'],
  ['heritages', (doc) => doc.type === 'heritage'],
  ['backgrounds', (doc) => doc.type === 'background'],
  ['classes', (doc) => doc.type === 'class'],
  ['feats', (doc) => doc.type === 'feat'],
  ['spells', (doc) => doc.type === 'spell'],
  ['equipment', (doc) => ['weapon', 'armor', 'equipment', 'consumable', 'ammo', 'treasure', 'backpack', 'shield', 'kit'].includes(String(doc?.type ?? '').toLowerCase())],
  ['actions', (doc) => doc.type === 'action'],
  ['deities', (doc) => doc.type === 'deity'],
];

export class ContentGuidanceMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.activeCategory = 'ancestries';
    this.searchText = '';
    this._draft = null;
    this._itemCache = {};
    this._pendingScrollTop = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-content-guidance`,
    classes: ['pf2e-leveler', 'pf2e-leveler-compendium-app'],
    position: { width: 980, height: 760 },
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
      const label = game.i18n.localize(cat.labelKey ?? `PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.${cat.key.toUpperCase()}`);
      const count = Object.entries(this._draft).filter(([uuid]) => {
        if (cat.key === 'sources') return String(uuid).startsWith('source-title:');
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

    const displayItems = filtered.map((item) => {
      const resolved = this._resolveDraftStatus(item);
      return {
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      ancestrySlug: item.ancestrySlug ?? null,
      ancestryLabel: item.ancestryLabel ?? null,
      publicationTitle: item.publicationTitle ?? null,
      openable: typeof item.uuid === 'string' && item.uuid.startsWith('Compendium.'),
      rarity: item.rarity ?? 'common',
      level: item.level ?? null,
      matchedCount: item.matchedCount ?? null,
      categorySummary: item.categorySummary ?? null,
      status: resolved.status ?? 'default',
      isRecommended: resolved.status === 'recommended',
      isNotRecommended: resolved.status === 'not-recommended',
      isDisallowed: resolved.status === 'disallowed',
      guidanceInherited: resolved.inherited,
    };
    });

    return {
      categories,
      primaryCategories: categories.filter((category) => category.key !== 'sources'),
      secondaryCategories: categories.filter((category) => category.key === 'sources'),
      items: displayItems,
      useGridLayout: this.activeCategory !== 'heritages',
      searchText: this.searchText,
      totalMarked,
      countLabel: game.i18n.format('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.COUNT', { count: totalMarked }),
      intro: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.INTRO'),
      searchPlaceholder: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.SEARCH'),
      rarityBulkGroups: this._buildRarityBulkGroups(items),
      groupedItems: this.activeCategory === 'heritages' ? this._buildHeritageGroups(displayItems) : null,
    };
  }

  _findCachedItem(uuid) {
    for (const [categoryKey, items] of Object.entries(this._itemCache)) {
      if (!Array.isArray(items)) continue;
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
      const rarityMap = getLanguageRarityMap();
      const langMap = getLanguageMap();
      const items = Object.entries(langMap)
        .map(([slug, label]) => ({ uuid: `language:${slug}`, name: label, img: null, rarity: rarityMap[slug] ?? 'common', level: null }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this._itemCache[categoryKey] = items;
      return items;
    }

    if (categoryKey === 'sources') {
      const items = await this._loadSourceItems();
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
          ancestrySlug: doc.system?.ancestry?.slug ?? null,
          publicationTitle: doc.system?.publication?.title ?? null,
        })),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    if (categoryKey === 'heritages') {
      const ancestryLabels = await this._loadAncestryLabels();
      for (const item of items) {
        item.ancestryLabel = ancestryLabels.get(item.ancestrySlug ?? '') ?? humanizeSlug(item.ancestrySlug) ?? null;
      }
    }
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
          this._rerenderPreservingScroll({ resetScroll: true });
        }
      });
    });

    root.querySelectorAll('[data-action="cycle-guidance"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uuid = btn.dataset.uuid;
        if (!uuid) return;
        const current = this._draft[uuid] ?? 'default';
        const next = current === 'default'
          ? 'recommended'
          : current === 'recommended'
            ? 'not-recommended'
            : current === 'not-recommended'
              ? 'disallowed'
              : 'default';
        if (next === 'default') {
          delete this._draft[uuid];
        } else {
          this._draft[uuid] = next;
        }
        this._rerenderPreservingScroll();
      });
    });

    root.querySelectorAll('[data-action="viewGuidanceItem"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.dataset.uuid;
        if (!uuid || !uuid.startsWith('Compendium.')) return;
        const item = await fromUuid(uuid).catch(() => null);
        item?.sheet?.render?.(true);
      });
    });

    root.querySelectorAll('[data-action="bulk-guidance"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.status;
        const scopeType = btn.dataset.scopeType;
        const scopeValue = btn.dataset.scopeValue;
        if (!BULK_GUIDANCE_STATES.includes(status) || !scopeType || !scopeValue) return;
        this._applyBulkGuidance(scopeType, scopeValue, status);
        this._rerenderPreservingScroll();
      });
    });

    root.querySelector('[data-action="search-guidance"]')?.addEventListener('input', (e) => {
      this.searchText = e.target.value ?? '';
      this._rerenderPreservingScroll();
    });

    root.querySelector('[data-action="save-guidance"]')?.addEventListener('click', () => this._save());
    root.querySelector('[data-action="close-guidance"]')?.addEventListener('click', () => this.close());

    root.querySelector('[data-action="clear-all-guidance"]')?.addEventListener('click', () => {
      for (const [uuid] of Object.entries(this._draft ?? {})) {
        if (this.activeCategory === 'sources' && String(uuid).startsWith('source-title:')) {
          delete this._draft[uuid];
          continue;
        }
        const cached = this._findCachedItem(uuid);
        if (cached?.categoryKey === this.activeCategory) delete this._draft[uuid];
      }
      this._rerenderPreservingScroll();
    });

    this._restoreScrollPosition();
  }

  async _save() {
    await game.settings.set(MODULE_ID, 'gmContentGuidance', this._draft ?? {});
    invalidateGuidanceCache();
    ui.notifications.info(game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.SAVED'));
    this.close();
  }

  _applyBulkGuidance(scopeType, scopeValue, status) {
    const items = this._itemCache[this.activeCategory] ?? [];
    const uuids = items
      .filter((item) => this._matchesBulkScope(item, scopeType, scopeValue))
      .map((item) => item.uuid);

    for (const uuid of uuids) {
      if (status === 'default') {
        delete this._draft[uuid];
      } else {
        this._draft[uuid] = status;
      }
    }
  }

  _matchesBulkScope(item, scopeType, scopeValue) {
    if (!item) return false;
    if (scopeType === 'rarity') {
      return String(item.rarity ?? 'common').toLowerCase() === scopeValue;
    }
    if (scopeType === 'ancestry') {
      const ancestrySlug = String(item.ancestrySlug ?? '').toLowerCase();
      return scopeValue === 'versatile' ? !ancestrySlug : ancestrySlug === scopeValue;
    }
    return false;
  }

  _resolveDraftStatus(item) {
    const direct = item?.uuid ? (this._draft?.[item.uuid] ?? null) : null;
    if (direct) return { status: direct, inherited: false };

    const sourceKey = getSourceGuidanceKey(item?.publicationTitle ?? item?.name ?? '');
    const inherited = sourceKey ? (this._draft?.[sourceKey] ?? null) : null;
    if (inherited) return { status: inherited, inherited: item?.uuid !== sourceKey };

    return { status: null, inherited: false };
  }

  async _loadSourceItems() {
    const aggregated = new Map();

    for (const [categoryKey, matcher] of SOURCE_SCAN_CATEGORIES) {
      const docs = await this._loadSourceDocumentsForCategory(categoryKey, matcher);
      for (const doc of docs) {
        const title = String(doc?.system?.publication?.title ?? '').trim();
        if (!title) continue;
        const sourceKey = getSourceGuidanceKey(title);
        if (!sourceKey) continue;
        if (!aggregated.has(sourceKey)) {
          aggregated.set(sourceKey, {
            uuid: sourceKey,
            name: title,
            img: null,
            rarity: 'common',
            level: null,
            publicationTitle: title,
            matchedCount: 0,
            categories: new Set(),
          });
        }
        const entry = aggregated.get(sourceKey);
        entry.matchedCount += 1;
        entry.categories.add(categoryKey);
      }
    }

    return [...aggregated.values()]
      .map((entry) => ({
        ...entry,
        categorySummary: [...entry.categories]
          .map((categoryKey) => game.i18n.localize(`PF2E_LEVELER.SETTINGS.COMPENDIUM_CATEGORIES.${categoryKey.toUpperCase()}`))
          .join(', '),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async _loadSourceDocumentsForCategory(categoryKey, matcher) {
    const items = [];
    for (const key of getCompendiumKeysForCategory(categoryKey)) {
      const pack = game.packs.get(key);
      if (!pack) continue;
      const docs = await pack.getDocuments().catch(() => []);
      items.push(...docs.filter((doc) => matcher(doc)));
    }
    items.push(...getAllWorldItems().filter((doc) => matcher(doc)));
    return items;
  }

  async _loadAncestryLabels() {
    const cacheKey = '__guidanceAncestryLabels';
    if (this._itemCache[cacheKey]) return this._itemCache[cacheKey];

    const map = new Map();
    for (const key of getCompendiumKeysForCategory('ancestries')) {
      const pack = game.packs.get(key);
      if (!pack) continue;
      const docs = await pack.getDocuments().catch(() => []);
      for (const doc of docs) {
        if (doc.type !== 'ancestry') continue;
        const slug = String(doc.slug ?? doc.system?.slug ?? '').toLowerCase();
        if (!slug) continue;
        map.set(slug, doc.name);
      }
    }

    this._itemCache[cacheKey] = map;
    return map;
  }

  _buildHeritageGroups(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.ancestrySlug ? `ancestry:${item.ancestrySlug}` : 'versatile';
      const label = item.ancestrySlug
        ? (item.ancestryLabel ?? humanizeSlug(item.ancestrySlug) ?? item.name)
        : (game.i18n.localize('PF2E_LEVELER.CREATION.HERITAGE_GROUP_VERSATILE') || 'Versatile');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          items: [],
          bulkScopeType: 'ancestry',
          bulkScopeValue: item.ancestrySlug ? String(item.ancestrySlug).toLowerCase() : 'versatile',
          bulkActions: this._buildBulkActions(),
        });
      }
      groups.get(key).items.push(item);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  _buildRarityBulkGroups(items) {
    const raritySet = new Set(items.map((item) => String(item.rarity ?? 'common').toLowerCase()));
    const rarities = ['common', 'uncommon', 'rare', 'unique'].filter((rarity) => raritySet.has(rarity));
    return rarities.map((rarity) => ({
      label: humanizeSlug(rarity),
      scopeType: 'rarity',
      scopeValue: rarity,
      actions: this._buildBulkActions(),
    }));
  }

  _buildBulkActions() {
    return BULK_GUIDANCE_STATES.map((status) => ({
      status,
      label: game.i18n.localize(`PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BULK_${status.replace(/-/g, '_').toUpperCase()}`),
      className: this._getBulkActionClass(status),
    }));
  }

  _getBulkActionClass(status) {
    if (status === 'recommended') return 'tag--recommended';
    if (status === 'not-recommended') return 'tag--muted';
    if (status === 'disallowed') return 'tag--disallowed';
    return '';
  }

  _getScrollContainer() {
    return this.element?.querySelector?.('.compendium-manager__panelWrap')
      ?? this.element?.closest?.('.window-content')
      ?? null;
  }

  _rerenderPreservingScroll({ resetScroll = false } = {}) {
    const container = this._getScrollContainer();
    this._pendingScrollTop = resetScroll ? 0 : (container?.scrollTop ?? 0);
    this.render(true);
  }

  _restoreScrollPosition() {
    if (this._pendingScrollTop == null) return;
    const container = this._getScrollContainer();
    if (container) container.scrollTop = this._pendingScrollTop;
    this._pendingScrollTop = null;
  }
}

function humanizeSlug(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAllWorldItems() {
  if (!game.items) return [];
  if (Array.isArray(game.items)) return [...game.items];
  if (Array.isArray(game.items.contents)) return [...game.items.contents];
  if (typeof game.items.filter === 'function') return game.items.filter(() => true);
  return Array.from(game.items);
}
