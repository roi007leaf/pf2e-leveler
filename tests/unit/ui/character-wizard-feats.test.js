import {
  CharacterWizard,
  buildPublicationOptions,
  buildPublicationFilterState,
  buildCompendiumSourceOptions,
  filterStepContextByPublication,
  filterStepContextByCompendiumSource,
} from '../../../scripts/ui/character-wizard/index.js';
import { FeatPicker } from '../../../scripts/ui/feat-picker.js';
import { buildFeatChoicesContext } from '../../../scripts/ui/character-wizard/choice-sets.js';
import { activateCharacterWizardListeners } from '../../../scripts/ui/character-wizard/listeners.js';
import {
  loadAncestries,
  loadBackgrounds,
  loadClasses,
  loadHeritages,
  loadRawHeritages,
  invalidateCharacterWizardCompendiumCaches,
} from '../../../scripts/ui/character-wizard/loaders.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { saveCreationData } from '../../../scripts/creation/creation-store.js';
import { getClassHandler } from '../../../scripts/creation/class-handlers/registry.js';
import { MIXED_ANCESTRY_UUID } from '../../../scripts/constants.js';
import { invalidateGuidanceCache } from '../../../scripts/access/content-guidance.js';
import { SWASHBUCKLER } from '../../../scripts/classes/swashbuckler.js';
const { getCreationData } = jest.requireMock('../../../scripts/creation/creation-store.js');

jest.mock('../../../scripts/creation/creation-store.js', () => ({
  getCreationData: jest.fn(() => null),
  saveCreationData: jest.fn(),
  clearCreationData: jest.fn(),
}));

jest.mock('../../../scripts/creation/apply-creation.js', () => ({
  applyCreation: jest.fn(),
}));

jest.mock('../../../scripts/utils/i18n.js', () => ({
  localize: jest.fn((key) => key),
}));

