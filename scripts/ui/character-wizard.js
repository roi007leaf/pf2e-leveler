import { MODULE_ID, SKILLS, ATTRIBUTES } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { createCreationData, setAncestry, setHeritage, setBackground, setClass, setSubclass, setSkills, setAncestryFeat, setClassFeat, addSpell, removeSpell } from '../creation/creation-model.js';
import { getCreationData, saveCreationData, clearCreationData } from '../creation/creation-store.js';
import { applyCreation } from '../creation/apply-creation.js';
import { localize } from '../utils/i18n.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STEPS = ['ancestry', 'heritage', 'background', 'class', 'subclass', 'boosts', 'skills', 'feats', 'spells', 'summary'];

const SUBCLASS_TAGS = {
  alchemist: 'alchemist-research-field',
  animist: 'animistic-practice',
  barbarian: 'barbarian-instinct',
  bard: 'bard-muse',
  champion: 'champion-cause',
  cleric: 'cleric-doctrine',
  druid: 'druid-order',
  gunslinger: 'gunslinger-way',
  inventor: 'inventor-innovation',
  investigator: 'investigator-methodology',
  kineticist: 'kineticist-kinetic-gate',
  magus: 'magus-hybrid-study',
  oracle: 'oracle-mystery',
  psychic: 'psychic-conscious-mind',
  ranger: 'ranger-hunters-edge',
  rogue: 'rogue-racket',
  sorcerer: 'sorcerer-bloodline',
  summoner: 'summoner-eidolon',
  swashbuckler: 'swashbuckler-style',
  thaumaturge: 'thaumaturge-implement',
  witch: 'witch-patron',
  wizard: 'wizard-arcane-school',
};


