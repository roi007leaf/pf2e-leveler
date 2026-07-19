import { MODULE_ID } from '../constants.js';
import { ensureActorClassRegistered, ensureClassRegistry } from '../classes/ensure.js';
import { ClassRegistry } from '../classes/registry.js';
import { localize } from '../utils/i18n.js';
import { ensureLevelerTemplatesLoaded } from './template-preload.js';
import { LevelPlanner } from './level-planner/index.js';
import { CharacterWizard } from './character-wizard/index.js';
import { renderApplicationInFront, scheduleBringApplicationToFront } from './shared/window-focus.js';
import { canCommentOnActor, countAwaitingComments } from '../access/plan-comments.js';

const PLANNER_WINDOW_SELECTORS = ['#pf2e-leveler-planner', '.pf2e-leveler.level-planner'];
const WIZARD_WINDOW_SELECTORS = ['#pf2e-leveler-wizard', '.pf2e-leveler.character-wizard'];
const APPLICATION_ROOT_SELECTOR = '.application, .app, .window-app';

export function registerSheetIntegration() {
  Hooks.on('renderCharacterSheetPF2e', onRenderCharacterSheet);
  Hooks.on('renderSpellPreparationSheet', onRenderSpellPreparationSheet);
  Hooks.on('renderSpellPreparationSheetPF2e', onRenderSpellPreparationSheet);
}

export function registerLevelerKeybindings() {
  if (!game.keybindings?.register) return;

  game.keybindings.register(MODULE_ID, 'openLevelerForCharacter', {
    name: 'PF2E_LEVELER.KEYBINDINGS.OPEN_LEVELER.NAME',
    hint: 'PF2E_LEVELER.KEYBINDINGS.OPEN_LEVELER.HINT',
    editable: [{ key: 'KeyL', modifiers: ['Shift'] }],
    precedence: globalThis.CONST?.KEYBINDING_PRECEDENCE?.NORMAL ?? 0,
    restricted: false,
    onDown: () => {
      const actor = resolveLevelerShortcutActor();
      if (!actor) {
        ui.notifications.warn(localize('KEYBINDINGS.NO_ACTOR'));
        return false;
      }

      void openLevelerForActor(actor);
      return true;
    },
  });
}

export function resolveLevelerShortcutActor() {
  const controlledActors = uniqueUsableActors(
    (canvas?.tokens?.controlled ?? []).map((token) => token?.actor),
  );
  if (controlledActors.length === 1) return controlledActors[0];

  const assignedActor = game.user?.character;
  if (canUseLevelerForActor(assignedActor)) return assignedActor;

  const worldActors = game.actors?.contents ?? Array.from(game.actors ?? []);
  const usableActors = uniqueUsableActors(worldActors);
  return usableActors.length === 1 ? usableActors[0] : null;
}

function uniqueUsableActors(actors) {
  const unique = new Map();
  for (const actor of actors ?? []) {
    if (!canUseLevelerForActor(actor)) continue;
    unique.set(actor.id ?? actor.uuid, actor);
  }
  return [...unique.values()];
}

async function openLevelerForActor(actor) {
  if (!canUseLevelerForActor(actor)) return false;
  if (isSupportedClass(actor)) {
    await openPlanner(actor);
    return true;
  }
  if (canOpenCreationWizard(actor)) {
    await openWizard(actor);
    return true;
  }
  return false;
}

export function isSupportedClass(actor) {
  const actorClass = actor.class;
  if (!actorClass) return false;
  ensureClassRegistry();
  ensureActorClassRegistered(actor);
  return ClassRegistry.has(actorClass.slug);
}

function isWithoutClass(actor) {
  return !actor.class;
}

function canUseLevelerForActor(actor) {
  if (!actor || actor.type !== 'character') return false;
  if (game.user?.isGM === true) return true;
  if (actor.isOwner === true) return true;
  return actor.testUserPermission?.(game.user, 'OWNER') === true;
}

function canOpenCreationWizard(actor) {
  return actor?.type === 'character' && canUseLevelerForActor(actor) && !shouldRedirectCreationWizardToPlanner(actor);
}

