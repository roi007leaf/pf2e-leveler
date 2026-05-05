const DEBUG_KEY = 'pf2e-leveler.debug.windowFocus';
const DEBUG_PREFIX = 'PF2e Leveler | window-focus';

export function renderApplicationInFront(app, options = true, focusOptions = {}) {
  debugWindowFocus('render', () => ({
    app: describeApp(app),
    options,
    focusOptions: describeFocusOptions(focusOptions),
    windows: getWindowSnapshot(),
  }));
  const renderResult = app?.render?.(options);
  scheduleBringApplicationToFront(app, focusOptions);
  if (typeof renderResult?.then === 'function') {
    renderResult.then(() => {
      debugWindowFocus('render-resolved', () => ({
        app: describeApp(app),
        focusOptions: describeFocusOptions(focusOptions),
        windows: getWindowSnapshot(),
      }));
      scheduleBringApplicationToFront(app, focusOptions);
    });
  }
  return renderResult;
}

export function scheduleBringApplicationToFront(app, focusOptions = {}) {
  debugWindowFocus('schedule', () => ({
    app: describeApp(app),
    focusOptions: describeFocusOptions(focusOptions),
    windows: getWindowSnapshot(),
  }));
  let hasRaised = false;
  const bringForward = (phase) => {
    if (isFocusSatisfied(app, focusOptions, hasRaised)) {
      debugWindowFocus('skip-satisfied', () => ({
        phase,
        app: describeApp(app),
        focusOptions: describeFocusOptions(focusOptions),
        targets: getFocusTargetElements(app, focusOptions.selectors).map(describeElement),
        windows: getWindowSnapshot(),
      }));
      return;
    }

    debugWindowFocus('run', () => ({
      phase,
      app: describeApp(app),
      focusOptions: describeFocusOptions(focusOptions),
      windows: getWindowSnapshot(),
    }));
    lowerFocusElements(focusOptions);
    bringApplicationToFront(app, focusOptions);
    bringSelectorsToFront(focusOptions.selectors, focusOptions);
    hasRaised = getFocusTargetElements(app, focusOptions.selectors).length > 0;
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => bringForward('raf'));
  else setTimeout(() => bringForward('timeout-fallback'), 0);
  for (const delay of [0, 50, 150, 300, 500, 1000, 1500, 2500, 4000]) {
    setTimeout(() => bringForward(`delay-${delay}`), delay);
  }
}

export function bringApplicationToFront(app, focusOptions = {}) {
  if (!app) {
    debugWindowFocus('skip-no-app', () => ({ windows: getWindowSnapshot() }));
    return;
  }

  safelyCallApplicationBringToFront(app);

  const zIndex = getRaiseZIndex(focusOptions);
  safelySetApplicationPosition(app, zIndex);
  if (app.position && typeof app.position === 'object') app.position.zIndex = zIndex;

  const element = getApplicationElement(app);
  if (element) {
    const before = describeElement(element);
    element.style.setProperty('z-index', String(zIndex), 'important');
    debugWindowFocus('raise-app', () => ({
      app: describeApp(app),
      zIndex,
      before,
      after: describeElement(element),
      windows: getWindowSnapshot(),
    }));
  } else {
    debugWindowFocus('skip-app-no-element', () => ({
      app: describeApp(app),
      zIndex,
      windows: getWindowSnapshot(),
    }));
  }
}

function safelyCallApplicationBringToFront(app) {
  if (typeof app?.bringToFront !== 'function') {
    debugWindowFocus('skip-bringToFront-missing', () => ({ app: describeApp(app) }));
    return;
  }
  if (!getElementFromAppReference(app)) {
    debugWindowFocus('skip-bringToFront-no-element-reference', () => ({ app: describeApp(app) }));
    return;
  }

  try {
    app.bringToFront();
    debugWindowFocus('bringToFront-called', () => ({ app: describeApp(app) }));
  } catch {
    // Foundry can throw here before ApplicationV2 has published app.element.
    debugWindowFocus('bringToFront-threw', () => ({ app: describeApp(app) }));
  }
}

