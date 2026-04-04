import {
  addCurriculumCantrip,
  addCurriculumRank1,
  addSpell,
  removeCurriculumCantrip,
  removeCurriculumRank1,
  removeSpell,
  setAncestry,
  setAncestryFeat,
  setBackground,
  setClass,
  setClassFeat,
  setDeity,
  setDivineFont,
  setFeatChoice,
  setHeritage,
  setImplement,
  setInnovationItem,
  setInnovationModification,
  setKineticGateMode,
  setPrimaryApparition,
  setSanctification,
  setSecondElement,
  setSubclass,
  setSubclassChoice,
  setSubconsciousMind,
  setThesis,
  toggleApparition,
  toggleIkon,
  toggleKineticImpulse,
  toggleTactic,
} from '../../creation/creation-model.js';
import { getClassHandler } from '../../creation/class-handlers/registry.js';
import { bindRarityToggles } from '../shared/rarity-filters.js';

export function activateCharacterWizardListeners(wizard, el) {
  el.querySelector('[data-action="prevStep"]')?.addEventListener('click', () => wizard._prevStep());
  el.querySelector('[data-action="nextStep"]')?.addEventListener('click', () => wizard._nextStep());
  el.querySelector('[data-action="applyCreation"]')?.addEventListener('click', () => wizard._apply());

  el.querySelectorAll('[data-action="goToStep"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      wizard.currentStep = step;
      wizard.render(true);
    });
  });

  el.querySelectorAll('[data-action="selectItem"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      await wizard._selectItem(uuid);
    });
  });

  el.querySelectorAll('[data-action="toggleFont"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const requiredFonts = new Set();
      el.querySelectorAll('[data-action="toggleFont"]').forEach((input) => {
        if (input.checked) requiredFonts.add(input.dataset.font);
      });
      el.querySelectorAll('.wizard-item[data-font]').forEach((item) => {
        const fonts = item.dataset.font?.split(',') ?? [];
        const show = requiredFonts.size === 0 || fonts.some((f) => requiredFonts.has(f));
        item.style.display = show ? '' : 'none';
      });
    });
  });

  bindRarityToggles(el, {
    toggleSelector: '[data-action="toggleRarity"]',
    itemSelector: '.wizard-item[data-rarity]',
  });

  el.querySelector('[data-action="toggleAlternateBoosts"]')?.addEventListener('change', (e) => {
    wizard.data.alternateAncestryBoosts = e.target.checked;
    wizard.data.boosts.ancestry = [];
    wizard._saveAndRender();
  });

  el.querySelectorAll('[data-action="toggleBoost"]').forEach((btn) => {
    btn.addEventListener('click', () => wizard._toggleBoost(btn.dataset.attr, btn.dataset.source));
  });

  el.querySelectorAll('[data-action="toggleSkill"]').forEach((btn) => {
    btn.addEventListener('click', () => wizard._toggleSkill(btn.dataset.skill));
  });

  el.querySelectorAll('[data-action="toggleLanguage"]').forEach((btn) => {
    btn.addEventListener('click', () => wizard._toggleLanguage(btn.dataset.language));
  });

  el.querySelectorAll('[data-action="selectSanctification"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSanctification(wizard.data, btn.dataset.value);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectDivineFont"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setDivineFont(wizard.data, btn.dataset.value);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectDevotionSpell"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) {
        wizard.data.devotionSpell = { uuid: spell.uuid, name: spell.name, img: spell.img };
        wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="selectSubclassChoice"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSubclassChoice(wizard.data, btn.dataset.flag, btn.dataset.value);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectFeatChoice"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      setFeatChoice(wizard.data, btn.dataset.slot, btn.dataset.flag, btn.dataset.value);
      await wizard._refreshGrantedFeatChoiceSections();
      await wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectSubclass"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      const tradition = btn.dataset.tradition || null;
      const spellUuids = btn.dataset.spelluuids ? JSON.parse(btn.dataset.spelluuids) : [];
      const grantedSkills = btn.dataset.skills ? JSON.parse(btn.dataset.skills) : [];
      const grantedLores = btn.dataset.lores ? JSON.parse(btn.dataset.lores) : [];
      const choiceSets = btn.dataset.choicesets ? JSON.parse(btn.dataset.choicesets) : [];
      const curriculum = btn.dataset.curriculum ? JSON.parse(btn.dataset.curriculum) : null;

      const item = await fromUuid(uuid).catch(() => null);
      if (item) {
        setSubclass(wizard.data, item, tradition, spellUuids, grantedSkills, grantedLores, choiceSets, curriculum);
        await wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="toggleApparition"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleApparition(wizard.data, {
        uuid: btn.dataset.uuid,
        name: btn.dataset.name,
        img: btn.dataset.img,
        lores: btn.dataset.lores ? JSON.parse(btn.dataset.lores) : [],
        spells: btn.dataset.spells ? JSON.parse(btn.dataset.spells) : {},
        vesselSpell: btn.dataset.vesselSpell || null,
      }, Number(btn.dataset.max ?? 2));
      wizard._featChoiceDataDirty = true;
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="toggleTactic"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleTactic(wizard.data, {
        uuid: btn.dataset.uuid,
        name: btn.dataset.name,
        img: btn.dataset.img,
      }, Number(btn.dataset.max ?? 5));
      wizard._featChoiceDataDirty = true;
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="toggleIkon"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleIkon(wizard.data, {
        uuid: btn.dataset.uuid,
        name: btn.dataset.name,
        img: btn.dataset.img,
      }, Number(btn.dataset.max ?? 3));
      wizard._featChoiceDataDirty = true;
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectInnovationItem"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = await fromUuid(btn.dataset.uuid).catch(() => null);
      if (!item) return;
      setInnovationItem(wizard.data, {
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        slug: item.slug,
        category: item.system?.category ?? null,
        traits: item.system?.traits?.value ?? [],
        usage: item.system?.usage?.value ?? null,
        range: item.system?.range ?? null,
      });
      wizard._featChoiceDataDirty = true;
      await wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectInnovationModification"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = await fromUuid(btn.dataset.uuid).catch(() => null);
      if (!item) return;
      setInnovationModification(wizard.data, item);
      wizard._featChoiceDataDirty = true;
      await wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectKineticGateMode"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setKineticGateMode(wizard.data, btn.dataset.value);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectSecondElement"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = await fromUuid(btn.dataset.uuid).catch(() => null);
      if (!item) return;
      setSecondElement(wizard.data, item);
      wizard._featChoiceDataDirty = true;
      await wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="toggleKineticImpulse"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleKineticImpulse(wizard.data, {
        uuid: btn.dataset.uuid,
        name: btn.dataset.name,
        img: btn.dataset.img,
        element: btn.dataset.element,
      }, 2);
      wizard._featChoiceDataDirty = true;
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="setPrimaryApparition"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPrimaryApparition(wizard.data, btn.dataset.uuid);
      wizard._saveAndRender();
    });
  });

  ['clearAncestry', 'clearHeritage', 'clearBackground', 'clearClass', 'clearSubclass', 'clearImplement', 'clearInnovationItem', 'clearInnovationModification', 'clearSecondElement', 'clearSubconsciousMind', 'clearThesis', 'clearDeity', 'clearAncestryFeat', 'clearClassFeat'].forEach((action) => {
    el.querySelector(`[data-action="${action}"]`)?.addEventListener('click', async () => {
      const clearMap = {
        clearAncestry: () => setAncestry(wizard.data, null),
        clearHeritage: () => setHeritage(wizard.data, null),
        clearBackground: () => setBackground(wizard.data, null),
        clearClass: () => { setClass(wizard.data, null); wizard.classHandler = getClassHandler(null); },
        clearSubclass: () => setSubclass(wizard.data, null, null, null, null, null, null, null),
        clearImplement: () => setImplement(wizard.data, null),
        clearInnovationItem: () => setInnovationItem(wizard.data, null),
        clearInnovationModification: () => setInnovationModification(wizard.data, null),
        clearSecondElement: () => setSecondElement(wizard.data, null),
        clearSubconsciousMind: () => setSubconsciousMind(wizard.data, null),
        clearThesis: () => setThesis(wizard.data, null),
        clearDeity: () => setDeity(wizard.data, null),
        clearAncestryFeat: () => setAncestryFeat(wizard.data, null),
        clearClassFeat: () => setClassFeat(wizard.data, null),
      };
      clearMap[action]?.();
      const refreshActions = new Set(['clearAncestry', 'clearHeritage', 'clearBackground', 'clearClass', 'clearAncestryFeat', 'clearClassFeat']);
      if (refreshActions.has(action)) {
        await wizard._refreshGrantedFeatChoiceSections();
      }
      await wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectAncestryFeat"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = await fromUuid(btn.dataset.uuid);
      if (item) {
        const choiceSets = await wizard._parseChoiceSets(item.system?.rules ?? []);
        setAncestryFeat(wizard.data, item, choiceSets);
        await wizard._refreshGrantedFeatChoiceSections();
        await wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="selectClassFeat"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = await fromUuid(btn.dataset.uuid);
      if (item) {
        const choiceSets = await wizard._parseChoiceSets(item.system?.rules ?? []);
        setClassFeat(wizard.data, item, choiceSets);
        await wizard._refreshGrantedFeatChoiceSections();
        await wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="addCantrip"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      if (!uuid) return;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) {
        addSpell(wizard.data, spell, true);
        await wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="addRank1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      if (!uuid) return;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) {
        addSpell(wizard.data, spell, false);
        await wizard._saveAndRender();
      }
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
        if (chips.length === 0) {
          item.style.display = '';
          return;
        }
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
      chip.querySelector('i').addEventListener('click', () => {
        chip.remove();
        applyFilter();
      });
      chipsContainer.appendChild(chip);
      applyFilter();
    });
  });

  el.querySelectorAll('[data-action="spellSubStep"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizard.spellSubStep = btn.dataset.substep;
      wizard.render(true);
    });
  });

  el.querySelectorAll('[data-action="removeCantrip"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSpell(wizard.data, btn.dataset.uuid, true);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="removeRank1"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSpell(wizard.data, btn.dataset.uuid, false);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="addCurriculumCantrip"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      const max = Number(btn.dataset.max ?? 1);
      const current = wizard._getSanitizedCurriculumSelections().cantrips;
      if (current.some((spell) => spell.uuid === uuid) || current.length >= max) return;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) {
        addCurriculumCantrip(wizard.data, spell);
        wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="removeCurriculumCantrip"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCurriculumCantrip(wizard.data, btn.dataset.uuid);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="addCurriculumRank1"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      const max = Number(btn.dataset.max ?? 2);
      const current = wizard._getSanitizedCurriculumSelections().rank1;
      if (current.some((spell) => spell.uuid === uuid) || current.length >= max) return;
      const spell = await fromUuid(uuid).catch(() => null);
      if (spell) {
        addCurriculumRank1(wizard.data, spell);
        wizard._saveAndRender();
      }
    });
  });

  el.querySelectorAll('[data-action="removeCurriculumRank1"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCurriculumRank1(wizard.data, btn.dataset.uuid);
      wizard._saveAndRender();
    });
  });

  el.querySelectorAll('[data-action="viewItem"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await fromUuid(btn.dataset.uuid);
      if (item?.sheet) item.sheet.render(true);
    });
  });

  el.querySelectorAll('[data-action="searchChoiceSetItems"]').forEach((input) => {
    input.addEventListener('input', () => applyChoiceSetFilters(input.closest('.wizard-choice-block')));
  });

  el.querySelectorAll('[data-action="filterWeaponChoice"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.wizard-choice-block');
      if (!block) return;
      block.querySelectorAll('[data-action="filterWeaponChoice"]').forEach((entry) => entry.classList.remove('selected'));
      btn.classList.add('selected');
      applyChoiceSetFilters(block);
    });
  });

  const searchInput = el.querySelector('[data-action="searchItems"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      wizard._filterItems(el, e.target.value.toLowerCase());
    });
  }
}

function applyChoiceSetFilters(block) {
  if (!block) return;
  const query = block.querySelector('[data-action="searchChoiceSetItems"]')?.value?.toLowerCase() ?? '';
  const activeFilter = block.querySelector('[data-action="filterWeaponChoice"].selected')?.dataset.filter ?? 'all';

  block.querySelectorAll('.wizard-item').forEach((item) => {
    const name = item.dataset.name?.toLowerCase() ?? '';
    const category = item.dataset.category?.toLowerCase() ?? '';
    const isRanged = item.dataset.isRanged === 'true';

    const matchesQuery = !query || name.includes(query);
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'melee' && !isRanged)
      || (activeFilter === 'ranged' && isRanged)
      || category === activeFilter;

    item.style.display = matchesQuery && matchesFilter ? '' : 'none';
  });
}
