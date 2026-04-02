import { MODULE_ID } from '../constants.js';
import { loadFeats } from '../feats/feat-cache.js';
import { getFeatsForSelection, filterBySearch, sortFeats } from '../feats/feat-filter.js';
import { checkPrerequisites } from '../prerequisites/prerequisite-checker.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class FeatPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, category, targetLevel, buildState, onSelect) {
    super();
    this.actor = actor;
    this.category = category;
    this.targetLevel = targetLevel;
    this.buildState = buildState;
    this.onSelect = onSelect;
    this.allFeats = [];
    this.filteredFeats = [];
    this.searchText = '';
    this.sortMethod = game.settings.get(MODULE_ID, 'featSortMethod');
    this.hideFailedPrereqs = false;
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-feat-picker',
    classes: ['pf2e-leveler'],
    position: { width: 650, height: 550 },
    window: { resizable: true },
  };

  static PARTS = {
    picker: {
      template: `modules/${MODULE_ID}/templates/feat-picker.hbs`,
    },
  };

  get title() {
    const typeNames = {
      class: 'Class Feats',
      skill: 'Skill Feats',
      general: 'General Feats',
      ancestry: 'Ancestry Feats',
      archetype: 'Archetype Feats',
      mythic: 'Mythic Feats',
    };
    return `${this.actor.name} — ${typeNames[this.category] ?? 'Feats'} | Level ${this.targetLevel}`;
  }

  async _prepareContext() {
    if (this.allFeats.length === 0) {
      const allCachedFeats = await loadFeats();
      const hideUncommon = game.settings.get(MODULE_ID, 'hideUncommonFeats');

      this.allFeats = getFeatsForSelection(allCachedFeats, this.category, this.actor, this.targetLevel, {
        hideUncommon,
        sortMethod: this.sortMethod,
      });
    }

    this.filteredFeats = this._applyFilters();

    return {
      feats: this.filteredFeats,
      category: this.category,
      targetLevel: this.targetLevel,
      hideFailedPrereqs: this.hideFailedPrereqs,
    };
  }

  _onRender(_context, _options) {
    const el = this.element;
    this._activateListeners(el);
  }

  _applyFilters() {
    let feats = [...this.allFeats];
    if (this.searchText) {
      feats = filterBySearch(feats, this.searchText);
    }
    this._enrichWithPrerequisites(feats);
    if (this.hideFailedPrereqs) {
      feats = feats.filter((f) => !f.prerequisitesFailed);
    }
    return sortFeats(feats, this.sortMethod);
  }

  _enrichWithPrerequisites(feats) {
    const showPrereqs = game.settings.get(MODULE_ID, 'showPrerequisites');
    for (const feat of feats) {
      if (showPrereqs) {
        const check = checkPrerequisites(feat, this.buildState);
        feat.prereqResults = check.results;
        feat.prerequisitesFailed = !check.met;
      } else {
        feat.prereqResults = [];
        feat.prerequisitesFailed = false;
      }
    }
  }

  _activateListeners(el) {
    const searchInput = el.querySelector('[data-action="searchFeats"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchText = e.target.value;
        this._updateFeatList();
      });
    }

    const prereqToggle = el.querySelector('[data-action="togglePrereqFilter"]');
    if (prereqToggle) {
      prereqToggle.addEventListener('click', () => {
        this.hideFailedPrereqs = !this.hideFailedPrereqs;
        prereqToggle.classList.toggle('active', this.hideFailedPrereqs);
        this._updateFeatList();
      });
    }

    const sortSelect = el.querySelector('[data-action="sortFeats"]');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortMethod = e.target.value;
        this._updateFeatList();
      });
    }

    const featList = el.querySelector('.feat-list');
    if (featList) {
      featList.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const featOption = target.closest('.feat-option');
        const uuid = featOption?.dataset?.uuid || target.dataset.uuid;

        if (action === 'viewFeat') {
          e.stopPropagation();
          if (!uuid) return;
          const item = await fromUuid(uuid);
          if (item?.sheet) item.sheet.render(true);
        }

        if (action === 'selectFeat') {
          const feat = this.filteredFeats.find((f) => f.uuid === uuid);
          if (feat && this.onSelect) {
            this.onSelect(feat);
            this.close();
          }
        }

        if (action === 'sendToChat') {
          e.stopPropagation();
          const feat = await fromUuid(uuid);
          if (feat) {
            ChatMessage.create({
              content: `@UUID[${uuid}]{${feat.name}}`,
              speaker: { alias: this.actor.name },
            });
          }
        }
      });
    }
  }

  async _updateFeatList() {
    this.filteredFeats = this._applyFilters();

    const listContainer = this.element?.querySelector('.feat-list');
    if (!listContainer) return;

    const html = await renderTemplate(`modules/${MODULE_ID}/templates/feat-picker.hbs`, {
      feats: this.filteredFeats,
      category: this.category,
      targetLevel: this.targetLevel,
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.feat-list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }
  }
}

