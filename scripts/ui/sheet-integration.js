import { MODULE_ID } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { localize } from '../utils/i18n.js';
import { LevelPlanner } from './level-planner.js';
import { CharacterWizard } from './character-wizard.js';

export function registerSheetIntegration() {
  Hooks.on('renderCharacterSheetPF2e', onRenderCharacterSheet);
}

function isSupportedClass(actor) {
  const actorClass = actor.class;
  if (!actorClass) return false;
  const slug = actorClass.slug ?? actorClass.name?.toLowerCase().replace(/\s+/g, '-');
  return ClassRegistry.has(slug);
}

function isLevel1WithoutClass(actor) {
  return actor.system?.details?.level?.value === 1 && !actor.class;
}

function onRenderCharacterSheet(sheet, html) {
  if (!game.settings.get(MODULE_ID, 'showPlanButton')) return;

  const actor = sheet.actor;
  if (actor.type !== 'character') return;

  const appElement = html.closest('.app');
  appElement.find('.pf2e-leveler-plan-btn').remove();
  appElement.find('.pf2e-leveler-create-btn').remove();

  const windowHeader = appElement.find('.window-header');
  const windowTitle = windowHeader.find('.window-title');

  if (isLevel1WithoutClass(actor)) {
    const createTitle = localize('CREATION.BUTTON');
    const createBtn = $(`
      <button type="button" class="pf2e-leveler-create-btn header-control" data-tooltip="${createTitle}">
        <i class="fas fa-wand-magic-sparkles"></i>
      </button>
    `);
    createBtn.on('click', () => openWizard(actor));
    windowTitle.after(createBtn);
  }

  if (isSupportedClass(actor)) {
    const planTitle = localize('UI.OPEN_PLANNER');
    const planBtn = $(`
      <button type="button" class="pf2e-leveler-plan-btn header-control" data-tooltip="${planTitle}">
        <i class="fas fa-arrow-up-right-dots"></i>
      </button>
    `);
    planBtn.on('click', () => openPlanner(actor));
    windowTitle.after(planBtn);
  }
}

function openPlanner(actor) {
  const existing = Object.values(ui.windows).find(
    (w) => w instanceof LevelPlanner && w.actor.id === actor.id,
  );
  if (existing) {
    existing.bringToTop();
    return;
  }
  new LevelPlanner(actor).render(true);
}

function openWizard(actor) {
  const existing = Object.values(ui.windows).find(
    (w) => w instanceof CharacterWizard && w.actor.id === actor.id,
  );
  if (existing) {
    existing.bringToTop();
    return;
  }
  new CharacterWizard(actor).render(true);
}
