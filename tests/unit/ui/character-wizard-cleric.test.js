import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { ClericHandler } from '../../../scripts/creation/class-handlers/cleric.js';

describe('CharacterWizard cleric extra steps', () => {
  it('returns divine font options for the divineFont step', async () => {
    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    actor.unsetFlag = jest.fn(() => Promise.resolve());
    const wizard = new CharacterWizard(actor);

    wizard.classHandler = new ClericHandler();
    wizard.data.class = { slug: 'cleric' };
    wizard.data.deity = {
      name: 'Sarenrae',
      font: ['healing', 'harmful'],
      sanctification: {},
    };
    wizard.currentStep = 7;

    const context = await wizard._getStepContext();

    expect(context.stepTitle).toBe('Divine Font');
    expect(context.divineFontOptions).toEqual([
      expect.objectContaining({ value: 'healing', label: 'Healing', selected: false }),
      expect.objectContaining({ value: 'harmful', label: 'Harmful', selected: false }),
    ]);
  });

  it('refreshes deity-granted feat choice sections after selecting a deity', async () => {
    const actor = createMockActor();
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(() => Promise.resolve());
    actor.unsetFlag = jest.fn(() => Promise.resolve());
    const wizard = new CharacterWizard(actor);

    wizard.classHandler = new ClericHandler();
    wizard.currentStep = 5;
    wizard._saveAndRender = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.deities.Item.nethys') {
        return {
          uuid,
          name: 'Nethys',
          img: 'nethys.png',
          system: {
            font: ['healing', 'harmful'],
            sanctification: {},
            domains: {
              primary: ['creation', 'dragon', 'fate', 'time'],
              alternate: ['fate'],
            },
            rules: [
              {
                key: 'GrantItem',
                uuid: 'Compendium.pf2e.feats-srd.Item.domain-initiate',
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.domain-initiate') {
        return {
          uuid,
          name: 'Domain Initiate',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'domainInitiate',
                prompt: 'PF2E.SpecificRule.Prompt.DeitysDomain',
                choices: 'system.details.deities.domains',
              },
            ],
          },
        };
      }
      return null;
    });

    await wizard._selectItem('Compendium.pf2e.deities.Item.nethys');

    expect(wizard.data.grantedFeatSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        featName: 'Domain Initiate',
      }),
    ]));
    expect(wizard.data.grantedFeatSections[0].choiceSets[0].options).toEqual([
      { value: 'creation', label: 'Creation' },
      { value: 'dragon', label: 'Dragon' },
      { value: 'fate', label: 'Fate' },
      { value: 'time', label: 'Time' },
      { value: 'fate', label: 'Fate (apocryphal)' },
    ]);
  });
});
