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
  test('skips createGrantedItems when the grant table shows nothing owed at the target level', async () => {
    const ownedUuid = 'Compendium.pf2e.classfeatures.Item.rogue-racket';
    const dualClass = {
      type: 'class',
      slug: 'rogue',
      system: {
        items: {
          a1: { uuid: ownedUuid, level: 1 },
          b2: { uuid: 'Compendium.pf2e.classfeatures.Item.weapon-tricks', level: 5 },
        },
      },
      createGrantedItems: jest.fn(async () => []),
    };
    const actor = {
      class: { type: 'class', slug: 'alchemist' },
      itemTypes: {
        class: [{ type: 'class', slug: 'alchemist' }, dualClass],
        feat: [{
          type: 'feat',
          sourceId: ownedUuid,
          system: { category: 'classfeature', level: { value: 1 } },
        }],
      },
      items: [],
      createEmbeddedDocuments: jest.fn(),
    };

    await expect(applyDualClassFeatures(actor, {
      classSlug: 'alchemist',
      dualClassSlug: 'rogue',
    }, 3)).resolves.toEqual([]);

    expect(dualClass.createGrantedItems).not.toHaveBeenCalled();
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test('calls createGrantedItems when the grant table lists an unowned feature at or below the target level', async () => {
    const ownedUuid = 'Compendium.pf2e.classfeatures.Item.rogue-racket';
    const levelFive = createGrantedFeature({
      uuid: 'Compendium.pf2e.classfeatures.Item.weapon-tricks',
      name: 'Weapon Tricks',
      level: 5,
    });
    const dualClass = {
      type: 'class',
      slug: 'rogue',
      system: {
        items: {
          a1: { uuid: ownedUuid, level: 1 },
          b2: { uuid: levelFive.uuid, level: 5 },
        },
      },
      createGrantedItems: jest.fn(async () => [levelFive]),
    };
    const actor = {
      class: { type: 'class', slug: 'alchemist' },
      itemTypes: {
        class: [{ type: 'class', slug: 'alchemist' }, dualClass],
        feat: [{
          type: 'feat',
          sourceId: ownedUuid,
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
    expect(applied).toEqual([expect.objectContaining({ name: 'Weapon Tricks' })]);
  });

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
