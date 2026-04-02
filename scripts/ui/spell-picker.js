import { MODULE_ID } from '../constants.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let cachedSpells = null;

export class SpellPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, tradition, rank, onSelect) {
    super();
    this.actor = actor;
    this.tradition = tradition;
    this.rank = rank;
    this.isCantrip = rank === 0;
    this.onSelect = onSelect;
    this.allSpells = [];
    this.filteredSpells = [];
    this.searchText = '';
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
    const ordinal = this._ordinal(this.rank);
    return `${this.actor.name} — ${ordinal}-Rank ${this._capitalize(this.tradition)} Spells`;
  }

  async _prepareContext() {
    if (this.allSpells.length === 0) {
      const all = await loadSpells();
      this.allSpells = all.filter((s) => {
        if (!this._matchesTradition(s)) return false;
        const isCantrip = s.system.traits?.value?.includes('cantrip');
        if (this.isCantrip) return isCantrip;
        return s.system.level.value === this.rank && !isCantrip;
      });
    }

    this.filteredSpells = this.searchText
      ? this.allSpells.filter((s) => s.name.toLowerCase().includes(this.searchText))
      : [...this.allSpells];

    this.filteredSpells.sort((a, b) => a.name.localeCompare(b.name));

    return {
      spells: this.filteredSpells,
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
        this._updateList();
      });
    }

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
    this.filteredSpells = this.searchText
      ? this.allSpells.filter((s) => s.name.toLowerCase().includes(this.searchText))
      : [...this.allSpells];

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

  _ordinal(n) {
    const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
    return `${n}${suffixes[n] || 'th'}`;
  }

  _capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

async function loadSpells() {
  if (cachedSpells) return cachedSpells;

  const compendium = game.packs.get('pf2e.spells-srd');
  if (!compendium) return [];

  cachedSpells = await compendium.getDocuments();
  return cachedSpells;
}
