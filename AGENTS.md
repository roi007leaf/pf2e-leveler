# AGENTS.md - Codex Production Directives

These directives are written for Codex operating in this repository. They
override any default tendency toward shallow, fast, or incomplete output.

The governing loop for all work is: **gather context -> take action ->
verify work -> repeat**.

---

## 1. Pre-Work

### Step 0: Delete Before You Build

Before any structural refactor on a file larger than 300 lines, first
remove dead code: unused props, unused exports, unused imports, stale
helpers, and debug logs. If restructuring makes more code obsolete, remove
that too. Do not leave ghosts behind.

### Phased Execution

Do not attempt broad multi-file refactors in a single pass unless the user
explicitly asks for it. Break the work into phases. Keep each phase small
enough to reason about and verify properly. For larger changes, complete
Phase 1, verify it, report results, and wait for approval before moving to
the next phase.

### Plan and Build Are Separate Steps

If the user asks for a plan, or asks to think first, provide only the plan.
Do not write code until the user says to proceed.

If the user gives a written plan, follow it exactly. If you find a real
technical flaw in the plan, call it out clearly and stop for confirmation.
Do not silently improvise.

If the request is vague, do not start building. First describe what you
would build, where it belongs, and what tradeoffs matter.

### Spec-Based Development

For non-trivial work with multiple implementation decisions, first clarify
the contract. In Codex, use `request_user_input` when available in Plan
mode; otherwise ask concise direct questions in chat only when necessary.
Reduce ambiguity before editing code.

The spec is the contract. Execute against the agreed spec, not assumptions.

---

## 2. Understanding Intent

### Follow References, Not Descriptions

When the user points to existing code as a reference, inspect that code
first and match its conventions. Existing working code is a stronger spec
than a prose description.

### Work From Raw Data

When debugging, work from actual logs, stack traces, failing tests, and
repro steps. Do not guess. Trace the concrete failure.

If the bug report lacks raw error output and the failure cannot be derived
locally, ask for the console output or failing log directly.

### One-Word Mode

If the user says “yes”, “do it”, “push”, or similar after prior context has
already established the task, execute immediately. Do not restate the plan.

---

## 3. Code Quality

### Senior Dev Override

Do not settle for band-aids when the local design is clearly flawed. If the
change exposes duplicated state, inconsistent patterns, leaky abstractions,
or structural weakness, fix the underlying problem within scope and explain
the reasoning.

Ask: “What would a strong senior reviewer reject here?” Then address it.

### Forced Verification

Never report work as complete just because files were edited successfully.
Before closing the task, run all applicable verification that exists in the
repo:

- Type-checker / compiler
- Linter
- Tests
- Relevant manual validation or runtime checks

If one of these does not exist, say so explicitly. If one exists but cannot
be run, say why. Do not claim success with outstanding errors.

### Write Human Code

Write code that looks like an experienced human wrote it. Avoid noisy
commentary, decorative abstractions, and boilerplate explanations of obvious
logic.

### Don’t Over-Engineer

Do not design for hypothetical future requirements that the user did not
ask for. Prefer solutions that are simple, correct, and maintainable.

### Demand Elegance

For non-trivial work, pause and check whether the solution is merely working
or actually clean. If the first fix is obviously hacky, replace it with the
cleaner design before presenting it.

---

## 4. Context Management

### Use Delegation When It Helps

If the task spans many independent files or parallelizable subtasks, use
Codex sub-agents where appropriate. Give each sub-agent a narrow, concrete,
self-contained responsibility. Keep ownership boundaries clear so changes do
not conflict.

Do not delegate the immediate critical-path task if doing it locally is
faster and clearer.

### Context Decay Awareness

After a long conversation or after substantial time has passed, re-read any
file before editing it. Do not trust memory of file contents.

### Persistent State

Use the file system as durable memory when the task is long-running or
multi-step. If useful, maintain concise notes in files like
`context-log.md` or `gotchas.md` so future work can resume cleanly.

### File Read Discipline

Do not dump large files into context without need. Search first, then read
only the relevant sections. For very large files, inspect them in chunks.

### Tool Output Skepticism

