import { AnimistHandler } from '../../../scripts/creation/class-handlers/animist.js';

describe('AnimistHandler', () => {
  it('uses level-1 animist prepared spell counts', () => {
    const handler = new AnimistHandler();
    expect(handler.getSpellbookCounts({}, {})).toEqual({
      cantrips: 2,
      rank1: 1,
    });
  });

  it('requires two apparitions and a valid primary apparition', () => {
    const handler = new AnimistHandler();

    expect(handler.isStepComplete('apparitions', {
      apparitions: [{ uuid: 'a' }],
      primaryApparition: 'a',
    })).toBe(false);

    expect(handler.isStepComplete('apparitions', {
      apparitions: [{ uuid: 'a' }, { uuid: 'b' }],
      primaryApparition: 'c',
    })).toBe(false);

    expect(handler.isStepComplete('apparitions', {
      apparitions: [{ uuid: 'a' }, { uuid: 'b' }],
      primaryApparition: 'a',
    })).toBe(true);
  });

  it('exposes apparition count in the step context', async () => {
    const handler = new AnimistHandler();
    const context = await handler.getStepContext('apparitions', {
      apparitions: [{ uuid: 'a' }],
      primaryApparition: 'a',
    }, {
      _loadApparitions: jest.fn(async () => []),
    });

    expect(context.selectedApparitionsCount).toBe(1);
    expect(context.maxApparitions).toBe(2);
  });

  it('resolves the vessel spell from the primary apparition', async () => {
    global.fromUuid = jest.fn((uuid) => Promise.resolve({
      uuid,
      name: 'Garden of Healing',
      img: 'icons/garden.webp',
    }));

    const handler = new AnimistHandler();
    const spells = await handler.resolveFocusSpells({
      apparitions: [
        { uuid: 'app-1', vesselSpell: 'Compendium.pf2e.spells-srd.Item.garden' },
      ],
      primaryApparition: 'app-1',
    });

    expect(spells).toEqual([{
      uuid: 'Compendium.pf2e.spells-srd.Item.garden',
      name: 'Garden of Healing',
      img: 'icons/garden.webp',
    }]);
  });
});