describe('CharacterWizard feat step ancestry filtering', () => {
  async function flushAsyncListeners() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    ClassRegistry.clear();
  });

  it('rebuilds missing creation data from an existing actor', async () => {
    const actor = createMockActor({
      ancestry: {
        uuid: 'Compendium.test.ancestries.Item.human',
        name: 'Human',
        slug: 'human',
        img: 'human.png',
        system: {
          traits: { value: ['human', 'humanoid'] },
        },
      },
      heritage: {
        uuid: 'Compendium.test.heritages.Item.versatile',
        name: 'Versatile Heritage',
        slug: 'versatile-heritage',
        img: 'heritage.png',
      },
      background: {
        uuid: 'Compendium.test.backgrounds.Item.acolyte',
        name: 'Acolyte',
        slug: 'acolyte',
        img: 'background.png',
      },
      class: {
        uuid: 'Compendium.test.classes.Item.fighter',
        name: 'Fighter',
        slug: 'fighter',
        img: 'fighter.png',
      },
      items: [
        {
          type: 'feat',
          uuid: 'Actor.test.Item.natural-ambition',
          sourceId: 'Compendium.test.feats.Item.natural-ambition',
          name: 'Natural Ambition',
          slug: 'natural-ambition',
          img: 'feat-a.png',
          system: { location: 'ancestry-1', rules: [], description: { value: '' } },
        },
        {
          type: 'feat',
          uuid: 'Actor.test.Item.reactive-shield',
          sourceId: 'Compendium.test.feats.Item.reactive-shield',
          name: 'Reactive Shield',
          slug: 'reactive-shield',
          img: 'feat-b.png',
          system: { location: 'class-1', rules: [], description: { value: '' } },
        },
      ],
    });

    global.fromUuid = jest.fn((uuid) =>
      Promise.resolve({
        uuid,
        type: 'feat',
        name: uuid.endsWith('natural-ambition') ? 'Natural Ambition' : 'Reactive Shield',
        slug: uuid.endsWith('natural-ambition') ? 'natural-ambition' : 'reactive-shield',
        img: 'resolved.png',
        system: {
          rules: [],
          description: { value: '' },
        },
      }),
    );

    const wizard = new CharacterWizard(actor);
    await wizard._recoverCreationDataFromActor();

    expect(wizard.data.ancestry).toEqual(
      expect.objectContaining({
        slug: 'human',
        name: 'Human',
        traits: ['human', 'humanoid'],
      }),
    );
    expect(wizard.data.background).toEqual(
      expect.objectContaining({ slug: 'acolyte', name: 'Acolyte' }),
    );
    expect(wizard.data.class).toEqual(
      expect.objectContaining({ slug: 'fighter', name: 'Fighter' }),
    );
    expect(wizard.data.ancestryFeat).toEqual(
      expect.objectContaining({ slug: 'natural-ambition', name: 'Natural Ambition' }),
    );
    expect(wizard.data.classFeat).toEqual(
      expect.objectContaining({ slug: 'reactive-shield', name: 'Reactive Shield' }),
    );
    expect(saveCreationData).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        ancestry: expect.objectContaining({ slug: 'human' }),
        class: expect.objectContaining({ slug: 'fighter' }),
        ancestryFeat: expect.objectContaining({ slug: 'natural-ambition' }),
        classFeat: expect.objectContaining({ slug: 'reactive-shield' }),
      }),
    );
  });

  it('requires a second ancestry feat at level 1 when ancestry paragon is enabled', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.ancestryFeat = {
      uuid: 'feat-1',
      name: 'Natural Ambition',
      choiceSets: [],
      choices: {},
    };

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.ancestryParagonFeat = {
      uuid: 'feat-2',
      name: 'General Training',
      choiceSets: [],
      choices: {},
    };
    expect(wizard._isStepComplete('feats')).toBe(true);
  });

  it('returns feat step context flags for kholo ancestry', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-kholo', slug: 'kholo', name: 'Kholo' };
    wizard.data.class = { uuid: 'class-fighter', slug: 'fighter', name: 'Fighter' };
    wizard._cachedHasClassFeatAtLevel1 = false;

    const context = await wizard._buildFeatContext();

    expect(context.hasClassFeat).toBe(false);
    expect(context.hasSkillFeat).toBe(false);
    expect(context.ancestralParagonEnabled).toBe(false);
  });

  it('ancestry step only shows actual ancestry documents from mixed assigned packs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 0;
    wizard._loadAncestries = jest.fn(async () => [
      {
        uuid: 'ancestry-1',
        name: 'Elf',
        type: 'ancestry',
        slug: 'elf',
      },
      {
        uuid: 'feat-1',
        name: "Til Ragnarok's End",
        type: 'feat',
        traits: ['elf'],
      },
    ]);

    const context = await wizard._getStepContext();

    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'ancestry-1',
        name: 'Elf',
        type: 'ancestry',
      }),
    ]);
  });

  it('background step only shows actual background documents from mixed assigned packs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 3;
    wizard._loadBackgrounds = jest.fn(async () => [
      {
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
        slug: 'acolyte',
      },
      {
        uuid: 'feat-1',
        name: "Til Ragnarok's End",
        type: 'feat',
        slug: 'til-ragnaroks-end',
      },
    ]);

    const context = await wizard._getStepContext();

    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
      }),
    ]);
  });

  it('marks ancestry browser entries disallowed when inherited from source guidance', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {
          'source-title:pathfinder player core': 'disallowed',
        },
      },
    };
    invalidateGuidanceCache();
    game.settings.get = jest.fn((moduleId, settingId) => global._testSettings?.[moduleId]?.[settingId] ?? false);
    game.user.isGM = false;

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 0;
    game.packs.get.mockImplementation((key) => {
      if (key !== 'pf2e.ancestries') return null;
      return {
        metadata: {
          label: 'PF2E Ancestries',
          packageName: 'pf2e',
        },
        collection: 'pf2e.ancestries',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.elf',
            name: 'Elf',
            img: 'elf.png',
            type: 'ancestry',
            slug: 'elf',
            system: {
              traits: { value: ['elf'], rarity: 'common' },
              publication: { title: 'Pathfinder Player Core' },
            },
          },
        ]),
      };
    });

    const context = await wizard._prepareContext();

    expect(context.browserStep.items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.ancestries.Item.elf',
        publicationTitle: 'Pathfinder Player Core',
        isDisallowed: true,
        guidanceInherited: true,
        guidanceSelectionBlocked: true,
        guidanceSelectionTooltip: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_DISALLOWED',
      }),
    ]);

    game.user.isGM = true;
  });

  it('keeps ancestry browser entries selectable for GMs when disallowed by source guidance', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {
          'source-title:pathfinder player core': 'disallowed',
        },
      },
    };
    invalidateGuidanceCache();
    game.settings.get = jest.fn((moduleId, settingId) => global._testSettings?.[moduleId]?.[settingId] ?? false);
    game.user.isGM = true;

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 0;
    game.packs.get.mockImplementation((key) => {
      if (key !== 'pf2e.ancestries') return null;
      return {
        metadata: {
          label: 'PF2E Ancestries',
          packageName: 'pf2e',
        },
        collection: 'pf2e.ancestries',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.elf',
            name: 'Elf',
            img: 'elf.png',
            type: 'ancestry',
            slug: 'elf',
            system: {
              traits: { value: ['elf'], rarity: 'common' },
              publication: { title: 'Pathfinder Player Core' },
            },
          },
        ]),
      };
    });

    const context = await wizard._prepareContext();

    expect(context.browserStep.items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.ancestries.Item.elf',
        isDisallowed: true,
        guidanceSelectionBlocked: false,
        guidanceSelectionTooltip: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.GM_OVERRIDE_ALLOWED',
      }),
    ]);
  });

  it('keeps ancestry browser entries visible but blocked for players when disallowed mode is unselectable', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {
          'source-title:pathfinder player core': 'disallowed',
        },
        playerDisallowedContentMode: 'unselectable',
      },
    };
    invalidateGuidanceCache();
    game.settings.get = jest.fn((moduleId, settingId) => global._testSettings?.[moduleId]?.[settingId] ?? false);
    game.user.isGM = false;

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 0;
    game.packs.get.mockImplementation((key) => {
      if (key !== 'pf2e.ancestries') return null;
      return {
        metadata: {
          label: 'PF2E Ancestries',
          packageName: 'pf2e',
        },
        collection: 'pf2e.ancestries',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.elf',
            name: 'Elf',
            img: 'elf.png',
            type: 'ancestry',
            slug: 'elf',
            system: {
              traits: { value: ['elf'], rarity: 'common' },
              publication: { title: 'Pathfinder Player Core' },
            },
          },
        ]),
      };
    });

    const context = await wizard._prepareContext();

    expect(context.browserStep.items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.ancestries.Item.elf',
        isDisallowed: true,
        guidanceSelectionBlocked: true,
        guidanceSelectionTooltip: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_DISALLOWED',
      }),
    ]);

    game.user.isGM = true;
  });

  it('keeps versatile heritage browser entries selectable for GMs when disallowed by source guidance', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {
          'source-title:pathfinder player core': 'disallowed',
        },
      },
    };
    invalidateGuidanceCache();
    game.settings.get = jest.fn((moduleId, settingId) => global._testSettings?.[moduleId]?.[settingId] ?? false);
    game.user.isGM = true;

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 1;
    wizard.data.ancestry = {
      uuid: 'Compendium.pf2e.ancestries.Item.elf',
      slug: 'elf',
      name: 'Elf',
      img: 'elf.png',
    };

    game.packs.get.mockImplementation((key) => {
      if (key !== 'pf2e.heritages') return null;
      return {
        metadata: {
          label: 'PF2E Heritages',
          packageName: 'pf2e',
        },
        collection: 'pf2e.heritages',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.heritages.Item.elf-atavism',
            name: 'Elf Atavism',
            img: 'elf-atavism.png',
            type: 'heritage',
            slug: 'elf-atavism',
            system: {
              traits: { value: ['elf'], rarity: 'common' },
              ancestry: { slug: 'elf' },
              publication: { title: 'Pathfinder Player Core' },
            },
          },
          {
            uuid: 'Compendium.pf2e.heritages.Item.aiuvarin',
            name: 'Aiuvarin',
            img: 'aiuvarin.png',
            type: 'heritage',
            slug: 'aiuvarin',
            system: {
              traits: { value: ['aiuvarin'], rarity: 'common' },
              publication: { title: 'Pathfinder Player Core' },
            },
          },
        ]),
      };
    });

    const context = await wizard._prepareContext();
    const versatileGroup = context.browserStep.groups.find((group) =>
      group.items.some((item) => item.uuid === 'Compendium.pf2e.heritages.Item.aiuvarin'),
    );

    expect(versatileGroup.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.heritages.Item.aiuvarin',
        isDisallowed: true,
        guidanceSelectionBlocked: false,
        guidanceSelectionTooltip: 'PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.GM_OVERRIDE_ALLOWED',
      }),
    ]));
  });

  it('registers selected custom world classes into the class registry', async () => {
    const actor = createMockActor();
    const wizard = new CharacterWizard(actor);
    const customClass = {
      uuid: 'Item.world-class',
      name: 'World Class',
      type: 'class',
      slug: 'world-class',
      system: {
        hp: 10,
        keyAbility: { value: ['str'] },
        trainedSkills: { value: ['athletics'], additional: 2 },
        classFeatLevels: { value: [1, 2] },
        skillFeatLevels: { value: [2] },
        generalFeatLevels: { value: [3] },
        ancestryFeatLevels: { value: [1] },
        skillIncreaseLevels: { value: [3] },
        items: {},
      },
    };

    wizard.data.class = {
      uuid: customClass.uuid,
      name: customClass.name,
      slug: customClass.slug,
      img: null,
      sourcePack: null,
      sourcePackage: 'world',
      keyAbility: null,
      subclassTag: null,
    };
    wizard._documentCache.set(customClass.uuid, customClass);

    await wizard._ensureClassMetadata(customClass);

    expect(ClassRegistry.has('world-class')).toBe(true);
    expect(ClassRegistry.get('world-class')).toEqual(expect.objectContaining({
      slug: 'world-class',
      hp: 10,
      keyAbility: ['str'],
    }));
  });

  it('loads background browser entries with trained skills and boosts for filtering', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async () => [
      {
        uuid: 'background-1',
        name: 'Warrior',
        type: 'background',
        sourcePack: 'pf2e.backgrounds',
        sourceLabel: 'Backgrounds',
        sourcePackage: 'pf2e',
        sourcePackageLabel: 'PF2E',
        slug: 'warrior',
        rarity: 'common',
        description: '',
        traits: [],
        trainedSkills: ['athletics'],
        boosts: ['str', 'con'],
        boostSets: [['str', 'con']],
      },
    ]);

    const items = await loadBackgrounds(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        trainedSkills: ['athletics'],
        boosts: ['str', 'con'],
        backgroundAttributes: ['str', 'con'],
      }),
    ]);
  });

  it('loads background browser attributes from key ability data when boosts are empty', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async () => [
      {
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
        sourcePack: 'pf2e.backgrounds',
        sourceLabel: 'Backgrounds',
        sourcePackage: 'pf2e',
        sourcePackageLabel: 'PF2E',
        slug: 'acolyte',
        rarity: 'common',
        description: '',
        traits: [],
        trainedSkills: ['religion'],
        boosts: [],
        boostSets: [['int', 'wis'], ['str', 'dex', 'con', 'int', 'wis', 'cha']],
        keyAbility: ['int', 'wis'],
      },
    ]);

    const items = await loadBackgrounds(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        backgroundAttributes: ['int', 'wis'],
      }),
    ]);
  });

  it('hydrates cached background entries with derived background attributes', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._compendiumCache.backgrounds = [
      {
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
        trainedSkills: ['religion'],
        boosts: ['int', 'wis', 'str', 'dex', 'con', 'cha'],
        boostSets: [['int', 'wis'], ['str', 'dex', 'con', 'int', 'wis', 'cha']],
        keyAbility: ['int', 'wis'],
      },
    ];

    const items = await loadBackgrounds(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        backgroundAttributes: ['int', 'wis'],
      }),
    ]);
  });

  it('prefers the narrow specific background attribute choices over free-choice rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async () => [
      {
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
        sourcePack: 'pf2e.backgrounds',
        sourceLabel: 'Backgrounds',
        sourcePackage: 'pf2e',
        sourcePackageLabel: 'PF2E',
        slug: 'acolyte',
        rarity: 'common',
        description: '',
        traits: [],
        trainedSkills: ['religion'],
        boosts: ['int', 'wis', 'str', 'dex', 'con', 'cha'],
        boostSets: [
          ['intelligence', 'wisdom'],
          ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
        ],
        keyAbility: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
      },
    ]);

    const items = await loadBackgrounds(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        backgroundAttributes: ['int', 'wis'],
      }),
    ]);
  });

  it('filters background browser items by selected attributes', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundAttributeFilter" data-attribute="str"></button>
      <div class="wizard-item" data-name="Warrior" data-rarity="common" data-skills="athletics" data-attributes="str,con"></div>
      <div class="wizard-item" data-name="Scholar" data-rarity="common" data-skills="arcana" data-attributes="int,wis"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundAttributeFilters.add('str');

    wizard._filterItems(document.body, '');

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  it('supports AND logic for background skill filters', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundSkillFilter" data-skill="arcana"></button>
      <div class="wizard-item" data-name="Sage" data-rarity="common" data-skills="arcana,occultism" data-attributes="int"></div>
      <div class="wizard-item" data-name="Researcher" data-rarity="common" data-skills="arcana" data-attributes="int,wis"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundSkillFilters = new Set(['arcana', 'occultism']);
    wizard._backgroundSkillFilterLogic = 'and';

    wizard._filterItems(document.body, '');

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  it('supports AND logic for background attribute filters', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundAttributeFilter" data-attribute="str"></button>
      <div class="wizard-item" data-name="Warrior" data-rarity="common" data-skills="athletics" data-attributes="str,con"></div>
      <div class="wizard-item" data-name="Brawler" data-rarity="common" data-skills="athletics" data-attributes="str"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundAttributeFilters = new Set(['str', 'con']);
    wizard._backgroundAttributeFilterLogic = 'and';

    wizard._filterItems(document.body, '');

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  it('matches background attribute filters against full attribute names', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundAttributeFilter" data-attribute="int"></button>
      <div class="wizard-item" data-name="Acolyte" data-rarity="common" data-skills="religion" data-attributes="intelligence,wisdom"></div>
      <div class="wizard-item" data-name="Warrior" data-rarity="common" data-skills="athletics" data-attributes="strength,constitution"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundAttributeFilters.add('int');

    wizard._filterItems(document.body, '');

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  it('filters background browser items by key ability-backed attributes', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundAttributeFilter" data-attribute="int"></button>
      <div class="wizard-item" data-name="Acolyte" data-rarity="common" data-skills="religion" data-attributes="int,wis"></div>
      <div class="wizard-item" data-name="Warrior" data-rarity="common" data-skills="athletics" data-attributes="str,con"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundAttributeFilters.add('int');

    wizard._filterItems(document.body, '');

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('');
    expect(items[1].style.display).toBe('none');
  });

  it('updates visible background result count when browser filters run', () => {
    document.body.innerHTML = `
      <button type="button" data-action="toggleBackgroundAttributeFilter" data-attribute="str"></button>
      <div class="wizard-browser__count">2</div>
      <div class="wizard-item" data-name="Warrior" data-rarity="common" data-skills="athletics" data-attributes="str,con"></div>
      <div class="wizard-item" data-name="Scholar" data-rarity="common" data-skills="arcana" data-attributes="int,wis"></div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard._backgroundAttributeFilters.add('str');

    wizard._filterItems(document.body, '');

    expect(document.querySelector('.wizard-browser__count').textContent).toBe('1');
  });

  it('reapplies background browser filters after rerender', () => {
    document.body.innerHTML = `
      <div class="wizard-browser">
        <button type="button" data-action="toggleBackgroundSkillFilter" data-skill="religion"></button>
        <button type="button" data-action="toggleBackgroundSkillFilter" data-skill="arcana"></button>
        <div class="wizard-browser__count">2</div>
        <div class="wizard-item" data-name="Acolyte" data-rarity="common" data-skills="religion" data-attributes="int,wis"></div>
        <div class="wizard-item" data-name="Scholar" data-rarity="common" data-skills="religion,arcana" data-attributes="int,wis"></div>
      </div>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard.element = document.body;
    wizard._restoreWizardScroll = jest.fn();
    wizard._activateListeners = jest.fn();
    wizard._ensureBootstrapped = jest.fn();
    wizard._syncSpellLayout = jest.fn();
    wizard.currentStep = 3;
    wizard._backgroundSkillFilters = new Set(['religion', 'arcana']);
    wizard._backgroundSkillFilterLogic = 'and';

    wizard._onRender();

    const items = Array.from(document.querySelectorAll('.wizard-item'));
    expect(items[0].style.display).toBe('none');
    expect(items[1].style.display).toBe('');
    expect(document.querySelector('.wizard-browser__count').textContent).toBe('1');
  });

  it('restores spell-step scroll position from the wizard main scroller after rerender', () => {
    const wizard = new CharacterWizard(createMockActor());
    const initialRoot = document.createElement('div');
    initialRoot.innerHTML = `
      <div class="wizard-steps"></div>
      <div class="wizard-content">
        <div class="wizard-main wizard-main--browser" style="overflow-y:auto;"></div>
      </div>
      <div class="wizard-browser__filters"></div>
      <div class="wizard-browser__results"></div>
    `;
    initialRoot.querySelector('.wizard-main').scrollTop = 172;
    wizard.element = initialRoot;

    wizard._captureWizardScroll();

    const rerenderedRoot = document.createElement('div');
    rerenderedRoot.innerHTML = `
      <div class="wizard-steps"></div>
      <div class="wizard-content">
        <div class="wizard-main wizard-main--browser" style="overflow-y:auto;"></div>
      </div>
      <div class="wizard-browser__filters"></div>
      <div class="wizard-browser__results"></div>
    `;

    wizard._restoreWizardScroll(rerenderedRoot);

    expect(rerenderedRoot.querySelector('.wizard-main').scrollTop).toBe(172);
  });

  it('heritage step only shows actual heritage documents from mixed assigned packs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 1;
    wizard.data.ancestry = {
      uuid: 'ancestry-1',
      slug: 'human',
      name: 'Human',
    };
    wizard._loadHeritages = jest.fn(async () => [
      {
        uuid: 'heritage-1',
        name: 'Versatile Heritage',
        type: 'heritage',
        slug: 'versatile-heritage',
      },
      {
        uuid: 'feat-1',
        name: "Til Ragnarok's End",
        type: 'feat',
        slug: 'til-ragnaroks-end',
      },
    ]);

    const context = await wizard._getStepContext();

    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'heritage-1',
        name: 'Versatile Heritage',
        type: 'heritage',
      }),
    ]);
  });

  it('loads heritages using ancestry aliases when ancestry and heritage use different normalized slugs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'Compendium.test.ancestries.Item.kholo',
      slug: 'kholo',
      name: 'Kholo',
    };
    wizard._compendiumCache.heritages = [
      {
        uuid: 'heritage-gnoll',
        name: 'Great Gnoll Heritage',
        type: 'heritage',
        ancestrySlug: 'gnoll',
        traits: ['gnoll'],
      },
      {
        uuid: 'heritage-elf',
        name: 'Elf Heritage',
        type: 'heritage',
        ancestrySlug: 'elf',
        traits: ['elf'],
      },
    ];

    const items = await loadHeritages(wizard);

    expect(items.map((item) => item.uuid)).toEqual([
      'heritage-gnoll',
      'pf2e-leveler.synthetic.heritage.mixed-ancestry',
    ]);
  });

  it('loads heritages when the selected ancestry has no slug but the heritage matches its name or uuid tokens', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'Compendium.battlezoo.ancestries.Item.dragon',
      slug: null,
      name: 'Dragon',
    };
    wizard._compendiumCache.heritages = [
      {
        uuid: 'heritage-dragon',
        name: 'Battle Dragon Heritage',
        type: 'heritage',
        ancestrySlug: null,
        traits: ['dragon'],
      },
      {
        uuid: 'heritage-human',
        name: 'Human Heritage',
        type: 'heritage',
        ancestrySlug: 'human',
        traits: ['human'],
      },
    ];

    const items = await loadHeritages(wizard);

    expect(items.map((item) => item.uuid)).toEqual([
      'heritage-dragon',
      'pf2e-leveler.synthetic.heritage.mixed-ancestry',
    ]);
  });

  it('loadRawHeritages marks loaded entries as heritage type for the step filter', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._compendiumCache = {};
    game.packs.get.mockReturnValue({
      metadata: {
        label: 'Test Heritages',
        packageName: 'test-module',
      },
      collection: 'test-module.heritages',
      getDocuments: jest.fn(async () => [
        {
          uuid: 'Compendium.test-module.heritages.Item.heritage-1',
          name: 'Dragon Heritage',
          img: 'icons/svg/mystery-man.svg',
          type: 'heritage',
          slug: 'dragon-heritage',
          system: {
            traits: { value: ['dragon'], rarity: 'common' },
            ancestry: { slug: 'dragon' },
          },
        },
      ]),
    });

    const items = await loadRawHeritages(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.test-module.heritages.Item.heritage-1',
        type: 'heritage',
        ancestrySlug: 'dragon',
      }),
    ]);
  });

  it('drops stale cached heritages after compendium settings invalidation', async () => {
    game.user.isGM = false;
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {},
        restrictPlayerCompendiumAccess: true,
        playerCompendiumAccess: {
          enabled: true,
          selections: {
            heritages: ['pf2e.heritages'],
          },
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard._compendiumCache = {
      heritages: [
        {
          uuid: 'Compendium.custom.heritages.Item.hidden',
          name: 'Hidden Heritage',
          type: 'heritage',
          sourcePack: 'custom.heritages',
          sourcePackage: 'custom-module',
          sourcePackageLabel: 'Custom Module',
          ancestrySlug: 'human',
          traits: ['human'],
          rarity: 'common',
        },
      ],
    };
    wizard._compendiumCacheVersion = 0;

    game.packs.get.mockImplementation((key) => {
      if (key !== 'pf2e.heritages') return null;
      return {
        metadata: {
          label: 'PF2E Heritages',
          packageName: 'pf2e',
        },
        collection: 'pf2e.heritages',
        getDocuments: jest.fn(async () => [
          {
            uuid: 'Compendium.pf2e.heritages.Item.versatile',
            name: 'Versatile Heritage',
            img: 'icons/svg/mystery-man.svg',
            type: 'heritage',
            slug: 'versatile-heritage',
            system: {
              traits: { value: ['human'], rarity: 'common' },
              ancestry: { slug: 'human' },
            },
          },
        ]),
      };
    });

    invalidateCharacterWizardCompendiumCaches();
    const items = await loadRawHeritages(wizard);

    expect(items.map((item) => item.uuid)).toEqual([
      'Compendium.pf2e.heritages.Item.versatile',
    ]);

    game.user.isGM = true;
  });

  it('class step only shows actual class documents from mixed assigned packs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 4;
    wizard._loadClasses = jest.fn(async () => [
      {
        uuid: 'class-1',
        name: 'Fighter',
        type: 'class',
        slug: 'fighter',
      },
      {
        uuid: 'feat-1',
        name: "Til Ragnarok's End",
        type: 'feat',
        slug: 'til-ragnaroks-end',
      },
    ]);

    const context = await wizard._getStepContext();

    expect(context.items).toEqual([
      expect.objectContaining({
        uuid: 'class-1',
        name: 'Fighter',
        type: 'class',
      }),
    ]);
  });

  it.each([
    ['ancestries', loadAncestries, 'pf2e.ancestries', 'ancestry', {
      traits: { value: ['elf'], rarity: 'common' },
    }],
    ['backgrounds', loadBackgrounds, 'pf2e.backgrounds', 'background', {
      traits: { value: [], rarity: 'common' },
      boosts: {},
      keyAbility: { value: ['wis'] },
      trainedSkills: { value: [] },
    }],
    ['classes', loadClasses, 'pf2e.classes', 'class', {
      traits: { value: [], rarity: 'common' },
    }],
    ['heritages', loadRawHeritages, 'pf2e.heritages', 'heritage', {
      traits: { value: ['elf'], rarity: 'common' },
      ancestry: { slug: 'elf' },
    }],
  ])('preserves publication titles for %s loader results', async (_label, loader, packKey, type, system) => {
    const wizard = new CharacterWizard(createMockActor());
    if (packKey === 'pf2e.heritages') {
      wizard.data.ancestry = { uuid: 'ancestry-elf', slug: 'elf', name: 'Elf' };
    }

    game.packs.get.mockImplementation((key) => {
      if (key !== packKey) return null;
      return {
        metadata: {
          label: `Test ${type}`,
          packageName: 'pf2e',
        },
        collection: packKey,
        getDocuments: jest.fn(async () => [
          {
            uuid: `Compendium.${packKey}.Item.test`,
            name: `Test ${type}`,
            img: `${type}.png`,
            type,
            slug: `test-${type}`,
            system: {
              ...system,
              publication: { title: 'Pathfinder Player Core' },
            },
          },
        ]),
      };
    });

    const [item] = await loader(wizard);

    expect(item).toEqual(expect.objectContaining({
      publicationTitle: 'Pathfinder Player Core',
    }));
  });

  it('buildPublicationOptions starts with all publications unselected', () => {
    const options = buildPublicationOptions({
      items: [
        { uuid: 'a', publicationTitle: 'Pathfinder Player Core' },
        { uuid: 'b', publicationTitle: 'Pathfinder Book of the Dead' },
      ],
    });

    expect(options).toEqual([
      expect.objectContaining({ key: 'Pathfinder Book of the Dead', selected: false }),
      expect.objectContaining({ key: 'Pathfinder Player Core', selected: false }),
    ]);
  });

  it('publication filter can return to empty selection to show all results', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.render = jest.fn();
    wizard.currentStep = 0;
    wizard._publicationFilters.ancestry = ['Pathfinder Player Core'];

    wizard._togglePublicationFilter('Pathfinder Player Core', [
      'Pathfinder Player Core',
      'Pathfinder Book of the Dead',
    ]);

    expect(wizard._publicationFilters.ancestry).toEqual([]);
    expect(wizard.render).toHaveBeenCalledWith(true);
  });

  it('starts wizard publication filters collapsed with active selection summary', () => {
    const state = buildPublicationFilterState([
      { key: 'Pathfinder Player Core', label: 'Pathfinder Player Core', selected: true },
      { key: 'Pathfinder Book of the Dead', label: 'Pathfinder Book of the Dead', selected: false },
    ], true);

    expect(state).toEqual(expect.objectContaining({
      collapsed: true,
      activeCount: 1,
      summary: '1',
    }));
  });

  it('toggles wizard publication filter collapse without changing selected publications', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.render = jest.fn();
    wizard.currentStep = 0;
    wizard._publicationFilters.ancestry = ['Pathfinder Player Core'];

    wizard._togglePublicationFilterSection();

    expect(wizard._publicationFilterCollapsed).toBe(false);
    expect(wizard._publicationFilters.ancestry).toEqual(['Pathfinder Player Core']);
    expect(wizard.render).toHaveBeenCalledWith(true);
  });

  it('filters ancestry items by publication even when synthetic entries have no publication title', () => {
    const filtered = filterStepContextByPublication(
      {
        items: [
          { uuid: 'synthetic', name: 'Mixed Ancestry', publicationTitle: null },
          { uuid: 'core', name: 'Elf', publicationTitle: 'Pathfinder Player Core' },
          { uuid: 'dead', name: 'Skeleton', publicationTitle: 'Book of the Dead' },
        ],
      },
      [
        { key: 'Pathfinder Player Core', label: 'Pathfinder Player Core', selected: true },
        { key: 'Book of the Dead', label: 'Book of the Dead', selected: false },
      ],
    );

    expect(filtered.items).toEqual([
      expect.objectContaining({ uuid: 'synthetic' }),
      expect.objectContaining({ uuid: 'core' }),
    ]);
  });

  it('stores a second class when dual class support is enabled', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard._saveAndRender = jest.fn(async () => {});

    wizard._documentCache.set('class-1', {
      uuid: 'class-1',
      name: 'Fighter',
      img: 'fighter.png',
      slug: 'fighter',
      subclassTag: 'fighter-doctrine',
      system: { keyAbility: { value: ['str'] }, items: {} },
    });
    wizard._documentCache.set('class-2', {
      uuid: 'class-2',
      name: 'Wizard',
      img: 'wizard.png',
      slug: 'wizard',
      subclassTag: 'arcane-school',
      system: { keyAbility: { value: ['int'] }, items: {} },
    });

    wizard.currentStep = 4;
    await wizard._selectItem('class-1');
    await wizard._selectItem('class-2');

    expect(wizard.data.class).toEqual(expect.objectContaining({ slug: 'fighter', name: 'Fighter' }));
    expect(wizard.data.dualClass).toEqual(expect.objectContaining({ slug: 'wizard', name: 'Wizard' }));
    expect(wizard._isStepComplete('class')).toBe(true);
  });

  it('class step exposes separate primary and dual class groups and removes primary selection from dual list', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 4;
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Animist',
      img: 'animist.png',
      slug: 'animist',
    };
    wizard._loadClasses = jest.fn(async () => ([
      { uuid: 'class-1', name: 'Animist', img: 'animist.png', slug: 'animist', type: 'class' },
      { uuid: 'class-2', name: 'Bard', img: 'bard.png', slug: 'bard', type: 'class' },
      { uuid: 'class-3', name: 'Cleric', img: 'cleric.png', slug: 'cleric', type: 'class' },
    ]));

    const context = await wizard._getStepContext();

    expect(context.classGroups).toEqual([
      expect.objectContaining({
        key: 'class',
        slotLabel: 'Class',
        selected: expect.objectContaining({ slug: 'animist' }),
        items: [
          expect.objectContaining({ slug: 'bard' }),
          expect.objectContaining({ slug: 'cleric' }),
        ],
      }),
      expect.objectContaining({
        key: 'dualClass',
        slotLabel: 'Dual Class',
        selected: null,
        items: [
          expect.objectContaining({ slug: 'bard' }),
          expect.objectContaining({ slug: 'cleric' }),
        ],
      }),
    ]);
    expect(context.classGroups[1].items.some((entry) => entry.slug === 'animist')).toBe(false);
  });

  it('selects class target explicitly for dual-class wizard class step', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 4;
    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid === 'class-1') {
        return {
          uuid,
          name: 'Animist',
          img: 'animist.png',
          slug: 'animist',
          subclassTag: 'animistic-practice',
          system: { keyAbility: { value: ['wis'] }, items: {} },
        };
      }
      return {
        uuid,
        name: 'Bard',
        img: 'bard.png',
        slug: 'bard',
        subclassTag: 'bard-muse',
        system: { keyAbility: { value: ['cha'] }, items: {} },
      };
    });

    await wizard._selectItem('class-1', 'class');
    await wizard._selectItem('class-2', 'dualClass');

    expect(wizard.data.class).toEqual(expect.objectContaining({ slug: 'animist' }));
    expect(wizard.data.dualClass).toEqual(expect.objectContaining({ slug: 'bard' }));
  });

  it('subclass step progresses from the primary class subclass to the dual class subclass', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Wizard',
      img: 'wizard.png',
      slug: 'wizard',
      subclassTag: 'arcane-school',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      name: 'Bard',
      img: 'bard.png',
      slug: 'bard',
      subclassTag: 'muse',
    };
    wizard.currentStep = 8;
    wizard._loadSubclassesForClass = jest.fn(async (classEntry) => (
      classEntry.slug === 'wizard'
        ? [{ uuid: 'sub-1', name: 'School of Ars Grammatica', slug: 'ars-grammatica', type: 'feat' }]
        : [{ uuid: 'sub-2', name: 'Enigma Muse', slug: 'enigma-muse', type: 'feat' }]
    ));

    const primaryContext = await wizard._getStepContext();
    expect(primaryContext.subclassGroups).toEqual([
      expect.objectContaining({
        key: 'class',
        items: [expect.objectContaining({ slug: 'ars-grammatica' })],
      }),
      expect.objectContaining({
        key: 'dualClass',
        items: [expect.objectContaining({ slug: 'enigma-muse' })],
      }),
    ]);
    expect(wizard._isStepComplete('subclass')).toBe(false);

    wizard.data.subclass = {
      uuid: 'sub-1',
      name: 'School of Ars Grammatica',
      slug: 'ars-grammatica',
      choiceSets: [],
      choices: {},
    };

    const dualContext = await wizard._getStepContext();
    expect(dualContext.subclassGroups).toEqual([
      expect.objectContaining({
        key: 'dualClass',
        items: [expect.objectContaining({ slug: 'enigma-muse' })],
      }),
    ]);
    expect(wizard._isStepComplete('subclass')).toBe(false);

    wizard.data.dualSubclass = {
      uuid: 'sub-2',
      name: 'Enigma Muse',
      slug: 'enigma-muse',
      choiceSets: [],
      choices: {},
    };

    expect(wizard._isStepComplete('subclass')).toBe(true);
  });

  it('subclass step exposes separate subclass groups for each dual class', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Animist',
      img: 'animist.png',
      slug: 'animist',
      subclassTag: 'animistic-practice',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      name: 'Bard',
      img: 'bard.png',
      slug: 'bard',
      subclassTag: 'bard-muse',
    };
    wizard.currentStep = 8;
    wizard._loadSubclassesForClass = jest.fn(async (classEntry) => (
      classEntry.slug === 'animist'
        ? [{ uuid: 'sub-1', name: 'Seer', slug: 'seer', type: 'feat' }]
        : [{ uuid: 'sub-2', name: 'Enigma Muse', slug: 'enigma-muse', type: 'feat' }]
    ));

    const context = await wizard._getStepContext();

    expect(context.subclassGroups).toEqual([
      expect.objectContaining({
        key: 'class',
        className: 'Animist',
        items: [expect.objectContaining({ slug: 'seer' })],
      }),
      expect.objectContaining({
        key: 'dualClass',
        className: 'Bard',
        items: [expect.objectContaining({ slug: 'enigma-muse' })],
      }),
    ]);
  });

  it('marks paragon ancestry feat selections separately in the feat context', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-human',
      slug: 'human',
      name: 'Human',
    };
    wizard.data.ancestryFeat = { uuid: 'feat-1', name: 'Natural Ambition' };
    wizard.data.ancestryParagonFeat = { uuid: 'feat-2', name: 'General Training' };

    wizard._loadCompendiumCategory = jest.fn(async () => [
      { uuid: 'feat-1', name: 'Natural Ambition', level: 1, traits: ['human'] },
      { uuid: 'feat-2', name: 'General Training', level: 1, traits: ['human'] },
    ]);

    const context = await wizard._buildFeatContext();
    expect(context.ancestralParagonEnabled).toBe(true);
    expect(context.hasClassFeat).toBe(false);
    expect(context.hasSkillFeat).toBe(false);
  });

  it('returns feat step context flags with adopted ancestry present', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.class = { uuid: 'class-fighter', slug: 'fighter', name: 'Fighter' };
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        choiceSets: [{ flag: 'ancestry', prompt: 'Select a common ancestry.', options: [] }],
      },
    ];
    wizard._cachedHasClassFeatAtLevel1 = false;

    const context = await wizard._buildFeatContext();

    expect(context.hasClassFeat).toBe(false);
    expect(context.hasSkillFeat).toBe(false);
    expect(context.ancestralParagonEnabled).toBe(false);
  });

  it('restores adopted ancestry granted feat choices after reopening saved creation data', async () => {
    game.settings.get = jest.fn(() => false);
    getCreationData.mockReturnValueOnce({
      version: 1,
      ancestry: { uuid: 'ancestry-human', slug: 'human', name: 'Human' },
      heritage: null,
      mixedAncestry: null,
      background: null,
      class: { uuid: 'class-fighter', slug: 'fighter', name: 'Fighter' },
      dualClass: null,
      subclass: null,
      dualSubclass: null,
      boosts: { free: [] },
      languages: [],
      lores: [],
      skills: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: null,
      skillFeat: null,
      grantedFeatSections: [
        {
          slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
          featName: 'Adopted Ancestry',
          choiceSets: [
            {
              flag: 'ancestry',
              prompt: 'Select a common ancestry.',
              options: [
                { value: 'dwarf', label: 'Dwarf', type: 'ancestry' },
                { value: 'elf', label: 'Elf', type: 'ancestry' },
              ],
            },
          ],
        },
      ],
      grantedFeatChoices: {
        Compendium: {
          pf2e: {
            'feats-srd': {
              Item: {
                'adopted-ancestry': {
                  ancestry: 'dwarf',
                },
              },
            },
          },
        },
      },
    });

    const wizard = new CharacterWizard(createMockActor());
    expect(wizard._getFeatChoiceValues('Compendium.pf2e.feats-srd.Item.adopted-ancestry')).toEqual({
      ancestry: 'dwarf',
    });

    const context = await buildFeatChoicesContext(wizard);
    expect(context.featChoiceSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        }),
      ]),
    );
  });

  it('includes mixed ancestry secondary ancestry traits in the creation feat build state', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.heritage = {
      uuid: MIXED_ANCESTRY_UUID,
      slug: 'mixed-ancestry',
      name: 'Mixed Ancestry',
    };
    wizard.data.mixedAncestry = {
      uuid: 'Compendium.pf2e.ancestries.Item.kholo',
      slug: 'kholo',
      name: 'Kholo',
    };

    const buildState = await wizard._buildCreationFeatBuildState();

    expect(buildState.ancestryTraits.has('human')).toBe(true);
    expect(buildState.ancestryTraits.has('kholo')).toBe(true);
    expect(buildState.ancestryTraits.has('gnoll')).toBe(true);
  });

  it('includes ancestry item trait values in the creation feat build state when the ancestry has no slug', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'Item.person',
      slug: null,
      name: 'Person',
      traits: ['human', 'beast-folk'],
    };
    wizard.data.class = { uuid: 'class-fighter', slug: 'fighter', name: 'Fighter' };

    const buildState = await wizard._buildCreationFeatBuildState();

    expect(buildState.ancestryTraits.has('person')).toBe(true);
    expect(buildState.ancestryTraits.has('human')).toBe(true);
    expect(buildState.ancestryTraits.has('beast-folk')).toBe(true);
  });

  it('includes selected level-1 ability modifiers in creation feat build state', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-elf', slug: 'elf', name: 'Elf' };
    wizard.data.background = { uuid: 'background-scholar', slug: 'scholar', name: 'Scholar' };
    wizard.data.class = { uuid: 'class-wizard', slug: 'wizard', name: 'Wizard' };
    wizard.data.boosts = {
      ancestry: ['int'],
      background: ['dex', 'int'],
      class: ['int'],
      free: ['int', 'con', 'wis', 'cha'],
    };
    wizard._documentCache.set('ancestry-elf', {
      system: {
        boosts: {
          0: { value: ['dex'] },
          1: { value: ['int', 'wis', 'str', 'dex', 'con', 'cha'] },
        },
        flaws: {
          0: { value: ['con'] },
        },
      },
    });
    wizard._documentCache.set('background-scholar', {
      system: {
        boosts: {
          0: { value: ['int', 'wis'] },
          1: { value: ['int', 'wis', 'str', 'dex', 'con', 'cha'] },
        },
      },
    });

    const buildState = await wizard._buildCreationFeatBuildState();

    expect(buildState.level).toBe(1);
    expect(buildState.attributes).toEqual({
      str: 0,
      dex: 2,
      con: 0,
      int: 3,
      wis: 1,
      cha: 1,
    });
  });

  it('uses creation ability modifiers to unlock dedication feat choices', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'featSortMethod') return 'name';
      if (scope === 'pf2e-leveler' && key === 'defaultEligibleOnly') return false;
      if (scope === 'pf2e-leveler' && key === 'hideUncommonFeats') return false;
      if (scope === 'pf2e-leveler' && key === 'hideRareFeats') return false;
      if (scope === 'pf2e-leveler' && key === 'enforcePrerequisites') return true;
      if (scope === 'pf2e-leveler' && key === 'showPrerequisites') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-elf', slug: 'elf', name: 'Elf' };
    wizard.data.background = { uuid: 'background-scholar', slug: 'scholar', name: 'Scholar' };
    wizard.data.class = { uuid: 'class-wizard', slug: 'wizard', name: 'Wizard' };
    wizard.data.boosts = {
      ancestry: ['int'],
      background: ['dex', 'int'],
      class: ['int'],
      free: ['int', 'con', 'wis', 'cha'],
    };
    wizard._documentCache.set('ancestry-elf', {
      system: {
        boosts: {
          0: { value: ['dex'] },
          1: { value: ['int', 'wis', 'str', 'dex', 'con', 'cha'] },
        },
        flaws: {
          0: { value: ['con'] },
        },
      },
    });
    wizard._documentCache.set('background-scholar', {
      system: {
        boosts: {
          0: { value: ['int', 'wis'] },
          1: { value: ['int', 'wis', 'str', 'dex', 'con', 'cha'] },
        },
      },
    });

    const buildState = await wizard._buildCreationFeatBuildState();
    const dedicationFeat = {
      uuid: 'Compendium.test.feats.Item.wizard-dedication',
      slug: 'wizard-dedication',
      name: 'Wizard Dedication',
      img: 'wizard-dedication.png',
      system: {
        level: { value: 1 },
        maxTakable: 1,
        traits: { value: ['archetype', 'dedication', 'wizard'], rarity: 'common' },
        prerequisites: { value: [{ value: 'Intelligence +2' }] },
      },
    };
    const picker = new FeatPicker(createMockActor(), 'custom', 1, buildState, jest.fn(), {
      preset: {
        allowedFeatUuids: [dedicationFeat.uuid],
        maxLevel: 1,
        lockMaxLevel: true,
      },
    });
    picker.allFeats = [dedicationFeat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toEqual([
      expect.objectContaining({ text: 'Intelligence +2', met: true }),
    ]);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  it('includes bard muse subclass identity and alias feats in creation feat build state', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-bard',
      slug: 'bard',
      name: 'Bard',
    };
    wizard.data.subclass = {
      uuid: 'subclass-maestro',
      slug: 'maestro',
      name: 'Maestro',
      traits: ['bard', 'muse'],
    };

    const buildState = await wizard._buildCreationFeatBuildState();

    expect(buildState.class).toEqual(expect.objectContaining({
      slug: 'bard',
      subclassType: 'muse',
    }));
    expect(buildState.feats.has('maestro')).toBe(true);
    expect(buildState.feats.has('maestro-muse')).toBe(true);
    expect(buildState.featAliasSources.get('maestro-muse')?.has('maestro')).toBe(true);
  });

  it('uses bard muse creation build state to satisfy French muse prerequisites', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'featSortMethod') return 'name';
      if (scope === 'pf2e-leveler' && key === 'defaultEligibleOnly') return false;
      if (scope === 'pf2e-leveler' && key === 'hideUncommonFeats') return false;
      if (scope === 'pf2e-leveler' && key === 'hideRareFeats') return false;
      if (scope === 'pf2e-leveler' && key === 'enforcePrerequisites') return true;
      if (scope === 'pf2e-leveler' && key === 'showPrerequisites') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-bard',
      slug: 'bard',
      name: 'Bard',
    };
    wizard.data.subclass = {
      uuid: 'subclass-maestro',
      slug: 'maestro',
      name: 'Maestro',
      traits: ['bard', 'muse'],
    };

    const buildState = await wizard._buildCreationFeatBuildState();
    const feat = {
      uuid: 'Compendium.test.feats.Item.bard-feat',
      slug: 'bard-feat',
      name: 'En cadence',
      img: 'bard-feat.png',
      system: {
        level: { value: 4 },
        maxTakable: 1,
        traits: { value: ['bard'], rarity: 'common' },
        prerequisites: { value: [{ value: 'Muse Maestro' }, { value: 'Muse de barde' }] },
      },
    };
    const picker = new FeatPicker(createMockActor(), 'class', 4, buildState, jest.fn(), {
      preset: {
        allowedFeatUuids: [feat.uuid],
        maxLevel: 4,
        lockMaxLevel: true,
      },
    });
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Muse Maestro (via Maestro)', met: true }),
      expect.objectContaining({ text: 'Muse de barde', met: true }),
    ]));
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  it('shows a dedicated mixed ancestry step when Mixed Ancestry heritage is selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.heritage = {
      uuid: MIXED_ANCESTRY_UUID,
      slug: 'mixed-ancestry',
      name: 'Mixed Ancestry',
    };
    wizard.data.mixedAncestry = { uuid: 'ancestry-elf', slug: 'elf', name: 'Elf' };
    wizard._loadAncestries = jest.fn(async () => [
      {
        uuid: 'ancestry-human',
        slug: 'human',
        name: 'Human',
        type: 'ancestry',
        rarity: 'common',
        traits: ['human'],
      },
      {
        uuid: 'ancestry-elf',
        slug: 'elf',
        name: 'Elf',
        type: 'ancestry',
        rarity: 'common',
        traits: ['elf'],
      },
      {
        uuid: 'ancestry-kitsune',
        slug: 'kitsune',
        name: 'Kitsune',
        type: 'ancestry',
        rarity: 'uncommon',
        traits: ['kitsune'],
      },
    ]);

    expect(wizard.visibleSteps).toContain('mixedAncestry');
    expect(wizard._isStepComplete('mixedAncestry')).toBe(true);

    wizard.currentStep = wizard.visibleSteps.indexOf('mixedAncestry');
    const context = await wizard._getStepContext();
    expect(context.items.map((entry) => entry.slug)).toEqual(['kitsune']);
    expect(context.items[0].name).toBe('Kitsune');
  });

  it('buildBrowserStepContext safely sorts browser items even when a synthetic entry has no name', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 2;
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.heritage = {
      uuid: MIXED_ANCESTRY_UUID,
      slug: 'mixed-ancestry',
      name: 'Mixed Ancestry',
    };
    wizard._loadAncestries = jest.fn(async () => [
      {
        uuid: 'ancestry-elf',
        slug: 'elf',
        name: 'Elf',
        type: 'ancestry',
        rarity: 'common',
        traits: ['elf'],
      },
      { uuid: 'ancestry-bad', slug: 'bad', type: 'ancestry', rarity: 'common', traits: [] },
    ]);

    await expect(wizard._prepareContext()).resolves.toEqual(
      expect.objectContaining({
        browserStep: expect.objectContaining({
          items: expect.any(Array),
        }),
      }),
    );
  });

  it('keeps the feat step incomplete when a level 1 class feat is required but not selected yet', () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-elf',
      slug: 'elf',
      name: 'Elf',
    };
    wizard.data.class = {
      uuid: 'class-fighter',
      slug: 'fighter',
      name: 'Fighter',
    };
    wizard.data.ancestryFeat = {
      uuid: 'feat-elven-lore',
      name: 'Elven Lore',
      choiceSets: [],
      choices: {},
    };
    wizard._cachedHasClassFeatAtLevel1 = true;

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.classFeat = {
      uuid: 'feat-reactive-shield',
      name: 'Reactive Shield',
      choiceSets: [],
      choices: {},
    };
    expect(wizard._isStepComplete('feats')).toBe(true);
  });

  it('keeps the feat step incomplete when a dual class level 1 class feat is required but not selected yet', () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-elf',
      slug: 'elf',
      name: 'Elf',
    };
    wizard.data.class = {
      uuid: 'class-fighter',
      slug: 'fighter',
      name: 'Fighter',
    };
    wizard.data.dualClass = {
      uuid: 'class-wizard',
      slug: 'wizard',
      name: 'Wizard',
    };
    wizard.data.ancestryFeat = {
      uuid: 'feat-elven-lore',
      name: 'Elven Lore',
      choiceSets: [],
      choices: {},
    };
    wizard._cachedHasClassFeatAtLevel1 = true;
    wizard._cachedHasDualClassFeatAtLevel1 = true;

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.classFeat = {
      uuid: 'feat-reactive-shield',
      name: 'Reactive Shield',
      choiceSets: [],
      choices: {},
    };
    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.dualClassFeat = {
      uuid: 'feat-reach-spell',
      name: 'Reach Spell',
      choiceSets: [],
      choices: {},
    };
    expect(wizard._isStepComplete('feats')).toBe(true);
  });

  it('shows a dual class level 1 feat slot when the secondary class has one', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-fighter',
      slug: 'fighter',
      name: 'Fighter',
    };
    wizard.data.dualClass = {
      uuid: 'class-wizard',
      slug: 'wizard',
      name: 'Wizard',
    };
    wizard._cachedHasClassFeatAtLevel1 = false;
    wizard._cachedHasDualClassFeatAtLevel1 = true;

    const context = await wizard._buildFeatContext();

    expect(context.hasClassFeat).toBe(false);
    expect(context.hasDualClassFeat).toBe(true);
    expect(context.dualClassFeatLabel).toBe('Wizard Class Feat');
  });

  it('shows feat choice sections for dual class feats', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.dualClass = {
      uuid: 'class-wizard',
      slug: 'wizard',
      name: 'Wizard',
    };
    wizard.data.dualClassFeat = {
      uuid: 'feat-reach-spell',
      name: 'Reach Spell',
      choiceSets: [
        {
          flag: 'spellshape',
          prompt: 'Choose spellshape rider.',
          options: [{ value: 'wide', label: 'Wide' }],
        },
      ],
      choices: {},
    };

    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: 'dualClass',
        featName: 'Reach Spell',
      }),
    ]));
  });

  it('does not mark feat choices complete while dual class feat choice is unresolved', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.dualClassFeat = {
      uuid: 'feat-reach-spell',
      name: 'Reach Spell',
      choiceSets: [
        {
          flag: 'spellshape',
          prompt: 'Choose spellshape rider.',
          options: [{ value: 'wide', label: 'Wide' }],
        },
      ],
      choices: {},
    };

    expect(wizard._isStepComplete('featChoices')).toBe(false);

    wizard.data.dualClassFeat.choices = { spellshape: 'wide' };
    expect(wizard._isStepComplete('featChoices')).toBe(true);
  });

  it('can allow applying incomplete character creation when the GM setting is enabled', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = wizard.visibleSteps.indexOf('summary');
    jest.spyOn(wizard, 'visibleSteps', 'get').mockReturnValue(['ancestry', 'summary']);
    jest.spyOn(wizard, '_isStepComplete').mockImplementation((stepId) => stepId === 'summary');
    wizard._ensureClassMetadata = jest.fn(async () => {});
    wizard._getRequiredClassBoostSelections = jest.fn(async () => 0);
    wizard._computeBoostStepComplete = jest.fn(async () => true);
    wizard._getAdditionalLanguageCount = jest.fn(async () => 0);
    wizard._getAdditionalSkillCount = jest.fn(async () => 0);
    wizard._getStepContext = jest.fn(async () => ({}));

    game.settings.get = jest.fn((moduleId, settingId) => {
      if (moduleId === 'pf2e-leveler' && settingId === 'allowIncompleteCreation') return true;
      return false;
    });

    const context = await wizard._prepareContext();

    expect(context.allComplete).toBe(false);
    expect(context.canApplyCreation).toBe(true);
  });

  it('includes both selected classes in browser context for dual-class class step', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      if (scope === 'pf2e-leveler' && key === 'allowIncompleteCreation') return false;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 4;
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Alchemist',
      img: 'alchemist.png',
      slug: 'alchemist',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      name: 'Barbarian',
      img: 'barbarian.png',
      slug: 'barbarian',
    };
    wizard._ensureClassMetadata = jest.fn(async () => {});
    wizard._ensureDualClassMetadata = jest.fn(async () => {});
    wizard._hasClassFeatAtLevel1 = jest.fn(async () => false);
    wizard._getRequiredClassBoostSelections = jest.fn(async () => 0);
    wizard._computeBoostStepComplete = jest.fn(async () => true);
    wizard._getAdditionalLanguageCount = jest.fn(async () => 0);
    wizard._getAdditionalSkillCount = jest.fn(async () => 0);
    wizard._loadClasses = jest.fn(async () => []);
    jest.spyOn(wizard, 'visibleSteps', 'get').mockReturnValue(['class']);
    jest.spyOn(wizard, '_isStepComplete').mockReturnValue(false);

    const context = await wizard._prepareContext();

    expect(context.browserStep.selectedGroups).toEqual([
      expect.objectContaining({
        key: 'class',
        selected: expect.objectContaining({ slug: 'alchemist' }),
        clearAction: 'clearClass',
        target: 'class',
      }),
      expect.objectContaining({
        key: 'dualClass',
        selected: expect.objectContaining({ slug: 'barbarian' }),
        clearAction: 'clearClass',
        target: 'dualClass',
      }),
    ]);
  });

  it('includes selected class uuid in browser context for single-class class step', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return false;
      if (scope === 'pf2e-leveler' && key === 'allowIncompleteCreation') return false;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 4;
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Alchemist',
      img: 'alchemist.png',
      slug: 'alchemist',
    };
    wizard._ensureClassMetadata = jest.fn(async () => {});
    wizard._ensureDualClassMetadata = jest.fn(async () => {});
    wizard._hasClassFeatAtLevel1 = jest.fn(async () => false);
    wizard._getRequiredClassBoostSelections = jest.fn(async () => 0);
    wizard._computeBoostStepComplete = jest.fn(async () => true);
    wizard._getAdditionalLanguageCount = jest.fn(async () => 0);
    wizard._getAdditionalSkillCount = jest.fn(async () => 0);
    wizard._loadClasses = jest.fn(async () => []);
    jest.spyOn(wizard, 'visibleSteps', 'get').mockReturnValue(['class']);
    jest.spyOn(wizard, '_isStepComplete').mockReturnValue(false);

    const context = await wizard._prepareContext();

    expect(context.browserStep.selected).toEqual(expect.objectContaining({
      uuid: 'class-1',
      slug: 'alchemist',
      name: 'Alchemist',
    }));
  });

  it('binds grouped clearClass buttons independently so dual class can be cleared', async () => {
    document.body.innerHTML = `
      <button type="button" data-action="clearClass" data-target="class"></button>
      <button type="button" data-action="clearClass" data-target="dualClass"></button>
    `;

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Witch',
      slug: 'witch',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      name: 'Wizard',
      slug: 'wizard',
    };
    wizard._refreshGrantedFeatChoiceSections = jest.fn(async () => {});
    wizard._saveAndRender = jest.fn(async () => {});

    activateCharacterWizardListeners(wizard, document.body);
    document.querySelector('[data-action="clearClass"][data-target="dualClass"]').click();
    await flushAsyncListeners();

    expect(wizard.data.class).toEqual(expect.objectContaining({ slug: 'witch' }));
    expect(wizard.data.dualClass).toBeNull();
    expect(wizard._refreshGrantedFeatChoiceSections).toHaveBeenCalled();
    expect(wizard._saveAndRender).toHaveBeenCalled();
  });

  it('includes separate selected subclass cards in browser context for dual-class subclass step', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      if (scope === 'pf2e-leveler' && key === 'allowIncompleteCreation') return false;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard._isBooting = false;
    wizard.currentStep = 8;
    wizard.data.class = {
      uuid: 'class-1',
      name: 'Animist',
      img: 'animist.png',
      slug: 'animist',
      subclassTag: 'animistic-practice',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      name: 'Bard',
      img: 'bard.png',
      slug: 'bard',
      subclassTag: 'bard-muse',
    };
    wizard.data.subclass = {
      uuid: 'sub-1',
      name: 'Liturgist',
      img: 'liturgist.png',
      slug: 'liturgist',
      choiceSets: [],
      choices: {},
    };
    wizard.data.dualSubclass = {
      uuid: 'sub-2',
      name: 'Maestro',
      img: 'maestro.png',
      slug: 'maestro',
      choiceSets: [],
      choices: {},
    };
    wizard._ensureClassMetadata = jest.fn(async () => {});
    wizard._ensureDualClassMetadata = jest.fn(async () => {});
    wizard._hasClassFeatAtLevel1 = jest.fn(async () => false);
    wizard._getRequiredClassBoostSelections = jest.fn(async () => 0);
    wizard._computeBoostStepComplete = jest.fn(async () => true);
    wizard._getAdditionalLanguageCount = jest.fn(async () => 0);
    wizard._getAdditionalSkillCount = jest.fn(async () => 0);
    wizard._loadSubclassesForClass = jest.fn(async () => []);
    jest.spyOn(wizard, 'visibleSteps', 'get').mockReturnValue(['subclass']);
    jest.spyOn(wizard, '_isStepComplete').mockReturnValue(true);

    const context = await wizard._prepareContext();

    expect(context.browserStep.selectedGroups).toEqual([
      expect.objectContaining({
        key: 'class',
        label: 'Animist',
        selected: expect.objectContaining({ slug: 'liturgist' }),
        clearAction: 'clearSubclass',
        target: 'class',
      }),
      expect.objectContaining({
        key: 'dualClass',
        label: 'Bard',
        selected: expect.objectContaining({ slug: 'maestro' }),
        clearAction: 'clearSubclass',
        target: 'dualClass',
      }),
    ]);
  });

  it('includes handler-managed extra steps from both classes in dual-class creation', () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-wizard',
      slug: 'wizard',
      name: 'Wizard',
    };
    wizard.data.dualClass = {
      uuid: 'class-psychic',
      slug: 'psychic',
      name: 'Psychic',
    };
    wizard.classHandler = getClassHandler('wizard');

    expect(wizard.visibleSteps).toEqual(expect.arrayContaining(['thesis', 'subconsciousMind']));
  });

  it('keeps subclass step visible after subclass selections are made', () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-1',
      slug: 'animist',
      name: 'Animist',
      subclassTag: 'animistic-practice',
    };
    wizard.data.dualClass = {
      uuid: 'class-2',
      slug: 'bard',
      name: 'Bard',
      subclassTag: 'bard-muse',
    };
    wizard.data.subclass = {
      uuid: 'sub-1',
      slug: 'liturgist',
      name: 'Liturgist',
      choiceSets: [],
      choices: {},
    };
    wizard.data.dualSubclass = {
      uuid: 'sub-2',
      slug: 'maestro',
      name: 'Maestro',
      choiceSets: [],
      choices: {},
    };

    expect(wizard.visibleSteps).toContain('subclass');
    expect(wizard._isStepComplete('subclass')).toBe(true);
  });

  it('routes handler-managed step context to the dual-class handler that owns the step', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-wizard',
      slug: 'wizard',
      name: 'Wizard',
    };
    wizard.data.dualClass = {
      uuid: 'class-psychic',
      slug: 'psychic',
      name: 'Psychic',
    };
    wizard.classHandler = getClassHandler('wizard');
    wizard.currentStep = 14;
    wizard._loadPsychicSubconsciousMinds = jest.fn(async () => ([
      { uuid: 'sub-mind', name: 'Gathered Lore', slug: 'gathered-lore', type: 'feat' },
    ]));

    const context = await wizard._getStepContext();

    expect(context.items).toEqual([
      expect.objectContaining({ slug: 'gathered-lore' }),
    ]);
  });

  it('keeps subclass metadata on grouped subclass browser items', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-witch',
      slug: 'witch',
      name: 'Witch',
      subclassTag: 'witch-patron',
    };
    wizard._isBooting = false;
    wizard.currentStep = 8;
    wizard._ensureClassMetadata = jest.fn(async () => {});
    wizard._hasClassFeatAtLevel1 = jest.fn(async () => false);
    wizard._getRequiredClassBoostSelections = jest.fn(async () => 0);
    wizard._computeBoostStepComplete = jest.fn(async () => true);
    wizard._getAdditionalLanguageCount = jest.fn(async () => 0);
    wizard._getAdditionalSkillCount = jest.fn(async () => 0);
    wizard._loadSubclassesForClass = jest.fn(async () => ([
      {
        uuid: 'patron-baba-yaga',
        slug: 'baba-yaga',
        name: 'Baba Yaga',
        grantedSkills: ['occultism'],
        grantedLores: [],
        choiceSets: [],
        spellUuids: [],
        curriculum: null,
        tradition: 'occult',
      },
    ]));

    const context = await wizard._prepareContext();

    expect(context.browserStep.groups).toEqual([
      expect.objectContaining({
        items: [
          expect.objectContaining({
            slug: 'baba-yaga',
            grantedSkills: ['occultism'],
            targetKey: 'class',
          }),
        ],
      }),
    ]);
  });

  it('loads dual-class animist apparitions from the dual-class handler context', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'class-fighter',
      slug: 'fighter',
      name: 'Fighter',
    };
    wizard.data.dualClass = {
      uuid: 'class-animist',
      slug: 'animist',
      name: 'Animist',
    };
    wizard.classHandler = getClassHandler('fighter');
    wizard.currentStep = 16;
    wizard._loadCompendiumCategory = jest.fn(async () => ([
      {
        uuid: 'apparition-echo',
        name: 'Steward of Stone and Fire',
        img: 'apparition.png',
        otherTags: ['animist-apparition'],
        description: '<p>Trained in Architecture Lore.</p>',
        rarity: 'common',
      },
    ]));

    const context = await wizard._getStepContext();

    expect(context.apparitions).toEqual([
      expect.objectContaining({ uuid: 'apparition-echo', name: 'Steward of Stone and Fire' }),
    ]);
  });

  it('keeps the feat step incomplete for rogues until a level 1 skill feat is selected', () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-elf',
      slug: 'elf',
      name: 'Elf',
    };
    wizard.data.class = {
      uuid: 'class-rogue',
      slug: 'rogue',
      name: 'Rogue',
    };
    wizard.data.ancestryFeat = {
      uuid: 'feat-elven-lore',
      name: 'Elven Lore',
      choiceSets: [],
      choices: {},
    };

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.skillFeat = {
      uuid: 'feat-steady-balance',
      name: 'Steady Balance',
      choiceSets: [],
      choices: {},
    };
    expect(wizard._isStepComplete('feats')).toBe(true);
  });

  it('reports hasSkillFeat true in the rogue feat context', async () => {
    game.settings.get = jest.fn(() => false);
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-elf', slug: 'elf', name: 'Elf' };
    wizard.data.class = { uuid: 'class-rogue', slug: 'rogue', name: 'Rogue' };

    const context = await wizard._buildFeatContext();

    expect(context.hasSkillFeat).toBe(true);
    expect(context.hasClassFeat).toBe(false);
    expect(context.ancestralParagonEnabled).toBe(false);
  });

  it('ignores stored dual-class subclass, feat-choice, and spell state when support is disabled', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'enableDualClassSupport') return false;
      return false;
    });

    getCreationData.mockReturnValue({
      version: 1,
      ancestry: null,
      heritage: null,
      mixedAncestry: null,
      background: null,
      class: { uuid: 'class-witch', slug: 'witch', name: 'Witch' },
      subclass: { uuid: 'subclass-silence', slug: 'silence-in-snow', name: 'Silence in Snow', choiceSets: [], choices: {} },
      dualClass: { uuid: 'class-wizard', slug: 'wizard', name: 'Wizard' },
      dualSubclass: { uuid: 'subclass-runelord', slug: 'runelord', name: 'Runelord', choiceSets: [], choices: {} },
      classSelections: {
        class: {
          implement: null,
          tactics: [],
          ikons: [],
          innovationItem: null,
          innovationModification: null,
          kineticGateMode: null,
          secondElement: null,
          kineticImpulses: [],
          subconsciousMind: null,
          thesis: null,
          apparitions: [],
          primaryApparition: null,
          deity: null,
          sanctification: null,
          divineFont: null,
          devotionSpell: null,
        },
        dualClass: {
          implement: null,
          tactics: [],
          ikons: [],
          innovationItem: null,
          innovationModification: null,
          kineticGateMode: null,
          secondElement: null,
          kineticImpulses: [],
          subconsciousMind: null,
          thesis: { uuid: 'thesis-spell-blending', slug: 'spell-blending', name: 'Spell Blending' },
          apparitions: [],
          primaryApparition: null,
          deity: null,
          sanctification: null,
          divineFont: null,
          devotionSpell: null,
        },
      },
      implement: null,
      tactics: [],
      ikons: [],
      innovationItem: null,
      innovationModification: null,
      kineticGateMode: null,
      secondElement: null,
      kineticImpulses: [],
      subconsciousMind: null,
      thesis: null,
      apparitions: [],
      primaryApparition: null,
      deity: null,
      sanctification: null,
      divineFont: null,
      devotionSpell: null,
      alternateAncestryBoosts: false,
      boosts: { free: [] },
      languages: [],
      lores: [],
      selectedLoreSkills: [],
      skills: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: {
        uuid: 'dual-feat',
        name: 'School of Thassilonian Rune Magic',
        choiceSets: [{ flag: 'sin', prompt: 'Choose a sin', options: [] }],
        choices: {},
        grantedSkills: [],
        grantedLores: [],
      },
      skillFeat: null,
      grantedFeatSections: [
        {
          slot: 'dual-grant',
          featName: 'School of Thassilonian Rune Magic',
          sourceName: 'Runelord -> School of Thassilonian Rune Magic',
          choiceSets: [{ flag: 'sin', prompt: 'Choose a sin', options: [] }],
        },
      ],
      grantedFeatChoices: {
        'dual-grant': {},
      },
      spells: {
        cantrips: [{ uuid: 'primary-cantrip', name: 'Detect Magic' }],
        rank1: [{ uuid: 'primary-rank1', name: 'Gust of Wind' }],
      },
      dualSpells: {
        cantrips: [{ uuid: 'dual-cantrip', name: 'Ancient Dust' }],
        rank1: [{ uuid: 'dual-rank1', name: 'Admonishing Ray' }],
      },
      curriculumSpells: { cantrips: [], rank1: [] },
      dualCurriculumSpells: {
        cantrips: [{ uuid: 'dual-curriculum-cantrip', name: 'Shield' }],
        rank1: [{ uuid: 'dual-curriculum-rank1', name: 'Schadenfreude' }],
      },
      equipment: [],
    });

    ClassRegistry.register({
      slug: 'witch',
      spellcasting: {
        tradition: 'primal',
        type: 'prepared',
        slots: {
          1: { cantrips: 5, 1: 2 },
        },
      },
    });
    ClassRegistry.register({
      slug: 'wizard',
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
        slots: {
          1: { cantrips: 5, 1: 2 },
        },
      },
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendiumCategory = jest.fn(async () => []);

    expect(wizard.data.dualClass).toBeNull();
    expect(wizard.data.dualSubclass).toBeNull();
    expect(wizard.data.dualClassFeat).toBeNull();
    expect(wizard.data.dualSpells).toEqual({ cantrips: [], rank1: [] });
    expect(wizard.data.dualCurriculumSpells).toEqual({ cantrips: [], rank1: [] });
    expect(wizard.data.grantedFeatSections).toEqual([]);
    expect(wizard.data.grantedFeatChoices).toEqual({});

    wizard.currentStep = 8;
    const subclassContext = await wizard._getStepContext();
    expect(subclassContext.subclassGroups).toHaveLength(1);
    expect(subclassContext.subclassGroups[0]).toEqual(
      expect.objectContaining({
        key: 'class',
        className: 'Witch',
        selected: expect.objectContaining({ name: 'Silence in Snow' }),
      }),
    );
    expect(subclassContext.selected?.name).toBe('Silence in Snow');

    const featChoicesContext = await buildFeatChoicesContext(wizard);
    expect(featChoicesContext.featChoiceSections).toEqual([]);

    const spellContext = await wizard._buildSpellContext();
    expect(spellContext.spellSections).toHaveLength(1);
    expect(spellContext.secondarySpellSection).toBeNull();
  });

  it('builds multi-select compendium source options from raw step data when no step category mapping exists', () => {
    const options = buildCompendiumSourceOptions('summary', {
      items: [
        { uuid: 'a', sourcePack: 'module.alpha', sourceLabel: 'Alpha Pack' },
        { uuid: 'b', sourcePack: 'module.beta', sourceLabel: 'Beta Pack' },
      ],
    });

    expect(options).toEqual([
      { key: 'module.alpha', label: 'Alpha Pack', selected: true },
      { key: 'module.beta', label: 'Beta Pack', selected: true },
    ]);
  });

  it('includes synthetic step sources alongside configured compendium sources', () => {
    game.packs.get = jest.fn((key) => ({
      metadata: {
        packageName: key === 'pf2e.heritages' ? 'pf2e' : 'battlezoo-dragons-battle-dragons-pf2e',
      },
    }));

    const options = buildCompendiumSourceOptions('heritage', {
      items: [
        {
          uuid: 'pf2e-leveler.synthetic.heritage.mixed-ancestry',
          sourcePackage: 'pf2e-leveler',
          sourcePackageLabel: 'PF2E Leveler',
        },
      ],
    });

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'pf2e', selected: true }),
        expect.objectContaining({ key: 'battlezoo-dragons-battle-dragons-pf2e', selected: true }),
        expect.objectContaining({ key: 'pf2e-leveler', label: 'PF2E Leveler', selected: true }),
      ]),
    );
  });

  it('filters step option arrays by selected compendium sources without touching unrelated data', () => {
    const filtered = filterStepContextByCompendiumSource(
      {
        items: [
          { uuid: 'a', sourcePack: 'module.alpha', sourceLabel: 'Alpha Pack' },
          { uuid: 'b', sourcePack: 'module.beta', sourceLabel: 'Beta Pack' },
        ],
        selectedCantrips: [{ uuid: 'x', name: 'Keep Me' }],
      },
      [
        { key: 'module.alpha', label: 'Alpha Pack', selected: true },
        { key: 'module.beta', label: 'Beta Pack', selected: false },
      ],
    );

    expect(filtered.items).toEqual([
      { uuid: 'a', sourcePack: 'module.alpha', sourceLabel: 'Alpha Pack' },
    ]);
    expect(filtered.selectedCantrips).toEqual([{ uuid: 'x', name: 'Keep Me' }]);
  });

  it('includes class features in the build state used for prerequisite checking', async () => {
    ClassRegistry.register(SWASHBUCKLER);

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      slug: 'swashbuckler',
      name: 'Swashbuckler',
      uuid: 'Compendium.pf2e.classes.Item.Swashbuckler',
    };
    wizard._getClassTrainedSkills = jest.fn(async () => []);
    wizard._getBackgroundTrainedSkills = jest.fn(async () => []);
    wizard._buildCreationAbilityModifiers = jest.fn(async () => ({}));
    wizard._collectHeritageGrantedTraits = jest.fn(async () => []);
    wizard._collectSenses = jest.fn(async () => []);

    const buildState = await wizard._buildCreationFeatBuildState();

    expect(buildState.classFeatures).toBeInstanceOf(Set);
    expect(buildState.classFeatures.has('precise-strike')).toBe(true);
  });
});
