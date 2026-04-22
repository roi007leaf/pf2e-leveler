[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/pf2e-leveler?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/pf2e-leveler/releases/latest)

[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/pf2e-leveler/total)](https://github.com/roi007leaf/pf2e-leveler/releases)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-leveler)](https://forge-vtt.com/bazaar)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/roileaf)
# PF2e Leveler

A Foundry VTT module for Pathfinder 2nd Edition that provides a **Character Creation Wizard**, a **Level-Up Planner** with automatic application on level change, and a **GM Content Guidance** system for controlling what options players see.

## Features

### Character Creation Wizard

A full step-by-step character creation flow that builds and applies a complete level-1 character to an actor.

**Steps covered:**

- **Ancestry** — browse and select ancestry with image preview
- **Heritage** — grouped display separating ancestry heritages from versatile heritages; ChoiceSets like Elf Atavism correctly resolve to heritage options
- **Background** — auto-detects trained skills and lores from background data
- **Class** — all 29 supported classes; creates and applies the class item
- **Deity** — for divine classes; auto-sets divine font and sanctification when only one option is valid
- **Subclass** — full selection of subclasses (Bloodlines, Orders, Schools, Mysteries, Patrons, Doctrines, etc.) with automatic tradition resolution and granted skill/lore detection
- **Subclass choices** — inline ChoiceSet prompts for subclass-specific options (e.g. element for Kineticist, conscious mind for Psychic)
- **Ability Boosts** — per-source rows (ancestry, background, class, free) matching PF2e's layout; alternate ancestry boost mode supported
- **Skills** — class, background, subclass, and deity skill grants shown as auto-trained; remaining free picks selectable; lore selection for background and subclass lores
- **Feats** — ancestry feat, class feat, skill feat, and class-specific slots (tactics, ikons, kinetic impulses, implements, etc.) with inline ChoiceSet resolution; feat cards show items granted by selected feats
- **Languages** — ancestry-granted languages shown as non-removable; feat-granted languages (e.g. Angelkin granting Empyrean) auto-detected and marked as granted with source label; choosable languages sorted with ancestry suggestions first; slot count respects INT modifier and feat bonuses (e.g. Multilingual)
- **Spells** — cantrips and rank-1 spells via popup spell picker; curriculum spells for Magus/Witch; focus spell selection where applicable
- **Equipment** — browse and add starting equipment within a configurable budget; batch-priced items (ammunition, rations) handled correctly with proper quantities; permanent item slots for higher-level starting wealth
- **Summary** — full review of all choices before applying; pending ChoiceSet prompts listed

**Prerequisite checking** (character wizard and level planner):

- Skill rank requirements (trained/expert/master/legendary), including comma/or-separated lists
- Feat prerequisites with cross-feat matching
- Armor, weapon, and casting proficiency requirements
- Sense prerequisites (low-light vision, darkvision, etc.) — darkvision satisfies low-light vision; senses granted by ancestry and heritage are detected
- Ancestry and heritage trait prerequisites — Remaster half-heritage names (Dromaar, Aiuvarin) map to parent ancestry traits, unlocking orc/elf feats correctly
- Level, ability score, class feature, deity, and spellcasting state requirements
- Subclass spell prerequisites (bloodline spell, mystery spell, patron spell)

**Applies to actor:**

- Ancestry, heritage, background, class, subclass, deity
- Ability boosts, skills, languages, lores
- Ancestry feat, class feat, skill feat, and class-specific feats
- Spellcasting entries with correct tradition, ability, and prepared/spontaneous type
- Chosen spells (cantrips, rank-1, focus spells)
- Starting equipment with correct quantities

### Level-Up Planner

Plan all level-up choices from level 2 to 20, then auto-apply when the character levels up.

- Class feat, skill feat, general feat, and ancestry feat selection per level with prerequisite checking
- Archetype feat support including Free Archetype variant; dedication filter only active until a dedication has been chosen
- Skill increase picker with rank-colored buttons and proficiency cap enforcement
- Ability boost selector with partial boost (18+) support and score progression display across the full build
- Spell slot progression for casters; inline spell selection for spontaneous casters with heightening support (pick any spell at a rank above its base level)
- INT-based bonus skill and language planning following actual level-1 boost state
- Class feature skill proficiency grants respected in rank calculations
- Starting wealth and equipment management per level using Table 10-10 (permanent item slots + lump sum + custom mode)
- Custom feat, skill increase, and spell additions for edge cases
- Per-level reminders/notes
- Export and import plans as JSON
- Per-level reset via the Clear Level button
- Plan validation with per-level completion status shown in the sidebar
- Auto-apply on level change with confirmation dialog
- Multi-level application: if a character skips levels, all planned levels between old and new are applied together
- Chat message summary of applied changes (whispered to GM and character owner)

### Spell Preparation Sheet Integration

- **"Add to Spellbook"** button appears on spell preparation sheet headers for each spell rank
- Opens a pre-configured spell picker filtered to the correct rank and tradition
- Prevents adding already-owned spells
- Applies only to prepared casters

### GM Content Guidance

GMs can mark any ancestry, heritage, background, class, skill, or language as **Suggested** or **Disallowed** from a dedicated settings menu (Module Settings → Configure Suggestions).

- Suggested items display a gold star badge and sort to the top of their list
- Disallowed items are dimmed with a red "Disallowed" badge and their Select button is disabled
- Marks are stored as a world-scoped setting; changing marks automatically invalidates the cache
- Disallowed options remain visible so players know they exist

### Supported Classes (29)

Alchemist, Animist, Barbarian, Bard, Champion, Cleric, Commander, Daredevil, Druid, Exemplar, Fighter, Guardian, Gunslinger, Inventor, Investigator, Kineticist, Magus, Monk, Oracle, Psychic, Ranger, Rogue, Slayer, Sorcerer, Summoner, Swashbuckler, Thaumaturge, Witch, Wizard

### Variant Rules

- **Free Archetype** — archetype feat slots at every even level; dedication filter unlocks after first dedication is chosen
- **Ancestral Paragon** — additional ancestry feat at levels 3, 7, 11, 15, and 19
- **Mythic** — mythic feat slots at every even level
- **Automatic Bonus Progression (ABP)** — skill potency tracking integrated into planner
- **Gradual Ability Boosts** — 1 boost per level instead of 4 at milestones; prevents selecting the same ability twice across a 4-level group

### Module Settings

**World settings (GM only):**

| Setting | Description |
|---|---|
| Show Plan Button | Show/hide the Level Planner button on character sheets |
| Auto Apply On Level Up | Automatically prompt to apply plans when a character levels up |
| Show Prerequisites | Display prerequisite check results in feat pickers |
| Enforce Prerequisites | Block selecting feats with unmet prerequisites (advisory mode when disabled) |
| Hide Uncommon Feats | Filter out uncommon feats by default in pickers |
| Hide Rare Feats | Filter out rare feats by default in pickers |
| Player Allow Uncommon | Allow players to select uncommon feats |
| Player Allow Rare | Allow players to select rare feats |
| Player Allow Unique | Allow players to select unique feats |
| Starting Wealth Mode | Disabled / Items & Currency / Lump Sum / Custom gold limit |
| Starting Equipment Gold Limit | Custom gold budget for level-1 equipment (Custom mode) |
| Ancestral Paragon | Enable the Ancestral Paragon variant rule |
| Compendium Manager | Select custom feat compendiums to include |
| Player Compendium Access | Configure per-player access to feat compendiums |
| Restrict Player Compendium Access | Enable/disable player compendium access restrictions |
| Content Guidance | GM menu for marking items as Suggested or Disallowed |

**Client settings (per user):**

| Setting | Description |
|---|---|
| Feat Sort Method | Sort feats by level (desc/asc) or alphabetically (asc/desc) |

### Localization

- English and French module locales included
- Core wizard and planner flows work with localized PF2e data including French translations
- Post-apply ChoiceSet prompts are handled by the PF2e system and follow its own localization

## Installation

1. In Foundry VTT, go to **Add-on Modules** → **Install Module**
2. Paste the manifest URL: `https://github.com/roi007leaf/pf2e-leveler/releases/latest/download/module.json`
3. Click **Install**
4. Enable the module in your world's module settings

## Usage

### Character Creation

1. Create a new character (level 1, no class assigned)
2. Click the **Create Character** button on the character sheet header
3. Walk through each step, selecting your choices
4. Review the summary and click **Create Character**
5. The PF2e system will prompt for any remaining ChoiceSet selections (subclass options, etc.)

### Level-Up Planning

1. Open a character with a supported class
2. Click the **Plan Levels** button on the character sheet header
3. Click any level in the sidebar to plan choices for that level
4. Select feats, skills, boosts, and spells
5. When the character levels up, a confirmation dialog will offer to auto-apply the planned selections

### GM Content Guidance

1. Go to **Module Settings** → **Configure Suggestions**
2. Use the search field and filters to find any ancestry, heritage, background, class, skill, or language
3. Click the star to mark it Suggested, or the X to mark it Disallowed
4. Players will see the badges and sort order immediately

## Requirements

- Foundry VTT v13+
- PF2e System v7.0.0+

## License

MIT
