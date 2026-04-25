import { ensureActorHasSpellbook } from '../../../scripts/utils/spellcasting-support.js';

describe('spellcasting support', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.game;
    delete global.foundry;
  });

  test('creates spellbooks from the active SF2e equipment pack', async () => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };

    const spellbookDocument = {
      toObject: () => ({
        name: 'Spellbook',
        type: 'book',
        system: { slug: 'spellbook' },
      }),
    };
    const sf2eEquipmentPack = {
      getIndex: jest.fn(async () => [{
        _id: 'spellbook',
        name: 'Spellbook',
        type: 'book',
        system: { slug: 'spellbook' },
      }]),
      getDocument: jest.fn(async () => spellbookDocument),
    };
    global.game = {
      system: { id: 'sf2e' },
      packs: new Map([['sf2e.equipment', sf2eEquipmentPack]]),
    };
    const actor = {
      items: [],
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs),
    };

    const created = await ensureActorHasSpellbook(actor);

    expect(sf2eEquipmentPack.getIndex).toHaveBeenCalledWith({ fields: ['system.slug', 'type', 'name'] });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      name: 'Spellbook',
      type: 'book',
      system: { slug: 'spellbook' },
    }]);
    expect(created).toEqual({
      name: 'Spellbook',
      type: 'book',
      system: { slug: 'spellbook' },
    });
  });
});
