import { TechnomancerHandler } from '../../../scripts/creation/class-handlers/technomancer.js';
import { getClassHandler } from '../../../scripts/creation/class-handlers/registry.js';

describe('TechnomancerHandler.getSpellbookCounts', () => {
  it('sizes the spell database so the programming language spell is on top of the five picks', () => {
    expect(new TechnomancerHandler().getSpellbookCounts()).toEqual({ cantrips: 10, rank1: 6 });
  });

  it('is registered for the technomancer class', () => {
    expect(getClassHandler('technomancer')).toBeInstanceOf(TechnomancerHandler);
  });
});
