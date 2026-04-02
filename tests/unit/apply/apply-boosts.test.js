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
