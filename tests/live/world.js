import { documentRunMarker, ownedDocumentIds, validateRunId } from './ownership.mjs';

const MODULE_ID = 'pf2e-leveler';
const MARKER = 'liveTestRun';

function variantSettings() {
  return {
    freeArchetype: { namespace: game.system.id, key: 'freeArchetypeVariant', off: false, on: true },
    ancestralParagon: { namespace: MODULE_ID, key: 'ancestralParagon', off: false, on: true },
    mythic: { namespace: game.system.id, key: 'mythic', off: 'disabled', on: 'enabled' },
    abp: {
      namespace: game.system.id,
      key: 'automaticBonusVariant',
      off: 'noABP',
      on: 'ABPFundamentalPotency',
    },
    gradualBoosts: { namespace: game.system.id, key: 'gradualBoostsVariant', off: false, on: true },
    dualClass: { namespace: MODULE_ID, key: 'enableDualClassSupport', off: false, on: true },
  };
}

function requireGm() {
  if (!game.user?.isGM) throw Error('QA GM required');
}

function requireWorld(world) {
  if (game.world?.id !== world) throw Error('Disposable-world identity changed');
}

function requireRegisteredSetting({ namespace, key }) {
  if (!game.settings.settings.has(`${namespace}.${key}`)) {
    throw Error(`Required variant setting is unavailable: ${namespace}.${key}`);
  }
}

export function snapshotVariantSettings({ world }) {
  requireGm();
  requireWorld(world);
  return Object.values(variantSettings()).map(({ namespace, key }) => {
    requireRegisteredSetting({ namespace, key });
    return { namespace, key, value: foundry.utils.deepClone(game.settings.get(namespace, key)) };
  });
}

export async function restoreVariantSettings({ world, settings }) {
  requireGm();
  requireWorld(world);
  if (settings === undefined) return { restored: 0 };
  if (!Array.isArray(settings)) throw Error('Variant settings recovery snapshot is invalid');
  for (const setting of settings) {
    const { namespace, key, value } = setting ?? {};
    const allowed = Object.values(variantSettings()).some(
      (entry) => entry.namespace === namespace && entry.key === key,
    );
    if (!allowed) throw Error(`Refusing to restore unowned setting: ${namespace}.${key}`);
    requireRegisteredSetting({ namespace, key });
    if (game.settings.get(namespace, key) !== value) await game.settings.set(namespace, key, value);
  }
  return { restored: settings.length };
}

export function verifyVariantSettings({ world, settings }) {
  requireGm();
  requireWorld(world);
  if (settings === undefined) return { restored: true };
  if (!Array.isArray(settings)) throw Error('Variant settings recovery snapshot is invalid');
  const mismatches = settings.filter(({ namespace, key, value }) => {
    const allowed = Object.values(variantSettings()).some(
      (entry) => entry.namespace === namespace && entry.key === key,
    );
    if (!allowed) throw Error(`Refusing to verify unowned setting: ${namespace}.${key}`);
    requireRegisteredSetting({ namespace, key });
    return game.settings.get(namespace, key) !== value;
  });
  return {
    restored: mismatches.length === 0,
    mismatches: mismatches.map(({ namespace, key }) => `${namespace}.${key}`),
  };
}

async function configureVariant(world, enabledVariant) {
  requireGm();
  requireWorld(world);
  const entries = variantSettings();
  if (!Object.hasOwn(entries, enabledVariant)) throw Error(`Unknown variant: ${enabledVariant}`);
  for (const [name, setting] of Object.entries(entries)) {
    requireRegisteredSetting(setting);
    const value = name === enabledVariant ? setting.on : setting.off;
    if (game.settings.get(setting.namespace, setting.key) !== value) {
      await game.settings.set(setting.namespace, setting.key, value);
    }
  }
}

function openApplications() {
  return new Set([
    ...Object.values(ui.windows ?? {}),
    ...(foundry.applications.instances?.values?.() ?? []),
  ]);
}

function applicationDocument(app) {
  return app?.actor ?? app?.document ?? app?.object?.actor ?? app?.object ?? null;
}

export function preflight() {
  return {
    world: game.world?.id,
    user: game.user?.id,
    isGM: game.user?.isGM === true,
    scene: canvas?.scene?.id ?? null,
  };
}

export function environment() {
  return {
    world: game.world?.id,
    core: game.version,
    system: game.system?.id,
    systemVersion: game.system?.version,
    moduleActive: game.modules.get(MODULE_ID)?.active === true,
    moduleVersion: game.modules.get(MODULE_ID)?.version,
    userIsGM: game.user?.isGM === true,
    modules: ['sf2e-anachronism', 'pf2e-anachronism'].map((id) => ({
      id,
      active: game.modules.get(id)?.active === true,
    })),
  };
}

export async function setModuleActive({ world, active }) {
  requireGm();
  requireWorld(world);
  if (typeof active !== 'boolean') throw Error('Module activation requires boolean state');
  const current = foundry.utils.deepClone(game.settings.get('core', 'moduleConfiguration') ?? {});
  const previous = current[MODULE_ID] === true;
  if (active) current[MODULE_ID] = true;
  else delete current[MODULE_ID];
  await game.settings.set('core', 'moduleConfiguration', current);
  return { previous, active: current[MODULE_ID] === true };
}