function safelySetApplicationPosition(app, zIndex) {
  if (typeof app?.setPosition !== 'function') {
    debugWindowFocus('skip-setPosition-missing', () => ({ app: describeApp(app), zIndex }));
    return;
  }
  if (!getElementFromAppReference(app)) {
    debugWindowFocus('skip-setPosition-no-element-reference', () => ({ app: describeApp(app), zIndex }));
    return;
  }

  try {
    app.setPosition({ zIndex });
    debugWindowFocus('setPosition-called', () => ({ app: describeApp(app), zIndex }));
  } catch {
    // Foundry/libWrapper hooks can throw before ApplicationV2 has app.element.
    debugWindowFocus('setPosition-threw', () => ({ app: describeApp(app), zIndex }));
  }
}

function bringSelectorsToFront(selectors, focusOptions = {}) {
  const elements = new Set();
  for (const selector of normalizeSelectors(selectors)) {
    const matches = getApplicationElementsFromSelector(selector);
    debugWindowFocus('selector-match', () => ({
      selector,
      matches: matches.map(describeElement),
      windows: getWindowSnapshot(),
    }));
    for (const element of matches) {
      elements.add(element);
    }
  }

  for (const element of elements) {
    const zIndex = getRaiseZIndex(focusOptions);
    const before = describeElement(element);
    element.style.setProperty('z-index', String(zIndex), 'important');
    debugWindowFocus('selector-raise', () => ({
      zIndex,
      before,
      after: describeElement(element),
      windows: getWindowSnapshot(),
    }));
  }
}

function isFocusSatisfied(app, focusOptions = {}, hasRaised = false) {
  const targets = getFocusTargetElements(app, focusOptions.selectors);
  if (targets.length === 0) return false;

  const lowerElements = getLowerApplicationElements(focusOptions);
  if (lowerElements.length === 0) return hasRaised;

  const openerZIndex = Math.max(...lowerElements.map(getNumericZIndex));
  const targetZIndex = Math.max(...targets.map(getNumericZIndex));
  return targetZIndex > openerZIndex;
}

function getFocusTargetElements(app, selectors) {
  const elements = new Set();
  const appElement = getApplicationElement(app);
  if (appElement) elements.add(appElement);

  for (const selector of normalizeSelectors(selectors)) {
    for (const element of getApplicationElementsFromSelector(selector)) {
      elements.add(element);
    }
  }

  return [...elements];
}

function normalizeSelectors(selectors) {
  if (!selectors) return [];
  return Array.isArray(selectors) ? selectors : [selectors];
}

function getApplicationElementsFromSelector(selector) {
  const elements = [];
  for (const element of document.querySelectorAll(selector)) {
    const applicationElement = getClosestApplicationElement(element);
    if (applicationElement) elements.push(applicationElement);
  }
  return elements;
}

function lowerFocusElements(focusOptions = {}) {
  const elements = getLowerApplicationElements(focusOptions);
  if (elements.length === 0) {
    debugWindowFocus('skip-lower-no-opener', () => ({
      element: describeElement(focusOptions.lowerElement),
      selectors: normalizeSelectors(focusOptions.lowerSelectors),
    }));
    return;
  }

  const baseZIndex = getBaseWindowZIndex();
  const zIndex = Math.max(1, baseZIndex - 1);
  for (const element of elements) {
    const before = describeElement(element);
    element.style.setProperty('z-index', String(zIndex), 'important');
    debugWindowFocus('lower-opener', () => ({
      zIndex,
      before,
      after: describeElement(element),
      windows: getWindowSnapshot(),
    }));
  }
}

function getLowerApplicationElements(focusOptions = {}) {
  const elements = new Set();
  const lowerElement = getClosestApplicationElement(focusOptions.lowerElement);
  if (lowerElement) elements.add(lowerElement);

  for (const selector of normalizeSelectors(focusOptions.lowerSelectors)) {
    for (const element of getApplicationElementsFromSelector(selector)) {
      elements.add(element);
    }
  }

  return [...elements];
}

