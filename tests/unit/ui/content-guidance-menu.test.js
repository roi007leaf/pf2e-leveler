import { ContentGuidanceMenu } from '../../../scripts/ui/content-guidance-menu.js';

jest.mock('../../../scripts/access/content-guidance.js', () => ({
  buildGuidanceEntry: jest.fn((status, exclusive = false, freeArchetypeExclusive = false) => {
    const normalizedStatus = status && status !== 'default' ? status : null;
    const normalizedExclusive = exclusive === true && normalizedStatus !== 'disallowed';
    const normalizedFreeArchetypeExclusive = freeArchetypeExclusive === true && normalizedStatus !== 'disallowed';
    if (!normalizedStatus && !normalizedExclusive && !normalizedFreeArchetypeExclusive) return null;
    if (!normalizedExclusive && !normalizedFreeArchetypeExclusive) return normalizedStatus;
    return {
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(normalizedExclusive ? { exclusive: true } : {}),
      ...(normalizedFreeArchetypeExclusive ? { freeArchetypeExclusive: true } : {}),
    };
  }),
  CATEGORY_DEFAULT_POLICIES: { ALLOWED: 'allowed', DISALLOWED: 'disallowed' },
  getContentGuidance: jest.fn(() => ({})),
  invalidateGuidanceCache: jest.fn(),
  getCategoryDefaultGuidanceKey: jest.fn((categoryKey) => `category-default:${categoryKey}`),
  getSourceGuidanceKey: jest.fn((title) => {
    const normalized = String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    return normalized ? `source-title:${normalized}` : null;
  }),
  normalizeGuidanceEntry: jest.fn((entry) => {
    if (typeof entry === 'string') return { status: entry === 'default' ? null : entry, exclusive: false, freeArchetypeExclusive: false };
    if (!entry || typeof entry !== 'object') return { status: null, exclusive: false, freeArchetypeExclusive: false };
    const status = entry.status && entry.status !== 'default' ? entry.status : null;
    return {
      status,
      exclusive: entry.exclusive === true && status !== 'disallowed',
      freeArchetypeExclusive: entry.freeArchetypeExclusive === true && status !== 'disallowed',
    };
  }),
}));

