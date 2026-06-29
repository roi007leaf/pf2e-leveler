# Issue #82 Phase 1 — Source classification helper + hide disallowed sources (#4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared source-classification helper and use it to optionally hide disallowed-source publications from the picker/wizard publication filters (issue #82 item #4).

**Architecture:** One new pure-ish module `scripts/access/source-classification.js` centralizes three source/item predicates (`isPublicationDisallowed`, `isRemasterItem`, `itemHasExcludedTechTrait`). A new `publicationFilterVisibility` world setting controls whether disallowed-source entries are removed from the publication filter *lists* (results are already filtered by existing guidance). The three pickers and the character wizard route their publication-option building through a single shared filter so the behaviour is identical everywhere.

**Tech Stack:** Foundry VTT module (ES modules, no build step — `scripts/` loaded directly), Handlebars templates, Jest (jsdom) tests, ESLint. PF2e system.

## Global Constraints

- No build step: edits to `scripts/` load directly; verification is `npm run lint` + `npm test` (jest). Copy these verbatim.
- Every literal `{{localize "PF2E_LEVELER.*"}}` template key MUST exist in `lang/en.json` — enforced by `tests/unit/i18n-template-keys.test.js`.
- Module id constant: `MODULE_ID` from `scripts/constants.js` (value `"pf2e-leveler"`).
- Settings registered in `scripts/settings.js` inside `registerSettings()`.
- Commit message trailer (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- This is Phase 1 of 4. Phases 2 (#8 toggles), 3 (#5b tag filter), 4 (#6 GM review) are planned separately and reuse this helper.

## File Structure

- Create `scripts/access/source-classification.js` — the three predicates + `NO_GUNS_TRAITS` + `filterDisallowedSourcePublications(options)`. One responsibility: classify a publication/item.
- Create `tests/unit/access/source-classification.test.js` — unit tests for the module.
- Modify `scripts/settings.js` — register `publicationFilterVisibility` choice setting.
- Modify `lang/en.json` — setting name/hint/choice labels.
- Modify `scripts/ui/spell-picker.js`, `scripts/ui/item-picker.js`, `scripts/ui/feat-picker.js` — route `_getPublicationOptions()` through the shared filter.
- Modify `scripts/ui/character-wizard/index.js` — route `buildPublicationOptions()` output through the shared filter.

---

### Task 1: Source-classification helper

**Files:**
- Create: `scripts/access/source-classification.js`
- Test: `tests/unit/access/source-classification.test.js`

**Interfaces:**
- Consumes: `getGuidanceForSourceTitle(title)` from `scripts/access/content-guidance.js` (returns `'disallowed' | 'recommended' | ... | null`).
- Produces:
  - `NO_GUNS_TRAITS: Set<string>`
  - `isPublicationDisallowed(title: string): boolean`
  - `isRemasterItem(item): boolean`
  - `itemHasExcludedTechTrait(item): boolean`
  - `filterDisallowedSourcePublications(options: Array<{key?, value?, title?, label?}>, { mode: 'show'|'hide'|'hide-non-gm', isGM: boolean }): Array` — returns `options` unchanged unless the mode (and role) require dropping entries whose title is a disallowed source. The publication title for each option is read from `option.title ?? option.key ?? option.value ?? option.label`.

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/access/source-classification.test.js
import {
  NO_GUNS_TRAITS,
  isRemasterItem,
  itemHasExcludedTechTrait,
  isPublicationDisallowed,
  filterDisallowedSourcePublications,
} from '../../../scripts/access/source-classification.js';
import * as guidance from '../../../scripts/access/content-guidance.js';

describe('source-classification', () => {
  describe('isRemasterItem', () => {
    it('is true when publication.remaster is true', () => {
      expect(isRemasterItem({ system: { publication: { remaster: true } } })).toBe(true);
    });
    it('is false when remaster is missing or false', () => {
      expect(isRemasterItem({ system: { publication: { remaster: false } } })).toBe(false);
      expect(isRemasterItem({ system: {} })).toBe(false);
      expect(isRemasterItem(null)).toBe(false);
    });
  });

  describe('itemHasExcludedTechTrait', () => {
    it('is true when the item carries a no-guns trait (case-insensitive)', () => {
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['Firearm'] } } })).toBe(true);
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['tech'] } } })).toBe(true);
    });
    it('is false otherwise', () => {
      expect(itemHasExcludedTechTrait({ system: { traits: { value: ['magical'] } } })).toBe(false);
      expect(itemHasExcludedTechTrait({})).toBe(false);
    });
    it('exposes the trait set', () => {
      expect(NO_GUNS_TRAITS instanceof Set).toBe(true);
    });
  });

  describe('isPublicationDisallowed', () => {
    afterEach(() => jest.restoreAllMocks());
    it('is true when the source guidance is disallowed', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(isPublicationDisallowed('Guns & Gears')).toBe(true);
    });
    it('is false for any other status', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue(null);
      expect(isPublicationDisallowed('Player Core')).toBe(false);
    });
  });

  describe('filterDisallowedSourcePublications', () => {
    afterEach(() => jest.restoreAllMocks());
    const opts = [{ key: 'Player Core' }, { key: 'Banned Book' }];

    it('returns all options in show mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(filterDisallowedSourcePublications(opts, { mode: 'show', isGM: false })).toHaveLength(2);
    });
    it('drops disallowed sources in hide mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle')
        .mockImplementation((t) => (t === 'Banned Book' ? 'disallowed' : null));
      const result = filterDisallowedSourcePublications(opts, { mode: 'hide', isGM: true });
      expect(result.map((o) => o.key)).toEqual(['Player Core']);
    });
    it('keeps disallowed sources for GMs in hide-non-gm mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle').mockReturnValue('disallowed');
      expect(filterDisallowedSourcePublications(opts, { mode: 'hide-non-gm', isGM: true })).toHaveLength(2);
    });
    it('drops disallowed sources for non-GMs in hide-non-gm mode', () => {
      jest.spyOn(guidance, 'getGuidanceForSourceTitle')
        .mockImplementation((t) => (t === 'Banned Book' ? 'disallowed' : null));
      expect(filterDisallowedSourcePublications(opts, { mode: 'hide-non-gm', isGM: false }))
        .toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/access/source-classification.test.js`
Expected: FAIL — "Cannot find module '.../source-classification.js'".

- [ ] **Step 3: Write the implementation**

```js
// scripts/access/source-classification.js
import { getGuidanceForSourceTitle } from './content-guidance.js';

// Traits that mark "guns / tech" content for the optional exclusion (issue #82 #8).
// Defined once so it stays tunable in a single place.
export const NO_GUNS_TRAITS = new Set(['firearm', 'tech']);

export function isPublicationDisallowed(title) {
  return getGuidanceForSourceTitle(title) === 'disallowed';
}

export function isRemasterItem(item) {
  return item?.system?.publication?.remaster === true;
}

export function itemHasExcludedTechTrait(item) {
  const traits = item?.system?.traits?.value ?? [];
  return traits.some((trait) => NO_GUNS_TRAITS.has(String(trait).toLowerCase()));
}

function publicationOptionTitle(option) {
  return option?.title ?? option?.key ?? option?.value ?? option?.label ?? null;
}

export function filterDisallowedSourcePublications(options, { mode = 'show', isGM = false } = {}) {
  if (!Array.isArray(options) || options.length === 0) return options;
  if (mode === 'show') return options;
  if (mode === 'hide-non-gm' && isGM) return options;
  return options.filter((option) => !isPublicationDisallowed(publicationOptionTitle(option)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/access/source-classification.test.js`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/access/source-classification.js tests/unit/access/source-classification.test.js
git commit -m "feat: add source-classification helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Register the `publicationFilterVisibility` setting

**Files:**
- Modify: `scripts/settings.js` (inside `registerSettings()`, after the `defaultEligibleOnly` registration ~line 175)
- Modify: `lang/en.json` (inside the `SETTINGS` object)
- Test: none (config registration; covered indirectly by the i18n guard + manual)

**Interfaces:**
- Produces: world setting `publicationFilterVisibility` with values `'show' | 'hide' | 'hide-non-gm'`, default `'show'`, `onChange` refreshing open windows.

- [ ] **Step 1: Add the i18n keys**

In `lang/en.json`, inside the `"SETTINGS"` object (alongside other setting blocks), add:

```json
"PUBLICATION_FILTER_VISIBILITY": {
  "NAME": "Disallowed sources in filters",
  "HINT": "Controls whether sources you have marked Disallowed in Content Guidance still appear in the publication filter lists. Items from disallowed sources are filtered out regardless; this only affects the filter list itself.",
  "SHOW": "Show in filter lists",
  "HIDE": "Hide from filter lists",
  "HIDE_NON_GM": "Hide for players only"
}
```

- [ ] **Step 2: Register the setting**

In `scripts/settings.js`, after the `defaultEligibleOnly` registration, add:

```js
  game.settings.register(MODULE_ID, 'publicationFilterVisibility', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PUBLICATION_FILTER_VISIBILITY.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PUBLICATION_FILTER_VISIBILITY.HINT'),
    scope: 'world',
    config: true,
    type: String,
    default: 'show',
    choices: {
      show: game.i18n.localize('PF2E_LEVELER.SETTINGS.PUBLICATION_FILTER_VISIBILITY.SHOW'),
      hide: game.i18n.localize('PF2E_LEVELER.SETTINGS.PUBLICATION_FILTER_VISIBILITY.HIDE'),
      'hide-non-gm': game.i18n.localize('PF2E_LEVELER.SETTINGS.PUBLICATION_FILTER_VISIBILITY.HIDE_NON_GM'),
    },
    onChange: () => refreshOpenLevelerWindows(),
  });
```

- [ ] **Step 3: Run lint + i18n guard**

Run: `npx jest tests/unit/i18n-template-keys.test.js && npx eslint scripts/settings.js`
Expected: PASS / no lint errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/settings.js lang/en.json
git commit -m "feat: add publicationFilterVisibility setting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add a shared accessor for the current filter mode

**Files:**
- Modify: `scripts/access/source-classification.js`
- Test: `tests/unit/access/source-classification.test.js`

**Interfaces:**
- Produces: `getPublicationFilterMode(): 'show'|'hide'|'hide-non-gm'` — reads the setting defensively (returns `'show'` if unavailable). Lets callers avoid duplicating the `game.settings.get` + try/catch.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/access/source-classification.test.js`:

```js
import { getPublicationFilterMode } from '../../../scripts/access/source-classification.js';

describe('getPublicationFilterMode', () => {
  const realGet = global.game.settings.get;
  afterEach(() => { global.game.settings.get = realGet; });

  it('returns the configured mode', () => {
    global.game.settings.get = jest.fn(() => 'hide');
    expect(getPublicationFilterMode()).toBe('hide');
  });
  it('falls back to show on error', () => {
    global.game.settings.get = jest.fn(() => { throw new Error('not registered'); });
    expect(getPublicationFilterMode()).toBe('show');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/access/source-classification.test.js -t "getPublicationFilterMode"`
Expected: FAIL — `getPublicationFilterMode is not a function`.

- [ ] **Step 3: Implement**

Add to the top imports of `scripts/access/source-classification.js`:

```js
import { MODULE_ID } from '../constants.js';
```

Add the function:

```js
export function getPublicationFilterMode() {
  try {
    const mode = String(game.settings.get(MODULE_ID, 'publicationFilterVisibility') ?? 'show');
    return ['show', 'hide', 'hide-non-gm'].includes(mode) ? mode : 'show';
  } catch {
    return 'show';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/access/source-classification.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/access/source-classification.js tests/unit/access/source-classification.test.js
git commit -m "feat: add getPublicationFilterMode accessor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Apply the filter in the three pickers

**Files:**
- Modify: `scripts/ui/spell-picker.js` (`_getPublicationOptions()` ~line 846)
- Modify: `scripts/ui/item-picker.js` (its publication-options builder)
- Modify: `scripts/ui/feat-picker.js` (its publication-options builder)
- Test: covered by Task 1's `filterDisallowedSourcePublications` unit tests; integration verified manually

**Interfaces:**
- Consumes: `filterDisallowedSourcePublications`, `getPublicationFilterMode` from `source-classification.js`.

- [ ] **Step 1: Import the helper in each picker**

Add to the imports near the existing `content-guidance.js` import in each of `scripts/ui/spell-picker.js`, `scripts/ui/item-picker.js`, `scripts/ui/feat-picker.js`:

```js
import { filterDisallowedSourcePublications, getPublicationFilterMode } from '../access/source-classification.js';
```

- [ ] **Step 2: Wrap the returned options in spell-picker**

In `scripts/ui/spell-picker.js`, find `_getPublicationOptions()` (~line 846). Whatever array it currently returns, wrap the final return value:

```js
  _getPublicationOptions() {
    // ... existing logic that builds `options` ...
    return filterDisallowedSourcePublications(options, {
      mode: getPublicationFilterMode(),
      isGM: game.user?.isGM === true,
    });
  }
```

(If the method currently returns the expression directly, assign it to `const options` first, then return the wrapped value.)

- [ ] **Step 3: Apply the identical wrap in item-picker and feat-picker**

In `scripts/ui/item-picker.js` and `scripts/ui/feat-picker.js`, locate the method that builds the publication chip options (the one whose result is assigned to `publicationOptions` in `_prepareContext`). Wrap its returned array exactly as in Step 2:

```js
    return filterDisallowedSourcePublications(options, {
      mode: getPublicationFilterMode(),
      isGM: game.user?.isGM === true,
    });
```

- [ ] **Step 4: Lint + full test suite**

Run: `npm run lint && npm test`
Expected: lint clean; all suites pass (no test should regress; the helper tests cover the logic).

- [ ] **Step 5: Commit**

```bash
git add scripts/ui/spell-picker.js scripts/ui/item-picker.js scripts/ui/feat-picker.js
git commit -m "feat: hide disallowed sources from picker publication filters

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Apply the filter in the character wizard

**Files:**
- Modify: `scripts/ui/character-wizard/index.js` (`buildPublicationOptions()` ~line 3374, and/or its call sites in `_prepareContext`/step context building)
- Test: integration verified manually

**Interfaces:**
- Consumes: `filterDisallowedSourcePublications`, `getPublicationFilterMode`.

- [ ] **Step 1: Import the helper**

Add near the existing content-guidance import in `scripts/ui/character-wizard/index.js`:

```js
import { filterDisallowedSourcePublications, getPublicationFilterMode } from '../../access/source-classification.js';
```

- [ ] **Step 2: Wrap the exported builder result**

In `buildPublicationOptions(stepContext, storedSelection = [])` (~line 3374), wrap the returned array:

```js
export function buildPublicationOptions(stepContext, storedSelection = []) {
  // ... existing logic producing `publicationOptions` (the mapped array) ...
  return filterDisallowedSourcePublications(publicationOptions, {
    mode: getPublicationFilterMode(),
    isGM: game.user?.isGM === true,
  });
}
```

(Assign the mapped result to a `const` first if it is currently returned inline.)

- [ ] **Step 3: Lint + full test suite**

Run: `npm run lint && npm test`
Expected: lint clean; all suites pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/ui/character-wizard/index.js
git commit -m "feat: hide disallowed sources from wizard publication filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Changelog

**Files:**
- Modify: `CHANGELOG.md` (under the current `## 3.5.7`, add a `### Content Guidance` bullet or extend the existing one)

- [ ] **Step 1: Add the entry**

Under `## 3.5.7`, in the `### Content Guidance` section, add:

```markdown
- **Hide disallowed sources from filters** - A new "Disallowed sources in filters" setting lets GMs remove sources they've banned in Content Guidance from the publication filter lists (everywhere, or for players only)
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for hide-disallowed-sources filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** Implements #4 fully (setting with 3 modes, filter applied in all 3 pickers + wizard, list-only effect). Pre-builds the `source-classification` predicates (`isRemasterItem`, `itemHasExcludedTechTrait`, `NO_GUNS_TRAITS`) that Phase 2 (#8) consumes. #5b and #6 are out of scope for this plan (separate phases) per the design's build order.
- **Placeholder scan:** No TBD/TODO; each code step shows complete code. The "locate the builder method" instructions in Tasks 4–5 name the exact method (`_getPublicationOptions` / `buildPublicationOptions`) and the exact wrap to apply — the variable name `options`/`publicationOptions` is the only thing the implementer reads from the existing code.
- **Type consistency:** `filterDisallowedSourcePublications(options, { mode, isGM })` and `getPublicationFilterMode()` are used with the same signatures in Tasks 4 and 5 as defined in Tasks 1 and 3.
- **Verification:** `npm run lint` + `npm test` after integration tasks; `i18n-template-keys` guard after the en.json change.
