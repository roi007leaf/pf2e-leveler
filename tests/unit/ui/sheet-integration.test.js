import {
  canOpenCreationWizard,
  getCreationButtonTitle,
  isActorCharacterSheetApplication,
  isSupportedClass,
  normalizePreparationGroupRank,
  registerSheetIntegration,
  shouldRedirectCreationWizardToPlanner,
} from '../../../scripts/ui/sheet-integration.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';

describe('normalizePreparationGroupRank', () => {
  test('maps cantrip group ids to rank 0', () => {
    expect(normalizePreparationGroupRank('cantrips')).toBe(0);
    expect(normalizePreparationGroupRank('cantrip')).toBe(0);
  });

  test('maps numeric group ids to numeric spell ranks', () => {
    expect(normalizePreparationGroupRank('1')).toBe(1);
    expect(normalizePreparationGroupRank(3)).toBe(3);
  });

  test('returns null for unsupported group ids', () => {
    expect(normalizePreparationGroupRank('focus')).toBeNull();
    expect(normalizePreparationGroupRank(null)).toBeNull();
  });
});

describe('creation wizard sheet access', () => {
  beforeEach(() => {
    ClassRegistry.clear();
  });

  test('allows opening the creation wizard for creation-stage characters', () => {
    expect(canOpenCreationWizard(createMockActor())).toBe(true);
    expect(canOpenCreationWizard(createMockActor({
      ancestry: null,
      class: { slug: 'wizard' },
      system: { details: { level: { value: 5 } } },
    }))).toBe(true);
    expect(canOpenCreationWizard({ type: 'npc' })).toBe(false);
  });

  test('hides the creation wizard entry point once a leveled character should use the planner', () => {
    expect(canOpenCreationWizard(createMockActor({
      ancestry: { slug: 'human' },
      class: { slug: 'wizard' },
      system: { details: { level: { value: 5 } } },
    }))).toBe(false);
  });

  test('uses an edit label after a class exists', () => {
    expect(getCreationButtonTitle(createMockActor())).toBe('PF2E_LEVELER.CREATION.EDIT_BUTTON');
    expect(getCreationButtonTitle(createMockActor({ class: null }))).toBe('PF2E_LEVELER.CREATION.BUTTON');
  });

  test('redirects higher-level characters with both ancestry and class to the planner', () => {
    expect(shouldRedirectCreationWizardToPlanner(createMockActor({
      ancestry: { slug: 'human' },
      class: { slug: 'wizard' },
      system: { details: { level: { value: 5 } } },
    }))).toBe(true);

    expect(shouldRedirectCreationWizardToPlanner(createMockActor({
      ancestry: null,
      class: { slug: 'wizard' },
      system: { details: { level: { value: 5 } } },
    }))).toBe(false);

    expect(shouldRedirectCreationWizardToPlanner(createMockActor({
      ancestry: { slug: 'human' },
      class: { slug: 'wizard' },
      system: { details: { level: { value: 1 } } },
    }))).toBe(false);
  });

  test('self-heals class registry checks for supported classes', () => {
    const actor = createMockActor({
      class: { slug: 'druid' },
    });

    expect(ClassRegistry.getSlugs()).toEqual([]);
    expect(isSupportedClass(actor)).toBe(true);
    expect(ClassRegistry.has('druid')).toBe(true);
  });

  test('supports custom compendium classes by registering them from the actor class item', () => {
    const actor = createMockActor({
      class: {
        slug: 'eldamon-trainer',
        name: 'Eldamon Trainer',
        system: {
          hp: 8,
          keyAbility: { value: ['cha'] },
          trainedSkills: { value: ['diplomacy'], additional: 3 },
          classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          generalFeatLevels: { value: [3, 7, 11, 15, 19] },
          ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
          skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
          items: {},
        },
      },
    });

    expect(isSupportedClass(actor)).toBe(true);
    expect(ClassRegistry.has('eldamon-trainer')).toBe(true);
  });
});

