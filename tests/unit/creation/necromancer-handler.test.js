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

  test('grants create thrall plus the selected grim fascination spell', async () => {
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
      'Compendium.pf2e.spells-srd.Item.tFWa3ouvMC5Zz3P0',
    ]);
  });
});
