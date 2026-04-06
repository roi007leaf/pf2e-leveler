import { CharacterWizard, buildCompendiumSourceOptions, filterStepContextByCompendiumSource } from '../../../scripts/ui/character-wizard/index.js';

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

  it('shows gnoll-tagged ancestry feats for kholo ancestry', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-kholo',
      slug: 'kholo',
      name: 'Kholo',
    };

    wizard._loadCompendiumCategory = jest.fn(async () => [
      {
        uuid: 'feat-1',
        name: 'Crunch',
        level: 1,
        traits: ['gnoll'],
      },
      {
        uuid: 'feat-2',
        name: 'Pack Stalker',
        level: 1,
        traits: ['kholo'],
      },
      {
        uuid: 'feat-3',
        name: 'Other Ancestry Feat',
        level: 1,
        traits: ['elf'],
      },
    ]);

    const context = await wizard._buildFeatContext();

    expect(context.ancestryFeats.map((feat) => feat.name)).toEqual(['Crunch', 'Pack Stalker']);
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
    expect(context.ancestryFeats).toEqual([
      expect.objectContaining({ uuid: 'feat-1', taken: true, paragonTaken: false }),
      expect.objectContaining({ uuid: 'feat-2', taken: false, paragonTaken: true }),
    ]);
  });

  it('includes adopted ancestry feats after the adopted ancestry choice is selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = {
      uuid: 'ancestry-human',
      slug: 'human',
      name: 'Human',
    };
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        choiceSets: [
          {
            flag: 'ancestry',
            prompt: 'Select a common ancestry.',
            options: [
              { value: 'dwarf', label: 'Dwarf', uuid: 'Compendium.pf2e.ancestries.Item.dwarf' },
            ],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.adopted-ancestry': {
        ancestry: 'dwarf',
      },
    };

    wizard._loadCompendiumCategory = jest.fn(async () => [
      {
        uuid: 'feat-human',
        name: 'Natural Ambition',
        level: 1,
        traits: ['human'],
      },
      {
        uuid: 'feat-dwarf',
        name: 'Rock Runner',
        level: 1,
        traits: ['dwarf'],
      },
      {
        uuid: 'feat-elf',
        name: 'Other Ancestry Feat',
        level: 1,
        traits: ['elf'],
      },
    ]);

    const context = await wizard._buildFeatContext();

    expect(context.ancestryFeats.map((feat) => feat.name)).toEqual(['Natural Ambition', 'Rock Runner']);
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
