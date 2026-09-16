import { applySpellSwaps } from '../../../scripts/apply/apply-spell-swaps.js';

describe('applySpellSwaps', () => {
  beforeEach(() => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
  });

  test('replaces an owned repertoire spell with a same-rank spell in the same entry', async () => {
    const original = {
      id: 'owned-fear',
      type: 'spell',
      name: 'Fear',
      sourceId: 'Compendium.pf2e.spells-srd.Item.fear',
      system: { location: { value: 'oracle-entry', heightenedLevel: 2 } },
    };
    const actor = {
      items: [original],
      deleteEmbeddedDocuments: jest.fn(async () => []),
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs),
    };
    const replacement = {
      uuid: 'Compendium.pf2e.spells-srd.Item.bane',
      name: 'Bane',
      system: { level: { value: 1 } },
      toObject: () => ({
        name: 'Bane',
        type: 'spell',
        flags: { core: { sourceId: 'Compendium.pf2e.spells-srd.Item.bane' } },
        system: { level: { value: 1 }, location: { value: null } },
      }),
    };
    global.fromUuid = jest.fn(async () => replacement);
    const plan = {
      levels: {
        2: {
          spellSwaps: [{
            entryType: 'primary',
            original: {
              actorItemId: 'owned-fear',
              sourceId: original.sourceId,
              name: 'Fear',
              rank: 2,
              entryId: 'oracle-entry',
            },
            replacement: { uuid: replacement.uuid, name: 'Bane', rank: 2 },
          }],
        },
      },
    };

    const applied = await applySpellSwaps(actor, plan, 2);

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['owned-fear']);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Bane',
        system: expect.objectContaining({
          location: { value: 'oracle-entry', heightenedLevel: 2 },
          heightenedLevel: 2,
        }),
      }),
    ]);
    expect(applied).toEqual([{
      original: { name: 'Fear' },
      replacement: { uuid: replacement.uuid, name: 'Bane', rank: 2 },
    }]);
  });

  test('keeps the original spell when replacement creation fails', async () => {
    const actor = {
      items: [{
        id: 'owned-fear',
        type: 'spell',
        name: 'Fear',
        sourceId: 'fear',
        system: { location: { value: 'oracle-entry' }, level: { value: 1 } },
      }],
      deleteEmbeddedDocuments: jest.fn(async () => []),
      createEmbeddedDocuments: jest.fn(async () => []),
    };
    global.fromUuid = jest.fn(async () => ({
      uuid: 'bane',
      name: 'Bane',
      system: { level: { value: 1 } },
      toObject: () => ({ name: 'Bane', type: 'spell', system: { level: { value: 1 } } }),
    }));
    const plan = {
      levels: {
        2: {
          spellSwaps: [{
            original: { actorItemId: 'owned-fear', name: 'Fear', rank: 1, entryId: 'oracle-entry' },
            replacement: { uuid: 'bane', name: 'Bane', rank: 1 },
          }],
        },
      },
    };

    expect(await applySpellSwaps(actor, plan, 2)).toEqual([]);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
