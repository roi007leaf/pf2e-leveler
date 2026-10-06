import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { buildFeatChoicesContext, getSelectedFeatChoiceLabels } from '../../../scripts/ui/character-wizard/choice-sets.js';
import { buildSkillContext } from '../../../scripts/ui/character-wizard/skills-languages.js';
import { activateCharacterWizardListeners } from '../../../scripts/ui/character-wizard/listeners.js';

jest.mock('../../../scripts/creation/creation-store.js', () => ({
  getCreationData: jest.fn(() => null),
  saveCreationData: jest.fn(),
  clearCreationData: jest.fn(),
}));

jest.mock('../../../scripts/creation/apply-creation.js', () => ({ applyCreation: jest.fn() }));

describe('CharacterWizard mythic calling sources', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async () => null);
  });

  function createWizard() {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.mythicCalling = {
      uuid: 'calling',
      name: 'Sage Calling',
      choiceSets: [{ flag: 'skill', prompt: 'Choose a skill', options: [{ value: 'arcana', label: 'Arcana' }] }],
      choices: { skill: 'arcana' },
      grantedSkills: ['nature'],
    };
    return wizard;
  }

  it('renders calling choices and resolves selected labels', async () => {
    const wizard = createWizard();
    const context = await buildFeatChoicesContext(wizard);

    expect(context.featChoiceSections).toEqual([
      expect.objectContaining({ slot: 'mythicCalling', featName: 'Sage Calling' }),
    ]);
    expect(context.featChoiceSections[0].choiceSets[0].hasSelection).toBe(true);
    expect(await getSelectedFeatChoiceLabels(wizard, 'mythicCalling')).toEqual(['Arcana']);
  });

  it('marks calling granted and selected skills trained', async () => {
    const wizard = createWizard();
    const skills = await buildSkillContext(wizard);

    expect(skills.find((skill) => skill.slug === 'nature')).toEqual(expect.objectContaining({
      autoTrained: true,
      source: 'Sage Calling',
    }));
    expect(skills.find((skill) => skill.slug === 'arcana').autoTrained).toBe(true);
  });

  it('clears calling and refreshes dependent granted choices', async () => {
    const wizard = createWizard();
    wizard._refreshGrantedFeatChoiceSections = jest.fn(async () => {});
    wizard._saveAndRender = jest.fn(async () => {});
    const root = document.createElement('div');
    root.innerHTML = '<button data-action="clearMythicCalling"></button>';
    activateCharacterWizardListeners(wizard, root);

    root.querySelector('button').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wizard.data.mythicCalling).toBeNull();
    expect(wizard._refreshGrantedFeatChoiceSections).toHaveBeenCalledTimes(1);
    expect(wizard._saveAndRender).toHaveBeenCalledTimes(1);
  });
});
