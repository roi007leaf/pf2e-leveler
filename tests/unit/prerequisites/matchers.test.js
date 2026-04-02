import {
  matchSkill,
  matchAbility,
  matchLevel,
  matchFeat,
  matchProficiency,
  matchUnknown,
} from '../../../scripts/prerequisites/matchers.js';

describe('matchSkill', () => {
  test('met when skill rank is sufficient', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'athletics', minRank: 1, text: 'trained in Athletics' },
      { skills: { athletics: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when skill rank is insufficient', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'athletics', minRank: 2, text: 'expert in Athletics' },
      { skills: { athletics: 1 } },
    );
    expect(result.met).toBe(false);
  });

  test('not met when skill is untrained', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'arcana', minRank: 1, text: 'trained in Arcana' },
      { skills: { arcana: 0 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchAbility', () => {
  test('met when ability score is sufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'str', minValue: 14, text: 'Strength 14' },
      { attributes: { str: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when ability score is insufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'str', minValue: 14, text: 'Strength 14' },
      { attributes: { str: 1 } },
    );
    expect(result.met).toBe(false);
  });

  test('mod 0 gives score 10', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'dex', minValue: 12, text: 'Dexterity 12' },
      { attributes: { dex: 0 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchLevel', () => {
  test('met when level is sufficient', () => {
    const result = matchLevel(
      { type: 'level', minLevel: 4, text: '4th level' },
      { level: 5 },
    );
    expect(result.met).toBe(true);
  });

  test('not met when level is insufficient', () => {
    const result = matchLevel(
      { type: 'level', minLevel: 4, text: '4th level' },
      { level: 3 },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchFeat', () => {
  test('met when feat is in build state', () => {
    const result = matchFeat(
      { type: 'feat', slug: 'fighter-dedication', text: 'Fighter Dedication' },
      { feats: new Set(['fighter-dedication', 'power-attack']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met when feat is missing', () => {
    const result = matchFeat(
      { type: 'feat', slug: 'fighter-dedication', text: 'Fighter Dedication' },
      { feats: new Set(['power-attack']) },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchProficiency', () => {
  test('met when proficiency rank is sufficient', () => {
    const result = matchProficiency(
      { type: 'proficiency', key: 'perception', minRank: 2, text: 'expert in Perception' },
      { proficiencies: { perception: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when proficiency is insufficient', () => {
    const result = matchProficiency(
      { type: 'proficiency', key: 'perception', minRank: 2, text: 'expert in Perception' },
      { proficiencies: { perception: 1 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchUnknown', () => {
  test('returns null met value', () => {
    const result = matchUnknown({ type: 'unknown', text: 'something weird' });
    expect(result.met).toBeNull();
  });
});
