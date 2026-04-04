import { ThaumaturgeHandler } from '../../../scripts/creation/class-handlers/thaumaturge.js';

describe('ThaumaturgeHandler', () => {
  it('requires an implement selection', () => {
    const handler = new ThaumaturgeHandler();

    expect(handler.isStepComplete('implement', { implement: null })).toBe(false);
    expect(handler.isStepComplete('implement', {
      implement: { uuid: 'Compendium.pf2e.classfeatures.Item.amulet', name: 'Amulet' },
    })).toBe(true);
  });
});
