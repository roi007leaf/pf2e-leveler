import { parsePrerequisite, parseAllPrerequisites } from '../../../scripts/prerequisites/parsers.js';

describe('parsePrerequisite', () => {
  test('parses skill rank requirement', () => {
    const result = parsePrerequisite('trained in Athletics');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('athletics');
    expect(result.minRank).toBe(1);
  });

  test('parses expert rank requirement', () => {
    const result = parsePrerequisite('expert in Stealth');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('stealth');
    expect(result.minRank).toBe(2);
  });

  test('parses master rank requirement', () => {
    const result = parsePrerequisite('master in Deception');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('deception');
    expect(result.minRank).toBe(3);
  });

  test('parses legendary rank requirement', () => {
    const result = parsePrerequisite('legendary in Crafting');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('crafting');
    expect(result.minRank).toBe(4);
  });

  test('parses proficiency in non-skill subject', () => {
    const result = parsePrerequisite('expert in Perception');
    expect(result.type).toBe('proficiency');
    expect(result.key).toBe('perception');
    expect(result.minRank).toBe(2);
  });

  test('parses ability score requirement', () => {
    const result = parsePrerequisite('Strength 14');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('str');
    expect(result.minValue).toBe(14);
  });

  test('parses dexterity requirement', () => {
    const result = parsePrerequisite('Dexterity 16');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('dex');
    expect(result.minValue).toBe(16);
  });

  test('parses level requirement', () => {
    const result = parsePrerequisite('4th level');
    expect(result.type).toBe('level');
    expect(result.minLevel).toBe(4);
  });

  test('parses various level ordinals', () => {
    expect(parsePrerequisite('1st level').minLevel).toBe(1);
    expect(parsePrerequisite('2nd level').minLevel).toBe(2);
    expect(parsePrerequisite('3rd level').minLevel).toBe(3);
    expect(parsePrerequisite('12th level').minLevel).toBe(12);
  });

  test('parses feat prerequisite', () => {
    const result = parsePrerequisite('Fighter Dedication');
    expect(result.type).toBe('feat');
    expect(result.slug).toBe('fighter-dedication');
  });

  test('parses feat with apostrophe', () => {
    const result = parsePrerequisite("Alchemist's Fire");
    expect(result.type).toBe('feat');
    expect(result.slug).toBe('alchemists-fire');
  });

  test('returns unknown for empty input', () => {
    const result = parsePrerequisite('');
    expect(result.type).toBe('unknown');
  });

  test('returns unknown for null input', () => {
    const result = parsePrerequisite(null);
    expect(result.type).toBe('unknown');
  });
});

describe('parseAllPrerequisites', () => {
  test('parses all prerequisites from a feat', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'trained in Athletics' },
            { value: 'Strength 14' },
          ],
        },
      },
    };
    const results = parseAllPrerequisites(feat);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('skill');
    expect(results[1].type).toBe('ability');
  });

  test('returns empty array for feat without prerequisites', () => {
    const feat = { system: { prerequisites: { value: [] } } };
    expect(parseAllPrerequisites(feat)).toEqual([]);
  });

  test('returns empty array for null feat', () => {
    expect(parseAllPrerequisites(null)).toEqual([]);
  });
});
