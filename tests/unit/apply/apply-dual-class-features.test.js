import { applyDualClassFeatures } from '../../../scripts/apply/apply-dual-class-features.js';

function createGrantedFeature({ uuid, name, level }) {
  return {
    uuid,
    name,
    type: 'feat',
    sourceId: uuid,
    system: {
      category: 'classfeature',
      level: { value: level },
    },
    toObject: () => ({
      name,
      type: 'feat',
      system: {
        category: 'classfeature',
        level: { value: level },
      },
      _stats: { compendiumSource: uuid },
    }),
  };
}

describe('applyDualClassFeatures', () => {
  test('backfills missing secondary-class features through target level without duplicating owned features', async () => {
    const levelOne = createGrantedFeature({
      uuid: 'Compendium.pf2e.classfeatures.Item.rogue-racket',
      name: "Rogue's Racket",
      level: 1,
    });
    const levelFive = createGrantedFeature({
      uuid: 'Compendium.pf2e.classfeatures.Item.weapon-tricks',
      name: 'Weapon Tricks',
      level: 5,
    });
    const dualClass = {
      type: 'class',
      slug: 'rogue',
      createGrantedItems: jest.fn(async () => [levelOne, levelFive]),
    };
    const actor = {
      class: { type: 'class', slug: 'alchemist' },
      itemTypes: {
        class: [{ type: 'class', slug: 'alchemist' }, dualClass],
        feat: [{
          type: 'feat',
          sourceId: levelOne.uuid,
          system: { category: 'classfeature', level: { value: 1 } },
        }],
      },
      items: [],
      createEmbeddedDocuments: jest.fn(async (_type, sources) => sources),
    };

    const applied = await applyDualClassFeatures(actor, {
      classSlug: 'alchemist',
      dualClassSlug: 'rogue',
    }, 5);

    expect(dualClass.createGrantedItems).toHaveBeenCalledWith({ level: 5 });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Weapon Tricks',
        _stats: { compendiumSource: levelFive.uuid },
      }),
    ], { keepId: true });
    expect(applied).toEqual([expect.objectContaining({ name: 'Weapon Tricks' })]);
  });

  test('does nothing without a distinct embedded secondary class', async () => {
    const actor = {
      class: { type: 'class', slug: 'alchemist' },
      itemTypes: { class: [{ type: 'class', slug: 'alchemist' }], feat: [] },
      createEmbeddedDocuments: jest.fn(),
    };

    await expect(applyDualClassFeatures(actor, {
      classSlug: 'alchemist',
      dualClassSlug: 'rogue',
    }, 5)).resolves.toEqual([]);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
