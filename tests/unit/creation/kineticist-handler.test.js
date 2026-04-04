import { KineticistHandler } from '../../../scripts/creation/class-handlers/kineticist.js';

describe('KineticistHandler', () => {
  it('requires two impulses for a single gate', () => {
    const handler = new KineticistHandler();

    expect(handler.isStepComplete('kineticGate', {
      subclass: { slug: 'air-gate' },
      kineticGateMode: 'single-gate',
      kineticImpulses: [{ uuid: 'a', element: 'air' }],
    })).toBe(false);

    expect(handler.isStepComplete('kineticGate', {
      subclass: { slug: 'air-gate' },
      kineticGateMode: 'single-gate',
      kineticImpulses: [{ uuid: 'a', element: 'air' }, { uuid: 'b', element: 'air' }],
    })).toBe(true);
  });

  it('requires a second element and one impulse from each element for a dual gate', () => {
    const handler = new KineticistHandler();

    expect(handler.isStepComplete('kineticGate', {
      subclass: { slug: 'air-gate' },
      kineticGateMode: 'dual-gate',
      secondElement: null,
      kineticImpulses: [],
    })).toBe(false);

    expect(handler.isStepComplete('kineticGate', {
      subclass: { slug: 'air-gate' },
      kineticGateMode: 'dual-gate',
      secondElement: { slug: 'fire-gate' },
      kineticImpulses: [{ uuid: 'a', element: 'air' }, { uuid: 'b', element: 'air' }],
    })).toBe(false);

    expect(handler.isStepComplete('kineticGate', {
      subclass: { slug: 'air-gate' },
      kineticGateMode: 'dual-gate',
      secondElement: { slug: 'fire-gate' },
      kineticImpulses: [{ uuid: 'a', element: 'air' }, { uuid: 'b', element: 'fire' }],
    })).toBe(true);
  });

  it('exposes impulse count and full-state in the step context', async () => {
    const handler = new KineticistHandler();
    const context = await handler.getStepContext('kineticGate', {
      subclass: { slug: 'air-gate', uuid: 'air', name: 'Air Gate' },
      kineticGateMode: 'single-gate',
      kineticImpulses: [{ uuid: 'a', element: 'air' }, { uuid: 'b', element: 'air' }],
    }, {
      _loadSubclasses: jest.fn(async () => []),
      _loadKineticImpulses: jest.fn(async () => []),
    });

    expect(context.selectedImpulseCount).toBe(2);
    expect(context.maxImpulses).toBe(2);
    expect(context.impulsesFull).toBe(true);
  });

  it('excludes the current gate from second-element options', async () => {
    const handler = new KineticistHandler();
    const context = await handler.getStepContext('kineticGate', {
      subclass: { slug: 'earth-gate', uuid: 'earth-uuid', name: 'Earth Gate' },
      kineticGateMode: 'dual-gate',
      kineticImpulses: [],
    }, {
      _loadSubclasses: jest.fn(async () => [
        { uuid: 'earth-uuid', slug: 'earth-gate', name: 'Earth Gate' },
        { uuid: 'air-uuid', slug: 'air-gate', name: 'Air Gate' },
      ]),
      _loadKineticImpulses: jest.fn(async () => []),
    });

    expect(context.secondElementOptions).toEqual([
      { uuid: 'air-uuid', slug: 'air-gate', name: 'Air Gate' },
    ]);
  });
});
