# Picker Redesign Design

Date: 2026-04-23
Scope: Character wizard picker-style filter sidebars, with the same density treatment applied across feat and spell pickers where patterns overlap.

## Goal

Reduce visual bulk in picker sidebars without reducing filtering power or changing core filtering behavior.

The redesign should make the filter UI feel lighter, faster to scan, and easier to use in the constrained wizard layout. The main win is reducing repetitive chrome: duplicated labels, oversized cards, tall gaps, and always-expanded low-value sections.

## In Scope

- Feat picker sidebar redesign
- Spell picker sidebar redesign where the same filter-shell patterns exist
- Removal of redundant labels when the control placeholder already communicates the same purpose
- Compact presentation for utility controls such as eligibility, sorting, and level range
- Collapsible treatment for bulky grouped filters such as publications
- Visible active-state summaries for collapsed sections
- Shared spacing and density rules across picker-style sidebars

## Out of Scope

- New filter categories
- New filtering semantics
- Rewriting picker result cards
- Large navigation or wizard layout changes outside the picker/filter shell
- Data-model changes except where required to expose collapsed-state summaries

## Design Principles

1. Keep the power, remove the chrome.
2. Do not show a heading if the control already explains itself.
3. Dense does not mean cramped; readability still wins.
4. Advanced and high-volume filters should stay available, but not dominate the sidebar by default.
5. Feat and spell pickers should feel like one UI system.

## Interaction Rules

### Redundant labels

If a text input or searchable control already uses placeholder copy that fully communicates its purpose, do not render a duplicate title above it.

Examples:

- `Search feats...` does not need a `Search` heading.
- `Filter by skill...` does not need a matching heading above it.

Group labels remain when they add meaning that the control itself does not communicate, such as `Rarity`, `Feat Types`, or a collapsed advanced filter section.

### Utility controls

Utility controls should read as compact tools rather than full-height cards. This includes:

- `Eligible Only`
- `Sort`
- `Level Range`

These controls should keep their current behavior, but use tighter spacing, smaller headers, and more efficient vertical layout.

### Collapsible sections

Bulky grouped filters should become collapsible sections. The primary target is `Publications`, with the same treatment available to other large grouped filters where it improves scanability.

Collapsed sections are closed by default when the section is not high-priority for initial filtering.

### Active-state summaries

When a collapsible section has active selections, the collapsed header should advertise that state instead of hiding it.

Preferred summary behavior:

- Use compact counts by default, such as `Publications (3)` or `Rarity (2)`.
- Use short readable labels only when they remain concise.
- Avoid long comma-separated summaries that make headers noisy.

## Component Layout

### Filter shell

Keep the current sidebar layout and browser split structure. Reduce perceived bulk primarily through spacing and density improvements rather than a full structural rewrite.

Changes:

- smaller vertical gaps between sections
- tighter section padding
- reduced heading-to-control spacing
- slightly reduced control heights where readability remains solid

### Search-style inputs

Search and filter text inputs should render as standalone controls when their placeholder is already self-explanatory. They should not sit inside oversized labeled cards unless grouping provides a real benefit.

### Accordion sections

Introduce a reusable collapsible section pattern for high-volume filter groups. The section header should support:

- title
- collapsed/expanded state
- active-state summary
- optional count badge styling

### Publications control

`Publications` should behave like a compact multi-select summary when collapsed and expand inline into the existing searchable option list when opened.

Expected behavior:

- collapsed by default
- header shows active count when selected
- expanded state reveals the existing searchable multi-select content
- no filtering logic changes beyond preserving state and displaying summary text

## Shared Styling Rules

The feat picker and spell picker should share the same spacing tokens and density decisions where possible:

- section padding
- section gaps
- label spacing
- input heights
- chip spacing
- collapsed section styling

This should be implemented as shared styling language, not as two unrelated one-off tweaks.

## Responsive Behavior

On narrower windows or stacked layouts, preserve the same compact spacing rules. The redesign should still reduce scroll pressure when the sidebar stacks above the results area.

The redesign should not depend on a wide viewport to feel cleaner.

## Accessibility and Usability

- Collapsible headers must remain clear and clickable.
- Active-state summaries should be readable but brief.
- Reduced spacing must not harm target size for primary interactive elements.
- Placeholder-only labeling should only be used where the control purpose is unmistakable.

## Implementation Notes

- Prefer reusing the existing browser sidebar/template structure.
- Create a reusable collapsed-section treatment instead of solving `Publications` with a one-off hack.
- Keep filtering logic stable unless a small view-model addition is needed for collapsed summaries.
- Preserve existing selection state through collapse/expand toggles and rerenders.

## Testing and Verification

Verification should cover both behavior and presentation-sensitive state:

- existing picker filter behavior still works
- selected filters remain selected after rerender
- collapsed sections correctly reflect active counts
- publications selections remain visible and functional after collapse/expand
- stacked/narrow layouts still render cleanly
- feat and spell pickers both use the new compact treatment in shared areas

Manual verification should include:

- feat picker with many publication filters
- spell picker with overlapping filter-shell patterns
- windows narrow enough to trigger stacked behavior

## Risks

### Perfectionist concern

The biggest risk is ending up with a partial density cleanup that still feels inconsistent between feat and spell pickers, or solving `Publications` elegantly while leaving other sections visually heavy.

### Pragmatic acceptance

The redesign is successful if the sidebar feels materially leaner, the worst bulky sections are collapsed or compacted, and the feat/spell experiences read as intentionally related rather than independently patched.
