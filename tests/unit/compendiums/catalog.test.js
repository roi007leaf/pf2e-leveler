import {
  discoverCompendiumsByCategory,
  getCompendiumKeysForCategory,
  migrateLegacyFeatCompendiumsSetting,
  normalizeCompendiumSelections,
} from '../../../scripts/compendiums/catalog.js';

describe('compendium catalog helpers', () => {
  test('merges default and configured compendium keys for a category', () => {
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['my-module.extra-feats'],
        },
      },
    };

    expect(getCompendiumKeysForCategory('feats')).toEqual([
      'pf2e.feats-srd',
      'my-module.extra-feats',
    ]);
  });

  test('normalizes malformed settings payloads into per-category arrays', () => {
    const result = normalizeCompendiumSelections({
      feats: ['a', 'a', 'b'],
      ancestries: 'bad-shape',
    });

    expect(result.feats).toEqual(['a', 'b']);
    expect(result.ancestries).toEqual([]);
    expect(result.classes).toEqual([]);
  });

  test('discovers available packs by content category', async () => {
    game.packs = new Map([
      ['pf2e.ancestries', {
        collection: 'pf2e.ancestries',
        metadata: { id: 'pf2e.ancestries', label: 'Ancestries', type: 'Item', packageName: 'pf2e' },
        getIndex: jest.fn(async () => [{ type: 'ancestry' }]),
      }],
      ['my.feats', {
        collection: 'my.feats',
        metadata: { id: 'my.feats', label: 'Custom Feats', type: 'Item', packageName: 'my-module' },
        getIndex: jest.fn(async () => [{ type: 'feat' }]),
      }],
      ['my.deities', {
        collection: 'my.deities',
        metadata: { id: 'my.deities', label: 'Custom Deities', type: 'Item', packageName: 'my-module' },
        getIndex: jest.fn(async () => [{ type: 'deity' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.ancestries.map((pack) => pack.key)).toContain('pf2e.ancestries');
    expect(discovered.feats.map((pack) => pack.key)).toContain('my.feats');
    expect(discovered.deities.map((pack) => pack.key)).toContain('my.deities');
  });

  test('detects class feature packs by PF2E item category instead of pack name', async () => {
    game.packs = new Map([
      ['teamplus.player-options', {
        collection: 'teamplus.player-options',
        metadata: { id: 'teamplus.player-options', label: 'Player Options', type: 'Item', packageName: 'teamplus' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
      ['whispering.subclasses', {
        collection: 'whispering.subclasses',
        metadata: { id: 'whispering.subclasses', label: 'Subclasses', type: 'Item', packageName: 'whispering' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.classFeatures.map((pack) => pack.key)).toEqual(expect.arrayContaining([
      'teamplus.player-options',
      'whispering.subclasses',
    ]));
  });

  test('does not classify pure class-feature packs as feats', async () => {
    game.packs = new Map([
      ['whispering.subclasses', {
        collection: 'whispering.subclasses',
        metadata: { id: 'whispering.subclasses', label: 'Subclasses', type: 'Item', packageName: 'whispering' },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'classfeature' } }]),
      }],
      ['mixed.player-options', {
        collection: 'mixed.player-options',
        metadata: { id: 'mixed.player-options', label: 'Player Options', type: 'Item', packageName: 'mixed' },
        getIndex: jest.fn(async () => [
          { type: 'feat', system: { category: 'classfeature' } },
          { type: 'feat', system: { category: 'general' } },
        ]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.feats.map((pack) => pack.key)).not.toContain('whispering.subclasses');
    expect(discovered.feats.map((pack) => pack.key)).toContain('mixed.player-options');
  });

  test('uses feature-like pack names to classify class feature packs and keep them out of classes', async () => {
    game.packs = new Map([
      ['pf2e-animal-companions.AC-Features', {
        collection: 'pf2e-animal-companions.AC-Features',
        metadata: {
          id: 'pf2e-animal-companions.AC-Features',
          label: 'Features',
          name: 'AC-Features',
          path: 'packs/ac-features',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'class' }]),
      }],
      ['pf2e-animal-companions.AC-Followers', {
        collection: 'pf2e-animal-companions.AC-Followers',
        metadata: {
          id: 'pf2e-animal-companions.AC-Followers',
          label: 'Followers',
          name: 'AC-Followers',
          path: 'packs/ac-followers',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'class' }]),
      }],
      ['pf2e.classes', {
        collection: 'pf2e.classes',
        metadata: { id: 'pf2e.classes', label: 'Classes', type: 'Item', packageName: 'pf2e' },
        getIndex: jest.fn(async () => [{ type: 'class' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.classFeatures.map((pack) => pack.key)).toContain('pf2e-animal-companions.AC-Features');
    expect(discovered.classes.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Features');
    expect(discovered.classes.map((pack) => pack.key)).toContain('pf2e.classes');
    expect(discovered.classFeatures.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Followers');
  });

  test('keeps feat packs out of class features when they contain regular feats', async () => {
    game.packs = new Map([
      ['pf2e.feats-srd', {
        collection: 'pf2e.feats-srd',
        metadata: {
          id: 'pf2e.feats-srd',
          label: 'Feats',
          name: 'feats-srd',
          path: 'packs/feats',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [
          { type: 'feat', system: { category: 'general' } },
          { type: 'feat', system: { category: 'classfeature' } },
        ]),
      }],
      ['pf2e.kingmaker-features', {
        collection: 'pf2e.kingmaker-features',
        metadata: {
          id: 'pf2e.kingmaker-features',
          label: 'Kingmaker Features',
          name: 'kingmaker-features',
          path: 'packs/kingmaker-features',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [
          { type: 'feat', system: { category: 'classfeature' } },
        ]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.feats.map((pack) => pack.key)).toContain('pf2e.feats-srd');
    expect(discovered.classFeatures.map((pack) => pack.key)).not.toContain('pf2e.feats-srd');
    expect(discovered.classFeatures.map((pack) => pack.key)).toContain('pf2e.kingmaker-features');
  });

  test('keeps feature-like packs out of ancestries even if they include ancestry entries', async () => {
    game.packs = new Map([
      ['pf2e-animal-companions.AC-Features', {
        collection: 'pf2e-animal-companions.AC-Features',
        metadata: {
          id: 'pf2e-animal-companions.AC-Features',
          label: 'Features',
          name: 'AC-Features',
          path: 'packs/ac-features',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [
          { type: 'ancestry' },
          { type: 'feat', system: { category: 'classfeature' } },
        ]),
      }],
      ['pf2e-animal-companions.AC-Ancestries-and-Class', {
        collection: 'pf2e-animal-companions.AC-Ancestries-and-Class',
        metadata: {
          id: 'pf2e-animal-companions.AC-Ancestries-and-Class',
          label: 'Animal Companion Ancestries',
          name: 'AC-Ancestries-and-Class',
          path: 'packs/ac-ancestries-and-class',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'ancestry' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.ancestries.map((pack) => pack.key)).toContain('pf2e-animal-companions.AC-Ancestries-and-Class');
    expect(discovered.ancestries.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Features');
    expect(discovered.classFeatures.map((pack) => pack.key)).toContain('pf2e-animal-companions.AC-Features');
  });

  test('keeps clearly non-feat packs out of feats even when their indexes include feat entries', async () => {
    game.packs = new Map([
      ['pf2e.adventure-specific-actions', {
        collection: 'pf2e.adventure-specific-actions',
        metadata: {
          id: 'pf2e.adventure-specific-actions',
          label: 'Adventure-Specific Actions',
          name: 'adventure-specific-actions',
          path: 'packs/adventure-specific-actions',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
      ['pf2e.ancestryfeatures', {
        collection: 'pf2e.ancestryfeatures',
        metadata: {
          id: 'pf2e.ancestryfeatures',
          label: 'Ancestry Features',
          name: 'ancestryfeatures',
          path: 'packs/ancestry-features',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
      ['pf2e.feats-srd', {
        collection: 'pf2e.feats-srd',
        metadata: {
          id: 'pf2e.feats-srd',
          label: 'Feats',
          name: 'feats-srd',
          path: 'packs/feats',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
      ['pf2e-animal-companions.AC-Features', {
        collection: 'pf2e-animal-companions.AC-Features',
        metadata: {
          id: 'pf2e-animal-companions.AC-Features',
          label: 'Features',
          name: 'AC-Features',
          path: 'packs/ac-features',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
      ['pf2e-animal-companions.AC-Followers', {
        collection: 'pf2e-animal-companions.AC-Followers',
        metadata: {
          id: 'pf2e-animal-companions.AC-Followers',
          label: 'Followers',
          name: 'AC-Followers',
          path: 'packs/ac-followers',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.feats.map((pack) => pack.key)).toContain('pf2e.feats-srd');
    expect(discovered.feats.map((pack) => pack.key)).not.toContain('pf2e.adventure-specific-actions');
    expect(discovered.feats.map((pack) => pack.key)).not.toContain('pf2e.ancestryfeatures');
    expect(discovered.feats.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Features');
    expect(discovered.feats.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Followers');
  });

  test('keeps clearly non-action packs out of actions even when their indexes include action entries', async () => {
    game.packs = new Map([
      ['pf2e.actionspf2e', {
        collection: 'pf2e.actionspf2e',
        metadata: {
          id: 'pf2e.actionspf2e',
          label: 'Actions',
          name: 'actionspf2e',
          path: 'packs/actions',
          type: 'Item',
          packageName: 'pf2e',
        },
        getIndex: jest.fn(async () => [{ type: 'action' }]),
      }],
      ['pf2e-animal-companions.AC-Features', {
        collection: 'pf2e-animal-companions.AC-Features',
        metadata: {
          id: 'pf2e-animal-companions.AC-Features',
          label: 'Features',
          name: 'AC-Features',
          path: 'packs/ac-features',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'action' }]),
      }],
      ['pf2e-animal-companions.AC-Support', {
        collection: 'pf2e-animal-companions.AC-Support',
        metadata: {
          id: 'pf2e-animal-companions.AC-Support',
          label: 'Support Benefits',
          name: 'AC-Support',
          path: 'packs/ac-support-benefits',
          type: 'Item',
          packageName: 'pf2e-animal-companions',
        },
        getIndex: jest.fn(async () => [{ type: 'action' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory();

    expect(discovered.actions.map((pack) => pack.key)).toContain('pf2e.actionspf2e');
    expect(discovered.actions.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Features');
    expect(discovered.actions.map((pack) => pack.key)).not.toContain('pf2e-animal-companions.AC-Support');
  });

  test('migrates legacy additional feat compendiums into the new category setting', async () => {
    global._testSettings = {
      'pf2e-leveler': {
        additionalFeatCompendiums: 'my-module.feats, my-module.more-feats',
        customCompendiums: {},
      },
    };

    const migrated = await migrateLegacyFeatCompendiumsSetting();

    expect(migrated).toBe(true);
    expect(game.settings.set).toHaveBeenCalledWith('pf2e-leveler', 'customCompendiums', expect.objectContaining({
      feats: ['my-module.feats', 'my-module.more-feats'],
    }));
  });
});
