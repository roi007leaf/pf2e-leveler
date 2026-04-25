# Starfinder 2e Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move direct PF2e setting, Predicate, and language API reads behind the system-support layer.

**Architecture:** Extend `scripts/system-support/profiles.js` with focused runtime API helpers. Migrate existing centralized helper modules (`pf2e-api.js`, `predicate.js`, and language helpers) to use those APIs while preserving PF2e behavior.

**Tech Stack:** Foundry VTT globals, ES modules, Jest, ESLint.

---

## Files

- Modify: `scripts/system-support/profiles.js`
- Modify: `scripts/utils/pf2e-api.js`
- Modify: `scripts/utils/predicate.js`
- Modify: `scripts/ui/character-wizard/skills-languages.js`
- Test: `tests/unit/system-support/profiles.test.js`
- Test: `tests/unit/utils/pf2e-api.test.js`
- Test: `tests/unit/utils/predicate.test.js`
- Test: `tests/unit/ui/skill-grants.test.js`

## Tasks

- [ ] Add failing tests for active-system settings, Predicate resolution, and SF2e language config.
- [ ] Implement minimal system-support helpers for settings, Predicate, config, and campaign language access.
- [ ] Migrate PF2e API helper functions to use system setting helper.
- [ ] Migrate Predicate resolution to use system-support.
- [ ] Migrate language map and rarity reads to use system-support config and campaign language helpers.
- [ ] Run focused tests, lint, full test suite.
- [ ] Commit Phase 2 only.
