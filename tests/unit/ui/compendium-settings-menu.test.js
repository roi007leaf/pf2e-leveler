import { CompendiumSettingsMenu, PlayerCompendiumAccessMenu } from '../../../scripts/ui/compendium-settings-menu.js';
import * as catalog from '../../../scripts/compendiums/catalog.js';
import * as featCache from '../../../scripts/feats/feat-cache.js';
import * as itemPicker from '../../../scripts/ui/item-picker.js';
import * as spellPicker from '../../../scripts/ui/spell-picker.js';

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

  test('pack assignment checkbox updates in place without rerendering', () => {
    document.body.innerHTML = `
      <label class="compendium-assignment__chip">
        <input class="compendium-assignment__check" type="checkbox" data-category="feats" data-pack="my-module.player-options" data-locked="false">
        <span>Feats</span>
      </label>
    `;

    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    menu.element = document.body;
    menu.render = jest.fn();
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

    const input = document.querySelector('.compendium-assignment__check');
    input.checked = true;
    menu._onPackAssignmentChange(input);

    expect(menu._draftSelections.feats).toEqual(['my-module.player-options']);
    expect(input.closest('.compendium-assignment__chip').classList.contains('is-selected')).toBe(true);
    expect(menu.render).not.toHaveBeenCalled();
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

  test('does not expose hidden categories such as actions and equipment in the settings UI', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [],
      classFeatures: [],
      spells: [],
      equipment: [
        { key: 'pf2e.equipment-srd', label: 'Equipment', locked: true, manualCandidate: false },
      ],
      actions: [
        { key: 'pf2e.actionspf2e', label: 'Actions', locked: true, manualCandidate: false },
      ],
      deities: [],
    });

    const menu = new CompendiumSettingsMenu();
    const context = await menu._prepareContext();

    expect(context.categories.map((category) => category.key)).not.toContain('actions');
    expect(context.categories.map((category) => category.key)).toContain('equipment');
  });

  test('pack assignment rows ignore hidden categories instead of crashing', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      classFeatures: [],
      spells: [],
      equipment: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      actions: [
        { key: 'my-module.player-options', label: 'Player Options', locked: false, manualCandidate: false },
      ],
      deities: [],
    });

    const menu = new CompendiumSettingsMenu();
    menu.viewMode = 'packs';
    const context = await menu._prepareContext();

    expect(context.packRows).toHaveLength(1);
    expect(context.packRows[0].categories.map((category) => category.key)).toEqual(['equipment', 'feats']);
  });

  test('category view only shows packs assigned to that category instead of every auto-detected pack', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [],
      heritages: [],
      backgrounds: [
        { key: 'pf2e.backgrounds', label: 'Backgrounds', locked: true, manualCandidate: false, packageName: 'pf2e', packageLabel: 'PF2E' },
      ],
      classes: [
        { key: 'pf2e.backgrounds', label: 'Backgrounds', locked: false, manualCandidate: false, packageName: 'pf2e', packageLabel: 'PF2E' },
      ],
      feats: [],
      classFeatures: [],
      spells: [],
      equipment: [],
      actions: [],
      deities: [],
    });

    jest.spyOn(catalog, 'getCompendiumKeysForCategory').mockImplementation((category) => {
      if (category === 'backgrounds') return ['pf2e.backgrounds'];
      if (category === 'classes') return ['pf2e.classes'];
      return [];
    });

    game.packs = {
      values: () => ([
        {
          collection: 'pf2e.backgrounds',
          metadata: { id: 'pf2e.backgrounds', label: 'Backgrounds', packageName: 'pf2e' },
          title: 'Backgrounds',
        },
        {
          collection: 'pf2e.classes',
          metadata: { id: 'pf2e.classes', label: 'Classes', packageName: 'pf2e' },
          title: 'Classes',
        },
      ]),
    };

    const menu = new CompendiumSettingsMenu();
    menu.activeCategory = 'classes';
    const context = await menu._prepareContext();
    const classesCategory = context.categories.find((category) => category.key === 'classes');

    expect(classesCategory.packs.map((pack) => pack.key)).toEqual(['pf2e.classes']);
  });

  test('category view uses draft selections so deselected custom packs stay unchecked after rerender', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [
        { key: 'battlezoo-dragons-fairy-dragons-pf2e.ancestry', label: 'Ancestry', locked: false, manualCandidate: false, packageName: 'battlezoo-dragons-fairy-dragons-pf2e', packageLabel: 'Battlezoo Dragons' },
      ],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [],
      classFeatures: [],
      spells: [],
      equipment: [],
      actions: [],
      deities: [],
    });

    const menu = new CompendiumSettingsMenu();
    menu.activeCategory = 'ancestries';
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

    const context = await menu._prepareContext();
    const ancestriesCategory = context.categories.find((category) => category.key === 'ancestries');

    expect(ancestriesCategory.packs.map((pack) => pack.key)).toEqual(['pf2e.ancestries']);
    expect(ancestriesCategory.packs.some((pack) => pack.key === 'battlezoo-dragons-fairy-dragons-pf2e.ancestry')).toBe(false);
  });

  test('player content sources hide pack remapping and follow main compendium assignments', async () => {
    jest.spyOn(catalog, 'discoverCompendiumsByCategory').mockResolvedValue({
      ancestries: [
        { key: 'pf2e.ancestries', label: 'Ancestries', locked: true, manualCandidate: false, packageName: 'pf2e', packageLabel: 'PF2E' },
        { key: 'battlezoo-dragons-fairy-dragons-pf2e.ancestry', label: 'Fairy Dragons', locked: false, manualCandidate: false, packageName: 'battlezoo-dragons-fairy-dragons-pf2e', packageLabel: 'Battlezoo Dragons' },
      ],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: [],
      classFeatures: [],
      spells: [],
      equipment: [],
      actions: [],
      deities: [],
    });

    jest.spyOn(catalog, 'getConfiguredCompendiumSelections').mockReturnValue({
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
    });

    game.settings.get = jest.fn((moduleId, settingId) => {
      if (moduleId === 'pf2e-leveler' && settingId === 'playerCompendiumAccess') {
        return {
          enabled: true,
          selections: {
            ancestries: ['battlezoo-dragons-fairy-dragons-pf2e.ancestry'],
          },
        };
      }
      return {};
    });

    const menu = new PlayerCompendiumAccessMenu();
    const context = await menu._prepareContext();
    const ancestriesCategory = context.categories.find((category) => category.key === 'ancestries');

    expect(context.showViewModeTabs).toBe(false);
    expect(context.isCategoryView).toBe(true);
    expect(ancestriesCategory.packs.map((pack) => pack.key)).toEqual(['pf2e.ancestries']);
  });

  test('save selections invalidates and prewarms content caches before closing', async () => {
    game.settings.set = jest.fn().mockResolvedValue(undefined);
    ui.notifications.info = jest.fn();
    jest.spyOn(featCache, 'invalidateCache').mockImplementation(() => {});
    jest.spyOn(featCache, 'loadFeats').mockResolvedValue([]);
    jest.spyOn(itemPicker, 'invalidateItemCache').mockImplementation(() => {});
    jest.spyOn(itemPicker, 'loadItems').mockResolvedValue([]);
    jest.spyOn(spellPicker, 'clearSpellPickerCache').mockImplementation(() => {});
    jest.spyOn(spellPicker, 'loadSpells').mockResolvedValue([]);

    const menu = new CompendiumSettingsMenu();
    menu._draftSelections = { feats: ['pf2e.feats-srd'] };
    menu._syncSelectionsFromDom = jest.fn();
    menu.render = jest.fn();
    menu.close = jest.fn();

    await menu._saveSelections();

    expect(game.settings.set).toHaveBeenCalledWith('pf2e-leveler', 'customCompendiums', { feats: ['pf2e.feats-srd'] });
    expect(featCache.invalidateCache).toHaveBeenCalled();
    expect(itemPicker.invalidateItemCache).toHaveBeenCalled();
    expect(spellPicker.clearSpellPickerCache).toHaveBeenCalled();
    expect(featCache.loadFeats).toHaveBeenCalled();
    expect(itemPicker.loadItems).toHaveBeenCalled();
    expect(spellPicker.loadSpells).toHaveBeenCalled();
    expect(ui.notifications.info).toHaveBeenCalled();
    expect(menu.close).toHaveBeenCalled();
  });

  test('save selections skips invalidation and prewarm when nothing changed', async () => {
    game.settings.set = jest.fn().mockResolvedValue(undefined);
    ui.notifications.info = jest.fn();
    jest.spyOn(featCache, 'invalidateCache').mockImplementation(() => {});
    jest.spyOn(featCache, 'loadFeats').mockResolvedValue([]);
    jest.spyOn(itemPicker, 'invalidateItemCache').mockImplementation(() => {});
    jest.spyOn(itemPicker, 'loadItems').mockResolvedValue([]);
    jest.spyOn(spellPicker, 'clearSpellPickerCache').mockImplementation(() => {});
    jest.spyOn(spellPicker, 'loadSpells').mockResolvedValue([]);

    const menu = new CompendiumSettingsMenu();
    menu._draftSelections = { feats: ['pf2e.feats-srd'] };
    menu._getConfiguredSelections = jest.fn(() => ({ feats: ['pf2e.feats-srd'] }));
    menu._syncSelectionsFromDom = jest.fn();
    menu.close = jest.fn();

    await menu._saveSelections();

    expect(game.settings.set).not.toHaveBeenCalled();
    expect(featCache.invalidateCache).not.toHaveBeenCalled();
    expect(itemPicker.invalidateItemCache).not.toHaveBeenCalled();
    expect(spellPicker.clearSpellPickerCache).not.toHaveBeenCalled();
    expect(featCache.loadFeats).not.toHaveBeenCalled();
    expect(itemPicker.loadItems).not.toHaveBeenCalled();
    expect(spellPicker.loadSpells).not.toHaveBeenCalled();
    expect(ui.notifications.info).toHaveBeenCalled();
    expect(menu.close).toHaveBeenCalled();
  });
});