function shouldRedirectCreationWizardToPlanner(actor) {
  const actorLevel = Number(actor?.system?.details?.level?.value ?? 1);
  return actorLevel > 1 && Boolean(actor?.ancestry) && Boolean(actor?.class);
}

function getCreationButtonTitle(actor) {
  return isWithoutClass(actor)
    ? localize('CREATION.BUTTON')
    : localize('CREATION.EDIT_BUTTON');
}

// Attach an "awaiting your reply" comment badge to a launch button, scoped to that
// tool's threads ('level' for the planner, 'creation' for the wizard). Stateless: a
// thread awaits you when the other party posted last and it is unresolved.
function addCommentBadge(button, actor, scope) {
  if (!canCommentOnActor(actor)) return;
  const count = countAwaitingComments(actor, { forGM: game.user?.isGM === true, scope });
  if (count <= 0) return;
  const tooltip = game.i18n.format('PF2E_LEVELER.PLAN_COMMENTS.BADGE_AWAITING', { count });
  button.append(`<span class="pf2e-leveler-comment-badge" data-tooltip="${tooltip}">${count}</span>`);
}

function onRenderCharacterSheet(sheet, html) {
  if (!game.settings.get(MODULE_ID, 'showPlanButton')) return;

  const actor = sheet.actor;
  if (actor.type !== 'character') return;

  const appNode = getClosestApplicationElement(html);
  if (!isActorCharacterSheetApplication(appNode, actor)) return;

  const appElement = $(appNode);

  appElement.find('.pf2e-leveler-plan-btn').remove();
  appElement.find('.pf2e-leveler-create-btn').remove();
  if (!canUseLevelerForActor(actor)) return;

  const windowHeader = appElement.find('.window-header');
  const closeBtn = windowHeader.find('button.close, a.close, .header-button.close, [data-action="close"]').first();

  if (canOpenCreationWizard(actor)) {
    const createTitle = getCreationButtonTitle(actor);
    const createBtn = $(`
      <a class="pf2e-leveler-create-btn header-control" data-tooltip="${createTitle}" title="${createTitle}" aria-label="${createTitle}" role="button">
        <i class="fas fa-wand-magic-sparkles"></i>
      </a>
    `);
    createBtn.on('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openWizard(actor, getApplicationElementFromEvent(event));
    });
    addCommentBadge(createBtn, actor, 'creation');
    if (closeBtn.length) closeBtn.before(createBtn);
    else windowHeader.append(createBtn);
  }

  if (isSupportedClass(actor)) {
    const planTitle = localize('UI.OPEN_PLANNER');
    const planBtn = $(`
      <a class="pf2e-leveler-plan-btn header-control" data-tooltip="${planTitle}" title="${planTitle}" aria-label="${planTitle}" role="button">
        <i class="fas fa-arrow-up-right-dots"></i>
      </a>
    `);
    planBtn.on('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openPlanner(actor, getApplicationElementFromEvent(event));
    });
    addCommentBadge(planBtn, actor, 'level');
    if (closeBtn.length) closeBtn.before(planBtn);
    else windowHeader.append(planBtn);
  }
}

function getApplicationElementFromEvent(event) {
  const element = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  return element?.closest(APPLICATION_ROOT_SELECTOR) ?? null;
}

function getClosestApplicationElement(html) {
  return getElement(html)?.closest?.(APPLICATION_ROOT_SELECTOR) ?? null;
}

function getActorSheetSelectors(actor) {
  const actorId = String(actor?.id ?? '').trim();
  return actorId ? [`#CharacterSheetPF2e-Actor-${cssIdentifierEscape(actorId)}`] : [];
}

function getActorSheetElementId(actor) {
  const actorId = String(actor?.id ?? '').trim();
  return actorId ? `CharacterSheetPF2e-Actor-${actorId}` : '';
}

