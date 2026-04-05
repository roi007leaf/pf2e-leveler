# Changelog

## 1.3.7

### Fixed

- Feat Choices now respects PF2E preselected granted-item choices
  - Granted feats with `preselectChoices`, such as `Abadar's Avenger` granting `Assurance (Religion)`, no longer prompt the user for a choice the system has already fixed
  - Preselected granted-item choices are also excluded from the pending-choice list when they are already satisfied
- Regular ability boost previews now use the actor's current stats correctly
  - The planner no longer reapplies boosts from levels the actor has already reached when previewing future attribute increases
  - Existing higher-level actors now show the correct normal vs partial boost behavior for later ability boosts such as level 15

## 1.3.6

### Fixed

- Gradual Ability Boosts now follow the official PF2E set boundaries
  - Boost restrictions now apply within the correct four-level sets: `2-5`, `7-10`, `12-15`, and `17-20`
  - Starting a new set no longer incorrectly blocks attributes chosen in the previous set when planning future levels

## 1.3.5

### Fixed

- Feat Choices now shows resolved feat names instead of compendium UUIDs
  - Feat choice section headers recover the feat's real name from the document when older saved data contains a UUID-like label
  - Feat choice cards now prefer the resolved item name, so granted options like `Animal Empathy` display correctly instead of raw compendium ids

## 1.3.4

### Improved

- Animist apparition attunement is now fully interactive in the level planner
  - Apparition slots appear at levels 1, 7, and 15 matching the rules (2 → 3 → 4 total)
  - Clicking an apparition selects or deselects it; selections are cumulative across all checkpoint levels so your level-1 picks carry forward to level 7 and 15
  - A counter badge shows selected/total (e.g. `2/3 apparitions`) and turns green when the slot is full
  - Each apparition has an info button that opens its compendium sheet
  - The focus pool badge is shown alongside the attunement counter at each unlock level
- Planned feats that grant skill proficiency are now reflected in the build state
  - Feats such as Acrobat Dedication grant Expert/Master/Legendary in Acrobatics at the appropriate character levels, and the planner now accounts for those ranks when computing available skill increases and validating prerequisites
- Planner and wizard selections are easier to inspect while browsing
  - Selected feats in the character wizard can now be opened directly from their feat-slot cards
  - Item-detail access is more consistent in the newer planner and wizard browsing flows
- Planner prerequisite handling is now much more permissive and informative for real PF2E feat text
  - Unverifiable narrative prerequisites no longer hard-block feat selection
  - Unknown prerequisite tags are now labeled clearly as `Unverified` in the feat picker
  - Added broader semantic prerequisite support for class features, spellcasting traditions, deity domains, Lore, and equipment/weapon requirements
  - Expanded regression coverage with a growing corpus of real feat prerequisite examples
- Custom compendium sourcing is now much more flexible and usable
  - Replaced the old feat-only comma-separated setting with a category-based compendium manager
  - GMs can now choose additional compendiums per category such as ancestries, heritages, classes, feats, spells, class features, equipment, actions, and deities
  - The compendium manager now uses a styled in-module UI and lets you open a listed compendium directly to inspect its contents
  - The character wizard now includes per-step compendium source filters so you can narrow each section to the packs you want to browse
  - Planner feat and spell pickers now expose those configured compendium sources too, so custom content is easier to browse during level planning
- Character creation plans can now move between worlds more easily
  - Added export/import support for wizard creation data, separate from the level planner's plan export
  - Imported creation snapshots are normalized so older exports remain usable as the wizard data shape evolves
- Character creation browsing has been overhauled to feel more like a real content browser
  - Ancestry, heritage, background, class, subclass, feat, and spell steps now use a more consistent browser-style layout with a filter rail and result pane
  - Selected feats are shown directly in their wizard feat slots, and those selected feat names can be opened to inspect the feat
  - Search, rarity, and content source filtering are more consistent across the main browsing steps