export async function createFixture({ runId, playerId }) {
  requireGm();
  validateRunId(runId);
  const actor = await Actor.create({
    name: `Leveler QA ${runId.slice(0, 8)}`,
    type: 'character',
    ownership: {
      default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
      [playerId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    },
    flags: { [MODULE_ID]: { [MARKER]: runId } },
  });
  return { actor: actor.id };
}

export async function createPlannerFixture(data) {
  const fixture = await createFixture(data);
  const actor = game.actors.get(fixture.actor);
  const pack = game.packs.get(`${game.system.id}.classes`);
  if (!pack) throw Error(`Active system has no classes pack: ${game.system.id}.classes`);
  const index = await pack.getIndex({ fields: ['type', 'system.slug'] });
  const entry =
    index.find(
      (item) =>
        item.type === 'class' && String(item.system?.slug ?? item.name).toLowerCase() === 'fighter',
    ) ?? index.find((item) => item.type === 'class');
  if (!entry) throw Error('Active system classes pack has no class item');
  const classItem = await pack.getDocument(entry._id);
  const source = classItem.toObject();
  delete source._id;
  source.system.items = {};
  source.system.rules = [];
  await actor.createEmbeddedDocuments('Item', [source]);
  return { ...fixture, classSlug: classItem.slug ?? entry.system?.slug };
}

export async function createSpellbookFixture(data) {
  const fixture = await createFixture(data);
  const actor = game.actors.get(fixture.actor);
  const [entry] = await actor.createEmbeddedDocuments('Item', [
    {
      name: 'Leveler QA Prepared Arcane',
      type: 'spellcastingEntry',
      system: {
        ability: { value: 'int' },
        tradition: { value: 'arcane' },
        prepared: { value: 'prepared' },
        proficiency: { value: 1 },
        showSlotlessLevels: { value: true },
        slots: {
          slot0: { prepared: [], value: 5, max: 5 },
          slot1: { prepared: [], value: 2, max: 2 },
        },
      },
    },
  ]);
  if (!entry) throw Error('Prepared spellcasting entry fixture was not created');
  return { ...fixture, entry: entry.id };
}

function ownedActor({ runId, actor }) {
  validateRunId(runId);
  const document = game.actors.get(actor);
  if (!document || documentRunMarker(document, MODULE_ID, MARKER) !== runId)
    throw Error('Actor is outside live-test fixture');
  return document;
}

function wizardFor(data) {
  const actor = ownedActor(data);
  const wizard = [...openApplications()].find(
    (app) =>
      (app?.options?.id === 'pf2e-leveler-wizard' || app?.id === 'pf2e-leveler-wizard') &&
      app.actor?.id === actor.id,
  );
  if (!wizard) throw Error('Character wizard is not open for fixture actor');
  return wizard;
}

async function waitFor(check, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(message);
}

async function waitForWizard(data) {
  return waitFor(
    () => {
      try {
        const wizard = wizardFor(data);
        return !wizard._isBooting && wizard.element?.querySelector('.wizard-content')
          ? wizard
          : null;
      } catch {
        return null;
      }
    },
    'Character wizard did not finish rendering',
    90000,
  );
}

async function clickWizardStep(wizard, stepId) {
  const visibleIndex = wizard.visibleSteps.indexOf(stepId);
  if (visibleIndex < 0) throw Error(`Wizard step is unavailable: ${stepId}`);
  const button = wizard.element?.querySelectorAll('[data-action="goToStep"]')?.[visibleIndex];
  if (!button) throw Error(`Wizard step control missing: ${stepId}`);
  button.click();
  await waitFor(
    () =>
      wizard.stepId === stepId &&
      wizard.element?.querySelector(
        `.wizard-content[data-comment-part="creation:${CSS.escape(stepId)}"]`,
      ),
    `Wizard did not navigate to ${stepId}`,
  );
}

function selectableItemButtons(wizard) {
  return [...(wizard.element?.querySelectorAll('[data-action="selectItem"]') ?? [])].filter(
    (entry) => !entry.disabled && entry.offsetParent !== null,
  );
}

async function clickItemByUuid(wizard, uuid) {
  const button = [...(wizard.element?.querySelectorAll('[data-action="selectItem"]') ?? [])].find(
    (entry) => entry.dataset.uuid === uuid && !entry.disabled && entry.offsetParent !== null,
  );
  if (!button) throw Error(`No selectable wizard item for ${uuid}`);
  button.click();
  await waitFor(
    () =>
      wizard.data.ancestry?.uuid === uuid ||
      wizard.data.heritage?.uuid === uuid ||
      wizard.data.background?.uuid === uuid ||
      wizard.data.class?.uuid === uuid ||
      wizard.data.subclass?.uuid === uuid,
    `Wizard selection did not persist for ${uuid}`,
  );
  const selectedKey = ['ancestry', 'heritage', 'background', 'class', 'subclass'].find(
    (key) => wizard.data[key]?.uuid === uuid,
  );
  if (!selectedKey) throw Error(`Wizard selection has no persisted field for ${uuid}`);
  await waitFor(
    () => wizard.actor.getFlag(MODULE_ID, 'creation')?.[selectedKey]?.uuid === uuid,
    `Wizard selection did not save to actor for ${uuid}`,
  );
}

function catalogEntries(wizard, action = 'selectItem', stepId = null) {
  const root = stepId
    ? wizard.element?.querySelector(
        `.wizard-content[data-comment-part="creation:${CSS.escape(stepId)}"]`,
      )
    : wizard.element;
  return [...(root?.querySelectorAll(`[data-action="${action}"]`) ?? [])]
    .filter((entry) => !entry.disabled && entry.offsetParent !== null)
    .map((entry) => ({
      uuid: entry.dataset.uuid ?? null,
      name:
        entry.closest('.wizard-item')?.querySelector('.wizard-item__name')?.textContent?.trim() ??
        null,
      target: entry.dataset.target ?? null,
    }));
}

async function waitForCatalogEntries(wizard, stepId, action = 'selectItem') {
  const expectedType = {
    ancestry: 'ancestry',
    heritage: 'heritage',
    background: 'background',
    class: 'class',
    subclass: 'feat',
  }[stepId];
  return waitFor(
    async () => {
      const entries = catalogEntries(wizard, action, stepId);
      if (!entries.length) return null;
      if (!expectedType) return entries;
      const documents = await Promise.all(
        entries.map((entry) => fromUuid(entry.uuid).catch(() => null)),
      );
      const allExpected = documents.every(
        (document, index) =>
          document?.type === expectedType ||
          (stepId === 'heritage' && entries[index].uuid?.startsWith(`${MODULE_ID}.synthetic.`)),
      );
      return allExpected ? entries : null;
    },
    `No selectable catalog entries rendered for ${stepId}`,
    90000,
  );
}

async function clickSubclassByUuid(wizard, uuid) {
  const button = [
    ...(wizard.element?.querySelectorAll('[data-action="selectSubclass"]') ?? []),
  ].find((entry) => entry.dataset.uuid === uuid && !entry.disabled && entry.offsetParent !== null);
  if (!button) throw Error(`No selectable wizard subclass for ${uuid}`);
  const target = button.dataset.target ?? 'class';
  button.click();
  await waitFor(
    () => (target === 'dualClass' ? wizard.data.dualSubclass : wizard.data.subclass)?.uuid === uuid,
    `Wizard subclass selection did not persist for ${uuid}`,
  );
  const key = target === 'dualClass' ? 'dualSubclass' : 'subclass';
  await waitFor(
    () => wizard.actor.getFlag(MODULE_ID, 'creation')?.[key]?.uuid === uuid,
    `Wizard subclass selection did not save to actor for ${uuid}`,
  );
}

async function selectSubclassChoiceButton(wizard, choice) {
  const button = [
    ...(wizard.element?.querySelectorAll('[data-action="selectSubclassChoice"]') ?? []),
  ].find(
    (entry) =>
      entry.dataset.flag === choice.flag &&
      entry.dataset.value === choice.value &&
      (entry.dataset.target ?? 'class') === choice.target &&
      !entry.disabled,
  );
  if (!button) throw Error(`No selectable subclass choice for ${choice.flag}:${choice.value}`);
  button.click();
  const subclassKey = choice.target === 'dualClass' ? 'dualSubclass' : 'subclass';
  await waitFor(
    () => wizard.data[subclassKey]?.choices?.[choice.flag] === choice.value,
    `Subclass choice did not persist for ${choice.flag}:${choice.value}`,
  );
  await waitFor(
    () =>
      wizard.actor.getFlag(MODULE_ID, 'creation')?.[subclassKey]?.choices?.[choice.flag] ===
      choice.value,
    `Subclass choice did not save to actor for ${choice.flag}:${choice.value}`,
  );
}

async function selectFirstItem(wizard, stepId) {
  await clickWizardStep(wizard, stepId);
  const button = await waitFor(
    () => selectableItemButtons(wizard)[0],
    `No selectable item rendered for ${stepId}`,
  );
  await clickItemByUuid(wizard, button.dataset.uuid);
  if (!wizard._isStepComplete(stepId)) throw Error(`Selected ${stepId} did not complete step`);
}

async function selectClass(wizard, preferredSlug = null) {
  await clickWizardStep(wizard, 'class');
  const buttons = await waitFor(
    () => selectableItemButtons(wizard).length && selectableItemButtons(wizard),
    'No selectable class rendered',
  );
  const entries = await Promise.all(
    buttons.map(async (button) => ({
      button,
      document: await fromUuid(button.dataset.uuid).catch(() => null),
    })),
  );
  const selection =
    entries.find((entry) => entry.document?.slug === preferredSlug) ??
    entries.find((entry) => entry.document?.type === 'class');
  if (!selection) throw Error('Class catalog rendered without class documents');
  await clickItemByUuid(wizard, selection.button.dataset.uuid);
  return selection.document?.slug ?? wizard.data.class?.slug;
}

function actorSheetSelectors(actor) {
  const actorId = CSS.escape(actor.id);
  return [
    `#CharacterSheetPF2e-Actor-${actorId}`,
    `.application.sheet.actor.character[data-document-id="${actorId}"]`,
    `.window-app.sheet.actor.character[data-document-id="${actorId}"]`,
  ];
}

async function waitForActorSheet(actor) {
  actor.sheet.render(true);
  return waitFor(
    () =>
      actorSheetSelectors(actor)
        .map((selector) => document.querySelector(selector))
        .find(Boolean),
    `Fixture actor sheet did not render: ${actor.id}`,
  );
}

async function openWizardFor(data) {
  const actor = ownedActor(data);
  const sheet = await waitForActorSheet(actor);
  const launch = await waitFor(
    () => sheet.querySelector('.pf2e-leveler-create-btn'),
    'Creation wizard launch button did not render',
  );
  launch.click();
  return waitForWizard(data);
}

function plannerFor(data) {
  const actor = ownedActor(data);
  const planner = [...openApplications()].find(
    (app) =>
      (app?.options?.id === 'pf2e-leveler-planner' || app?.id === 'pf2e-leveler-planner') &&
      app.actor?.id === actor.id,
  );
  if (!planner) throw Error('Level planner is not open for fixture actor');
  return planner;
}

async function openPlannerFor(data) {
  const actor = ownedActor(data);
  const sheet = await waitForActorSheet(actor);
  const launch = await waitFor(
    () => sheet.querySelector('.pf2e-leveler-plan-btn'),
    'Level planner launch button did not render',
  );
  launch.click();
  return waitFor(
    () => {
      try {
        const planner = plannerFor(data);
        return planner.element?.querySelector('.level-planner') ? planner : null;
      } catch {
        return null;
      }
    },
    'Level planner did not finish rendering',
    90000,
  );
}

async function clickPlannerLevel(planner, level) {
  const button = planner.element?.querySelector(
    `[data-action="selectLevel"][data-level="${level}"]`,
  );
  if (!button || button.classList.contains('locked'))
    throw Error(`Planner level is unavailable: ${level}`);
  button.click();
  await waitFor(
    () =>
      planner.selectedLevel === level &&
      planner.element?.querySelector(`[data-action="selectLevel"][data-level="${level}"].active`) &&
      !planner.element?.querySelector('[data-level-planner-loading]'),
    `Planner did not render level ${level}`,
    90000,
  );
}

async function selectCoreCreation(wizard, preferredClass = null) {
  const counts = {};
  for (const stepId of ['ancestry', 'heritage', 'background']) {
    await clickWizardStep(wizard, stepId);
    counts[stepId] = (
      await waitFor(
        () => selectableItemButtons(wizard).length && selectableItemButtons(wizard),
        `No selectable item rendered for ${stepId}`,
      )
    ).length;
    await selectFirstItem(wizard, stepId);
  }
  await clickWizardStep(wizard, 'class');
  counts.class = (
    await waitFor(
      () => selectableItemButtons(wizard).length && selectableItemButtons(wizard),
      'No selectable class rendered',
    )
  ).length;
  await selectClass(wizard, preferredClass);
  return counts;
}

export function actorSnapshot(data) {
  const actor = ownedActor(data);
  return {
    actorType: actor.type,
    ownedByRun: documentRunMarker(actor, MODULE_ID, MARKER) === data.runId,
    isOwner: actor.isOwner === true,
  };
}

export async function creationButton(data) {
  const actor = ownedActor(data);
  const root = await waitForActorSheet(actor);
  return {
    visible:
      root?.querySelector('.pf2e-leveler-create-btn')?.checkVisibility?.() ??
      Boolean(root?.querySelector('.pf2e-leveler-create-btn')),
  };
}

export async function wizardCoreAudit(data) {
  const wizard = await openWizardFor(data);
  const counts = await selectCoreCreation(wizard, data.preferredClass);
  return {
    ancestrySelected: Boolean(wizard.data.ancestry),
    heritageSelected: Boolean(wizard.data.heritage),
    backgroundSelected: Boolean(wizard.data.background),
    classSelected: Boolean(wizard.data.class),
    everyCatalogNonempty: Object.values(counts).every((count) => count > 0),
  };
}

export async function wizardClassCatalogAudit(data) {
  const wizard = await openWizardFor(data);
  for (const stepId of ['ancestry', 'heritage', 'background'])
    await selectFirstItem(wizard, stepId);
  await clickWizardStep(wizard, 'class');
  const entries = await Promise.all(
    [...wizard.element.querySelectorAll('[data-action="selectItem"]')]
      .filter((button) => !button.disabled && button.offsetParent !== null)
      .map(async (button) => ({
        uuid: button.dataset.uuid,
        document: await fromUuid(button.dataset.uuid).catch(() => null),
      })),
  );
  const classes = entries.filter((entry) => entry.document?.type === 'class');
  const results = [];
  for (const entry of classes) {
    await clickWizardStep(wizard, 'class');
    await clickItemByUuid(wizard, entry.uuid);
    results.push({
      slug: wizard.data.class?.slug,
      selected: wizard.data.class?.uuid === entry.uuid,
      visibleSteps: [...wizard.visibleSteps],
    });
  }
  return {
    catalogNonempty: classes.length > 0,
    allClassesSelected:
      results.length === classes.length && results.every((entry) => entry.selected),
    uniqueClassSlugs: new Set(results.map((entry) => entry.slug)).size === results.length,
    everyClassHasCoreSteps: results.every((entry) =>
      ['boosts', 'skills', 'feats', 'equipment', 'summary'].every((step) =>
        entry.visibleSteps.includes(step),
      ),
    ),
    classCount: results.length,
    classes: results,
  };
}

export async function wizardAncestryHeritageCatalogAudit(data) {
  const wizard = await openWizardFor(data);
  await clickWizardStep(wizard, 'ancestry');
  const ancestries = await waitForCatalogEntries(wizard, 'ancestry');
  const results = [];
  for (const ancestry of ancestries) {
    await clickWizardStep(wizard, 'ancestry');
    await clickItemByUuid(wizard, ancestry.uuid);
    await clickWizardStep(wizard, 'heritage');
    const heritages = await waitForCatalogEntries(wizard, 'heritage');
    const heritageResults = [];
    for (const heritage of heritages) {
      await clickWizardStep(wizard, 'heritage');
      await clickItemByUuid(wizard, heritage.uuid);
      heritageResults.push({
        uuid: heritage.uuid,
        name: heritage.name,
        selected: wizard.data.heritage?.uuid === heritage.uuid,
      });
    }
    results.push({
      uuid: ancestry.uuid,
      name: ancestry.name,
      selected: wizard.data.ancestry?.uuid === ancestry.uuid,
      heritageCount: heritages.length,
      heritages: heritageResults,
    });
  }
  return {
    catalogNonempty: ancestries.length > 0,
    allAncestriesSelected:
      results.length === ancestries.length && results.every((entry) => entry.selected),
    everyAncestryHasHeritage: results.every((entry) => entry.heritageCount > 0),
    allHeritageRelationshipsSelected: results.every(
      (entry) =>
        entry.heritages.length === entry.heritageCount &&
        entry.heritages.every((heritage) => heritage.selected),
    ),
    ancestryCount: results.length,
    relationshipCount: results.reduce((count, entry) => count + entry.heritageCount, 0),
    ancestries: results,
  };
}

export async function wizardBackgroundCatalogAudit(data) {
  const wizard = await openWizardFor(data);
  await clickWizardStep(wizard, 'background');
  const backgrounds = await waitForCatalogEntries(wizard, 'background');
  const results = [];
  for (const background of backgrounds) {
    await clickWizardStep(wizard, 'background');
    await clickItemByUuid(wizard, background.uuid);
    results.push({
      uuid: background.uuid,
      name: background.name,
      selected: wizard.data.background?.uuid === background.uuid,
    });
  }
  return {
    catalogNonempty: backgrounds.length > 0,
    allBackgroundsSelected:
      results.length === backgrounds.length && results.every((entry) => entry.selected),
    backgroundCount: results.length,
    backgrounds: results,
  };
}

export async function wizardClassSubclassCatalogAudit(data) {
  const wizard = await openWizardFor(data);
  for (const stepId of ['ancestry', 'heritage', 'background'])
    await selectFirstItem(wizard, stepId);
  await clickWizardStep(wizard, 'class');
  const classes = await waitForCatalogEntries(wizard, 'class');
  const results = [];
  for (const classEntry of classes) {
    await clickWizardStep(wizard, 'class');
    await clickItemByUuid(wizard, classEntry.uuid);
    const hasSubclassStep = wizard.visibleSteps.includes('subclass');
    const subclasses = [];
    if (hasSubclassStep) {
      await clickWizardStep(wizard, 'subclass');
      const subclassCatalog = await waitForCatalogEntries(wizard, 'subclass', 'selectSubclass');
      for (const subclass of subclassCatalog) {
        await clickWizardStep(wizard, 'class');
        await wizard._selectItem(classEntry.uuid);
        await clickWizardStep(wizard, 'subclass');
        await clickSubclassByUuid(wizard, subclass.uuid);
        const choices = [];
        if (wizard.visibleSteps.includes('subclassChoices')) {
          await clickWizardStep(wizard, 'subclassChoices');
          const choiceCatalog = [
            ...wizard.element.querySelectorAll('[data-action="selectSubclassChoice"]'),
          ]
            .filter((button) => !button.disabled)
            .map((button) => ({
              flag: button.dataset.flag,
              value: button.dataset.value,
              target: button.dataset.target ?? 'class',
            }));
          for (const choice of choiceCatalog) {
            const selectedSubclass =
              choice.target === 'dualClass' ? wizard.data.dualSubclass : wizard.data.subclass;
            selectedSubclass.choices = {};
            selectedSubclass.choiceCurricula = {};
            await wizard._saveAndRender();
            await clickWizardStep(wizard, 'subclassChoices');
            await selectSubclassChoiceButton(wizard, choice);
            choices.push({ ...choice, selected: true });
          }
        }
        subclasses.push({
          uuid: subclass.uuid,
          name: subclass.name,
          selected: wizard.data.subclass?.uuid === subclass.uuid,
          choiceCount: choices.length,
          choices,
        });
      }
    }
    results.push({
      uuid: classEntry.uuid,
      name: classEntry.name,
      selected: wizard.data.class?.uuid === classEntry.uuid,
      hasSubclassStep,
      subclassCount: subclasses.length,
      subclasses,
    });
  }
  const taggedClasses = results.filter((entry) => entry.hasSubclassStep);
  return {
    catalogNonempty: classes.length > 0,
    allClassesSelected:
      results.length === classes.length && results.every((entry) => entry.selected),
    everyTaggedClassHasSubclass: taggedClasses.every((entry) => entry.subclassCount > 0),
    allSubclassesSelected: taggedClasses.every((entry) =>
      entry.subclasses.every((subclass) => subclass.selected),
    ),
    allSubclassChoicesSelected: taggedClasses.every((entry) =>
      entry.subclasses.every((subclass) => subclass.choices.every((choice) => choice.selected)),
    ),
    classCount: results.length,
    subclassCount: results.reduce((count, entry) => count + entry.subclassCount, 0),
    subclassChoiceCount: results.reduce(
      (count, entry) =>
        count + entry.subclasses.reduce((subtotal, subclass) => subtotal + subclass.choiceCount, 0),
      0,
    ),
    classes: results,
  };
}

export async function wizardPersistenceAudit(data) {
  let wizard = await openWizardFor(data);
  await selectCoreCreation(wizard, data.preferredClass);
  const actor = ownedActor(data);
  const before = {
    ancestry: wizard.data.ancestry?.uuid,
    heritage: wizard.data.heritage?.uuid,
    background: wizard.data.background?.uuid,
    class: wizard.data.class?.uuid,
  };
  await waitFor(() => {
    const stored = actor.getFlag(MODULE_ID, 'creation');
    return Object.keys(before).every((key) => before[key] && stored?.[key]?.uuid === before[key]);
  }, 'Creation selections did not persist to actor before close');
  await wizard.close();
  wizard = await openWizardFor(data);
  const after = {
    ancestry: wizard.data.ancestry?.uuid,
    heritage: wizard.data.heritage?.uuid,
    background: wizard.data.background?.uuid,
    class: wizard.data.class?.uuid,
  };
  return {
    persisted: Object.keys(before).every((key) => before[key] && before[key] === after[key]),
  };
}

export async function wizardPendingChoiceAudit(data) {
  const wizard = await openWizardFor(data);
  await selectCoreCreation(
    wizard,
    data.preferredClass ?? (game.system.id === 'pf2e' ? 'bard' : null),
  );
  const conditionalSteps = [
    'subclass',
    'deity',
    'implement',
    'tactics',
    'ikons',
    'innovationDetails',
    'kineticGate',
    'subconsciousMind',
    'thesis',
    'apparitions',
  ];
  const detected = wizard.visibleSteps.find((step) => conditionalSteps.includes(step));
  return {
    conditionalChoiceDetected: Boolean(detected),
    incompleteBeforeChoice: detected ? !wizard._isStepComplete(detected) : false,
  };
}

export async function plannerLevelsAudit(data) {
  const planner = await openPlannerFor(data);
  const levels = [...planner.element.querySelectorAll('[data-action="selectLevel"]')].map((row) =>
    Number(row.dataset.level),
  );
  await clickPlannerLevel(planner, 20);
  return {
    levelCount: levels.length,
    allLevelsRepresented:
      levels.length === 19 && levels.every((level, index) => level === index + 2),
    level20Visited: planner.selectedLevel === 20,
  };
}

export async function plannerClassCatalogAudit(data) {
  const actor = ownedActor(data);
  const wizard = await openWizardFor(data);
  for (const stepId of ['ancestry', 'heritage', 'background'])
    await selectFirstItem(wizard, stepId);
  await clickWizardStep(wizard, 'class');
  const classes = await waitForCatalogEntries(wizard, 'class');
  await wizard.close();
  const results = [];
  for (const classEntry of classes) {
    const document = await fromUuid(classEntry.uuid);
    const priorClassIds = actor.itemTypes.class.map((item) => item.id);
    if (priorClassIds.length) await actor.deleteEmbeddedDocuments('Item', priorClassIds);
    await actor.unsetFlag(MODULE_ID, 'plan');
    const source = document.toObject();
    delete source._id;
    source.system.items = {};
    source.system.rules = [];
    await actor.createEmbeddedDocuments('Item', [source]);
    const planner = await openPlannerFor(data);
    const rows = [...planner.element.querySelectorAll('[data-action="selectLevel"]')];
    const statuses = rows.map((row) =>
      ['complete', 'warning', 'incomplete'].find((status) =>
        row.querySelector(`.sidebar-level__status--${status}`),
      ),
    );
    const checkpoints = [];
    for (const level of [2, 10, 20]) {
      await clickPlannerLevel(planner, level);
      checkpoints.push({
        level,
        rendered: Boolean(
          planner.element?.querySelector(`[data-comment-part^="level:${level}:"]`) ??
          planner.element?.querySelector('.planner-content__header'),
        ),
      });
    }
    results.push({
      uuid: classEntry.uuid,
      name: classEntry.name,
      slug: planner.plan?.classSlug,
      opened: planner.plan?.classSlug === (document.slug ?? document.system?.slug),
      levelCount: rows.length,
      allLevels:
        rows.length === 19 && rows.every((row, index) => Number(row.dataset.level) === index + 2),
      allClassified: statuses.length === 19 && statuses.every(Boolean),
      checkpoints,
    });
    await planner.close();
  }
  return {
    catalogNonempty: classes.length > 0,
    allClassesOpened: results.length === classes.length && results.every((entry) => entry.opened),
    everyClassHasAllLevels: results.every((entry) => entry.allLevels),
    everyClassHasClassifiedLevels: results.every((entry) => entry.allClassified),
    everyClassRenderedCheckpoints: results.every((entry) =>
      entry.checkpoints.every((checkpoint) => checkpoint.rendered),
    ),
    classCount: results.length,
    classes: results,
  };
}

export async function plannerValidationAudit(data) {
  const planner = await openPlannerFor(data);
  const rows = [...planner.element.querySelectorAll('[data-action="selectLevel"]')];
  const statuses = rows.map((row) =>
    ['complete', 'warning', 'incomplete'].find((status) =>
      row.querySelector(`.sidebar-level__status--${status}`),
    ),
  );
  return {
    everyLevelClassified: rows.length === 19 && statuses.every(Boolean),
    hasIncompleteLevel: statuses.includes('incomplete'),
  };
}

export async function plannerImportExportAudit(data) {
  const planner = await openPlannerFor(data);
  const exportButton = planner.element.querySelector('[data-action="exportPlan"]');
  const importButton = planner.element.querySelector('[data-action="importPlan"]');
  if (!exportButton || !importButton) throw Error('Planner import/export controls did not render');

  let download = null;
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function captureDownload() {
    download = { name: this.download, href: this.href };
  };
  try {
    exportButton.click();
  } finally {
    HTMLAnchorElement.prototype.click = anchorClick;
  }

  const importedPlan = foundry.utils.deepClone(planner.plan);
  importedPlan.liveTestMarker = data.runId;
  const inputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function selectFixtureFile() {
    Object.defineProperty(this, 'files', {
      configurable: true,
      value: [
        new File([JSON.stringify(importedPlan)], 'leveler-live-plan.json', {
          type: 'application/json',
        }),
      ],
    });
    this.dispatchEvent(new Event('change'));
  };
  try {
    importButton.click();
    await waitFor(
      () => planner.actor.getFlag(MODULE_ID, 'plan')?.liveTestMarker === data.runId,
      'Planner import did not persist',
      90000,
    );
  } finally {
    HTMLInputElement.prototype.click = inputClick;
  }
  return {
    exported: Boolean(
      download?.name?.endsWith('-level-plan.json') && download.href.startsWith('blob:'),
    ),
    imported: planner.actor.getFlag(MODULE_ID, 'plan')?.liveTestMarker === data.runId,
  };
}

export async function plannerClearLevelAudit(data) {
  const planner = await openPlannerFor(data);
  await clickPlannerLevel(planner, 2);
  planner.plan.levels[2].customSkillIncreases = [{ skill: 'acrobatics', toRank: 1 }];
  await planner._savePlanAndRender();
  const populated =
    planner.actor.getFlag(MODULE_ID, 'plan')?.levels?.[2]?.customSkillIncreases?.length === 1;
  const originalConfirm = foundry.applications.api.DialogV2.confirm;
  foundry.applications.api.DialogV2.confirm = async () => true;
  try {
    planner.element.querySelector('[data-action="clearLevel"]')?.click();
    await waitFor(
      () =>
        planner.actor.getFlag(MODULE_ID, 'plan')?.levels?.[2]?.customSkillIncreases?.length === 0,
      'Clear-level action did not persist',
    );
  } finally {
    foundry.applications.api.DialogV2.confirm = originalConfirm;
  }
  return { populated, cleared: true };
}

export async function plannerCustomChoicesAudit(data) {
  const planner = await openPlannerFor(data);
  await clickPlannerLevel(planner, 2);
  const toggle = planner.element.querySelector('[data-action="toggleCustomPlan"]');
  if (!toggle) throw Error('Custom planning toggle did not render');
  toggle.click();
  await waitFor(() => planner._customPlanOpenLevels.has(2), 'Custom planning section did not open');
  await waitFor(
    () =>
      planner.element.querySelector(
        '[data-action="openCustomFeatPicker"], [data-action="addCustomSkillIncrease"], [data-action="openCustomEquipmentPicker"]',
      ),
    'Custom planning controls did not render',
  );
  return { opened: true, controlsVisible: true };
}

function actorMutationSnapshot(actor) {
  return JSON.stringify({
    system: actor.toObject().system,
    items: actor.items.map((item) => item.toObject()),
  });
}

async function withApplyConfirmation(value, callback) {
  const original = foundry.applications.api.DialogV2.confirm;
  foundry.applications.api.DialogV2.confirm = async () => value;
  try {
    return await callback();
  } finally {
    foundry.applications.api.DialogV2.confirm = original;
  }
}

async function markNewMessages(runId, beforeIds) {
  const messages = game.messages.filter((message) => !beforeIds.has(message.id));
  await Promise.all(messages.map((message) => message.setFlag(MODULE_ID, MARKER, runId)));
  return messages;
}

export async function applySingleLevelAudit(data) {
  const planner = await openPlannerFor(data);
  const actor = ownedActor(data);
  const before = new Set(game.messages.keys());
  await withApplyConfirmation(true, () => planner._applySelectedPlan());
  const messages = await markNewMessages(data.runId, before);
  return {
    applied: messages.length === 1,
    messageCount: messages.length,
    levelUpdated: Number(actor.system?.details?.level?.value) === planner.selectedLevel,
  };
}

export async function issue104RepertoireSwapAudit() {
  const pack = game.packs.get('pf2e.spells-srd');
  if (!pack) throw Error('PF2e spells compendium unavailable');
  const index = await pack.getIndex({ fields: ['type', 'system.level.value', 'system.traits.value'] });
  const candidates = index.filter((entry) => (
    entry.type === 'spell'
    && Number(entry.system?.level?.value) === 1
    && !(entry.system?.traits?.value ?? []).includes('cantrip')
  )).slice(0, 2);
  if (candidates.length < 2) throw Error('Need two rank-1 PF2e spells for repertoire swap audit');
  const [originalDoc, replacementDoc] = await Promise.all(
    candidates.map((entry) => pack.getDocument(entry._id)),
  );
  const original = {
    id: 'live-original-spell',
    type: 'spell',
    name: originalDoc.name,
    sourceId: originalDoc.uuid,
    system: { location: { value: 'live-spontaneous-entry' }, level: { value: 1 } },
  };
  const deleted = [];
  const created = [];
  const actor = {
    items: [original],
    deleteEmbeddedDocuments: async (_type, ids) => {
      deleted.push(...ids);
      return [];
    },
    createEmbeddedDocuments: async (_type, docs) => {
      created.push(...docs);
      return docs;
    },
  };
  const plan = {
    levels: {
      2: {
        spellSwaps: [{
          entryType: 'primary',
          original: {
            actorItemId: original.id,
            sourceId: original.sourceId,
            name: original.name,
            rank: 1,
            entryId: 'live-spontaneous-entry',
          },
          replacement: { uuid: replacementDoc.uuid, name: replacementDoc.name, rank: 1 },
        }],
      },
    },
  };
  const { applySpellSwaps } = await import('/modules/pf2e-leveler/scripts/apply/apply-spell-swaps.js');
  const [applied] = await applySpellSwaps(actor, plan, 2);
  const createdSpell = created[0];
  return {
    sameRank: Number(applied?.replacement?.rank) === 1,
    sameEntry: createdSpell?.system?.location?.value === 'live-spontaneous-entry',
    originalRemoved: deleted.includes(original.id),
    replacementCreated: createdSpell?.name === replacementDoc.name,
  };
}

export async function issue105UndeadAdvancedBloodlineAudit() {
  const created = [];
  const actor = {
    items: [
      {
        id: 'live-sorcerer-entry',
        type: 'spellcastingEntry',
        name: 'Sorcerer Spells',
        system: {
          tradition: { value: 'divine' },
          prepared: { value: 'spontaneous' },
          ability: { value: 'cha' },
        },
      },
      {
        type: 'feat',
        slug: 'bloodline-undead',
        system: { traits: { otherTags: ['sorcerer-bloodline'] } },
      },
    ],
    system: { resources: { focus: { max: 1, value: 1 } } },
    createEmbeddedDocuments: async (_type, docs) => {
      const results = docs.map((doc, index) => ({ id: `live-created-${index}`, ...doc }));
      created.push(...results);
      return results;
    },
    updateEmbeddedDocuments: async () => [],
    update: async () => {},
  };
  const plan = {
    classSlug: 'sorcerer',
    levels: {
      8: {
        classFeats: [{ slug: 'advanced-bloodline', name: 'Advanced Bloodline' }],
      },
    },
  };
  const { applySpells } = await import('/modules/pf2e-leveler/scripts/apply/apply-spells.js');
  const applied = await applySpells(actor, plan, 8);
  return {
    drainLifeApplied: applied.some((entry) => entry.name === 'Drain Life')
      && created.some((entry) => entry.name === 'Drain Life'),
    greaterSpellAbsent: !applied.some((entry) => /greater/iu.test(entry.name))
      && !created.some((entry) => /greater/iu.test(entry.name)),
  };
}

export async function issue106GradualIntelligenceAudit() {
  const actor = {
    system: {
      details: { level: { value: 6 } },
      abilities: { int: { mod: 4 } },
      build: { attributes: { boosts: {} } },
    },
    abilities: { int: { mod: 4, base: 4 } },
    items: [],
  };
  const plan = {
    classSlug: 'alchemist',
    levels: { 7: { abilityBoosts: ['int'], intBonusSkills: [], intBonusLanguages: [] } },
  };
  const { buildIntelligenceBenefitContext, buildIntBonusLanguageContext, buildIntBonusSkillContext } =
    await import('/modules/pf2e-leveler/scripts/ui/level-planner/context.js');
  const planner = { actor, plan };
  return {
    noSkillPrompt: buildIntelligenceBenefitContext(planner, 7) === null
      && buildIntBonusSkillContext(planner, plan.levels[7], 7) === null,
    noLanguagePrompt: buildIntBonusLanguageContext(planner, plan.levels[7], 7) === null,
  };
}

export async function applyMultipleLevelsAudit(data) {
  const planner = await openPlannerFor(data);
  planner.plan.sequentialMode = { active: true, currentLevel: 4, targetLevel: 4 };
  planner.selectedLevel = 4;
  await planner._savePlanAndRender();
  const before = new Set(game.messages.keys());
  await withApplyConfirmation(true, () => planner._finishSequentialMode());
  const messages = await markNewMessages(data.runId, before);
  return { applied: messages.length === 3, messageCount: messages.length };
}

export async function applyCancelAudit(data) {
  const planner = await openPlannerFor(data);
  const actor = ownedActor(data);
  const beforeActor = actorMutationSnapshot(actor);
  const beforeMessages = new Set(game.messages.keys());
  await withApplyConfirmation(false, () => planner._applySelectedPlan());
  return {
    cancelled: game.messages.every((message) => beforeMessages.has(message.id)),
    unchanged: actorMutationSnapshot(actor) === beforeActor,
  };
}

export async function applyChatSummaryAudit(data) {
  const planner = await openPlannerFor(data);
  const before = new Set(game.messages.keys());
  await withApplyConfirmation(true, () => planner._applySelectedPlan());
  const [message] = await markNewMessages(data.runId, before);
  const content = String(message?.content ?? '');
  const whisper = new Set(message?.whisper ?? []);
  return {
    actorNamed: content.includes(planner.actor.name),
    levelNamed: content.includes('Level 2'),
    whispered: whisper.has(game.user.id) && whisper.size >= 2,
  };
}

export async function applyFailureAtomicityAudit(data) {
  const planner = await openPlannerFor(data);
  const actor = ownedActor(data);
  const beforeActor = actorMutationSnapshot(actor);
  const beforeMessages = new Set(game.messages.keys());
  const originalCreate = ChatMessage.create;
  let injected = false;
  ChatMessage.create = async () => {
    injected = true;
    throw Error('Injected live-test chat failure');
  };
  try {
    await withApplyConfirmation(true, () => planner._applySelectedPlan());
  } finally {
    ChatMessage.create = originalCreate;
  }
  return {
    failed: injected,
    actorUnchanged: actorMutationSnapshot(actor) === beforeActor,
    noMessage: game.messages.every((message) => beforeMessages.has(message.id)),
  };
}

async function openIsolatedVariantPlanner(data, variant, level) {
  await configureVariant(data.world, variant);
  const planner = await openPlannerFor(data);
  await clickPlannerLevel(planner, level);
  return planner;
}

function hasPlannerPart(planner, level, part) {
  return Boolean(planner.element?.querySelector(`[data-comment-part="level:${level}:${part}"]`));
}

export async function variantFreeArchetypeAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'freeArchetype', 2);
  return {
    enabled: planner._getVariantOptions().freeArchetype === true,
    level2SlotVisible: hasPlannerPart(planner, 2, 'archetypeFeat'),
  };
}

