# Feat Grants: Spells, Items, and Formulas

Date: 2026-04-24
Scope: Level planner only

## Goal

The level planner should notice when a selected feat or option grants extra player choices, let the user make those choices during planning, validate that the choices are complete, and apply them at level-up.

The first supported grant types are:

- Spells added to a spellbook or repertoire.
- Physical items granted by a feat or option.
- Formulas added to the PF2e crafting tab.

The implementation must be as generic as practical. It must not rely on hard-coded feat-name tables. It can use generic PF2e rule-element shapes, item data, and conservative natural-language patterns from feat descriptions.

## Non-Goals

- Character creation wizard support.
- Perfect natural-language understanding of every Paizo or third-party feat.
- Replacing PF2e system rule elements where they already work correctly.
- Creating inventory items for formulas. PF2e stores known formulas separately from inventory.
- Supporting every possible grant kind in this phase, such as pets, vehicles, companions, or proficiencies.

## Current Context

The level planner already supports normal spell selection, spellbook picks, custom spellcasting entries, equipment planning, feat choice sets, and recursive preview of `GrantItem` rule elements.

Feat application currently creates selected feat items and lets PF2e process their rule elements. Focus spells receive extra custom handling. Planned equipment is applied by creating embedded `Item` documents.

PF2e formula storage was verified from the installed local PF2e system: dropping a physical item on the crafting tab appends `{ uuid: item.uuid }` to `actor.system.crafting.formulas`. Known formulas are not separate formula item documents.

## User Contract

When a planner feat grants a player choice:

1. The feat card shows a "Granted choices" area.
2. If leveler can infer grant kind, count, and useful filters, the user can open the right picker directly.
3. If leveler detects a likely grant but cannot infer it safely, the user gets a manual configuration block.
4. Manual configuration asks for kind, count, and basic filters, then opens the matching picker.
5. Plan validation reports missing grant choices before apply.
6. Apply creates selected items, adds selected spells, and appends selected formulas to known formulas.

## Architecture

Add a generic grant-choice layer at `scripts/plan/feat-grants.js`.

This module exposes two main functions:

```js
export async function buildFeatGrantRequirements({ actor, plan, level, feats })
export function getFeatGrantCompletion(levelData, requirements)
```

`buildFeatGrantRequirements` loads source feat documents, applies detectors, and returns normalized requirements:

```js
{
  id: "stable deterministic id",
  sourceFeatUuid: "Compendium.pf2e.feats-srd.Item...",
  sourceFeatName: "Feat Name",
  kind: "spell" | "formula" | "item" | null,
  count: 2,
  filters: {
    rank: null,
    maxRank: null,
    maxLevel: 1,
    traits: ["alchemical"],
    rarity: ["common"],
    tradition: null,
    itemTypes: ["consumable"]
  },
  confidence: "inferred" | "manual-required",
  reason: "short display reason"
}
```

Requirement IDs must be deterministic from source feat UUID, kind, count, filters, and source path so saved choices remain stable across renders.

## Detectors

Detectors run in a fixed order. Each detector returns zero or more requirement objects.

### Rule Element Detector

Reads generic rule elements from source items:

- `GrantItem` with concrete UUID: no extra player choice needed if PF2e can grant it. Keep existing preview and do not duplicate the grant during apply.
- `GrantItem` with unresolved injected UUID or a `ChoiceSet` dependency: treat as a potential item choice if the existing choice-set parser cannot already handle it.
- `ChoiceSet` options that are physical item UUIDs: create item grant requirements when the choice looks like an item selection rather than a feat selection.

This detector must not use feat names.

### Spell Choice Detector

Parses source description text using conservative patterns such as:

- "gain/learn/add N cantrips of your choice"
- "gain/learn/add N [rank] spells of your choice"
- "add N spells to your spellbook/repertoire"

It extracts count, rank, tradition, rarity, and whether spellbook wording is present when explicit.

If it finds "spell", "spellbook", or "repertoire" plus "of your choice" but cannot infer count or filters, it emits `manual-required`.

### Formula Choice Detector

Parses source description text using conservative patterns such as:

- "gain/learn/add N formulas"
- "formulas for N common alchemical items"
- "formulas for [trait/type] items of level X or lower"

It extracts count, max item level, rarity, item type, and traits where explicit.

If it finds "formula" or "formulas" plus choice wording but cannot infer count or filters, it emits `manual-required`.

### Item Choice Detector

Parses description text and choice-set data for physical item grants:

