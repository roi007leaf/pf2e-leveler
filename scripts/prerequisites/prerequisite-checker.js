import { parseAllPrerequisites } from './parsers.js';
import {
  matchSkill,
  matchAbility,
  matchLevel,
  matchFeat,
  matchProficiency,
  matchUnknown,
} from './matchers.js';

export function checkPrerequisites(feat, buildState) {
  const parsed = parseAllPrerequisites(feat);

  if (parsed.length === 0) {
    return { met: true, results: [] };
  }

  const results = parsed.map((p) => evaluateParsed(p, buildState));
  const met = results.every((r) => r.met !== false);

  return { met, results };
}

function evaluateParsed(parsed, buildState) {
  switch (parsed.type) {
    case 'skill':
      return matchSkill(parsed, buildState);
    case 'ability':
      return matchAbility(parsed, buildState);
    case 'level':
      return matchLevel(parsed, buildState);
    case 'feat':
      return matchFeat(parsed, buildState);
    case 'proficiency':
      return matchProficiency(parsed, buildState);
    case 'unknown':
      return matchUnknown(parsed);
    default:
      return matchUnknown(parsed);
  }
}