export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor) {
    super();
    this.actor = actor;
    this.data = getCreationData(actor) ?? createCreationData();
    this.currentStep = 0;
    this.spellSubStep = 'cantrips';
    this._compendiumCache = {};
    this._preloadCompendiums();
  }

  _preloadCompendiums() {
    ['pf2e.feats-srd', 'pf2e.spells-srd', 'pf2e.classfeatures', 'pf2e.ancestries', 'pf2e.backgrounds', 'pf2e.classes'].forEach((key) => {
      this._loadCompendium(key);
    });
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-leveler-wizard',
    classes: ['pf2e-leveler'],
    position: { width: 850, height: 700 },
    window: { resizable: true },
  };

  static PARTS = {
    wizard: { template: `modules/${MODULE_ID}/templates/character-wizard.hbs` },
  };

  get title() {
    return `${this.actor.name} — ${localize('CREATION.TITLE')}`;
  }

  get stepId() {
    return STEPS[this.currentStep];
  }

  get visibleSteps() {
    return STEPS.filter((s) => {
      if (s === 'subclass') return this._hasSubclass();
      if (s === 'spells') return this._isCaster();
      return true;
    });
  }

  _hasSubclass() {
    return !!SUBCLASS_TAGS[this.data.class?.slug];
  }

  async _prepareContext() {
    const steps = this.visibleSteps.map((id, i) => ({
      id,
      label: localize(`CREATION.STEPS.${id.toUpperCase()}`),
      active: STEPS.indexOf(id) === this.currentStep,
      complete: this._isStepComplete(id),
      index: STEPS.indexOf(id),
    }));

    const allComplete = this.visibleSteps.filter((s) => s !== 'summary').every((s) => this._isStepComplete(s));

    const stepContext = await this._getStepContext();

    return {
      steps,
      stepId: this.stepId,
      data: this.data,
      isFirst: this.currentStep === 0,
      isLast: this.currentStep === STEPS.length - 1,
      isSummary: this.stepId === 'summary',
      allComplete,
      ...stepContext,
    };
  }

  _onRender() {
    const el = this.element;
    this._activateListeners(el);
  }

  _activateListeners(el) {
    el.querySelector('[data-action="prevStep"]')?.addEventListener('click', () => this._prevStep());
    el.querySelector('[data-action="nextStep"]')?.addEventListener('click', () => this._nextStep());
    el.querySelector('[data-action="applyCreation"]')?.addEventListener('click', () => this._apply());

    el.querySelectorAll('[data-action="goToStep"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step);
        this.currentStep = step;
        this.render(true);
      });
    });

    el.querySelectorAll('[data-action="selectItem"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.dataset.uuid;
        await this._selectItem(uuid);
      });
    });

    el.querySelectorAll('[data-action="toggleRarity"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const hiddenRarities = new Set();
        el.querySelectorAll('[data-action="toggleRarity"]').forEach((input) => {
          if (!input.checked) hiddenRarities.add(input.dataset.rarity);
        });
        el.querySelectorAll('.wizard-item[data-rarity]').forEach((item) => {
          const rarity = item.dataset.rarity || 'common';
          item.style.display = hiddenRarities.has(rarity) ? 'none' : '';
        });
      });
    });

    el.querySelector('[data-action="toggleAlternateBoosts"]')?.addEventListener('change', (e) => {
      this.data.alternateAncestryBoosts = e.target.checked;
      this.data.boosts.ancestry = [];
      this._saveAndRender();
    });

    el.querySelectorAll('[data-action="toggleBoost"]').forEach((btn) => {
      btn.addEventListener('click', () => this._toggleBoost(btn.dataset.attr, btn.dataset.source));
    });

    el.querySelectorAll('[data-action="toggleSkill"]').forEach((btn) => {
      btn.addEventListener('click', () => this._toggleSkill(btn.dataset.skill));
    });

    el.querySelectorAll('[data-action="selectSubclass"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.dataset.uuid;
        const tradition = btn.dataset.tradition || null;
        const grantedSpells = btn.dataset.granted ? JSON.parse(btn.dataset.granted) : null;
        const grantedSkills = btn.dataset.skills ? JSON.parse(btn.dataset.skills) : [];

        const item = await fromUuid(uuid).catch(() => null);
        if (item) { setSubclass(this.data, item, tradition, grantedSpells, grantedSkills); await this._saveAndRender(); }
      });
    });

    ['clearAncestry', 'clearHeritage', 'clearBackground', 'clearClass', 'clearSubclass', 'clearAncestryFeat', 'clearClassFeat'].forEach((action) => {
      el.querySelector(`[data-action="${action}"]`)?.addEventListener('click', () => {
        const clearMap = {
          clearAncestry: () => setAncestry(this.data, null),
          clearHeritage: () => setHeritage(this.data, null),
          clearBackground: () => setBackground(this.data, null),
          clearClass: () => setClass(this.data, null),
          clearSubclass: () => setSubclass(this.data, null, null),
          clearAncestryFeat: () => setAncestryFeat(this.data, null),
          clearClassFeat: () => setClassFeat(this.data, null),
        };
        clearMap[action]?.();
        this._saveAndRender();
      });
    });

    el.querySelectorAll('[data-action="selectAncestryFeat"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = await fromUuid(btn.dataset.uuid);
        if (item) { setAncestryFeat(this.data, item); await this._saveAndRender(); }
      });
    });

    el.querySelectorAll('[data-action="selectClassFeat"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = await fromUuid(btn.dataset.uuid);
        if (item) { setClassFeat(this.data, item); await this._saveAndRender(); }
      });
    });

    el.querySelectorAll('[data-action="addCantrip"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.dataset.uuid;
        if (!uuid) return;
        const spell = await fromUuid(uuid).catch(() => null);
        if (spell) { addSpell(this.data, spell, true); await this._saveAndRender(); }
      });
    });

    el.querySelectorAll('[data-action="addRank1"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.dataset.uuid;
        if (!uuid) return;
        const spell = await fromUuid(uuid).catch(() => null);
        if (spell) { addSpell(this.data, spell, false); await this._saveAndRender(); }
      });
    });

    el.querySelector('[data-action="searchCantrips"]')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      el.querySelectorAll('[data-list="cantrips"] .wizard-item').forEach((item) => {
        item.style.display = (item.dataset.name?.toLowerCase() ?? '').includes(query) ? '' : 'none';
      });
    });

    el.querySelector('[data-action="searchRank1"]')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      el.querySelectorAll('[data-list="rank1"] .wizard-item').forEach((item) => {
        item.style.display = (item.dataset.name?.toLowerCase() ?? '').includes(query) ? '' : 'none';
      });
    });

    el.querySelectorAll('[data-action="traitInput"]').forEach((input) => {
      const target = input.dataset.target;
      const chipsContainer = el.querySelector(`.wizard-trait-chips[data-target="${target}"]`);

      const applyFilter = () => {
        const chips = [...chipsContainer.querySelectorAll('.wizard-trait-chip')].map((c) => c.dataset.trait);
        el.querySelectorAll(`[data-list="${target}"] .wizard-item`).forEach((item) => {
          if (chips.length === 0) { item.style.display = ''; return; }
          const name = item.dataset.name?.toLowerCase() ?? '';
          item.style.display = chips.every((t) => name.includes(t)) ? '' : 'none';
        });
      };

      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        const trait = input.value.trim().toLowerCase();
        if (!trait) return;
        input.value = '';
        const chip = document.createElement('span');
        chip.className = 'wizard-trait-chip tag tag--info tag--tiny';
        chip.dataset.trait = trait;
        chip.innerHTML = `${trait} <i class="fa-solid fa-xmark"></i>`;
        chip.querySelector('i').addEventListener('click', () => { chip.remove(); applyFilter(); });
        chipsContainer.appendChild(chip);
        applyFilter();
      });
    });

    el.querySelectorAll('[data-action="spellSubStep"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.spellSubStep = btn.dataset.substep;
        this.render(true);
      });
    });

    el.querySelectorAll('[data-action="removeCantrip"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSpell(this.data, btn.dataset.uuid, true);
        this._saveAndRender();
      });
    });

    el.querySelectorAll('[data-action="removeRank1"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSpell(this.data, btn.dataset.uuid, false);
        this._saveAndRender();
      });
    });

    el.querySelectorAll('[data-action="viewItem"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const item = await fromUuid(btn.dataset.uuid);
        if (item?.sheet) item.sheet.render(true);
      });
    });

    const searchInput = el.querySelector('[data-action="searchItems"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._filterItems(el, e.target.value.toLowerCase());
      });
    }
  }

  async _selectItem(uuid) {
    const item = await fromUuid(uuid);
    if (!item) return;

    switch (this.stepId) {
      case 'ancestry':
        setAncestry(this.data, item);
        break;
      case 'heritage':
        setHeritage(this.data, item);
        break;
      case 'background':
        setBackground(this.data, item);
        break;
      case 'class':
        setClass(this.data, item);
        break;
      default:
        break;
    }

    await this._saveAndRender();
  }

  _toggleBoost(attr, source) {
    const max = this._boostMaxForSource[source] ?? 0;
    const boosts = [...(this.data.boosts[source] ?? [])];
    const idx = boosts.indexOf(attr);
    if (idx >= 0) {
      boosts.splice(idx, 1);
    } else if (boosts.length < max) {
      boosts.push(attr);
    }
    this.data.boosts[source] = boosts;
    this._saveAndRender();
  }

  async _toggleSkill(skill) {
    let skills = [...this.data.skills];
    if (skills.includes(skill)) {
      skills = skills.filter((s) => s !== skill);
    } else {
      const maxSkills = await this._getAdditionalSkillCount();
      if (skills.length < maxSkills) {
        skills.push(skill);
      }
    }
    setSkills(this.data, skills);
    this._saveAndRender();
  }

  _openSpellPicker(rank, isCantrip) {
    if (!this._isCaster()) return;
    const classDef = ClassRegistry.get(this.data.class.slug);
    let tradition = classDef.spellcasting.tradition;
    if (['bloodline', 'patron'].includes(tradition)) {
      tradition = this.data.subclass?.tradition ?? 'arcane';
    }

    import('./spell-picker.js').then(({ SpellPicker }) => {
      const picker = new SpellPicker(
        this.actor,
        tradition,
        rank,
        (spell) => {
          addSpell(this.data, spell, isCantrip);
          this._saveAndRender();
        },
      );
      picker.render(true);
    });
  }

  _filterItems(el, query) {
    el.querySelectorAll('.wizard-item').forEach((item) => {
      const name = item.dataset.name?.toLowerCase() ?? '';
      item.style.display = name.includes(query) ? '' : 'none';
    });
  }

  _prevStep() {
    const visible = this.visibleSteps;
    const currentVisible = visible.indexOf(this.stepId);
    if (currentVisible > 0) {
      this.currentStep = STEPS.indexOf(visible[currentVisible - 1]);
      this.render(true);
    }
  }

  _nextStep() {
    const visible = this.visibleSteps;
    const currentVisible = visible.indexOf(this.stepId);
    if (currentVisible < visible.length - 1) {
      this.currentStep = STEPS.indexOf(visible[currentVisible + 1]);
      this.render(true);
    }
  }

  async _apply() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CREATION.CONFIRM_TITLE') },
      content: `<p>${localize('CREATION.CONFIRM_BODY')}</p>`,
      modal: true,
    });
    if (!confirmed) return;

    await applyCreation(this.actor, this.data);
    await clearCreationData(this.actor);
    ui.notifications.info(localize('CREATION.CREATION_COMPLETE'));
    this.close();
  }

  async _saveAndRender() {
    await saveCreationData(this.actor, this.data);
    this.render(true);
  }

  _isCaster() {
    if (!this.data.class?.slug) return false;
    const classDef = ClassRegistry.get(this.data.class.slug);
    return !!classDef?.spellcasting;
  }

  async _hasClassFeatAtLevel1() {
    if (!this.data.class?.uuid) return false;
    const classItem = await fromUuid(this.data.class.uuid).catch(() => null);
    if (!classItem) return false;
    const classFeatLevels = classItem.system?.classFeatLevels?.value ?? [];
    return classFeatLevels.includes(1);
  }

  async _getAdditionalSkillCount() {
    if (!this.data.class?.uuid) return 3;
    const classItem = await fromUuid(this.data.class.uuid).catch(() => null);
    if (!classItem) return 3;
    const additional = classItem.system?.trainedSkills?.additional ?? 3;
    const intMod = this._computeIntMod();
    return Math.max(0, additional + intMod);
  }

  _getSkillsNote() {
    if (this.data.subclass) return null;
    const slug = this.data.class?.slug;
    if (SUBCLASS_TAGS[slug]) return 'Your subclass may also grant trained skills — select a subclass first.';
    return null;
  }

  _computeIntMod() {
    let mod = 0;
    for (const val of Object.values(this.data.boosts ?? {})) {
      if (Array.isArray(val)) {
        mod += val.filter((v) => v === 'int').length;
      }
    }
    return mod;
  }

  async _getClassTrainedSkills() {
    if (!this.data.class?.uuid) return [];
    const classItem = await fromUuid(this.data.class.uuid).catch(() => null);
    if (!classItem) return [];
    return classItem.system?.trainedSkills?.value ?? [];
  }

  _isStepComplete(stepId) {
    switch (stepId) {
      case 'ancestry': return !!this.data.ancestry;
      case 'heritage': return !!this.data.heritage;
      case 'background': return !!this.data.background;
      case 'class': return !!this.data.class;
      case 'subclass': return !this._hasSubclass() || !!this.data.subclass;
      case 'boosts': return this.data.boosts.free.length === 4;
      case 'skills': return this.data.skills.length >= (this._cachedMaxSkills ?? 1);
      case 'feats': return !!this.data.ancestryFeat;
      case 'spells': {
        if (!this._isCaster()) return true;
        const mc = this._cachedMaxCantrips ?? 1;
        const mr = this._cachedMaxRank1 ?? 0;
        return this.data.spells.cantrips.length >= mc && (mr <= 0 || this.data.spells.rank1.length >= mr);
      }
      case 'summary': return true;
      default: return false;
    }
  }

  async _getStepContext() {
    switch (this.stepId) {
      case 'ancestry': return { items: await this._loadCompendium('pf2e.ancestries') };
      case 'heritage': return { items: await this._loadHeritages() };
      case 'background': return { items: await this._loadCompendium('pf2e.backgrounds') };
      case 'class': return { items: await this._loadCompendium('pf2e.classes') };
      case 'subclass': return { items: await this._loadSubclasses() };
      case 'boosts': return await this._buildBoostContext();
      case 'skills': {
        const maxSkills = await this._getAdditionalSkillCount();
        this._cachedMaxSkills = maxSkills;
        return { skills: await this._buildSkillContext(), maxSkills, skillsNote: this._getSkillsNote() };
      }
      case 'feats': return await this._buildFeatContext();
      case 'spells': return await this._buildSpellContext();
      case 'summary': return { pendingChoices: await this._getPendingChoices() };
      default: return {};
    }
  }

  async _loadCompendium(key) {
    if (this._compendiumCache[key]) return this._compendiumCache[key];
    const pack = game.packs.get(key);
    if (!pack) return [];
    const docs = await pack.getDocuments();
    const items = docs.map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      slug: d.slug ?? d.name.toLowerCase().replace(/\s+/g, '-'),
      description: d.system?.description?.value?.substring(0, 150) ?? '',
      traits: d.system?.traits?.value ?? [],
      traditions: d.system?.traits?.traditions ?? d.system?.traditions?.value ?? [],
      rarity: d.system?.traits?.rarity ?? 'common',
      level: d.system?.level?.value ?? 0,
    }));
    items.sort((a, b) => a.name.localeCompare(b.name));
    this._compendiumCache[key] = items;
    return items;
  }

  async _loadHeritages() {
    if (!this.data.ancestry) return [];
    const ancestrySlug = this.data.ancestry.name.toLowerCase().replace(/\s+/g, '-');
    const all = await this._loadRawHeritages();
    return all.filter((h) => {
      if (h.ancestrySlug === ancestrySlug) return true;
      if (h.traits.includes(ancestrySlug)) return true;
      if (!h.ancestrySlug) return true;
      return false;
    });
  }

  async _loadSubclasses() {
    const tag = SUBCLASS_TAGS[this.data.class?.slug];
    if (!tag) return [];

    const cacheKey = `subclass-${tag}`;
    if (this._compendiumCache[cacheKey]) return this._compendiumCache[cacheKey];

    const pack = game.packs.get('pf2e.classfeatures');
    if (!pack) return [];

    const docs = await pack.getDocuments();
    const items = docs
      .filter((d) => {
        const otherTags = d.system?.traits?.otherTags ?? [];
        return otherTags.includes(tag);
      })
      .map((d) => ({
        uuid: d.uuid,
        name: d.name,
        img: d.img,
        slug: d.slug ?? d.name.toLowerCase().replace(/\s+/g, '-'),
        traits: d.system?.traits?.value ?? [],
        rarity: d.system?.traits?.rarity ?? 'common',
        tradition: this._resolveSubclassTradition(d),
        grantedSpells: this._parseGrantedSpells(d.system?.description?.value ?? ''),
        grantedSkills: this._parseGrantedSkills(d.system?.rules ?? [], d.system?.description?.value ?? ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this._compendiumCache[cacheKey] = items;
    return items;
  }

  async _resolveGrantedSpells() {
    const granted = this.data.subclass?.grantedSpells;
    if (!granted) return { cantrip: null, rank1: null };

    let cantrip = null;
    let rank1 = null;

    if (granted.cantrip) {
      const spell = await fromUuid(granted.cantrip).catch(() => null);
      if (spell) cantrip = { uuid: spell.uuid, name: spell.name, img: spell.img };
    }
    if (granted.rank1) {
      const spell = await fromUuid(granted.rank1).catch(() => null);
      if (spell) rank1 = { uuid: spell.uuid, name: spell.name, img: spell.img };
    }

    return { cantrip, rank1 };
  }

  _parseGrantedSpells(html) {
    if (!html) return { cantrip: null, rank1: null };
    const result = { cantrip: null, rank1: null };


    const uuidRe = /data-uuid="(Compendium\.pf2e\.spells-srd\.Item\.[^"]+)"/g;
    const uuidRe2 = /@UUID\[Compendium\.pf2e\.spells-srd\.Item\.([^\]]+)\]/g;
    const allUuids = [];
    let m;
    while ((m = uuidRe.exec(html)) !== null) allUuids.push({ uuid: m[1], pos: m.index });
    while ((m = uuidRe2.exec(html)) !== null) allUuids.push({ uuid: `Compendium.pf2e.spells-srd.Item.${m[1]}`, pos: m.index });
    allUuids.sort((a, b) => a.pos - b.pos);

    const giftPos = html.search(/Sorcerous Gifts|Granted Spells/i);
    const searchFrom = giftPos >= 0 ? giftPos : 0;
    const relevantUuids = allUuids.filter((u) => u.pos >= searchFrom);

    const cantripPos = html.indexOf('cantrip', searchFrom);
    const rank1Pos = html.search(/\b1st[\s:]/i);



    if (cantripPos >= 0 && relevantUuids.length > 0) {
      const after = relevantUuids.find((u) => u.pos > cantripPos);
      if (after) result.cantrip = after.uuid;
    }
    if (rank1Pos >= 0) {
      const after = relevantUuids.find((u) => u.pos > rank1Pos);
      if (after) result.rank1 = after.uuid;
    }

    return result;
  }

  _parseGrantedSkills(rules, html) {
    const skills = [];
    for (const rule of rules) {
      if (rule.key !== 'ActiveEffectLike') continue;
      const match = rule.path?.match(/^system\.skills\.(\w+)\.rank$/);
      if (match && rule.value >= 1) skills.push(match[1]);
    }
    if (skills.length === 0 && html) {
      const text = html.replace(/<[^>]+>/g, ' ');
      const trainedMatch = text.match(/trained in (?:the )?(.+?)(?:\.|,\s*and a number)/i);
      if (trainedMatch) {
        const skillText = trainedMatch[1];
        for (const skill of SKILLS) {
          if (skillText.toLowerCase().includes(skill)) skills.push(skill);
        }
      }
    }
    return skills;
  }

  _resolveSubclassTradition(item) {
    const rules = item.system?.rules ?? [];

    for (const rule of rules) {
      if (rule.key === 'ActiveEffectLike' && typeof rule.path === 'string' && rule.path.includes('proficiencies.aliases')) {
        return rule.value;
      }
    }

    for (const rule of rules) {
      if (rule.key === 'RollOption' && typeof rule.option === 'string') {
        const match = rule.option.match(/tradition:(\w+)/);
        if (match) return match[1];
      }
    }

    const desc = item.system?.description?.value ?? '';
    const listMatch = desc.match(/Spell List\s+(\w+)/i);
    if (listMatch) return listMatch[1].toLowerCase();

    const strongTradMatch = desc.match(/<strong>Tradition<\/strong>\s*(\w+)/i);
    if (strongTradMatch) {
      const trad = strongTradMatch[1].toLowerCase();
      if (['arcane', 'divine', 'occult', 'primal'].includes(trad)) return trad;
    }

    const tradMatch = desc.match(/tradition is (\w+)/i) ?? desc.match(/(\w+) tradition/i);
    if (tradMatch) {
      const trad = tradMatch[1].toLowerCase();
      if (['arcane', 'divine', 'occult', 'primal'].includes(trad)) return trad;
    }

    return null;
  }

  async _loadRawHeritages() {
    const cacheKey = 'heritages';
    if (this._compendiumCache[cacheKey]) return this._compendiumCache[cacheKey];

    const packKeys = ['pf2e.heritages', 'pf2e.ancestryfeatures'];
    let docs = [];
    for (const key of packKeys) {
      const pack = game.packs.get(key);
      if (pack) {
        const items = await pack.getDocuments();
        docs = docs.concat(items.filter((d) => d.type === 'heritage'));
      }
    }

    const items = docs.map((d) => ({
      uuid: d.uuid,
      name: d.name,
      img: d.img,
      slug: d.slug ?? d.name.toLowerCase().replace(/\s+/g, '-'),
      traits: d.system?.traits?.value ?? [],
      rarity: d.system?.traits?.rarity ?? 'common',
      ancestrySlug: d.system?.ancestry?.slug ?? null,
    }));
    items.sort((a, b) => a.name.localeCompare(b.name));
    this._compendiumCache[cacheKey] = items;
    return items;
  }

  async _buildBoostContext() {
    const boostRows = [];
    this._boostMaxForSource = {};

    const buildRow = (source, label, type, fixed, flaws, freeCount, options, selected) => {
      this._boostMaxForSource[source] = freeCount;
      boostRows.push({ source, label, type, fixed, flaws, freeCount, options, selected });
    };

    if (this.data.ancestry?.uuid) {
      const item = await fromUuid(this.data.ancestry.uuid).catch(() => null);
      if (this.data.alternateAncestryBoosts) {
        buildRow('ancestry', item?.name ?? '', 'Ancestry (Alternate)', [], [], 2, [...ATTRIBUTES], this.data.boosts.ancestry ?? []);
      } else {
        const sets = this._parseBoostSets(item?.system?.boosts);
        const flaws = this._extractFixedValues(item?.system?.flaws);
        const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
        const choices = sets.filter((s) => s.type === 'choice');
        const totalFree = choices.length;
        const allOptions = totalFree > 0 ? (choices.some((c) => c.options.length === 6) ? [...ATTRIBUTES] : choices[0].options) : [];
        buildRow('ancestry', item?.name ?? '', 'Ancestry', fixed, flaws, totalFree, allOptions, this.data.boosts.ancestry ?? []);
      }
    }

    if (this.data.background?.uuid) {
      const item = await fromUuid(this.data.background.uuid).catch(() => null);
      const sets = this._parseBoostSets(item?.system?.boosts);
      const fixed = sets.filter((s) => s.type === 'fixed').map((s) => s.attr);
      const choices = sets.filter((s) => s.type === 'choice');
      const totalFree = choices.length;
      const restricted = choices.find((c) => c.options.length < 6)?.options ?? [];
      buildRow('background', item?.name ?? '', 'Background', fixed, [], totalFree, [...ATTRIBUTES], this.data.boosts.background ?? []);
      boostRows[boostRows.length - 1].restricted = restricted;
    }

    if (this.data.class?.slug) {
      const classDef = ClassRegistry.get(this.data.class.slug);
      const keyAbility = classDef?.keyAbility ?? [];
      if (keyAbility.length === 1) {
        this.data.boosts.class = [keyAbility[0]];
        buildRow('class', this.data.class.name, 'Class', [], [], 0, [], []);
        boostRows[boostRows.length - 1].keyAbility = keyAbility[0];
      } else if (keyAbility.length > 1) {
        buildRow('class', this.data.class.name, 'Class', [], [], 1, keyAbility, this.data.boosts.class ?? []);
        boostRows[boostRows.length - 1].isKeyChoice = true;
      }
    }

    buildRow('free', 'Level 1', 'Free', [], [], 4, [...ATTRIBUTES], this.data.boosts.free ?? []);

    const allBoosts = [...boostRows.flatMap((r) => r.fixed), ...boostRows.flatMap((r) => r.selected)];
    const allFlaws = boostRows.flatMap((r) => r.flaws);
    const totals = {};
    for (const a of ATTRIBUTES) totals[a] = 0;
    for (const b of allBoosts) if (totals[b] !== undefined) totals[b]++;
    for (const f of allFlaws) if (totals[f] !== undefined) totals[f]--;

    for (const row of boostRows) {
      const restricted = row.restricted ?? [];
      const hasRestrictedPick = restricted.length > 0 && row.selected.some((s) => restricted.includes(s));

      row.cells = ATTRIBUTES.map((key) => {
        if (row.keyAbility === key) return { key, type: 'key' };
        if (row.fixed.includes(key)) return { key, type: 'fixed' };
        if (row.flaws.includes(key)) return { key, type: 'flaw' };
        if (!row.options.includes(key)) return { key, type: 'empty' };

        const selected = row.selected.includes(key);
        const isRestricted = restricted.includes(key);
        const locked = restricted.length > 0 && !hasRestrictedPick && !isRestricted;

        return { key, type: 'option', selected, source: row.source, locked, isRestricted };
      });
    }

    const summary = ATTRIBUTES.map((key) => ({ key, label: key.toUpperCase(), mod: totals[key] }));
    return { boostRows, summary, alternateAncestryBoosts: this.data.alternateAncestryBoosts, hasAncestry: !!this.data.ancestry };
  }

  _parseBoostSets(boostObj) {
    if (!boostObj) return [];
    const sets = [];
    for (const b of Object.values(boostObj)) {
      const vals = b.value ?? [];
      if (vals.length === 1 && ATTRIBUTES.includes(vals[0])) {
        sets.push({ type: 'fixed', attr: vals[0] });
      } else if (vals.length > 1) {
        sets.push({ type: 'choice', options: vals.length === 6 ? [...ATTRIBUTES] : vals });
      }
    }
    return sets;
  }

  _extractFixedValues(obj) {
    if (!obj) return [];
    const result = [];
    for (const b of Object.values(obj)) {
      for (const v of (b.value ?? [])) {
        if (ATTRIBUTES.includes(v)) result.push(v);
      }
    }
    return result;
  }

  async _getPendingChoices() {
    const choices = [];
    const seen = new Set();

    const addChoice = (source, prompt) => {
      const text = game.i18n.has(prompt) ? game.i18n.localize(prompt) : prompt.replace(/^PF2E\./, '').replace(/([A-Z])/g, ' $1').trim();
      const key = `${source}:${text}`;
      if (seen.has(key)) return;
      seen.add(key);
      choices.push({ source, prompt: text });
    };

    const subclassTag = SUBCLASS_TAGS[this.data.class?.slug];
    const hasSubclass = !!this.data.subclass;

    const scanItem = async (item, sourceLabel) => {
      const rules = item.system?.rules ?? [];
      for (const rule of rules) {
        if (rule.key !== 'ChoiceSet' || !rule.prompt) continue;
        if (hasSubclass && rule.choices?.filter?.some?.((f) => f.includes(subclassTag))) continue;
        if (hasSubclass && rule.flag && subclassTag?.includes(rule.flag)) continue;
        addChoice(sourceLabel, rule.prompt);
      }
      for (const rule of rules) {
        if (rule.key !== 'GrantItem' || !rule.uuid) continue;
        const granted = await fromUuid(rule.uuid).catch(() => null);
        if (!granted) continue;
        for (const r of (granted.system?.rules ?? [])) {
          if (r.key === 'ChoiceSet' && r.prompt) {
            addChoice(`${sourceLabel} → ${granted.name}`, r.prompt);
          }
        }
      }
    };

    const topItems = [
      { uuid: this.data.ancestry?.uuid, label: this.data.ancestry?.name },
      { uuid: this.data.heritage?.uuid, label: this.data.heritage?.name },
      { uuid: this.data.background?.uuid, label: this.data.background?.name },
      { uuid: this.data.class?.uuid, label: this.data.class?.name },
    ];

    for (const { uuid, label } of topItems) {
      if (!uuid) continue;
      const item = await fromUuid(uuid).catch(() => null);
      if (!item) continue;
      await scanItem(item, label);

      if (item.system?.items) {
        for (const feature of Object.values(item.system.items)) {
          if (!feature.uuid || feature.level > 1) continue;
          const featItem = await fromUuid(feature.uuid).catch(() => null);
          if (!featItem) continue;
          await scanItem(featItem, `${label} → ${feature.name}`);
        }
      }
    }

    return choices;
  }

  async _buildSkillContext() {
    const classSkills = await this._getClassTrainedSkills();
    const bgSkills = await this._getBackgroundTrainedSkills();
    const subclassSkills = this.data.subclass?.grantedSkills ?? [];
    return SKILLS.map((slug) => {
      const fromClass = classSkills.includes(slug);
      const fromBg = bgSkills.includes(slug);
      const fromSubclass = subclassSkills.includes(slug);
      const autoTrained = fromClass || fromBg || fromSubclass;
      const source = fromClass ? 'Class' : fromBg ? 'Background' : fromSubclass ? this.data.subclass.name : null;
      return {
        slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        selected: this.data.skills.includes(slug),
        autoTrained,
        source,
      };
    });
  }

  async _getBackgroundTrainedSkills() {
    if (!this.data.background?.uuid) return [];
    const item = await fromUuid(this.data.background.uuid).catch(() => null);
    if (!item) return [];
    return item.system?.trainedSkills?.value ?? [];
  }

  async _buildFeatContext() {
    if (!this.data.ancestry) return { ancestryFeats: [], classFeats: [] };

    const allFeats = await this._loadCompendium('pf2e.feats-srd');
    const ancestrySlug = this.data.ancestry.name.toLowerCase().replace(/\s+/g, '-');

    const ancestryFeats = allFeats.filter(
      (f) => f.traits.includes(ancestrySlug) && !f.traits.includes('classfeature') && f.level <= 1,
    );

    let classFeats = [];
    const hasClassFeat = await this._hasClassFeatAtLevel1();
    if (hasClassFeat && this.data.class) {
      const classSlug = this.data.class.slug;
      classFeats = allFeats.filter(
        (f) => f.traits.includes(classSlug) && !f.traits.includes('classfeature') && f.level <= 1,
      );
    }

    return { ancestryFeats, classFeats, hasClassFeat };
  }

  async _buildSpellContext() {
    if (!this._isCaster()) return { cantrips: [], rank1Spells: [] };

    const classDef = ClassRegistry.get(this.data.class.slug);
    let tradition = classDef.spellcasting.tradition;
    if (['bloodline', 'patron'].includes(tradition)) {
      tradition = this.data.subclass?.tradition ?? 'arcane';
    }

    const level1Slots = classDef.spellcasting.slots?.[1] ?? {};
    const totalCantrips = Array.isArray(level1Slots.cantrips) ? level1Slots.cantrips[0] + level1Slots.cantrips[1] : (level1Slots.cantrips ?? 5);
    const totalRank1 = Array.isArray(level1Slots[1]) ? level1Slots[1][0] + level1Slots[1][1] : (level1Slots[1] ?? 2);

    const grantedSpells = await this._resolveGrantedSpells();
    const grantedCantripCount = grantedSpells.cantrip ? 1 : 0;
    const grantedRank1Count = grantedSpells.rank1 ? 1 : 0;
    const maxCantrips = totalCantrips - grantedCantripCount;
    const maxRank1 = totalRank1 - grantedRank1Count;

    const allSpells = await this._loadCompendium('pf2e.spells-srd');
    const grantedUuids = [grantedSpells.cantrip?.uuid, grantedSpells.rank1?.uuid].filter(Boolean);
    const selectedUuids = new Set([
      ...this.data.spells.cantrips.map((s) => s.uuid),
      ...this.data.spells.rank1.map((s) => s.uuid),
      ...grantedUuids,
    ]);

    const matchesTradition = (s) => {
      if (s.traditions.length > 0) return s.traditions.includes(tradition);
      return s.traits.includes(tradition);
    };

    const cantrips = allSpells.filter(
      (s) => s.traits.includes('cantrip') && matchesTradition(s) && !selectedUuids.has(s.uuid),
    );

    const rank1Spells = allSpells.filter(
      (s) => !s.traits.includes('cantrip') && s.level === 1 && matchesTradition(s) && !selectedUuids.has(s.uuid),
    );

    this._cachedMaxCantrips = maxCantrips;
    this._cachedMaxRank1 = maxRank1;
    const cantripsFull = this.data.spells.cantrips.length >= maxCantrips;
    const rank1Full = maxRank1 <= 0 || this.data.spells.rank1.length >= maxRank1;

    const allTraits = new Set();
    for (const s of [...cantrips, ...rank1Spells]) {
      for (const t of s.traits) allTraits.add(t);
    }
    const traitOptions = [...allTraits].filter((t) => t !== 'cantrip').sort();

    return {
      spellSubStep: this.spellSubStep,
      cantrips,
      rank1Spells,
      selectedCantrips: this.data.spells.cantrips,
      selectedRank1: this.data.spells.rank1,
      grantedCantrip: grantedSpells.cantrip,
      grantedRank1: grantedSpells.rank1,
      traitOptions,
      maxCantrips,
      maxRank1,
      cantripsFull,
      rank1Full,
      tradition,
    };
  }
}
