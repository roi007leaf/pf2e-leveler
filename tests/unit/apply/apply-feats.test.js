import { applyFeats } from '../../../scripts/apply/apply-feats.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import * as pf2eApi from '../../../scripts/utils/pf2e-api.js';

describe('applyFeats', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ name: 'Mock Feat' }])),
      update: jest.fn(() => Promise.resolve()),
      items: [],
      system: { resources: { focus: { max: 0, value: 0 } } },
    };

    jest.spyOn(ClassRegistry, 'get').mockReturnValue({
      spellcasting: { tradition: 'arcane' },
      keyAbility: ['cha'],
    });

    global.fromUuid = jest.fn(() =>
      Promise.resolve({
        uuid: 'test-uuid',
        name: 'Test Feat',
        img: 'icon.png',
        system: { level: { value: 1 }, location: null },
        toObject: jest.fn(() => ({
          name: 'Test Feat',
          system: { level: { value: 1 }, location: null },
        })),
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('applies class feat', async () => {
    const plan = {
      levels: {
        2: {
          classFeats: [{ uuid: 'Compendium.pf2e.feats-srd.Item.xxx', name: 'X', slug: 'x' }],
        },
      },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.any(Array));
    expect(result).toHaveLength(1);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('class-2');
    expect(createdData.system.level.taken).toBe(2);
  });

  test('applies multiple feat types at same level', async () => {
    const plan = {
      levels: {
        2: {
          classFeats: [{ uuid: 'uuid-a', name: 'A', slug: 'a' }],
          skillFeats: [{ uuid: 'uuid-b', name: 'B', slug: 'b' }],
        },
      },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalled();
    const items = mockActor.createEmbeddedDocuments.mock.calls[0][1];
    expect(items).toHaveLength(2);
    expect(items[0].system.location).toBe('class-2');
    expect(items[1].system.location).toBe('skill-2');
  });

  test('applies custom feats to the bonus feat location', async () => {
    const plan = {
      levels: {
        2: {
          customFeats: [{ uuid: 'uuid-custom', name: 'Custom Feat', slug: 'custom-feat' }],
        },
      },
    };

    await applyFeats(mockActor, plan, 2);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('bonus-2');
  });

  test('injects selected advanced multiclass class feat grants when Foundry data has no GrantItem rule', async () => {
    const existingAdvancedManeuver = {
      name: 'Advanced Maneuver',
      flags: { core: { sourceId: 'feat-advanced-maneuver' } },
    };
    mockActor.items = [existingAdvancedManeuver];
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-advanced-maneuver') {
        return {
          uuid,
          name: 'Advanced Maneuver',
          img: 'icon.png',
          flags: { core: { sourceId: 'feat-advanced-maneuver' } },
          system: { level: { value: 6 }, location: null, rules: [] },
          toObject: jest.fn(() => ({
            name: 'Advanced Maneuver',
            flags: { core: { sourceId: 'feat-advanced-maneuver' } },
            system: { level: { value: 6 }, location: null, rules: [] },
          })),
        };
      }
      if (uuid === 'Compendium.pf2e.feats-srd.Item.combat-grab') {
        return {
          uuid,
          name: 'Combat Grab',
          flags: { core: { sourceId: 'Compendium.pf2e.feats-srd.Item.combat-grab' } },
          system: { level: { value: 2 } },
          toObject: jest.fn(() => ({
            name: 'Combat Grab',
            flags: { core: { sourceId: 'Compendium.pf2e.feats-srd.Item.combat-grab' } },
            system: { level: { value: 2 } },
          })),
        };
      }
      return null;
    });

    await applyFeats(mockActor, {
      levels: {
        8: {
          archetypeFeats: [{
            uuid: 'feat-advanced-maneuver',
            name: 'Advanced Maneuver',
            slug: 'advanced-maneuver',
            choices: { levelerAdvancedClassFeat: 'Compendium.pf2e.feats-srd.Item.combat-grab' },
          }],
        },
      },
    }, 8);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('archetype-8');
    expect(createdData.system.rules).toEqual([
      { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.combat-grab' },
    ]);
  });

  test('routes dual class feats to the Workbench dual-class campaign feat section when present', async () => {
    jest.spyOn(pf2eApi, 'getCampaignFeatSectionIds').mockReturnValue(['xdy_dualclass']);

    const plan = {
      levels: {
        2: {
          dualClassFeats: [{ uuid: 'uuid-dual', name: 'Dual Feat', slug: 'dual-feat' }],
        },
      },
    };

    await applyFeats(mockActor, plan, 2);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('xdy_dualclass-2');
    expect(createdData.system.level.taken).toBe(2);
  });

  test('routes ancestral paragon feats to the dedicated paragon location', async () => {
    jest.spyOn(pf2eApi, 'isAncestralParagonEnabled').mockReturnValue(true);
    jest.spyOn(pf2eApi, 'getCampaignFeatSectionIds').mockReturnValue([]);

    const plan = {
      levels: {
        11: {
          ancestryFeats: [{ uuid: 'uuid-paragon', name: 'Paragon Feat', slug: 'paragon-feat' }],
        },
      },
    };

    await applyFeats(mockActor, plan, 11);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('xdy_ancestryparagon-11');
    expect(createdData.system.level.taken).toBe(11);
  });

  test('uses campaign feat section ids for ancestry paragon when extra feat slots are configured', async () => {
    jest.spyOn(pf2eApi, 'isAncestralParagonEnabled').mockReturnValue(true);
    jest.spyOn(pf2eApi, 'getCampaignFeatSectionIds').mockReturnValue(['ancestryParagon']);

    const plan = {
      levels: {
        11: {
          ancestryFeats: [{ uuid: 'uuid-paragon', name: 'Paragon Feat', slug: 'paragon-feat' }],
        },
      },
    };

    await applyFeats(mockActor, plan, 11);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('ancestryParagon-11');
    expect(createdData.system.level.taken).toBe(11);
  });

  test('returns empty for level without feats', async () => {
    const plan = { levels: { 1: { abilityBoosts: ['str'] } } };
    const result = await applyFeats(mockActor, plan, 1);
    expect(mockActor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('skips feats that fail to resolve', async () => {
    global.fromUuid = jest.fn(() => Promise.resolve(null));
    const plan = {
      levels: { 2: { classFeats: [{ uuid: 'bad-uuid', name: 'Bad', slug: 'bad' }] } },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(result).toEqual([]);
  });

  test('fills the focus pool when a granted focus spell is added to a pool showing max 1 and value 0', async () => {
    mockActor.system.resources.focus = { max: 1, value: 0 };
    mockActor.createEmbeddedDocuments = jest
      .fn()
      .mockResolvedValueOnce([{
        name: 'Focus Feat',
        system: {
          rules: [{ key: 'GrantItem', uuid: 'Compendium.pf2e.spells-srd.Item.focus-spell' }],
          description: { value: '' },
        },
      }])
      .mockResolvedValueOnce([{
        id: 'focus-entry-id',
        type: 'spellcastingEntry',
        system: { prepared: { value: 'focus' } },
      }])
      .mockResolvedValueOnce([{ name: 'Focus Spell' }]);

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-focus') {
        return {
          uuid,
          name: 'Focus Feat',
          img: 'icon.png',
          system: {
            level: { value: 1 },
            location: null,
            rules: [{ key: 'GrantItem', uuid: 'Compendium.pf2e.spells-srd.Item.focus-spell' }],
            description: { value: '' },
          },
          toObject: jest.fn(() => ({
            name: 'Focus Feat',
            system: {
              level: { value: 1 },
              location: null,
              rules: [{ key: 'GrantItem', uuid: 'Compendium.pf2e.spells-srd.Item.focus-spell' }],
              description: { value: '' },
            },
          })),
        };
      }
      if (uuid === 'Compendium.pf2e.spells-srd.Item.focus-spell') {
        return {
          uuid,
          name: 'Focus Spell',
          img: 'spell.png',
          system: {
            traits: { value: ['focus'], traditions: [] },
          },
          toObject: jest.fn(() => ({
            name: 'Focus Spell',
            system: {
              traits: { value: ['focus'], traditions: [] },
            },
          })),
        };
      }
      return null;
    });

    const plan = {
      classSlug: 'sorcerer',
      levels: {
        2: {
          classFeats: [{ uuid: 'feat-focus', name: 'Focus Feat', slug: 'focus-feat' }],
        },
      },
    };

    await applyFeats(mockActor, plan, 2);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.resources.focus.max': 2,
      'system.resources.focus.value': 2,
    });
  });

  test('fills the focus pool from SF2e GrantItem focus spells', async () => {
    const originalGame = global.game;
    global.game = {
      ...(originalGame ?? {}),
      system: { id: 'sf2e' },
    };
    mockActor.system.resources.focus = { max: 1, value: 0 };
    mockActor.createEmbeddedDocuments = jest
      .fn()
      .mockResolvedValueOnce([{
        name: 'Operative Focus',
        system: {
          rules: [{ key: 'GrantItem', uuid: 'Compendium.sf2e.spells.Item.focus-spell' }],
          description: { value: '' },
        },
      }])
      .mockResolvedValueOnce([{
        id: 'focus-entry-id',
        type: 'spellcastingEntry',
        system: { prepared: { value: 'focus' } },
      }])
      .mockResolvedValueOnce([{ name: 'SF2e Focus Spell' }]);

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-focus') {
        return {
          uuid,
          name: 'Operative Focus',
          system: {
            level: { value: 1 },
            location: null,
            rules: [{ key: 'GrantItem', uuid: 'Compendium.sf2e.spells.Item.focus-spell' }],
            description: { value: '' },
          },
          toObject: jest.fn(() => ({
            name: 'Operative Focus',
            system: {
              level: { value: 1 },
              location: null,
              rules: [{ key: 'GrantItem', uuid: 'Compendium.sf2e.spells.Item.focus-spell' }],
              description: { value: '' },
            },
          })),
        };
      }
      if (uuid === 'Compendium.sf2e.spells.Item.focus-spell') {
        return {
          uuid,
          name: 'SF2e Focus Spell',
          system: { traits: { value: ['focus'], traditions: [] } },
          toObject: jest.fn(() => ({
            name: 'SF2e Focus Spell',
            system: { traits: { value: ['focus'], traditions: [] } },
          })),
        };
      }
      return null;
    });

    try {
      await applyFeats(mockActor, {
        classSlug: 'sorcerer',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-focus', name: 'Operative Focus', slug: 'operative-focus' }],
          },
        },
      }, 2);

      expect(mockActor.update).toHaveBeenCalledWith({
        'system.resources.focus.max': 2,
        'system.resources.focus.value': 2,
      });
    } finally {
      global.game = originalGame;
    }
  });

  test('fills the focus pool from SF2e description focus spell links', async () => {
    const originalGame = global.game;
    global.game = {
      ...(originalGame ?? {}),
      system: { id: 'sf2e' },
    };
    mockActor.system.resources.focus = { max: 1, value: 0 };
    mockActor.createEmbeddedDocuments = jest
      .fn()
      .mockResolvedValueOnce([{
        name: 'Mystic Focus',
        system: {
          rules: [],
          description: {
            value: '@UUID[Compendium.sf2e.spells.Item.mystic-focus]{Mystic Focus}',
          },
        },
      }])
      .mockResolvedValueOnce([{
        id: 'focus-entry-id',
        type: 'spellcastingEntry',
        system: { prepared: { value: 'focus' } },
      }])
      .mockResolvedValueOnce([{ name: 'Mystic Focus Spell' }]);

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-focus') {
        return {
          uuid,
          name: 'Mystic Focus',
          system: {
            level: { value: 1 },
            location: null,
            rules: [],
            description: {
              value: '@UUID[Compendium.sf2e.spells.Item.mystic-focus]{Mystic Focus}',
            },
          },
          toObject: jest.fn(() => ({
            name: 'Mystic Focus',
            system: {
              level: { value: 1 },
              location: null,
              rules: [],
              description: {
                value: '@UUID[Compendium.sf2e.spells.Item.mystic-focus]{Mystic Focus}',
              },
            },
          })),
        };
      }
      if (uuid === 'Compendium.sf2e.spells.Item.mystic-focus') {
        return {
          uuid,
          name: 'Mystic Focus Spell',
          system: { traits: { value: ['focus'], traditions: [] } },
          toObject: jest.fn(() => ({
            name: 'Mystic Focus Spell',
            system: { traits: { value: ['focus'], traditions: [] } },
          })),
        };
      }
      return null;
    });

    try {
      await applyFeats(mockActor, {
        classSlug: 'sorcerer',
        levels: {
          2: {
            classFeats: [{ uuid: 'feat-focus', name: 'Mystic Focus', slug: 'mystic-focus' }],
          },
        },
      }, 2);

      expect(mockActor.update).toHaveBeenCalledWith({
        'system.resources.focus.max': 2,
        'system.resources.focus.value': 2,
      });
    } finally {
      global.game = originalGame;
    }
  });

  test('does not turn Halo description light text into a focus cantrip', async () => {
    mockActor.createEmbeddedDocuments = jest
      .fn()
      .mockResolvedValueOnce([{
        name: 'Halo',
        system: {
          rules: [],
          description: {
            value: '@UUID[Compendium.pf2e.spells-srd.Item.light]{Light}',
          },
        },
      }]);

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-halo') {
        return {
          uuid,
          name: 'Halo',
          system: {
            level: { value: 1 },
            location: null,
            rules: [],
            description: {
              value: '@UUID[Compendium.pf2e.spells-srd.Item.light]{Light}',
            },
          },
          toObject: jest.fn(() => ({
            name: 'Halo',
            system: {
              level: { value: 1 },
              location: null,
              rules: [],
              description: {
                value: '@UUID[Compendium.pf2e.spells-srd.Item.light]{Light}',
              },
            },
          })),
        };
      }
      if (uuid === 'Compendium.pf2e.spells-srd.Item.light') {
        return {
          uuid,
          name: 'Light',
          system: { traits: { value: ['cantrip', 'light'], traditions: [] } },
          toObject: jest.fn(() => ({
            name: 'Light',
            system: { traits: { value: ['cantrip', 'light'], traditions: [] } },
          })),
        };
      }
      return null;
    });

    await applyFeats(mockActor, {
      classSlug: 'champion',
      levels: {
        1: {
          ancestryFeats: [{ uuid: 'feat-halo', name: 'Halo', slug: 'halo' }],
        },
      },
    }, 1);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(mockActor.update).not.toHaveBeenCalled();
  });

  test('skips creating feats already present on the actor by source id', async () => {
    mockActor.items = [{
      type: 'feat',
      sourceId: 'feat-spellshot',
      system: { level: { value: 2 } },
    }];

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid !== 'feat-spellshot') return null;
      return {
        uuid,
        name: 'Spellshot Dedication',
        flags: { core: { sourceId: uuid } },
        system: { level: { value: 2 }, location: null },
        toObject: jest.fn(() => ({
          name: 'Spellshot Dedication',
          flags: { core: { sourceId: uuid } },
          system: { level: { value: 2 }, location: null },
        })),
      };
    });

    const plan = {
      levels: {
        2: {
          classFeats: [{ uuid: 'feat-spellshot', name: 'Spellshot Dedication', slug: 'spellshot-dedication' }],
        },
      },
    };

    const result = await applyFeats(mockActor, plan, 2);
    expect(result).toEqual([]);
    expect(mockActor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test('skips manually creating feats already granted by another selected feat in same batch', async () => {
    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'feat-root') {
        return {
          uuid,
          name: 'Granting Feature',
          flags: { core: { sourceId: uuid } },
          system: {
            level: { value: 2 },
            location: null,
            rules: [{ key: 'GrantItem', uuid: 'feat-spellshot' }],
          },
          toObject: jest.fn(() => ({
            name: 'Granting Feature',
            flags: { core: { sourceId: uuid } },
            system: {
              level: { value: 2 },
              location: null,
              rules: [{ key: 'GrantItem', uuid: 'feat-spellshot' }],
            },
          })),
        };
      }

      if (uuid === 'feat-spellshot') {
        return {
          uuid,
          name: 'Spellshot Dedication',
          flags: { core: { sourceId: uuid } },
          system: { level: { value: 2 }, location: null, rules: [] },
          toObject: jest.fn(() => ({
            name: 'Spellshot Dedication',
            flags: { core: { sourceId: uuid } },
            system: { level: { value: 2 }, location: null, rules: [] },
          })),
        };
      }

      return null;
    });

    const plan = {
      levels: {
        2: {
          classFeats: [
            { uuid: 'feat-root', name: 'Granting Feature', slug: 'granting-feature' },
            { uuid: 'feat-spellshot', name: 'Spellshot Dedication', slug: 'spellshot-dedication' },
          ],
        },
      },
    };

    await applyFeats(mockActor, plan, 2);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({ name: 'Granting Feature' }),
    ]);
  });
});