export async function variantAncestralParagonAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'ancestralParagon', 3);
  return {
    enabled: planner._getVariantOptions().ancestralParagon === true,
    level3SlotVisible: hasPlannerPart(planner, 3, 'ancestryFeat'),
  };
}

export async function variantMythicAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'mythic', 2);
  return {
    enabled: planner._getVariantOptions().mythic === true,
    level2SlotVisible: hasPlannerPart(planner, 2, 'mythicFeat'),
  };
}

export async function variantAbpAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'abp', 3);
  return {
    enabled: planner._getVariantOptions().abp === true,
    level3SectionVisible: hasPlannerPart(planner, 3, 'abp'),
  };
}

export async function variantGradualBoostsAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'gradualBoosts', 2);
  const section = planner.element?.querySelector('[data-comment-part="level:2:boosts"]');
  const count = Number(
    section?.querySelector('.section-header')?.textContent?.match(/\d+\/(\d+)/)?.[1],
  );
  return {
    enabled: planner._getVariantOptions().gradualBoosts === true,
    level2BoostVisible: Boolean(section),
    boostCount: Number.isFinite(count) ? count : null,
  };
}

export async function variantDualClassAudit(data) {
  const planner = await openIsolatedVariantPlanner(data, 'dualClass', 2);
  const secondary = planner._buildDualClassOptions().find((option) => option.value);
  if (!secondary) throw Error('No secondary class is available for dual-class test');
  await planner._setDualClassSlug(secondary.value);
  await clickPlannerLevel(planner, 2);
  return {
    enabled: planner._getVariantOptions().dualClass === true,
    secondarySelected: planner.plan.dualClassSlug === secondary.value,
    level2SlotVisible: hasPlannerPart(planner, 2, 'dualClassFeat'),
  };
}