- Prepared spell management now has a lighter middle ground than auto-importing whole traditions
  - Prepared spell windows now expose a rank-aware tradition spell picker instead of requiring full manual drag-and-drop or auto-adding every tradition spell
  - The picker supports multi-select, `Select All` / `Deselect All`, and hides spells the actor already has when used from the preparation sheet
  - This gives prepared casters a curated pick flow instead of flooding their entry with every tradition spell up front
- Character creation apply prompts are easier to follow
  - Promptless PF2E choice sets now get a readable fallback label in the creation loading/apply overlay, so more system prompts appear in the guidance list

### Fixed

- Free Archetype / archetype feat pickers now support archetype `Additional Feats` properly
  - Non-archetype feats listed under an archetype's Additional Feats can now appear in archetype feat selection
  - Archetype-specific override levels from Additional Feats are respected instead of the feat's native printed level
  - Additional Feats parsing now supports dedication descriptions, journal-linked archetype pages, `@UUID[...]` links, and PF2E journal `data-uuid` content links
- Wizard curriculum spellcasting entry reuse is now locale-safe
  - Existing curriculum spellcasting entries are now identified by module flag instead of relying on the English word `Curriculum` in the entry name
- Custom compendium selections now save and display more reliably
  - Saving one compendium category no longer wipes selections from the others
  - Compendium listings now show the owning module/system more clearly, making custom pack lists easier to understand
- Prepared spell and planner pickers now handle custom-source browsing more reliably
  - Source chips now appear where expected in the planner pickers
  - Source filtering, search, and duplicate filtering in the prepared-spell picker now behave correctly with custom spell sources

### Notes

- Prerequisite coverage is broader, but still intentionally mixed between semantic checks and safe `Unverified` fallbacks
  - Supported examples now include dedication feat prerequisites, exact deity requirements, background requirements, language lists and alternatives, common spellcasting clauses, specific spell-with-slot clauses, focus-spell casting, Lore, skills, and several equipment/weapon-state checks
  - Narrative or non-machine-verifiable examples such as faction membership, attendance/history, curse/death-state text, alignment, and similar flavor requirements are intentionally shown as `Unverified` instead of being hard-failed
  - Weapon-training phrasing like `trained in sawtooth sabres` and `trained in at least one type of one-handed firearm` is still handled conservatively as `Unverified` until the module grows more reliable weapon proficiency state

## 1.3.3

### Fixed

- Prepared non-spellbook casters such as druids and clerics no longer import entire tradition spell lists into their spellcasting entry during character creation; only the actual granted and selected spells are added

## 1.3.2

### Fixed

- Fixed multiple planner validation and apply-flow issues around Intelligence bonus picks, ancestry paragon feat slot placement, and multi-level plan application
- Fixed spell-planner and creation issues with subclass granted spells, focus spells, spell choice sets, and Dragon Spit spell entry creation
- Fixed character wizard choice-set handling for direct item prompts, already-trained skill filtering, Fighter-specific skill options, and cleric deity follow-up domain selections such as Cloistered Cleric Domain Initiate
- Fixed spell picker layout overlap so the search and filter controls no longer render under the window header

## 1.3.1

### Improved

- Updated the module's French locale with several new translations and corrections
  - Added missing translations for recently added UI elements and messages
  - Corrected some existing translations for clarity and consistency

## 1.3.0

### Improved

- Added a first full French locale pass for the module UI
  - Registered a French module locale and translated the core planner, wizard, and chat strings
  - Localized repeated wizard labels, summaries, and post-creation reminder banners
- Character creation and planning now rely more consistently on stable PF2E identifiers
  - Removed several locale-sensitive name-to-slug fallbacks in wizard, planner, feat-picker, and choice-set flows
  - Choice-set values and lookups now prefer UUIDs and real slugs instead of localized item names

### Fixed

- French PF2E support is more robust across wizard parsing and prompt handling
  - Reworked lore and tradition fallback parsing to avoid English-only description matching where possible
  - Reduced failures caused by translated PF2E names, prompts, and labels in subclass, feat-choice, and ancestry/heritage flows

## 1.2.5

### Improved

- Planner feat prerequisites can now be shown without being enforced
  - Added a separate `Enforce Feat Prerequisites` setting so GMs can allow manual overrides while still showing prerequisite result tags in the feat picker
