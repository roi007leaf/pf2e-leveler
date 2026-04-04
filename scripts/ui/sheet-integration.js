import { MODULE_ID } from '../constants.js';
import { ClassRegistry } from '../classes/registry.js';
import { localize } from '../utils/i18n.js';
import { LevelPlanner } from './level-planner/index.js';
import { CharacterWizard } from './character-wizard/index.js';

export function registerSheetIntegration() {
  Hooks.on('renderCharacterSheetPF2e', onRenderCharacterSheet);
}

function isSupportedClass(actor) {
  const actorClass = actor.class;
  if (!actorClass) return false;
  return ClassRegistry.has(actorClass.slug);
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
  const closeBtn = windowHeader.find('button.close, a.close, .header-button.close, [data-action="close"]').first();

  if (isLevel1WithoutClass(actor)) {
    const createTitle = localize('CREATION.BUTTON');
    const createBtn = $(`
      <a class="pf2e-leveler-create-btn header-control" data-tooltip="${createTitle}" title="${createTitle}" role="button">
        <i class="fas fa-wand-magic-sparkles"></i>
      </a>
    `);
    createBtn.on('click', () => openWizard(actor));
    if (closeBtn.length) closeBtn.before(createBtn);
    else windowHeader.append(createBtn);
  }

  if (isSupportedClass(actor)) {
    const planTitle = localize('UI.OPEN_PLANNER');
    const planBtn = $(`
      <a class="pf2e-leveler-plan-btn header-control" data-tooltip="${planTitle}" title="${planTitle}" role="button">
        <i class="fas fa-arrow-up-right-dots"></i>
      </a>
    `);
    planBtn.on('click', () => openPlanner(actor));
    if (closeBtn.length) closeBtn.before(planBtn);
    else windowHeader.append(planBtn);
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
