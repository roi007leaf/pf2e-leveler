export const DEFAULT_QA_WORLD = 'leveler-qa';

export function assertQaWorld(actual, expected = DEFAULT_QA_WORLD) {
  if (typeof expected !== 'string' || !expected.trim())
    throw Error('QA world ID must not be blank');
  if (actual !== expected) {
    throw Error(
      `Wrong Foundry world: "${actual ?? 'unknown'}". Expected QA world "${expected}". Launch that disposable world, then rerun. No test changes were made.`,
    );
  }
}
