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
  it('shows DEX or INT as the class key ability choice for Mastermind', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'rogue', name: 'Rogue' };
    wizard.data.subclass = { slug: 'mastermind', name: 'Mastermind', choices: {} };
    wizard.classHandler = getClassHandler('rogue');

    const context = await wizard._buildBoostContext();
    const classRow = context.boostRows.find((row) => row.source === 'class');

    expect(classRow.isKeyChoice).toBe(true);
    expect(classRow.options).toEqual(['dex', 'int']);
    expect(wizard.data.boosts.class).toEqual([]);
  });

  it('keeps boosts incomplete for rogue until the class key ability choice is selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'rogue', name: 'Rogue' };
    wizard.data.subclass = { slug: 'mastermind', name: 'Mastermind', choices: {} };
    wizard.data.boosts.free = ['str', 'con', 'wis', 'cha'];
    wizard.classHandler = getClassHandler('rogue');

    wizard._cachedRequiredClassBoostSelections = await wizard._getRequiredClassBoostSelections();
    expect(wizard._isStepComplete('boosts')).toBe(false);

    wizard.data.boosts.class = ['int'];
    expect(wizard._isStepComplete('boosts')).toBe(true);
  });
});
