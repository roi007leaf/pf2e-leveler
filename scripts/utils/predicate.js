import { resolveSystemPredicate } from '../system-support/profiles.js';

export function evaluatePredicate(predicate, atLevel, rollOptions = null) {
  const systemPredicate = resolveSystemPredicate();
  if (systemPredicate) {
    const result = evaluateWithSystemPredicate(systemPredicate, predicate, atLevel, rollOptions);
    if (typeof result === 'boolean') return result;
  }
  return evaluatePredicateFallback(predicate, atLevel);
}

function evaluatePredicateFallback(predicate, atLevel) {
  if (typeof predicate === 'string') return matchesPredicateString(predicate, atLevel);
  if (Array.isArray(predicate)) return predicate.every((entry) => evaluatePredicateFallback(entry, atLevel));
  if (!predicate || typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.and)) return predicate.and.every((entry) => evaluatePredicateFallback(entry, atLevel));
  if (Array.isArray(predicate.or)) return predicate.or.some((entry) => evaluatePredicateFallback(entry, atLevel));
  if ('not' in predicate) return !evaluatePredicateFallback(predicate.not, atLevel);
  if (Array.isArray(predicate.nor)) return predicate.nor.every((entry) => !evaluatePredicateFallback(entry, atLevel));
  if (Array.isArray(predicate.gte)) return comparePredicate('gte', predicate.gte, atLevel);
  if (Array.isArray(predicate.gt)) return comparePredicate('gt', predicate.gt, atLevel);
  if (Array.isArray(predicate.lte)) return comparePredicate('lte', predicate.lte, atLevel);
  if (Array.isArray(predicate.lt)) return comparePredicate('lt', predicate.lt, atLevel);
  if (Array.isArray(predicate.eq)) return comparePredicate('eq', predicate.eq, atLevel);
  return true;
}

function evaluateWithSystemPredicate(PredicateClass, predicate, atLevel, rollOptions) {
  try {
    const options = normalizeRollOptions(rollOptions, atLevel);
    if (typeof PredicateClass.test === 'function') {
      return PredicateClass.test(predicate, options);
    }
    const instance = new PredicateClass(predicate);
    if (typeof instance.test === 'function') {
      return instance.test(options);
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeRollOptions(rollOptions, atLevel) {
  const options = rollOptions instanceof Set ? new Set(rollOptions) : new Set(rollOptions ?? []);
  if (Number.isFinite(atLevel)) options.add(`self:level:${atLevel}`);
  return options;
}

function matchesPredicateString(predicate, atLevel) {
  const text = String(predicate ?? '').toLowerCase();
  const levelMatch = text.match(/^self:level:(\d+)$/);
  if (levelMatch) return atLevel >= Number(levelMatch[1]);
  return true;
}

function comparePredicate(kind, args, atLevel) {
  if (!Array.isArray(args) || args.length < 2) return true;
  const [left, right] = args;
  const leftValue = normalizePredicateOperand(left, atLevel);
  const rightValue = normalizePredicateOperand(right, atLevel);
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return true;

  switch (kind) {
    case 'gte': return leftValue >= rightValue;
    case 'gt': return leftValue > rightValue;
    case 'lte': return leftValue <= rightValue;
    case 'lt': return leftValue < rightValue;
    case 'eq': return leftValue === rightValue;
    default: return true;
  }
}

function normalizePredicateOperand(value, atLevel) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').toLowerCase();
  if (text === 'self:level') return atLevel;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}
