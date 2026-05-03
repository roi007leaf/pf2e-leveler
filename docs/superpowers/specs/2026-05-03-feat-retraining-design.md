# Feat Retraining Design

## Goal

Allow players to plan feat retraining as part of leveling. A retrain is planned on the level where the retraining happens, but it replaces a feat taken at an earlier level.

The first version covers feats only. It does not retrain ability boosts, skill increases, spells, languages, equipment, or class feature choices.

## User Experience

The level planner adds a Feat Retrains section for the selected level.

The section lists planned retrains as old feat to new feat, including the original level and feat category. Each entry can be removed.

Adding a retrain uses a two-step flow:

1. Choose an owned prior-level feat from the actor, grouped by level and slot category.
2. Choose a replacement feat with the existing feat picker, constrained to the original feat slot category and original taken level.

Example: while planning level 8, the user can choose a level 2 class feat and replace it with another legal level 2 class feat. The retrain entry is stored on level 8.

## Data Model

Retrains are stored on the level where they are planned:

```js
plan.levels[8].retrainedFeats = [
  {
    fromLevel: 2,
    category: "classFeats",
    original: {
      uuid: "Compendium.pf2e.feats-srd.Item.old",
      sourceId: "Compendium.pf2e.feats-srd.Item.old",
      actorItemId: "abc123",
      name: "Old Feat",
      slug: "old-feat",
      img: "icons/example.webp",
      location: "class-2"
    },
    replacement: {
      uuid: "Compendium.pf2e.feats-srd.Item.new",
      name: "New Feat",
      slug: "new-feat",
      img: "icons/example.webp",
      level: 2,
      traits: ["fighter"],
      choices: {},
      system: {},
      coreMetadataVersion: 1,
      aliases: [],
      aliasesResolved: true,
      aliasesVersion: 1,
      spellcastingMetadata: null,
      spellcastingMetadataVersion: 1,
      skillRules: [],
      skillRulesResolved: true,
      skillRulesVersion: 3
    }
  }
];
```

The replacement must use the same stored-feat shape already used for planned feats so existing prerequisite, grant, alias, spellcasting, and skill-rule helpers can consume it.

## Build-State Semantics

Retraining entries are cumulative build-state mutations beginning at the level where they are planned.

If a level 8 retrain replaces a level 2 feat:

- build state for levels 2-7 still includes the original feat
- build state for level 8 and later removes the original feat
- build state for level 8 and later includes the replacement feat
- prerequisite checks for level 8 and later see the replacement as active
- prerequisite checks for level 8 and later no longer see the removed feat as active

This must be implemented in the shared build-state path, not only in apply logic. The planner UI, feat picker prerequisite checks, validation, archetype dedication progress, feat alias handling, spellcasting metadata, skill/lore rules, and later level calculations all rely on `computeBuildState(actor, plan, atLevel)`.

The build-state overlay must preserve historical truth. A retrain planned at level 8 must not make level 4 calculations pretend the replacement was already present.

## Validation

Validation for a level with retrains checks each retrain entry.

Incomplete:

- replacement feat is missing

Warning:

- original actor feat can no longer be found
- original slot/category can no longer be inferred safely

The replacement feat is checked against the original slot constraints:

- category is the original feat category
- maximum feat level is the original taken level
- prerequisite build state is the effective state at the retraining level, after earlier retrains but before this replacement is applied

This allows the replacement to qualify using current character progress while still respecting the old slot's feat level.

## Apply Behavior

Applying a level runs feat retrains before normal feat additions for that level.

For each retrain:

1. Resolve the original actor item by `actorItemId`.
2. If unavailable, fall back to a conservative source/location match.
3. If the original item is ambiguous or missing, skip that retrain and warn.
4. Create the replacement feat with the original slot location and original taken level.
5. Preserve the replacement's choice selections using the same `flags.pf2e.rulesSelections` behavior used by normal feat application.
6. Delete the original feat only when the replacement creation succeeds.

The chat message gains a Retrained Feats section that reports each successful old feat to new feat replacement.

## Modules To Touch

- `scripts/plan/plan-model.js`
  Add helpers for adding, removing, and listing level retrains. Ensure empty level data initializes `retrainedFeats`.

- `scripts/plan/build-state.js`
  Apply retrain overlays when computing feats and all derived feat effects.

- `scripts/plan/plan-validator.js`
  Validate retrain entries and surface incomplete/warning states.

- `scripts/ui/level-planner/index.js`
  Add retrain picker flow and stored replacement metadata.

- `scripts/ui/level-planner/level-context.js`
  Build display context for retrain entries and available original feats.

- `scripts/ui/level-planner/listeners.js`
  Wire add/remove retrain controls.

- `templates/level-planner.hbs`
  Render the Feat Retrains section.

- `scripts/apply/apply-feat-retrains.js`
  Add focused apply logic for replacing actor feats.

- `scripts/apply/apply-manager.js`
  Run retrains before regular feat application and include chat output.

## Testing

Unit tests must cover:

- plan-model helpers initialize, add, and remove retrains
- build-state includes original feat before retrain level and replacement feat from retrain level onward
- build-state removes original feat-derived aliases, archetype progress, and skill rules after retrain level
- validation reports missing replacement as incomplete
- validation warns when the original actor feat is missing
- level planner context renders planned retrains with original and replacement metadata
- listener removes a retrain from the selected level
- apply creates the replacement with the original location/taken level and deletes the original only after successful creation
- apply skips ambiguous or missing originals

Focused verification:

```sh
npx jest --runInBand tests/unit/plan/build-state.test.js tests/unit/plan/plan-validator.test.js tests/unit/ui/level-planner-listeners.test.js tests/unit/ui/level-planner-bootstrap.test.js tests/unit/apply/apply-feats.test.js
npx eslint scripts/plan/plan-model.js scripts/plan/build-state.js scripts/plan/plan-validator.js scripts/ui/level-planner/index.js scripts/ui/level-planner/level-context.js scripts/ui/level-planner/listeners.js scripts/apply/apply-manager.js
```

Before completion, run the full test suite if the focused set passes.

## Non-Goals

- No retraining for skills, boosts, spells, class feature choices, languages, or equipment.
- No automatic retrain suggestions.
- No broad actor-history rewrite.
- No support for replacing multiple owned copies of the same feat unless the original actor item can be identified unambiguously.
