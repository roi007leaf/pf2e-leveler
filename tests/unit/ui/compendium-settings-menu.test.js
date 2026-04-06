import { CompendiumSettingsMenu } from '../../../scripts/ui/compendium-settings-menu.js';

describe('CompendiumSettingsMenu', () => {
  test('toggle all checks every unlocked pack in the active category', () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" data-category="feats" data-pack="pf2e.feats-srd" data-locked="true" checked>
        <input type="checkbox" data-category="feats" data-pack="my-module.feats-a" data-locked="false">
        <input type="checkbox" data-category="feats" data-pack="my-module.feats-b" data-locked="false">
      </div>
    `;

    const menu = new CompendiumSettingsMenu();
    menu.activeCategory = 'feats';
    menu.element = document.body;
    menu.render = jest.fn();

    menu._toggleAllInCategory('feats');

    expect(menu._draftSelections.feats).toEqual(['my-module.feats-a', 'my-module.feats-b']);
    expect(document.querySelector('[data-pack="my-module.feats-a"]').checked).toBe(true);
    expect(document.querySelector('[data-pack="my-module.feats-b"]').checked).toBe(true);
    expect(menu.render).toHaveBeenCalledWith(true);
  });

  test('toggle all deselects every unlocked pack when all are already selected', () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" data-category="feats" data-pack="pf2e.feats-srd" data-locked="true" checked>
        <input type="checkbox" data-category="feats" data-pack="my-module.feats-a" data-locked="false" checked>
        <input type="checkbox" data-category="feats" data-pack="my-module.feats-b" data-locked="false" checked>
      </div>
    `;

    const menu = new CompendiumSettingsMenu();
    menu.activeCategory = 'feats';
    menu.element = document.body;
    menu.render = jest.fn();

    menu._toggleAllInCategory('feats');

    expect(menu._draftSelections.feats).toEqual([]);
    expect(document.querySelector('[data-pack="my-module.feats-a"]').checked).toBe(false);
    expect(document.querySelector('[data-pack="my-module.feats-b"]').checked).toBe(false);
    expect(document.querySelector('[data-pack="pf2e.feats-srd"]').checked).toBe(true);
    expect(menu.render).toHaveBeenCalledWith(true);
  });
});
