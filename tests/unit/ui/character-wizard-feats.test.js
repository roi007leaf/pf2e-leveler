import { CharacterWizard, buildCompendiumSourceOptions, filterStepContextByCompendiumSource } from '../../../scripts/ui/character-wizard/index.js';
import { loadBackgrounds, loadHeritages, loadRawHeritages } from '../../../scripts/ui/character-wizard/loaders.js';
import { saveCreationData } from '../../../scripts/creation/creation-store.js';

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
  it('rebuilds missing creation data from an existing actor', async () => {
    const actor = createMockActor({
      ancestry: {
        uuid: 'Compendium.test.ancestries.Item.human',
        name: 'Human',
        slug: 'human',
        img: 'human.png',
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

    global.fromUuid = jest.fn((uuid) => Promise.resolve({
      uuid,
      type: 'feat',
      name: uuid.endsWith('natural-ambition') ? 'Natural Ambition' : 'Reactive Shield',
      slug: uuid.endsWith('natural-ambition') ? 'natural-ambition' : 'reactive-shield',
      img: 'resolved.png',
      system: {
        rules: [],
        description: { value: '' },
      },
    }));

    const wizard = new CharacterWizard(actor);
    await wizard._recoverCreationDataFromActor();

    expect(wizard.data.ancestry).toEqual(expect.objectContaining({ slug: 'human', name: 'Human' }));
    expect(wizard.data.background).toEqual(expect.objectContaining({ slug: 'acolyte', name: 'Acolyte' }));
    expect(wizard.data.class).toEqual(expect.objectContaining({ slug: 'fighter', name: 'Fighter' }));
    expect(wizard.data.ancestryFeat).toEqual(expect.objectContaining({ slug: 'natural-ambition', name: 'Natural Ambition' }));
    expect(wizard.data.classFeat).toEqual(expect.objectContaining({ slug: 'reactive-shield', name: 'Reactive Shield' }));
    expect(saveCreationData).toHaveBeenCalledWith(actor, expect.objectContaining({
      ancestry: expect.objectContaining({ slug: 'human' }),
      class: expect.objectContaining({ slug: 'fighter' }),
      ancestryFeat: expect.objectContaining({ slug: 'natural-ambition' }),
      classFeat: expect.objectContaining({ slug: 'reactive-shield' }),
    }));
  });

  it('requires a second ancestry feat at level 1 when ancestry paragon is enabled', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return true;
      return false;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-human', slug: 'human', name: 'Human' };
    wizard.data.ancestryFeat = { uuid: 'feat-1', name: 'Natural Ambition', choiceSets: [], choices: {} };

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.ancestryParagonFeat = { uuid: 'feat-2', name: 'General Training', choiceSets: [], choices: {} };
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
        name: 'Til Ragnarok\'s End',
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
    wizard.currentStep = 2;
    wizard._loadBackgrounds = jest.fn(async () => [
      {
        uuid: 'background-1',
        name: 'Acolyte',
        type: 'background',
        slug: 'acolyte',
      },
      {
        uuid: 'feat-1',
        name: 'Til Ragnarok\'s End',
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

  it('loads background browser entries with trained skills and boosts for filtering', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._compendiumCache.backgrounds = [
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
      },
    ];

    const items = await loadBackgrounds(wizard);

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'background-1',
        trainedSkills: ['athletics'],
        boosts: ['str', 'con'],
      }),
    ]);
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
        name: 'Til Ragnarok\'s End',
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

    expect(items.map((item) => item.uuid)).toEqual(['heritage-gnoll']);
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

    expect(items.map((item) => item.uuid)).toEqual(['heritage-dragon']);
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

  it('class step only shows actual class documents from mixed assigned packs', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 3;
    wizard._loadClasses = jest.fn(async () => [
      {
        uuid: 'class-1',
        name: 'Fighter',
        type: 'class',
        slug: 'fighter',
      },
      {
        uuid: 'feat-1',
        name: 'Til Ragnarok\'s End',
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
    wizard.data.ancestryFeat = { uuid: 'feat-elven-lore', name: 'Elven Lore', choiceSets: [], choices: {} };
    wizard._cachedHasClassFeatAtLevel1 = true;

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.classFeat = { uuid: 'feat-reactive-shield', name: 'Reactive Shield', choiceSets: [], choices: {} };
    expect(wizard._isStepComplete('feats')).toBe(true);
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
    wizard.data.ancestryFeat = { uuid: 'feat-elven-lore', name: 'Elven Lore', choiceSets: [], choices: {} };

    expect(wizard._isStepComplete('feats')).toBe(false);

    wizard.data.skillFeat = { uuid: 'feat-steady-balance', name: 'Steady Balance', choiceSets: [], choices: {} };
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

  it('filters step option arrays by selected compendium sources without touching unrelated data', () => {
    const filtered = filterStepContextByCompendiumSource(
      {
        items: [
          { uuid: 'a', sourcePack: 'module.alpha', sourceLabel: 'Alpha Pack' },
          { uuid: 'b', sourcePack: 'module.beta', sourceLabel: 'Beta Pack' },
        ],
        selectedCantrips: [
          { uuid: 'x', name: 'Keep Me' },
        ],
      },
      [
        { key: 'module.alpha', label: 'Alpha Pack', selected: true },
        { key: 'module.beta', label: 'Beta Pack', selected: false },
      ],
    );

    expect(filtered.items).toEqual([
      { uuid: 'a', sourcePack: 'module.alpha', sourceLabel: 'Alpha Pack' },
    ]);
    expect(filtered.selectedCantrips).toEqual([
      { uuid: 'x', name: 'Keep Me' },
    ]);
  });
});