- Character wizard and planner UI paths now do less repeated work
  - Reduced repeated document lookups in wizard choice-set, apply-overlay, and skills/languages helpers
  - Debounced feat and spell picker filtering updates
  - Cached planner build-state and batched spell UUID resolution in level planner spell context

### Fixed

- Wizard ancestry and similar rarity tags now render as compact pills again instead of stretching across the whole row
- Planner feat rows no longer appear dimmed when prerequisite enforcement is disabled
  - Unmet prerequisite tags still show, but the feat card now looks selectable when bypass is allowed

## 1.2.4

### Improved

- Planner feat picking now respects archetype subtypes more accurately
  - Class Feat and Free Archetype pickers now distinguish multiclass archetypes, class archetypes, and normal archetypes instead of treating them as one bucket
  - Same-class multiclass dedications are hidden, while normal archetypes and other multiclass dedications remain available

### Fixed

- Handler-owned class prompts no longer leak into Character Wizard Feat Choices
  - Dedicated Champion/Cleric prompts like deity, sanctification, and divine font now stay only in their own steps instead of reappearing under Feat Choices
- Character wizard now avoids duplicate system-owned class option application more consistently
  - PF2E-owned `ChoiceSet` outcomes such as Exemplar ikons are no longer manually embedded by the module, preventing duplicate class features and stuck apply flows
- Planner archetype restrictions now enforce the class-archetype rule correctly
  - Once a build already has a class archetype dedication, the planner no longer offers a different class archetype dedication later
  - Non-class archetypes and other valid multiclass dedications remain available

## 1.2.3

### Fixed

- Character creation now relies on PF2E to grant all `ChoiceSet` results
  - The wizard still records and displays chosen prompt answers, but it no longer manually embeds subclass, feat, granted-feat, or handler-owned `ChoiceSet` outcomes that PF2E already applies itself
  - This removes duplicate class-feature/item grants such as Exemplar ikons being added both by PF2E and by the module
- Character wizard apply messaging better reflects the new PF2E-owned prompt flow
  - The apply stage now clearly waits for PF2E class option prompts instead of implying the module is directly applying those selected class options

## 1.2.2

### Improved

- Character creation loading overlay now focuses on PF2E prompts only
  - Removed the redundant `Selections` block so the apply overlay is cleaner and easier to use during system `ChoiceSet` prompts
- Planner feat picker gained more targeted filters
  - Added a `Skill Feats` toggle to the General Feat picker alongside the existing skill and dedication filters

### Fixed

- Weapon choice-set handling now matches PF2E more closely
  - Melee-only weapon prompts such as Barrow's Edge now classify ranged weapons correctly, respect thrown-melee exceptions, and use the same weapon state for both candidate filtering and the on-screen weapon filters
- Loading overlay prompt rows now follow nested selected choice items
  - Chosen follow-up options like granted ikon weapons now appear in the PF2E prompt checklist instead of stopping at the parent choice
- Feat-choice handling is more robust after reopening the wizard
  - Rebuilt feat choice sections now preserve saved selections instead of dropping them when the wizard reparses live item rules
- Character wizard step refresh and completion state now update more reliably
  - Background, feat, and feat-choice selections now force a fresh wizard-part rerender so the selected state appears immediately
  - Sidebar completion for Languages and Skills now recalculates from current INT-dependent requirements instead of staying stale until those steps are visited
- Planner spellbook spell selection now behaves correctly for spellbook casters
  - Wizard and other spellbook classes no longer show the spontaneous rank-row add flow alongside spellbook additions
  - Spellbook pickers now hide already known spells, hide spells already selected for the same planned level, and cap available spell ranks to the highest rank the character can cast at that level

## 1.2.1

### Improved

- Character creation loading overlay now acts as a real PF2E prompt checklist
  - Shows saved wizard selections during apply, highlights the currently open PF2E prompt when matched, and keeps unresolved prompts visible as pending instead of hiding them
