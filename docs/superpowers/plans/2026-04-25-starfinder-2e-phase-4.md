# Starfinder 2e Phase 4 Implementation Plan

**Goal:** Make character creation and wizard spell-choice parsing accept active SF2e and Anachronism spell packs instead of PF2e-only `spells-srd` links.

**Scope:** Spell UUID parsing used by creation, loaders, and synthetic spell choice sets. Generic SF2e class derivation remains separate if creation flow tests show it needs deeper work.

## Files

- Modify: `scripts/creation/apply-creation.js`
- Modify: `scripts/ui/character-wizard/loaders.js`
- Modify: `scripts/ui/character-wizard/choice-sets.js`
- Test: `tests/unit/creation/apply-creation.test.js`
- Test: `tests/unit/ui/spell-uuid-parsing.test.js`
- Test: `tests/unit/ui/subclass-choice-set-parser.test.js`

## Tasks

- [x] Add red tests for SF2e loader spell UUID parsing.
- [x] Add red tests for SF2e selected spell choice detection in creation.
- [x] Add red tests for SF2e synthetic embedded spell choice generation.
- [x] Replace PF2e-only spell UUID regexes with system-support helpers.
- [x] Run focused tests.
- [x] Run full lint and Jest.
- [x] Commit Phase 4.
