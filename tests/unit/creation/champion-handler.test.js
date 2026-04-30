jest.mock('../../../scripts/creation/apply-creation.js', () => ({
  applyItem: jest.fn(async () => {}),
}));

import { ChampionHandler } from '../../../scripts/creation/class-handlers/champion.js';

describe('ChampionHandler.applyExtras', () => {
  beforeEach(() => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Shields of the Spirit',
      type: 'spell',
      system: { traits: { value: ['champion', 'focus'], traditions: [] } },
      toObject: () => ({
        name: 'Shields of the Spirit',
        type: 'spell',
        system: { traits: { value: ['champion', 'focus'], traditions: [] } },
      }),
    }));
  });

  it('does not add the selected devotion spell when it already exists', async () => {
    const actor = {
      items: [
        {
          id: 'focus-entry',
          name: 'Champion Focus Spells',
          type: 'spellcastingEntry',
          system: {
            tradition: { value: 'divine' },
            prepared: { value: 'focus' },
          },
        },
        {
          name: 'Shields of the Spirit',
          type: 'spell',
          flags: { core: { sourceId: 'Compendium.pf2e.spells-srd.Item.shields-of-the-spirit' } },
        },
      ],
      createEmbeddedDocuments: jest.fn(async () => []),
      update: jest.fn(async () => {}),
    };
    const handler = new ChampionHandler();

    await handler.applyExtras(actor, {
      class: { name: 'Champion', slug: 'champion' },
      deity: null,
      devotionSpell: {
        uuid: 'Compendium.pf2e.spells-srd.Item.shields-of-the-spirit',
        name: 'Shields of the Spirit',
      },
    });

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
