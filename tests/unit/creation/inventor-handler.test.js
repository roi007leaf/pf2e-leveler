import { InventorHandler } from '../../../scripts/creation/class-handlers/inventor.js';

describe('InventorHandler', () => {
  it('hides generic subclass choices in favor of the inventor-specific details step', () => {
    const handler = new InventorHandler();
    expect(handler.shouldShowSubclassChoices({
      subclass: { choiceSets: [{ flag: 'initialModification' }] },
    })).toBe(false);
  });

  it('requires an innovation item and initial modification for weapon innovation', () => {
    const handler = new InventorHandler();

    expect(handler.isStepComplete('innovationDetails', {
      subclass: { slug: 'weapon-innovation' },
      innovationItem: null,
      innovationModification: null,
    })).toBe(false);

    expect(handler.isStepComplete('innovationDetails', {
      subclass: { slug: 'weapon-innovation' },
      innovationItem: { uuid: 'weapon' },
      innovationModification: null,
    })).toBe(false);

    expect(handler.isStepComplete('innovationDetails', {
      subclass: { slug: 'weapon-innovation' },
      innovationItem: { uuid: 'weapon' },
      innovationModification: { uuid: 'mod' },
    })).toBe(true);
  });
});