function isActorCharacterSheetApplication(appElement, actor) {
  const element = getElement(appElement);
  if (!element || isPF2eAttackPopoutElement(element)) return false;

  const expectedId = getActorSheetElementId(actor);
  if (expectedId && element.id === expectedId) return true;

  if (isPF2eHudElement(element)) return false;

  return (element.classList.contains('window-app') || element.classList.contains('application'))
    && element.classList.contains('sheet')
    && element.classList.contains('actor')
    && element.classList.contains('character');
}

function getElement(elementLike) {
  if (elementLike instanceof HTMLElement) return elementLike;
  return elementLike?.[0] ?? elementLike?.get?.(0) ?? null;
}

function showLevelerLaunchOverlay({ title, text } = {}) {
  const doc = globalThis.document;
  if (!doc?.body) return () => {};

  doc.querySelector('[data-pf2e-leveler-launch-overlay="planner"]')?.remove();

  const overlay = doc.createElement('div');
  overlay.className = 'pf2e-leveler-launch-overlay';
  overlay.dataset.pf2eLevelerLaunchOverlay = 'planner';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const card = doc.createElement('div');
  card.className = 'pf2e-leveler-launch-overlay__card';
  overlay.append(card);

  const spinner = doc.createElement('div');
  spinner.className = 'pf2e-leveler-launch-overlay__spinner';
  spinner.setAttribute('aria-hidden', 'true');
  card.append(spinner);

  const titleElement = doc.createElement('div');
  titleElement.className = 'pf2e-leveler-launch-overlay__title';
  titleElement.textContent = String(title ?? '');
  card.append(titleElement);

  const textElement = doc.createElement('div');
  textElement.className = 'pf2e-leveler-launch-overlay__text';
  textElement.textContent = String(text ?? '');
  card.append(textElement);

  doc.body.append(overlay);
  return () => overlay.remove();
}

function waitForLaunchOverlayPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
      return;
    }
    setTimeout(resolve, 0);
  });
}

function isPF2eHudElement(element) {
  return Boolean(
    element.matches?.('[class*="pf2e-hud"], [class*="pf2e-token-hud"]')
    || element.closest?.('[id*="pf2e-hud"], [id*="pf2e-token-hud"]'),
  );
}

function isPF2eAttackPopoutElement(element) {
  return element.classList.contains('attack-popout') || element.id.startsWith('AttackPopout-');
}

function cssIdentifierEscape(value) {
  if (globalThis.CSS?.escape) return CSS.escape(value);
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function openPlanner(actor, openerElement = null) {
  if (!canUseLevelerForActor(actor)) return;

  const lowerSelectors = getActorSheetSelectors(actor);
  const existing = Object.values(ui.windows).find(
    (w) => w instanceof LevelPlanner && w.actor.id === actor.id,
  );
  if (existing) {
    existing.setFocusAnchor?.(openerElement);
    scheduleBringApplicationToFront(existing, {
      lowerElement: openerElement,
      lowerSelectors,
      selectors: PLANNER_WINDOW_SELECTORS,
    });
    return;
  }

  const dismissLaunchOverlay = showLevelerLaunchOverlay({
    title: localize('UI.OPEN_PLANNER'),
    text: localize('UI.LOADING_PLANNER_DATA'),
  });
  try {
    await waitForLaunchOverlayPaint();
    await ensureLevelerTemplatesLoaded();
    const renderResult = renderApplicationInFront(new LevelPlanner(actor).setFocusAnchor(openerElement), true, {
      lowerElement: openerElement,
      lowerSelectors,
      selectors: PLANNER_WINDOW_SELECTORS,
    });
    if (typeof renderResult?.then === 'function') await renderResult;
    else await waitForLaunchOverlayPaint();
  } finally {
    dismissLaunchOverlay();
  }
}

async function openWizard(actor, openerElement = null) {
  if (!canUseLevelerForActor(actor)) return;

  await ensureLevelerTemplatesLoaded();
  const lowerSelectors = getActorSheetSelectors(actor);
  if (shouldRedirectCreationWizardToPlanner(actor)) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CREATION.HIGHER_LEVEL_REDIRECT_TITLE') },
      content: `<p>${localize('CREATION.HIGHER_LEVEL_REDIRECT_BODY')}</p>`,
      modal: true,
    });
    if (confirmed) await openPlanner(actor, openerElement);
    return;
  }

  const existing = Object.values(ui.windows).find(
    (w) => w instanceof CharacterWizard && w.actor.id === actor.id,
  );
  if (existing) {
    existing.setFocusAnchor?.(openerElement);
    scheduleBringApplicationToFront(existing, {
      lowerElement: openerElement,
      lowerSelectors,
      selectors: WIZARD_WINDOW_SELECTORS,
    });
    return;
  }
  renderApplicationInFront(new CharacterWizard(actor).setFocusAnchor(openerElement), true, {
    lowerElement: openerElement,
    lowerSelectors,
    selectors: WIZARD_WINDOW_SELECTORS,
  });
}

