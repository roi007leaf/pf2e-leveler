import { MODULE_ID } from '../constants.js';
import { loadFeats } from '../feats/feat-cache.js';
import {
  getFeatsForSelection,
  collectAdditionalArchetypeFeatLevels,
  filterByDedication,
  filterByGeneralSkillFeats,
  filterBySearch,
  filterBySkill,
  sortFeats,
} from '../feats/feat-filter.js';
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
    this.hideFailedPrereqs = category === 'archetype';
    this.showUncommon = !game.settings.get(MODULE_ID, 'hideUncommonFeats');
    this.showRare = !game.settings.get(MODULE_ID, 'hideRareFeats');
    this.selectedSkill = '';
    this.showDedications = category !== 'class';
    this.showSkillFeats = false;
    this.selectedSourcePackages = new Set();
    this._sourceFilterInitialized = false;
    this.enforcePrerequisites = game.settings.get(MODULE_ID, 'enforcePrerequisites');
    this._prereqCache = new Map();
    this._buildStateSignature = this._createBuildStateSignature();
    this._updateListTimer = null;
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-feat-picker',
    classes: ['pf2e-leveler'],
    position: { width: 900, height: 650 },
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
    return `${this.actor.name} - ${typeNames[this.category] ?? 'Feats'} | Level ${this.targetLevel}`;
  }

  async _prepareContext() {
    if (this.allFeats.length === 0) {
      const allCachedFeats = await loadFeats();
      const additionalArchetypeFeatLevels = this.category === 'archetype'
        ? await collectAdditionalArchetypeFeatLevels(allCachedFeats, this.buildState?.feats ?? new Set())
        : new Map();
      this.allFeats = getFeatsForSelection(allCachedFeats, this.category, this.actor, this.targetLevel, {
        sortMethod: this.sortMethod,
        includeDedications: this.category === 'class',
        includeSkillFeats: this.category === 'general',
        buildState: this.buildState,
        additionalArchetypeFeatLevels,
      });
    }

    const sourceOptions = this._getSourceOptions();
    this.filteredFeats = this._applyFilters();

    return {
      feats: this.filteredFeats,
      filteredCount: this.filteredFeats.length,
      sourceOptions,
      category: this.category,
      targetLevel: this.targetLevel,
      hideFailedPrereqs: this.hideFailedPrereqs,
      showUncommon: this.showUncommon,
      showRare: this.showRare,
      sortMethod: this.sortMethod,
      showSkillFilter: this.category === 'skill',
      showGeneralSkillToggle: this.category === 'general',
      skillOptions: this._getSkillOptions(),
      selectedSkill: this.selectedSkill,
      showDedicationToggle: ['class', 'archetype'].includes(this.category),
      showDedications: this.showDedications,
      showSkillFeats: this.showSkillFeats,
      enforcePrerequisites: this.enforcePrerequisites,
    };
  }

  _onRender(_context, _options) {
    this._activateListeners(this.element);
  }

  _applyFilters() {
    let feats = [...this.allFeats];
    if (this.selectedSourcePackages.size > 0) {
      feats = feats.filter((feat) => this.selectedSourcePackages.has(feat.sourcePackage ?? feat.sourcePack));
    }
    if (!this.showUncommon) feats = feats.filter((f) => f.system.traits.rarity !== 'uncommon');
    if (!this.showRare) feats = feats.filter((f) => f.system.traits.rarity !== 'rare');
    if (this.searchText) feats = filterBySearch(feats, this.searchText);
    if (this.category === 'skill' && this.selectedSkill) feats = filterBySkill(feats, [this.selectedSkill]);
    if (this.category === 'general') feats = filterByGeneralSkillFeats(feats, this.showSkillFeats);
    if (['class', 'archetype'].includes(this.category)) feats = filterByDedication(feats, this.showDedications);

    this._enrichWithPrerequisites(feats);
    if (this.hideFailedPrereqs) feats = feats.filter((f) => !f.prerequisitesFailed);
    return sortFeats(feats, this.sortMethod);
  }

  _createBuildStateSignature() {
    const feats = [...(this.buildState?.feats ?? new Set())].sort();
    const classSlug = this.buildState?.class?.slug ?? this.actor?.class?.slug ?? '';
    const level = this.buildState?.level ?? this.targetLevel ?? '';
    return `${classSlug}|${level}|${feats.join(',')}`;
  }

  _enrichWithPrerequisites(feats) {
    const showPrereqs = game.settings.get(MODULE_ID, 'showPrerequisites');
    const enforcePrereqs = this.enforcePrerequisites;
    const ownedSlugs = this.buildState?.feats ?? new Set();
    const takenLevelMap = this._buildTakenLevelMap();

    for (const feat of feats) {
      const cacheKey = `${this._buildStateSignature}:${feat.uuid ?? feat.slug ?? feat.name}`;
      let check = this._prereqCache.get(cacheKey);
      if (!check) {
        check = checkPrerequisites(feat, this.buildState);
        this._prereqCache.set(cacheKey, check);
      }

      feat.prereqResults = showPrereqs ? check.results : [];
      feat.hasFailedPrerequisites = check.results.some((result) => result.met === false);
      feat.hasUnknownPrerequisites = check.results.some((result) => result.met == null);
      feat.prerequisitesFailed = feat.hasFailedPrerequisites;
      feat.selectionBlocked = enforcePrereqs && feat.hasFailedPrerequisites;

      const slug = feat.slug ?? null;
      feat.alreadyTaken = !!slug && ownedSlugs.has(slug) && feat.system.maxTakable === 1;
      feat.takenAtLevel = feat.alreadyTaken && slug ? (takenLevelMap.get(slug) ?? null) : null;
    }
  }

  _buildTakenLevelMap() {
    if (this._takenLevelMap) return this._takenLevelMap;
    const map = new Map();
    const actorFeats = this.actor?.items?.filter?.((i) => i.type === 'feat') ?? [];
    for (const feat of actorFeats) {
      if (feat.slug) {
        const level = feat.system?.level?.taken ?? feat.system?.level?.value ?? null;
        map.set(feat.slug, level);
      }
    }
    this._takenLevelMap = map;
    return map;
  }

  _activateListeners(el) {
    const searchInput = el.querySelector('[data-action="searchFeats"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchText = e.target.value;
        this._scheduleListUpdate(120);
      });
    }

    const prereqToggle = el.querySelector('[data-action="togglePrereqFilter"]');
    if (prereqToggle) {
      prereqToggle.addEventListener('click', () => {
        this.hideFailedPrereqs = !this.hideFailedPrereqs;
        prereqToggle.classList.toggle('active', this.hideFailedPrereqs);
        this._scheduleListUpdate();
      });
    }

    const sortSelect = el.querySelector('[data-action="sortFeats"]');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortMethod = e.target.value;
        this._scheduleListUpdate();
      });
    }

    const uncommonToggle = el.querySelector('[data-action="toggleUncommon"]');
    if (uncommonToggle) {
      uncommonToggle.addEventListener('change', (e) => {
        this.showUncommon = e.target.checked;
        this._scheduleListUpdate();
      });
    }

    const rareToggle = el.querySelector('[data-action="toggleRare"]');
    if (rareToggle) {
      rareToggle.addEventListener('change', (e) => {
        this.showRare = e.target.checked;
        this._scheduleListUpdate();
      });
    }

    el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sourceKey = btn.dataset.package;
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
      });
    });

    el.querySelector('[data-action="searchCompendiumSources"]')?.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      el.querySelectorAll('[data-action="toggleCompendiumSource"]').forEach((btn) => {
        const name = (btn.dataset.sourceName ?? btn.textContent ?? '').toLowerCase();
        btn.style.display = !query || name.includes(query) ? '' : 'none';
      });
    });

    const skillSelect = el.querySelector('[data-action="filterSkillFeats"]');
    if (skillSelect) {
      skillSelect.addEventListener('change', (e) => {
        this.selectedSkill = e.target.value;
        this._scheduleListUpdate();
      });
    }

    const dedicationToggle = el.querySelector('[data-action="toggleDedications"]');
    if (dedicationToggle) {
      dedicationToggle.addEventListener('click', () => {
        this.showDedications = !this.showDedications;
        dedicationToggle.classList.toggle('active', this.showDedications);
        this._scheduleListUpdate();
      });
    }

    const skillFeatToggle = el.querySelector('[data-action="toggleGeneralSkillFeats"]');
    if (skillFeatToggle) {
      skillFeatToggle.addEventListener('click', () => {
        this.showSkillFeats = !this.showSkillFeats;
        skillFeatToggle.classList.toggle('active', this.showSkillFeats);
        this._scheduleListUpdate();
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

  _scheduleListUpdate(delay = 0) {
    if (this._updateListTimer) clearTimeout(this._updateListTimer);
    this._updateListTimer = setTimeout(() => {
      this._updateListTimer = null;
      this._updateFeatList();
    }, delay);
  }

  async _updateFeatList() {
    this.filteredFeats = this._applyFilters();

    const listContainer = this.element?.querySelector('.feat-list');
    if (!listContainer) return;

    const html = await renderTemplate(`modules/${MODULE_ID}/templates/feat-picker.hbs`, {
      feats: this.filteredFeats,
      filteredCount: this.filteredFeats.length,
      category: this.category,
      targetLevel: this.targetLevel,
      sortMethod: this.sortMethod,
    });

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newList = temp.querySelector('.feat-list');
    if (newList) {
      listContainer.innerHTML = newList.innerHTML;
    }

    const resultCount = this.element?.querySelector('.feat-picker__results-count');
    if (resultCount) resultCount.textContent = String(this.filteredFeats.length);
  }

  _getSkillOptions() {
    if (this.category !== 'skill') return [];
    const configSkills = globalThis.CONFIG?.PF2E?.skills ?? {};
    const options = Object.entries(configSkills).map(([slug, rawEntry]) => {
      const rawLabel = typeof rawEntry === 'string'
        ? rawEntry
        : rawEntry?.label ?? rawEntry?.short ?? rawEntry?.long ?? slug;
      return {
        slug,
        label: typeof rawLabel === 'string' && game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel,
      };
    });
    options.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return options;
  }

  _getSourceOptions() {
    const unique = new Map();
    for (const feat of this.allFeats) {
      const key = feat.sourcePackage ?? feat.sourcePack ?? null;
      if (!key) continue;
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          label: feat.sourcePackageLabel ?? key,
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
}
