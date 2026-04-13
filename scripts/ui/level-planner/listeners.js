import { clearLevelFeat, clearLevelReminders, getLevelData, removeLevelSpell, setLevelSkillIncrease, togglePlanApparition } from '../../plan/plan-model.js';
import { applyActorSkillRankRules, applyPlannedLevelSkillRankRules, computeBuildState } from '../../plan/build-state.js';
import { debug } from '../../utils/logger.js';
import { SKILLS } from '../../constants.js';
import { normalizeLoreSkillName, slugifyLoreSkillName } from '../character-wizard/skills-languages.js';

export function activateLevelPlannerListeners(planner, html) {
  const el = html.querySelectorAll ? html : html[0];

  el.querySelectorAll('[data-action="selectLevel"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (e.currentTarget.classList.contains('locked')) return;
      const level = Number(e.currentTarget.dataset.level);
      planner.selectedLevel = level;
      planner.render(true);
    });
  });

  el.querySelector('[data-action="sequentialNextLevel"]')?.addEventListener('click', () => {
    planner._advanceSequentialLevel();
  });

  el.querySelector('[data-action="sequentialFinish"]')?.addEventListener('click', () => {
    planner._finishSequentialMode();
  });

  el.querySelectorAll('[data-action="toggleBoost"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const attr = e.currentTarget.dataset.attr;
      planner._handleBoostToggle(attr);
    });
  });

  el.querySelectorAll('[data-action="toggleIntBonusSkill"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = btn.dataset.skill;
      if (!skill) return;
      planner._handleIntBonusSkillToggle(skill);
    });
  });

  el.querySelector('[data-action="addIntBonusLoreSkill"]')?.addEventListener('click', () => {
    planner._promptIntBonusLoreSkill();
  });

  el.querySelectorAll('[data-action="toggleIntBonusLanguage"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const language = btn.dataset.language;
      if (!language) return;
      planner._handleIntBonusLanguageToggle(language);
    });
  });

  el.querySelector('[data-action="selectDualClass"]')?.addEventListener('change', (event) => {
    planner._setDualClassSlug(event.currentTarget.value);
  });

  el.querySelectorAll('[data-action="selectAdoptedAncestry"]').forEach((button) => {
    button.addEventListener('click', () => {
      const levelData = getLevelData(planner.plan, planner.selectedLevel);
      const feat = levelData?.generalFeats?.[0];
      if (!feat) return;
      feat.choices = { ...(feat.choices ?? {}), adoptedAncestry: button.dataset.value };
      feat.adoptedAncestry = button.dataset.value;
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectPlannedFeatChoice"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const levelData = getLevelData(planner.plan, planner.selectedLevel);
      const category = button.dataset.category;
      const flag = button.dataset.flag;
      const value = button.dataset.value;
      const grantsSkillTraining = button.dataset.grantsSkillTraining === 'true';
      const index = Number(button.dataset.index);
      const featList = category ? levelData?.[category] : null;
      const feat = Array.isArray(featList)
        ? featList[Number.isInteger(index) && index >= 0 ? index : 0]
        : null;
      if (!feat || !flag || !value) return;
      feat.choices = { ...(feat.choices ?? {}), [flag]: value };
      await syncPlannedFeatChoiceSkillRules(feat, flag, value, { grantsSkillTraining });
      if (String(feat?.slug ?? '').toLowerCase() === 'druid-dedication' || String(feat?.name ?? '').toLowerCase() === 'druid dedication') {
        debug('Planner druid dedication choice selected', {
          level: planner.selectedLevel,
          flag,
          value,
          choices: feat.choices,
          skillRules: feat.skillRules ?? [],
          dynamicSkillRules: feat.dynamicSkillRules ?? [],
        });
      }
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="promptPlannedFeatLoreChoice"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const category = button.dataset.category;
      const flag = button.dataset.flag;
      const index = Number(button.dataset.index);
      await planner._promptPlannedFeatLoreChoice({ category, flag, index });
    });
  });

  el.querySelectorAll('[data-action="viewFeat"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uuid = e.currentTarget.dataset.uuid;
      if (!uuid) return;
      const item = await fromUuid(uuid);
      if (item?.sheet) item.sheet.render(true);
    });
  });

  el.querySelectorAll('[data-action="openFeatPicker"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const category = e.currentTarget.dataset.category;
      const level = Number(e.currentTarget.dataset.level);
      planner._openFeatPicker(category, level);
    });
  });

  el.querySelectorAll('[data-action="toggleCustomPlan"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      planner._toggleCustomPlan(Number(btn.dataset.level) || planner.selectedLevel);
    });
  });

  el.querySelectorAll('[data-action="openCustomFeatPicker"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = Number(btn.dataset.level) || planner.selectedLevel;
      const index = btn.dataset.index === '' || btn.dataset.index == null ? null : Number(btn.dataset.index);
      planner._openCustomFeatPicker(level, Number.isInteger(index) ? index : null);
    });
  });

  el.querySelectorAll('[data-action="removeCustomFeat"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      planner._removeCustomFeat(index);
    });
  });

  el.querySelectorAll('[data-action="clearFeat"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const category = e.currentTarget.dataset.category;
      const level = Number(e.currentTarget.dataset.level);
      const levelData = getLevelData(planner.plan, level);
      const feat = levelData?.[category]?.[0];
      if (feat?.slug) clearLevelReminders(planner.plan, level, feat.slug);
      clearLevelFeat(planner.plan, level, category);
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="selectSkillIncrease"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.locked === 'true') return;
      const slug = btn.dataset.skill;
      if (!slug) return;
      const currentRank = getSelectableSkillRank(planner, slug);
      setLevelSkillIncrease(planner.plan, planner.selectedLevel, {
        skill: slug,
        toRank: currentRank + 1,
      });
      planner._savePlanAndRender();
    });
  });

  el.querySelector('[data-action="addLoreSkillIncrease"]')?.addEventListener('click', () => {
    planner._promptLoreSkillIncrease({ custom: false });
  });

  el.querySelectorAll('[data-action="openSpellPicker"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rank = Number(btn.dataset.rank);
      const entryType = btn.dataset.entryType ?? 'primary';
      planner._openSpellPicker(rank, entryType);
    });
  });

  el.querySelectorAll('[data-action="openCustomSpellPicker"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      planner._openCustomSpellPicker(Number(btn.dataset.rank), btn.dataset.entryType ?? 'primary');
    });
  });

  el.querySelector('[data-action="addCustomSpellEntry"]')?.addEventListener('click', () => {
    planner._promptCustomSpellEntry();
  });

  el.querySelectorAll('[data-action="removeCustomSpellEntry"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      planner._removeCustomSpellEntry(btn.dataset.key);
    });
  });

  el.querySelectorAll('[data-action="removeSpell"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uuid = btn.dataset.uuid;
      const entryType = btn.dataset.entryType ?? 'primary';
      const rank = btn.dataset.rank != null ? Number(btn.dataset.rank) : null;
      removeLevelSpell(planner.plan, planner.selectedLevel, uuid, { entryType, rank });
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="removeCustomSpell"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      planner._removeCustomSpell(index);
    });
  });

  el.querySelectorAll('[data-action="browseEquipmentSlot"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slotIndex = Number(btn.dataset.slot);
      const maxLevel = Number(btn.dataset.maxLevel);
      planner._openEquipmentSlotPicker(slotIndex, maxLevel);
    });
  });

  el.querySelectorAll('[data-action="removeEquipmentSlot"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      planner._removeEquipmentSlot(Number(btn.dataset.slot));
    });
  });

  el.querySelectorAll('[data-action="openCustomEquipmentPicker"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = btn.dataset.index == null ? null : Number(btn.dataset.index);
      planner._openCustomEquipmentPicker(planner.selectedLevel, Number.isInteger(index) ? index : null);
    });
  });

  el.querySelectorAll('[data-action="removeCustomEquipment"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      planner._removeCustomEquipment(index);
    });
  });

  el.querySelectorAll('[data-action="viewItem"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uuid = btn.dataset.uuid;
      if (!uuid) return;
      const item = await fromUuid(uuid).catch(() => null);
      if (item?.sheet) item.sheet.render(true);
    });
  });

  el.querySelectorAll('[data-action="addCustomSkillIncrease"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.skill;
      if (!slug) return;
      planner._addCustomSkillIncrease(slug);
    });
  });

  el.querySelector('[data-action="addCustomLoreSkillIncrease"]')?.addEventListener('click', () => {
    planner._promptLoreSkillIncrease({ custom: true });
  });

  el.querySelectorAll('[data-action="removeCustomSkillIncrease"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      if (!Number.isInteger(index)) return;
      planner._removeCustomSkillIncrease(index);
    });
  });

  el.querySelectorAll('[data-action="toggleApparition"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.slug;
      if (!slug || btn.classList.contains('apparition-item--disabled')) return;
      const maxSlots = Number(btn.dataset.maxSlots) || Infinity;
      togglePlanApparition(planner.plan, slug, maxSlots);
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="viewApparition"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const uuid = btn.dataset.uuid;
      if (!uuid) return;
      const item = await fromUuid(uuid);
      if (item?.sheet) item.sheet.render(true);
    });
  });

  el.querySelector('[data-action="exportPlan"]')?.addEventListener('click', () => {
    planner._exportPlan();
  });

  el.querySelector('[data-action="importPlan"]')?.addEventListener('click', () => {
    planner._importPlan();
  });

  el.querySelector('[data-action="clearPlan"]')?.addEventListener('click', () => {
    planner._clearPlan();
  });

  el.querySelector('[data-action="clearLevel"]')?.addEventListener('click', () => {
    planner._clearSelectedLevel();
  });
}

