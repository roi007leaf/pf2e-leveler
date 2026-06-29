# Issue #82 Phase 2 — Remaster + No-Guns/Tech toggles (#8) Implementation Plan

> **For agentic workers:** executed via superpowers:subagent-driven-development, one implementer per picker.

**Goal:** Add two boolean filter toggles — "Remaster only" and "Hide guns & tech" — to the spell, item, and feat pickers (issue #82 item #8, derivable-only scope).

**Architecture:** Reuse the already-built, already-tested predicates `isRemasterItem(item)` and `itemHasExcludedTechTrait(item)` from `scripts/access/source-classification.js`. Each picker gets two boolean flags, two predicate lines in its filter method, two context flags, two toggle buttons in an OPTIONS filter group, and two click handlers. No new logic module; no settings.

**Tech stack:** Foundry ES modules (no build), Handlebars, Jest, ESLint.

## Global Constraints
- Predicates exist: `isRemasterItem`, `itemHasExcludedTechTrait` (import from the helper). Do NOT reimplement.
- Toggles default OFF (no behavior change until toggled).
- Semantics: Remaster ON → keep only `isRemasterItem`; Hide-guns/tech ON → drop `itemHasExcludedTechTrait`.
- Shared i18n keys already added: `PF2E_LEVELER.UI.FILTER_OPTIONS`, `PF2E_LEVELER.UI.REMASTER_ONLY`, `PF2E_LEVELER.UI.HIDE_GUNS_TECH`. Use these in all three templates (DRY).
- Verification per picker: `npm run lint` + `npm test` (90 suites / 1580 tests baseline; i18n guard must stay green).
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Per-picker integration map (verified)

State flags to add (constructor): `this.remasterOnly = false;` and `this.hideGunsTech = false;`

Filter predicate (insert before the rarity filter / final return in each filter method):
```js
if (this.remasterOnly) ITEMS = ITEMS.filter((i) => isRemasterItem(i));
if (this.hideGunsTech) ITEMS = ITEMS.filter((i) => !itemHasExcludedTechTrait(i));
```

Toggle button markup (mirror feat-picker's OPTIONS group `picker__prereq-toggle`):
```hbs
<button type="button" class="picker__prereq-toggle {{#if remasterOnly}}active{{/if}}" data-action="toggleRemasterOnly">
  <i class="fa-solid fa-rocket"></i> {{localize "PF2E_LEVELER.UI.REMASTER_ONLY"}}
</button>
<button type="button" class="picker__prereq-toggle {{#if hideGunsTech}}active{{/if}}" data-action="toggleHideGunsTech">
  <i class="fa-solid fa-gun"></i> {{localize "PF2E_LEVELER.UI.HIDE_GUNS_TECH"}}
</button>
```

| | feat-picker | spell-picker | item-picker |
|---|---|---|---|
| import | `../access/source-classification.js` | same | same |
| state init | constructor ~L53 area | before `_applyPreset` ~L91 | before `_applyPreset` ~L118 |
| filter method | `_applyFilters` (predicate before `return sortFeats` ~L394), var `feats` | `_filterSpells` (before rarity block ~L554), var `spells` | `_filterItems` (before rarity ~L266), var `items` |
| context (both objects) | `_prepareContext` ~L156 **and** `_getLoadingContext` ~L279 | `_prepareContext` ~L172 **and** `_updateList` ~L474 | `_prepareContext` ~L155 **and** `_updateList` ~L502 |
| OPTIONS group | EXISTS (template L83–99) — add the 2 buttons inside `.picker__toggle-list` | CREATE a `picker__filter-group--utility` OPTIONS group (label `UI.FILTER_OPTIONS`) after the search group | CREATE an OPTIONS group after the search group (L9–20) |
| handler | `_activateListeners` querySelector pattern (~L490) **and** mirror active-sync in `_updateFilterControlState` ~L1596 | delegated click block ~L283 (`toggleRemasterOnly`/`toggleHideGunsTech` cases) | delegated click block ~L734 |
| update call | `this._scheduleListUpdate()` | `this._scheduleListUpdate()` | `this._updateList()` |

## Tasks
- **Task 1 (feat-picker):** flags + import + 2 predicates in `_applyFilters` + 2 context flags in both context objects + 2 toggle buttons in existing OPTIONS group + 2 handlers in `_activateListeners` + mirror in `_updateFilterControlState`. Verify lint+test. Commit.
- **Task 2 (spell-picker):** flags + import + 2 predicates in `_filterSpells` + 2 context flags in `_prepareContext` and `_updateList` + new OPTIONS group with 2 buttons + 2 cases in delegated click handler. Verify lint+test. Commit.
- **Task 3 (item-picker):** flags + import + 2 predicates in `_filterItems` + 2 context flags in `_prepareContext` and `_updateList` + new OPTIONS group with 2 buttons + 2 cases in delegated click handler (use `_updateList()`). Verify lint+test. Commit.
- **Review:** whole-Phase-2 reviewer subagent; fix loop.

## Self-Review
- Coverage: implements #8 derivable scope (Remaster + No-Guns/Tech) in all 3 pickers; reuses tested predicates (no new logic to unit-test; coverage rests on the helper tests + suite). Manual Foundry check for the toggles' visual/behaviour.
- No placeholders: predicate lines and markup are given verbatim; per-picker line anchors and the differing update-call/handler style are specified.
- Consistency: `remasterOnly` / `hideGunsTech` flag names and `toggleRemasterOnly` / `toggleHideGunsTech` actions used identically across all three.
