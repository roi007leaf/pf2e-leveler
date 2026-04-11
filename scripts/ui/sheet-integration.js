import { MODULE_ID } from '../constants.js';
import { ensureActorClassRegistered, ensureClassRegistry } from '../classes/ensure.js';
import { ClassRegistry } from '../classes/registry.js';
import { localize } from '../utils/i18n.js';
import { LevelPlanner } from './level-planner/index.js';
import { CharacterWizard } from './character-wizard/index.js';

export function registerSheetIntegration() {
  Hooks.on('renderCharacterSheetPF2e', onRenderCharacterSheet);
  Hooks.on('renderSpellPreparationSheet', onRenderSpellPreparationSheet);
  Hooks.on('renderSpellPreparationSheetPF2e', onRenderSpellPreparationSheet);
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

function canOpenCreationWizard(actor) {
  return actor?.type === 'character';
}

function getCreationButtonTitle(actor) {
  return isWithoutClass(actor)
    ? localize('CREATION.BUTTON')
    : localize('CREATION.EDIT_BUTTON');
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

  if (canOpenCreationWizard(actor)) {
    const createTitle = getCreationButtonTitle(actor);
    const createBtn = $(`
      <a class="pf2e-leveler-create-btn header-control" data-tooltip="${createTitle}" data-tooltip="${createTitle}" role="button">
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
      <a class="pf2e-leveler-plan-btn header-control" data-tooltip="${planTitle}" data-tooltip="${planTitle}" role="button">
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

async function openWizard(actor) {
  const existing = Object.values(ui.windows).find(
    (w) => w instanceof CharacterWizard && w.actor.id === actor.id,
  );
  if (existing) {
    existing.bringToTop();
    return;
  }
  await new CharacterWizard(actor).render(true);
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

export { canOpenCreationWizard, getCreationButtonTitle };
