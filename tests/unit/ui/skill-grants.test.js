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

describe('CharacterWizard skills step grants', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'class-uuid') {
        return {
          system: {
            trainedSkills: {
              additional: 7,
              value: ['stealth'],
            },
          },
        };
      }

      if (uuid === 'background-uuid') {
        return {
          system: {
            trainedSkills: {
              value: ['athletics'],
              lore: ['Legal Lore'],
            },
          },
        };
      }

      return null;
    });
  });

  it('locks subclass-granted skills and includes background, subclass, and apparition lores', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 19;
    wizard.data.class = { slug: 'rogue', uuid: 'class-uuid', name: 'Rogue' };
    wizard.data.background = { uuid: 'background-uuid', name: 'Barrister' };
    wizard.data.subclass = {
      slug: 'mastermind',
      name: 'Mastermind',
      grantedSkills: ['deception'],
      grantedLores: ['Underworld Lore'],
    };
    wizard.data.apparitions = [
      { uuid: 'app-1', name: 'Witness to Ancient Battles', lores: ['Warfare Lore'] },
    ];

    const context = await wizard._getStepContext();

    const classSkill = context.skills.find((entry) => entry.slug === 'stealth');
    const backgroundSkill = context.skills.find((entry) => entry.slug === 'athletics');
    const subclassSkill = context.skills.find((entry) => entry.slug === 'deception');

    expect(classSkill).toEqual(expect.objectContaining({
      autoTrained: true,
      source: 'Class',
    }));
    expect(backgroundSkill).toEqual(expect.objectContaining({
      autoTrained: true,
      source: 'Background',
    }));
    expect(subclassSkill).toEqual(expect.objectContaining({
      autoTrained: true,
      source: 'Mastermind',
    }));

    expect(context.lores).toEqual([
      { name: 'Legal Lore', source: 'Background' },
      { name: 'Underworld Lore', source: 'Mastermind' },
      { name: 'Warfare Lore', source: 'Witness to Ancient Battles' },
    ]);
    expect(wizard.data.lores).toEqual(['Legal Lore', 'Underworld Lore', 'Warfare Lore']);
    expect(context.maxSkills).toBe(7);
  });

  it('parses martial-style subclass lore training text from descriptions', () => {
    const wizard = new CharacterWizard(createMockActor());

    const lores = wizard._parseSubclassLores([], `
      <p>You become trained in Underworld Lore and Warfare Lore.</p>
      <p>You also gain a circumstance bonus in narrow situations.</p>
    `);

    expect(lores).toEqual(['Underworld Lore', 'Warfare Lore']);
  });
});