- Feat Choices step now supports granted-feat and nested follow-up choice sets
  - Heritage/background/class-granted feats with `ChoiceSet`s now surface in the wizard, can introduce further sub-choices dynamically, and appear in Summary/apply overlay output
- Generic `ChoiceSet` rendering now covers more PF2E rule shapes
  - UUID-backed options render as inspectable item cards
  - Config- and filter-driven skill choices render as skills instead of compendium feats
  - Common ancestry prompts now stay common-only even when PF2E expresses ancestry through filters instead of `itemType`
- Prerequisite parsing and build-state matching are more reliable
  - Added build-state proficiency tracking for Perception, saves, and Class DC
  - Parser/matcher now normalize PF2E wording like `Class DC` and common proficiency subject variants

### Fixed

- Granted feat `ChoiceSet`s now stay incomplete until selections are actually made
  - The Feat Choices step no longer shows as complete while heritage/background/class-granted feat prompts are still unanswered
- `Adopted Ancestry` and similar granted-feat prompts now parse correctly
  - Granted feat prompts honor PF2E's slug-valued ancestry choices, common-only ancestry restrictions, and nested follow-up choices such as ancestry-specific weapon selections
- Focus spell grants now start with available focus points instead of looking already spent
  - Character creation and feat-driven focus entry creation now refill the pool when PF2E has already initialized `focus.max` but left `focus.value` at `0`
- Feat Choices no longer surfaces system-owned subclass prompts as duplicate selections
  - Class feature prompts like `Instinct` or `Bloodline` no longer appear again under Feat Choices or cause duplicate application
- Feat Choices step performance improved
  - Recursive granted-feat refresh now runs on relevant changes instead of every render, reducing lag on large choice graphs

## 1.2.0

### Added

- **Language selection step** in character creation wizard
  - Granted languages from ancestry shown as locked selections
  - Additional language choices based on ancestry allowance + INT modifier
  - Full searchable language list with ancestry-appropriate suggestions highlighted
- **Lore skills** auto-populated from background and subclass during character creation
- **Focus spell support** for character creation and level planner
  - Focus spells detected from subclass data file and displayed in Focus tab
  - Focus spellcasting entry created automatically during character creation
  - Focus pool set to 1 when focus spells are granted
  - Planner shows focus spells at the level they're unlocked (via feat)
- **Subclass choices step** for subclasses with ChoiceSet options (e.g., Elemental bloodline element selection)
  - Choice-dependent granted spells resolved based on selection
- **Deity selection step** for Champion and Cleric
  - Searchable deity list with heal/harm font filter checkboxes
  - Deity stored and applied as embedded item
- **Sanctification step** for Champion (holy/unholy)
  - Filters available causes by selected sanctification
- **Divine Font step** for Cleric (heal/harm)
  - Auto-set when deity only allows one font
  - Creates Divine Font spellcasting entry with 4 rank-1 slots
  - Scales to 5 slots at level 5, 6 at level 15 (planner)
- **Champion devotion spell selection** (Shields of the Spirit, Lay on Hands, Touch of the Void)
  - Available options based on deity's divine font
  - Creates focus spellcasting entry during character creation
- **Summoner link spells** (Evolution Surge + Boost Eidolon) auto-added as focus spells
- **Subclass spell data file** (`subclass-spells.js`) with all ranks for all subclasses
  - Macro to regenerate data from compendium (`generate-subclass-spells.js`)
  - Covers sorcerer bloodlines, oracle mysteries, druid orders, wizard schools, witch patrons, bard muses, magus studies, psychic minds, summoner eidolons
- **Granted spells per level** shown in planner for subclass-granted spells at new ranks
- **Spellstrike indicator** on Magus spell selection (green "Spellstrike" tag on attack spells)
- **Wizard curriculum spellcasting entry** created automatically with extra slots for school spells
- **Wizard Arcane Thesis step** added to character creation
  - Wizard-only step shown alongside other class-specific creation steps
  - Selected thesis shown in summary and creation chat output
- **Animist apparition support** added to character creation
  - Apparitions step supports choosing two apparitions and marking a primary apparition
  - Adds apparition lore, vessel spell, and separate apparition spellcasting entry on apply