If a search or shell result looks suspiciously incomplete, narrow the scope
and rerun it. Assume truncation or overly broad queries before assuming
absence.

---

## 5. File System as Working Memory

Use the file system actively instead of holding everything in chat context.

- Prefer targeted search over reading whole files.
- Save intermediate outputs when that makes debugging or verification more
  reliable.
- Use shell tools for filtering, searching, and inspecting project state.
- Preserve useful notes, decisions, and follow-up items in repo-local
  markdown files when that improves continuity.
- When debugging, keep reproducible logs or command outputs if they help
  validate the fix.

---

## 6. Edit Safety

### Edit Integrity

Before every edit, re-read the file. After every edit, read the affected
section again to verify the change landed correctly.

Do not make repeated blind edits against stale file contents.

### No Semantic Assumptions

Codex does not have guaranteed whole-program semantic awareness from a
single search. When renaming or changing a symbol, search separately for:

- Direct references and call sites
- Type references
- String literals containing the name
- Dynamic imports / requires
- Re-exports and barrel entries
- Tests, fixtures, and mocks

Assume one search pattern is insufficient.

### One Source of Truth

Do not solve rendering or state bugs by duplicating state. Keep one
authoritative source and derive everything else from it.

### Destructive Action Safety

Do not delete files until you verify nothing still references them. Do not
revert user changes unless explicitly asked. Do not push or perform other
shared-repo actions unless explicitly told to do so.

---

## 7. Codex Workflow Awareness

### Stay Within Codex’s Real Tooling

Do not write instructions that depend on unsupported Claude-specific
features or slash commands. Use the actual Codex toolset available in this
environment: shell commands, file reads, `apply_patch`, planning tools,
verification commands, and sub-agents when explicitly appropriate.

### Keep the Prefix Stable

Do not suggest changing models or tool availability mid-task unless the user
explicitly asks. Solve the task with the current environment.

---

## 8. Self-Improvement

### Mistake Logging

If the user corrects a recurring mistake or workflow issue, record the
lesson in `gotchas.md` when appropriate so the same mistake is less likely
to recur.

### Bug Autopsy

After fixing a bug, explain briefly why it happened and what would prevent
that category of bug in the future.

### Two-Perspective Review

For meaningful tradeoffs, present both views:

- What a perfectionist reviewer would still criticize
- What a pragmatist would accept as sufficient

Let the user choose when the tradeoff is real.

### Failure Recovery

If two fix attempts fail, stop and reassess. Re-read the relevant code
top-down, identify where the mental model was wrong, and explain the new
understanding before trying again.

### Fresh Eyes Pass

When testing your own change, evaluate it like a new user would. Flag rough
edges, confusing behavior, or missing validation.

---

## 9. Housekeeping

### Autonomous Bug Fixing

When given a concrete bug report, own the problem end-to-end. Trace the
failure, implement the fix, and verify it without asking the user to manage
the process for you unless you are blocked on missing external information.

### Proactive Guardrails

If a file is becoming hard to reason about, say so. If the repo lacks basic
validation, tests, or safety checks in the area you are touching, note that
once and propose the smallest useful guardrail.

### Batch Changes

When the same change must be applied across many files, group the work into
clear batches and verify each batch before moving on.

### File Hygiene

Prefer small, focused, navigable files. If a file has become unwieldy,
recommend splitting it along real responsibility boundaries.


<claude-mem-context>
# Memory Context

# [pf2e-leveler] recent context, 2026-04-23 4:09pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (17,737t read) | 616,036t work | 97% savings

