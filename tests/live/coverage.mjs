export function casePassed(result) {
  return (
    result?.status === 'passed' &&
    result.mode === 'automated' &&
    Array.isArray(result.steps) &&
    result.steps.length > 0 &&
    result.steps.every((step) => step.status === 'passed' && step.review === undefined)
  );
}

export function coverageFor(required, results) {
  const byName = new Map(results.map((result) => [result.name, result]));
  return {
    required: required.length,
    passed: required
      .filter((testCase) => casePassed(byName.get(testCase.name)))
      .map((testCase) => testCase.name),
    failed: required
      .filter((testCase) => byName.has(testCase.name) && !casePassed(byName.get(testCase.name)))
      .map((testCase) => testCase.name),
    unrun: required
      .filter((testCase) => !byName.has(testCase.name))
      .map((testCase) => testCase.name),
  };
}

export function validateCases(cases) {
  const names = new Set();
  for (const testCase of cases) {
    if (!/^[a-z0-9-]+$/.test(testCase.name) || names.has(testCase.name)) {
      throw Error(`Invalid or duplicate case: ${testCase.name}`);
    }
    names.add(testCase.name);
    if (
      !Array.isArray(testCase.steps) ||
      !testCase.steps.some((step) => step.expect && Object.keys(step.expect).length)
    ) {
      throw Error(`Case has no observable assertion: ${testCase.name}`);
    }
    for (const step of testCase.steps) {
      if (step.session !== undefined && !['gm', 'player'].includes(step.session)) {
        throw Error(`Unknown test session: ${testCase.name}`);
      }
      if (
        step.expectedBrowserError !== undefined &&
        (typeof step.expectedBrowserError !== 'string' || !step.expectedBrowserError.length)
      ) {
        throw Error(`Invalid expected browser error: ${testCase.name}`);
      }
    }
  }
}
