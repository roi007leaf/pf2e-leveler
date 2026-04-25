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

describe('CharacterWizard feat grant choices', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-formulas' || uuid === 'option-formulas') {
        return {
          uuid,
          name: uuid === 'feat-formulas' ? 'Alchemical Crafting' : 'Bomber Field',
          system: {
            description: {
              value: '<p>You gain formulas for two common alchemical items.</p>',
            },
          },
        };
      }
      return null;
    });
  });

  it('adds generic formula grant requirements from selected creation feats', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.classFeat = {
      uuid: 'feat-formulas',
      name: 'Alchemical Crafting',
      choiceSets: [],
      choices: {},
    };

    wizard._cachedFeatGrantRequirements = await wizard._buildFeatGrantRequirements();
    const context = await wizard._buildFeatChoicesContext();

    expect(context.featGrantRequirements).toEqual([
      expect.objectContaining({
        id: 'feat-formulas:formula',
        kind: 'formula',
        count: 2,
        complete: false,
      }),
    ]);
    expect(wizard._isStepComplete('featChoices')).toBe(false);

    wizard.data.featGrants = [{
      requirementId: 'feat-formulas:formula',
      sourceFeatUuid: 'feat-formulas',
      sourceFeatName: 'Alchemical Crafting',
      kind: 'formula',
      selections: [
        { uuid: 'formula-1', name: 'Formula One' },
        { uuid: 'formula-2', name: 'Formula Two' },
      ],
    }];

    expect(wizard._isStepComplete('featChoices')).toBe(true);
  });

  it('adds generic grant requirements from selected subclass option items', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      uuid: 'subclass-field',
      name: 'Field',
      choiceSets: [{
        flag: 'field',
        prompt: 'Research Field',
        options: [{ value: 'option-formulas', uuid: 'option-formulas', label: 'Bomber Field' }],
      }],
      choices: { field: 'option-formulas' },
    };

    const requirements = await wizard._buildFeatGrantRequirements();

    expect(requirements).toEqual([
      expect.objectContaining({
        id: 'option-formulas:formula',
        sourceFeatUuid: 'option-formulas',
        kind: 'formula',
        count: 2,
      }),
    ]);
  });

  it('adds alchemist class and research field formula grants during creation', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'class-alchemist', slug: 'alchemist', name: 'Alchemist' };
    wizard.data.subclass = {
      uuid: 'option-formulas',
      name: 'Bomber Field',
      choiceSets: [],
      choices: {},
    };

    const requirements = await wizard._buildFeatGrantRequirements();

    expect(requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'class-alchemist:alchemical-crafting-formula', sourceFeatName: 'Alchemical Crafting', count: 4 }),
      expect.objectContaining({ id: 'class-alchemist:formula-book-formula', sourceFeatName: 'Formula Book', count: 2 }),
      expect.objectContaining({ id: 'option-formulas:formula', sourceFeatName: 'Bomber Field', count: 2 }),
    ]));
    expect(requirements).toHaveLength(3);
  });

  it('keeps detected formula filters when stored grant was manually configured', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.classFeat = {
      uuid: 'feat-formulas',
      name: 'Alchemical Crafting',
      choiceSets: [],
      choices: {},
    };
    wizard.data.featGrants = [{
      requirementId: 'feat-formulas:formula',
      sourceFeatUuid: 'feat-formulas',
      sourceFeatName: 'Alchemical Crafting',
      kind: 'formula',
      manual: { count: 2, filters: {} },
      selections: [],
    }];
    wizard._cachedFeatGrantRequirements = await wizard._buildFeatGrantRequirements();

    const requirement = await wizard._getFeatGrantRequirement('feat-formulas:formula');

    expect(requirement).toEqual(expect.objectContaining({
      confidence: 'manual',
      filters: expect.objectContaining({
        rarity: ['common'],
        traits: ['alchemical'],
      }),
    }));
  });

  it('collects already taken formula grant selections during creation', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.featGrants = [
      {
        requirementId: 'formula-a',
        kind: 'formula',
        selections: [{ uuid: 'item-a', name: 'Acid Flask' }],
      },
      {
        requirementId: 'item-a',
        kind: 'item',
        selections: [{ uuid: 'item-b', name: 'Backpack' }],
      },
      {
        requirementId: 'formula-b',
        kind: 'formula',
        selections: [{ uuid: 'item-c', name: 'Alchemist Fire' }],
      },
    ];

    expect(wizard._getTakenFormulaGrantSelections()).toEqual([
      { uuid: 'item-a', name: 'Acid Flask' },
      { uuid: 'item-c', name: 'Alchemist Fire' },
    ]);
  });

  it('renders feat grant picker buttons with grant-specific alignment', () => {
    const template = require('fs').readFileSync(require('path').resolve(__dirname, '../../../templates/character-wizard.hbs'), 'utf8');
    const featGrantSection = template.slice(
      template.indexOf('{{#if featGrantRequirements.length}}'),
      template.indexOf('{{#each featChoiceSections}}'),
    );

    expect(featGrantSection).toContain('wizard-grant-choice__actions');
    expect(featGrantSection).toContain('wizard-grant-choice__button');
    expect(featGrantSection).not.toContain('class="wizard-item__select"');
  });
});
