export const PLAN_FEAT_KEYS = [
  'classFeats',
  'skillFeats',
  'generalFeats',
  'ancestryFeats',
  'archetypeFeats',
  'mythicFeats',
  'dualClassFeats',
  'customFeats',
];

export function getDerivedFeatSkillRules(feat) {
  const slug = normalizeFeatSlug(feat);
  if (slug !== 'operatic-adventurer') return [];

  return [{
    skill: 'performance',
    value: 'ternary(gte(@actor.level,15),4,3)',
    source: 'operatic-adventurer',
  }];
}

export function getDerivedFeatLoreRules(feat) {
  const slug = normalizeFeatSlug(feat);
  if (slug !== 'operatic-adventurer') return [];

  return [{
    skill: 'theater-lore',
    value: 1,
    source: 'operatic-adventurer',
  }];
}

export function getFeatSkillRules(feat) {
  return [
    ...(Array.isArray(feat?.skillRules) ? feat.skillRules : []),
    ...(Array.isArray(feat?.dynamicSkillRules) ? feat.dynamicSkillRules : []),
    ...getDerivedFeatSkillRules(feat),
  ];
}

export function getFeatLoreRules(feat) {
  return [
    ...(Array.isArray(feat?.dynamicLoreRules) ? feat.dynamicLoreRules : []),
    ...(Array.isArray(feat?.loreRules) ? feat.loreRules : []),
    ...getDerivedFeatLoreRules(feat),
  ];
}

function normalizeFeatSlug(feat) {
  return String(feat?.slug ?? feat?.system?.slug ?? feat?.name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
