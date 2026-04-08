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

  it('skips arcane thesis pending choice when a thesis is already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.wizard', name: 'Wizard', slug: 'wizard' },
      thesis: { uuid: 'Compendium.pf2e.classfeatures.Item.staff-nexus', name: 'Staff Nexus', slug: 'staff-nexus' },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.wizard') {
        return Promise.resolve({
          uuid,
          name: 'Wizard',
          system: {
            rules: [],
            items: {
              thesis: {
                name: 'Arcane Thesis',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.arcane-thesis',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.arcane-thesis') {
        return Promise.resolve({
          uuid,
          name: 'Arcane Thesis',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'arcaneThesis',
                prompt: 'PF2E.SpecificRule.Wizard.ArcaneThesis.Prompt',
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
    expect(choices.find((c) => c.source.includes('Arcane Thesis'))).toBeUndefined();
  });

  it('skips subconscious mind pending choice when one is already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.psychic', name: 'Psychic', slug: 'psychic' },
      subconsciousMind: {
        uuid: 'Compendium.pf2e.classfeatures.Item.gathered-lore',
        name: 'Gathered Lore',
        slug: 'gathered-lore',
        keyAbility: 'int',
      },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.psychic') {
        return Promise.resolve({
          uuid,
          name: 'Psychic',
          system: {
            rules: [],
            items: {
              subconscious: {
                name: 'Subconscious Mind',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.subconscious-mind',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.subconscious-mind') {
        return Promise.resolve({
          uuid,
          name: 'Subconscious Mind',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'subconsciousMind',
                prompt: 'PF2E.SpecificRule.Prompt.SubconsciousMind',
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
    expect(choices.find((c) => c.source.includes('Subconscious Mind'))).toBeUndefined();
  });

  it('skips divine font pending choice when one is already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.cleric', name: 'Cleric', slug: 'cleric' },
      divineFont: 'healing',
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.cleric') {
        return Promise.resolve({
          uuid,
          name: 'Cleric',
          system: {
            rules: [],
            items: {
              font: {
                name: 'Divine Font',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.divine-font',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.divine-font') {
        return Promise.resolve({
          uuid,
          name: 'Divine Font',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'divineFont',
                prompt: 'PF2E.SpecificRule.Cleric.DivineFont.Prompt',
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
    expect(choices.find((c) => c.source.includes('Divine Font'))).toBeUndefined();
  });

  it('does not auto-fill optional sanctification on deity selection', () => {
    const wizard = createWizard();
    wizard.data.deity = null;
    wizard.data.sanctification = null;

    const deity = {
      uuid: 'deity-uuid',
      name: 'Optional Sanctifier',
      img: 'icons/svg/item-bag.svg',
      font: ['healing'],
      sanctification: {
        modal: 'can',
        what: ['holy'],
      },
    };

    const { setDeity } = jest.requireActual('../../../scripts/creation/creation-model.js');
    setDeity(wizard.data, deity);

    expect(wizard.data.divineFont).toBe('healing');
    expect(wizard.data.sanctification).toBeNull();
  });

  it('skips implement pending choice when one is already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.thaumaturge', name: 'Thaumaturge', slug: 'thaumaturge' },
      implement: {
        uuid: 'Compendium.pf2e.classfeatures.Item.amulet',
        name: 'Amulet',
        slug: 'amulet',
      },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.thaumaturge') {
        return Promise.resolve({
          uuid,
          name: 'Thaumaturge',
          system: {
            rules: [],
            items: {
              implement: {
                name: 'First Implement and Esoterica',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.first-implement',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.first-implement') {
        return Promise.resolve({
          uuid,
          name: 'First Implement and Esoterica',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'implement',
                prompt: 'PF2E.SpecificRule.Prompt.FirstImplement',
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
    expect(choices.find((c) => c.source.includes('First Implement'))).toBeUndefined();
  });

  it('skips commander tactic pending choices when all five are already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.commander', name: 'Commander', slug: 'commander' },
      tactics: [
        { uuid: 'Compendium.pf2e.actionspf2e.Item.t1', name: 'Tactic One' },
        { uuid: 'Compendium.pf2e.actionspf2e.Item.t2', name: 'Tactic Two' },
        { uuid: 'Compendium.pf2e.actionspf2e.Item.t3', name: 'Tactic Three' },
        { uuid: 'Compendium.pf2e.actionspf2e.Item.t4', name: 'Tactic Four' },
        { uuid: 'Compendium.pf2e.actionspf2e.Item.t5', name: 'Tactic Five' },
      ],
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.commander') {
        return Promise.resolve({
          uuid,
          name: 'Commander',
          system: {
            rules: [],
            items: {
              tactics: {
                name: 'Tactics',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.tactics',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.tactics') {
        return Promise.resolve({
          uuid,
          name: 'Tactics',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'firstTactic', prompt: 'PF2E.SpecificRule.Commander.Tactics.Prompt' },
              { key: 'ChoiceSet', flag: 'secondTactic', prompt: 'PF2E.SpecificRule.Commander.Tactics.Prompt' },
              { key: 'ChoiceSet', flag: 'thirdTactic', prompt: 'PF2E.SpecificRule.Commander.Tactics.Prompt' },
              { key: 'ChoiceSet', flag: 'fourthTactic', prompt: 'PF2E.SpecificRule.Commander.Tactics.Prompt' },
              { key: 'ChoiceSet', flag: 'fifthTactic', prompt: 'PF2E.SpecificRule.Commander.Tactics.Prompt' },
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
    expect(choices.find((c) => c.source.includes('Tactics'))).toBeUndefined();
  });

  it('skips exemplar ikon pending choices when all three are already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.exemplar', name: 'Exemplar', slug: 'exemplar' },
      ikons: [
        { uuid: 'Compendium.pf2e.classfeatures.Item.i1', name: 'Ikon One' },
        { uuid: 'Compendium.pf2e.classfeatures.Item.i2', name: 'Ikon Two' },
        { uuid: 'Compendium.pf2e.classfeatures.Item.i3', name: 'Ikon Three' },
      ],
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.exemplar') {
        return Promise.resolve({
          uuid,
          name: 'Exemplar',
          system: {
            rules: [],
            items: {
              ikons: {
                name: 'Divine Spark and Ikons',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.divine-spark-and-ikons',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.divine-spark-and-ikons') {
        return Promise.resolve({
          uuid,
          name: 'Divine Spark and Ikons',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'firstIkon', prompt: 'PF2E.SpecificRule.Exemplar.Ikon.Prompt' },
              { key: 'ChoiceSet', flag: 'secondIkon', prompt: 'PF2E.SpecificRule.Exemplar.Ikon.Prompt' },
              { key: 'ChoiceSet', flag: 'thirdIkon', prompt: 'PF2E.SpecificRule.Exemplar.Ikon.Prompt' },
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
    expect(choices.find((c) => c.source.includes('Divine Spark and Ikons'))).toBeUndefined();
  });

  it('skips inventor innovation detail pending choices when they are already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.inventor', name: 'Inventor', slug: 'inventor' },
      innovationItem: {
        uuid: 'Compendium.pf2e.equipment-srd.Item.longsword',
        name: 'Longsword',
        slug: 'longsword',
      },
      innovationModification: {
        uuid: 'Compendium.pf2e.classfeatures.Item.modular-head',
        name: 'Modular Head',
        slug: 'modular-head',
      },
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.inventor') {
        return Promise.resolve({
          uuid,
          name: 'Inventor',
          system: {
            rules: [],
            items: {
              innovation: {
                name: 'Innovation',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.innovation',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.innovation') {
        return Promise.resolve({
          uuid,
          name: 'Innovation',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'weaponInnovation', prompt: 'PF2E.SpecificRule.Inventor.Innovation.Weapon.Prompt' },
              { key: 'ChoiceSet', flag: 'initialModification', prompt: 'PF2E.SpecificRule.Inventor.Modification.Initial.Prompt' },
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
    expect(choices.find((c) => c.prompt.includes('Innovation.Weapon'))).toBeUndefined();
    expect(choices.find((c) => c.prompt.includes('Modification.Initial'))).toBeUndefined();
  });

  it('skips kinetic gate prompt when gate choices are already selected', async () => {
    const wizard = createWizard({
      class: { uuid: 'Compendium.pf2e.classes.Item.kineticist', name: 'Kineticist', slug: 'kineticist' },
      subclass: { uuid: 'Compendium.pf2e.classfeatures.Item.air-gate', name: 'Air Gate', slug: 'air-gate' },
      kineticGateMode: 'dual-gate',
      secondElement: { uuid: 'Compendium.pf2e.classfeatures.Item.fire-gate', name: 'Fire Gate', slug: 'fire-gate' },
      kineticImpulses: [
        { uuid: 'Compendium.pf2e.feats-srd.Item.i1', name: 'Aerial Boomerang', element: 'air' },
        { uuid: 'Compendium.pf2e.feats-srd.Item.i2', name: 'Flying Flame', element: 'fire' },
      ],
    });

    global.fromUuid = jest.fn((uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.kineticist') {
        return Promise.resolve({
          uuid,
          name: 'Kineticist',
          system: {
            rules: [],
            items: {
              gate: {
                name: 'Kinetic Gate',
                level: 1,
                uuid: 'Compendium.pf2e.classfeatures.Item.kinetic-gate',
              },
            },
          },
        });
      }

      if (uuid === 'Compendium.pf2e.classfeatures.Item.kinetic-gate') {
        return Promise.resolve({
          uuid,
          name: 'Kinetic Gate',
          system: {
            rules: [
              { key: 'ChoiceSet', prompt: 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Gate' },
              { key: 'ChoiceSet', flag: 'elementTwo', prompt: 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Element' },
              { key: 'ChoiceSet', flag: 'impulseOne', prompt: 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Impulse' },
              { key: 'ChoiceSet', flag: 'impulseTwo', prompt: 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Impulse' },
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
    expect(choices.find((c) => c.prompt.includes('KineticGate.Prompt.Gate'))).toBeUndefined();
    expect(choices.find((c) => c.prompt.includes('KineticGate.Prompt.Element'))).toBeUndefined();
    expect(choices.find((c) => c.prompt.includes('KineticGate.Prompt.Impulse'))).toBeUndefined();
  });

  it('includes stored synthetic feat choice prompts in pending choices', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          arcana: 'Arcana',
          athletics: 'Athletics',
        },
      },
    };

    const wizard = createWizard({
      ancestryFeat: {
        uuid: 'Compendium.pf2e.feats-srd.Item.elven-lore',
        name: 'Elven Lore',
        choiceSets: [
          {
            flag: 'levelerSkillFallback1',
            prompt: 'Select a skill.',
            grantsSkillTraining: true,
            options: [
              { value: 'arcana', label: 'Arcana' },
              { value: 'athletics', label: 'Athletics' },
            ],
          },
        ],
        choices: {},
      },
    });

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.elven-lore') {
        return {
          uuid,
          name: 'Elven Lore',
          system: {
            rules: [
              { key: 'ActiveEffectLike', path: 'system.skills.arcana.rank', value: 1 },
              { key: 'ActiveEffectLike', path: 'system.skills.nature.rank', value: 1 },
            ],
            items: {},
          },
        };
      }

      return {
        uuid,
        name: 'Mock',
        system: { rules: [], items: {} },
      };
    });

    try {
      const choices = await wizard._getPendingChoices();
      expect(choices).toEqual(expect.arrayContaining([
        expect.objectContaining({
          source: 'Elven Lore',
          prompt: 'Select a skill.',
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
    }
  });
});