describe('ContentGuidanceMenu', () => {
  test('groups heritages by ancestry and exposes not-recommended status', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'heritages';
    menu._draft = {
      'heritage-elf': 'not-recommended',
      'heritage-versatile': 'recommended',
    };
    menu._itemCache.heritages = [
      { uuid: 'heritage-elf', name: 'Ancient Elf', ancestrySlug: 'elf', ancestryLabel: 'Elf', rarity: 'common', level: null },
      { uuid: 'heritage-dwarf', name: 'Death Warden Dwarf', ancestrySlug: 'dwarf', ancestryLabel: 'Dwarf', rarity: 'common', level: null },
      { uuid: 'heritage-versatile', name: 'Aiuvarin', ancestrySlug: null, ancestryLabel: null, rarity: 'common', level: null },
    ];

    const context = await menu._prepareContext();

    expect(context.useGridLayout).toBe(false);
    expect(context.groupedItems.map((entry) => entry.label)).toEqual(['Dwarf', 'Elf', 'PF2E_LEVELER.CREATION.HERITAGE_GROUP_VERSATILE']);
    expect(context.groupedItems.find((entry) => entry.label === 'Elf')).toEqual(expect.objectContaining({
      bulkScopeType: 'ancestry',
      bulkScopeValue: 'elf',
    }));
    expect(context.items.find((entry) => entry.uuid === 'heritage-elf')).toEqual(expect.objectContaining({
      isNotRecommended: true,
      isRecommended: false,
      isDisallowed: false,
    }));
  });

  test('exposes rarity bulk groups for rarity-bearing categories', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.useGridLayout).toBe(true);
    expect(context.rarityBulkGroups).toEqual([
      expect.objectContaining({ scopeType: 'rarity', scopeValue: 'common' }),
      expect.objectContaining({ scopeType: 'rarity', scopeValue: 'rare' }),
    ]);
  });

  test('context exposes active tab default policy', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {
      'category-default:backgrounds': 'disallowed',
    };
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.categoryDefaultPolicy).toBe('disallowed');
    expect(context.categoryDefaultOptions).toEqual([
      expect.objectContaining({ value: 'allowed', active: false }),
      expect.objectContaining({ value: 'disallowed', active: true }),
    ]);
  });

  test('allow bulk action only appears when unmarked items are disallowed', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
    ];

    let context = await menu._prepareContext();

    expect(context.rarityBulkGroups[0].actions.map((action) => action.status)).toEqual([
      'recommended',
      'not-recommended',
      'disallowed',
      'default',
    ]);

    menu._draft = {
      'category-default:backgrounds': 'disallowed',
    };
    context = await menu._prepareContext();

    expect(context.rarityBulkGroups[0].actions.map((action) => action.status)).toEqual([
      'allowed',
      'recommended',
      'not-recommended',
      'disallowed',
      'default',
    ]);
  });

  test('item guidance cycle only includes allow in disallowed-default mode', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};

    expect(menu._getGuidanceStatusCycle()).toEqual([
      'default',
      'recommended',
      'not-recommended',
      'disallowed',
    ]);

    menu._draft = {
      'category-default:backgrounds': 'disallowed',
    };

    expect(menu._getGuidanceStatusCycle()).toEqual([
      'default',
      'allowed',
      'recommended',
      'not-recommended',
      'disallowed',
    ]);
  });

  test('search state does not hide rarity bulk groups for the active category context', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu.searchText = 'scholar';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    const context = await menu._prepareContext();

    expect(context.rarityBulkGroups).toEqual([
      expect.objectContaining({ scopeValue: 'common' }),
      expect.objectContaining({ scopeValue: 'rare' }),
    ]);
  });

  test('separates sources tab from primary category row', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'ancestries';
    menu._draft = {};
    menu._itemCache.ancestries = [];

    const context = await menu._prepareContext();

    expect(context.primaryCategories.map((entry) => entry.key)).toEqual([
      'ancestries',
      'heritages',
      'backgrounds',
      'classes',
      'classArchetypes',
      'skills',
      'languages',
    ]);
    expect(context.secondaryCategories.map((entry) => entry.key)).toEqual(['sources']);
  });

  test('class archetypes tab defaults to dedications and can show all archetype class feats', async () => {
    game.packs.get = jest.fn((key) => {
      if (key !== 'pf2e.feats-srd') return null;
      return {
        getDocuments: jest.fn(async () => [
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.flexible-spellcaster',
            name: 'Flexible Spellcaster',
            img: 'flexible.webp',
            system: {
              category: 'class',
              level: { value: 2 },
              traits: { rarity: 'common', value: ['archetype'], otherTags: ['class-archetype'] },
              publication: { title: 'Secrets of Magic' },
            },
          },
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.wizard-dedication',
            name: 'Wizard Dedication',
            img: 'wizard.webp',
            system: {
              category: 'class',
              level: { value: 2 },
              traits: { rarity: 'common', value: ['archetype', 'dedication', 'multiclass'] },
              publication: { title: 'Player Core' },
            },
          },
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-feat',
            name: 'Acrobat Feat',
            img: 'acrobat.webp',
            system: {
              category: 'class',
              level: { value: 4 },
              traits: { rarity: 'common', value: ['archetype'] },
              publication: { title: 'Player Core' },
            },
          },
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.archetype-skill-feat',
            name: 'Archetype Skill Feat',
            img: 'skill.webp',
            system: {
              category: 'skill',
              level: { value: 4 },
              traits: { rarity: 'common', value: ['archetype'] },
              publication: { title: 'Player Core' },
            },
          },
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.quick-bomber',
            name: 'Quick Bomber',
            img: 'quick.webp',
            system: {
              category: 'class',
              level: { value: 1 },
              traits: { rarity: 'common', value: ['alchemist'] },
              publication: { title: 'Player Core' },
            },
          },
        ]),
      };
    });

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'classArchetypes';
    menu._draft = {
      'Compendium.pf2e.feats-srd.Item.flexible-spellcaster': 'recommended',
    };

    const context = await menu._prepareContext();

    expect(context.primaryCategories.map((entry) => entry.key)).toContain('classArchetypes');
    expect(context.showClassArchetypeModeFilter).toBe(true);
    expect(context.classArchetypesDedicationsOnly).toBe(true);
    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.wizard-dedication',
        name: 'Wizard Dedication',
      }),
    ]);
    expect(context.rarityBulkGroups).toEqual([
      expect.objectContaining({ scopeType: 'rarity', scopeValue: 'common' }),
    ]);

    menu.classArchetypesDedicationsOnly = false;
    const allContext = await menu._prepareContext();

    expect(allContext.classArchetypesDedicationsOnly).toBe(false);
    expect(allContext.items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-feat',
        name: 'Acrobat Feat',
      }),
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.flexible-spellcaster',
        name: 'Flexible Spellcaster',
        isRecommended: true,
        publicationTitle: 'Secrets of Magic',
      }),
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.wizard-dedication',
        name: 'Wizard Dedication',
      }),
    ]);
  });

  test('bulk guidance applies to matching rarity within the active category', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {};
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    menu._applyBulkGuidance('rarity', 'rare', 'not-recommended');

    expect(menu._draft).toEqual({ 'bg-rare': 'not-recommended' });
  });

  test('class archetype bulk guidance only applies to the active view mode', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'classArchetypes';
    menu._draft = {};
    menu._itemCache.classArchetypes = [
      { uuid: 'medic-dedication', name: 'Medic Dedication', rarity: 'common', traits: ['archetype', 'dedication', 'medic'] },
      { uuid: 'doctors-visitation', name: "Doctor's Visitation", rarity: 'common', traits: ['archetype', 'medic'] },
    ];

    menu._applyBulkExclusive('rarity', 'common', true);

    expect(menu._draft).toEqual({
      'medic-dedication': { exclusive: true },
    });

    menu.classArchetypesDedicationsOnly = false;
    menu._applyBulkExclusive('rarity', 'common', true);

    expect(menu._draft).toEqual({
      'medic-dedication': { exclusive: true },
      'doctors-visitation': { exclusive: true },
    });
  });

  test('class archetype all-feats view exposes archetype-only no-prerequisite bulk actions', async () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'classArchetypes';
    menu.classArchetypesDedicationsOnly = false;
    menu._draft = {};
    menu._itemCache.classArchetypes = [
      { uuid: 'artifact-feat', name: 'Artifact Feat', rarity: 'rare', category: 'class', traits: ['archetype'], hasPrerequisites: false },
      { uuid: 'medic-feat', name: 'Medic Feat', rarity: 'common', category: 'class', traits: ['archetype', 'medic'], hasPrerequisites: false },
      { uuid: 'wizard-dedication', name: 'Wizard Dedication', rarity: 'common', category: 'class', traits: ['archetype', 'dedication', 'multiclass'], hasPrerequisites: false },
    ];

    const context = await menu._prepareContext();

    expect(context.specialBulkGroups).toEqual([
      expect.objectContaining({
        scopeType: 'orphanArchetypeNoPrerequisites',
        scopeValue: 'true',
        actions: [
          expect.objectContaining({ status: 'disallowed' }),
          expect.objectContaining({ status: 'default' }),
        ],
      }),
    ]);

    menu.classArchetypesDedicationsOnly = true;
    const dedicationsContext = await menu._prepareContext();

    expect(dedicationsContext.specialBulkGroups).toEqual([]);
  });

  test('archetype-only no-prerequisite bulk guidance only targets orphan archetype feats', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'classArchetypes';
    menu.classArchetypesDedicationsOnly = false;
    menu._draft = {};
    menu._itemCache.classArchetypes = [
      { uuid: 'artifact-feat', name: 'Artifact Feat', rarity: 'rare', category: 'class', traits: ['archetype'], hasPrerequisites: false },
      { uuid: 'artifact-prereq-feat', name: 'Artifact Prereq Feat', rarity: 'rare', category: 'class', traits: ['archetype'], hasPrerequisites: true },
      { uuid: 'medic-feat', name: 'Medic Feat', rarity: 'common', category: 'class', traits: ['archetype', 'medic'], hasPrerequisites: false },
      { uuid: 'wizard-dedication', name: 'Wizard Dedication', rarity: 'common', category: 'class', traits: ['archetype', 'dedication', 'multiclass'], hasPrerequisites: false },
    ];

    menu._applyBulkGuidance('orphanArchetypeNoPrerequisites', 'true', 'disallowed');

    expect(menu._draft).toEqual({
      'artifact-feat': 'disallowed',
    });

    menu._applyBulkGuidance('orphanArchetypeNoPrerequisites', 'true', 'default');

    expect(menu._draft).toEqual({});
  });

  test('bulk guidance can explicitly allow matching items', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'backgrounds';
    menu._draft = {
      'category-default:backgrounds': 'disallowed',
    };
    menu._itemCache.backgrounds = [
      { uuid: 'bg-common', name: 'Scholar', rarity: 'common', level: 1 },
      { uuid: 'bg-rare', name: 'Time Traveler', rarity: 'rare', level: 1 },
    ];

    menu._applyBulkGuidance('rarity', 'common', 'allowed');

    expect(menu._draft).toEqual({
      'category-default:backgrounds': 'disallowed',
      'bg-common': 'allowed',
    });
  });

  test('exposes publication-group bulk groups only on the sources tab', () => {
    const menu = new ContentGuidanceMenu();
    const items = [
      { uuid: 'source-title:paizo blog: foo', publicationTitle: 'Paizo Blog: Foo', name: 'Paizo Blog: Foo' },
      { uuid: 'source-title:pathfinder #219: bar', publicationTitle: 'Pathfinder #219: Bar', name: 'Pathfinder #219: Bar' },
      { uuid: 'source-title:pathfinder player core', publicationTitle: 'Pathfinder Player Core', name: 'Pathfinder Player Core' },
    ];

    menu.activeCategory = 'sources';
    const groups = menu._buildPublicationGroupBulkGroups(items);
    expect(groups.map((g) => g.scopeValue)).toEqual(expect.arrayContaining(['adventure-paths', 'blogs']));
    expect(groups.map((g) => g.scopeValue)).not.toContain('lost-omens');
    expect(groups.every((g) => g.scopeType === 'publicationGroup')).toBe(true);
    expect(groups.find((g) => g.scopeValue === 'blogs').count).toBe(1);

    menu.activeCategory = 'backgrounds';
    expect(menu._buildPublicationGroupBulkGroups(items)).toEqual([]);
  });

  test('bulk-applies guidance to every source in a publication group', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu._draft = {};
    menu._itemCache.sources = [
      { uuid: 'source-title:paizo blog: foo', publicationTitle: 'Paizo Blog: Foo' },
      { uuid: 'source-title:pathfinder player core', publicationTitle: 'Pathfinder Player Core' },
    ];

    menu._applyBulkGuidance('publicationGroup', 'blogs', 'disallowed');

    expect(menu._draft['source-title:paizo blog: foo']).toBe('disallowed');
    expect(menu._draft['source-title:pathfinder player core']).toBeUndefined();
  });

  test('bulk guidance actions expose distinct allow and exclusive visual classes', () => {
    const menu = new ContentGuidanceMenu();

    expect(menu._buildBulkActions({ includeAllowed: true }).find((action) => action.status === 'allowed')).toEqual(expect.objectContaining({
      className: 'tag--allowed',
    }));
    expect(menu._buildBulkExclusiveActions().find((action) => action.exclusive === true)).toEqual(expect.objectContaining({
      className: 'tag--exclusive',
    }));
    expect(menu._buildBulkFreeArchetypeExclusiveActions().find((action) => action.freeArchetypeExclusive === true)).toEqual(expect.objectContaining({
      className: 'tag--free-archetype-exclusive',
    }));
  });

  test('exclusive modes stay mutually exclusive and preserve suggested guidance', () => {
    const menu = new ContentGuidanceMenu();
    menu._draft = {
      'medic-dedication': 'recommended',
    };

    menu._setGuidanceExclusive('medic-dedication', true);
    menu._setGuidanceFreeArchetypeExclusive('medic-dedication', true);

    expect(menu._draft).toEqual({
      'medic-dedication': {
        status: 'recommended',
        freeArchetypeExclusive: true,
      },
    });

    menu._setGuidanceExclusive('medic-dedication', true);

    expect(menu._draft).toEqual({
      'medic-dedication': {
        status: 'recommended',
        exclusive: true,
      },
    });
  });

  test('category default policy writes and clears the tab default key', () => {
    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'classes';
    menu._draft = {};

    menu._setCategoryDefaultPolicy('disallowed');
    expect(menu._draft).toEqual({ 'category-default:classes': 'disallowed' });

    menu._setCategoryDefaultPolicy('allowed');
    expect(menu._draft).toEqual({});
  });

  test('clear tab only removes guidance entries from the active category', () => {
    document.body.innerHTML = '<button type="button" data-action="clear-all-guidance"></button>';

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'heritages';
    menu._draft = {
      'category-default:heritages': 'disallowed',
      'heritage-elf': 'recommended',
      'background-a': 'disallowed',
    };
    menu._itemCache.heritages = [{ uuid: 'heritage-elf', name: 'Ancient Elf' }];
    menu._itemCache.backgrounds = [{ uuid: 'background-a', name: 'Scholar' }];
    menu.element = document.body;
    menu.render = jest.fn();

    menu._onRender();
    document.querySelector('[data-action="clear-all-guidance"]').click();

    expect(menu._draft).toEqual({ 'background-a': 'disallowed' });
  });

  test('view item opens compendium-backed guidance entries', async () => {
    document.body.innerHTML = '<button type="button" data-action="viewGuidanceItem" data-uuid="Compendium.test.items.Item.abc"></button>';

    const render = jest.fn();
    global.fromUuid = jest.fn(async () => ({ sheet: { render } }));

    const menu = new ContentGuidanceMenu();
    menu.element = document.body;

    menu._onRender();
    document.querySelector('[data-action="viewGuidanceItem"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(global.fromUuid).toHaveBeenCalledWith('Compendium.test.items.Item.abc');
    expect(render).toHaveBeenCalledWith(true);
  });

  test('changing guidance preserves the current list scroll position', () => {
    document.body.innerHTML = `
      <div class="compendium-manager__panelWrap" style="overflow:auto">
        <button type="button" data-action="cycle-guidance" data-uuid="heritage-elf"></button>
      </div>
    `;

    const menu = new ContentGuidanceMenu();
    menu._draft = {};
    menu.element = document.body;
    menu.render = jest.fn();

    const panel = document.querySelector('.compendium-manager__panelWrap');
    panel.scrollTop = 240;

    menu._onRender();
    document.querySelector('[data-action="cycle-guidance"]').click();

    expect(menu._draft).toEqual({ 'heritage-elf': 'recommended' });
    expect(menu._pendingScrollTop).toBe(240);
    expect(menu.render).toHaveBeenCalledWith(true);
  });

  test('source search input rerenders instead of only hiding stale DOM rows', () => {
    document.body.innerHTML = `
      <div class="compendium-manager__panelWrap" style="overflow:auto">
        <input type="text" data-action="search-guidance" value="">
        <div class="guidance-item"><span class="guidance-item__name">Pathfinder Player Core</span></div>
      </div>
    `;

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu._draft = {};
    menu.element = document.body;
    menu.render = jest.fn();

    menu._onRender();
    document.querySelector('[data-action="search-guidance"]').value = 'player core';
    document.querySelector('[data-action="search-guidance"]').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-action="search-guidance"]').value = '';
    document.querySelector('[data-action="search-guidance"]').dispatchEvent(new Event('input', { bubbles: true }));

    expect(menu.searchText).toBe('');
    expect(menu.render).toHaveBeenCalledTimes(0);
  });

  test('render reapplies active search filter to current DOM list', () => {
    document.body.innerHTML = `
      <div class="compendium-manager__panelWrap" style="overflow:auto">
        <input type="text" data-action="search-guidance" value="player core">
        <div class="guidance-item"><span class="guidance-item__name">Pathfinder Player Core</span></div>
        <div class="guidance-item"><span class="guidance-item__name">Lost Omens Divine Mysteries</span></div>
      </div>
    `;

    const menu = new ContentGuidanceMenu();
    menu.activeCategory = 'sources';
    menu.searchText = 'player core';
    menu._draft = {};
    menu.element = document.body;
    menu.render = jest.fn();

    menu._onRender();

    const items = [...document.querySelectorAll('.guidance-item')];
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });
});
