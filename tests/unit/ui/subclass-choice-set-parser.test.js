import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';
import { toggleKineticImpulse } from '../../../scripts/creation/creation-model.js';

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

function createDoc({
  uuid,
  name,
  type = 'feat',
  slug,
  traits = [],
  otherTags = [],
  level = 1,
  rarity = 'common',
}) {
  return {
    uuid,
    name,
    img: 'icons/svg/item-bag.svg',
    type,
    slug: slug ?? name.toLowerCase().replace(/\s+/g, '-'),
    system: {
      description: { value: '' },
      traits: {
        value: traits,
        otherTags,
        rarity,
      },
      level: { value: level },
    },
  };
}

describe('CharacterWizard subclass choice-set parsing', () => {
  beforeEach(() => {
    global.game = {
      ...global.game,
      i18n: {
        has: jest.fn(() => false),
        localize: jest.fn((key) => key),
      },
      packs: new Map([
        ['pf2e.classfeatures', {
          getDocuments: jest.fn(async () => [
            createDoc({
              uuid: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
              name: 'Bear',
              otherTags: ['barbarian-instinct-animal'],
            }),
          ]),
        }],
        ['pf2e.feats-srd', {
          getDocuments: jest.fn(async () => [
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.animal-instinct-ape',
              name: 'Ape',
              otherTags: ['barbarian-instinct-animal'],
            }),
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.mastermind-analysis',
              name: 'Mastermind Analysis',
              otherTags: ['rogue-racket-mastermind'],
            }),
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.scoundrel-trick',
              name: 'Scoundrel Trick',
              otherTags: ['rogue-racket-scoundrel'],
            }),
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.pistolero-practice',
              name: 'Pistolero Practice',
              otherTags: ['gunslinger-way-pistolero'],
              traits: ['skill'],
            }),
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.pistolero-dedication',
              name: 'Pistolero Dedication',
              otherTags: ['gunslinger-way-pistolero'],
              traits: ['dedication'],
            }),
            createDoc({
              uuid: 'Compendium.pf2e.feats-srd.Item.other-option',
              name: 'Not An Animal',
              otherTags: ['some-other-tag'],
            }),
          ]),
        }],
      ]),
    };
  });

  it('resolves filter-backed choice sets into selectable options', async () => {
    const wizard = new CharacterWizard(createMockActor());

    const sets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'animalInstinct',
        prompt: 'Choose your animal',
        choices: {
          filter: [
            'item:type:feat',
            'item:level:1',
            'item:tag:barbarian-instinct-animal',
          ],
        },
      },
    ]);

    expect(sets).toEqual([
      {
        flag: 'animalInstinct',
        prompt: 'Choose your animal',
        options: [
          {
            value: 'Compendium.pf2e.feats-srd.Item.animal-instinct-ape',
            label: 'Ape',
            uuid: 'Compendium.pf2e.feats-srd.Item.animal-instinct-ape',
            img: 'icons/svg/item-bag.svg',
            traits: [],
            rarity: 'common',
            type: 'feat',
          },
          {
            value: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
            label: 'Bear',
            uuid: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
            img: 'icons/svg/item-bag.svg',
            traits: [],
            rarity: 'common',
            type: 'feat',
          },
        ],
      },
    ]);
  });

  it('supports grouped or filters for subclass follow-up options', async () => {
    const wizard = new CharacterWizard(createMockActor());

    const sets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'rogueFollowUp',
        prompt: 'Choose your racket option',
        choices: {
          filter: [
            'item:type:feat',
            { or: ['item:tag:rogue-racket-mastermind', 'item:tag:rogue-racket-scoundrel'] },
          ],
        },
      },
    ]);

    expect(sets).toEqual([
      {
        flag: 'rogueFollowUp',
        prompt: 'Choose your racket option',
        options: [
          expect.objectContaining({ value: 'Compendium.pf2e.feats-srd.Item.mastermind-analysis', label: 'Mastermind Analysis', uuid: 'Compendium.pf2e.feats-srd.Item.mastermind-analysis' }),
          expect.objectContaining({ value: 'Compendium.pf2e.feats-srd.Item.scoundrel-trick', label: 'Scoundrel Trick', uuid: 'Compendium.pf2e.feats-srd.Item.scoundrel-trick' }),
        ],
      },
    ]);
  });

  it('supports exclusion filters so blocked options stay hidden', async () => {
    const wizard = new CharacterWizard(createMockActor());

    const sets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'gunslingerFollowUp',
        prompt: 'Choose your pistolero option',
        choices: {
          filter: [
            'item:type:feat',
            'item:tag:gunslinger-way-pistolero',
            { not: 'item:trait:dedication' },
          ],
        },
      },
    ]);

    expect(sets).toEqual([
      {
        flag: 'gunslingerFollowUp',
        prompt: 'Choose your pistolero option',
        options: [
          expect.objectContaining({
            value: 'Compendium.pf2e.feats-srd.Item.pistolero-practice',
            label: 'Pistolero Practice',
            uuid: 'Compendium.pf2e.feats-srd.Item.pistolero-practice',
            traits: ['skill'],
          }),
        ],
      },
    ]);
  });

  it('marks resolved compendium-backed choice sets as item choices in context', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      name: 'Animal Instinct',
      choiceSets: [
        {
          flag: 'animalInstinct',
          prompt: 'Choose your animal',
          options: [
            {
              value: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
              label: 'Bear',
              uuid: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
              img: 'icons/svg/item-bag.svg',
              traits: ['barbarian'],
              rarity: 'common',
            },
          ],
        },
      ],
      choices: {},
    };

    const context = await wizard._buildSubclassChoicesContext();
    expect(context.choiceSets[0].isItemChoice).toBe(true);
    expect(context.choiceSets[0].options[0]).toEqual(expect.objectContaining({
      uuid: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
      img: 'icons/svg/item-bag.svg',
      traits: ['barbarian'],
      rarity: 'common',
    }));
  });

  it('enriches inline compendium array choices into item-backed options', async () => {
    const wizard = new CharacterWizard(createMockActor());
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Calcifying Sand',
      img: 'icons/svg/item-bag.svg',
      type: 'feat',
      system: {
        traits: {
          value: ['earth', 'impulse'],
          rarity: 'common',
        },
      },
    }));

    const sets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'impulseOne',
        prompt: 'Select an impulse feat.',
        choices: [
          {
            value: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
            label: 'Calcifying Sand',
          },
        ],
      },
    ]);

    expect(sets).toEqual([
      {
        flag: 'impulseOne',
        prompt: 'Select an impulse feat.',
        options: [
          expect.objectContaining({
            value: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
            label: 'Calcifying Sand',
            uuid: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
            img: 'icons/svg/item-bag.svg',
            traits: ['earth', 'impulse'],
            rarity: 'common',
            type: 'feat',
          }),
        ],
      },
    ]);
  });

  it('enriches inline slug-backed choices into item-backed options', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.feats-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
            name: 'Calcifying Sand',
            img: 'icons/svg/item-bag.svg',
            type: 'feat',
            slug: 'calcifying-sand',
            traits: ['earth', 'impulse'],
            rarity: 'common',
          },
        ];
      }
      return [];
    });
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Calcifying Sand',
      img: 'icons/svg/item-bag.svg',
      type: 'feat',
      system: {
        traits: {
          value: ['earth', 'impulse'],
          rarity: 'common',
        },
      },
    }));

    const sets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'impulseOne',
        prompt: 'Select an impulse feat.',
        choices: [
          {
            value: 'calcifying-sand',
            label: 'Calcifying Sand',
          },
        ],
      },
    ]);

    expect(sets).toEqual([
      {
        flag: 'impulseOne',
        prompt: 'Select an impulse feat.',
        options: [
          expect.objectContaining({
            value: 'calcifying-sand',
            label: 'Calcifying Sand',
            uuid: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
            img: 'icons/svg/item-bag.svg',
            traits: ['earth', 'impulse'],
            rarity: 'common',
            type: 'feat',
          }),
        ],
      },
    ]);
  });

  it('hydrates stored compendium-backed subclass choices into item cards in context', async () => {
    const wizard = new CharacterWizard(createMockActor());
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Calcifying Sand',
      img: 'icons/svg/item-bag.svg',
      type: 'feat',
      system: {
        traits: {
          value: ['earth', 'impulse'],
          rarity: 'common',
        },
      },
    }));

    wizard.data.subclass = {
      name: 'Earth Gate',
      choiceSets: [
        {
          flag: 'impulseOne',
          prompt: 'Select an impulse feat.',
          options: [
            {
              value: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
              label: 'Calcifying Sand',
            },
          ],
        },
      ],
      choices: {},
    };

    const context = await wizard._buildSubclassChoicesContext();
    expect(context.choiceSets[0].isItemChoice).toBe(true);
    expect(context.choiceSets[0].options[0]).toEqual(expect.objectContaining({
      uuid: 'Compendium.pf2e.feats-srd.Item.calcifying-sand',
      img: 'icons/svg/item-bag.svg',
      traits: ['earth', 'impulse'],
      rarity: 'common',
      selected: false,
    }));
  });

  it('normalizes object-backed choice values so only the chosen dragon is selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      name: 'Dragon Instinct',
      choiceSets: [
        {
          flag: 'dragonInstinct',
          prompt: 'Select a dragon.',
          options: [
            {
              value: {
                slug: 'black-dragon',
                label: 'Black Dragon',
                img: 'icons/svg/item-bag.svg',
                description: '<p>Black dragon instincts are corrosive and cruel.</p>',
              },
            },
            {
              value: {
                slug: 'blue-dragon',
                label: 'Blue Dragon',
                img: 'icons/svg/item-bag.svg',
                description: '<p>Blue dragon instincts crackle with lightning.</p>',
              },
            },
          ],
        },
      ],
      choices: {
        dragonInstinct: 'black-dragon',
      },
    };

    const context = await wizard._buildSubclassChoicesContext();
    expect(context.choiceSets[0].isItemChoice).toBe(true);
    expect(context.choiceSets[0].options).toEqual([
      expect.objectContaining({
        value: 'black-dragon',
        label: 'Black Dragon',
        selected: true,
        summary: 'Black dragon instincts are corrosive and cruel.',
      }),
      expect.objectContaining({
        value: 'blue-dragon',
        label: 'Blue Dragon',
        selected: false,
        summary: 'Blue dragon instincts crackle with lightning.',
      }),
    ]);
  });

  it('treats nested uuid-backed choices as item cards', async () => {
    const wizard = new CharacterWizard(createMockActor());
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Azure Dragon',
      img: 'icons/svg/item-bag.svg',
      type: 'feat',
      system: {
        description: { value: '<p>An azure dragon instinct crackles with storm power.</p>' },
        traits: {
          value: ['electricity', 'dragon'],
          rarity: 'common',
        },
      },
    }));

    wizard.data.subclass = {
      name: 'Dragon Instinct',
      choiceSets: [
        {
          flag: 'dragonInstinct',
          prompt: 'Select a dragon.',
          options: [
            {
              value: {
                uuid: 'Compendium.pf2e.classfeatures.Item.azure-dragon',
                label: 'Azure Dragon',
              },
            },
          ],
        },
      ],
      choices: {
        dragonInstinct: 'Compendium.pf2e.classfeatures.Item.azure-dragon',
      },
    };

    const context = await wizard._buildSubclassChoicesContext();
    expect(context.choiceSets[0].isItemChoice).toBe(true);
    expect(context.choiceSets[0].options[0]).toEqual(expect.objectContaining({
      uuid: 'Compendium.pf2e.classfeatures.Item.azure-dragon',
      label: 'Azure Dragon',
      selected: true,
      traits: ['electricity', 'dragon'],
    }));
  });

  it('uses the resolved option label in subclass summaries', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      name: 'Animal Instinct',
      choiceSets: [
        {
          flag: 'animalInstinct',
          prompt: 'Choose your animal',
          options: [
            { value: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear', label: 'Bear' },
          ],
        },
      ],
      choices: {
        animalInstinct: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
      },
    };

    await expect(wizard._getSelectedSubclassChoiceLabels()).resolves.toEqual(['Bear']);
  });

  it('falls back to the item name when the selected choice stores a UUID without an option label', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      name: 'Animal Instinct',
      choiceSets: [
        {
          flag: 'animalInstinct',
          prompt: 'Choose your animal',
          options: [],
        },
      ],
      choices: {
        animalInstinct: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Bear',
    }));

    await expect(wizard._getSelectedSubclassChoiceLabels()).resolves.toEqual(['Bear']);
  });

  it('formats slug-like fallback values into readable labels', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.subclass = {
      name: 'School of Rune Magic',
      choiceSets: [
        {
          flag: 'sin',
          prompt: 'Choose your sin',
          options: [],
        },
      ],
      choices: {
        sin: 'wrath-rune',
      },
    };

    await expect(wizard._getSelectedSubclassChoiceLabels()).resolves.toEqual(['Wrath Rune']);
  });

  it('builds a readable combined subclass label in the summary context', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'barbarian', name: 'Barbarian' };
    wizard.data.subclass = {
      name: 'Animal Instinct',
      choiceSets: [
        {
          flag: 'animalInstinct',
          prompt: 'Choose your animal',
          options: [],
        },
      ],
      choices: {
        animalInstinct: 'grizzly-bear',
      },
    };
    wizard.currentStep = 23;

    const context = await wizard._getStepContext();
    expect(context.subclassSummaryLabel).toBe('Animal Instinct (Grizzly Bear)');
  });

  it('builds a readable combined subclass label for generic martial follow-up choices', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'gunslinger', name: 'Gunslinger' };
    wizard.data.subclass = {
      name: 'Way of the Pistolero',
      choiceSets: [
        {
          flag: 'wayOption',
          prompt: 'Choose your way option',
          options: [
            {
              value: 'Compendium.pf2e.feats-srd.Item.pistolero-practice',
              label: 'Pistolero Practice',
            },
          ],
        },
      ],
      choices: {
        wayOption: 'Compendium.pf2e.feats-srd.Item.pistolero-practice',
      },
    };
    wizard.currentStep = 23;

    const context = await wizard._getStepContext();
    expect(context.subclassSummaryLabel).toBe('Way of the Pistolero (Pistolero Practice)');
  });

  it('hides the generic subclass summary row for kineticist', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'kineticist', name: 'Kineticist' };
    wizard.data.subclass = {
      name: 'Air Gate',
      choiceSets: [],
      choices: {},
    };
    wizard.currentStep = 23;

    const context = await wizard._getStepContext();
    expect(context.showSubclassSummary).toBe(false);
    expect(context.subclassSummaryLabel).toBe('Air Gate');
  });

  it('only shows the opposite element as the second dual-gate impulse choice', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'kineticist', name: 'Kineticist' };
    wizard.data.subclass = { slug: 'earth-gate', uuid: 'earth-uuid', name: 'Earth Gate' };
    wizard.data.kineticGateMode = 'dual-gate';
    wizard.data.secondElement = { slug: 'metal-gate', uuid: 'metal-uuid', name: 'Metal Gate' };
    toggleKineticImpulse(wizard.data, {
      uuid: 'Compendium.pf2e.feats-srd.Item.armor-in-earth',
      name: 'Armor in Earth',
      img: 'icons/svg/item-bag.svg',
      element: 'earth',
    }, 2);

    wizard._loadCompendium = jest.fn(async () => [
      { uuid: 'e1', name: 'Armor in Earth', img: 'icons/svg/item-bag.svg', type: 'feat', level: 1, traits: ['impulse', 'earth'], rarity: 'common' },
      { uuid: 'e2', name: 'Tremor', img: 'icons/svg/item-bag.svg', type: 'feat', level: 1, traits: ['impulse', 'earth'], rarity: 'common' },
      { uuid: 'm1', name: 'Flashforge', img: 'icons/svg/item-bag.svg', type: 'feat', level: 1, traits: ['impulse', 'metal'], rarity: 'common' },
    ]);

    const options = await wizard._loadKineticImpulses(wizard.data);
    expect(options.map((option) => option.name)).toEqual(['Flashforge']);
  });

  it('builds generic apply prompt rows from selected subclass choice sets', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'barbarian', name: 'Barbarian' };
    wizard.data.subclass = {
      uuid: 'Compendium.pf2e.classfeatures.Item.dragon-instinct',
      name: 'Dragon Instinct',
      choiceSets: [
        {
          flag: 'dragonInstinct',
          prompt: 'Select a dragon.',
          options: [
            { value: 'adamantine-dragon', label: 'Adamantine Dragon' },
            { value: 'black-dragon', label: 'Black Dragon' },
          ],
        },
      ],
      choices: {
        dragonInstinct: 'adamantine-dragon',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.dragon-instinct') {
        return {
          uuid,
          name: 'Dragon Instinct',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'dragonInstinct', prompt: 'Select a dragon.' },
            ],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Dragon Instinct',
        prompt: 'Select a dragon.',
        value: 'Adamantine Dragon',
      }),
    ]);
  });

  it('builds feat choice sections from selected feats with choice sets', async () => {
    const wizard = new CharacterWizard(createMockActor());
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Reactive Shield',
      img: 'icons/svg/item-bag.svg',
      type: 'feat',
      system: {
        description: { value: '<p>Raise your shield in time.</p>' },
        traits: {
          value: ['fighter'],
          rarity: 'common',
        },
      },
    }));
    wizard.data.ancestryFeat = {
      name: 'Natural Ambition',
      choiceSets: [
        {
          flag: 'grantedClassFeat',
          prompt: 'Choose a class feat.',
          options: [
            {
              value: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
              label: 'Reactive Shield',
            },
          ],
        },
      ],
      choices: {},
    };

    const context = await wizard._buildFeatChoicesContext();
    expect(context.featChoiceSections).toHaveLength(1);
    expect(context.featChoiceSections[0]).toEqual(expect.objectContaining({
      slot: 'ancestry',
      featName: 'Natural Ambition',
    }));
    expect(context.featChoiceSections[0].choiceSets[0].isItemChoice).toBe(true);
    expect(context.featChoiceSections[0].choiceSets[0].options[0]).toEqual(expect.objectContaining({
      value: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
      label: 'Reactive Shield',
      selected: false,
    }));
  });

  it('parses feat choice sets that filter ancestry options by rarity', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.android',
            name: 'Android',
            img: 'android.png',
            type: 'ancestry',
            slug: 'android',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
          {
            uuid: 'Compendium.pf2e.ancestries.Item.sprite',
            name: 'Sprite',
            img: 'sprite.png',
            type: 'ancestry',
            slug: 'sprite',
            traits: [],
            otherTags: [],
            rarity: 'rare',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'adoptedAncestry',
        prompt: 'Select a common ancestry.',
        choices: {
          itemType: 'ancestry',
          filter: ['item:type:ancestry', 'item:rarity:common'],
        },
      },
    ]);

    expect(choiceSets).toEqual([
      expect.objectContaining({
        flag: 'adoptedAncestry',
        prompt: 'Select a common ancestry.',
        options: [
          expect.objectContaining({
            value: 'Compendium.pf2e.ancestries.Item.android',
            label: 'Android',
            rarity: 'common',
          }),
        ],
      }),
    ]);
  });

  it('uses slugs as values when a choice set requests slugsAsValues', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.android',
            name: 'Android',
            img: 'android.png',
            type: 'ancestry',
            slug: 'android',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'ancestry',
        prompt: 'Select a common ancestry.',
        choices: {
          itemType: 'ancestry',
          slugsAsValues: true,
          filter: ['item:type:ancestry', 'item:rarity:common'],
        },
      },
    ]);

    expect(choiceSets[0].options[0]).toEqual(expect.objectContaining({
      value: 'android',
      label: 'Android',
      uuid: 'Compendium.pf2e.ancestries.Item.android',
    }));
  });

  it('treats "select a common ancestry" ancestry choice sets as common-only even without an explicit rarity filter', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
            name: 'Dwarf',
            img: 'dwarf.png',
            type: 'ancestry',
            slug: 'dwarf',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
          {
            uuid: 'Compendium.pf2e.ancestries.Item.catfolk',
            name: 'Catfolk',
            img: 'catfolk.png',
            type: 'ancestry',
            slug: 'catfolk',
            traits: [],
            otherTags: [],
            rarity: 'uncommon',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'ancestry',
        prompt: 'Select a common ancestry.',
        choices: {
          itemType: 'ancestry',
          slugsAsValues: true,
          filter: [{ not: 'item:slug:{actor|system.details.ancestry.trait}' }],
        },
      },
    ]);

    expect(choiceSets[0].options).toEqual([
      expect.objectContaining({
        value: 'dwarf',
        label: 'Dwarf',
      }),
    ]);
  });

  it('treats adopted ancestry localization-key prompts as common-only ancestry choices', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
            name: 'Dwarf',
            img: 'dwarf.png',
            type: 'ancestry',
            slug: 'dwarf',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
          {
            uuid: 'Compendium.pf2e.ancestries.Item.catfolk',
            name: 'Catfolk',
            img: 'catfolk.png',
            type: 'ancestry',
            slug: 'catfolk',
            traits: [],
            otherTags: [],
            rarity: 'uncommon',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'ancestry',
        prompt: 'PF2E.SpecificRule.AdoptedAncestry.Prompt',
        choices: {
          itemType: 'ancestry',
          slugsAsValues: true,
          filter: [{ not: 'item:slug:{actor|system.details.ancestry.trait}' }],
        },
      },
    ]);

    expect(choiceSets[0].options).toEqual([
      expect.objectContaining({
        value: 'dwarf',
        label: 'Dwarf',
      }),
    ]);
  });

  it('treats common ancestry prompts backed only by ancestry filters as common-only', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
            name: 'Dwarf',
            img: 'dwarf.png',
            type: 'ancestry',
            slug: 'dwarf',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
          {
            uuid: 'Compendium.pf2e.ancestries.Item.catfolk',
            name: 'Catfolk',
            img: 'catfolk.png',
            type: 'ancestry',
            slug: 'catfolk',
            traits: [],
            otherTags: [],
            rarity: 'uncommon',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'ancestry',
        prompt: 'Select a common ancestry.',
        choices: {
          filter: ['item:type:ancestry'],
        },
      },
    ]);

    expect(choiceSets[0].options).toEqual([
      expect.objectContaining({
        value: 'Compendium.pf2e.ancestries.Item.dwarf',
        label: 'Dwarf',
        rarity: 'common',
      }),
    ]);
  });

  it('builds feat choice sections for heritage-granted feats with choice sets', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.heritage = {
      uuid: 'Compendium.pf2e.heritages.Item.adaptive-anadi',
      name: 'Adaptive Anadi',
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.heritages.Item.adaptive-anadi') {
        return {
          uuid,
          type: 'heritage',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry' },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.adopted-ancestry') {
        return {
          uuid,
          name: 'Adopted Ancestry',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestry',
                prompt: 'Select a common ancestry.',
                choices: {
                  itemType: 'ancestry',
                  slugsAsValues: true,
                  filter: ['item:type:ancestry', 'item:rarity:common'],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.android',
            name: 'Android',
            img: 'android.png',
            type: 'ancestry',
            slug: 'android',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    await wizard._refreshGrantedFeatChoiceSections();
    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections).toEqual([
      expect.objectContaining({
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        sourceName: 'Adaptive Anadi -> Adopted Ancestry',
      }),
    ]);
    expect(context.featChoiceSections[0].choiceSets[0].options[0]).toEqual(expect.objectContaining({
      value: 'android',
      label: 'Android',
    }));
  });

  it('refreshes stale granted feat choice data from live item rules', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.heritage = {
      uuid: 'Compendium.pf2e.heritages.Item.adaptive-anadi',
      name: 'Adaptive Anadi',
    };
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        sourceName: 'Adaptive Anadi',
        choiceSets: [
          {
            flag: 'ancestry',
            prompt: 'Select a common ancestry.',
            options: [{ value: 'catfolk', label: 'Catfolk', uuid: 'Compendium.pf2e.ancestries.Item.catfolk', rarity: 'uncommon' }],
          },
        ],
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.heritages.Item.adaptive-anadi') {
        return {
          uuid,
          type: 'heritage',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry' },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.adopted-ancestry') {
        return {
          uuid,
          name: 'Adopted Ancestry',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestry',
                prompt: 'Select a common ancestry.',
                choices: {
                  itemType: 'ancestry',
                  slugsAsValues: true,
                  filter: [{ not: 'item:slug:{actor|system.details.ancestry.trait}' }],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async (pack) => {
      if (pack === 'pf2e.ancestries') {
        return [
          {
            uuid: 'Compendium.pf2e.ancestries.Item.dwarf',
            name: 'Dwarf',
            img: 'dwarf.png',
            type: 'ancestry',
            slug: 'dwarf',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: null,
          },
          {
            uuid: 'Compendium.pf2e.ancestries.Item.catfolk',
            name: 'Catfolk',
            img: 'catfolk.png',
            type: 'ancestry',
            slug: 'catfolk',
            traits: [],
            otherTags: [],
            rarity: 'uncommon',
            level: 0,
            category: null,
          },
        ];
      }
      return [];
    });

    await wizard._refreshAllFeatChoiceData();

    expect(wizard.data.grantedFeatSections[0].choiceSets[0].options).toEqual([
      expect.objectContaining({
        value: 'dwarf',
        label: 'Dwarf',
      }),
    ]);
  });

  it('adds nested follow-up choice sets introduced by a selected feat-choice option item', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.heritage = {
      uuid: 'Compendium.pf2e.heritages.Item.adaptive-anadi',
      name: 'Adaptive Anadi',
    };
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.adopted-ancestry': {
        ancestry: 'dwarf',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.heritages.Item.adaptive-anadi') {
        return {
          uuid,
          type: 'heritage',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry' },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.adopted-ancestry') {
        return {
          uuid,
          name: 'Adopted Ancestry',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'ancestry',
                prompt: 'Select a common ancestry.',
                choices: [{ value: 'dwarf', label: 'Dwarf', uuid: 'Compendium.pf2e.ancestries.Item.dwarf' }],
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.ancestries.Item.dwarf') {
        return {
          uuid,
          name: 'Dwarf',
          type: 'ancestry',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'dwarfWeaponChoice',
                prompt: 'Select a weapon.',
                choices: [{ value: 'clan-dagger', label: 'Clan Dagger' }],
              },
            ],
          },
        };
      }
      return null;
    });

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: 'Compendium.pf2e.ancestries.Item.dwarf',
        featName: 'Dwarf',
      }),
    ]));
  });

  it('parses config-driven skill choice sets into skill options instead of item lists', async () => {
    const wizard = new CharacterWizard(createMockActor());
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          nat: 'PF2E.SkillNat',
        },
      },
    };

    try {
      const choiceSets = await wizard._parseChoiceSets([
        {
          key: 'ChoiceSet',
          flag: 'skill',
          prompt: 'Select a skill.',
          choices: 'CONFIG.PF2E.skills',
        },
      ]);

      expect(choiceSets[0].options).toEqual([
        expect.objectContaining({ value: 'acr', label: 'PF2E.SkillAcr' }),
        expect.objectContaining({ value: 'nat', label: 'PF2E.SkillNat' }),
      ]);
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('parses shorthand config-driven skill choice sets into skill options', async () => {
    const wizard = new CharacterWizard(createMockActor());
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          nat: 'PF2E.SkillNat',
        },
      },
    };

    try {
      const choiceSets = await wizard._parseChoiceSets([
        {
          key: 'ChoiceSet',
          flag: 'skill',
          prompt: 'Select a skill.',
          choices: {
            config: 'skills',
          },
        },
      ]);

      expect(choiceSets[0].options).toEqual([
        expect.objectContaining({ value: 'acr', label: 'PF2E.SkillAcr' }),
        expect.objectContaining({ value: 'nat', label: 'PF2E.SkillNat' }),
      ]);
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('parses skill filter choice sets into skill options instead of item lists', async () => {
    const wizard = new CharacterWizard(createMockActor());
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          nat: 'PF2E.SkillNat',
        },
      },
    };

    try {
      const choiceSets = await wizard._parseChoiceSets([
        {
          key: 'ChoiceSet',
          flag: 'skill',
          prompt: 'Select a skill.',
          choices: {
            filter: ['item:type:skill'],
          },
        },
      ]);

      expect(choiceSets[0].options).toEqual([
        expect.objectContaining({ value: 'acr', label: 'PF2E.SkillAcr' }),
        expect.objectContaining({ value: 'nat', label: 'PF2E.SkillNat' }),
      ]);
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('does not mark feat choices complete while a granted feat choice section is still unselected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        sourceName: 'Adaptive Anadi',
        choiceSets: [
          {
            flag: 'ancestry',
            prompt: 'Select a common ancestry.',
            options: [{ value: 'android', label: 'Android', uuid: 'Compendium.pf2e.ancestries.Item.android' }],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {};

    expect(wizard._isStepComplete('featChoices')).toBe(false);

    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.adopted-ancestry': { ancestry: 'android' },
    };

    expect(wizard._isStepComplete('featChoices')).toBe(true);
  });

  it('includes selected feat choice prompts in the apply overlay prompt rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestryFeat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      name: 'Natural Ambition',
      choiceSets: [
        {
          flag: 'grantedClassFeat',
          prompt: 'Choose a class feat.',
          options: [
            {
              value: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
              label: 'Reactive Shield',
            },
          ],
        },
      ],
      choices: {
        grantedClassFeat: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          name: 'Natural Ambition',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantedClassFeat',
                prompt: 'Choose a class feat.',
              },
            ],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Natural Ambition',
        prompt: 'Choose a class feat.',
        value: 'Reactive Shield',
      }),
    ]);
  });

  it('includes granted feat choice prompts in the apply overlay prompt rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.heritage = {
      uuid: 'Compendium.pf2e.heritages.Item.adaptive-anadi',
      name: 'Adaptive Anadi',
    };
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
        featName: 'Adopted Ancestry',
        sourceName: 'Adaptive Anadi',
        choiceSets: [
          {
            flag: 'ancestry',
            prompt: 'Select a common ancestry.',
            options: [{ value: 'android', label: 'Android', uuid: 'Compendium.pf2e.ancestries.Item.android' }],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.adopted-ancestry': {
        ancestry: 'android',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.heritages.Item.adaptive-anadi') {
        return {
          uuid,
          name: 'Adaptive Anadi',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry' },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.adopted-ancestry') {
        return {
          uuid,
          name: 'Adopted Ancestry',
          type: 'feat',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'ancestry', prompt: 'Select a common ancestry.' },
            ],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Adaptive Anadi -> Adopted Ancestry',
        prompt: 'Select a common ancestry.',
        value: 'Android',
      }),
    ]);
  });

  it('keeps unresolved choice sets visible in the apply overlay prompt rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.classFeat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      name: 'Natural Ambition',
      choiceSets: [
        {
          flag: 'grantedClassFeat',
          prompt: 'Choose a class feat.',
          options: [
            {
              value: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
              label: 'Reactive Shield',
            },
          ],
        },
      ],
      choices: {},
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          name: 'Natural Ambition',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantedClassFeat',
                prompt: 'Choose a class feat.',
              },
            ],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Natural Ambition',
        prompt: 'Choose a class feat.',
        value: 'Pending selection',
        pending: true,
      }),
    ]);
  });

  it('matches the active system prompt title to the relevant apply prompt row', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._activeSystemPrompt = { title: 'Select a dragon.' };

    const match = wizard._matchActivePromptRow([
      { label: 'Dragon Instinct', prompt: 'Select a dragon.', value: 'Adamantine Dragon' },
      { label: 'Arcane Thesis', prompt: 'Choose your thesis.', value: 'Improved Familiar Attunement' },
    ]);

    expect(match).toEqual(expect.objectContaining({
      label: 'Dragon Instinct',
      value: 'Adamantine Dragon',
    }));
  });

  it('includes subclass-selection prompts in the apply overlay when resolved from the chosen subclass', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'Compendium.pf2e.classes.Item.sorcerer', name: 'Sorcerer', slug: 'sorcerer' };
    wizard.data.subclass = {
      uuid: 'Compendium.pf2e.classfeatures.Item.bloodline-elemental',
      name: 'Bloodline: Elemental',
      slug: 'bloodline-elemental',
      choiceSets: [],
      choices: {},
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.sorcerer') {
        return {
          uuid,
          name: 'Sorcerer',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'bloodline',
                prompt: 'Select a bloodline.',
                choices: {
                  filter: ['item:tag:sorcerer-bloodline'],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Sorcerer',
        prompt: 'Select a bloodline.',
        value: 'Bloodline: Elemental',
      }),
    ]);
  });

  it('maps subclass-tag filtered system prompts to the chosen subclass', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'barbarian', name: 'Barbarian' };
    wizard.data.subclass = {
      name: 'Dragon Instinct',
      choiceSets: [],
      choices: {},
    };

    const value = await wizard._resolvePromptSelectionLabel({
      prompt: 'Select an instinct.',
      choices: {
        filter: ['item:tag:barbarian-instinct'],
      },
    });

    expect(value).toBe('Dragon Instinct');
  });

  it('matches active prompt titles against source labels like Instinct', () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard._activeSystemPrompt = { title: 'Instinct' };

    const match = wizard._matchActivePromptRow([
      { label: 'Barbarian -> Instinct', prompt: 'Select an instinct.', value: 'Dragon Instinct' },
      { label: 'Dragon Instinct', prompt: 'Select a dragon.', value: 'Adamantine Dragon' },
    ]);

    expect(match).toEqual(expect.objectContaining({
      label: 'Barbarian -> Instinct',
      value: 'Dragon Instinct',
    }));
  });
});