- **Psychic subconscious mind step** added to character creation
  - Psychic now captures both Conscious Mind and Subconscious Mind at level 1
  - Selected subconscious mind drives Psychic key ability in the boost flow
- **Thaumaturge implement step** added to character creation
  - First Implement is now an explicit wizard step with summary/chat output and follow-up reminder
- **Commander tactics step** added to character creation
  - Supports selecting the five starting tactics from the action compendium
- **Exemplar ikons step** added to character creation
  - Supports selecting the three starting ikons with summary/chat output and follow-up reminder
- **Inventor innovation details step** added to character creation
  - Weapon and Armor Innovation now collect their base item and initial modification in the wizard
- **Kineticist kinetic gate step** added to character creation
  - Captures single vs dual gate, optional second element, and starting impulses in the wizard
- **Witch familiar spellbook** correctly sized (10 cantrips + 6 rank-1 including patron lesson)
- **Focus spells from feats** auto-detected and added during level-up (scans feat rules and description for spell UUIDs)
- **Already-known spells** marked with "Known" tag in spell picker to prevent confusion
- **Feat taken indicators** in both creation wizard and level planner feat picker
  - Feats with `maxTakable > 1` remain selectable
  - Tooltip shows level taken and explains why feat can't be re-selected

### Improved

- **Selected spells** now display as compact chips instead of full-width rows
- **Selected items** (ancestry/heritage/background/class/subclass) hidden from selection list
- **Boost rows** dim unselected options when complete
- **Subclass choice buttons** show green highlight when selected
- **Generic subclass ChoiceSet support** expanded beyond inline arrays
  - Filter-backed PF2E choice sets now resolve into real wizard options and keep readable labels in summary/chat output
- **Subclass summaries** now use readable combined labels
  - UUID-backed and slug-backed follow-up choices now resolve to item names or formatted labels in the Summary step and creation chat
- **Compact spell chips** are clickable to view spell details
- **Spell rarity filters** added to character creation spell selection
  - Cantrip and 1st-rank spell tabs now expose uncommon, rare, and unique spells via toggle filters
- **Class step pickers** now use more consistent count headers
  - Tactics, Ikons, Apparitions, and Kineticist impulse picking all show selected progress more clearly
- **Generic class option rendering** now uses inspectable item cards whenever an option resolves to a UUID
  - UUID-backed subclass and follow-up choices render like feat cards with clickable item names instead of plain button lists
- **Level planner Intelligence bonus pickers** now behave more like normal single-choice selectors
  - Single-slot bonus skill/language choices swap directly when clicking a different option
  - Planner preserves sidebar/content scroll position across quick save-rerender cycles
- **Character creation apply step** now embeds selected subclass and class-option items consistently
  - Chosen subclasses, follow-up subclass choices, implements, tactics, ikons, thesis, subconscious mind, apparitions, kineticist picks, and inventor details now apply to the created actor instead of living only in wizard state
- **Sorcerer granted spell detection** completely rewritten — uses data-driven lookup instead of fragile HTML parsing
- **Spell rank validation** — rank 2+ spells blocked from being added at level 1

- **Character creation loading overlay** now acts as a real PF2E prompt checklist
  - Shows saved wizard selections during apply, highlights the currently open PF2E prompt when matched, and keeps unresolved prompts visible as pending instead of hiding them
- **Feat Choices step** now supports granted-feat and nested follow-up choice sets
  - Heritage/background/class-granted feats with `ChoiceSet`s now surface in the wizard, can introduce further sub-choices dynamically, and appear in Summary/apply overlay output
- **Generic ChoiceSet rendering** now covers more PF2E rule shapes
  - UUID-backed options render as inspectable item cards
  - Config- and filter-driven skill choices render as skills instead of compendium feats
  - Common ancestry prompts now stay common-only even when PF2E expresses ancestry through filters instead of `itemType`

### Fixed

- **Planner prerequisite checks** now recognize feat aliases more reliably
  - Parenthetical feat variants like `Efficient Alchemy (Alchemist)` now satisfy prerequisites that reference the base feat name
