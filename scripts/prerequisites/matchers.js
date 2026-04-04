export function matchSkill(parsed, buildState) {
  const currentRank = buildState.skills[parsed.skill] ?? 0;
  return {
    met: currentRank >= parsed.minRank,
    text: parsed.text,
  };
}

export function matchAbility(parsed, buildState) {
  const currentMod = buildState.attributes[parsed.ability] ?? 0;
  if (parsed.isModifier) {
    return { met: currentMod >= parsed.minValue, text: parsed.text };
  }
  const currentScore = 10 + currentMod * 2;
  return { met: currentScore >= parsed.minValue, text: parsed.text };
}

export function matchLevel(parsed, buildState) {
  return {
    met: buildState.level >= parsed.minLevel,
    text: parsed.text,
  };
}

export function matchFeat(parsed, buildState) {
  const met = buildState.feats.has(parsed.slug) || !!buildState.classFeatures?.has(parsed.slug);
  return { met, text: parsed.text };
}

export function matchProficiency(parsed, buildState) {
  const proficiencies = buildState.proficiencies ?? {};
  const normalizedKey = normalizeProficiencyKey(parsed.key);
  const currentRank = Object.entries(proficiencies).find(([key]) => normalizeProficiencyKey(key) === normalizedKey)?.[1] ?? 0;
  return {
    met: currentRank >= parsed.minRank,
    text: parsed.text,
  };
}

export function matchUnknown(parsed) {
  return {
    met: null,
    text: parsed.text,
  };
}

function normalizeProficiencyKey(key) {
  return String(key ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
