import { ExemplarHandler } from '../../../scripts/creation/class-handlers/exemplar.js';

describe('ExemplarHandler', () => {
  it('requires three ikons', () => {
    const handler = new ExemplarHandler();

    expect(handler.isStepComplete('ikons', { ikons: [] })).toBe(false);
    expect(handler.isStepComplete('ikons', {
      ikons: [{ uuid: 'a' }, { uuid: 'b' }],
    })).toBe(false);
    expect(handler.isStepComplete('ikons', {
      ikons: [{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }],
    })).toBe(true);
  });

  it('exposes ikon count in the step context', async () => {
    const handler = new ExemplarHandler();
    const context = await handler.getStepContext('ikons', {
      ikons: [{ uuid: 'a' }, { uuid: 'b' }],
    }, {
      _loadExemplarIkons: jest.fn(async () => []),
    });

    expect(context.selectedIkonsCount).toBe(2);
    expect(context.maxIkons).toBe(3);
  });
});