function spellPreparationFor(data) {
  const actor = ownedActor(data);
  const preparation = [...openApplications()].find(
    (app) => app.entry?.id === data.entry && app.actor?.id === actor.id,
  );
  if (!preparation) throw Error('Native spell preparation window is not open');
  return preparation;
}

function spellPickerFor(data) {
  const actor = ownedActor(data);
  const picker = [...openApplications()].find(
    (app) =>
      (app?.options?.id === 'pf2e-leveler-spell-picker' ||
        app?.id === 'pf2e-leveler-spell-picker') &&
      app.actor?.id === actor.id,
  );
  if (!picker) throw Error('Leveler spell picker is not open');
  return picker;
}

async function openSpellPreparationFor(data) {
  const actor = ownedActor(data);
  const sheet = await waitForActorSheet(actor);
  const tab = await waitFor(
    () =>
      sheet.querySelector('nav [data-tab="spellcasting"]') ??
      sheet.querySelector('a[data-tab="spellcasting"]'),
    'Character spellcasting tab did not render',
  );
  tab.click();
  const openButton = await waitFor(
    () =>
      sheet.querySelector(
        `.spellcasting-entry[data-item-id="${CSS.escape(data.entry)}"] [data-action="open-spell-preparation"]`,
      ),
    'Prepared spellcasting entry did not render on character sheet',
    90000,
  );
  openButton.click();
  return waitFor(
    () => {
      try {
        const preparation = spellPreparationFor(data);
        return preparation.element?.querySelector('.spell-list') ? preparation : null;
      } catch {
        return null;
      }
    },
    'Native spell preparation window did not render',
    90000,
  );
}

