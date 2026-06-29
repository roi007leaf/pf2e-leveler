import { matchesGuidanceTagFilter, GUIDANCE_TAG_VALUES } from '../../../scripts/access/content-guidance.js';

describe('matchesGuidanceTagFilter', () => {
  it('returns true when no tags are selected', () => {
    expect(matchesGuidanceTagFilter({ isRecommended: false }, new Set())).toBe(true);
    expect(matchesGuidanceTagFilter({}, null)).toBe(true);
  });
  it('matches each status to its tag', () => {
    expect(matchesGuidanceTagFilter({ isRecommended: true }, new Set(['recommended']))).toBe(true);
    expect(matchesGuidanceTagFilter({ isAllowed: true }, new Set(['allowed']))).toBe(true);
    expect(matchesGuidanceTagFilter({ isNotRecommended: true }, new Set(['not-recommended']))).toBe(true);
    expect(matchesGuidanceTagFilter({ isDisallowed: true }, new Set(['disallowed']))).toBe(true);
  });
  it('does not match when the status flag is false', () => {
    expect(matchesGuidanceTagFilter({ isRecommended: false }, new Set(['recommended']))).toBe(false);
    expect(matchesGuidanceTagFilter({}, new Set(['disallowed']))).toBe(false);
  });
  it('ORs multiple selected tags', () => {
    const sel = new Set(['recommended', 'disallowed']);
    expect(matchesGuidanceTagFilter({ isDisallowed: true }, sel)).toBe(true);
    expect(matchesGuidanceTagFilter({ isAllowed: true }, sel)).toBe(false);
  });
  it('exposes the canonical tag values in order', () => {
    expect(GUIDANCE_TAG_VALUES).toEqual(['recommended', 'allowed', 'not-recommended', 'disallowed']);
  });
});
