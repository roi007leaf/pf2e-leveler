import {
  discoverCompendiumsByCategory,
  getCompendiumKeysForCategory,
  getDefaultCompendiumKeys,
  migrateLegacyFeatCompendiumsSetting,
  normalizeCompendiumSelections,
} from '../../../scripts/compendiums/catalog.js';

describe('compendium catalog helpers', () => {
  test('uses PF2e default compendium keys in PF2e worlds', () => {
    game.system.id = 'pf2e';
    game.modules = new Map();

    expect(getDefaultCompendiumKeys('feats')).toEqual(['pf2e.feats-srd']);
    expect(getDefaultCompendiumKeys('classFeatures')).toEqual(['pf2e.classfeatures']);
    expect(getDefaultCompendiumKeys('spells')).toEqual(['pf2e.spells-srd']);
  });

  test('uses SF2e default compendium keys in standalone SF2e worlds', () => {
    game.system.id = 'sf2e';
    game.modules = new Map();

    expect(getDefaultCompendiumKeys('feats')).toEqual(['sf2e.feats']);
    expect(getDefaultCompendiumKeys('classFeatures')).toEqual(['sf2e.class-features']);
    expect(getDefaultCompendiumKeys('spells')).toEqual(['sf2e.spells']);
  });

  test('adds Pathfinder Anachronism default compendium keys when active in SF2e worlds', () => {
    game.system.id = 'sf2e';
    game.modules = new Map([['pf2e-anachronism', { active: true }]]);

    expect(getDefaultCompendiumKeys('feats')).toEqual(['sf2e.feats', 'pf2e-anachronism.feats']);
    expect(getDefaultCompendiumKeys('classFeatures')).toEqual([
      'sf2e.class-features',
      'pf2e-anachronism.class-features',
    ]);
    expect(getDefaultCompendiumKeys('spells')).toEqual(['sf2e.spells', 'pf2e-anachronism.spells']);
  });

  test('adds Anachronism default compendium keys when active in PF2e worlds', () => {
    game.system.id = 'pf2e';
    game.modules = new Map([['sf2e-anachronism', { active: true }]]);

    expect(getDefaultCompendiumKeys('feats')).toEqual(['pf2e.feats-srd', 'sf2e-anachronism.feats']);
    expect(getDefaultCompendiumKeys('classFeatures')).toEqual([
      'pf2e.classfeatures',
      'sf2e-anachronism.class-features',
    ]);
    expect(getDefaultCompendiumKeys('spells')).toEqual(['pf2e.spells-srd', 'sf2e-anachronism.spells']);
  });

  test('filters standalone SF2e system packs from configured keys in PF2e Anachronism worlds', () => {
    game.system.id = 'pf2e';
    game.modules = new Map([['sf2e-anachronism', { active: true }]]);
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          spells: ['sf2e.spells', 'sf2e-anachronism.spells', 'my-module.spells'],
        },
      },
    };

    expect(getCompendiumKeysForCategory('spells')).toEqual([
      'pf2e.spells-srd',
      'sf2e-anachronism.spells',
      'my-module.spells',
    ]);
  });

  test('does not auto-discover standalone SF2e system packs in PF2e Anachronism worlds', async () => {
    game.system.id = 'pf2e';
    game.modules = new Map([['sf2e-anachronism', { active: true }]]);
    game.packs = new Map([
      ['sf2e.spells', {
        collection: 'sf2e.spells',
        metadata: { id: 'sf2e.spells', label: 'SF2e Spells', type: 'Item', packageName: 'sf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
      ['sf2e-anachronism.spells', {
        collection: 'sf2e-anachronism.spells',
        metadata: { id: 'sf2e-anachronism.spells', label: 'Anachronism Spells', type: 'Item', packageName: 'sf2e-anachronism' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.spells.map((pack) => pack.key)).toContain('sf2e-anachronism.spells');
    expect(discovered.spells.map((pack) => pack.key)).not.toContain('sf2e.spells');
  });

  test('does not auto-discover PF2e system packs in standalone SF2e worlds', async () => {
    game.system.id = 'sf2e';
    game.modules = new Map();
    game.packs = new Map([
      ['pf2e.spells-srd', {
        collection: 'pf2e.spells-srd',
        metadata: { id: 'pf2e.spells-srd', label: 'PF2e Spells', type: 'Item', packageName: 'pf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
      ['sf2e.spells', {
        collection: 'sf2e.spells',
        metadata: { id: 'sf2e.spells', label: 'SF2e Spells', type: 'Item', packageName: 'sf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.spells.map((pack) => pack.key)).toContain('sf2e.spells');
    expect(discovered.spells.map((pack) => pack.key)).not.toContain('pf2e.spells-srd');
  });

  test('does not auto-discover Pathfinder Anachronism packs in PF2e worlds', async () => {
    game.system.id = 'pf2e';
    game.modules = new Map([['pf2e-anachronism', { active: true }]]);
    game.packs = new Map([
      ['pf2e-anachronism.spells', {
        collection: 'pf2e-anachronism.spells',
        metadata: { id: 'pf2e-anachronism.spells', label: 'Pathfinder Anachronism Spells', type: 'Item', packageName: 'pf2e-anachronism' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
      ['pf2e.spells-srd', {
        collection: 'pf2e.spells-srd',
        metadata: { id: 'pf2e.spells-srd', label: 'PF2e Spells', type: 'Item', packageName: 'pf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.spells.map((pack) => pack.key)).toContain('pf2e.spells-srd');
    expect(discovered.spells.map((pack) => pack.key)).not.toContain('pf2e-anachronism.spells');
  });

  test('does not auto-discover Pathfinder Anachronism packs in SF2e worlds when inactive', async () => {
    game.system.id = 'sf2e';
    game.modules = new Map([['pf2e-anachronism', { active: false }]]);
    game.packs = new Map([
      ['pf2e-anachronism.spells', {
        collection: 'pf2e-anachronism.spells',
        metadata: { id: 'pf2e-anachronism.spells', label: 'Pathfinder Anachronism Spells', type: 'Item', packageName: 'pf2e-anachronism' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
      ['sf2e.spells', {
        collection: 'sf2e.spells',
        metadata: { id: 'sf2e.spells', label: 'SF2e Spells', type: 'Item', packageName: 'sf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.spells.map((pack) => pack.key)).toContain('sf2e.spells');
    expect(discovered.spells.map((pack) => pack.key)).not.toContain('pf2e-anachronism.spells');
  });

  test('auto-discovers Pathfinder Anachronism packs in SF2e worlds when active', async () => {
    game.system.id = 'sf2e';
    game.modules = new Map([['pf2e-anachronism', { active: true }]]);
    game.packs = new Map([
      ['pf2e-anachronism.spells', {
        collection: 'pf2e-anachronism.spells',
        metadata: { id: 'pf2e-anachronism.spells', label: 'Pathfinder Anachronism Spells', type: 'Item', packageName: 'pf2e-anachronism' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
      ['sf2e.spells', {
        collection: 'sf2e.spells',
        metadata: { id: 'sf2e.spells', label: 'SF2e Spells', type: 'Item', packageName: 'sf2e' },
        getIndex: jest.fn(async () => [{ type: 'spell' }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.spells.map((pack) => pack.key)).toContain('sf2e.spells');
    expect(discovered.spells.map((pack) => pack.key)).toContain('pf2e-anachronism.spells');
  });

  test('merges default and configured compendium keys for a category', () => {
    game.system.id = 'pf2e';
    game.modules = new Map();
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
    game.modules.get = jest.fn((key) => {
      if (key === 'my-module') return { title: 'My Module', authors: [{ name: 'Test Creator' }] };
      return { title: key, authors: [] };
    });
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

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.ancestries.map((pack) => pack.key)).toContain('pf2e.ancestries');
    expect(discovered.feats.map((pack) => pack.key)).toContain('my.feats');
    expect(discovered.deities.map((pack) => pack.key)).toContain('my.deities');
    expect(discovered.feats.find((pack) => pack.key === 'my.feats')).toEqual(expect.objectContaining({
      packageAuthors: 'Test Creator',
    }));
  });

  test('allows mixed compendiums to appear in every matching category when their index contains multiple item kinds', async () => {
    game.packs = new Map([
      ['my.player-options', {
        collection: 'my.player-options',
        metadata: {
          id: 'my.player-options',
          label: 'Player Options',
          name: 'player-options',
          path: 'packs/player-options',
          type: 'Item',
          packageName: 'my-module',
        },
        getIndex: jest.fn(async () => [
          { type: 'feat', system: { category: 'classfeature' } },
          { type: 'feat', system: { category: 'general' } },
          { type: 'spell' },
        ]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.classFeatures.map((pack) => pack.key)).toContain('my.player-options');
    expect(discovered.feats.map((pack) => pack.key)).toContain('my.player-options');
    expect(discovered.spells.map((pack) => pack.key)).toContain('my.player-options');
  });

  test('shows all item packs as manual candidates in every category so GMs can opt them in', async () => {
    game.packs = new Map([
      ['my.custom-items', {
        collection: 'my.custom-items',
        metadata: {
          id: 'my.custom-items',
          label: 'Custom Items',
          name: 'custom-items',
          path: 'packs/custom-items',
          type: 'Item',
          packageName: 'my-module',
        },
        getIndex: jest.fn(async () => [{ type: 'feat', system: { category: 'general' } }]),
      }],
    ]);

    const discovered = await discoverCompendiumsByCategory({ includeManualCandidates: true });

    expect(discovered.feats).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'my.custom-items' }),
    ]));
    expect(discovered.spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'my.custom-items', manualCandidate: true, locked: false }),
    ]));
    expect(discovered.classFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'my.custom-items', manualCandidate: true, locked: false }),
    ]));
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
