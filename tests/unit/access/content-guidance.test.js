import {
  annotateGuidance,
  getGuidanceForSourceTitle,
  getSourceGuidanceKey,
  invalidateGuidanceCache,
  normalizeSourceTitle,
} from '../../../scripts/access/content-guidance.js';

jest.mock('../../../scripts/access/player-content.js', () => ({
  shouldRestrictContentForUser: jest.fn(() => true),
}));

describe('content guidance source rules', () => {
  beforeEach(() => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {},
      },
    };
    invalidateGuidanceCache();
  });

  test('normalizes source titles into stable keys', () => {
    expect(normalizeSourceTitle('  Pathfinder   Player Core  ')).toBe('pathfinder player core');
    expect(getSourceGuidanceKey('  Pathfinder   Player Core  ')).toBe('source-title:pathfinder player core');
  });

  test('reads source guidance by publication title', () => {
    global._testSettings['pf2e-leveler'].gmContentGuidance = {
      'source-title:pathfinder player core': 'recommended',
    };

    expect(getGuidanceForSourceTitle('Pathfinder Player Core')).toBe('recommended');
  });

  test('annotateGuidance applies source status when item has no direct override', () => {
    global._testSettings['pf2e-leveler'].gmContentGuidance = {
      'source-title:pathfinder player core': 'not-recommended',
    };

    const [item] = annotateGuidance([{
      uuid: 'Compendium.test.feats.Item.abc',
      name: 'Feat',
      publicationTitle: 'Pathfinder Player Core',
    }]);

    expect(item.isRecommended).toBe(false);
    expect(item.isNotRecommended).toBe(true);
    expect(item.isDisallowed).toBe(false);
    expect(item.guidanceInherited).toBe(true);
  });

  test('annotateGuidance keeps direct item guidance over source guidance', () => {
    global._testSettings['pf2e-leveler'].gmContentGuidance = {
      'source-title:pathfinder player core': 'disallowed',
      'Compendium.test.feats.Item.abc': 'recommended',
    };

    const [item] = annotateGuidance([{
      uuid: 'Compendium.test.feats.Item.abc',
      name: 'Feat',
      publicationTitle: 'Pathfinder Player Core',
    }]);

    expect(item.isRecommended).toBe(true);
    expect(item.isNotRecommended).toBe(false);
    expect(item.isDisallowed).toBe(false);
    expect(item.guidanceInherited).toBe(false);
  });
});
