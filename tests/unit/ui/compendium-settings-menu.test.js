import { CompendiumSettingsMenu } from '../../../scripts/ui/compendium-settings-menu.js';
import * as catalog from '../../../scripts/compendiums/catalog.js';

describe('CompendiumSettingsMenu', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  test('pack assignment mode builds one row per pack with multiple categories', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      classFeatures: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      spells: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      equipment: [],
      actions: [],
      deities: [],
    });

    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    menu._getConfiguredSelections = jest.fn(() => ({
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: ['my-module.player-options'],
      classFeatures: ['my-module.player-options'],
      spells: [],
      equipment: [],
      actions: [],
      deities: [],
    }));

    const context = await menu._prepareContext();

    expect(context.isPackView).toBe(true);
    expect(context.packRows).toHaveLength(1);
    expect(context.packRows[0].categories.filter((category) => category.selected)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'feats' }),
      expect.objectContaining({ key: 'classFeatures' }),
    ]));
  });

  test('pack assignment mode syncs selected categories back into draft selections', () => {
    document.body.innerHTML = `
      <div>
        <input class="compendium-assignment__check" type="checkbox" data-category="feats" data-pack="my-module.player-options" data-locked="false" checked>
        <input class="compendium-assignment__check" type="checkbox" data-category="classFeatures" data-pack="my-module.player-options" data-locked="false" checked>
        <input class="compendium-assignment__check" type="checkbox" data-category="spells" data-pack="my-module.player-options" data-locked="false">
      </div>
    `;

    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    menu.element = document.body;
    menu._draftSelections = {
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [],
      classFeatures: [],
      spells: [],
      equipment: [],
      actions: [],
      deities: [],
    };

    menu._syncSelectionsFromDom();

    expect(menu._draftSelections.feats).toEqual(['my-module.player-options']);
    expect(menu._draftSelections.classFeatures).toEqual(['my-module.player-options']);
    expect(menu._draftSelections.spells).toEqual([]);
  });

  test('pack assignment mode filters rows by search text', async () => {
    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    menu.packSearch = 'creator';
    document.body.innerHTML = `
      <div>
        <article class="compendium-assignment" data-search-text="player options feats spells creator name"></article>
        <article class="compendium-assignment" data-search-text="class kit classes"></article>
        <p data-pack-empty-state hidden></p>
      </div>
    `;
    menu.element = document.body;

    menu._applyPackSearchFilter(document.body);

    const rows = Array.from(document.querySelectorAll('.compendium-assignment'));
    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(document.querySelector('[data-pack-empty-state]').hidden).toBe(true);
  });

  test('pack assignment mode shows empty state when search matches nothing', () => {
    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    menu.packSearch = 'zzzz';
    document.body.innerHTML = `
      <div>
        <article class="compendium-assignment" data-search-text="player options feats spells"></article>
        <p data-pack-empty-state hidden></p>
      </div>
    `;
    menu.element = document.body;

    menu._applyPackSearchFilter(document.body);

    expect(document.querySelector('.compendium-assignment').hidden).toBe(true);
    expect(document.querySelector('[data-pack-empty-state]').hidden).toBe(false);
  });
});
