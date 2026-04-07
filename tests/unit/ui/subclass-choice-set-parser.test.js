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
            category: null,
            range: null,
            isRanged: false,
          },
          {
            value: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
            label: 'Bear',
            uuid: 'Compendium.pf2e.classfeatures.Item.animal-instinct-bear',
            img: 'icons/svg/item-bag.svg',
            traits: [],
            rarity: 'common',
            type: 'feat',
            category: null,
            range: null,
            isRanged: false,
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
    wizard.currentStep = 24;

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
    wizard.currentStep = 24;

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
    wizard.currentStep = 24;

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

  it('builds feat choice sections for direct heritage choice sets like Skilled Human', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.heritage = {
      uuid: 'Compendium.pf2e.heritages.Item.skilled-human',
      name: 'Skilled Human',
    };

    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'Acrobatics',
          arc: 'Arcana',
        },
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.heritages.Item.skilled-human') {
        return {
          uuid,
          name: 'Skilled Human',
          type: 'heritage',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'skill',
                prompt: 'Select a skill.',
                choices: { config: 'skills' },
              },
            ],
          },
        };
      }
      return null;
    });

    try {
      await wizard._refreshGrantedFeatChoiceSections();
      const context = await wizard._buildFeatChoicesContext();

      expect(context.featChoiceSections).toEqual([
        expect.objectContaining({
          slot: 'Compendium.pf2e.heritages.Item.skilled-human',
          featName: 'Skilled Human',
        }),
      ]);
      expect(context.featChoiceSections[0].choiceSets[0].options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'acr', label: 'Acrobatics' }),
        expect.objectContaining({ value: 'arc', label: 'Arcana' }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
    }
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

  it('surfaces deity-granted domain choices and resolves dynamic domain options from the selected deity', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.cleric',
      name: 'Cleric',
      slug: 'cleric',
    };
    wizard.data.deity = {
      uuid: 'Compendium.pf2e.deities.Item.nethys',
      name: 'Nethys',
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.deities.Item.nethys') {
        return {
          uuid,
          type: 'deity',
          name: 'Nethys',
          system: {
            domains: {
              primary: ['creation', 'fate', 'time'],
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
          type: 'feat',
          name: 'Domain Initiate',
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

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: 'Compendium.pf2e.feats-srd.Item.domain-initiate',
        featName: 'Domain Initiate',
        sourceName: expect.stringContaining('Nethys'),
      }),
    ]));
    expect(wizard.data.grantedFeatSections[0].choiceSets[0].options).toEqual([
      { value: 'creation', label: 'Creation' },
      { value: 'fate', label: 'Fate' },
      { value: 'time', label: 'Time' },
      { value: 'fate', label: 'Fate (apocryphal)' },
    ]);
  });

  it('follows handler-managed deity selections from cleric class features into nested deity domain choices', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.cleric',
      name: 'Cleric',
      slug: 'cleric',
    };
    wizard.data.deity = {
      uuid: 'Compendium.pf2e.deities.Item.nethys',
      name: 'Nethys',
    };
    wizard.classHandler = {
      getExtraSteps: () => [
        { id: 'deity', visible: () => true },
        { id: 'sanctification', visible: () => true },
        { id: 'divineFont', visible: () => true },
      ],
      shouldShowSubclassChoices: () => true,
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.cleric') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              doctrine: {
                uuid: 'Compendium.pf2e.classfeatures.Item.cleric-doctrine',
                name: 'Doctrine',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.cleric-doctrine') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Doctrine',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'deity',
                prompt: 'Select a deity.',
                choices: {
                  filter: ['item:type:deity'],
                },
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.deities.Item.nethys') {
        return {
          uuid,
          type: 'deity',
          name: 'Nethys',
          system: {
            domains: {
              primary: ['creation', 'time'],
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
          type: 'feat',
          name: 'Domain Initiate',
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

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        featName: 'Domain Initiate',
      }),
    ]));
  });

  it('adds a synthetic cleric domain section when the selected deity has domains but no discoverable Domain Initiate grant chain', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.cleric',
      name: 'Cleric',
      slug: 'cleric',
    };
    wizard.data.subclass = {
      uuid: 'Compendium.pf2e.classfeatures.Item.cloistered-cleric',
      name: 'Cloistered Cleric',
      slug: 'cloistered-cleric',
    };
    wizard.data.deity = {
      uuid: 'Compendium.pf2e.deities.Item.sarshallatu',
      name: 'Sarshallatu',
      domains: {
        primary: ['creation', 'dragon', 'fate', 'time'],
        alternate: ['fate'],
      },
    };
    wizard.classHandler = {
      getExtraSteps: () => [
        { id: 'deity', visible: () => true },
        { id: 'sanctification', visible: () => true },
        { id: 'divineFont', visible: () => true },
      ],
      shouldShowSubclassChoices: () => true,
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.cleric') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              doctrine: {
                uuid: 'Compendium.pf2e.classfeatures.Item.cleric-doctrine',
                name: 'Doctrine',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.cleric-doctrine') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Doctrine',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'deity',
                prompt: 'Select a deity.',
                choices: {
                  filter: ['item:type:deity'],
                },
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.deities.Item.sarshallatu') {
        return {
          uuid,
          type: 'deity',
          name: 'Sarshallatu',
          system: {
            domains: {
              primary: ['creation', 'dragon', 'fate', 'time'],
              alternate: ['fate'],
            },
            rules: [],
          },
        };
      }
      return null;
    });

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slot: '__cleric-domain-initiate__',
        featName: 'Domain Initiate',
        sourceName: 'Cleric -> Domain Initiate',
      }),
    ]));
    expect(wizard.data.grantedFeatSections.find((section) => section.slot === '__cleric-domain-initiate__')?.choiceSets?.[0]?.options).toEqual([
      { value: 'creation', label: 'Creation' },
      { value: 'dragon', label: 'Dragon' },
      { value: 'fate', label: 'Fate' },
      { value: 'time', label: 'Time' },
      { value: 'fate', label: 'Fate (apocryphal)' },
    ]);
  });

  it('does not add the synthetic cleric domain section for Warpriest', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.cleric',
      name: 'Cleric',
      slug: 'cleric',
    };
    wizard.data.subclass = {
      uuid: 'Compendium.pf2e.classfeatures.Item.warpriest',
      name: 'Warpriest',
      slug: 'warpriest',
    };
    wizard.data.deity = {
      uuid: 'Compendium.pf2e.deities.Item.sarshallatu',
      name: 'Sarshallatu',
      domains: {
        primary: ['creation', 'dragon', 'fate', 'time'],
        alternate: ['fate'],
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.cleric') {
        return {
          uuid,
          type: 'class',
          system: { rules: [], items: {} },
        };
      }
      if (uuid === 'Compendium.pf2e.deities.Item.sarshallatu') {
        return {
          uuid,
          type: 'deity',
          name: 'Sarshallatu',
          system: {
            domains: {
              primary: ['creation', 'dragon', 'fate', 'time'],
              alternate: ['fate'],
            },
            rules: [],
          },
        };
      }
      return null;
    });

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections.some((section) => section.slot === '__cleric-domain-initiate__')).toBe(false);
  });

  it('does not surface class-feature subclass selectors as feat choice sections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.barbarian',
      name: 'Barbarian',
      slug: 'barbarian',
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.barbarian') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              instinct: {
                uuid: 'Compendium.pf2e.classfeatures.Item.instinct',
                name: 'Instinct',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.instinct') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Instinct',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'instinct',
                prompt: 'Select an instinct.',
                choices: {
                  filter: ['item:tag:barbarian-instinct'],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async () => []);

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual([]);
  });

  it('does not surface handler-managed class choice sections like ikons as feat choice sections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.exemplar',
      name: 'Exemplar',
      slug: 'exemplar',
    };
    wizard.classHandler = {
      getExtraSteps: () => [{ id: 'ikons', label: 'Ikons', visible: () => true }],
      shouldShowSubclassChoices: () => false,
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.exemplar') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              divineSpark: {
                uuid: 'Compendium.pf2e.classfeatures.Item.divine-spark-and-ikons',
                name: 'Divine Spark and Ikons',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.divine-spark-and-ikons') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Divine Spark and Ikons',
          system: {
            rules: [
              { key: 'ChoiceSet', flag: 'firstIkon', prompt: 'Select an ikon.' },
              { key: 'ChoiceSet', flag: 'secondIkon', prompt: 'Select an ikon.' },
              { key: 'ChoiceSet', flag: 'thirdIkon', prompt: 'Select an ikon.' },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async () => []);

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual([]);
  });

  it('does not surface handler-managed deity and sanctification prompts as feat choice sections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.cleric',
      name: 'Cleric',
      slug: 'cleric',
    };
    wizard.classHandler = {
      getExtraSteps: () => [
        { id: 'deity', visible: () => true },
        { id: 'sanctification', visible: () => true },
        { id: 'divineFont', visible: () => true },
      ],
      shouldShowSubclassChoices: () => true,
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.cleric') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              doctrine: {
                uuid: 'Compendium.pf2e.classfeatures.Item.cleric-doctrine',
                name: 'Doctrine',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.cleric-doctrine') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Doctrine',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                prompt: 'Select a deity.',
                choices: {
                  filter: ['item:type:deity'],
                },
              },
              {
                key: 'ChoiceSet',
                prompt: 'Select a sanctification.',
              },
              {
                key: 'ChoiceSet',
                prompt: 'Select a divine font.',
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async () => []);

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual([]);
  });

  it('does not crash on malformed stale subclass-selector rule filters', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = {
      uuid: 'Compendium.pf2e.classes.Item.barbarian',
      name: 'Barbarian',
      slug: 'barbarian',
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classes.Item.barbarian') {
        return {
          uuid,
          type: 'class',
          system: {
            rules: [],
            items: {
              instinct: {
                uuid: 'Compendium.pf2e.classfeatures.Item.instinct',
                name: 'Instinct',
                level: 1,
              },
            },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.instinct') {
        return {
          uuid,
          type: 'classfeature',
          name: 'Instinct',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'instinct',
                prompt: 'Select an instinct.',
                choices: {
                  get filter() {
                    return undefined;
                  },
                },
              },
            ],
          },
        };
      }
      return null;
    });

    await expect(wizard._refreshGrantedFeatChoiceSections()).resolves.toBeUndefined();
  });

  it('surfaces nested choice sets from selected ikons and honors rollOption predicates', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ikons = [
      {
        uuid: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        name: "Barrow's Edge",
        img: 'icons/svg/item-bag.svg',
      },
    ];
    wizard.actor.items = {
      contents: [
        {
          uuid: 'Actor.test.Item.clan-dagger',
          name: 'Clan Dagger',
          img: 'icons/svg/item-bag.svg',
          type: 'weapon',
          slug: 'clan-dagger',
          system: {
            traits: { value: [], otherTags: [], rarity: 'common' },
            level: { value: 0 },
            usage: { value: 'held-in-one-hand' },
            range: null,
            damage: { damageType: 'piercing' },
          },
        },
      ],
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.barrows-edge') {
        return {
          uuid,
          type: 'classfeature',
          name: "Barrow's Edge",
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                prompt: 'Select an origin.',
                rollOption: 'barrows-edge-origin',
                choices: [
                  { value: 'granted', label: 'Granted Weapon' },
                  { value: 'existing', label: 'Existing Weapon' },
                ],
              },
              {
                key: 'ChoiceSet',
                flag: 'existingIkon',
                prompt: 'Select an existing weapon.',
                predicate: ['barrows-edge-origin:existing'],
                choices: {
                  ownedItems: true,
                  types: ['weapon'],
                  filter: [
                    'item:melee',
                    { or: ['item:damage:type:slashing', 'item:damage:type:piercing'] },
                    { not: 'item:trait:consumable' },
                  ],
                },
              },
              {
                key: 'ChoiceSet',
                flag: 'grantedIkon',
                prompt: 'Select a granted weapon.',
                predicate: ['barrows-edge-origin:granted'],
                choices: {
                  itemType: 'weapon',
                  filter: [
                    'item:level:0',
                    'item:melee',
                    { nor: ['item:magical', 'item:trait:consumable'] },
                    { or: ['item:damage:type:slashing', 'item:damage:type:piercing'] },
                  ],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.equipment-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.dagger',
            name: 'Dagger',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'dagger',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'simple',
            usage: 'held-in-one-hand',
            range: null,
            damageTypes: ['piercing'],
            isMagical: false,
          },
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.club',
            name: 'Club',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'club',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'simple',
            usage: 'held-in-one-hand',
            range: null,
            damageTypes: ['bludgeoning'],
            isMagical: false,
          },
        ];
      }
      return [];
    });

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections).toEqual([
      expect.objectContaining({
        slot: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        featName: "Barrow's Edge",
        choiceSets: [
          expect.objectContaining({
            flag: 'barrows-edge-origin',
            prompt: 'Select an origin.',
          }),
        ],
      }),
    ]);

    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.classfeatures.Item.barrows-edge': {
        'barrows-edge-origin': 'granted',
      },
    };

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections[0].choiceSets).toEqual([
      expect.objectContaining({ flag: 'barrows-edge-origin', prompt: 'Select an origin.' }),
      expect.objectContaining({
        flag: 'grantedIkon',
        prompt: 'Select a granted weapon.',
        options: [expect.objectContaining({ label: 'Dagger' })],
      }),
    ]);
  });

  it('treats range objects without a real increment as melee for granted weapon choice filters', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ikons = [
      {
        uuid: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        name: "Barrow's Edge",
        img: 'icons/svg/item-bag.svg',
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.barrows-edge') {
        return {
          uuid,
          type: 'classfeature',
          name: "Barrow's Edge",
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                prompt: 'Select an origin.',
                rollOption: 'barrows-edge-origin',
                choices: [
                  { value: 'granted', label: 'Granted Weapon' },
                ],
              },
              {
                key: 'ChoiceSet',
                flag: 'grantedIkon',
                prompt: 'Select a granted weapon.',
                predicate: ['barrows-edge-origin:granted'],
                choices: {
                  itemType: 'weapon',
                  filter: [
                    'item:level:0',
                    'item:melee',
                    { or: ['item:damage:type:piercing', 'item:damage:type:slashing'] },
                  ],
                },
              },
            ],
          },
        };
      }
      return null;
    });

    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.equipment-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.dagger',
            name: 'Dagger',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'dagger',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'simple',
            usage: 'held-in-one-hand',
            range: { increment: null, max: null },
            damageTypes: ['piercing'],
            isMagical: false,
          },
        ];
      }
      return [];
    });

    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.classfeatures.Item.barrows-edge': {
        'barrows-edge-origin': 'granted',
      },
    };

    await wizard._refreshGrantedFeatChoiceSections();

    expect(wizard.data.grantedFeatSections[0].choiceSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flag: 'grantedIkon',
          options: [expect.objectContaining({ label: 'Dagger' })],
        }),
      ]),
    );
  });

  it('treats range-increment traits as ranged for melee weapon choice filters', async () => {
    const wizard = new CharacterWizard(createMockActor());

    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.equipment-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.arbalest',
            name: 'Arbalest',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'arbalest',
            traits: ['range-increment-110'],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'martial',
            usage: 'held-in-two-hands',
            range: null,
            damageTypes: ['piercing'],
            isMagical: false,
          },
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.adze',
            name: 'Adze',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'adze',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'martial',
            usage: 'held-in-one-hand',
            range: null,
            damageTypes: ['slashing'],
            isMagical: false,
          },
        ];
      }
      return [];
    });

    const reparsed = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'grantedIkon',
        prompt: 'Select a granted weapon.',
        choices: {
          itemType: 'weapon',
          filter: [
            'item:melee',
            { or: ['item:damage:type:piercing', 'item:damage:type:slashing'] },
          ],
        },
      },
    ]);

    expect(reparsed[0].options).toEqual([
      expect.objectContaining({ label: 'Adze' }),
    ]);
  });

  it('treats numeric range values as ranged for melee weapon choice filters', async () => {
    const wizard = new CharacterWizard(createMockActor());

    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.equipment-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.arbalest',
            name: 'Arbalest',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'arbalest',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'martial',
            usage: 'held-in-two-hands',
            range: 110,
            damageTypes: ['piercing'],
            isMagical: false,
          },
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.adze',
            name: 'Adze',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'adze',
            traits: [],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'martial',
            usage: 'held-in-one-hand',
            range: null,
            damageTypes: ['slashing'],
            isMagical: false,
          },
        ];
      }
      return [];
    });

    const reparsed = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'grantedIkon',
        prompt: 'Select a granted weapon.',
        choices: {
          itemType: 'weapon',
          filter: [
            'item:melee',
            { or: ['item:damage:type:piercing', 'item:damage:type:slashing'] },
          ],
        },
      },
    ]);

    expect(reparsed[0].options).toEqual([
      expect.objectContaining({ label: 'Adze' }),
    ]);
  });

  it('keeps thrown melee weapons in melee weapon choice filters', async () => {
    const wizard = new CharacterWizard(createMockActor());

    wizard._loadCompendium = jest.fn(async (packKey) => {
      if (packKey === 'pf2e.equipment-srd') {
        return [
          {
            uuid: 'Compendium.pf2e.equipment-srd.Item.trident',
            name: 'Trident',
            img: 'icons/svg/item-bag.svg',
            type: 'weapon',
            slug: 'trident',
            traits: ['thrown-20'],
            otherTags: [],
            rarity: 'common',
            level: 0,
            category: 'martial',
            usage: 'held-in-one-hand',
            range: 20,
            damageTypes: ['piercing'],
            isMagical: false,
          },
        ];
      }
      return [];
    });

    const reparsed = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'grantedIkon',
        prompt: 'Select a granted weapon.',
        choices: {
          itemType: 'weapon',
          filter: [
            'item:melee',
            'item:damage:type:piercing',
          ],
        },
      },
    ]);

    expect(reparsed[0].options).toEqual([
      expect.objectContaining({ label: 'Trident', isRanged: false }),
    ]);
  });

  it('marks weapon choice sets so the UI can show weapon filters', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        featName: "Barrow's Edge",
        choiceSets: [
          {
            flag: 'grantedIkon',
            prompt: 'Select a granted weapon.',
            options: [
              {
                value: 'Compendium.pf2e.equipment-srd.Item.dagger',
                label: 'Dagger',
                uuid: 'Compendium.pf2e.equipment-srd.Item.dagger',
                img: 'icons/svg/item-bag.svg',
                type: 'weapon',
                category: 'simple',
                range: null,
              },
            ],
          },
        ],
      },
    ];

    const context = await wizard._buildFeatChoicesContext();
    expect(context.featChoiceSections[0].choiceSets[0]).toEqual(expect.objectContaining({
      isWeaponChoice: true,
    }));
    expect(context.featChoiceSections[0].choiceSets[0].options[0]).toEqual(expect.objectContaining({
      category: 'simple',
      range: null,
    }));
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

  it('preserves explicit authored skill choice arrays without expanding them to all skills', async () => {
    const wizard = new CharacterWizard(createMockActor());

    const choiceSets = await wizard._parseChoiceSets([
      {
        key: 'ChoiceSet',
        flag: 'fighterSkill',
        prompt: 'Select a skill.',
        choices: [
          { label: 'PF2E.Skill.Acrobatics', value: 'acrobatics' },
          { label: 'PF2E.Skill.Athletics', value: 'athletics' },
        ],
      },
    ]);

    expect(choiceSets[0].options).toEqual([
      expect.objectContaining({ value: 'acrobatics', label: 'PF2E.Skill.Acrobatics' }),
      expect.objectContaining({ value: 'athletics', label: 'PF2E.Skill.Athletics' }),
    ]);
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

  it('keeps already chosen skills visible in skill choice sets and annotates them', async () => {
    const wizard = new CharacterWizard(createMockActor());
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          arc: 'PF2E.SkillArc',
          med: 'PF2E.SkillMed',
          nat: 'PF2E.SkillNat',
        },
      },
    };

    wizard.data.skills = ['nature'];
    wizard._getClassTrainedSkills = jest.fn(async () => ['arcana']);
    wizard.data.background = { uuid: 'background-uuid', name: 'Background' };
    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid === 'background-uuid') {
        return { system: { trainedSkills: { value: ['medicine'] } } };
      }
      return null;
    });

    try {
      const choiceSets = await wizard._parseChoiceSets([
        {
          key: 'ChoiceSet',
          flag: 'skill',
          prompt: 'Select a skill.',
          choices: { config: 'skills' },
        },
      ]);

      expect(choiceSets[0].options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'acr', label: 'PF2E.SkillAcr' }),
        expect.objectContaining({ value: 'arc', label: 'PF2E.SkillArc', autoTrained: true, autoTrainedSource: 'Class', disabled: true }),
        expect.objectContaining({ value: 'med', label: 'PF2E.SkillMed', autoTrained: true, autoTrainedSource: 'Background', disabled: true }),
        expect.objectContaining({ value: 'nat', label: 'PF2E.SkillNat', selectedInSkills: true, disabled: true }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('hydrates stored skill choice sets with current skill selections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...originalConfig,
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          acr: 'PF2E.SkillAcr',
          ath: 'PF2E.SkillAth',
        },
      },
    };

    wizard.data.skills = ['acrobatics'];
    wizard._getClassTrainedSkills = jest.fn(async () => []);
    wizard._getCachedDocument = jest.fn(async () => null);

    try {
      const hydrated = await wizard._hydrateChoiceSets([
        {
          flag: 'skill',
          prompt: 'Select a skill.',
          options: [
            { value: 'acr', label: 'Acrobatics' },
            { value: 'ath', label: 'Athletics' },
          ],
        },
      ], {});

      expect(hydrated[0].options).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'acr', selectedInSkills: true, disabled: true }),
        expect.objectContaining({ value: 'ath', selectedInSkills: false, disabled: false }),
      ]));
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

  it('includes direct granted feat spell choice prompts in the apply overlay prompt rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.dragon-spit',
        featName: 'Dragon Spit',
        sourceName: 'Skilled Human',
        choiceSets: [
          {
            flag: 'cantrip',
            prompt: 'Make a selection.',
            options: [
              { value: 'electric-arc', label: 'Electric Arc', uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc', type: 'spell' },
            ],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.dragon-spit': {
        cantrip: 'electric-arc',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.dragon-spit') {
        return {
          uuid,
          name: 'Dragon Spit',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'cantrip',
                prompt: 'Make a selection.',
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
        label: 'Skilled Human -> Dragon Spit',
        prompt: 'Make a selection.',
        value: 'Electric Arc',
      }),
    ]);
  });

  it('includes promptless choice sets in the apply overlay prompt rows using a humanized flag fallback', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.apparitions = [
      {
        uuid: 'Compendium.pf2e.classfeatures.Item.animist-seer',
        name: 'Seer',
      },
    ];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.animist-seer') {
        return {
          uuid,
          name: 'Seer',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'animisticPractice',
                choices: {
                  filter: ['item:tag:animistic-practice'],
                  itemType: 'feat',
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
        label: 'Seer',
        prompt: 'Animistic Practice',
        value: 'Pending selection',
        pending: true,
      }),
    ]);
  });

  it('matches granted feat spell choices when the saved selection uses the option UUID', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
        featName: 'Arcane Tattoos',
        sourceName: 'Skilled Human',
        choiceSets: [
          {
            flag: 'cantrip',
            prompt: 'Make a selection.',
            options: [
              {
                value: 'electric-arc',
                label: 'Electric Arc',
                uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc',
                type: 'spell',
              },
            ],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.feats-srd.Item.arcane-tattoos': {
        cantrip: 'Compendium.pf2e.spells-srd.Item.electric-arc',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.arcane-tattoos') {
        return {
          uuid,
          name: 'Arcane Tattoos',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'cantrip',
                prompt: 'Make a selection.',
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.spells-srd.Item.electric-arc') {
        return {
          uuid,
          name: 'Electric Arc',
          type: 'spell',
          system: { rules: [] },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual([
      expect.objectContaining({
        label: 'Skilled Human -> Arcane Tattoos',
        prompt: 'Make a selection.',
        value: 'Electric Arc',
      }),
    ]);
  });

  it('includes nested selected weapon choices in the apply overlay prompt rows', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ikons = [
      {
        uuid: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        name: "Barrow's Edge",
        img: 'icons/svg/item-bag.svg',
      },
    ];
    wizard.data.grantedFeatSections = [
      {
        slot: 'Compendium.pf2e.classfeatures.Item.barrows-edge',
        featName: "Barrow's Edge",
        choiceSets: [
          {
            flag: 'barrows-edge-origin',
            prompt: 'What item will be your ikon?',
            options: [
              { value: 'granted', label: 'Grant me a new item.' },
              { value: 'existing', label: 'Use an existing item in my inventory.' },
            ],
          },
          {
            flag: 'grantedIkon',
            prompt: 'Make a selection.',
            options: [
              {
                value: 'Compendium.pf2e.equipment-srd.Item.adze',
                label: 'Adze',
                uuid: 'Compendium.pf2e.equipment-srd.Item.adze',
              },
            ],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      'Compendium.pf2e.classfeatures.Item.barrows-edge': {
        'barrows-edge-origin': 'granted',
        grantedIkon: 'Compendium.pf2e.equipment-srd.Item.adze',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.barrows-edge') {
        return {
          uuid,
          name: "Barrow's Edge",
          type: 'classfeature',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                rollOption: 'barrows-edge-origin',
                prompt: 'What item will be your ikon?',
                choices: [
                  { value: 'granted', label: 'Grant me a new item.' },
                  { value: 'existing', label: 'Use an existing item in my inventory.' },
                ],
              },
              {
                key: 'ChoiceSet',
                flag: 'grantedIkon',
                prompt: 'Make a selection.',
                predicate: ['barrows-edge-origin:granted'],
                choices: {
                  itemType: 'weapon',
                  filter: ['item:melee'],
                },
              },
            ],
          },
        };
      }
      if (uuid === 'Compendium.pf2e.equipment-srd.Item.adze') {
        return {
          uuid,
          name: 'Adze',
          type: 'weapon',
          system: {
            rules: [],
          },
        };
      }
      return null;
    });

    const rows = await wizard._getApplyPromptRows();
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Barrow's Edge",
        prompt: 'What item will be your ikon?',
        value: 'Grant me a new item.',
      }),
      expect.objectContaining({
        label: "Barrow's Edge",
        prompt: 'Make a selection.',
        value: 'Adze',
      }),
    ]));
  });

  it('preserves saved granted feat choices when feat sections are rebuilt on reopen', async () => {
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
                choices: [
                  { value: 'dwarf', label: 'Dwarf', uuid: 'Compendium.pf2e.ancestries.Item.dwarf' },
                  { value: 'elf', label: 'Elf', uuid: 'Compendium.pf2e.ancestries.Item.elf' },
                ],
              },
            ],
          },
        };
      }
      return null;
    });

    await wizard._refreshGrantedFeatChoiceSections();
    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections[0].choiceSets[0]).toEqual(expect.objectContaining({
      hasSelection: true,
    }));
    expect(context.featChoiceSections[0].choiceSets[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Dwarf', selected: true }),
      expect.objectContaining({ label: 'Elf', selected: false }),
    ]));
  });

  it('preserves saved ancestry feat choices when choice sets are rebuilt on reopen', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestryFeat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.natural-ambition',
      name: 'Natural Ambition',
      choiceSets: [],
      choices: {
        grantedClassFeat: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.natural-ambition') {
        return {
          uuid,
          name: 'Natural Ambition',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantedClassFeat',
                prompt: 'Choose a class feat.',
                choices: [
                  { value: 'Compendium.pf2e.feats-srd.Item.reactive-shield', label: 'Reactive Shield' },
                  { value: 'Compendium.pf2e.feats-srd.Item.power-attack', label: 'Power Attack' },
                ],
              },
            ],
          },
        };
      }
      return null;
    });

    await wizard._refreshAllFeatChoiceData();
    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections[0].choiceSets[0]).toEqual(expect.objectContaining({
      hasSelection: true,
    }));
    expect(context.featChoiceSections[0].choiceSets[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Reactive Shield', selected: true }),
      expect.objectContaining({ label: 'Power Attack', selected: false }),
    ]));
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

  it('resolves feat choice section titles from the feat document when saved data contains the uuid', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.classFeat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.voice-of-nature',
      name: 'Compendium.pf2e.feats-srd.Item.voice-of-nature',
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
      if (uuid === 'Compendium.pf2e.feats-srd.Item.voice-of-nature') {
        return {
          uuid,
          name: 'Voice of Nature',
          system: { rules: [] },
        };
      }
      return null;
    });

    const context = await wizard._buildFeatChoicesContext();

    expect(context.featChoiceSections[0]).toEqual(expect.objectContaining({
      featName: 'Voice of Nature',
    }));
  });

  it('uses the resolved item name for feat choice option labels when the raw label is a compendium uuid', async () => {
    const wizard = new CharacterWizard(createMockActor());

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.cg816q76S5otM7yD') {
        return {
          uuid,
          name: 'Animal Empathy',
          img: 'icons/animal-empathy.webp',
          type: 'feat',
          system: {
            traits: { value: ['druid'], rarity: 'common' },
            description: { value: '<p>You have a connection to the creatures of the natural world.</p>' },
          },
        };
      }
      return null;
    });

    const hydrated = await wizard._hydrateChoiceSets([
      {
        flag: 'grantedClassFeat',
        prompt: 'Choose a class feat.',
        options: [
          {
            value: 'Compendium.pf2e.feats-srd.Item.cg816q76S5otM7yD',
            label: 'Compendium.pf2e.feats-srd.Item.cg816q76S5otM7yD',
          },
        ],
      },
    ], {});

    expect(hydrated[0].options[0]).toEqual(expect.objectContaining({
      label: 'Animal Empathy',
    }));
  });

  it('does not surface granted feat choice sections when the grant preselects the only choice', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.background = {
      uuid: 'background-abadar-avenger',
      name: "Abadar's Avenger",
    };

    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid === 'background-abadar-avenger') {
        return {
          uuid,
          name: "Abadar's Avenger",
          type: 'background',
          system: {
            rules: [
              {
                key: 'GrantItem',
                uuid: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
                preselectChoices: {
                  skill: 'religion',
                },
              },
            ],
          },
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0') {
        return {
          uuid,
          name: 'Assurance',
          type: 'feat',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'skill',
                prompt: 'Select a skill',
                choices: { config: 'skills' },
              },
            ],
          },
        };
      }

      return null;
    });

    await wizard._refreshGrantedFeatChoiceSections();
    const pending = await wizard._getPendingChoices();

    expect(wizard.data.grantedFeatSections).toEqual([]);
    expect(pending.some((entry) => entry.prompt === 'Select a skill')).toBe(false);
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

  it('maps cleric deity and sanctification prompts to wizard selections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'cleric', name: 'Cleric' };
    wizard.data.deity = { name: 'Sarenrae' };
    wizard.data.sanctification = 'holy';

    const deityValue = await wizard._resolvePromptSelectionLabel({
      prompt: 'Select a deity.',
      choices: {
        filter: ['item:type:deity'],
      },
    });

    const sanctificationValue = await wizard._resolvePromptSelectionLabel({
      prompt: 'Select a sanctification.',
    });

    expect(deityValue).toBe('Sarenrae');
    expect(sanctificationValue).toBe('Holy');
  });

  it('maps localized cleric deity and sanctification prompt keys to wizard selections', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'cleric', name: 'Cleric' };
    wizard.data.deity = { name: 'Sarshallatu' };
    wizard.data.sanctification = 'holy';

    const originalHas = game.i18n.has;
    const originalLocalize = game.i18n.localize;
    game.i18n.has = jest.fn((key) => [
      'PF2E.Actor.Creature.Deity.Prompt',
      'PF2E.Actor.Character.Sanctification.Prompt',
    ].includes(key));
    game.i18n.localize = jest.fn((key) => {
      if (key === 'PF2E.Actor.Creature.Deity.Prompt') return 'Select a deity.';
      if (key === 'PF2E.Actor.Character.Sanctification.Prompt') return 'Select a sanctification.';
      return key;
    });

    const deityValue = await wizard._resolvePromptSelectionLabel({
      prompt: 'PF2E.Actor.Creature.Deity.Prompt',
      choices: {
        filter: ['item:type:deity'],
      },
    });

    const sanctificationValue = await wizard._resolvePromptSelectionLabel({
      prompt: 'PF2E.Actor.Character.Sanctification.Prompt',
      flag: 'sanctification',
    });

    game.i18n.has = originalHas;
    game.i18n.localize = originalLocalize;

    expect(deityValue).toBe('Sarshallatu');
    expect(sanctificationValue).toBe('Holy');
  });

  it('synthesizes a replacement skill choice for Elven Lore when a granted skill is already trained', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          arcana: 'Arcana',
          nature: 'Nature',
          athletics: 'Athletics',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['arcana'];

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.elven-lore',
      name: 'Elven Lore',
      system: {
        description: {
          value: `
            <p>You gain the trained proficiency rank in Arcana and Nature.
            If you would automatically become trained in one of those skills,
            you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.arcana.rank', value: 1 },
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.nature.rank', value: 1 },
        ],
      },
    };

    try {
      const sets = await wizard._parseChoiceSets(feat.system.rules, {}, feat);
      const fallbackSet = sets.find((entry) => entry.flag === 'levelerSkillFallback1');

      expect(sets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerSkillFallback1',
          prompt: 'Select a skill.',
          grantsSkillTraining: true,
        }),
      ]));
      expect(fallbackSet.options.find((entry) => entry.value === 'nature')).toEqual(expect.objectContaining({
        autoTrained: true,
        autoTrainedSource: 'Elven Lore',
        disabled: true,
      }));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('uses the same fallback wording regex for other ancestry lore feats with different granted skills', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          crafting: 'Crafting',
          survival: 'Survival',
          athletics: 'Athletics',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['crafting'];

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.dwarven-lore',
      name: 'Dwarven Lore',
      system: {
        description: {
          value: `
            <p>You gain the trained proficiency rank in Crafting and Survival.
            If you would automatically become trained in one of those skills (from your background or class, for example),
            you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.crafting.rank', value: 1 },
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.survival.rank', value: 1 },
        ],
      },
    };

    try {
      const sets = await wizard._parseChoiceSets(feat.system.rules, {}, feat);

      expect(sets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerSkillFallback1',
          prompt: 'Select a skill.',
          grantsSkillTraining: true,
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('creates one fallback skill choice per overlapping granted lore skill', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          arcana: 'Arcana',
          nature: 'Nature',
          athletics: 'Athletics',
          society: 'Society',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['arcana', 'nature'];

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.elven-lore',
      name: 'Elven Lore',
      system: {
        description: {
          value: `
            <p>You gain the trained proficiency rank in Arcana and Nature.
            If you would automatically become trained in one of those skills (from your background or class, for example),
            you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.arcana.rank', value: 1 },
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.nature.rank', value: 1 },
        ],
      },
    };

    try {
      const sets = await wizard._parseChoiceSets(feat.system.rules, {}, feat);
      const fallbackSets = sets.filter((entry) => entry.syntheticType === 'skill-training-fallback');

      expect(fallbackSets).toHaveLength(2);
      expect(fallbackSets.map((entry) => entry.flag)).toEqual(['levelerSkillFallback1', 'levelerSkillFallback2']);
      expect(fallbackSets.every((entry) => entry.grantsSkillTraining === true)).toBe(true);
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('supports dedication wording that grants one fallback skill choice per already-trained granted skill', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          occultism: 'Occultism',
          performance: 'Performance',
          diplomacy: 'Diplomacy',
          deception: 'Deception',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['occultism', 'performance'];

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.bard-dedication',
      name: 'Bard Dedication',
      system: {
        description: {
          value: `
            <p>You become trained in Occultism and Performance; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.occultism.rank', value: 1 },
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.performance.rank', value: 1 },
        ],
      },
    };

    try {
      const sets = await wizard._parseChoiceSets(feat.system.rules, {}, feat);
      const fallbackSets = sets.filter((entry) => entry.syntheticType === 'skill-training-fallback');

      expect(fallbackSets).toHaveLength(2);
      expect(fallbackSets.map((entry) => entry.flag)).toEqual(['levelerSkillFallback1', 'levelerSkillFallback2']);
      expect(fallbackSets.every((entry) => entry.grantsSkillTraining === true)).toBe(true);
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('supports deity-associated dedication skill fallback wording after a feat-owned deity is selected', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          religion: 'Religion',
          society: 'Society',
          diplomacy: 'Diplomacy',
          deception: 'Deception',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['religion', 'society'];
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.deities.Item.abadar') {
        return {
          uuid,
          type: 'deity',
          name: 'Abadar',
          system: {
            skill: 'society',
          },
        };
      }
      return null;
    });

    const feat = {
      uuid: 'Compendium.pf2e.feats-srd.Item.champion-dedication',
      name: 'Champion Dedication',
      system: {
        description: {
          value: `
            <p>You become trained in Religion and your deity's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>
          `,
        },
        rules: [
          {
            key: 'ChoiceSet',
            flag: 'deity',
            prompt: 'Select a deity.',
            choices: {
              filter: ['item:type:deity'],
            },
          },
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.religion.rank', value: 1 },
        ],
      },
    };

    try {
      const sets = await wizard._parseChoiceSets(feat.system.rules, { deity: 'Compendium.pf2e.deities.Item.abadar' }, feat);
      const fallbackSets = sets.filter((entry) => entry.syntheticType === 'skill-training-fallback');

      expect(fallbackSets).toHaveLength(2);
      expect(fallbackSets.map((entry) => entry.flag)).toEqual(['levelerSkillFallback1', 'levelerSkillFallback2']);
      expect(fallbackSets.every((entry) => entry.grantsSkillTraining === true)).toBe(true);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('keeps remaining lore fallback skill prompts filtered after one fallback choice is selected', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          arcana: 'Arcana',
          nature: 'Nature',
          athletics: 'Athletics',
          diplomacy: 'Diplomacy',
          occultism: 'Occultism',
          stealth: 'Stealth',
          survival: 'Survival',
        },
      },
    };

    const wizard = new CharacterWizard(createMockActor());
    wizard.data.skills = ['arcana', 'nature', 'occultism', 'stealth'];
    wizard._getClassTrainedSkills = jest.fn(async () => ['athletics']);

    try {
      const hydrated = await wizard._hydrateChoiceSets([
        {
          flag: 'levelerSkillFallback1',
          prompt: 'Select a skill.',
          syntheticType: 'skill-training-fallback',
          grantsSkillTraining: true,
          blockedSkills: ['nature'],
          sourceName: 'Elven Lore',
          options: [
            { value: 'arcana', label: 'Arcana' },
            { value: 'nature', label: 'Nature' },
            { value: 'athletics', label: 'Athletics' },
            { value: 'diplomacy', label: 'Diplomacy' },
            { value: 'occultism', label: 'Occultism' },
            { value: 'stealth', label: 'Stealth' },
            { value: 'survival', label: 'Survival' },
          ],
        },
        {
          flag: 'levelerSkillFallback2',
          prompt: 'Select a skill.',
          syntheticType: 'skill-training-fallback',
          grantsSkillTraining: true,
          blockedSkills: ['arcana'],
          sourceName: 'Elven Lore',
          options: [
            { value: 'arcana', label: 'Arcana' },
            { value: 'nature', label: 'Nature' },
            { value: 'athletics', label: 'Athletics' },
            { value: 'diplomacy', label: 'Diplomacy' },
            { value: 'occultism', label: 'Occultism' },
            { value: 'stealth', label: 'Stealth' },
            { value: 'survival', label: 'Survival' },
          ],
        },
      ], {
        levelerSkillFallback1: 'diplomacy',
      });

      const secondPrompt = hydrated.find((entry) => entry.flag === 'levelerSkillFallback2');

      expect(secondPrompt.options.find((entry) => entry.value === 'diplomacy')).toBeUndefined();
      expect(secondPrompt.options.find((entry) => entry.value === 'arcana')).toEqual(expect.objectContaining({
        selectedInSkills: true,
        disabled: true,
      }));
      expect(secondPrompt.options.find((entry) => entry.value === 'nature')).toEqual(expect.objectContaining({
        selectedInSkills: true,
        disabled: true,
      }));
      expect(secondPrompt.options.find((entry) => entry.value === 'athletics')).toEqual(expect.objectContaining({
        autoTrained: true,
        autoTrainedSource: 'Class',
        disabled: true,
      }));
      expect(secondPrompt.options.find((entry) => entry.value === 'occultism')).toEqual(expect.objectContaining({
        selectedInSkills: true,
        disabled: true,
      }));
      expect(secondPrompt.options.find((entry) => entry.value === 'survival')).toEqual(expect.objectContaining({
        disabled: false,
      }));

      const firstPrompt = hydrated.find((entry) => entry.flag === 'levelerSkillFallback1');
      expect(firstPrompt.options.find((entry) => entry.value === 'arcana')).toEqual(expect.objectContaining({
        disabled: true,
      }));
      expect(firstPrompt.options.find((entry) => entry.value === 'athletics')).toEqual(expect.objectContaining({
        disabled: true,
      }));
      expect(firstPrompt.options.find((entry) => entry.value === 'occultism')).toEqual(expect.objectContaining({
        disabled: true,
      }));
      expect(firstPrompt.options.find((entry) => entry.value === 'diplomacy')).toEqual(expect.objectContaining({
        selected: true,
        disabled: false,
      }));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('includes synthetic granted feat choice sections in the apply overlay prompt list', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'cleric', name: 'Cleric' };
    wizard.data.grantedFeatSections = [
      {
        slot: '__cleric-domain-initiate__',
        featName: 'Domain Initiate',
        sourceName: 'Cleric -> Domain Initiate',
        choiceSets: [
          {
            key: 'ChoiceSet',
            flag: 'domainInitiate',
            prompt: "Select a deity's domain.",
            options: [
              { value: 'cities', label: 'Cities' },
              { value: 'earth', label: 'Earth' },
            ],
          },
        ],
      },
    ];
    wizard.data.grantedFeatChoices = {
      '__cleric-domain-initiate__': {
        domainInitiate: 'earth',
      },
    };

    const rows = await wizard._getApplyPromptRows();

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Cleric -> Domain Initiate -> Domain Initiate',
        prompt: "Select a deity's domain.",
        value: 'Earth',
      }),
    ]));
  });

  it('maps sanctification prompts when the raw prompt key only contains sanctification text', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { slug: 'cleric', name: 'Cleric' };
    wizard.data.sanctification = 'holy';

    const sanctificationValue = await wizard._resolvePromptSelectionLabel({
      prompt: 'PF2E.Actor.Character.Sanctification',
    });

    expect(sanctificationValue).toBe('Holy');
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
