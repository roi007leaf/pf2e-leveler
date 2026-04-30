import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { ItemPicker } from '../../../scripts/ui/item-picker.js';

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
      if (uuid === 'class-champion') {
        return {
          uuid,
          name: 'Champion',
          system: {
            items: {
              devotion: {
                uuid: 'feature-devotion-spells',
                name: 'Devotion Spells',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'feature-devotion-spells') {
        return {
          uuid,
          name: 'Devotion Spells',
          slug: 'devotion-spells',
          system: {
            rules: [{
              key: 'ChoiceSet',
              flag: 'devotionSpell',
              prompt: 'Select a spell.',
              choices: {
                itemType: 'spell',
                filter: ['item:type:spell'],
              },
            }],
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

  it('does not duplicate Champion devotion spell choice in feat choices', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'class-champion', slug: 'champion', name: 'Champion' };
    wizard.classHandler = {
      getExtraSteps: () => [],
      isFocusSpellChoice: () => true,
      isStepComplete: () => null,
    };
    wizard._loadCompendiumCategory = jest.fn(async (category) => {
      if (category !== 'spells') return [];
      return [
        {
          uuid: 'shield-spirit',
          name: 'Shields of the Spirit',
          type: 'spell',
          traits: ['champion', 'focus'],
          traditions: [],
        },
        {
          uuid: 'lay-on-hands',
          name: 'Lay on Hands',
          type: 'spell',
          traits: ['champion', 'focus'],
          traditions: [],
        },
      ];
    });

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ featName: 'Devotion Spells' }),
    ]));
  });

  it('hides stale Champion devotion spell sections from feat choices', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'class-champion', slug: 'champion', name: 'Champion' };
    wizard.classHandler = {
      getExtraSteps: () => [],
      isFocusSpellChoice: () => true,
      isStepComplete: () => null,
    };
    wizard.data.grantedFeatSections = [{
      slot: 'feature-devotion-spells',
      featName: 'Devotion Spells',
      sourceName: 'Champion -> Devotion Spells',
      choiceSets: [{
        flag: 'devotionSpell',
        prompt: 'Select a spell.',
        options: [{
          value: 'shield-spirit',
          uuid: 'shield-spirit',
          label: 'Shields of the Spirit',
          type: 'spell',
        }],
      }],
    }];

    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections).toEqual([]);
    expect(wizard._hasFeatChoices()).toBe(false);
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

  it('labels Alchemical Crafting formula choices with the granting source', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'class-alchemist', slug: 'alchemist', name: 'Alchemist' };
    wizard._cachedFeatGrantRequirements = await wizard._buildFeatGrantRequirements();

    const context = await wizard._buildFeatChoicesContext();

    expect(context.featGrantRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'class-alchemist:alchemical-crafting-formula',
        sourceFeatName: 'Alchemical Crafting',
        grantingSourceName: 'Alchemist',
        grantingSourceUuid: 'class-alchemist',
      }),
    ]));
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

  it('keeps common formula rarity as default instead of a locked creation grant filter', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.featGrants = [];
    const applyPresetSpy = jest.spyOn(ItemPicker.prototype, '_applyPreset');
    const renderSpy = jest.spyOn(ItemPicker.prototype, 'render').mockImplementation(() => {});

    await wizard._openFeatGrantItemPicker({
      id: 'feature-bomber:formula',
      sourceFeatUuid: 'feature-bomber',
      sourceFeatName: 'Bomber',
      kind: 'formula',
      count: 2,
      confidence: 'inferred',
      filters: {
        maxLevel: 1,
        rarity: ['common'],
        traits: ['alchemical', 'bomb'],
      },
    });

    expect(applyPresetSpy).toHaveBeenCalledWith(expect.objectContaining({
      selectedRarities: ['common'],
    }));
    expect(applyPresetSpy.mock.calls[0][0]).not.toHaveProperty('lockedRarities');

    renderSpy.mockRestore();
    applyPresetSpy.mockRestore();
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
    expect(featGrantSection).toContain('wizard-grant-choice__source-link');
    expect(featGrantSection).not.toContain('class="wizard-item__select"');
  });
});
