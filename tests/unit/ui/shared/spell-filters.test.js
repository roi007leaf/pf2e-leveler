import {
  createSpellFilters,
  matchesSpellFilters,
} from '../../../../scripts/ui/shared/spell-filters.js';

const spell = (system = {}) => ({ system });
const matches = (system, filters) =>
  matchesSpellFilters(spell(system), { ...createSpellFilters(), ...filters });

describe('advanced spell filters', () => {
  test('creates independent empty filter state', () => {
    const filters = createSpellFilters();
    expect(filters).toEqual({
      actions: [],
      defenses: [],
      areas: [],
      targets: [],
      ranges: [],
      rangeMin: '',
      rangeMax: '',
      durationMin: '',
      durationMax: '',
      sustained: '',
      areaMin: '',
      areaMax: '',
    });
    filters.actions.push('1');
    expect(createSpellFilters().actions).toEqual([]);
    expect(matchesSpellFilters({}, createSpellFilters())).toBe(true);
  });

  test.each(['1', '2', '3', 'reaction', 'free'])('matches exact %s action cost', (value) => {
    expect(matches({ time: { value } }, { actions: [value] })).toBe(true);
    expect(matches({ time: { value } }, { actions: ['long'] })).toBe(false);
  });

  test.each([
    ['1 to 3', '1', true],
    ['1 to 3', '2', true],
    ['1 to 3', '3', true],
    ['1 or 2', '1', true],
    ['1 or 2', '2', true],
    ['1 or 2', '3', false],
    ['2 or 3', '1', false],
    ['2 or 3', '3', true],
  ])('matches variable cost %s against %s', (value, selected, expected) => {
    expect(matches({ time: { value } }, { actions: [selected] })).toBe(expected);
  });

  test.each(['1 minute', '10 minutes', '1 hour', '8 hours', '1 day', '2 days'])(
    'matches long casting time %s',
    (value) => {
      expect(matches({ time: { value } }, { actions: ['long'] })).toBe(true);
      expect(matches({ time: { value } }, { actions: ['1', '2', '3'] })).toBe(false);
    },
  );

  test('unknown casting time does not match an action filter', () => {
    expect(matches({}, { actions: ['1'] })).toBe(false);
    expect(matches({ time: { value: 'special' } }, { actions: ['long'] })).toBe(false);
    expect(matches({ time: { value: '2 rounds' } }, { actions: ['2'] })).toBe(false);
  });

  test.each(['fortitude', 'reflex', 'will'])('matches structured %s save', (statistic) => {
    expect(matches({ defense: { save: { statistic } } }, { defenses: [statistic] })).toBe(true);
    expect(matches({ defense: { save: { statistic } } }, { defenses: ['none'] })).toBe(false);
  });

  test('matches passive AC and combined defenses with OR within a group', () => {
    const defense = { passive: { statistic: 'ac' }, save: { statistic: 'reflex' } };
    expect(matches({ defense }, { defenses: ['ac'] })).toBe(true);
    expect(matches({ defense }, { defenses: ['fortitude', 'reflex'] })).toBe(true);
    expect(matches({ defense }, { defenses: ['will'] })).toBe(false);
  });

  test('none defense uses structured fields only', () => {
    expect(matches({ defense: null }, { defenses: ['none'] })).toBe(true);
    expect(
      matches({ description: { value: 'Attempt a Reflex save.' } }, { defenses: ['reflex'] }),
    ).toBe(false);
    expect(matches({ defense: { passive: null, save: null } }, { defenses: ['none'] })).toBe(true);
  });

  test.each(['burst', 'cone', 'emanation', 'line', 'cube', 'square', 'cylinder'])(
    'matches %s area',
    (type) => {
      expect(matches({ area: { type, value: 20 } }, { areas: [type] })).toBe(true);
      expect(matches({ area: { type, value: 20 } }, { areas: ['none'] })).toBe(false);
      expect(matches({ area: { type, value: 0 } }, { areas: [type] })).toBe(false);
    },
  );

  test('missing or nonpositive area matches none', () => {
    for (const area of [null, { type: 'burst', value: 0 }, { type: 'cone', value: -5 }]) {
      expect(matches({ area }, { areas: ['none'] })).toBe(true);
    }
  });

  test('area bounds are inclusive and accept input strings', () => {
    expect(matches({ area: { type: 'burst', value: 20 } }, { areaMin: '20', areaMax: '20' })).toBe(
      true,
    );
    expect(matches({ area: { type: 'burst', value: 15 } }, { areaMin: '20' })).toBe(false);
    expect(matches({ area: { type: 'cone', value: 30 } }, { areaMax: '20' })).toBe(false);
    expect(matches({ area: { type: 'cone', value: 30 } }, { areaMin: '20' })).toBe(true);
    expect(matches({}, { areaMin: '0' })).toBe(false);
    expect(matches({ area: { type: 'burst', value: 0 } }, { areaMax: '20' })).toBe(false);
  });

  test('ignores invalid or blank bounds', () => {
    expect(matches({}, { areaMin: ' ', areaMax: 'invalid' })).toBe(true);
    expect(matches({}, { areaMin: '-1' })).toBe(true);
  });

  test('sustained uses structured boolean', () => {
    expect(matches({ duration: { sustained: true } }, { sustained: 'yes' })).toBe(true);
    expect(matches({ duration: { sustained: true } }, { sustained: 'no' })).toBe(false);
    expect(matches({ duration: { sustained: false } }, { sustained: 'no' })).toBe(true);
    expect(matches({}, { sustained: 'yes' })).toBe(false);
    expect(matches({}, { sustained: 'no' })).toBe(true);
  });

  test('combines groups with AND, options within groups with OR', () => {
    const system = {
      time: { value: '2' },
      defense: { save: { statistic: 'reflex' } },
      area: { type: 'cone', value: 30 },
      duration: { sustained: false },
    };
    const filters = {
      actions: ['1', '2'],
      defenses: ['reflex', 'will'],
      areas: ['burst', 'cone'],
      areaMin: '20',
      sustained: 'no',
    };
    expect(matches(system, filters)).toBe(true);
    expect(matches(system, { ...filters, sustained: 'yes' })).toBe(false);
  });

  test.each([
    ['self', 'self'],
    ['you', 'self'],
    ['personal', 'self'],
    ['1 creature', 'single'],
    ['one willing creature', 'single'],
    ['1 object', 'single'],
    ['up to 4 creatures', 'multiple'],
    ['2 willing creatures', 'multiple'],
    ['any number of creatures', 'multiple'],
    ['creatures', 'multiple'],
    ['willing creatures', 'multiple'],
    ['special', 'other'],
    ['', 'none'],
  ])('classifies target %s as %s', (value, category) => {
    expect(matches({ target: { value } }, { targets: [category] })).toBe(true);
  });

  test('area and explicit targets match independently; self requires evidence', () => {
    const system = { target: { value: '1 creature' }, area: { type: 'burst', value: 20 } };
    expect(matches(system, { targets: ['area'] })).toBe(true);
    expect(matches(system, { targets: ['single'] })).toBe(true);
    expect(matches({}, { targets: ['self'] })).toBe(false);
    expect(matches({ range: { value: 'self' } }, { targets: ['self'] })).toBe(true);
    expect(matches({ area: { type: 'emanation', value: 10 } }, { targets: ['self'] })).toBe(true);
    expect(matches({ area: { type: 'burst', value: 20 } }, { targets: ['none'] })).toBe(true);
    expect(matches({ target: { value: 'self' } }, { targets: ['none'] })).toBe(false);
    expect(matches({ range: { value: 'self' } }, { targets: ['none'] })).toBe(true);
    expect(matches({}, { targets: ['other'] })).toBe(false);
  });

  test.each([
    ['touch', 'touch'],
    ['self', 'self'],
    ['personal', 'self'],
    ['unlimited', 'unlimited'],
    ['120 feet', 'distance'],
    ['1 mile', 'distance'],
    ['500 feet; see text', 'other'],
    ['planetary', 'other'],
    ['', 'other'],
  ])('classifies range %s as %s', (value, category) => {
    expect(matches({ range: { value } }, { ranges: [category] })).toBe(true);
  });

  test('range bounds convert miles, include boundaries, and reject unknown or touch', () => {
    expect(matches({ range: { value: '1 mile' } }, { rangeMin: '5280', rangeMax: '5280' })).toBe(
      true,
    );
    expect(matches({ range: { value: '120 feet' } }, { rangeMax: '119' })).toBe(false);
    expect(matches({ range: { value: '120 feet' } }, { rangeMin: '121' })).toBe(false);
    expect(matches({ range: { value: 'touch' } }, { rangeMin: '0' })).toBe(false);
    expect(matches({}, { rangeMax: '30' })).toBe(false);
    expect(matches({ range: { value: 'self' } }, { rangeMax: '0' })).toBe(true);
    expect(matches({ range: { value: '' }, target: { value: 'you' } }, { ranges: ['self'] })).toBe(
      true,
    );
    expect(matches({ range: { value: 'unlimited' } }, { rangeMin: '5000' })).toBe(true);
    expect(matches({ range: { value: 'unlimited' } }, { rangeMax: '5000' })).toBe(false);
  });

  test.each([
    ['1 round', 6],
    ['2 rounds', 12],
    ['up to 1 minute', 60],
    ['1 minute or until dismissed', 60],
    ['1 hour', 3600],
    ['1 day', 86400],
    ['1 week', 604800],
    ['instantaneous', 0],
    ['sustained up to 1 minute', 60],
  ])('converts duration %s to %s seconds', (value, seconds) => {
    expect(
      matches(
        { duration: { value } },
        { durationMin: String(seconds), durationMax: String(seconds) },
      ),
    ).toBe(true);
    expect(matches({ duration: { value } }, { durationMin: String(seconds + 1) })).toBe(false);
  });

  test('blank duration is instantaneous unless sustained; unknown durations fail bounds', () => {
    expect(matches({}, { durationMax: '0' })).toBe(true);
    expect(matches({ duration: { value: '', sustained: true } }, { durationMax: '60' })).toBe(
      false,
    );
    for (const value of ['special', 'varies', 'until your next turn', '1 minute per level']) {
      expect(matches({ duration: { value } }, { durationMin: '0' })).toBe(false);
    }
    expect(matches({ duration: { value: 'permanent' } }, { durationMin: '60' })).toBe(true);
    expect(matches({ duration: { value: 'unlimited' } }, { durationMax: '60' })).toBe(false);
  });

  test.each([
    '1 ally and 1 enemy',
    '1 creature and 1 object',
    'you and 1 ally',
    '1 creature, plus any number of additional creatures',
    'You and up to 10 willing living allies',
    'two creatures',
    'up to seven willing creatures',
  ])('classifies actual mixed target %s as multiple', (value) => {
    expect(matches({ target: { value } }, { targets: ['multiple'] })).toBe(true);
    expect(matches({ target: { value } }, { targets: ['single'] })).toBe(false);
  });

  test('target alternatives match each supported category', () => {
    const system = { target: { value: '1 creature or self' } };
    expect(matches(system, { targets: ['self'] })).toBe(true);
    expect(matches(system, { targets: ['single'] })).toBe(true);
    expect(matches(system, { targets: ['multiple'] })).toBe(false);
    const mixed = {
      target: { value: '1 creature or object tracked and up to 5 other willing creatures' },
    };
    expect(matches(mixed, { targets: ['single'] })).toBe(true);
    expect(matches(mixed, { targets: ['multiple'] })).toBe(true);
  });

  test.each([
    'the triggering creature',
    'one living creature',
    'your animal companion',
    'your hunted prey',
    '1 animal',
    '1 corpse',
    '1 weapon',
    '1 unattended item',
    'your familiar',
    'your eidolon',
    'your companion',
  ])('recognizes singular target %s', (value) => {
    expect(matches({ target: { value } }, { targets: ['single'] })).toBe(true);
  });

  test.each(['weapons', 'items', 'animals', 'corpses', 'companions', 'familiars'])(
    'recognizes multiple %s targets',
    (value) => {
      expect(matches({ target: { value } }, { targets: ['multiple'] })).toBe(true);
      expect(matches({ target: { value } }, { targets: ['single'] })).toBe(false);
    },
  );

  test.each([
    ['120', 120],
    ['1,000 feet', 1000],
    ['60 ft', 60],
    ['30 feet (burst only)', 30],
    ['30 feet (see text)', 30],
  ])('recognizes installed range %s', (value, feet) => {
    expect(
      matches(
        { range: { value } },
        { ranges: ['distance'], rangeMin: String(feet), rangeMax: String(feet) },
      ),
    ).toBe(true);
  });

  test('touch or distance alternatives match both categories', () => {
    const system = { range: { value: 'touch or 30 feet' } };
    expect(matches(system, { ranges: ['touch'] })).toBe(true);
    expect(matches(system, { ranges: ['distance'], rangeMax: '30' })).toBe(true);
    expect(matches(system, { rangeMax: '29' })).toBe(false);
    expect(matches({ range: { value: 'centered on you' } }, { ranges: ['self'] })).toBe(true);
  });

  test.each([
    '1 creature you know by name and have met in person',
    '1 corpse that has a level no higher than your level and has died within the past 3 days',
  ])('does not mistake target qualification for multiple targets: %s', (value) => {
    expect(matches({ target: { value } }, { targets: ['multiple'] })).toBe(false);
    expect(matches({ target: { value } }, { targets: ['single'] })).toBe(true);
  });

  test('unknown range alternative prevents numeric bounds from guessing', () => {
    const system = { range: { value: '30 feet or varies' } };
    expect(matches(system, { ranges: ['distance'] })).toBe(true);
    expect(matches(system, { ranges: ['other'] })).toBe(true);
    expect(matches(system, { rangeMin: '0' })).toBe(false);
    expect(matches(system, { rangeMax: '30' })).toBe(false);
  });

  test.each([
    ['1 minute (see text)', 60],
    ['1 minute, or 8 hours', 28800],
    ['10 minutes or 8 hours', 28800],
    ['1 round or sustained up to 1 minute', 60],
  ])('uses maximum supported duration %s', (value, seconds) => {
    expect(
      matches(
        { duration: { value } },
        { durationMin: String(seconds), durationMax: String(seconds) },
      ),
    ).toBe(true);
  });
});