- **Planner ability boosts** now surface Intelligence modifier benefits
  - When a planned ability boost increases INT modifier, the planner now requires matching bonus trained skill and bonus language selections and applies them during level-up
- **Planner Intelligence bonus language labels** now localize PF2E language keys correctly
  - Bonus language pickers show readable names like `Draconic` instead of raw localization keys
- **Planner same-level Intelligence bonus skills** now feed into the skill increase picker
  - If an INT bonus trains a skill on that level, the regular skill increase section immediately reflects the new trained rank
- **Wizard curriculum parsing and selection** updated for current PF2E v13 school formats
  - Handles markdown-style curriculum blocks and rank labels written without a colon
- **Wizard curriculum spell application** corrected
  - Curriculum spells no longer spill into the regular wizard spellcasting entry
  - Only the chosen curriculum spells are added to the dedicated curriculum entry
- **Wizard curriculum UI** now matches the rest of the spell selection interface
  - Uses standard chips/cards styling and enforces the correct curriculum selection limits
- **Kineticist impulse picker** now shows proper selection counts and hides remaining options once full
- **Kineticist dual gate filtering** now only offers valid opposite-element impulse picks for the second choice
- **Generic subclass option cards** now render compendium-backed choices as real item cards
  - Applies to both filter-backed and inline stored choice sets, including slug-based kineticist impulse options
- **Dragon Instinct choice handling** now respects distinct dragon selections
  - Object-backed dragon options no longer all appear selected at once and now render in the richer card-style choice UI
- **Generic subclass lore parsing** now splits multiple lore grants correctly
  - Text like `Underworld Lore and Warfare Lore` is no longer collapsed into one fake lore entry
- **Rogue racket key abilities** now apply correctly in character creation
  - Mastermind uses INT, Ruffian uses STR, Scoundrel uses CHA, and Eldritch Trickster follows the selected dedication's class key ability
- **Psychic level-1 spell grants** now apply correctly
  - Conscious Mind grants its three level-1 psi cantrips and granted 1st-rank spell without reducing normal Psychic spell picks

- **Granted feat ChoiceSets** now stay incomplete until selections are actually made
  - The Feat Choices step no longer shows as complete while heritage/background/class-granted feat prompts are still unanswered
- **Adopted Ancestry and similar feat prompts** now parse correctly from granted items
  - Granted feat prompts honor PF2E's slug-valued ancestry choices, common-only ancestry restrictions, and nested follow-up choices such as ancestry-specific weapon selections
- **Focus spell grants** now start with available focus points instead of looking already spent
  - Character creation and feat-driven focus entry creation now refill the pool when PF2E has already initialized `focus.max` but left `focus.value` at `0`

### Architecture

- **Class handler pattern** — class-specific creation behavior extracted from wizard into handlers
  - `BaseClassHandler` for martial classes (no spells)
  - `CasterBaseHandler` for all standard casters (spell resolution, application)
  - `ChampionHandler` for deity, sanctification, devotion spells
  - `ClericHandler` for deity, divine font
  - `SummonerHandler` for link spells (Evolution Surge, Boost Eidolon)
  - `WizardHandler` for curriculum spellcasting entry
  - `WitchHandler` for familiar spellbook counts
- **Spell apply logic moved to handlers** — `applySpellcasting`, `applyFocusSpells`, `applyDivineFont` extracted from `apply-creation.js` into class-specific handlers
- **Shared constants** — `SUBCLASS_TAGS`, `SPELLBOOK_CLASSES` extracted to `constants.js`
- **`capitalize()`** deduplicated to single source in `utils/pf2e-api.js`
- **Thaumaturge implements** removed from subclass selection (not a true subclass)
- **ARCHITECTURE.md** — comprehensive system guide documenting module structure, PF2e integration, handler pattern, and data structures

## 1.1.1

### Improved

- Selected spells in character creation now display as compact chips instead of full-width rows
- Selected ancestry/heritage/background/class/subclass is now hidden from the selection list
- Feats already taken are marked as "Taken" with disabled selection in both character creation and level planner feat picker
  - Feats that can be taken multiple times remain selectable
  - Tooltip explains why a feat cannot be selected again

