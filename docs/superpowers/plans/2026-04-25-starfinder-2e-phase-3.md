# Starfinder 2e Phase 3 Implementation Plan

**Goal:** Route runtime spell/equipment UUID handling through active system profiles so PF2e, SF2e, and PF2e plus Anachronism use correct compendium pack keys.

**Scope:** Runtime pack/UUID helpers and direct consumers. Static PF2e subclass data tables remain out of scope for this phase.

## Files

- Modify: `scripts/system-support/profiles.js`
- Modify: `scripts/apply/apply-feats.js`
- Modify: `scripts/apply/apply-spells.js`
- Modify: `scripts/utils/spellcasting-support.js`
- Test: `tests/unit/system-support/profiles.test.js`
- Test: `tests/unit/apply/apply-feats.test.js`
- Test: focused existing spell application tests, plus a small support test if needed

## Tasks

- [x] Add profile UUID helper tests for parsing, category filtering, UUID extraction, and active-system UUID construction.
- [x] Implement profile UUID helpers.
- [x] Add failing SF2e focus-spell grant coverage for feat GrantItem and description links.
- [x] Route feat focus-spell detection through profile helpers.
- [x] Route spell-name resolution through active spell packs.
- [x] Route spellbook equipment lookup through active equipment packs.
- [x] Run focused tests.
- [x] Run full lint and Jest.
- [x] Commit Phase 3.
