import { parseAllPrerequisiteNodes } from './parsers.js';
import {
  matchSkill,
  matchAnySkill,
  matchRecallKnowledgeSkill,
  matchWeaponFamilyProficiency,
  matchLore,
  matchLanguage,
  matchAbility,
  matchLevel,
  matchFeat,
  matchClassFeature,
  matchBackground,
  matchHeritage,
  matchAncestryFeatAccess,
  matchProficiency,
  matchClassHp,
  matchDeityState,
  matchSpellcastingState,
  matchClassIdentity,
  matchSubclassSpell,
  matchDivineFont,
  matchSense,
  matchEquipmentState,
  matchUnknown,
} from './matchers.js';

export function checkPrerequisites(feat, buildState) {
  const parsed = parseAllPrerequisiteNodes(feat);

  if (parsed.length === 0) {
    return { met: true, results: [], tree: null };
  }

  const root = parsed.length === 1
    ? parsed[0]
    : { kind: 'all', text: 'All prerequisites', children: parsed };
  const evaluation = evaluateRequirementNode(root, buildState);
  const met = evaluation.met !== false;

  return { met, results: evaluation.results, tree: evaluation.tree };
}

function evaluateRequirementNode(node, buildState) {
  if (!node || typeof node !== 'object') {
    const result = matchUnknown({ type: 'unknown', text: '' });
    return {
      met: result.met,
      results: [result],
      tree: { kind: 'leaf', met: result.met, result },
    };
  }

  switch (node.kind) {
    case 'all':
      return evaluateAllNode(node, buildState);
    case 'any':
      return evaluateAnyNode(node, buildState);
    case 'not':
      return evaluateNotNode(node, buildState);
    case 'leaf':
      return evaluateLeaf(node, buildState);
    default:
      return evaluateLeaf(node, buildState);
  }
}

function evaluateLeaf(parsed, buildState) {
  switch (parsed.type) {
    case 'skill':
      return wrapLeafResult(matchSkill(parsed, buildState));
    case 'anySkill':
      return wrapLeafResult(matchAnySkill(parsed, buildState));
    case 'recallKnowledgeSkill':
      return wrapLeafResult(matchRecallKnowledgeSkill(parsed, buildState));
    case 'weaponFamilyProficiency':
      return wrapLeafResult(matchWeaponFamilyProficiency(parsed, buildState));
    case 'lore':
      return wrapLeafResult(matchLore(parsed, buildState));
    case 'language':
      return wrapLeafResult(matchLanguage(parsed, buildState));
    case 'ability':
      return wrapLeafResult(matchAbility(parsed, buildState));
    case 'level':
      return wrapLeafResult(matchLevel(parsed, buildState));
    case 'feat':
      return wrapLeafResult(matchFeat(parsed, buildState));
    case 'classFeature':
      return wrapLeafResult(matchClassFeature(parsed, buildState));
    case 'background':
      return wrapLeafResult(matchBackground(parsed, buildState));
    case 'heritage':
      return wrapLeafResult(matchHeritage(parsed, buildState));
    case 'ancestryFeatAccess':
      return wrapLeafResult(matchAncestryFeatAccess(parsed, buildState));
    case 'proficiency':
      return wrapLeafResult(matchProficiency(parsed, buildState));
    case 'classHp':
      return wrapLeafResult(matchClassHp(parsed, buildState));
    case 'deityState':
      return wrapLeafResult(matchDeityState(parsed, buildState));
    case 'spellcastingState':
      return wrapLeafResult(matchSpellcastingState(parsed, buildState));
    case 'classIdentity':
      return wrapLeafResult(matchClassIdentity(parsed, buildState));
    case 'subclassSpell':
      return wrapLeafResult(matchSubclassSpell(parsed, buildState));
    case 'divineFont':
      return wrapLeafResult(matchDivineFont(parsed, buildState));
    case 'sense':
      return wrapLeafResult(matchSense(parsed, buildState));
    case 'equipmentState':
      return wrapLeafResult(matchEquipmentState(parsed, buildState));
    case 'unknown':
      return wrapLeafResult(matchUnknown(parsed));
    default:
      return wrapLeafResult(matchUnknown(parsed));
  }
}

function evaluateAllNode(node, buildState) {
  const evaluations = node.children.map((child) => evaluateRequirementNode(child, buildState));
  return {
    met: combineAll(evaluations.map((entry) => entry.met)),
    results: evaluations.flatMap((entry) => entry.results),
    tree: {
      kind: 'all',
      text: node.text,
      met: combineAll(evaluations.map((entry) => entry.met)),
      children: evaluations.map((entry) => entry.tree).filter(Boolean),
    },
  };
}

function evaluateAnyNode(node, buildState) {
  const evaluations = node.children.map((child) => evaluateRequirementNode(child, buildState));
  return {
    met: combineAny(evaluations.map((entry) => entry.met)),
    results: evaluations.flatMap((entry) => entry.results),
    tree: {
      kind: 'any',
      text: node.text,
      met: combineAny(evaluations.map((entry) => entry.met)),
      children: evaluations.map((entry) => entry.tree).filter(Boolean),
    },
  };
}

function evaluateNotNode(node, buildState) {
  const evaluation = evaluateRequirementNode(node.child, buildState);
  return {
    met: evaluation.met === null ? null : !evaluation.met,
    results: evaluation.results,
    tree: {
      kind: 'not',
      text: node.text,
      met: evaluation.met === null ? null : !evaluation.met,
      child: evaluation.tree,
    },
  };
}

function wrapLeafResult(result) {
  return {
    met: result.met,
    results: [result],
    tree: {
      kind: 'leaf',
      text: result.text,
      met: result.met,
      result,
    },
  };
}

function combineAll(values) {
  if (values.some((value) => value === false)) return false;
  if (values.every((value) => value === true)) return true;
  return null;
}

function combineAny(values) {
  if (values.some((value) => value === true)) return true;
  if (values.every((value) => value === false)) return false;
  return null;
}
