import { checkPrerequisites } from '../../../scripts/prerequisites/prerequisite-checker.js';

describe('checkPrerequisites', () => {
  const buildState = {
    level: 5,
    attributes: { str: 2, dex: 1, con: 1, int: 3, wis: 0, cha: 0 },
    skills: { athletics: 2, crafting: 1, stealth: 0 },
    feats: new Set(['quick-bomber', 'alchemical-crafting']),
    classFeatures: new Set(['alchemy', 'research-field']),
    proficiencies: { perception: 1, classDC: 1, fortitude: 2 },
  };

  test('feat with no prerequisites is met', () => {
    const feat = { system: { prerequisites: { value: [] } } };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  test('feat with met skill prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'trained in Athletics' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('feat with unmet skill prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'expert in Stealth' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].met).toBe(false);
  });

  test('feat with met feat prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Quick Bomber' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('feat with unmet feat prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Power Attack' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });

  test('feat with met ability prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Strength 14' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('feat with unmet ability prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Charisma 16' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });

  test('feat with multiple prerequisites (all met)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'trained in Athletics' },
            { value: 'Quick Bomber' },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  test('feat with multiple prerequisites (one unmet)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'trained in Athletics' },
            { value: 'Power Attack' },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].met).toBe(true);
    expect(result.results[1].met).toBe(false);
  });

  test('unrecognized text is treated as feat prerequisite (slug match)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Some Obscure Requirement' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].text).toBe('Some Obscure Requirement');
  });

  test('matches feat prerequisites against parenthetical feat aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Efficient Alchemy' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['efficient-alchemy-alchemist', 'efficient-alchemy']),
    });
    expect(result.met).toBe(true);
  });

  test('met level prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: '4th level' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('unmet level prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: '8th level' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });
});
