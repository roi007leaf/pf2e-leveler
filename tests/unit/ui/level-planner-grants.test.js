import { buildFeatGrantPreview } from '../../../scripts/ui/level-planner/level-context.js';

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
});