function onRenderSpellPreparationSheet(app, html) {
  const actor = app.actor ?? app.object?.actor ?? app.document?.actor ?? null;
  if (!actor || actor.type !== 'character') return;

  const root = html?.jquery ? html : $(html);
  const entryId = root.find('.spell-list').data('entryId');
  if (!entryId) return;

  const entry = actor.items?.get?.(entryId) ?? actor.items?.find?.((item) => item.id === entryId);
  if (!entry || entry.type !== 'spellcastingEntry') return;
  if (entry.system?.prepared?.value !== 'prepared') return;

  const tradition = entry.system?.tradition?.value ?? null;
  if (!tradition) return;

  root.find('.pf2e-leveler-add-tradition-spell').remove();

  root.find('.header-row').each((_, row) => {
    const $row = $(row);
    const controls = $row.find('.item-controls').first();
    if (controls.length === 0) return;

    const groupId = $row.find('[data-group-id]').first().data('groupId');
    const rank = normalizePreparationGroupRank(groupId);
    if (rank === null) return;

    const button = $(`
      <a class="pf2e-leveler-add-tradition-spell"
         data-tooltip="${localize('SPELLS.ADD_TO_SPELLBOOK')}"
         aria-label="${localize('SPELLS.ADD_TO_SPELLBOOK')}">
        <i class="fa-solid fa-book-medical fa-fw"></i>
      </a>
    `);

    button.on('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await openPreparationSpellPicker({ actor, app, entry, tradition, rank });
    });

    controls.append(button);
  });
}

async function openPreparationSpellPicker({ actor, app, entry, tradition, rank }) {
  const { SpellPicker } = await import('./spell-picker.js');
  const picker = new SpellPicker(actor, tradition, rank, async (spells) => {
    const list = Array.isArray(spells) ? spells : [spells];
    await addSpellsToEntry(actor, entry, list);
    app.render?.(true);
  }, { exactRank: true, multiSelect: true, excludeOwnedByIdentity: true });
  picker.render(true);
}

async function addSpellsToEntry(actor, entry, spells) {
  const existingSourceIds = new Set(
    (actor.items ?? [])
      .filter((item) => item.type === 'spell' && item.system?.location?.value === entry.id)
      .map((item) => item.sourceId ?? item.flags?.core?.sourceId ?? item.uuid),
  );

  const toCreate = [];
  for (const spell of spells) {
    const sourceUuid = spell?.uuid ?? null;
    if (!sourceUuid || existingSourceIds.has(sourceUuid)) continue;
    const spellDoc = await fromUuid(sourceUuid).catch(() => null);
    const spellData = foundry.utils.deepClone((spellDoc ?? spell)?.toObject?.() ?? spell);
    if (!spellData) continue;
    spellData.system ??= {};
    spellData.system.location = { value: entry.id };
    toCreate.push(spellData);
    existingSourceIds.add(sourceUuid);
  }

  if (toCreate.length === 0) return [];
  return actor.createEmbeddedDocuments('Item', toCreate);
}

export function normalizePreparationGroupRank(groupId) {
  const normalized = String(groupId ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (['cantrip', 'cantrips'].includes(normalized)) return 0;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return null;
}

export {
  canOpenCreationWizard,
  getCreationButtonTitle,
  isActorCharacterSheetApplication,
  shouldRedirectCreationWizardToPlanner,
};
