# PF2e Leveler

A Foundry VTT module for Pathfinder 2nd Edition that provides a **Character Creation Wizard** and a **Level-Up Planner** with automatic application on level change.

## Features

### Character Creation Wizard

- Step-by-step character creation: Ancestry, Heritage, Background, Class, Subclass, Ability Boosts, Skills, Feats, and Spells
- Full subclass selection (Bloodlines, Orders, Schools, Mysteries, Patrons, and more) with automatic tradition resolution
- Ability boost table matching the PF2e system's layout with per-source rows
- Subclass-granted spells and skills shown automatically
- Inline spell picker with trait filtering and tradition-aware browsing
- Ancestry/class feat selection with trait display and prerequisite info
- Summary page with pending ChoiceSet prompts listed
- Applies ancestry, heritage, background, class, subclass, boosts, skills, feats, spellcasting entries, and spells to the actor

### Level-Up Planner

- Plan all level-up choices from level 2 to 20
- Class feat, skill feat, general feat, and ancestry feat selection with prerequisite checking
- Skill increase picker with rank-colored buttons
- Ability boost selector with partial boost (18+) support
- Spell slot progression display for casters
- Inline spell selection for spontaneous casters
- Free Archetype, Mythic, ABP, and Gradual Boosts variant rule support
- Plan validation with per-level completion status
- Export/import plans as JSON
- Auto-apply on level change with confirmation dialog
- Chat message summary (whispered to GM and character owner)

### Supported Classes (All 27)

Alchemist, Animist, Barbarian, Bard, Champion, Cleric, Commander, Druid, Exemplar, Fighter, Guardian, Gunslinger, Inventor, Investigator, Kineticist, Magus, Monk, Oracle, Psychic, Ranger, Rogue, Sorcerer, Summoner, Swashbuckler, Thaumaturge, Witch, Wizard

### Variant Rules

- **Free Archetype** - Archetype feat slots at every even level
- **Mythic** - Mythic feat slots at every even level
- **Automatic Bonus Progression (ABP)** - Skill potency tracking
- **Gradual Ability Boosts** - 1 boost per level instead of 4 at milestones

## Installation

1. In Foundry VTT, go to **Add-on Modules** > **Install Module**
2. Paste the manifest URL: `https://github.com/roi007leaf/pf2e-leveler/releases/latest/download/module.json`
3. Click **Install**
4. Enable the module in your world's module settings

## Usage

### Character Creation

1. Create a new character (level 1, no class assigned)
2. Click the **Create Character** button on the character sheet header
3. Walk through each step, selecting your choices
4. Review the summary and click **Create Character**
5. The PF2e system will prompt you for any remaining ChoiceSet selections (subclass, etc.)

### Level-Up Planning

1. Open a character with a supported class
2. Click the **Plan Levels** button on the character sheet header
3. Click any level in the sidebar to plan your choices
4. Select feats, skills, boosts, and spells for each level
5. When the character levels up, a confirmation dialog will offer to auto-apply the planned selections

## Requirements

- Foundry VTT v13+
- PF2e System

## License

MIT
