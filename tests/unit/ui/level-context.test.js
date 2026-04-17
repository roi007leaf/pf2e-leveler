import { getClassFeaturesForLevel } from '../../../scripts/ui/level-planner/level-context.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { ROGUE } from '../../../scripts/classes/rogue.js';

describe('level planner class feature context', () => {
  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);
    ClassRegistry.register(ROGUE);
  });

  test('includes secondary dual-class features in level display', () => {
    const planner = {
      actor: createMockActor({
        class: {
          slug: 'alchemist',
          name: 'Alchemist',
          system: {
            items: {
              fieldDiscovery: {
                level: 5,
                name: 'Field Discovery',
                uuid: 'Compendium.pf2e.classes.Item.field-discovery',
                img: 'field.png',
              },
            },
          },
        },
      }),
      plan: {
        classSlug: 'alchemist',
        dualClassSlug: 'rogue',
      },
    };

    const features = getClassFeaturesForLevel(planner, 5);

    expect(features).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Field Discovery' }),
      expect.objectContaining({ name: 'Weapon Tricks' }),
    ]));
  });
});
