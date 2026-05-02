import { applyClassFeatureChoices } from '../../../scripts/apply/apply-class-feature-choices.js';

describe('applyClassFeatureChoices', () => {
  test('writes planned class feature choices to owned feature rulesSelections', async () => {
    const actor = {
      items: [{
        id: 'feature-1',
        type: 'classfeature',
        name: 'Blessing of the Devoted',
        slug: 'blessing-of-the-devoted',
        flags: { pf2e: { rulesSelections: { old: 'keep' } } },
        system: { level: { value: 3, taken: 3 } },
      }],
      updateEmbeddedDocuments: jest.fn(async () => []),
    };
    const plan = {
      levels: {
        3: {
          classFeatureChoices: {
            'blessing-of-the-devoted': {
              blessing: {
                value: 'Compendium.pf2e.classfeatures.Item.blessing-swiftness',
                label: 'Blessing of Swiftness',
                slug: 'blessing-of-swiftness',
              },
            },
          },
        },
      },
    };

    const applied = await applyClassFeatureChoices(actor, plan, 3);

    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      _id: 'feature-1',
      'flags.pf2e.rulesSelections': {
        old: 'keep',
        blessing: 'Compendium.pf2e.classfeatures.Item.blessing-swiftness',
      },
    }]);
    expect(applied).toEqual([{
      uuid: 'blessing-of-the-devoted',
      name: 'Blessing of the Devoted',
      choices: {
        blessing: 'Compendium.pf2e.classfeatures.Item.blessing-swiftness',
      },
    }]);
  });
});