describe('character sheet application detection', () => {
  test('accepts the PF2e character sheet application for the matching actor', () => {
    const actor = createMockActor({ id: 'abc123' });
    const app = document.createElement('div');
    app.id = 'CharacterSheetPF2e-Actor-abc123';
    app.className = 'app window-app sheet actor character';

    expect(isActorCharacterSheetApplication(asJQuery(app), actor)).toBe(true);
  });

  test('accepts the Foundry v13 ApplicationV2 actor sheet element for the matching actor', () => {
    const actor = createMockActor({ id: 'abc123' });
    const app = document.createElement('section');
    app.id = 'CharacterSheetPF2e-Actor-abc123';
    app.className = 'application sheet actor character';

    expect(isActorCharacterSheetApplication(app, actor)).toBe(true);
  });

  test('rejects PF2e HUD windows that render character-sheet content', () => {
    const actor = createMockActor({ id: 'abc123' });
    const hud = document.createElement('div');
    hud.id = 'pf2e-hud-persistent';

    const app = document.createElement('div');
    app.className = 'app window-app sheet actor character';
    hud.append(app);

    expect(isActorCharacterSheetApplication(asJQuery(app), actor)).toBe(false);
  });

  test('accepts character sheets mounted under PF2e HUD-marked interface containers', () => {
    const actor = createMockActor({ id: 'abc123' });
    const interfaceElement = document.createElement('div');
    interfaceElement.id = 'interface';
    interfaceElement.className = 'pf2e-hud-tracker';

    const app = document.createElement('section');
    app.id = 'CharacterSheetPF2e-Actor-abc123';
    app.className = 'application sheet actor character';
    interfaceElement.append(app);
    document.body.append(interfaceElement);

    expect(isActorCharacterSheetApplication(app, actor)).toBe(true);
  });

  test('rejects PF2e strike attack popouts', () => {
    const actor = createMockActor({ id: 'abc123' });
    const app = document.createElement('div');
    app.id = 'AttackPopout-Actor-abc123-strike-item-longsword';
    app.className = 'app window-app default sheet actor character attack-popout';

    expect(isActorCharacterSheetApplication(asJQuery(app), actor)).toBe(false);
  });
});

describe('character sheet render integration', () => {
  test('adds header buttons when Foundry v13 passes inner sheet HTML as an HTMLElement', () => {
    const restoreJQuery = useDomJQuery();
    try {
      const actor = createMockActor({ id: 'abc123' });
      const app = document.createElement('section');
      app.id = 'CharacterSheetPF2e-Actor-abc123';
      app.className = 'application sheet actor character';

      const header = document.createElement('header');
      header.className = 'window-header';
      const closeButton = document.createElement('button');
      closeButton.className = 'close';
      header.append(closeButton);

      const content = document.createElement('div');
      content.className = 'sheet-content';
      app.append(header, content);
      document.body.append(app);

      registerSheetIntegration();
      const renderHandler = Hooks.on.mock.calls.find(
        ([hook]) => hook === 'renderCharacterSheetPF2e',
      )[1];
      renderHandler({ actor }, content);

      expect(header.querySelector('.pf2e-leveler-create-btn')).not.toBeNull();
      expect(header.querySelector('.pf2e-leveler-plan-btn')).not.toBeNull();
    } finally {
      restoreJQuery();
    }
  });

  test('adds compact anchor header controls that avoid themed button chrome', () => {
    const restoreJQuery = useDomJQuery();
    try {
      const actor = createMockActor({ id: 'abc123' });
      const app = document.createElement('section');
      app.id = 'CharacterSheetPF2e-Actor-abc123';
      app.className = 'application sheet actor character';
      app.dataset.theme = 'bg3';
      app.dataset.dorakoUiScope = 'limited';

      const header = document.createElement('header');
      header.className = 'window-header';
      const closeButton = document.createElement('button');
      closeButton.className = 'close header-control';
      header.append(closeButton);

      const content = document.createElement('div');
      content.className = 'sheet-content';
      app.append(header, content);
      document.body.append(app);

      registerSheetIntegration();
      const renderHandler = Hooks.on.mock.calls.find(
        ([hook]) => hook === 'renderCharacterSheetPF2e',
      )[1];
      renderHandler({ actor }, content);

      const createButton = header.querySelector('.pf2e-leveler-create-btn');
      const planButton = header.querySelector('.pf2e-leveler-plan-btn');

      expect(createButton).toBeInstanceOf(HTMLAnchorElement);
      expect(planButton).toBeInstanceOf(HTMLAnchorElement);
      expect(createButton.getAttribute('role')).toBe('button');
      expect(planButton.getAttribute('role')).toBe('button');
    } finally {
      restoreJQuery();
    }
  });

  test('does not add the creation button for leveled characters that redirect to the planner', () => {
    const restoreJQuery = useDomJQuery();
    try {
      const actor = createMockActor({
        id: 'abc123',
        ancestry: { slug: 'human' },
        class: { slug: 'wizard' },
        system: { details: { level: { value: 5 } } },
      });
      const app = document.createElement('section');
      app.id = 'CharacterSheetPF2e-Actor-abc123';
      app.className = 'application sheet actor character';

      const header = document.createElement('header');
      header.className = 'window-header';
      const closeButton = document.createElement('button');
      closeButton.className = 'close header-control';
      header.append(closeButton);

      const content = document.createElement('div');
      content.className = 'sheet-content';
      app.append(header, content);
      document.body.append(app);

      registerSheetIntegration();
      const renderHandler = Hooks.on.mock.calls.find(
        ([hook]) => hook === 'renderCharacterSheetPF2e',
      )[1];
      renderHandler({ actor }, content);

      expect(header.querySelector('.pf2e-leveler-create-btn')).toBeNull();
      expect(header.querySelector('.pf2e-leveler-plan-btn')).not.toBeNull();
    } finally {
      restoreJQuery();
    }
  });

  test('shows a launch overlay immediately when opening a new planner', async () => {
    const restoreJQuery = useDomJQuery();
    try {
      const actor = createMockActor({ id: 'abc123' });
      const app = document.createElement('section');
      app.id = 'CharacterSheetPF2e-Actor-abc123';
      app.className = 'application sheet actor character';

      const header = document.createElement('header');
      header.className = 'window-header';
      const closeButton = document.createElement('button');
      closeButton.className = 'close header-control';
      header.append(closeButton);

      const content = document.createElement('div');
      content.className = 'sheet-content';
      app.append(header, content);
      document.body.append(app);

      registerSheetIntegration();
      const renderHandler = Hooks.on.mock.calls.find(
        ([hook]) => hook === 'renderCharacterSheetPF2e',
      )[1];
      renderHandler({ actor }, content);

      header.querySelector('.pf2e-leveler-plan-btn').click();

      const overlay = document.querySelector('[data-pf2e-leveler-launch-overlay="planner"]');
      expect(overlay).not.toBeNull();
      expect(overlay.textContent).toContain('PF2E_LEVELER.UI.OPEN_PLANNER');

      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      document.querySelector('[data-pf2e-leveler-launch-overlay="planner"]')?.remove();
      restoreJQuery();
    }
  });
});

