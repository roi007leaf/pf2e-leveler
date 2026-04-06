import { MODULE_ID } from '../constants.js';
import { getCompendiumKeysForCategory } from '../compendiums/catalog.js';
import { isRarityAllowedForCurrentUser } from '../access/player-content.js';
import { bindRarityToggles } from './shared/rarity-filters.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    this.excludedUuids = new Set(options.excludedUuids ?? []);
    this.excludedSelections = new Set((options.excludedSelections ?? []).map((entry) => `${entry.uuid}:${entry.rank}`));
    this.maxRank = Number.isInteger(options.maxRank) ? options.maxRank : null;
    this.allSpells = [];
    this.filteredSpells = [];
    this.selectedSpellUuids = new Set();
    this.selectedRanks = new Set();
    this.selectedTraditions = new Set();
    this.selectedSourcePackages = new Set();
    this._sourceFilterInitialized = false;
    this.searchText = '';
    this.sortMode = options.sortMode ?? this._getDefaultSortMode();
    this._updateListTimer = null;
    this._domListeners = null;
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
    const ownedIdentityKeys = new Set(
      ownedSpells.flatMap((spell) => spell.keys),
    );

    if (this.allSpells.length === 0) {
      const all = await loadSpells();
      this.allSpells = all.filter((s) => {
        if (!this._matchesTradition(s)) return false;
        if (this.excludeOwnedByIdentity && this._matchesOwnedSpellIdentity(s, ownedIdentityKeys)) return false;
        const isCantrip = s.system.traits?.value?.includes('cantrip');
        const spellRank = getSpellRank(s.system ?? {});
        if (this.isCantrip) return isCantrip;
        if (isCantrip) return false;
        if (this.rank === -1) {
          if (ownedSelections.has(`${s.uuid}:${spellRank}`) || this.excludedUuids.has(s.uuid)) return false;
          if (this.maxRank != null) return spellRank >= 1 && spellRank <= this.maxRank;
          return spellRank >= 1;
        }
        if (ownedSelections.has(`${s.uuid}:${this.rank}`) || this.excludedSelections.has(`${s.uuid}:${this.rank}`)) return false;
        if (this.exactRank) return spellRank === this.rank;
        return spellRank <= this.rank;
      });
    }

    this.filteredSpells = this._filterSpells();
    this._sortSpells(this.filteredSpells);
    const sourceOptions = this._getSourceOptions();
    const rankOptions = this._getRankOptions();
    const traditionOptions = this._getTraditionOptions();

    const allTraits = new Set();
    for (const spell of this.allSpells) {
      for (const trait of (spell.system?.traits?.value ?? [])) allTraits.add(trait);
    }

    return {
      spells: this.filteredSpells.map((spell) => this._toTemplateSpell(spell)),
      sourceOptions,
      rankOptions,
      traditionOptions,
      allVisibleSelected: this.filteredSpells.length > 0
        && this.filteredSpells.every((spell) => this.selectedSpellUuids.has(spell.uuid)),
      filteredCount: this.filteredSpells.length,
      traitOptions: [...allTraits].filter((trait) => trait !== 'cantrip').sort(),
      rank: this.rank,
      tradition: this.tradition,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedSpellUuids.size,
      sortMode: this.sortMode,
      sortOptions: this._getSortOptions(),
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
      if (traitInput) {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        const trait = traitInput.value.trim().toLowerCase();
        if (!trait) return;
        const chipsContainer = el.querySelector('.wizard-trait-chips[data-target="spells"]');
        traitInput.value = '';
        const chip = document.createElement('span');
        chip.className = 'wizard-trait-chip tag tag--info tag--tiny';
        chip.dataset.trait = trait;
        chip.innerHTML = `${trait} <i class="fa-solid fa-xmark"></i>`;
        chip.querySelector('i')?.addEventListener('click', () => {
          chip.remove();
          applyTraitFilter(el);
          this._updateResultCount();
          this._updateSelectionUI();
        });
        chipsContainer.appendChild(chip);
        applyTraitFilter(el);
        this._updateResultCount();
        this._updateSelectionUI();
      }
    }, { signal });

    bindRarityToggles(el, {
      toggleSelector: '[data-action="toggleRarity"]',
      itemSelector: '.spell-option[data-rarity]',
    });

    el.addEventListener('change', (e) => {
      const sortSelect = e.target.closest?.('[data-action="changeSort"]');
      if (sortSelect) {
        this.sortMode = sortSelect.value || this._getDefaultSortMode();
        this._scheduleListUpdate();
        return;
      }

      const toggle = e.target.closest?.('[data-action="toggleRarity"]');
      if (toggle) {
        applyTraitFilter(el);
        this._updateResultCount();
        this._updateSelectionUI();
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
        if (this.selectedSourcePackages.has(sourceKey)) {
          if (this.selectedSourcePackages.size > 1) this.selectedSourcePackages.delete(sourceKey);
        } else {
          this.selectedSourcePackages.add(sourceKey);
        }
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
        if (!Number.isFinite(rank)) return;
        if (this.selectedRanks.has(rank)) {
          if (this.selectedRanks.size > 1) this.selectedRanks.delete(rank);
        } else {
          this.selectedRanks.add(rank);
        }
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
        if (this.selectedTraditions.has(tradition)) {
          if (this.selectedTraditions.size > 1) this.selectedTraditions.delete(tradition);
        } else {
          this.selectedTraditions.add(tradition);
        }
        for (const chip of el.querySelectorAll('[data-action="toggleSpellTradition"]')) {
          const chipTradition = String(chip.dataset.tradition ?? '').trim().toLowerCase();
          chip.classList.toggle('selected', this.selectedTraditions.has(chipTradition));
        }
        this._scheduleListUpdate();
      }
    }, { signal });

    this._updateResultCount();
    this._updateSelectionUI();
  }

  _matchesTradition(spell) {
    if (this.tradition === 'any') return true;
    const traditions = spell.system.traits?.traditions ?? spell.system.traditions?.value ?? [];
    if (traditions.includes(this.tradition)) return true;
    const traits = spell.system.traits?.value ?? [];
    return traits.includes(this.tradition);
  }

  async _updateList() {
    this.filteredSpells = this._filterSpells();
    this._sortSpells(this.filteredSpells);

    const root = this._getRootElement();
    const listContainer = root?.querySelector('.spell-picker__list');
    if (!listContainer) return;

    const html = await renderTemplate(`modules/${MODULE_ID}/templates/spell-picker.hbs`, {
      spells: this.filteredSpells.map((spell) => this._toTemplateSpell(spell)),
      sourceOptions: this._getSourceOptions(),
      traditionOptions: this._getTraditionOptions(),
      allVisibleSelected: this.filteredSpells.length > 0
        && this.filteredSpells.every((spell) => this.selectedSpellUuids.has(spell.uuid)),
      filteredCount: this.filteredSpells.length,
      rank: this.rank,
      tradition: this.tradition,
      multiSelect: this.multiSelect,
      selectedCount: this.selectedSpellUuids.size,
      sortMode: this.sortMode,
      sortOptions: this._getSortOptions(),
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.spell-picker__list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }

    applyTraitFilter(root);
    this._updateResultCount();
    this._updateSelectionUI();
  }

  _filterSpells() {
    let spells = [...this.allSpells];
    if (this.selectedSourcePackages.size > 0) {
      spells = spells.filter((spell) => this.selectedSourcePackages.has(spell.sourcePackage ?? spell.sourcePack));
    }
    if (this.selectedTraditions.size > 0) {
      spells = spells.filter((spell) => {
        const traditions = getSpellTraditions(spell.system ?? {});
        return traditions.some((tradition) => this.selectedTraditions.has(tradition));
      });
    }
    if (this.selectedRanks.size > 0) {
      spells = spells.filter((spell) => this.selectedRanks.has(getSpellRank(spell.system ?? {})));
    }
    if (!this.searchText) return spells;
    return spells.filter((s) => (s._levelerSearchName ?? s.name.toLowerCase()).includes(this.searchText));
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
    const resultCount = el.querySelector('.feat-picker__results-count');
    if (resultCount) resultCount.textContent = String(visibleCount);
  }

  _getVisibleSpellOptions() {
    const el = this._getRootElement();
    if (!el) return [];
    return [...el.querySelectorAll('.spell-option')].filter((item) => item.style.display !== 'none');
  }

  _getVisibleSpellUuids() {
    return this._getVisibleSpellOptions()
      .map((item) => item.dataset.uuid)
      .filter((uuid) => typeof uuid === 'string' && uuid.length > 0);
  }

  _areAllVisibleSelected() {
    const visibleUuids = this._getVisibleSpellUuids();
    return visibleUuids.length > 0 && visibleUuids.every((uuid) => this.selectedSpellUuids.has(uuid));
  }

  _toggleSelectedSpell(uuid) {
    if (!uuid) return;
    if (this.selectedSpellUuids.has(uuid)) this.selectedSpellUuids.delete(uuid);
    else this.selectedSpellUuids.add(uuid);
  }

  _toggleSelectAllVisible() {
    const visibleUuids = this._getVisibleSpellUuids();
    if (visibleUuids.length === 0) return;

    const allVisibleSelected = visibleUuids.every((uuid) => this.selectedSpellUuids.has(uuid));
    for (const uuid of visibleUuids) {
      if (allVisibleSelected) this.selectedSpellUuids.delete(uuid);
      else this.selectedSpellUuids.add(uuid);
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

    for (const option of el.querySelectorAll('.spell-option')) {
      const uuid = option.dataset.uuid;
      const selected = this.selectedSpellUuids.has(uuid);
      option.classList.toggle('spell-option--selected', selected);
      const button = option.querySelector('[data-action="selectSpell"]');
      if (button) {
        button.classList.toggle('active', selected);
        button.textContent = selected
          ? game.i18n.localize('PF2E_LEVELER.UI.SELECTED')
          : game.i18n.localize('PF2E_LEVELER.SPELLS.SELECT');
      }
    }

    const count = this.selectedSpellUuids.size;
    const visibleCount = this._getVisibleSpellUuids().length;
    const allVisibleSelected = this._areAllVisibleSelected();
    const countEl = el.querySelector('.spell-picker__selected-count');
    if (countEl) {
      countEl.textContent = game.i18n.format('PF2E_LEVELER.SPELLS.SELECTED_COUNT', { count });
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
    return {
      uuid: spell.uuid ?? spell.sourceId ?? spell.flags?.core?.sourceId ?? '',
      name: spell.name ?? '',
      img: spell.img ?? '',
      system: spell.system ?? {},
      _levelerSelected: this.selectedSpellUuids.has(spell.uuid),
    };
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
    if (!this._sourceFilterInitialized) {
      this.selectedSourcePackages = new Set(options.map((entry) => entry.key));
      this._sourceFilterInitialized = true;
    }

    return options.map((entry) => ({
      ...entry,
      selected: this.selectedSourcePackages.has(entry.key),
    }));
  }

  _getRankOptions() {
    const ranks = [...new Set(this.allSpells.map((spell) => getSpellRank(spell.system ?? {})))].sort((a, b) => a - b);
    if (this.selectedRanks.size === 0) {
      this.selectedRanks = new Set(ranks);
    }

    return ranks.map((rank) => ({
      value: rank,
      label: rank === 0
        ? game.i18n.localize('PF2E_LEVELER.SPELLS.CANTRIP')
        : game.i18n.format('PF2E_LEVELER.SPELLS.RANK_NUMBER', { rank }),
      selected: this.selectedRanks.has(rank),
    }));
  }

  _getTraditionOptions() {
    const traditions = [...new Set(
      this.allSpells.flatMap((spell) => getSpellTraditions(spell.system ?? {})),
    )].sort((a, b) => a.localeCompare(b));

    if (this.selectedTraditions.size === 0) {
      this.selectedTraditions = new Set(traditions);
    } else {
      this.selectedTraditions = new Set(
        [...this.selectedTraditions].filter((tradition) => traditions.includes(tradition)),
      );
      if (this.selectedTraditions.size === 0) this.selectedTraditions = new Set(traditions);
    }

    return traditions.map((tradition) => ({
      value: tradition,
      label: getTraditionLabel(tradition),
      selected: this.selectedTraditions.has(tradition),
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

function applyTraitFilter(el) {
  const chips = [...el.querySelectorAll('.wizard-trait-chips[data-target="spells"] .wizard-trait-chip')].map((c) => c.dataset.trait);
  const showUncommon = el.querySelector('[data-action="toggleRarity"][data-rarity="uncommon"]')?.checked ?? true;
  const showRare = el.querySelector('[data-action="toggleRarity"][data-rarity="rare"]')?.checked ?? true;

  el.querySelectorAll('.spell-option').forEach((item) => {
    const traits = item.dataset.traits?.toLowerCase() ?? '';
    const rarity = item.dataset.rarity ?? 'common';
    const traitMatch = chips.length === 0 || chips.every((t) => traits.includes(t));
    const rarityMatch = (rarity !== 'uncommon' || showUncommon) && (rarity !== 'rare' || showRare);
    item.style.display = traitMatch && rarityMatch ? '' : 'none';
  });
}

async function loadSpells() {
  const keys = getCompendiumKeysForCategory('spells');
  const signature = keys.join('|');
  if (cachedSpells && cachedSpellSourceSignature === signature) return cachedSpells;

  const allDocs = [];
  for (const key of keys) {
    const compendium = game.packs.get(key);
    if (!compendium) continue;
    const docs = await compendium.getDocuments().catch(() => []);
    const sourcePackage = compendium.metadata?.packageName ?? compendium.metadata?.package ?? '';
    const sourcePackageLabel = getSourceOwnerLabel(sourcePackage);
    allDocs.push(...docs
      .filter((spell) => isRarityAllowedForCurrentUser(spell.system?.traits?.rarity ?? 'common'))
      .map((spell) => {
      spell.sourcePack = key;
      spell.sourcePackage = sourcePackage || key;
      spell.sourcePackageLabel = sourcePackageLabel || key;
      return spell;
    }));
  }

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
