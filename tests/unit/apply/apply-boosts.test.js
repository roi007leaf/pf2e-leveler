import { applyBoosts } from '../../../scripts/apply/apply-boosts.js';

describe('applyBoosts', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      update: jest.fn(() => Promise.resolve()),
      toObject: jest.fn(() => ({ system: { build: { attributes: { boosts: {} } } } })),
    };
  });

  test('applies boosts at level 5', async () => {
    const plan = { levels: { 5: { abilityBoosts: ['str', 'wis', 'cha', 'int'] } } };
    const result = await applyBoosts(mockActor, plan, 5);
    expect(mockActor.update).toHaveBeenCalled();
    const updateArg = mockActor.update.mock.calls[0][0];
    expect(updateArg['system.build'].attributes.boosts[5]).toEqual(['str', 'wis', 'cha', 'int']);
    expect(result).toEqual(['str', 'wis', 'cha', 'int']);
  });

  test('applies planned boosts directly to manual ability modifiers', async () => {
    mockActor.system = {
      build: { attributes: { manual: true } },
      abilities: {
        str: { mod: 4 },
        dex: { mod: 3 },
        con: { mod: 0 },
        int: { mod: 4.5 },
        wis: { mod: -1 },
        cha: { mod: 0 },
      },
    };
    mockActor.toObject = jest.fn(() => ({
      system: {
        abilities: {
          str: { mod: 4 },
          dex: { mod: 3 },
          con: { mod: 0 },
          int: { mod: 4.5 },
          wis: { mod: -1 },
          cha: { mod: 0 },
        },
        build: { attributes: { manual: true, boosts: {} } },
      },
    }));
    const plan = { levels: { 5: { abilityBoosts: ['str', 'dex', 'int', 'wis'] } } };

    const result = await applyBoosts(mockActor, plan, 5);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.abilities': {
        str: { mod: 4.5 },
        dex: { mod: 4 },
        con: { mod: 0 },
        int: { mod: 5 },
        wis: { mod: 0 },
        cha: { mod: 0 },
      },
    });
    expect(result).toEqual(['str', 'dex', 'int', 'wis']);
  });

  test('overwrites the current gradual boost slot instead of appending after stale actor data', async () => {
    global._testSettings = {
      pf2e: {
        gradualBoostsVariant: true,
      },
    };
    mockActor.toObject = jest.fn(() => ({
      system: {
        build: {
          attributes: {
            boosts: {
              5: ['str', 'con', 'con'],
            },
          },
        },
      },
    }));
    const plan = {
      levels: {
        3: { abilityBoosts: ['con'] },
        4: { abilityBoosts: ['dex'] },
      },
    };

    const result = await applyBoosts(mockActor, plan, 4);

    const updateArg = mockActor.update.mock.calls[0][0];
    expect(updateArg['system.build'].attributes.boosts[5]).toEqual(['str', 'con', 'dex']);
    expect(result).toEqual(['dex']);
  });

  test('preserves legacy saved gradual milestone buckets', async () => {
    global._testSettings = {
      pf2e: {
        gradualBoostsVariant: true,
      },
    };
    const plan = {
      levels: {
        5: { abilityBoosts: ['str', 'con', 'int', 'cha'] },
      },
    };

    await applyBoosts(mockActor, plan, 5);

    const updateArg = mockActor.update.mock.calls[0][0];
    expect(updateArg['system.build'].attributes.boosts[5]).toEqual(['str', 'con', 'int', 'cha']);
  });

  test('returns empty array when no boosts', async () => {
    const plan = { levels: { 2: { classFeats: [] } } };
    const result = await applyBoosts(mockActor, plan, 2);
    expect(mockActor.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('returns empty array for level without data', async () => {
    const plan = { levels: {} };
    const result = await applyBoosts(mockActor, plan, 3);
    expect(result).toEqual([]);
  });
});