- "gain/receive/choose N items"
- "gain one [type/trait] item of level X or lower"
- "choose a weapon/armor/tool/consumable"

It extracts count, max item level, rarity, item types, and traits.

Ambiguous text emits `manual-required`.

## Planner Data

Add `featGrants` to level data via `ensureCustomLevelData`:

```js
levelData.featGrants = [
  {
    requirementId: "string",
    sourceFeatUuid: "string",
    kind: "spell" | "formula" | "item",
    manual: {
      count: 2,
      filters: {}
    },
    selections: [
      {
        uuid: "string",
        name: "string",
        img: "string",
        rank: 1,
        baseRank: 1,
        itemType: "consumable",
        traits: ["alchemical"]
      }
    ]
  }
]
```

When a feat is cleared or replaced, remove stored `featGrants` entries for that feat unless the same source feat remains selected at that level.

## UI

Level-context enrichment adds `grantRequirements` to enriched feat objects and custom feat entries.

Each feat card shows:

- Source label for each requirement.
- Current selected count and required count.
- Picker button when inferred enough.
- Configure button when manual setup is required.
- Selected chips with remove buttons.

Manual configuration dialog fields:

- Grant kind: spell, formula, item.
- Count.
- Max item level or spell rank where relevant.
- Rarity.
- Tradition for spells.
- Item type and traits for formulas/items.

The picker opens after configuration and applies the configured filters.

## Picker Reuse

Use existing `SpellPicker` for spell grants. It already supports multi-select, ranks, traditions, rarities, traits, selected items, and removal callbacks.

Use existing `ItemPicker` for item grants and formula grants. Extend it only where needed to support:

- Initial preset filters.
- Locked filters when a requirement is inferred.
- Max selected count.
- Optional title override.
- Formula mode label text.

Formula mode still selects physical PF2e items. The difference is only how apply stores them.

## Apply

Add `applyFeatGrants(actor, plan, level)` and call it after `applyFeats` and before chat summary completes.

Apply behavior:

- `item`: resolve selected UUIDs and create embedded `Item` documents. Dedupe against actor items by source UUID.
- `formula`: resolve selected UUIDs enough to confirm physical items when possible, then update `system.crafting.formulas` with missing `{ uuid }` entries. Preserve existing formula entry data.
- `spell`: resolve selected spells and create spell items in a target spellcasting entry.

Spell target selection:

- If the grant explicitly says spellbook and a physical spellbook class/entry exists, add to the primary prepared spellcasting entry used by existing planner spellbook logic.
- If the grant is tied to a specific entry type from manual config, use that.
- If no safe target exists, validation reports that the grant needs manual spell-entry selection before apply.

Chat summary gets a new section for formulas and can reuse existing sections for items/spells or show them grouped under "Feat Grants".

## Validation

Plan validation adds grant checks:

- Missing manual configuration for detected grant: warning.
- Configured or inferred requirement with fewer selections than count: error.
- Spell grant with no target entry: error.

Validation must not block on a low-confidence detector unless the user has manually configured it.

## Error Handling

- If a source feat cannot be loaded, skip grant detection and do not create false errors.
- If a selected UUID cannot be loaded at apply time, skip that entry, log a warning, and continue applying other choices.
- Formula updates must preserve existing formula data and dedupe by UUID.
- Item grants must avoid duplicating an item already owned from the same source UUID.

## Testing

Unit tests should cover:

- Spell detector parses generic spellbook/repertoire wording.
- Formula detector parses generic formula wording with count, level, rarity, and traits.
- Ambiguous formula/spell/item text emits `manual-required`.
- Plan model initializes and clears `featGrants`.
- Level context attaches grant requirements to feat cards.
- Validation catches incomplete inferred grants and configured manual grants.
- Apply formulas updates `system.crafting.formulas` without duplicating UUIDs.
- Apply items creates inventory items with source dedupe.
- Apply spells routes to existing spellcasting entry or errors when target is missing.

## Phasing

Phase 1:

- Add normalized grant requirement model.
- Add detectors for spell/formula/item description patterns and obvious rule-element choices.
- Add planner UI for requirements, manual configuration, and selection storage.
- Add formula apply path.
- Add validation.

Phase 2:

- Improve item/formula picker presets and locked filters.
- Add richer spell target selection UI for ambiguous spell grants.
- Improve detector coverage based on real unmatched feats found in use.

Phase 3:

- Consider character creation wizard support after planner behavior is stable.
