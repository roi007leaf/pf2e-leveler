# Starfinder 2e Support Design

Date: 2026-04-25

## Approved Scope

PF2e Leveler keeps its existing module id and name. It gains full Starfinder
Second Edition support for:

- standalone `sf2e` worlds on Foundry 13 and 14
- `pf2e` worlds with the `sf2e-anachronism` module active
- mixed Pathfinder and Starfinder content in PF2e worlds when
  `sf2e-anachronism` is active

No campaign-mode setting is added. In PF2e worlds, Anachronism content is used
automatically when the module is active.

## Current Constraints

The module currently assumes PF2e in several places:

- `module.json` only declares the `pf2e` system relationship.
- compendium defaults point to PF2e packs such as `pf2e.feats-srd`,
  `pf2e.spells-srd`, `pf2e.classfeatures`, and `pf2e.equipment-srd`.
- helper code calls PF2e settings and APIs directly.
- some spell, feat grant, class, and subclass data contains hardcoded PF2e
  compendium UUIDs.
- class handlers include many Pathfinder-specific special cases.

SF2e and Anachronism use a PF2e-compatible document shape for many character
building items, but their pack keys differ. Examples:

- standalone SF2e: `sf2e.feats`, `sf2e.spells`, `sf2e.class-features`,
  `sf2e.equipment`
- PF2e plus Anachronism: `sf2e-anachronism.feats`,
  `sf2e-anachronism.spells`, `sf2e-anachronism.class-features`,
  `sf2e-anachronism.equipment`

Local SF2e class data exposes the same schedule fields Leveler already derives
from class items: `classFeatLevels`, `skillFeatLevels`, `generalFeatLevels`,
`ancestryFeatLevels`, `skillIncreaseLevels`, and `keyAbility`.

## Architecture

Add a central system-support layer, likely under `scripts/system-support/`.
Existing UI, planner, and apply code should ask this layer for system-specific
facts instead of hardcoding `pf2e`.

The layer owns:

- active system id: `pf2e` or `sf2e`
- active content sources for each content category
- default pack keys for PF2e, standalone SF2e, and PF2e plus Anachronism
- UUID helpers for building and detecting compendium UUIDs from active packs
- settings helpers that read the active system namespace and safely fall back
  when a setting is missing
- Predicate resolution across `game.pf2e.Predicate`, `game.sf2e.Predicate`,
  and global fallbacks
- feature flags for PF2e-only, SF2e-only, and shared behavior

This keeps the current module identity stable while making the internals
ruleset-aware.

## Compendium Behavior

`module.json` declares relationships for both `pf2e` and `sf2e`.

In standalone `sf2e` worlds, default content comes from SF2e system packs:

- ancestries: `sf2e.ancestries`
- heritages: `sf2e.heritages`
- backgrounds: `sf2e.backgrounds`
- classes: `sf2e.classes`
- feats: `sf2e.feats`
- class features: `sf2e.class-features`
- spells: `sf2e.spells`
- equipment: `sf2e.equipment`
- actions: `sf2e.actions`
- deities: `sf2e.deities`

In PF2e worlds with active `sf2e-anachronism`, defaults include both PF2e and
Anachronism packs for matching categories. Player content guidance, rarity
filters, custom compendiums, and source labels continue to work across all
included packs.

## Class Behavior

Generic class support should be the first class path for SF2e classes. When a
selected class is not registered, Leveler derives a class definition from the
class item's schedule fields.

Known SF2e classes such as envoy, mystic, operative, soldier, solarian, and
witchwarper should work through generic class derivation before any bespoke
handler is introduced.

PF2e-specific handlers remain scoped to PF2e classes unless SF2e data proves
that the same behavior applies. Examples of PF2e-specific areas are alchemist
formulas, wizard schools, animist apparitions, psychic amps, and class-specific
focus spell grants.

## Spell, Feat, and Grant Behavior

Hardcoded PF2e UUID construction should move behind adapter helpers. Parsing of
existing UUID links remains system-neutral and should accept any active content
source.

GrantItem and ChoiceSet support remains based on item data, not on pack names.
`flags.pf2e.rulesSelections` must be treated carefully: PF2e worlds and
Anachronism likely keep this path, while standalone SF2e must be verified before
writing to it. The adapter should expose the correct rule-selection flag path.

Spell pickers should load spells from active spell packs. Feat grant detection
should use active feat, spell, class feature, and equipment packs when resolving
linked grants.

## Wealth and Equipment

PF2e gold-based starting wealth tables are not automatically valid for SF2e.
Initial SF2e support should avoid applying PF2e wealth assumptions to SF2e
unless the values are verified. Equipment selection can still use SF2e equipment
packs, but currency totals and labels need a focused SF2e pass.

## Testing and Verification

Automated tests:

- adapter profile tests for PF2e, standalone SF2e, and PF2e plus Anachronism
- compendium category default tests for all supported profiles
- class derivation tests using representative SF2e class item data
- UUID helper tests for PF2e, SF2e, and Anachronism pack keys
- existing full Jest suite remains green
- lint remains green

Manual checks:

- Foundry 13 PF2e world without Anachronism still behaves as before
- Foundry 13 PF2e world with Anachronism shows mixed PF2e and SF2e content
- Foundry 13 standalone SF2e world can open character creation, pick a class,
  select feats, and save a plan
- Foundry 14 assumptions are checked against current SF2e/PF2e manifests and,
  when runtime is available, smoke-tested in a V14 world

## Phasing

Phase 1: introduce system-support layer, manifest relationship update,
system-aware compendium defaults, and tests.

Phase 2: replace direct PF2e setting/API/Predicate calls with adapter helpers.

Phase 3: migrate hardcoded PF2e UUID construction and grant resolution to
adapter helpers.

Phase 4: verify SF2e class creation and planner flows, then add narrow special
handlers only for SF2e classes that need them.

Phase 5: review SF2e wealth/equipment behavior and either implement verified
credit-aware defaults or keep PF2e wealth features disabled in SF2e contexts.

Each phase should be verified before the next begins.

## Non-Goals

- no module rename
- no campaign-mode setting
- no forked SF2e copy of the whole planner
- no broad refactor unrelated to system support
- no claim that every PF2e class-specific special case applies to SF2e

## Open Risks

- standalone SF2e rule-selection flag paths may differ from PF2e.
- Foundry 14 runtime behavior cannot be fully proven from the local Foundry 13
  install alone.
- hardcoded PF2e subclass spell data may need a larger data strategy if SF2e
  classes use similar granted-spell patterns with different UUIDs.
- mixed PF2e plus Anachronism worlds may surface many more options, so picker
  filtering and source labels must remain clear.