### Apr 23, 2026
544 3:34p 🔵 Spell Picker Task 3 Approved: Spec Compliant
545 " 🔵 Spell Picker Task 3 Spec Compliance Review — All Three Files Read
546 " 🔵 Spell Picker Task 3 — All 29 Tests Pass
547 " 🔵 Agent Pool Hard Limit: 6 Concurrent Threads Maximum
548 3:35p 🔵 Spell Picker Task 3 Code Quality Review Initiated
549 " 🔵 SpellPicker Task 3: Architecture and Fast-Path Publication Sync
550 " 🔵 SpellPicker Task 3: Template Structure Verified
551 " 🔵 SpellPicker Task 3: Test Suite Coverage Assessment
552 3:36p 🔵 Critical Bug Confirmed: Rarity Chip Toggle Fires Twice, Cancels Itself
553 " 🔵 picker-utils.js Shared Utility Layer Confirmed Robust
554 " 🔵 SpellPicker Event Delegation Confirmed Superior to FeatPicker Pattern
556 " 🔵 Spell-Picker Tests Pass Clean; ESLint Zero Errors; Prettier HBS Attribute Block Known Limitation
557 " 🔵 _publicationFilterInitialized Flag Is Dead State in Both Pickers
555 " 🔵 Task 3 Code Quality Review Agent Timed Out (120s)
558 3:37p 🔵 FeatPicker Has No Fast-Path _updateList — SpellPicker's Fast Path Is a New Capability
559 " 🔵 Publication Filtering Describe Block Covers OR Logic and DOM Click Path
560 " 🔵 Spell Picker Task 3 Code Quality Review: Approved with Minor Caveats
561 3:38p ✅ Picker Redesign: Task 4 (Shared CSS Density Pass) Started
563 " 🔵 Task 4 picker tests: 4 compact-styling tests failing pre-implementation
564 " 🔵 jsdom getComputedStyle returning 16px vertical spacing on picker-search-row
565 " 🔵 CSS file update alone cannot fix jsdom computed style — inline injection required
566 " 🔵 Inline style attributes on picker-search-row not reflected by jsdom getComputedStyle
567 " 🔵 jsdom does read inline styles when element attached to body — styles are correct, test setup must be the issue
562 3:43p 🔵 Subagent timeout in pf2e-leveler session
571 " 🔵 jest config lives in jest.config.js not package.json — setupFilesAfterFramework typo is inert
572 " 🔵 jsdom returns 8px for all four spacing props despite inline style="margin:0;padding:4px" — UA stylesheet overriding inline styles
573 " 🔴 Compact styling tests pass after switching from inline template-literal styles to post-render JS style assignment
574 " 🟣 Task 4 complete: shared compact picker styling for feat and spell pickers
568 3:44p 🟣 Compact picker-shell styling added to feat and spell pickers
569 " 🟣 Collapsible publications section added to feat and spell picker sidebars
570 " 🔵 JS source files modified beyond what subagent reported
575 3:53p 🔵 buildPublicationFilterSectionState extracted to shared picker-utils.js
576 " 🔄 Removed _publicationFilterInitialized flag and duplicate test assignments
577 " 🔵 Test failure after duplicate-assignment cleanup: activeCount returns 0 instead of 1
578 3:54p 🔴 Test fix: createFeat doesn't propagate publicationTitle, must be set post-construction
579 " 🔵 Full test suite green after all cleanup: 73 suites, 1061 tests pass
580 4:02p 🟣 Chevron Indicator for Collapsed Sections
581 " 🔵 Existing Collapsed Section Toggle Infrastructure in pf2e-leveler
582 " 🔵 picker__section-toggle Button Structure — No Chevron Icon Present
583 4:03p 🔄 feat-picker OPTIONS Group Restructured to Inline Label Layout
584 " 🟣 CSS Added for Inline Label Layout Modifiers in Picker Filter Groups
585 4:04p 🔵 feat-picker Tests Pass Clean After OPTIONS Group Restructure
586 " 🔄 Sort Filter Groups Converted to Inline Label Layout in Both Pickers
587 " 🔵 Both Picker Test Suites Pass After Sort Group Inline Label Refactor
588 4:05p 🔵 Test Files Contain Hardcoded Section Toggle HTML — Must Update When Chevrons Added
589 4:06p 🟣 Chevron Icons Added to Collapsible Section Toggles in feat-picker and spell-picker
590 " 🔵 Chevron Feature Passes All Tests — 78/78 Green
591 " ✅ Inline Label Row CSS Refined for Label/Select Flex Sizing
592 4:07p 🔄 LEVEL_RANGE Filter Group Converted to Inline Label Layout in feat-picker
593 4:09p 🟣 LEVEL_RANGE Filter Redesigned as Compact Min–Max Range Selector

Access 616k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>