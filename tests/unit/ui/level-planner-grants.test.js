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
});
