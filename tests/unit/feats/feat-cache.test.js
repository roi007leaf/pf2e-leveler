import { getCachedFeats, invalidateCache, loadFeats } from '../../../scripts/feats/feat-cache.js';

describe('feat cache', () => {
  beforeEach(() => {
    invalidateCache();
    localStorage.clear();
    game.items = [];
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['my-module.feats'],
        },
      },
    };

    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.feats-srd') {
        return {
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.A',
              type: 'feat',
              system: { category: 'class' },
            },
          ]),
        };
      }

      if (key === 'my-module.feats') {
        return {
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.my-module.feats.Item.B',
              type: 'feat',
              system: { category: 'general' },
            },
          ]),
        };
      }

      return null;
    });
  });

  test('loads feats from default and configured feat compendiums', async () => {
    const feats = await loadFeats();

    expect(feats.map((feat) => feat.uuid)).toEqual([
      'Compendium.pf2e.feats-srd.Item.A',
      'Compendium.my-module.feats.Item.B',
    ]);
    expect(getCachedFeats()).toHaveLength(2);
  });

  test('auto-discovers feat packs when no custom feat compendiums are configured', async () => {
    invalidateCache();
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {},
      },
    };

    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.feats-srd') {
        return {
          metadata: { packageName: 'pf2e' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.A',
              type: 'feat',
              system: { category: 'class', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      if (key === 'my-discovered.feats') {
        return {
          metadata: { packageName: 'my-discovered' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.my-discovered.feats.Item.Marshal',
              type: 'feat',
              system: { category: 'archetype', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      return null;
    });

    game.packs.values = jest.fn(() => [
      {
        collection: 'pf2e.feats-srd',
        documentName: 'Item',
        metadata: { packageName: 'pf2e', type: 'Item', label: 'Feats', id: 'pf2e.feats-srd' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'class' } }]),
      },
      {
        collection: 'my-discovered.feats',
        documentName: 'Item',
        metadata: {
          packageName: 'my-discovered',
          type: 'Item',
          label: 'Discovered Feats',
          id: 'my-discovered.feats',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'archetype' } }]),
      },
    ]);

    const feats = await loadFeats();
    expect(feats.map((feat) => feat.uuid)).toEqual([
      'Compendium.pf2e.feats-srd.Item.A',
      'Compendium.my-discovered.feats.Item.Marshal',
    ]);
  });

  test('always includes discovered official pf2e feat packs even when custom feat compendiums are configured', async () => {
    invalidateCache();
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['my-module.feats'],
        },
      },
    };

    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.feats-srd') {
        return {
          metadata: { packageName: 'pf2e' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.A',
              type: 'feat',
              system: { category: 'class', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      if (key === 'my-module.feats') {
        return {
          metadata: { packageName: 'my-module' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.my-module.feats.Item.B',
              type: 'feat',
              system: { category: 'general', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      if (key === 'pf2e.lost-omens-firebrands') {
        return {
          metadata: { packageName: 'pf2e' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.pf2e.lost-omens-firebrands.Item.Marshal',
              type: 'feat',
              system: { category: 'archetype', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      return null;
    });

    game.packs.values = jest.fn(() => [
      {
        collection: 'pf2e.feats-srd',
        documentName: 'Item',
        metadata: { packageName: 'pf2e', type: 'Item', label: 'Feats', id: 'pf2e.feats-srd' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'class' } }]),
      },
      {
        collection: 'pf2e.lost-omens-firebrands',
        documentName: 'Item',
        metadata: {
          packageName: 'pf2e',
          type: 'Item',
          label: 'Lost Omens Firebrands',
          id: 'pf2e.lost-omens-firebrands',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'archetype' } }]),
      },
      {
        collection: 'my-module.feats',
        documentName: 'Item',
        metadata: {
          packageName: 'my-module',
          type: 'Item',
          label: 'My Feats',
          id: 'my-module.feats',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      },
    ]);

    const feats = await loadFeats();
    expect(feats.map((feat) => feat.uuid)).toEqual([
      'Compendium.pf2e.feats-srd.Item.A',
      'Compendium.my-module.feats.Item.B',
      'Compendium.pf2e.lost-omens-firebrands.Item.Marshal',
    ]);
  });

  test('reuses stored raw feat pack discovery across reloads instead of rescanning all pack indexes', async () => {
    invalidateCache();
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {},
      },
    };

    const discoveredPack = {
      collection: 'my-discovered.feats',
      documentName: 'Item',
      metadata: {
        packageName: 'my-discovered',
        type: 'Item',
        label: 'Discovered Feats',
        id: 'my-discovered.feats',
      },
      getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'archetype' } }]),
    };

    game.packs.get = jest.fn((key) => {
      if (key === 'pf2e.feats-srd') {
        return {
          metadata: { packageName: 'pf2e' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.A',
              type: 'feat',
              system: { category: 'class', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      if (key === 'my-discovered.feats') {
        return {
          metadata: { packageName: 'my-discovered' },
          getDocuments: jest.fn(async () => [
            {
              uuid: 'Compendium.my-discovered.feats.Item.Marshal',
              type: 'feat',
              system: { category: 'archetype', traits: { rarity: 'common' } },
            },
          ]),
        };
      }

      return null;
    });

    game.packs.values = jest.fn(() => [
      {
        collection: 'pf2e.feats-srd',
        documentName: 'Item',
        metadata: { packageName: 'pf2e', type: 'Item', label: 'Feats', id: 'pf2e.feats-srd' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'class' } }]),
      },
      discoveredPack,
    ]);

    await loadFeats();
    expect(discoveredPack.getIndex).toHaveBeenCalled();
    const initialCallCount = discoveredPack.getIndex.mock.calls.length;

    invalidateCache();
    discoveredPack.getIndex.mockClear();
    await loadFeats();

    expect(discoveredPack.getIndex.mock.calls.length).toBeLessThan(initialCallCount);
  });

  test('includes eligible world feat items alongside compendium feats', async () => {
    game.items = [
      {
        uuid: 'Item.world-feat',
        type: 'feat',
        name: 'World Feat',
        system: {
          category: 'ancestry',
          traits: { rarity: 'common', value: ['human'] },
        },
      },
      {
        uuid: 'Item.world-ancestry-feature',
        type: 'feat',
        name: 'World Ancestry Feature',
        system: {
          category: 'ancestryfeature',
          traits: { rarity: 'common', value: ['human'] },
        },
      },
    ];

    const feats = await loadFeats();

    expect(feats.map((feat) => feat.uuid)).toEqual([
      'Compendium.pf2e.feats-srd.Item.A',
      'Compendium.my-module.feats.Item.B',
      'Item.world-feat',
    ]);
    expect(feats.find((feat) => feat.uuid === 'Item.world-feat')).toEqual(
      expect.objectContaining({
        sourcePackage: 'world',
      }),
    );
  });
});
