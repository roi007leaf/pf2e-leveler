import { getCompendiumKeysForCategory } from '../../../scripts/compendiums/catalog.js';
import { loadCompendiumCategory } from '../../../scripts/ui/character-wizard/loaders.js';

describe('player content restrictions', () => {
  afterEach(() => {
    game.user.isGM = true;
  });

  test('restricts compendium sources for non-GM users when player source limits are enabled', () => {
    game.user.isGM = false;
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {
          feats: ['custom.allowed', 'custom.blocked'],
        },
        restrictPlayerCompendiumAccess: true,
        playerCompendiumAccess: {
          enabled: true,
          selections: {
            feats: ['pf2e.feats-srd', 'custom.allowed'],
          },
        },
      },
    };

    expect(getCompendiumKeysForCategory('feats')).toEqual([
      'pf2e.feats-srd',
      'custom.allowed',
    ]);
  });

  test('filters unavailable rarities out of character creation loaders for non-GM users', async () => {
    game.user.isGM = false;
    global._testSettings = {
      'pf2e-leveler': {
        customCompendiums: {},
        playerAllowUncommon: false,
        playerAllowRare: false,
        playerAllowUnique: false,
      },
    };

    const wizard = {
      _compendiumCache: {},
      _loadCompendium: jest.fn(async () => [
        { uuid: 'common', name: 'Common Option', rarity: 'common' },
        { uuid: 'uncommon', name: 'Uncommon Option', rarity: 'uncommon' },
        { uuid: 'rare', name: 'Rare Option', rarity: 'rare' },
      ]),
    };

    const items = await loadCompendiumCategory(wizard, 'feats', 'category-feats');

    expect(items).toEqual([
      { uuid: 'common', name: 'Common Option', rarity: 'common' },
    ]);
  });

  test('includes eligible world items in character creation loaders for feats, spells, equipment, and classes', async () => {
    game.items = [
      {
        uuid: 'Item.world-feat',
        name: 'World Feat',
        type: 'feat',
        system: {
          category: 'general',
          traits: { rarity: 'common', value: ['skill'] },
          description: { value: '<p>Feat</p>' },
          level: { value: 1 },
        },
      },
      {
        uuid: 'Item.world-spell',
        name: 'World Spell',
        type: 'spell',
        system: {
          traits: { rarity: 'common', value: [], traditions: ['arcane'] },
          description: { value: '<p>Spell</p>' },
          level: { value: 1 },
        },
      },
      {
        uuid: 'Item.world-weapon',
        name: 'World Weapon',
        type: 'weapon',
        system: {
          traits: { rarity: 'common', value: ['martial'] },
          description: { value: '<p>Weapon</p>' },
          level: { value: 1 },
        },
      },
      {
        uuid: 'Item.world-class',
        name: 'World Class',
        type: 'class',
        slug: 'world-class',
        system: {
          keyAbility: { value: ['str'] },
          traits: { rarity: 'common', value: [] },
          description: { value: '<p>Class</p>' },
          level: { value: 1 },
          classFeatLevels: { value: [1, 2] },
          skillFeatLevels: { value: [2] },
          generalFeatLevels: { value: [3] },
          ancestryFeatLevels: { value: [1] },
          skillIncreaseLevels: { value: [3] },
          trainedSkills: { value: ['athletics'], additional: 2 },
          hp: 10,
          items: {},
        },
      },
    ];

    const wizard = {
      _compendiumCache: {},
      _loadCompendium: jest.fn(async () => []),
    };

    const feats = await loadCompendiumCategory(wizard, 'feats', 'category-feats');
    const spells = await loadCompendiumCategory(wizard, 'spells', 'category-spells');
    const equipment = await loadCompendiumCategory(wizard, 'equipment', 'category-equipment');
    const classes = await loadCompendiumCategory(wizard, 'classes', 'category-classes');

    expect(feats).toEqual(expect.arrayContaining([
      expect.objectContaining({ uuid: 'Item.world-feat', sourcePackage: 'world' }),
    ]));
    expect(spells).toEqual(expect.arrayContaining([
      expect.objectContaining({ uuid: 'Item.world-spell', sourcePackage: 'world' }),
    ]));
    expect(equipment).toEqual(expect.arrayContaining([
      expect.objectContaining({ uuid: 'Item.world-weapon', sourcePackage: 'world' }),
    ]));
    expect(classes).toEqual(expect.arrayContaining([
      expect.objectContaining({ uuid: 'Item.world-class', sourcePackage: 'world' }),
    ]));
  });
});
