import {
  bringApplicationToFront,
  renderApplicationInFront,
  scheduleBringApplicationToFront,
} from '../../../scripts/ui/shared/window-focus.js';
import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';

describe('window focus helpers', () => {
  let originalRequestAnimationFrame;

  beforeEach(() => {
    jest.useFakeTimers();
    originalRequestAnimationFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    document.body.innerHTML = '';
  });

  afterEach(() => {
    delete global.pf2eLevelerDebugWindowFocus;
    localStorage.removeItem('pf2e-leveler.debug.windowFocus');
    jest.runOnlyPendingTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    document.body.innerHTML = '';
  });

  test('raises an application above existing DOM windows when bringToFront is unavailable', () => {
    const sheet = document.createElement('section');
    sheet.className = 'application';
    sheet.style.zIndex = '350';
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application';
    document.body.append(element);
    const app = {
      element,
      setPosition: jest.fn(),
    };

    bringApplicationToFront(app);

    expect(app.setPosition).toHaveBeenCalledWith({ zIndex: 351 });
    expect(element.style.zIndex).toBe('351');
  });

  test('raises an application above legacy PF2e sheets even when bringToFront exists', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '108';
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      bringToFront: jest.fn(),
      setPosition: jest.fn(),
    };

    bringApplicationToFront(app);

    expect(app.bringToFront).toHaveBeenCalledTimes(1);
    expect(app.setPosition).toHaveBeenCalledWith({ zIndex: 109 });
    expect(element.style.zIndex).toBe('109');
  });

  test('raises the outer window when app.element points at inner template content', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '108';
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.className = 'application';
    const content = document.createElement('section');
    content.className = 'window-content';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler level-planner';
    content.append(inner);
    wrapper.append(content);
    document.body.append(wrapper);

    bringApplicationToFront({ element: inner });

    expect(wrapper.style.zIndex).toBe('109');
    expect(inner.style.zIndex).toBe('');
  });

  test('finds a rendered application by configured id when app.element is not available', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '108';
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.id = 'pf2e-leveler-planner';
    wrapper.className = 'application';
    document.body.append(wrapper);

    bringApplicationToFront({
      constructor: {
        DEFAULT_OPTIONS: { id: 'pf2e-leveler-planner' },
      },
    });

    expect(wrapper.style.zIndex).toBe('109');
  });

  test('scheduled foreground retries after a legacy sheet reclaims top z-index', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '108';
    const button = document.createElement('button');
    sheet.append(button);
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      bringToFront: jest.fn(),
      setPosition: jest.fn(),
    };

    scheduleBringApplicationToFront(app, { lowerElement: button });
    expect(sheet.style.zIndex).toBe('99');
    expect(Number(element.style.zIndex)).toBeGreaterThan(Number(sheet.style.zIndex));

    sheet.style.zIndex = '200';
    jest.advanceTimersByTime(0);

    expect(sheet.style.zIndex).toBe('99');
    expect(Number(element.style.zIndex)).toBeGreaterThan(Number(sheet.style.zIndex));
  });

  test('scheduled foreground stops retrying once the leveler is above the opener sheet', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '108';
    const button = document.createElement('button');
    sheet.append(button);
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      bringToFront: jest.fn(),
      setPosition: jest.fn(),
    };

    scheduleBringApplicationToFront(app, { lowerElement: button });
    expect(element.style.zIndex).toBe('100');

    jest.advanceTimersByTime(4000);

    expect(element.style.zIndex).toBe('100');
    expect(app.bringToFront).toHaveBeenCalledTimes(1);
  });

  test('lower selector demotes a re-rendered actor sheet and keeps leveler above it', () => {
    const sheet = document.createElement('div');
    sheet.id = 'CharacterSheetPF2e-Actor-MUVMbkREK3rCvFAD';
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      bringToFront: jest.fn(),
      setPosition: jest.fn(),
    };

    scheduleBringApplicationToFront(app, {
      lowerSelectors: ['#CharacterSheetPF2e-Actor-MUVMbkREK3rCvFAD'],
    });

    expect(sheet.style.zIndex).toBe('99');
    expect(element.style.zIndex).toBe('100');

    sheet.style.zIndex = '140';
    jest.advanceTimersByTime(50);

    expect(sheet.style.zIndex).toBe('99');
    expect(element.style.zIndex).toBe('100');
  });

  test('relative sheet focus does not overtake an unrelated prompt dialog', () => {
    const sheet = document.createElement('div');
    sheet.id = 'CharacterSheetPF2e-Actor-MUVMbkREK3rCvFAD';
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    const prompt = document.createElement('section');
    prompt.className = 'application dialog';
    prompt.style.zIndex = '500';
    document.body.append(prompt);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      bringToFront: jest.fn(),
      setPosition: jest.fn(),
    };

    scheduleBringApplicationToFront(app, {
      lowerSelectors: ['#CharacterSheetPF2e-Actor-MUVMbkREK3rCvFAD'],
    });

    expect(sheet.style.zIndex).toBe('99');
    expect(element.style.zIndex).toBe('100');
    expect(prompt.style.zIndex).toBe('500');
  });

  test('does not emit window focus diagnostics unless debug flag is enabled', () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);

    bringApplicationToFront({ element });

    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });

  test('emits opt-in diagnostics for selector fallback focus', () => {
    localStorage.setItem('pf2e-leveler.debug.windowFocus', '1');
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    const button = document.createElement('a');
    button.className = 'pf2e-leveler-create-btn';
    sheet.append(button);
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler character-wizard';
    wrapper.append(inner);
    document.body.append(wrapper);

    scheduleBringApplicationToFront(null, {
      lowerElement: button,
      selectors: ['.pf2e-leveler.character-wizard'],
    });

    const events = debugSpy.mock.calls.map((call) => call[1]);
    expect(events).toEqual(expect.arrayContaining(['schedule', 'run', 'lower-opener', 'selector-match', 'selector-raise']));
    expect(debugSpy.mock.calls.every((call) => call[0] === 'PF2e Leveler | window-focus')).toBe(true);
  });

  test('demotes opener sheet and raises matching leveler selector', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    const button = document.createElement('a');
    button.className = 'pf2e-leveler-create-btn';
    sheet.append(button);
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler character-wizard';
    wrapper.append(inner);
    document.body.append(wrapper);

    scheduleBringApplicationToFront(null, {
      lowerElement: button,
      selectors: ['.pf2e-leveler.character-wizard'],
    });

    expect(sheet.style.zIndex).toBe('99');
    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(99);
  });

  test('selector foreground still runs when Foundry bringToFront would throw before element exists', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    const button = document.createElement('a');
    button.className = 'pf2e-leveler-create-btn';
    sheet.append(button);
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler character-wizard';
    wrapper.append(inner);
    document.body.append(wrapper);

    const app = {
      bringToFront: jest.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'style')");
      }),
    };

    expect(() => scheduleBringApplicationToFront(app, {
      lowerElement: button,
      selectors: ['.pf2e-leveler.character-wizard'],
    })).not.toThrow();

    expect(app.bringToFront).not.toHaveBeenCalled();
    expect(sheet.style.zIndex).toBe('99');
    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(99);
  });

  test('selector foreground still runs when Foundry setPosition would throw before element exists', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    const button = document.createElement('a');
    button.className = 'pf2e-leveler-create-btn';
    sheet.append(button);
    document.body.append(sheet);

    const wrapper = document.createElement('div');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler character-wizard';
    wrapper.append(inner);
    document.body.append(wrapper);

    const app = {
      setPosition: jest.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'style')");
      }),
    };

    expect(() => scheduleBringApplicationToFront(app, {
      lowerElement: button,
      selectors: ['.pf2e-leveler.character-wizard'],
    })).not.toThrow();

    expect(app.setPosition).not.toHaveBeenCalled();
    expect(sheet.style.zIndex).toBe('99');
    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(99);
  });

  test('DOM z-index still applies when setPosition throws despite existing app element', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    const element = document.createElement('section');
    element.className = 'application pf2e-leveler';
    document.body.append(element);
    const app = {
      element,
      setPosition: jest.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'style')");
      }),
    };

    expect(() => bringApplicationToFront(app)).not.toThrow();

    expect(app.setPosition).toHaveBeenCalled();
    expect(Number(element.style.zIndex)).toBeGreaterThan(109);
  });

  test('foregrounds after async render creates the window wrapper', async () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    let resolveRender;
    const renderPromise = new Promise((resolve) => {
      resolveRender = resolve;
    });
    const app = {
      render: jest.fn(() => renderPromise),
      constructor: {
        DEFAULT_OPTIONS: { id: 'pf2e-leveler-wizard' },
      },
    };

    const result = renderApplicationInFront(app, true);
    expect(result).toBe(renderPromise);
    expect(app.render).toHaveBeenCalledWith(true);

    const wrapper = document.createElement('div');
    wrapper.id = 'pf2e-leveler-wizard';
    wrapper.className = 'application';
    document.body.append(wrapper);
    resolveRender();
    await Promise.resolve();
    jest.advanceTimersByTime(0);

    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(109);
  });

  test('character wizard foregrounds itself only after its first render', () => {
    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    const wizard = new CharacterWizard(actor);
    wizard.element = document.createElement('section');
    wizard.element.className = 'application';
    wizard.bringToFront = jest.fn();
    wizard._restoreWizardScroll = jest.fn();
    wizard._activateListeners = jest.fn();
    wizard._applyBrowserFilters = jest.fn();
    wizard._ensureBootstrapped = jest.fn();
    wizard._syncSpellLayout = jest.fn();
    wizard._syncPublicationTooltips = jest.fn();

    wizard._onRender();
    wizard._onRender();

    expect(wizard.bringToFront).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(wizard.bringToFront).toHaveBeenCalledTimes(1);
  });

  test('character wizard render can foreground by selector when app.element is unavailable', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    const wrapper = document.createElement('section');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler character-wizard';
    wrapper.append(inner);
    document.body.append(wrapper);

    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    const wizard = new CharacterWizard(actor);
    Object.defineProperty(wizard, 'element', { configurable: true, value: undefined });
    wizard.bringToFront = jest.fn();
    wizard.setPosition = jest.fn();
    wizard._restoreWizardScroll = jest.fn();
    wizard._activateListeners = jest.fn();
    wizard._applyBrowserFilters = jest.fn();
    wizard._ensureBootstrapped = jest.fn();
    wizard._syncSpellLayout = jest.fn();
    wizard._syncPublicationTooltips = jest.fn();

    wizard._onRender();

    expect(wizard.bringToFront).not.toHaveBeenCalled();
    expect(wizard.setPosition).not.toHaveBeenCalled();
    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(109);
  });

  test('level planner foregrounds itself only after its first render', () => {
    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    const planner = new LevelPlanner(actor);
    planner.element = document.createElement('section');
    planner.element.className = 'application';
    planner.bringToFront = jest.fn();
    planner._restorePlannerScroll = jest.fn();
    planner._activateListeners = jest.fn();

    planner._onRender();
    planner._onRender();

    expect(planner.bringToFront).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(planner.bringToFront).toHaveBeenCalledTimes(1);
  });

  test('level planner render can foreground by selector when app.element is unavailable', () => {
    const sheet = document.createElement('div');
    sheet.className = 'app window-app default sheet actor character';
    sheet.style.zIndex = '109';
    document.body.append(sheet);

    const wrapper = document.createElement('section');
    wrapper.className = 'application';
    const inner = document.createElement('div');
    inner.className = 'pf2e-leveler level-planner';
    wrapper.append(inner);
    document.body.append(wrapper);

    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    const planner = new LevelPlanner(actor);
    Object.defineProperty(planner, 'element', { configurable: true, value: undefined });
    planner.bringToFront = jest.fn();
    planner.setPosition = jest.fn();
    planner._restorePlannerScroll = jest.fn();
    planner._activateListeners = jest.fn();

    planner._onRender();

    expect(planner.bringToFront).not.toHaveBeenCalled();
    expect(planner.setPosition).not.toHaveBeenCalled();
    expect(Number(wrapper.style.zIndex)).toBeGreaterThan(109);
  });

  test('wizard stylesheet does not pin the root application below PF2e sheets', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(
      path.resolve(__dirname, '../../../styles/character-wizard.css'),
      'utf8',
    );

    expect(css).not.toMatch(/#pf2e-leveler-wizard\s*\{[^}]*z-index\s*:\s*99\b/su);
  });
});
