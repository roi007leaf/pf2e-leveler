import { clearCreationData, exportCreationData, getCreationData, importCreationData, saveCreationData } from '../../../scripts/creation/creation-store.js';

describe('creation store', () => {
  test('reads and writes creation data on the actor flag', async () => {
    const actor = {
      getFlag: jest.fn(() => ({ version: 1 })),
      setFlag: jest.fn(() => Promise.resolve()),
      unsetFlag: jest.fn(() => Promise.resolve()),
    };

    expect(getCreationData(actor)).toEqual({ version: 1 });
    await saveCreationData(actor, { version: 1, ancestry: { slug: 'human' } });
    expect(actor.setFlag).toHaveBeenCalledWith('pf2e-leveler', 'creation', { version: 1, ancestry: { slug: 'human' } });
    await clearCreationData(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('pf2e-leveler', 'creation');
  });

  test('exports and imports a wrapped creation payload', () => {
    const json = exportCreationData({
      version: 1,
      ancestry: { slug: 'human' },
      boosts: { free: ['str'] },
      spells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
    });

    const imported = importCreationData(json);

    expect(imported.version).toBe(1);
    expect(imported.ancestry.slug).toBe('human');
    expect(imported.boosts.free).toEqual(['str']);
  });

  test('normalizes older imported creation payloads with missing optional fields', () => {
    const imported = importCreationData(JSON.stringify({
      version: 1,
      ancestry: { slug: 'human' },
    }));

    expect(imported.languages).toEqual([]);
    expect(imported.spells).toEqual({ cantrips: [], rank1: [] });
    expect(imported.curriculumSpells).toEqual({ cantrips: [], rank1: [] });
    expect(imported.grantedFeatChoices).toEqual({});
  });

  test('rejects invalid creation import data', () => {
    expect(() => importCreationData(JSON.stringify({ nope: true }))).toThrow('Invalid creation format');
  });
});
