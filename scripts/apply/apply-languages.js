const FEAT_KEYS = [
  'classFeats',
  'skillFeats',
  'generalFeats',
  'ancestryFeats',
  'archetypeFeats',
  'mythicFeats',
  'dualClassFeats',
  'customFeats',
];

export async function applyLanguages(actor, plan, level) {
  const levelData = plan.levels[level];
  const selectedLanguages = [
    ...(levelData?.intBonusLanguages ?? []),
    ...getFeatLanguageChoices(levelData),
  ];
  if (selectedLanguages.length === 0) return [];

  const current = actor.system?.details?.languages?.value ?? [];
  const merged = [...new Set([...current, ...selectedLanguages])];
  await actor.update({ 'system.details.languages.value': merged });
  return [...new Set(selectedLanguages)];
}

function getFeatLanguageChoices(levelData) {
  const languages = [];
  for (const key of FEAT_KEYS) {
    for (const feat of levelData?.[key] ?? []) {
      for (const [flag, value] of Object.entries(feat?.choices ?? {})) {
        if (!/language/i.test(flag)) continue;
        if (typeof value !== 'string' || !value.trim()) continue;
        languages.push(value.trim());
      }
    }
  }
  return languages;
}
