import { casePassed } from './coverage.mjs';

// Missing scenario names remain blockers. Adding an implementation expands
// evidence; deleting an unimplemented contract cannot manufacture coverage.
export const requirements = [
  {
    name: 'Runner safety',
    scenarios: [
      'environment-module-ready',
      'fixture-actor-ownership',
      'creation-entrypoint-rendered',
    ],
  },
  {
    name: 'Character creation workflow',
    scenarios: [
      'creation-complete-pf2e',
      'creation-complete-sf2e',
      'creation-edit-existing',
      'creation-pending-choices',
      'creation-active-class-catalog',
      'creation-ancestry-heritage-catalog',
      'creation-background-catalog',
      'creation-class-subclass-catalog',
    ],
  },
  {
    name: 'Creation choices',
    scenarios: [
      'creation-ancestry-heritage',
      'creation-background-class',
      'creation-deity-subclass',
      'creation-boosts-skills',
      'creation-feats-languages',
      'creation-spells-equipment',
    ],
  },
  {
    name: 'Level planner',
    scenarios: [
      'planner-levels-2-through-20',
      'planner-validation',
      'planner-import-export',
      'planner-clear-level',
      'planner-custom-choices',
      'planner-active-class-catalog',
    ],
  },
  {
    name: 'Plan application',
    scenarios: [
      'apply-single-level',
      'apply-multiple-levels',
      'apply-cancel',
      'apply-chat-summary',
      'apply-failure-atomicity',
    ],
  },
  {
    name: 'Variant rules',
    scenarios: [
      'variant-free-archetype',
      'variant-ancestral-paragon',
      'variant-mythic',
      'variant-abp',
      'variant-gradual-boosts',
      'variant-dual-class',
    ],
  },
  {
    name: 'Spell preparation',
    scenarios: ['spellbook-entrypoint', 'spellbook-filtering', 'spellbook-duplicate-prevention'],
  },
  {
    name: 'Content and access',
    scenarios: [
      'guidance-suggested-disallowed',
      'compendium-access-gm-player',
      'review-request-workflow',
      'rarity-permissions',
    ],
  },
  {
    name: 'Settings and localization',
    scenarios: [
      'settings-save-restore',
      'localization-en-fr-cn',
      'keyboard-entrypoint',
      'window-focus',
    ],
  },
];

export function assessRequirements(catalog, results) {
  const implemented = new Set(catalog.map((entry) => entry.name));
  const outcomes = new Map(
    results.map((entry) => [entry.name, casePassed(entry) ? 'passed' : 'failed']),
  );
  const details = requirements.map((requirement) => ({
    name: requirement.name,
    missing: requirement.scenarios.filter((name) => !implemented.has(name)),
    unrun: requirement.scenarios.filter((name) => implemented.has(name) && !outcomes.has(name)),
    failed: requirement.scenarios.filter(
      (name) => outcomes.has(name) && outcomes.get(name) !== 'passed',
    ),
  }));
  return {
    complete: details.every(
      (entry) => !entry.missing.length && !entry.unrun.length && !entry.failed.length,
    ),
    details,
  };
}