## 1.1.0

### Added

- Ancestral Paragon variant rule support
  - New module setting to enable the variant (Module Settings > PF2e Leveler)
  - When enabled, adds ancestry feat slots at levels 3, 7, 11, 15, and 19
  - Works with existing plan migration — enabling/disabling updates plans automatically

- Language selection step in character creation wizard (between Ability Boosts and Skills)
  - Shows granted languages from ancestry (e.g., Common, Dwarven)
  - Choose additional languages based on ancestry allowance + INT modifier
  - Full language list with search, ancestry-appropriate options highlighted
- Lore skills auto-populated from background and subclass during character creation
  - Background lore skills (e.g., "Warfare Lore") shown in Skills step and applied as trained
  - Subclass lore skills parsed from rules and descriptions
- Languages and lore skills shown in creation summary and chat message

### Changed

- Subclass choice warning banner made significantly more prominent with larger text, bold styling, and visible orange border

## 1.0.9

### Added

- Auto-populate all tradition cantrips and rank-1 spells for prepared casters (Cleric, Druid) on character creation

### Fixed

- Prepared casters (Cleric, Druid) missing spellcasting entry and slots after character creation
- Versatile Heritage feats not showing in ancestry feat selection (e.g. Dragonblood feats for Orc)

## 1.0.7

### Added

- Spell selection in character creation and level-up planner for Witch and Magus (spellbook/familiar classes)
- Magus spellbook counts for character creation (8 cantrips, 4 rank-1)
- Live skill selection counter in character creation (e.g. "3/5")

### Fixed

- Cantrip slot count not set after character creation (showed 0 on character sheet)
- Witch had no spell selection step in character creation or level-up planner
- Magus had no spell selection step in character creation or level-up planner
- Prepared casters (Cleric, Druid) missing spellcasting entry and slots after character creation
- Versatile Heritage feats not showing in ancestry feat selection (e.g. Dragonblood feats for Orc)

## 1.0.6

### Added

- Rarity filter checkboxes (Uncommon/Rare) in the feat picker
- "Hide Rare Feats" setting (default: on) to hide rare feats from the feat picker
- Wizard spellbook counts for character creation (10 cantrips, 7 rank-1 for curriculum schools, 6 rank-1 for Unified Magic)

### Changed

- Character sheet buttons now use icon-only anchors with tooltips matching native Foundry header icons
- Archetype feat picker defaults to "Eligible Only" filter
- Dedication feats filtered out of the class feat picker
- Feat category matching uses item slug instead of name for locale-independent filtering

### Fixed

- Partial ability boosts beyond +4 no longer cost 2 boost points — you always select 4 attributes per milestone
- Class KEY ability boost not counted in character creation boost totals
- Feat prerequisite "Focus Pool" now recognized by checking actor's focus pool resource
- Feat prerequisites now also match against class features (not just feats)
- Feat picker build state includes same-level skill increases and boosts for prerequisite checks
- Ability prerequisite with modifier format (e.g. "Dexterity +2") now parsed and matched correctly

## 1.0.4

### Fixed

- Character creation crash (`f.includes is not a function`) when ancestry/heritage ChoiceSet rules contain object filters instead of strings (e.g. Elf, Goblin)

## 1.0.3

### Added

- Trait chip filter with autocomplete in the planner's spell picker
- Rarity toggles (Uncommon/Rare checkboxes) in the planner's spell picker
- Wizard spellbook spell selection in both planner and character creation
- Dual Class variant rule support in the planner
- Alternate Ancestry Boosts toggle in character creation
- Subclass skill parsing from HTML description (e.g. Barbarian Bloodrager)
- Sorcerer bloodline tradition detection via RollOption rules
- Summoner eidolon tradition detection via HTML description (`<strong>Tradition</strong>`)
- `signed` Handlebars helper for proper +/- display

### Changed