function getApplicationElement(app) {
  const element = getElementFromAppReference(app);
  if (element) return getClosestApplicationElement(element) ?? element;

  const id = app?.id ?? app?.options?.id ?? app?.constructor?.DEFAULT_OPTIONS?.id ?? '';
  if (id) return document.getElementById(id);

  const appId = app?.appId ?? app?.appid ?? app?.options?.appId ?? '';
  if (appId) return document.querySelector(`[data-appid="${cssAttributeEscape(appId)}"]`);

  return null;
}

function getClosestApplicationElement(element) {
  if (!(element instanceof HTMLElement)) return null;
  return element.matches('.application, .app, .window-app')
    ? element
    : element.closest('.application, .app, .window-app');
}

function getElementFromAppReference(app) {
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

function cssAttributeEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function getBaseWindowZIndex() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--z-index-window');
  const zIndex = Number(value || 100);
  return Number.isFinite(zIndex) && zIndex > 0 ? zIndex : 100;
}

function getNextApplicationZIndex() {
  const windowZIndexes = Object.values(ui?.windows ?? {})
    .map((app) => Number(app?.position?.zIndex ?? app?.element?.style?.zIndex ?? 0))
    .filter(Number.isFinite);
  const domZIndexes = [...document.querySelectorAll('.application, .app, .window-app')]
    .map((element) => Number(getComputedStyle(element).zIndex || element.style.zIndex || 0))
    .filter(Number.isFinite);
  const top = Math.max(0, ...windowZIndexes, ...domZIndexes);
  return Math.max(top + 1, 100);
}

function getRaiseZIndex(focusOptions = {}) {
  const lowerElements = getLowerApplicationElements(focusOptions);
  if (lowerElements.length === 0) return getNextApplicationZIndex();

  const lowerTop = Math.max(...lowerElements.map(getNumericZIndex));
  return Math.max(getBaseWindowZIndex(), lowerTop + 1);
}

function debugWindowFocus(event, dataFactory = {}) {
  if (!isWindowFocusDebugEnabled()) return;

  let data = {};
  try {
    data = typeof dataFactory === 'function' ? dataFactory() : dataFactory;
  } catch (error) {
    data = { diagnosticError: error?.message ?? String(error) };
  }

  console.debug(DEBUG_PREFIX, event, data);
}

function isWindowFocusDebugEnabled() {
  if (globalThis.pf2eLevelerDebugWindowFocus === true) return true;
  try {
    return globalThis.localStorage?.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

function describeFocusOptions(focusOptions = {}) {
  return {
    selectors: normalizeSelectors(focusOptions.selectors),
    lowerSelectors: normalizeSelectors(focusOptions.lowerSelectors),
    lowerElement: describeElement(focusOptions.lowerElement),
  };
}

function describeApp(app) {
  if (!app) return null;
  return {
    constructorName: app.constructor?.name ?? null,
    id: app.id ?? null,
    optionsId: app.options?.id ?? null,
    defaultId: app.constructor?.DEFAULT_OPTIONS?.id ?? null,
    appId: app.appId ?? app.appid ?? app.options?.appId ?? null,
    positionZIndex: app.position?.zIndex ?? null,
    elementReference: describeElement(getElementFromAppReference(app)),
    resolvedElement: describeElement(getApplicationElement(app)),
  };
}

function describeElement(element) {
  if (!(element instanceof HTMLElement)) return null;

  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: [...element.classList],
    inlineZIndex: element.style.zIndex || null,
    computedZIndex: getElementZIndex(element),
    dataAppId: element.dataset?.appid ?? null,
  };
}

function getElementZIndex(element) {
  try {
    return getComputedStyle(element).zIndex || null;
  } catch {
    return null;
  }
}

function getNumericZIndex(element) {
  const zIndex = Number(getElementZIndex(element) ?? element?.style?.zIndex ?? 0);
  return Number.isFinite(zIndex) ? zIndex : 0;
}

function getWindowSnapshot() {
  return [...document.querySelectorAll('.application, .app, .window-app')]
    .map(describeElement)
    .filter(Boolean)
    .sort((a, b) => Number(b.computedZIndex ?? b.inlineZIndex ?? 0) - Number(a.computedZIndex ?? a.inlineZIndex ?? 0))
    .slice(0, 12);
}
