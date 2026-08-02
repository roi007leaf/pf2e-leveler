import {
  NECROMANCER_GRIM_FASCINATION_UUID,
  NecromancerHandler,
} from '../../../scripts/creation/class-handlers/necromancer.js';

describe('NecromancerHandler', () => {
  beforeEach(() => {
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid.split('.').at(-1),
      img: `${uuid.split('.').at(-1)}.webp`,
    }));
  });

  test('uses the full initial dirge size and grants harm', async () => {
    const handler = new NecromancerHandler();

    expect(handler.getSpellbookCounts({}, {})).toEqual({
      cantrips: 8,
      rank1: 5,
    });
    await expect(handler.resolveGrantedSpells({})).resolves.toEqual({
      cantrips: [],
      rank1s: [
        expect.objectContaining({
          uuid: 'Compendium.pf2e.spells-srd.Item.wdA52JJnsuQWeyqz',
        }),
      ],
    });
  });

  test('grants every base grave spell plus the selected grim fascination spell', async () => {
    const handler = new NecromancerHandler();
    const focusSpells = await handler.resolveFocusSpells({
      grantedFeatChoices: {
        [NECROMANCER_GRIM_FASCINATION_UUID]: {
          grimFascination: 'Compendium.pf2e.classfeatures.Item.gyN8OZZ3txxIAKLf',
        },
      },
    });

    expect(focusSpells.map((spell) => spell.uuid)).toEqual([
      'Compendium.pf2e.spells-srd.Item.1JaRoJvlf8EPvnnD',
      'Compendium.pf2e.spells-srd.Item.NWDTNTpfPEc821pu',
      'Compendium.pf2e.spells-srd.Item.cg1l2AxBenLU6JFE',
      'Compendium.pf2e.spells-srd.Item.tFWa3ouvMC5Zz3P0',
    ]);
  });

  test('sets a two-point focus pool for necrotic bomb and grim fascination', async () => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
    global.fromUuid = jest.fn(async (uuid) => {
      const id = uuid.split('.').at(-1);
      const cantrip = ['1JaRoJvlf8EPvnnD', 'NWDTNTpfPEc821pu'].includes(id);
      return {
        uuid,
        name: id,
        system: { traits: { value: cantrip ? ['cantrip', 'focus'] : ['focus'] } },
        toObject: () => ({
          name: id,
          type: 'spell',
          system: { traits: { value: cantrip ? ['cantrip', 'focus'] : ['focus'] } },
        }),
      };
    });
    const actor = {
      items: [],
      system: { resources: { focus: { max: 0, value: 0 } } },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, index) => ({ id: `created-${index}`, ...doc }))),
      update: jest.fn(async () => {}),
    };
    const handler = new NecromancerHandler();

    await handler._applyFocusSpells(actor, {
      class: { slug: 'necromancer', name: 'Necromancer' },
      grantedFeatChoices: {
        [NECROMANCER_GRIM_FASCINATION_UUID]: {
          grimFascination: 'Compendium.pf2e.classfeatures.Item.gyN8OZZ3txxIAKLf',
        },
      },
    });

    expect(actor.update).toHaveBeenCalledWith({
      'system.resources.focus.max': 2,
      'system.resources.focus.value': 2,
    });
  });
});
