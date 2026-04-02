import { CharacterWizard } from '../../../scripts/ui/character-wizard.js';

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
  ClassRegistry: { get: jest.fn() },
}));

function createWizard(dataOverrides = {}) {
  const actor = createMockActor();
  const wizard = new CharacterWizard(actor);
  Object.assign(wizard.data, dataOverrides);
  return wizard;
}

describe('_getPendingChoices', () => {
  it('handles non-string filter entries without throwing', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.elf', name: 'Sorcerer', slug: 'sorcerer' },
      subclass: { uuid: 'Compendium.pf2e.classfeatures.Item.bloodline', name: 'Diabolic', slug: 'diabolic' },
      ancestry: { uuid: 'Compendium.pf2e.ancestries.Item.elf', name: 'Elf' },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.ancestries.Item.elf') {
        return Promise.resolve({
          uuid,
          name: 'Elf',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                prompt: 'PF2E.SpecificRule.Prompt',
                choices: {
                  filter: [
                    { or: ['item:tag:elf-atavism', 'item:tag:elf-ethnicity'] },
                    'item:trait:elf',
                  ],
                },
              },
            ],
            items: {},
          },
        });
      }
      return Promise.resolve({
        uuid,
        name: 'Mock Item',
        system: { rules: [], items: {} },
      });
    });

    const choices = await wizard._getPendingChoices();
    expect(Array.isArray(choices)).toBe(true);
  });

  it('skips ChoiceSet when string filter matches subclass tag', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.sorcerer', name: 'Sorcerer', slug: 'sorcerer' },
      subclass: { uuid: 'Compendium.pf2e.classfeatures.Item.bloodline', name: 'Diabolic', slug: 'diabolic' },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.sorcerer') {
        return Promise.resolve({
          uuid,
          name: 'Sorcerer',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                prompt: 'PF2E.ChooseBloodline',
                choices: {
                  filter: ['item:tag:sorcerer-bloodline'],
                },
              },
            ],
            items: {},
          },
        });
      }
      return Promise.resolve({
        uuid,
        name: 'Mock',
        system: { rules: [], items: {} },
      });
    });

    const choices = await wizard._getPendingChoices();
    const bloodlineChoice = choices.find((c) => c.prompt.includes('Bloodline'));
    expect(bloodlineChoice).toBeUndefined();
  });
});