function preparationAddButton(preparation, rank) {
  const rows = [...(preparation.element?.querySelectorAll('.header-row, .group-header') ?? [])];
  return rows
    .find((row) => {
      const legacy = row.querySelector('[data-group-id]')?.dataset?.groupId;
      const labelId = row.querySelector('.group-label')?.id ?? '';
      const current = labelId.match(/-group-(cantrips?|\d+)$/i)?.[1];
      return String(legacy ?? current) === String(rank);
    })
    ?.querySelector('.pf2e-leveler-add-tradition-spell');
}

async function openPreparationPicker(data) {
  const preparation = await openSpellPreparationFor(data);
  const button = await waitFor(
    () => preparationAddButton(preparation, 1),
    'Leveler rank-1 spellbook button did not render',
    90000,
  );
  button.click();
  const picker = await waitFor(
    () => {
      try {
        const current = spellPickerFor(data);
        return current.element?.querySelector('.spell-picker') ? current : null;
      } catch {
        return null;
      }
    },
    'Leveler spell picker did not render',
    90000,
  );
  await waitFor(
    () => picker.element?.querySelectorAll('.spell-option').length > 0,
    'Spell picker catalog is empty',
    90000,
  );
  return { preparation, picker };
}

function spellRank(spell) {
  return Number(
    spell.system?.location?.heightenedLevel ??
      spell.system?.heightenedLevel ??
      spell.system?.level?.value ??
      spell.system?.level ??
      0,
  );
}

