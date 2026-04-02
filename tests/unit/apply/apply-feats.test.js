import { applyFeats } from '../../../scripts/apply/apply-feats.js';

describe('applyFeats', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([{ name: 'Mock Feat' }])),
    };

    global.fromUuid = jest.fn(() =>
      Promise.resolve({
        uuid: 'test-uuid',
        name: 'Test Feat',
        img: 'icon.png',
        system: { level: { value: 1 }, location: null },
        toObject: jest.fn(() => ({
          name: 'Test Feat',
          system: { level: { value: 1 }, location: null },
        })),
      }),
    );
  });

  test('applies class feat', async () => {
    const plan = {
      levels: {
        2: {
          classFeats: [{ uuid: 'Compendium.pf2e.feats-srd.Item.xxx', name: 'X', slug: 'x' }],
        },
      },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', expect.any(Array));
    expect(result).toHaveLength(1);

    const createdData = mockActor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(createdData.system.location).toBe('class-2');
    expect(createdData.system.level.taken).toBe(2);
  });

  test('applies multiple feat types at same level', async () => {
    const plan = {
      levels: {
        2: {
          classFeats: [{ uuid: 'uuid-a', name: 'A', slug: 'a' }],
          skillFeats: [{ uuid: 'uuid-b', name: 'B', slug: 'b' }],
        },
      },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalled();
    const items = mockActor.createEmbeddedDocuments.mock.calls[0][1];
    expect(items).toHaveLength(2);
    expect(items[0].system.location).toBe('class-2');
    expect(items[1].system.location).toBe('skill-2');
  });

  test('returns empty for level without feats', async () => {
    const plan = { levels: { 1: { abilityBoosts: ['str'] } } };
    const result = await applyFeats(mockActor, plan, 1);
    expect(mockActor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('skips feats that fail to resolve', async () => {
    global.fromUuid = jest.fn(() => Promise.resolve(null));
    const plan = {
      levels: { 2: { classFeats: [{ uuid: 'bad-uuid', name: 'Bad', slug: 'bad' }] } },
    };
    const result = await applyFeats(mockActor, plan, 2);
    expect(result).toEqual([]);
  });
});