export function getSelectableSkillRank(planner, slug) {
  const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
  applyActorSkillRankRules(buildState.skills, planner.actor, planner.selectedLevel);
  applyPlannedLevelSkillRankRules(buildState.skills, planner.plan, planner.selectedLevel);

  const levelData = getLevelData(planner.plan, planner.selectedLevel);
  for (const skill of levelData?.intBonusSkills ?? []) {
    buildState.skills[skill] = Math.max(buildState.skills[skill] ?? 0, 1);
  }
  for (const inc of levelData?.customSkillIncreases ?? []) {
    if (inc?.skill && Number.isFinite(inc?.toRank)) {
      buildState.skills[inc.skill] = Math.max(buildState.skills[inc.skill] ?? 0, inc.toRank);
    }
  }

  return buildState.skills[slug] ?? buildState.lores?.[slug] ?? 0;
}

async function syncPlannedFeatChoiceSkillRules(feat, flag, value, { grantsSkillTraining = false } = {}) {
  const sourceKey = `choice:${String(flag ?? '').toLowerCase()}`;
  const preservedRules = Array.isArray(feat?.dynamicSkillRules)
    ? feat.dynamicSkillRules.filter((rule) => rule?.source !== sourceKey)
    : [];
  const preservedLoreRules = Array.isArray(feat?.dynamicLoreRules)
    ? feat.dynamicLoreRules.filter((rule) => rule?.source !== sourceKey)
    : [];

  const selectedSkill = grantsSkillTraining ? normalizeSelectedSkillChoice(value) : null;
  if (selectedSkill) {
    feat.dynamicSkillRules = [
      ...preservedRules,
      { skill: selectedSkill, value: 1, source: sourceKey },
    ];
    feat.dynamicLoreRules = preservedLoreRules;
    return;
  }

  const selectedLore = grantsSkillTraining ? normalizeSelectedLoreChoice(value) : null;
  if (selectedLore) {
    feat.dynamicSkillRules = preservedRules;
    feat.dynamicLoreRules = [
      ...preservedLoreRules,
      { skill: selectedLore, value: 1, source: sourceKey },
    ];
    return;
  }

  if (typeof value !== 'string' || !value.startsWith('Compendium.')) {
    feat.dynamicSkillRules = preservedRules;
    feat.dynamicLoreRules = preservedLoreRules;
    return;
  }

  if (typeof fromUuid !== 'function') {
    feat.dynamicSkillRules = preservedRules;
    feat.dynamicLoreRules = preservedLoreRules;
    return;
  }

  const selectedItem = await fromUuid(value).catch(() => null);
  if (!selectedItem) {
    feat.dynamicSkillRules = preservedRules;
    feat.dynamicLoreRules = preservedLoreRules;
    return;
  }

  const { extractFeatSkillRules } = await import('./index.js');
  const selectedRules = await extractFeatSkillRules(selectedItem).catch(() => []);
  feat.dynamicSkillRules = [
    ...preservedRules,
    ...selectedRules.map((rule) => ({
      ...rule,
      source: sourceKey,
    })),
  ];
  feat.dynamicLoreRules = preservedLoreRules;
}

function normalizeSelectedSkillChoice(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const aliases = {
    acr: 'acrobatics',
    arc: 'arcana',
    ath: 'athletics',
    cra: 'crafting',
    dec: 'deception',
    dip: 'diplomacy',
    itm: 'intimidation',
    med: 'medicine',
    nat: 'nature',
    occ: 'occultism',
    prf: 'performance',
    rel: 'religion',
    soc: 'society',
    ste: 'stealth',
    sur: 'survival',
    thi: 'thievery',
  };

  const candidate = aliases[normalized] ?? normalized;
  return SKILLS.includes(candidate) ? candidate : null;
}

function normalizeSelectedLoreChoice(value) {
  const normalizedName = normalizeLoreSkillName(value);
  if (!normalizedName) return null;
  const slug = slugifyLoreSkillName(normalizedName);
  if (!slug || SKILLS.includes(slug)) return null;
  return slug;
}
