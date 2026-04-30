const SKILL_ALIASES = {
  acr: 'acrobatics',
  arc: 'arcana',
  ath: 'athletics',
  com: 'computers',
  cra: 'crafting',
  dec: 'deception',
  dip: 'diplomacy',
  itm: 'intimidation',
  med: 'medicine',
  nat: 'nature',
  occ: 'occultism',
  prf: 'performance',
  rel: 'religion',
  soc: 'society',
  ste: 'stealth',
  sur: 'survival',
  thi: 'thievery',
};

export function normalizeSkillSlug(value) {
  const source = Array.isArray(value) ? value[0] : value;
  const raw = typeof source === 'string'
    ? source
    : source?.value ?? source?.slug ?? source?.id ?? source?.key ?? '';
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^system\.skills\./u, '')
    .replace(/\.rank$/u, '')
    .replace(/[_\s]+/gu, '-');
  return SKILL_ALIASES[normalized] ?? normalized;
}
