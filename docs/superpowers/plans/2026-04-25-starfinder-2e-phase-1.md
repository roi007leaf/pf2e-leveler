# Starfinder 2e Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first system-support layer so compendium defaults and module compatibility work for PF2e, standalone SF2e, and PF2e plus Anachronism.

**Architecture:** Create a small system-support module that resolves active system/profile state and default pack keys. Wire compendium category defaults through that module while preserving existing PF2e behavior.

**Tech Stack:** Foundry VTT module JSON, ES modules, Jest, ESLint.

---

## Files

- Create: `scripts/system-support/profiles.js`
- Modify: `scripts/compendiums/catalog.js`
- Modify: `module.json`
- Test: `tests/unit/system-support/profiles.test.js`
- Test: `tests/unit/compendiums/catalog.test.js`

## Task 1: Add System Profile Tests

- [ ] **Step 1: Write failing tests**

Create `tests/unit/system-support/profiles.test.js` with tests for:

```js
import {
  getActiveSystemProfile,
  getDefaultPackKeysForCategory,
  isAnachronismActive,
} from '../../../scripts/system-support/profiles.js';

function moduleMap(entries = []) {
  return new Map(entries.map(([id, active]) => [id, { id, active }]));
}

describe('system support profiles', () => {
  test('uses PF2e defaults in PF2e worlds without Anachronism', () => {
    const profile = getActiveSystemProfile({
      systemId: 'pf2e',
      modules: moduleMap(),
    });

    expect(profile.id).toBe('pf2e');
    expect(profile.contentProfile).toBe('pf2e');
    expect(profile.defaultPacks.feats).toEqual(['pf2e.feats-srd']);
    expect(getDefaultPackKeysForCategory('spells', { systemId: 'pf2e', modules: moduleMap() }))
      .toEqual(['pf2e.spells-srd']);
  });

  test('uses SF2e defaults in standalone SF2e worlds', () => {
    const profile = getActiveSystemProfile({
      systemId: 'sf2e',
      modules: moduleMap(),
    });

    expect(profile.id).toBe('sf2e');
    expect(profile.contentProfile).toBe('sf2e');
    expect(profile.defaultPacks.feats).toEqual(['sf2e.feats']);
    expect(profile.defaultPacks.classFeatures).toEqual(['sf2e.class-features']);
    expect(profile.defaultPacks.equipment).toEqual(['sf2e.equipment']);
  });

  test('combines PF2e and Anachronism packs when Anachronism is active in PF2e', () => {
    const modules = moduleMap([['sf2e-anachronism', true]]);
    const profile = getActiveSystemProfile({ systemId: 'pf2e', modules });

    expect(isAnachronismActive({ modules })).toBe(true);
    expect(profile.contentProfile).toBe('pf2e+sf2e-anachronism');
    expect(profile.defaultPacks.feats).toEqual(['pf2e.feats-srd', 'sf2e-anachronism.feats']);
    expect(profile.defaultPacks.classFeatures).toEqual(['pf2e.classfeatures', 'sf2e-anachronism.class-features']);
  });

  test('ignores inactive Anachronism module', () => {
    const modules = moduleMap([['sf2e-anachronism', false]]);

    expect(isAnachronismActive({ modules })).toBe(false);
    expect(getDefaultPackKeysForCategory('feats', { systemId: 'pf2e', modules }))
      .toEqual(['pf2e.feats-srd']);
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npx jest tests/unit/system-support/profiles.test.js --runInBand`

Expected: fail because `scripts/system-support/profiles.js` does not exist.

- [ ] **Step 3: Implement profile module**

Create `scripts/system-support/profiles.js` with exported helpers and pack maps.

- [ ] **Step 4: Run green test**

Run: `npx jest tests/unit/system-support/profiles.test.js --runInBand`

Expected: pass.

## Task 2: Wire Catalog Defaults Through Profile Module

- [ ] **Step 1: Write failing catalog tests**

Add tests to `tests/unit/compendiums/catalog.test.js` that mock `game.system.id`
and `game.modules` and assert `getDefaultCompendiumKeys('feats')`,
`getDefaultCompendiumKeys('classFeatures')`, and `getDefaultCompendiumKeys('spells')`
return PF2e, SF2e, and mixed Anachronism defaults.

- [ ] **Step 2: Run red test**

Run: `npx jest tests/unit/compendiums/catalog.test.js --runInBand`

Expected: SF2e and mixed assertions fail because catalog still uses static PF2e defaults.

- [ ] **Step 3: Update catalog**

Modify `scripts/compendiums/catalog.js`:

```js
import { getDefaultPackKeysForCategory } from '../system-support/profiles.js';
```

Change `getDefaultCompendiumKeys(category)` to return
`getDefaultPackKeysForCategory(category)`.

Change `locked` calculation in `discoverCompendiumsByCategory` to use
`getDefaultCompendiumKeys(category)` instead of `definition.defaultKeys`.

- [ ] **Step 4: Run green catalog test**

Run: `npx jest tests/unit/compendiums/catalog.test.js --runInBand`

Expected: pass.

## Task 3: Add SF2e Manifest Relationship

- [ ] **Step 1: Write failing manifest test**

Add an assertion to an existing manifest test if present, or create
`tests/unit/module-manifest.test.js` that imports `module.json` through
`fs.readFileSync` and asserts `relationships.systems` contains both `pf2e`
and `sf2e`.

- [ ] **Step 2: Run red test**

Run: `npx jest tests/unit/module-manifest.test.js --runInBand`

Expected: fail because `module.json` only lists `pf2e`.

- [ ] **Step 3: Update manifest**

Add an `sf2e` relationship next to `pf2e` in `module.json`.

- [ ] **Step 4: Run green manifest test**

Run: `npx jest tests/unit/module-manifest.test.js --runInBand`

Expected: pass.

## Task 4: Phase Verification

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npx jest tests/unit/system-support/profiles.test.js tests/unit/compendiums/catalog.test.js tests/unit/module-manifest.test.js --runInBand
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run lint
npm test
```

Expected: lint exits 0 and all Jest tests pass.

- [ ] **Step 3: Commit Phase 1**

Commit only Phase 1 files:

```powershell
git add scripts/system-support/profiles.js scripts/compendiums/catalog.js module.json tests/unit/system-support/profiles.test.js tests/unit/compendiums/catalog.test.js tests/unit/module-manifest.test.js docs/superpowers/plans/2026-04-25-starfinder-2e-phase-1.md
git commit -m "feat: add system support profiles"
```
