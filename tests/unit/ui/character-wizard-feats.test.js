import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';

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

    wizard._loadCompendium = jest.fn(async () => [
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

    wizard._loadCompendium = jest.fn(async () => [
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
});