export async function spellbookEntrypointAudit(data) {
  const { preparation, picker } = await openPreparationPicker(data);
  return {
    preparationRendered: Boolean(preparation.element?.querySelector('.spell-list')),
    levelerButtonVisible: Boolean(preparationAddButton(preparation, 1)),
    pickerOpened: Boolean(picker.element?.querySelector('.spell-picker')),
    exactRank: picker.exactRank === true && picker.rank === 1,
    multiSelect: picker.multiSelect === true,
  };
}

export async function spellbookFilteringAudit(data) {
  const { picker } = await openPreparationPicker(data);
  const initial = [...picker.filteredSpells];
  const first = initial[0];
  const search = picker.element?.querySelector('[data-action="searchSpells"]');
  if (!first || !search) throw Error('Spell picker filtering controls did not render');
  search.value = first.name;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(
    () =>
      picker.filteredSpells.length > 0 &&
      picker.filteredSpells.length < initial.length &&
      picker.filteredSpells.every((spell) =>
        spell.name.toLowerCase().includes(first.name.toLowerCase()),
      ),
    'Spell search did not narrow live results',
  );
  const root = picker.element;
  return {
    catalogNonempty: initial.length > 0,
    exactRankOnly: initial.every((spell) => spellRank(spell) === 1),
    traditionCompatible: initial.every((spell) => {
      const traits = spell.system?.traits?.value ?? [];
      const traditions = spell.system?.traits?.traditions ?? spell.system?.traditions?.value ?? [];
      return (
        traditions.includes('arcane') ||
        traits.includes('arcane') ||
        traits.includes('ritual') ||
        spell.system?.ritual != null
      );
    }),
    lockedFiltersVisible: Boolean(
      root.querySelector('[data-action="toggleSpellRank"][data-rank="1"].locked') &&
      root.querySelector('[data-action="toggleSpellTradition"][data-tradition="arcane"].locked') &&
      root.querySelector('[data-action="toggleSpellCategory"][data-category="spell"].locked'),
    ),
    searchNarrows: picker.filteredSpells.length < initial.length,
  };
}

