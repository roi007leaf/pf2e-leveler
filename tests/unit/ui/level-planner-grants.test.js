import { buildFeatGrantPreview, buildLevelContext } from '../../../scripts/ui/level-planner/level-context.js';
import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { WIZARD } from '../../../scripts/classes/wizard.js';

beforeAll(() => {
  if (!ClassRegistry.get('alchemist')) ClassRegistry.register(ALCHEMIST);
  if (!ClassRegistry.get('wizard')) ClassRegistry.register(WIZARD);
});

describe('level planner grant previews', () => {
  test('collects nested granted items and unresolved granted-item choices', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Root Feat',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'feat-granted' },
            ],
          },
        };
      }

      if (uuid === 'feat-granted') {
        return {
          uuid,
          name: 'Granted Feat',
          img: 'icons/svg/mystery-man.svg',
          system: {
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantChoice',
                prompt: 'Select a grant.',
                choices: [
                  { value: 'alpha', label: 'Alpha' },
                  { value: 'beta', label: 'Beta' },
                ],
              },
              { key: 'GrantItem', uuid: 'spell-granted' },
            ],
          },
        };
      }

      if (uuid === 'spell-granted') {
        return {
          uuid,
          name: 'Granted Spell',
          img: 'icons/svg/mystery-man.svg',
          system: { rules: [] },
        };
      }

      return null;
    });

    const preview = await buildFeatGrantPreview({
      actor: { items: [] },
    }, {
      uuid: 'feat-root',
      choices: {},
    });

    expect(preview.grantedItems.map((entry) => entry.name)).toEqual(['Granted Feat', 'Granted Spell']);
    expect(preview.grantChoiceSets).toEqual([
      expect.objectContaining({
        flag: 'grantChoice',
        sourceName: 'Granted Feat',
      }),
    ]);
  });

  test('resolves dynamic grant uuids from stored feat choices', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Root Feat',
          system: {
            rules: [
              {
                key: 'GrantItem',
                uuid: '{item|flags.pf2e.rulesSelections.granted}',
              },
            ],
          },
        };
      }

      if (uuid === 'feat-choice-result') {
        return {
          uuid,
          name: 'Chosen Grant',
          system: { rules: [] },
        };
      }

      return null;
    });

    const preview = await buildFeatGrantPreview({
      actor: { items: [] },
    }, {
      uuid: 'feat-root',
      choices: {
        granted: 'feat-choice-result',
      },
    });

    expect(preview.grantedItems).toEqual([
      expect.objectContaining({ uuid: 'feat-choice-result', name: 'Chosen Grant' }),
    ]);
  });

  test('includes synthetic skill fallback choice sets for granted feats with overlap prose', async () => {
    const originalConfig = global.CONFIG;
    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          athletics: 'Athletics',
          acrobatics: 'Acrobatics',
          diplomacy: 'Diplomacy',
        },
      },
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Root Feat',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'feat-granted' },
            ],
          },
        };
      }

      if (uuid === 'feat-granted') {
        return {
          uuid,
          name: 'Fighter Dedication',
          system: {
            description: {
              value: '<p>You become trained in Acrobatics or Athletics. If you were already trained in both, you become trained in a skill of your choice.</p>',
            },
            rules: [
              { key: 'ActiveEffectLike', path: 'system.skills.acrobatics.rank', value: 1 },
              { key: 'ActiveEffectLike', path: 'system.skills.athletics.rank', value: 1 },
            ],
          },
        };
      }

      return null;
    });

    try {
      const preview = await buildFeatGrantPreview({
        actor: {
          system: {
            skills: {
              acrobatics: { rank: 1 },
              athletics: { rank: 1 },
              diplomacy: { rank: 0 },
            },
          },
          items: [],
        },
        plan: { levels: {} },
        selectedLevel: 2,
      }, {
        uuid: 'feat-root',
        choices: {},
      });

      expect(preview.grantChoiceSets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          flag: 'levelerSkillFallback1',
          sourceName: 'Fighter Dedication',
        }),
        expect.objectContaining({
          flag: 'levelerSkillFallback2',
          sourceName: 'Fighter Dedication',
        }),
      ]));
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  test('includes dedication fallback choice sets for granted feats when no raw choice set exists', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Root Feat',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'feat-granted' },
            ],
          },
        };
      }

      if (uuid === 'feat-granted') {
        return {
          uuid,
          slug: 'advanced-maneuver',
          name: 'Advanced Maneuver',
          system: {
            traits: { value: ['archetype', 'fighter'] },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantedFeat',
                prompt: 'Select a fighter feat.',
                choices: {
                  itemType: 'feat',
                  filter: ['item:tag:fighter', { not: 'item:tag:class-archetype' }],
                },
              },
            ],
          },
        };
      }

      return null;
    });

    const preview = await buildFeatGrantPreview({
      actor: { items: [] },
      plan: { levels: {} },
      selectedLevel: 8,
      _compendiumCache: {
        'category-classFeatures': [],
        'category-feats': [
          { uuid: 'fighter-feat-1', name: 'Combat Grab', type: 'feat', otherTags: ['fighter'], traits: ['fighter'], rarity: 'common' },
          { uuid: 'fighter-feat-2', name: 'Certain Strike', type: 'feat', otherTags: ['fighter'], traits: ['fighter'], rarity: 'common' },
        ],
      },
    }, {
      uuid: 'feat-root',
      choices: {},
    });

    expect(preview.grantChoiceSets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        flag: 'grantedFeat',
        sourceName: 'Advanced Maneuver',
      }),
    ]));
  });

  test('does not crash when granted dedication choice filters are not JSON-serializable strings', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Root Feat',
          system: {
            rules: [
              { key: 'GrantItem', uuid: 'feat-granted' },
            ],
          },
        };
      }

      if (uuid === 'feat-granted') {
        return {
          uuid,
          slug: 'advanced-maneuver',
          name: 'Advanced Maneuver',
          system: {
            traits: { value: ['archetype', 'fighter'] },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'grantedFeat',
                prompt: 'Select a fighter feat.',
                choices: {
                  filter: () => ['item:tag:fighter'],
                },
              },
            ],
          },
        };
      }

      return null;
    });

    const preview = await buildFeatGrantPreview({
      actor: { items: [] },
      plan: { levels: {} },
      selectedLevel: 8,
      _compendiumCache: {
        'category-classFeatures': [],
        'category-feats': [],
      },
    }, {
      uuid: 'feat-root',
      choices: {},
    });

    expect(preview).toEqual({
      grantedItems: [
        expect.objectContaining({ uuid: 'feat-granted', name: 'Advanced Maneuver' }),
      ],
      grantChoiceSets: [],
    });
  });

  test('attaches detected grant requirements and completion to enriched planner feats', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-formulas') {
        return {
          uuid,
          name: 'Formula Feat',
          system: {
            description: {
              value: '<p>You gain formulas for two common alchemical items of 1st level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    const planner = {
      actor,
      selectedLevel: 2,
      plan: {
        classSlug: 'alchemist',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-formulas', name: 'Formula Feat', slug: 'formula-feat' }],
            skillFeats: [{ uuid: 'skill-feat', name: 'Skill Feat', slug: 'skill-feat' }],
            featGrants: [],
          },
        },
      },
      _compendiumCache: {},
      _buildAttributeContext: jest.fn(() => ({})),
      _buildIntelligenceBenefitContext: jest.fn(() => ({})),
      _buildIntBonusSkillContext: jest.fn(() => []),
      _buildIntBonusLanguageContext: jest.fn(() => []),
      _shouldHideHistoricalSkillIncrease: jest.fn(() => false),
      _buildSkillContext: jest.fn(() => []),
      _buildSpellContext: jest.fn(async () => ({ showSpells: false })),
      _isCustomPlanOpen: jest.fn(() => false),
    };

    const context = await buildLevelContext(planner, ALCHEMIST, {});

    expect(context.classFeat.grantRequirements).toEqual([
      expect.objectContaining({
        kind: 'formula',
        count: 2,
        selectedCount: 0,
        missingCount: 2,
        complete: false,
      }),
    ]);
    expect(context.classFeat.grantChoiceSets ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ syntheticType: 'formula-choice' }),
    ]));
    expect(context.grantRequirements).toEqual([
      expect.objectContaining({
        id: 'class:alchemist:formula-book-level-2-formula',
        sourceFeatName: 'Formula Book',
        kind: 'formula',
        count: 2,
      }),
    ]);
  });

  test('surfaces formula progression grants from earlier planned feats', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-cauldron') {
        return {
          uuid,
          name: 'Cauldron',
          system: {
            description: {
              value: '<p>You immediately gain the formulas for four common 1st-level oils or potions. At 4th level and every 2 levels beyond that, you gain the formula for a common oil or potion of that level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    const planner = {
      actor,
      selectedLevel: 4,
      plan: {
        classSlug: 'alchemist',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-cauldron', name: 'Cauldron', slug: 'cauldron' }],
          },
          4: {
            featGrants: [],
          },
        },
      },
      _compendiumCache: {},
      _buildAttributeContext: jest.fn(() => ({})),
      _buildIntelligenceBenefitContext: jest.fn(() => ({})),
      _buildIntBonusSkillContext: jest.fn(() => []),
      _buildIntBonusLanguageContext: jest.fn(() => []),
      _shouldHideHistoricalSkillIncrease: jest.fn(() => false),
      _buildSkillContext: jest.fn(() => []),
      _buildSpellContext: jest.fn(async () => ({ showSpells: false })),
      _isCustomPlanOpen: jest.fn(() => false),
    };

    const context = await buildLevelContext(planner, ALCHEMIST, {});

    expect(context.grantRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'feat-cauldron:cauldron-level-4-formula',
        sourceFeatName: 'Cauldron',
        count: 1,
        missingCount: 1,
        filters: expect.objectContaining({ maxLevel: 4, traits: ['oil', 'potion'] }),
      }),
    ]));
  });

  test('opens grant picker after resolving requirements from source feat text', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-formulas') {
        return {
          uuid,
          name: 'Formula Feat',
          system: {
            description: {
              value: '<p>You gain formulas for two common alchemical items of 1st level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(async () => {});
    actor.unsetFlag = jest.fn(async () => {});
    const planner = new LevelPlanner(actor);
    planner.plan = {
      classSlug: 'alchemist',
      levels: {
        2: {
          classFeats: [{ uuid: 'feat-formulas', name: 'Formula Feat', slug: 'formula-feat' }],
          featGrants: [],
        },
      },
    };
    planner.selectedLevel = 2;
    planner._openFeatGrantItemPicker = jest.fn(async () => {});

    await planner._openFeatGrantPicker('feat-formulas:formula');

    expect(planner._openFeatGrantItemPicker).toHaveBeenCalledWith(expect.objectContaining({
      id: 'feat-formulas:formula',
      kind: 'formula',
      count: 2,
    }));
  });

  test('keeps detected formula filters when stored grant was manually configured', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-formulas') {
        return {
          uuid,
          name: 'Formula Feat',
          system: {
            description: {
              value: '<p>You gain formulas for two common alchemical items of 1st level or lower.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(async () => {});
    actor.unsetFlag = jest.fn(async () => {});
    const planner = new LevelPlanner(actor);
    planner.plan = {
      classSlug: 'alchemist',
      levels: {
        2: {
          classFeats: [{ uuid: 'feat-formulas', name: 'Formula Feat', slug: 'formula-feat' }],
          featGrants: [{
            requirementId: 'feat-formulas:formula',
            sourceFeatUuid: 'feat-formulas',
            sourceFeatName: 'Formula Feat',
            kind: 'formula',
            manual: { count: 2, filters: {} },
            selections: [],
          }],
        },
      },
    };
    planner.selectedLevel = 2;

    const requirement = await planner._getFeatGrantRequirement('feat-formulas:formula');

    expect(requirement).toEqual(expect.objectContaining({
      confidence: 'manual',
      filters: expect.objectContaining({
        maxLevel: 1,
        rarity: ['common'],
        traits: ['alchemical'],
      }),
    }));
  });

  test('opens planner class formula book grant picker', async () => {
    global.fromUuid = jest.fn(async () => null);
    const actor = createMockActor({ items: [] });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(async () => {});
    actor.unsetFlag = jest.fn(async () => {});
    const planner = new LevelPlanner(actor);
    planner.plan = {
      classSlug: 'alchemist',
      levels: {
        2: {
          featGrants: [],
        },
      },
    };
    planner.selectedLevel = 2;
    planner._openFeatGrantItemPicker = jest.fn(async () => {});

    await planner._openFeatGrantPicker('class:alchemist:formula-book-level-2-formula');

    expect(planner._openFeatGrantItemPicker).toHaveBeenCalledWith(expect.objectContaining({
      id: 'class:alchemist:formula-book-level-2-formula',
      sourceFeatName: 'Formula Book',
      kind: 'formula',
      count: 2,
    }));
  });

  test('collects already taken formula grant selections through selected planner level', () => {
    const actor = createMockActor({ items: [] });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn(async () => {});
    actor.unsetFlag = jest.fn(async () => {});
    const planner = new LevelPlanner(actor);
    planner.selectedLevel = 2;
    planner.plan = {
      classSlug: 'alchemist',
      levels: {
        1: {
          featGrants: [{
            requirementId: 'level-1-formulas',
            kind: 'formula',
            selections: [{ uuid: 'item-a', name: 'Acid Flask' }],
          }],
        },
        2: {
          featGrants: [
            {
              requirementId: 'level-2-formulas',
              kind: 'formula',
              selections: [{ uuid: 'item-b', name: 'Alchemist Fire' }],
            },
            {
              requirementId: 'level-2-items',
              kind: 'item',
              selections: [{ uuid: 'item-c', name: 'Backpack' }],
            },
          ],
        },
        3: {
          featGrants: [{
            requirementId: 'future-formulas',
            kind: 'formula',
            selections: [{ uuid: 'item-d', name: 'Bottled Lightning' }],
          }],
        },
      },
    };

    expect(planner._getTakenFormulaGrantSelections()).toEqual([
      { uuid: 'item-a', name: 'Acid Flask' },
      { uuid: 'item-b', name: 'Alchemist Fire' },
    ]);
  });

  test('wizard dedication exposes school choice and cantrip spell grant filters', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-wizard-dedication') {
        return {
          uuid,
          name: 'Wizard Dedication',
          slug: 'wizard-dedication',
          system: {
            description: {
              value: '<p>You gain a spellbook with four common arcane cantrips of your choice. Select a school.</p>',
            },
            rules: [],
            traits: { value: ['archetype', 'dedication', 'multiclass', 'wizard'] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    const planner = {
      actor,
      selectedLevel: 2,
      plan: {
        classSlug: 'wizard',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-wizard-dedication', name: 'Wizard Dedication', slug: 'wizard-dedication' }],
            featGrants: [],
          },
        },
      },
      _compendiumCache: {
        'category-classFeatures': [
          {
            uuid: 'school-battle',
            name: 'School of Battle Magic',
            img: 'school.webp',
            otherTags: ['wizard-arcane-school'],
            rarity: 'common',
          },
        ],
      },
      _buildAttributeContext: jest.fn(() => ({})),
      _buildIntelligenceBenefitContext: jest.fn(() => ({})),
      _buildIntBonusSkillContext: jest.fn(() => []),
      _buildIntBonusLanguageContext: jest.fn(() => []),
      _shouldHideHistoricalSkillIncrease: jest.fn(() => false),
      _buildSkillContext: jest.fn(() => []),
      _buildSpellContext: jest.fn(async () => ({ showSpells: false })),
      _isCustomPlanOpen: jest.fn(() => false),
    };

    const context = await buildLevelContext(planner, WIZARD, {});

    expect(context.classFeatChoiceSets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        syntheticType: 'dedication-subclass-choice',
        prompt: 'Select a School.',
        options: [expect.objectContaining({ value: 'school-battle', label: 'School of Battle Magic' })],
      }),
    ]));
    expect(context.classFeat.grantRequirements).toEqual([
      expect.objectContaining({
        kind: 'spell',
        count: 4,
        filters: expect.objectContaining({ rank: 0, tradition: 'arcane' }),
      }),
    ]);
  });

  test('does not duplicate spellbook cantrip expansion picks as feat grant choices', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-cantrip-expansion') {
        return {
          uuid,
          name: 'Cantrip Expansion',
          slug: 'cantrip-expansion',
          system: {
            description: {
              value: '<p>You add two common arcane cantrips of your choice to your spellbook.</p>',
            },
            rules: [],
            traits: { value: [] },
          },
        };
      }
      return null;
    });

    const actor = createMockActor({ items: [] });
    const planner = {
      actor,
      selectedLevel: 2,
      plan: {
        classSlug: 'wizard',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-cantrip-expansion', name: 'Cantrip Expansion', slug: 'cantrip-expansion' }],
            featGrants: [],
            spells: [
              { uuid: 'spell-acid-splash', name: 'Acid Splash', rank: 0, isCantrip: true },
              { uuid: 'spell-allegro', name: 'Allegro', rank: 0, isCantrip: true },
            ],
          },
        },
      },
      _compendiumCache: {},
      _buildAttributeContext: jest.fn(() => ({})),
      _buildIntelligenceBenefitContext: jest.fn(() => ({})),
      _buildIntBonusSkillContext: jest.fn(() => []),
      _buildIntBonusLanguageContext: jest.fn(() => []),
      _shouldHideHistoricalSkillIncrease: jest.fn(() => false),
      _buildSkillContext: jest.fn(() => []),
      _buildSpellContext: jest.fn(async () => ({ showSpells: false })),
      _isCustomPlanOpen: jest.fn(() => false),
    };

    const context = await buildLevelContext(planner, WIZARD, {});

    expect(context.classFeat.grantRequirements).toEqual([]);
  });
});
