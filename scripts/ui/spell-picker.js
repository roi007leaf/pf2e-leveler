import { MODULE_ID } from '../constants.js';
import { bindRarityToggles } from './shared/rarity-filters.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let cachedSpells = null;

export class SpellPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, tradition, rank, onSelect, options = {}) {
    super();
    this.actor = actor;
    this.tradition = tradition;
    this.rank = rank;
    this.isCantrip = rank === 0;
    this.onSelect = onSelect;
    this.excludedUuids = new Set(options.excludedUuids ?? []);
    this.maxRank = Number.isInteger(options.maxRank) ? options.maxRank : null;
    this.allSpells = [];
    this.filteredSpells = [];
    this.searchText = '';
    this._updateListTimer = null;
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-spell-picker',
    classes: ['pf2e-leveler'],
    position: { width: 650, height: 550 },
    window: { resizable: true },
  };

  static PARTS = {
    picker: {
      template: `modules/${MODULE_ID}/templates/spell-picker.hbs`,
    },
  };

  get title() {
    if (this.isCantrip) return `${this.actor.name} — Cantrips`;
    if (this.rank === -1) return `${this.actor.name} — ${this._capitalize(this.tradition)} Spellbook`;
    const ordinal = this._ordinal(this.rank);
    return `${this.actor.name} — ${ordinal}-Rank ${this._capitalize(this.tradition)} Spells`;
  }

  async _prepareContext() {
    const ownedUuids = new Set(
      (this.actor.items ?? [])
        .filter((i) => i.type === 'spell')
        .map((i) => i.sourceId ?? i.flags?.core?.sourceId ?? i.uuid),
    );

    if (this.allSpells.length === 0) {
      const all = await loadSpells();
      this.allSpells = all.filter((s) => {
        if (!this._matchesTradition(s)) return false;
        if (ownedUuids.has(s.uuid) || this.excludedUuids.has(s.uuid)) return false;
        const isCantrip = s.system.traits?.value?.includes('cantrip');
        if (this.isCantrip) return isCantrip;
        if (isCantrip) return false;
        if (this.rank === -1) {
          if (this.maxRank != null) return s.system.level.value >= 1 && s.system.level.value <= this.maxRank;
          return s.system.level.value >= 1;
        }
        return s.system.level.value === this.rank;
      });
    }

    this.filteredSpells = this._filterSpells();

    this.filteredSpells.sort((a, b) => a.name.localeCompare(b.name));
    const allTraits = new Set();
    for (const s of this.allSpells) {
      for (const t of (s.system?.traits?.value ?? [])) allTraits.add(t);
    }
    const traitOptions = [...allTraits].filter((t) => t !== 'cantrip').sort();

    return {
      spells: this.filteredSpells,
      traitOptions,
      rank: this.rank,
      tradition: this.tradition,
    };
  }

  _onRender() {
    const el = this.element;

    const searchInput = el.querySelector('[data-action="searchSpells"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchText = e.target.value.toLowerCase();
        this._scheduleListUpdate(100);
      });
    }

    const traitInput = el.querySelector('[data-action="traitInput"]');
    if (traitInput) {
      const chipsContainer = el.querySelector('.wizard-trait-chips[data-target="spells"]');
      traitInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        const trait = traitInput.value.trim().toLowerCase();
        if (!trait) return;
        traitInput.value = '';
        const chip = document.createElement('span');
        chip.className = 'wizard-trait-chip tag tag--info tag--tiny';
        chip.dataset.trait = trait;
        chip.innerHTML = `${trait} <i class="fa-solid fa-xmark"></i>`;
        chip.querySelector('i').addEventListener('click', () => { chip.remove(); applyTraitFilter(el); });
        chipsContainer.appendChild(chip);
        applyTraitFilter(el);
      });
    }

    bindRarityToggles(el, {
      toggleSelector: '[data-action="toggleRarity"]',
      itemSelector: '.spell-option[data-rarity]',
    });

    const spellList = el.querySelector('.spell-list');
    if (spellList) {
      spellList.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const uuid = target.closest('.spell-option')?.dataset?.uuid || target.dataset.uuid;

        if (target.dataset.action === 'selectSpell') {
          const spell = this.filteredSpells.find((s) => s.uuid === uuid);
          if (spell && this.onSelect) {
            this.onSelect(spell);
            this.close();
          }
        }

        if (target.dataset.action === 'viewSpell') {
          e.stopPropagation();
          if (!uuid) return;
          const item = await fromUuid(uuid);
          if (item?.sheet) item.sheet.render(true);
        }
      });
    }
  }

  _matchesTradition(spell) {
    const traditions = spell.system.traits?.traditions ?? spell.system.traditions?.value ?? [];
    return traditions.includes(this.tradition);
  }

  async _updateList() {
    this.filteredSpells = this._filterSpells();

    this.filteredSpells.sort((a, b) => a.name.localeCompare(b.name));

    const listContainer = this.element?.querySelector('.spell-list');
    if (!listContainer) return;

    const html = await renderTemplate(`modules/${MODULE_ID}/templates/spell-picker.hbs`, {
      spells: this.filteredSpells,
      rank: this.rank,
      tradition: this.tradition,
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.spell-list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }
  }

  _filterSpells() {
    if (!this.searchText) return [...this.allSpells];
    return this.allSpells.filter((s) => (s._levelerSearchName ?? s.name.toLowerCase()).includes(this.searchText));
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
}

function applyTraitFilter(el) {
  const chips = [...el.querySelectorAll('.wizard-trait-chips[data-target="spells"] .wizard-trait-chip')].map((c) => c.dataset.trait);
  el.querySelectorAll('.spell-option').forEach((item) => {
    if (chips.length === 0) { item.style.display = ''; return; }
    const traits = item.dataset.traits?.toLowerCase() ?? '';
    item.style.display = chips.every((t) => traits.includes(t)) ? '' : 'none';
  });
}

async function loadSpells() {
  if (cachedSpells) return cachedSpells;

  const compendium = game.packs.get('pf2e.spells-srd');
  if (!compendium) return [];

  cachedSpells = await compendium.getDocuments();
  for (const spell of cachedSpells) {
    spell._levelerSearchName = spell.name.toLowerCase();
  }
  return cachedSpells;
}
