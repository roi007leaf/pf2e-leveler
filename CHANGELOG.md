# Changelog

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
