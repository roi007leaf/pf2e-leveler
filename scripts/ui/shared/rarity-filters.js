export function bindRarityToggles(root, { toggleSelector, itemSelector, onChange = null }) {
  const toggles = [...(root?.querySelectorAll?.(toggleSelector) ?? [])];
  if (toggles.length === 0) return;

  const apply = () => {
    const hiddenRarities = new Set();
    for (const toggle of toggles) {
      if (!toggle.checked) hiddenRarities.add(toggle.dataset.rarity);
    }

    root.querySelectorAll(itemSelector).forEach((item) => {
      const rarity = item.dataset.rarity || 'common';
      item.style.display = hiddenRarities.has(rarity) ? 'none' : '';
    });

    if (typeof onChange === 'function') onChange(root, hiddenRarities);
  };

  toggles.forEach((toggle) => toggle.addEventListener('change', apply));
}
