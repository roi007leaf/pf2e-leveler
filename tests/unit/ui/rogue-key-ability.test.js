import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { getClassHandler } from '../../../scripts/creation/class-handlers/registry.js';

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
    get: jest.fn((slug) => {
      if (slug === 'rogue') return { keyAbility: ['dex'] };
      return null;
    }),
  },
}));

describe('CharacterWizard rogue key ability boosts', () => {
  it('shows INT as the fixed class key ability for Mastermind', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'rogue', name: 'Rogue' };
    wizard.data.subclass = { slug: 'mastermind', name: 'Mastermind', choices: {} };
    wizard.classHandler = getClassHandler('rogue');

    const context = await wizard._buildBoostContext();
    const classRow = context.boostRows.find((row) => row.source === 'class');

    expect(classRow.keyAbility).toBe('int');
    expect(wizard.data.boosts.class).toEqual(['int']);
  });
});
