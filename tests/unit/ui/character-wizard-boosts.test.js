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

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: {
    get: jest.fn(() => ({ keyAbility: ['str'] })),
  },
}));

describe('CharacterWizard boosts completion', () => {
  it('does not mark boosts complete when only the four free boosts are selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-uuid', name: 'Human' };
    wizard.data.background = { uuid: 'background-uuid', name: 'Scholar' };
    wizard.data.class = { uuid: 'class-uuid', slug: 'fighter', name: 'Fighter' };
    wizard.data.boosts = {
      ancestry: [],
      background: [],
      class: ['str'],
      free: ['dex', 'con', 'wis', 'cha'],
    };

    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid === 'ancestry-uuid') {
        return {
          name: 'Human',
          system: {
            boosts: {
              0: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
              1: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
            },
            flaws: {},
          },
        };
      }

      if (uuid === 'background-uuid') {
        return {
          name: 'Scholar',
          system: {
            boosts: {
              0: { value: ['int'] },
              1: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
            },
          },
        };
      }

      return null;
    });

    await wizard._prepareContext();

    expect(wizard._isStepComplete('boosts')).toBe(false);
  });
});