- Spell selection now available for Wizard (spellbook) alongside spontaneous casters
- Prepared casters (Cleric, Druid, Witch, Magus) correctly skip spell selection
- Trait chip and input font sizes increased for readability
- Trait input padding increased for better usability
- Skill rank label absolutely positioned so skill names stay centered
- Subclass skills note only shows when no subclass is selected
- Feat grid fills available height when no class feat section present
- Wizard item images increased to 40px for better visibility
- Skill rank label font size increased for readability

### Fixed

- Spell picker trait chips barely readable at small font size
- Negative ability modifier displayed as `+-1` instead of `-1`
- Duplicate "Create Character" buttons on sheet re-render
- Subclass granted skills not detected when only in HTML description
- Skills step note showing even after subclass selection

## 1.0.2

### Added

- Rarity toggle filters (Uncommon/Rare checkboxes) on all item selection grids
- Compendium preloading on wizard open for instant step transitions
- `data-rarity` attribute on all wizard items for filtering

### Changed

- Item grids now fill available page space instead of fixed max-height
- Item name font size increased for readability
- Buttons moved to window header to avoid overlapping the level badge

### Fixed

- Spellcasting entry tradition now correctly resolved from subclass selection

## 1.0.1

### Added

- Dual Class variant rule support (second class feat slot at even levels)
- Proficiency without Level variant detection
- Stamina variant detection
- Gradual Ability Boosts variant support in the level-up planner
- CURRENT tag on the sidebar for the character's active level
- GitHub Actions release pipeline and Husky pre-commit hooks

### Fixed

- Ability boosts now correctly apply to ancestry/background items per PF2e system format
- Spellcasting entry tradition resolved from subclass (e.g. Diabolic Sorcerer → divine)
- Spell slot max/value set correctly on spellcasting entries
- Level-up auto-apply hook fixed (actor already updated when hook fires)
- Gradual boosts stored in milestone keys (5/10/15/20) not individual level keys
- Fighter and other martial classes now correctly show level 1 class feat in character creation
- Ancestry/class feats filtered to level 1 in character creation
- Pending ChoiceSet prompts filtered to level 1 features only
- Skills step completion checks against required count, not just > 0
- Spells step completion checks both cantrips and rank 1 counts
- Free Archetype feat picker crash (proficiency matcher null check)
- Chat messages whispered to GM and character owner only

## 1.0.0 - Initial Release

### Character Creation Wizard

- Full step-by-step character creation: Ancestry, Heritage, Background, Class, Subclass, Ability Boosts, Skills, Feats, Spells
- Subclass selection for 22 classes (Bloodlines, Orders, Schools, Mysteries, Patrons, etc.)
- Subclass-granted spells and skills auto-detected and applied
- Ability boost table with per-source rows (ancestry, background, class, free)
- Progressive boost unlock for backgrounds (restricted choices first)
- Spell picker with tradition filtering, trait chip search, and cantrip/rank tabs
- Spellcasting entry creation with correct tradition from subclass
- Pending ChoiceSet prompts listed in summary
- Applies all selections to the actor including items, boosts, skills, feats, and spells

### Level-Up Planner

- Plan levels 2-20 with sidebar navigation and completion status
- Class feat, skill feat, general feat, ancestry feat selection
- Prerequisite validation against planned build state (feats from previous levels)
- Skill increase picker with rank-colored buttons
- Ability boost selector with partial boost (18+) cost tracking
- Spell slot progression display for all caster types (prepared, spontaneous, dual, bounded)
- Inline spell selection for spontaneous casters with tradition filtering
- Plan export/import as JSON
- Auto-apply on level change with confirmation dialog
- Focus spell reminder notes on applicable feats
- Chat message summary whispered to GM and character owner

### Supported Classes (27)

Alchemist, Animist, Barbarian, Bard, Champion, Cleric, Commander, Druid, Exemplar, Fighter, Guardian, Gunslinger, Inventor, Investigator, Kineticist, Magus, Monk, Oracle, Psychic, Ranger, Rogue, Sorcerer, Summoner, Swashbuckler, Thaumaturge, Witch, Wizard

### Variant Rules

- Free Archetype
- Mythic
- Automatic Bonus Progression (ABP)
- Gradual Ability Boosts
