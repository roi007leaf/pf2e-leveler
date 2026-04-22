import {
  annotateGuidance,
  filterDisallowedForCurrentUser,
  getGuidanceSelectionTooltip,
  getGuidanceForSourceTitle,
  getPlayerDisallowedContentMode,
  PLAYER_DISALLOWED_CONTENT_MODES,
  getSourceGuidanceKey,
  isGuidanceSelectionBlocked,
  invalidateGuidanceCache,
  normalizeSourceTitle,
} from '../../../scripts/access/content-guidance.js';

jest.mock('../../../scripts/access/player-content.js', () => ({
  shouldRestrictContentForUser: jest.fn(() => true),
}));

const { shouldRestrictContentForUser } = jest.requireMock('../../../scripts/access/player-content.js');

describe('content guidance source rules', () => {
  beforeEach(() => {
    global._testSettings = {
      'pf2e-leveler': {
        gmContentGuidance: {},
        playerDisallowedContentMode: PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE,
      },
    };
    invalidateGuidanceCache();
    shouldRestrictContentForUser.mockReturnValue(true);
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

  test('disallowed guidance blocks players but not GMs', () => {
    global._testSettings['pf2e-leveler'].gmContentGuidance = {
      'source-title:pathfinder player core': 'disallowed',
    };

    shouldRestrictContentForUser.mockReturnValue(true);
    const [playerItem] = annotateGuidance([{
      uuid: 'Compendium.test.spells.Item.abc',
      publicationTitle: 'Pathfinder Player Core',
    }]);

    expect(isGuidanceSelectionBlocked(playerItem)).toBe(true);
    expect(playerItem.guidanceSelectionBlocked).toBe(true);
    expect(getGuidanceSelectionTooltip(playerItem)).toBe('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.BADGE_DISALLOWED');

    shouldRestrictContentForUser.mockReturnValue(false);
    const [gmItem] = annotateGuidance([{
      uuid: 'Compendium.test.spells.Item.xyz',
      publicationTitle: 'Pathfinder Player Core',
    }]);

    expect(isGuidanceSelectionBlocked(gmItem)).toBe(false);
    expect(gmItem.guidanceSelectionBlocked).toBe(false);
    expect(getGuidanceSelectionTooltip(gmItem)).toBe('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.GM_OVERRIDE_ALLOWED');
  });

  test('defaults player disallowed mode to unselectable when setting is unset', () => {
    delete global._testSettings['pf2e-leveler'].playerDisallowedContentMode;

    expect(getPlayerDisallowedContentMode()).toBe(PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE);
  });

  test('filters disallowed entries only when player mode is hidden', () => {
    global._testSettings['pf2e-leveler'].gmContentGuidance = {
      'source-title:pathfinder player core': 'disallowed',
    };
    invalidateGuidanceCache();

    const annotated = annotateGuidance([
      { uuid: 'allowed', publicationTitle: 'Other Book' },
      { uuid: 'blocked', publicationTitle: 'Pathfinder Player Core' },
    ]);

    global._testSettings['pf2e-leveler'].playerDisallowedContentMode = PLAYER_DISALLOWED_CONTENT_MODES.UNSELECTABLE;
    expect(filterDisallowedForCurrentUser(annotated).map((item) => item.uuid)).toEqual(['allowed', 'blocked']);

    global._testSettings['pf2e-leveler'].playerDisallowedContentMode = PLAYER_DISALLOWED_CONTENT_MODES.HIDDEN;
    expect(filterDisallowedForCurrentUser(annotated).map((item) => item.uuid)).toEqual(['allowed']);
  });
});
