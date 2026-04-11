export function captureScrollState(root, selectors) {
  if (!root?.querySelector) return null;

  return Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, root.querySelector(selector)?.scrollTop ?? 0]),
  );
}

export function restoreScrollState(root, state, selectors) {
  if (!state || !root?.querySelector) return;

  const apply = () => {
    for (const [key, selector] of Object.entries(selectors)) {
      const element = root.querySelector(selector);
      if (element) element.scrollTop = state[key] ?? 0;
    }
  };

  apply();
  requestAnimationFrame(() => apply());
}
