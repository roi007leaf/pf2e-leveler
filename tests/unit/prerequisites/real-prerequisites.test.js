import { checkPrerequisites } from '../../../scripts/prerequisites/prerequisite-checker.js';
import { REAL_PREREQUISITE_FIXTURES } from './real-prerequisites.fixture.js';

describe('real prerequisite fixtures', () => {
  const baseState = {
    level: 5,
    class: { slug: 'alchemist', hp: 8, subclassType: null },
    deity: null,
    spellcasting: { hasAny: false, traditions: new Set(), focusPool: false, focusPointsMax: 0 },
    attributes: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: {},
    lores: {},
    feats: new Set(),
    classFeatures: new Set(),
    proficiencies: {},
    equipment: {
      hasShield: false,
      armorCategories: new Set(),
      weaponCategories: new Set(),
      weaponGroups: new Set(),
      weaponTraits: new Set(),
      wieldedMelee: false,
      wieldedRanged: false,
    },
  };

  test.each(REAL_PREREQUISITE_FIXTURES)('$label', ({ text, buildState, expected, expectedResult }) => {
    const result = checkPrerequisites(
      {
        system: {
          prerequisites: {
            value: [{ value: text }],
          },
        },
      },
      {
        ...baseState,
        ...buildState,
      },
    );

    expect(result.met).toBe(expected);
    if (expectedResult !== undefined) {
      expect(result.results.some((entry) => entry.met === expectedResult)).toBe(true);
    }
  });
});
