import { clearLevelFeat, clearLevelReminders, getLevelData, removeLevelSpell, setLevelSkillIncrease } from '../../plan/plan-model.js';
import { computeBuildState } from '../../plan/build-state.js';

export function activateLevelPlannerListeners(planner, html) {
  const el = html.querySelectorAll ? html : html[0];

  el.querySelectorAll('[data-action="selectLevel"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const level = Number(e.currentTarget.dataset.level);
      planner.selectedLevel = level;
      planner.render(true);
    });
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

  el.querySelectorAll('[data-action="toggleIntBonusLanguage"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const language = btn.dataset.language;
      if (!language) return;
      planner._handleIntBonusLanguageToggle(language);
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
      const slug = btn.dataset.skill;
      if (!slug) return;
      const buildState = computeBuildState(planner.actor, planner.plan, planner.selectedLevel - 1);
      const currentRank = buildState.skills[slug] ?? 0;
      setLevelSkillIncrease(planner.plan, planner.selectedLevel, {
        skill: slug,
        toRank: currentRank + 1,
      });
      planner._savePlanAndRender();
    });
  });

  el.querySelectorAll('[data-action="openSpellPicker"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rank = Number(btn.dataset.rank);
      planner._openSpellPicker(rank);
    });
  });

  el.querySelectorAll('[data-action="removeSpell"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uuid = btn.dataset.uuid;
      removeLevelSpell(planner.plan, planner.selectedLevel, uuid);
      planner._savePlanAndRender();
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
}