function asJQuery(element) {
  return { 0: element, get: () => element };
}

function useDomJQuery() {
  const previous = global.$;
  global.$ = (input) => new TestQuery(input);
  return () => {
    global.$ = previous;
  };
}

class TestQuery {
  constructor(input) {
    this.elements = normalizeElements(input);
    this.length = this.elements.length;
    this.elements.forEach((element, index) => {
      this[index] = element;
    });
  }

  closest(selector) {
    return new TestQuery(this.elements.map((element) => element.closest(selector)).filter(Boolean));
  }

  find(selector) {
    return new TestQuery(
      this.elements.flatMap((element) => Array.from(element.querySelectorAll(selector))),
    );
  }

  first() {
    return new TestQuery(this.elements.slice(0, 1));
  }

  remove() {
    this.elements.forEach((element) => element.remove());
    return this;
  }

  before(content) {
    const nodes = normalizeElements(content);
    this.elements.forEach((element) => {
      nodes.forEach((node) => element.before(node));
    });
    return this;
  }

  append(content) {
    const nodes = normalizeElements(content);
    this.elements.forEach((element) => {
      nodes.forEach((node) => element.append(node));
    });
    return this;
  }

  on(eventName, handler) {
    this.elements.forEach((element) => element.addEventListener(eventName, handler));
    return this;
  }

  get(index = 0) {
    return this.elements[index] ?? null;
  }
}

function normalizeElements(input) {
  if (!input) return [];
  if (input instanceof TestQuery) return input.elements;
  if (input instanceof HTMLElement) return [input];
  if (typeof input === 'string') return elementsFromHtml(input);
  if (Array.isArray(input)) return input.filter((item) => item instanceof HTMLElement);
  if (typeof input.length === 'number')
    return Array.from(input).filter((item) => item instanceof HTMLElement);
  return [];
}

function elementsFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return Array.from(template.content.children);
}
