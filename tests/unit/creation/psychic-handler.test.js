import { PsychicHandler } from '../../../scripts/creation/class-handlers/psychic.js';

describe('PsychicHandler', () => {
  it('keeps conscious-mind grants from reducing the psychics normal repertoire picks', () => {
    const handler = new PsychicHandler();
    expect(handler.getSpellbookCounts({}, {})).toEqual({
      cantrips: 6,
      rank1: 2,
    });
  });

  it('resolves the level-1 conscious-mind cantrips and granted spell', async () => {
    const spells = {
      'Compendium.pf2e.spells-srd.Item.pwzdSlJgYqN7bs2w': {
        uuid: 'Compendium.pf2e.spells-srd.Item.pwzdSlJgYqN7bs2w',
        name: 'Telekinetic Hand',
        img: 'icons/telekinetic-hand.webp',
      },
      'Compendium.pf2e.spells-srd.Item.60sgbuMWN0268dB7': {
        uuid: 'Compendium.pf2e.spells-srd.Item.60sgbuMWN0268dB7',
        name: 'Telekinetic Projectile',
        img: 'icons/telekinetic-projectile.webp',
      },
      'Compendium.pf2e.spells-srd.Item.yyz029C9eqfY38PT': {
        uuid: 'Compendium.pf2e.spells-srd.Item.yyz029C9eqfY38PT',
        name: 'Telekinetic Rend',
        img: 'icons/telekinetic-rend.webp',
      },
      'Compendium.pf2e.spells-srd.Item.sPHcuLIKj9SDaDAD': {
        uuid: 'Compendium.pf2e.spells-srd.Item.sPHcuLIKj9SDaDAD',
        name: 'Kinetic Ram',
        img: 'icons/kinetic-ram.webp',
      },
    };

    global.fromUuid = jest.fn((uuid) => Promise.resolve(spells[uuid] ?? null));

    const handler = new PsychicHandler();
    const granted = await handler.resolveGrantedSpells({
      subclass: {
        slug: 'the-distant-grasp',
        name: 'The Distant Grasp',
      },
    });

    expect(granted.cantrips.map((spell) => spell.name)).toEqual([
      'Telekinetic Hand',
      'Telekinetic Projectile',
      'Telekinetic Rend',
    ]);
    expect(granted.rank1s.map((spell) => spell.name)).toEqual(['Kinetic Ram']);
    expect(granted.cantrips.every((spell) => spell.source === 'The Distant Grasp')).toBe(true);
  });
});
