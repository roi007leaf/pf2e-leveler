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

  it('includes lore granted by selected ancestry lore feats', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 19;
    wizard.data.class = { slug: 'rogue', uuid: 'class-uuid', name: 'Rogue' };
    wizard.data.background = { uuid: 'background-uuid', name: 'Barrister' };
    wizard.data.ancestryFeat = {
      uuid: 'feat-elven-lore',
      name: 'Elven Lore',
      grantedLores: ['Elf Lore'],
      choiceSets: [],
      choices: {},
    };

    const context = await wizard._getStepContext();

    expect(context.lores).toEqual([
      { name: 'Legal Lore', source: 'Background' },
      { name: 'Elf Lore', source: 'Elven Lore' },
    ]);
    expect(wizard.data.lores).toEqual(['Legal Lore', 'Elf Lore']);
  });

  it('parses martial-style subclass lore training text from descriptions', () => {
    const wizard = new CharacterWizard(createMockActor());

    const lores = wizard._parseSubclassLores([], `
      <p>You become trained in Underworld Lore and Warfare Lore.</p>
      <p>You also gain a circumstance bonus in narrow situations.</p>
    `);

    expect(lores).toEqual(['Underworld Lore', 'Warfare Lore']);
  });

  it('parses the Additional Lore ancestry lore clause into a lore skill', () => {
    const wizard = new CharacterWizard(createMockActor());

    const lores = wizard._parseSubclassLores([], `
      <p>You gain the trained proficiency rank in Arcana and Nature.</p>
      <p>You also gain the Additional Lore general feat for Elf Lore.</p>
    `);

    expect(lores).toEqual(['Elf Lore']);
  });

  it('includes Intelligence boosts when computing bonus skills and languages', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'class-uuid') {
        return {
          system: {
            trainedSkills: {
              additional: 3,
              value: [],
            },
          },
        };
      }

      if (uuid === 'ancestry-uuid') {
        return {
          system: {
            boosts: {
              0: { value: ['int'] },
            },
            additionalLanguages: {
              count: 0,
              value: [],
            },
            languages: {
              value: ['common'],
            },
          },
        };
      }

      return null;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'rogue', uuid: 'class-uuid', name: 'Rogue' };
    wizard.data.ancestry = { uuid: 'ancestry-uuid', name: 'Elf' };

    expect(await wizard._getAdditionalSkillCount()).toBe(4);
    expect(await wizard._getAdditionalLanguageCount()).toBe(1);
  });

  it('adds an extra selectable skill when background and class auto-train the same skill', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'class-uuid') {
        return {
          system: {
            trainedSkills: {
              additional: 3,
              value: ['athletics'],
            },
          },
        };
      }

      if (uuid === 'background-uuid') {
        return {
          system: {
            trainedSkills: {
              value: ['athletics'],
              lore: [],
            },
          },
        };
      }

      return null;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.currentStep = 19;
    wizard.data.class = { slug: 'fighter', uuid: 'class-uuid', name: 'Fighter' };
    wizard.data.background = { uuid: 'background-uuid', name: 'Warrior' };

    expect(await wizard._getAdditionalSkillCount()).toBe(4);

    const context = await wizard._getStepContext();
    expect(context.maxSkills).toBe(4);
    expect(context.skills.find((entry) => entry.slug === 'athletics')).toEqual(expect.objectContaining({
      autoTrained: true,
    }));
  });

  it('marks deity-granted skills as auto-trained', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'class-uuid') {
        return {
          system: {
            trainedSkills: {
              additional: 3,
              value: [],
            },
          },
        };
      }

      return null;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'champion', uuid: 'class-uuid', name: 'Champion' };
    wizard.data.deity = { uuid: 'deity-uuid', name: 'Abadar', skill: 'society' };

    const context = await wizard._buildSkillContext();
    expect(context.find((entry) => entry.slug === 'society')).toEqual(expect.objectContaining({
      autoTrained: true,
      source: 'Abadar',
    }));
  });

  it('marks skills that appear in later skill choice sets', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          religion: 'Religion',
        },
      },
    };
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'class-uuid') {
        return {
          system: {
            trainedSkills: {
              additional: 3,
              value: [],
            },
          },
        };
      }

      return null;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'cleric', uuid: 'class-uuid', name: 'Cleric' };
    wizard.data.grantedFeatSections = [
      {
        slot: '__cleric-domain-initiate__',
        featName: 'Domain Initiate',
        sourceName: 'Cleric -> Domain Initiate',
        choiceSets: [
          {
            flag: 'domainSkill',
            prompt: 'Select a skill.',
            options: [
              { value: 'nature', label: 'Nature' },
              { value: 'religion', label: 'Religion' },
            ],
          },
        ],
      },
    ];

    const context = await wizard._buildSkillContext();

    try {
      expect(context.find((entry) => entry.slug === 'nature')).toEqual(expect.objectContaining({
        futureSkillChoices: [
          expect.objectContaining({ sourceLabel: 'Cleric -> Domain Initiate', prompt: 'Select a skill.' }),
        ],
      }));
      expect(context.find((entry) => entry.slug === 'religion')).toEqual(expect.objectContaining({
        futureSkillChoices: [
          expect.objectContaining({ sourceLabel: 'Cleric -> Domain Initiate', prompt: 'Select a skill.' }),
        ],
      }));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('adds a placeholder lore for patron deity backgrounds', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'background-pilgrim-uuid') {
        return {
          system: {
            trainedSkills: {
              value: ['religion'],
              lore: [],
            },
            description: {
              value: "<p>You're trained in the Religion skill and the Lore skill for your patron deity.</p>",
            },
          },
        };
      }

      return null;
    });

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.background = { uuid: 'background-pilgrim-uuid', name: 'Pilgrim' };
    wizard.data.deity = { uuid: 'deity-uuid', name: 'Abadar', skill: 'society' };

    await expect(wizard._getBackgroundLores()).resolves.toEqual([
      { name: 'Abadar Lore', source: 'Background' },
    ]);
  });
});
