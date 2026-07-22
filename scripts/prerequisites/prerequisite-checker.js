import { parseAllPrerequisiteNodes } from './parsers.js';
import { SUBCLASS_TAGS } from '../constants.js';
import {
  matchSkill,
  matchAnySkill,
  matchRecallKnowledgeSkill,
  matchAssuranceRecallKnowledgeSkill,
  matchWeaponFamilyProficiency,
  matchLore,
  matchLanguage,
  matchAbility,
  matchLevel,
  matchFeat,
  matchClassFeature,
  matchBackground,
  matchHeritage,
  matchAncestry,
  matchAncestryFeatAccess,
  matchProficiency,
  matchClassHp,
  matchLivingCreature,
  matchDeityState,
  matchSanctificationState,
  matchSpellcastingState,
  matchClassIdentity,
  matchSubclassSpell,
  matchDivineFont,
  matchSense,
  matchEquipmentState,
  matchUnknown,
} from './matchers.js';

const SUBCLASS_REQUIREMENT_OWNERS = Object.entries(SUBCLASS_TAGS)
  .map(([classSlug, subclassTag]) => {
    const normalizedClass = normalizeSlug(classSlug);
    const normalizedTag = normalizeSlug(subclassTag);
    const prefix = `${normalizedClass}-`;
    return {
      classSlug: normalizedClass,
      subclassSlug: normalizedTag.startsWith(prefix)
        ? normalizedTag.slice(prefix.length)
        : normalizedTag,
    };
  })
  .filter((entry) => entry.classSlug && entry.subclassSlug);

export function checkPrerequisites(feat, buildState) {
  const parsed = filterClassBranchPrerequisites(
    parseAllPrerequisiteNodes(feat),
    feat,
    buildState,
  );

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

function filterClassBranchPrerequisites(nodes, feat, buildState) {
  const featClassTraits = getFeatTraitSlugs(feat);
  const activeFeatClasses = new Set(
    [...getTrackedClassSlugs(buildState)].filter((classSlug) => featClassTraits.has(classSlug)),
  );

  if (activeFeatClasses.size === 0) return nodes;

  return nodes
    .map((node) => pruneClassBranchRequirement(node, featClassTraits, activeFeatClasses))
    .filter(Boolean);
}

function pruneClassBranchRequirement(node, featClassTraits, activeFeatClasses) {
  if (!node || typeof node !== 'object') return node;

  const branchClass = getSubclassRequirementClass(node);
  if (
    branchClass
    && featClassTraits.has(branchClass)
    && !activeFeatClasses.has(branchClass)
  ) {
    return null;
  }

  if (Array.isArray(node.children)) {
    const children = node.children
      .map((child) => pruneClassBranchRequirement(child, featClassTraits, activeFeatClasses))
      .filter(Boolean);
    return children.length > 0 ? { ...node, children } : null;
  }

  if (node.child) {
    const child = pruneClassBranchRequirement(node.child, featClassTraits, activeFeatClasses);
    return child ? { ...node, child } : null;
  }

  return node;
}

function getSubclassRequirementClass(node) {
  if (node.kind !== 'leaf') return null;

  if (node.type === 'classIdentity' && node.subclassType) {
    return getClassForSubclassSlug(normalizeSlug(node.subclassType));
  }

  if (node.type !== 'feat') return null;

  const slug = normalizeSlug(node.slug);
  const text = normalizeSlug(node.text);
  if (!slug || !text) return null;

  for (const { classSlug, subclassSlug } of SUBCLASS_REQUIREMENT_OWNERS) {
    if (isSubclassRequirementSlug(slug, subclassSlug) && isSubclassRequirementText(text, subclassSlug)) {
      return classSlug;
    }
  }

  return null;
}

function getClassForSubclassSlug(subclassSlug) {
  return SUBCLASS_REQUIREMENT_OWNERS.find((entry) => entry.subclassSlug === subclassSlug)?.classSlug ?? null;
}

function isSubclassRequirementSlug(slug, subclassSlug) {
  return slug === subclassSlug
    || slug.startsWith(`${subclassSlug}-`)
    || slug.endsWith(`-${subclassSlug}`);
}

function isSubclassRequirementText(text, subclassSlug) {
  return text === subclassSlug
    || text.startsWith(`${subclassSlug}-`)
    || text.endsWith(`-${subclassSlug}`)
    || text.includes(`-${subclassSlug}-`);
}

function getFeatTraitSlugs(feat) {
  return new Set(
    [
      ...(Array.isArray(feat?.traits) ? feat.traits : []),
      ...(feat?.system?.traits?.value ?? []),
    ]
      .map(normalizeSlug)
      .filter(Boolean),
  );
}

function getTrackedClassSlugs(buildState) {
  const classes = Array.isArray(buildState?.classes) && buildState.classes.length > 0
    ? buildState.classes
    : [buildState?.class];
  return new Set(classes.map((entry) => normalizeSlug(entry?.slug)).filter(Boolean));
}

function normalizeSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
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
    case 'assuranceRecallKnowledgeSkill':
      return wrapLeafResult(matchAssuranceRecallKnowledgeSkill(parsed, buildState));
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
    case 'ancestry':
      return wrapLeafResult(matchAncestry(parsed, buildState));
    case 'ancestryFeatAccess':
      return wrapLeafResult(matchAncestryFeatAccess(parsed, buildState));
    case 'proficiency':
      return wrapLeafResult(matchProficiency(parsed, buildState));
    case 'classHp':
      return wrapLeafResult(matchClassHp(parsed, buildState));
    case 'livingCreature':
      return wrapLeafResult(matchLivingCreature(parsed, buildState));
    case 'deityState':
      return wrapLeafResult(matchDeityState(parsed, buildState));
    case 'sanctificationState':
      return wrapLeafResult(matchSanctificationState(parsed, buildState));
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
