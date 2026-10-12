export function createSpellFilters() {
  return {
    actions: [],
    defenses: [],
    areas: [],
    targets: [],
    ranges: [],
    sustained: '',
    areaMin: '',
    areaMax: '',
    rangeMin: '',
    rangeMax: '',
    durationMin: '',
    durationMax: '',
  };
}

function getActionCosts(value) {
  const time = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['1', '2', '3', 'reaction', 'free'].includes(time)) return [time];

  const variable = time.match(/^([1-3])\s+(to|or)\s+([1-3])$/);
  if (variable) {
    const [, start, join, end] = variable;
    return join === 'or'
      ? [start, end]
      : ['1', '2', '3'].filter(
          (cost) => Number(cost) >= Number(start) && Number(cost) <= Number(end),
        );
  }

  return /\b(?:minutes?|hours?|days?)\b/.test(time) ? ['long'] : [];
}

function getBound(value) {
  if (value == null || String(value).trim() === '') return null;
  const bound = Number(value);
  return Number.isFinite(bound) && bound >= 0 ? bound : null;
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isSelf(value) {
  return ['self', 'you', 'personal', 'yourself'].includes(value);
}

function getRange(system, hasArea) {
  const value = normalizeText(system.range?.value);
  if (
    isSelf(value) ||
    (!value &&
      (isSelf(normalizeText(system.target?.value)) ||
        (hasArea && system.area.type === 'emanation')))
  ) {
    return { categories: ['self'], distance: 0 };
  }
  if (value === 'centered on you') return { categories: ['self'], distance: 0 };
  const categories = [];
  const distances = [];
  for (const alternative of value.split(/\s+or\s+/)) {
    if (alternative === 'touch') categories.push('touch');
    else if (alternative === 'unlimited') {
      categories.push('unlimited');
      distances.push(Infinity);
    } else {
      const distance = alternative.match(
        /^(\d+(?:,\d{3})*(?:\.\d+)?)\s*(feet|foot|ft\.?|miles?)?(?:\s+\((?:see text|burst only)\))?$/,
      );
      if (distance) {
        categories.push('distance');
        distances.push(
          Number(distance[1].replaceAll(',', '')) * (distance[2]?.startsWith('mile') ? 5280 : 1),
        );
      } else categories.push('other');
    }
  }
  return {
    categories,
    distance: distances.length && !categories.includes('other') ? Math.max(...distances) : null,
  };
}

function getTargets(system, hasArea, range) {
  const value = normalizeText(system.target?.value);
  const targets = hasArea ? ['area'] : [];
  if (!value) {
    targets.push('none');
    if (range.categories.includes('self')) targets.push('self');
  } else
    for (const alternative of value.split(/\s+or\s+/)) {
      if (isSelf(alternative)) targets.push('self');
      else if (
        /\b(?:creatures|allies|enemies|objects|animals|corpses|weapons|items|companions|familiars|eidolons)\b/.test(
          alternative,
        ) ||
        /\b(?:and|plus)\s+(?:(?:up to\s+)?(?:\d+|one|a|the)\s+[^,;]*\b(?:creature|ally|enemy|object|animal|corpse|weapon|item|companion|familiar|eidolon)\b|you\b)/.test(
          alternative,
        )
      )
        targets.push('multiple');
      else if (
        /^(?:1|one|the|a)\b.*\b(?:creature|ally|enemy|object|animal|corpse|weapon|item|companion|familiar|eidolon)\b/.test(
          alternative,
        ) ||
        /^your (?:animal companion|hunted prey|familiar|eidolon|companion)$/.test(alternative)
      )
        targets.push('single');
      else targets.push('other');
    }
  return targets;
}

function getDuration(system) {
  const value = normalizeText(system.duration?.value);
  if (!value) return system.duration?.sustained === true ? null : 0;
  if (value === 'instantaneous') return 0;
  if (['permanent', 'unlimited'].includes(value)) return Infinity;
  const seconds = { round: 6, second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };
  const alternatives = value.replace(/\s+or until\b.*$/, '').split(/,?\s+or\s+/);
  const durations = alternatives.map((alternative) => {
    const duration = alternative.match(
      /^(?:sustained\s+)?(?:up to\s+)?(\d+(?:\.\d+)?)\s+(rounds?|seconds?|minutes?|hours?|days?|weeks?)(?:\s+\(see text\))?$/,
    );
    return duration ? Number(duration[1]) * seconds[duration[2].replace(/s$/, '')] : null;
  });
  return durations.includes(null) ? null : Math.max(...durations);
}

function matchesBounds(value, minimumInput, maximumInput) {
  const minimum = getBound(minimumInput);
  const maximum = getBound(maximumInput);
  if (minimum === null && maximum === null) return true;
  return (
    value !== null &&
    (minimum === null || value >= minimum) &&
    (maximum === null || value <= maximum)
  );
}

export function matchesSpellFilters(spell, filters = createSpellFilters()) {
  const system = spell?.system ?? {};
  if (
    filters.actions?.length &&
    !getActionCosts(system.time?.value).some((cost) => filters.actions.includes(cost))
  ) {
    return false;
  }

  if (filters.defenses?.length) {
    const defenses = [system.defense?.passive?.statistic, system.defense?.save?.statistic].filter(
      Boolean,
    );
    if (!defenses.length) defenses.push('none');
    if (!defenses.some((defense) => filters.defenses.includes(defense))) return false;
  }

  const areaSize = Number(system.area?.value);
  const hasArea = Boolean(system.area?.type) && Number.isFinite(areaSize) && areaSize > 0;
  if (filters.areas?.length && !filters.areas.includes(hasArea ? system.area.type : 'none'))
    return false;

  const minimum = getBound(filters.areaMin);
  const maximum = getBound(filters.areaMax);
  if (minimum !== null || maximum !== null) {
    if (!hasArea) return false;
    if (minimum !== null && areaSize < minimum) return false;
    if (maximum !== null && areaSize > maximum) return false;
  }

  const range = getRange(system, hasArea);
  if (
    filters.ranges?.length &&
    !range.categories.some((category) => filters.ranges.includes(category))
  )
    return false;
  if (!matchesBounds(range.distance, filters.rangeMin, filters.rangeMax)) return false;
  if (
    filters.targets?.length &&
    !getTargets(system, hasArea, range).some((target) => filters.targets.includes(target))
  )
    return false;
  if (!matchesBounds(getDuration(system), filters.durationMin, filters.durationMax)) return false;

  if (filters.sustained === 'yes' && system.duration?.sustained !== true) return false;
  if (filters.sustained === 'no' && system.duration?.sustained === true) return false;
  return true;
}
