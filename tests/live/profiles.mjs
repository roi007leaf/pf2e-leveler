export const profiles = [
  { name: 'foundry14-pf2e', core: 14, system: 'pf2e', modules: [] },
  {
    name: 'foundry14-pf2e-sf2e-anachronism',
    core: 14,
    system: 'pf2e',
    modules: ['sf2e-anachronism'],
  },
  { name: 'foundry14-sf2e', core: 14, system: 'sf2e', modules: [] },
  {
    name: 'foundry14-sf2e-pf2e-anachronism',
    core: 14,
    system: 'sf2e',
    modules: ['pf2e-anachronism'],
  },
];

export function caseAppliesToProfile(testCase, profileName) {
  return !testCase.profiles?.length || testCase.profiles.includes(profileName);
}

export function detectProfile(environment) {
  const active = new Set(
    environment.modules?.filter((entry) => entry.active).map((entry) => entry.id),
  );
  return (
    profiles.find(
      (profile) =>
        Number(environment.core?.split('.')[0]) === profile.core &&
        environment.system === profile.system &&
        profile.modules.every((id) => active.has(id)) &&
        !['sf2e-anachronism', 'pf2e-anachronism'].some(
          (id) => active.has(id) && !profile.modules.includes(id),
        ),
    ) ?? null
  );
}

export function assessMatrix(catalog, reports, fingerprint) {
  const details = profiles.map((profile) => {
    const matches = reports.filter(
      (report) =>
        report.profile === profile.name &&
        report.sourceFingerprint === fingerprint &&
        report.cleanup === 'complete' &&
        !report.error &&
        !report.sourceChangedDuringRun,
    );
    const latest = matches
      .sort((left, right) => String(left.finished).localeCompare(String(right.finished)))
      .at(-1);
    const required = catalog.filter((testCase) => caseAppliesToProfile(testCase, profile.name));
    const coverage = latest?.coverage ?? {
      required: required.length,
      passed: [],
      failed: [],
      unrun: required.map((entry) => entry.name),
    };
    return { profile: profile.name, reports: matches.length, ...coverage };
  });
  return {
    complete: details.every((entry) => !entry.failed.length && !entry.unrun.length),
    details,
  };
}