export async function spellbookDuplicatePreventionAudit(data) {
  const actor = ownedActor(data);
  let { preparation, picker } = await openPreparationPicker(data);
  const option = [...picker.element.querySelectorAll('.spell-option')].find(
    (entry) => !entry.querySelector('[data-action="selectSpell"]')?.disabled,
  );
  const select = option?.querySelector('[data-action="selectSpell"]');
  const sourceUuid = option?.dataset.uuid;
  if (!select || !sourceUuid) throw Error('No selectable rank-1 spell rendered');
  select.click();
  await waitFor(() => picker.selectedSpellUuids.has(sourceUuid), 'Spell selection did not update');
  picker.element.querySelector('[data-action="confirmSelection"]')?.click();
  await waitFor(
    () =>
      actor.items.some(
        (item) => item.type === 'spell' && item.system?.location?.value === data.entry,
      ),
    'Selected spell was not added to prepared entry',
    90000,
  );
  const countAfterAdd = actor.items.filter(
    (item) => item.type === 'spell' && item.system?.location?.value === data.entry,
  ).length;
  await waitFor(
    () => preparationAddButton(preparation, 1),
    'Spell preparation window did not rerender after add',
    90000,
  );
  preparationAddButton(preparation, 1).click();
  picker = await waitFor(
    () => {
      try {
        const current = spellPickerFor(data);
        return current !== picker && current.element?.querySelector('.spell-option')
          ? current
          : null;
      } catch {
        return null;
      }
    },
    'Spell picker did not reopen',
    90000,
  );
  const taken = await waitFor(
    () => picker.element?.querySelector(`.spell-option[data-uuid="${CSS.escape(sourceUuid)}"]`),
    'Owned spell did not remain visible for duplicate prevention',
    90000,
  );
  const takenButton = taken.querySelector('[data-action="selectSpell"]');
  takenButton?.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const finalCount = actor.items.filter(
    (item) => item.type === 'spell' && item.system?.location?.value === data.entry,
  ).length;
  return {
    spellAdded: countAfterAdd === 1,
    takenVisible: taken.dataset.alreadyTaken === 'true',
    takenDisabled: takenButton?.disabled === true,
    duplicateBlocked: finalCount === countAfterAdd && !picker.selectedSpellUuids.has(sourceUuid),
  };
}

export async function restore({ runId }) {
  validateRunId(runId);
  await closeRunApplications(runId);
}

export async function closeRunApplications(runId) {
  validateRunId(runId);
  const applications = [...openApplications()].filter(
    (app) => documentRunMarker(applicationDocument(app), MODULE_ID, MARKER) === runId,
  );
  await Promise.all(applications.map((app) => app.close?.()));
  return { closed: applications.length };
}

export async function cleanup(runId) {
  requireGm();
  await closeRunApplications(runId);
  const actorIds = ownedDocumentIds(game.actors, runId, MODULE_ID, MARKER);
  const messageIds = ownedDocumentIds(game.messages, runId, MODULE_ID, MARKER);
  if (messageIds.length) await ChatMessage.deleteDocuments(messageIds);
  if (actorIds.length) await Actor.deleteDocuments(actorIds);
}

export function leftovers(runId) {
  return {
    actors: ownedDocumentIds(game.actors, runId, MODULE_ID, MARKER),
    messages: ownedDocumentIds(game.messages, runId, MODULE_ID, MARKER),
  };
}
