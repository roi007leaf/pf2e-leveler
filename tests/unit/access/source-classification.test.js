import {
  NO_GUNS_TRAITS,
  isRemasterItem,
  itemHasExcludedTechTrait,
  isPublicationDisallowed,
  filterDisallowedSourcePublications,
  getPublicationFilterMode,
} from '../../../scripts/access/source-classification.js';
import * as guidance from '../../../scripts/access/content-guidance.js';

describe('source-classification', () => {
  describe('isRemasterItem', () => {
    it('is true when publication.remaster is true', () => {
      expect(isRemasterItem({ system: { publication: { remaster: true } } })).toBe(true);
    });
    it('is false when remaster is missing or false', () => {
      expect(isRemasterItem({ system: { publication: { remaster: false } } })).toBe(false);
      expect(isRemasterItem({ system: {} })).toBe(false);
      expect(isRemasterItem(null)).toBe(false);
    });
  });

  describe('itemHasExcludedTechTrait', () => {
    it('is true when the item carries a no-guns trait (case-insensitive)', () => {
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['Firearm'] } } })).toBe(true);
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['tech'] } } })).toBe(true);
    });
    it('is false otherwise', () => {
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['magical'] } } })).toBe(false);
      expect(itemHasExcludedTechTrait({})).toBe(false);
    });
    it('exposes the trait set', () => {
      expect(NO_GUNS_TRAITS instanceof Set).toBe(true);
    });
  });

  describe('isPublicationDisallowed', () => {
    afterEach(() => jest.restoreAllMocks());
    it('is true when the source guidance is disallowed', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(isPublicationDisallowed('Guns & Gears')).toBe(true);
    });
    it('is false for any other status', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue(null);
      expect(isPublicationDisallowed('Player Core')).toBe(false);
    });
  });

  describe('filterDisallowedSourcePublications', () => {
    afterEach(() => jest.restoreAllMocks());
    const opts = [{ key: 'Player Core' }, { key: 'Banned Book' }];

    it('returns all options in show mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(filterDisallowedSourcePublications(opts, { mode: 'show', isGM: false })).toHaveLength(2);
    });
    it('drops disallowed sources in hide mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle')
        .mockImplementation((t) => (t === 'Banned Book' ? 'disallowed' : null));
      const result = filterDisallowedSourcePublications(opts, { mode: 'hide', isGM: true });
      expect(result.map((o) => o.key)).toEqual(['Player Core']);
    });
    it('keeps disallowed sources for GMs in hide-non-gm mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(filterDisallowedSourcePublications(opts, { mode: 'hide-non-gm', isGM: true })).toHaveLength(2);
    });
    it('drops disallowed sources for non-GMs in hide-non-gm mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle')
        .mockImplementation((t) => (t === 'Banned Book' ? 'disallowed' : null));
      expect(filterDisallowedSourcePublications(opts, { mode: 'hide-non-gm', isGM: false }))
        .toHaveLength(1);
    });
  });

  describe('getPublicationFilterMode', () => {
    const realGet = global.game.settings.get;
    afterEach(() => { global.game.settings.get = realGet; });
    it('returns the configured mode', () => {
      global.game.settings.get = jest.fn(() => 'hide');
      expect(getPublicationFilterMode()).toBe('hide');
    });
    it('falls back to show on error', () => {
      global.game.settings.get = jest.fn(() => { throw new Error('not registered'); });
      expect(getPublicationFilterMode()).toBe('show');
    });
  });
});
