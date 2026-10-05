import { refillFocusPool } from '../../../scripts/utils/focus-pool.js';

describe('refillFocusPool', () => {
  test.each([
    [0, 0],
    [1, 1],
    [3, 3],
  ])('leaves a full pool (%s/%s) unchanged', async (max, value) => {
    const actor = { system: { resources: { focus: { max, value } } }, update: jest.fn() };
    await refillFocusPool(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('does nothing when actor has no focus resource', async () => {
    const actor = { system: {}, update: jest.fn() };
    await refillFocusPool(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test('refills depleted points without writing derived max', async () => {
    const actor = { system: { resources: { focus: { max: 3, value: 1 } } }, update: jest.fn() };
    await refillFocusPool(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.resources.focus.value': 3 });
  });
});
