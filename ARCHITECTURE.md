# PF2e Leveler - Architecture & System Guide

## Overview

PF2e Leveler is a Foundry VTT module for the PF2e system that provides:
1. **Character Creation Wizard** - step-by-step character creation
2. **Level-Up Planner** - plan all 20 levels with feat/skill/spell selections
3. **Auto-Apply** - apply planned selections on level change

---

## Module Structure

```
scripts/
  main.js                          # Entry point, hooks registration
  constants.js                     # Shared constants (SUBCLASS_TAGS, SPELLBOOK_CLASSES, etc.)
  settings.js                      # Module settings
  
  classes/                         # Class definitions (25 classes)
    registry.js                    # ClassRegistry - centralized class lookup
    sorcerer.js, wizard.js, ...    # Per-class data (HP, feats, spell slots, features)
    progression.js                 # Level progression logic
  
  creation/                        # Character creation
    creation-model.js              # Data model (what gets stored/persisted)
    creation-store.js              # Persistence (actor flags)
    apply-creation.js              # Universal apply logic (items, boosts, skills, etc.)
    class-handlers/                # Class-specific creation behavior
      base.js                      # BaseClassHandler - martial classes (no spells)
      caster-base.js               # CasterBaseHandler - all caster spell logic
      champion.js                  # ChampionHandler - deity, sanctification, devotion
      cleric.js                    # ClericHandler - deity, divine font
      registry.js                  # Maps class slug -> handler instance
  
  data/
    subclass-spells.js             # Spell data per subclass (all ranks, focus spells)
    generate-subclass-spells.js    # Foundry macro to regenerate spell data
  
  apply/                           # Level-up apply logic
    apply-manager.js               # Orchestrates level-up application
    apply-boosts.js                # Ability boosts
    apply-feats.js                 # Feats
    apply-skills.js                # Skill increases
    apply-spells.js                # Spell slots, granted spells, divine font
    apply-class-specific.js        # Class-specific level-up (animist, etc.)
  
  plan/                            # Level-up planning
    plan-model.js                  # Plan data model
    plan-store.js                  # Plan persistence
    plan-validator.js              # Validates plan completeness
    build-state.js                 # Computes character state at any level
  
  ui/                              # UI applications
    character-wizard.js            # Creation wizard (ApplicationV2)
    level-planner.js               # Level planner (ApplicationV2)
    feat-picker.js                 # Feat selection dialog
    spell-picker.js                # Spell selection dialog
    sheet-integration.js           # Adds buttons to character sheet
  
  feats/
    feat-cache.js                  # Compendium feat loading/caching
    feat-filter.js                 # Feat filtering/sorting
  
  prerequisites/
    prerequisite-checker.js        # Feat prerequisite validation
    matchers.js, parsers.js        # Prerequisite parsing
  
  utils/
    i18n.js                        # Localization helpers
    logger.js                      # Logging (debug, info, warn)
    pf2e-api.js                    # PF2e system helpers (settings, slugify, capitalize)

templates/                         # Handlebars templates
styles/                            # CSS files
lang/                              # Localization (en.json)
```

---

## Class Handler Pattern

### Why
Class-specific behavior (deity selection, spell grants, focus spells, etc.) was scattered across the wizard and apply files with `if (slug === 'champion')` chains. The handler pattern centralizes this.

### Architecture
```
BaseClassHandler          <- martial classes (Fighter, Barbarian, etc.)
  |
  +-- CasterBaseHandler   <- all standard casters (shared spell resolution)
  |     |
  |     +-- (sorcerer, wizard, witch, oracle, etc. use CasterBaseHandler directly)
  |     +-- ClericHandler <- deity + divine font + caster spells
  |
  +-- ChampionHandler     <- deity + sanctification + devotion spells (no standard casting)
```

### Handler Methods

| Method | Purpose | Base | CasterBase | Champion | Cleric |
|--------|---------|------|------------|----------|--------|
| `getExtraSteps()` | Additional wizard steps | `[]` | `[]` | deity, sanctification | deity, divine font |
| `isStepComplete(step, data)` | Step completion check | `null` | `null` | deity, sanctification, spells | deity, divine font |
| `getStepContext(step, data, wizard)` | Step render data | `null` | `null` | deity list, sanctification options | deity list, font options |
| `needsSpellSelection(data, classDef)` | Show spells step? | `false` | checks spellcasting | if deity selected | inherited |
| `filterSubclasses(subclasses, data)` | Filter by constraints | pass-through | pass-through | by sanctification | pass-through |
| `resolveGrantedSpells(data)` | Cantrip/rank-1 grants | `{cantrips:[], rank1s:[]}` | data file + curriculum | inherited | inherited |
| `resolveFocusSpells(data)` | Focus spell resolution | `[]` | data file + fallback | devotion spells | inherited |
| `getSpellbookCounts(data, classDef)` | Override spell counts | `null` | wizard:10/6, magus:8/4 | `null` | inherited |
| `getSpellContext(data, classDef)` | Extra template context | `{}` | `{isMagus}` | `{}` | inherited |
| `isFocusSpellChoice()` | Pick one vs all granted | `false` | `false` | `true` | `false` |
| `applyExtras(actor, data)` | Class-specific apply | no-op | spellcasting + focus | deity + devotion | deity + spells + font |

### Adding a New Class Handler
1. Create `scripts/creation/class-handlers/myclass.js`
2. Extend `BaseClassHandler` or `CasterBaseHandler`
3. Override only the methods that differ
4. Register in `registry.js`: `myclass: new MyClassHandler()`

---

## Subclass Spell Data (`subclass-spells.js`)

### Structure
```js
'bloodline-aberrant': {
  focusSpells: { initial: UUID, advanced: UUID, greater: UUID },
  grantedSpells: { cantrip: UUID, 1: UUID, 2: UUID, ... 9: UUID },
  // For choice-dependent subclasses:
  choiceFlag: 'elementalBloodline',
  choiceOptions: [{ slug: 'air' }, ...],
  choices: { air: { cantrip: UUID, 1: UUID, 3: UUID, 6: UUID }, ... },
}
```

### Resolution
`resolveSubclassSpells(slug, choices, rank)`:
- `rank = null`: returns `{ cantrip, rank1, focusSpell }` for character creation
- `rank = N`: returns `{ grantedSpell, focusSpells }` for planner at specific rank

For choice-dependent subclasses (Elemental bloodline):
1. Check explicit `choices` map first (manually verified, 100% correct)
2. Fall back to shared `grantedSpells` for non-choice-dependent ranks
3. Fall back to array index matching against `choiceOptions`

### Regenerating Data
Run `scripts/data/generate-subclass-spells.js` as a Foundry macro. It scans all classfeatures and outputs the complete data. Paste into `subclass-spells.js`.

---

## PF2e System Integration

### How the PF2e System Works

The PF2e system for Foundry VTT is a complex rules engine. Understanding how it processes data is critical for our module.

#### Actor Data Model
A PF2e character actor has:
- `actor.system.details` - name, level, languages, deity reference
- `actor.system.abilities` / `actor.system.attributes` - ability scores
- `actor.system.skills` - 16 standard skills with `rank` (0-4)
- `actor.system.build` - character build tracking (boosts, languages)
- `actor.system.resources.focus` - focus pool (`max`, `value`)
- `actor.items` - all embedded items (feats, spells, equipment, class features, etc.)

#### Embedded Items
Everything on a character is an Item embedded in the actor:
- `type: 'ancestry'` - one per character
- `type: 'heritage'` - one per character
- `type: 'background'` - one per character  
- `type: 'class'` - one per character
- `type: 'feat'` - feats and class features (including subclass)
- `type: 'spell'` - spells (linked to a spellcasting entry)
- `type: 'spellcastingEntry'` - spell list container (prepared, spontaneous, focus, etc.)
- `type: 'lore'` - lore skills
- `type: 'deity'` - selected deity
- `type: 'weapon'`, `'armor'`, `'equipment'`, etc.

#### The Rules Engine
Every item can have `system.rules` - an array of rule elements that the system processes at runtime:

```js
// Example rules on a class feature:
[
  { "key": "ActiveEffectLike", "path": "system.skills.athletics.rank", "value": 1 },
  { "key": "GrantItem", "uuid": "Compendium.pf2e.classfeatures.Item.abc123" },
  { "key": "ChoiceSet", "flag": "bloodline", "prompt": "PF2E.PromptBloodline", "choices": [...] },
  { "key": "RollOption", "option": "tradition:arcane" }
]
```

Key rule types we interact with:
- **ActiveEffectLike**: Sets/modifies actor data (skills, proficiencies, etc.)
- **GrantItem**: Grants another item to the actor (subclass features, spells)
- **ChoiceSet**: Prompts the user to make a selection (bloodline, element, deity, etc.)
- **RollOption**: Sets flags used in predicates and roll calculations

#### ChoiceSet Mechanism (Critical)
When items with ChoiceSet rules are added to an actor, the PF2e system prompts the user with a dialog. This is why:
- **We don't apply subclass items ourselves** - the class item has a ChoiceSet that grants the subclass
- **We can't avoid the system prompt** - it fires automatically when items with ChoiceSets are created
- **We show a reminder banner** telling the user what to pick when prompted

ChoiceSet selections are stored at:
```
item.flags.pf2e.rulesSelections.{flag} = selectedValue
```

ChoiceSet `choices` field formats:
1. **Inline array**: `[{ "value": "air", "label": "Air" }]` - we can parse these
2. **Object with slug**: `[{ "slug": "air", "damageType": "slashing" }]` - extract slug as value  
3. **Compendium query**: `{ "filter": ["item:trait:sorcerer-bloodline"] }` - we can't easily parse these
4. **Config reference**: `"conditionTypes"` - references CONFIG.PF2E

Our `_parseChoiceSets()` only handles inline arrays (formats 1 and 2).

#### Item Processing Order
When we call `actor.createEmbeddedDocuments('Item', [itemData])`:
1. Foundry creates the embedded document
2. PF2e system processes the item's rules
3. GrantItem rules create additional items (which may have their own rules)
4. ChoiceSet rules queue prompts for the user
5. ActiveEffectLike rules modify actor data

This is why we call `waitForSystem()` (600ms delay) after adding ABC items - the system needs time to process rules before we can read the resulting state.

#### What the System Handles vs What We Handle

| Feature | System Handles | We Handle |
|---------|---------------|-----------|
| Subclass selection | ChoiceSet prompt after class added | Show reminder, pre-filter options |
| Ancestry languages (granted) | Auto-grants from ancestry item | Nothing needed |
| Ancestry languages (additional) | Shows unallocated slots | We write to `system.details.languages.value` |
| Ability scores from boosts | Computes from build data | We set boost selections on items |
| Trained skills from class/bg | Rules on class/bg items handle it | We set additional chosen skills |
| Spell slots | Nothing automatic | We create spellcasting entry + set slots |
| Granted spells (bloodline etc.) | Sometimes via GrantItem rules | We add from data file (more reliable) |
| Focus spells | Sometimes via GrantItem rules | We add from data file + create focus entry |
| Focus pool | Nothing automatic | We set `system.resources.focus.max` |
| Divine font | System may handle via rules | We create separate spellcasting entry |
| HP calculation | Auto from class HP + CON | Nothing needed |
| Proficiencies | Rules on class item | Nothing needed |

### Compendium Packs

The PF2e system provides compendium packs we read from:

| Pack Key | Content | How We Use It |
|----------|---------|---------------|
| `pf2e.ancestries` | All ancestries | Ancestry selection step |
| `pf2e.heritages` | Heritage features | Heritage selection (filtered by ancestry) |
| `pf2e.backgrounds` | All backgrounds | Background selection step |
| `pf2e.classes` | All classes | Class selection step |
| `pf2e.classfeatures` | Subclasses, class features | Subclass selection (filtered by tag) |
| `pf2e.feats-srd` | All feats | Feat picker (ancestry, class, skill, general) |
| `pf2e.spells-srd` | All spells | Spell selection + tradition auto-populate |
| `pf2e.deities` | All deities | Deity selection (Champion, Cleric) |

Packs are loaded via `game.packs.get(key).getDocuments()` and cached.

### Item Data Structures

#### Ancestry Item
```js
{
  type: 'ancestry',
  system: {
    languages: { value: ['common', 'dwarven'], custom: '' },
    additionalLanguages: { count: 2, value: ['elven', 'gnomish', ...], custom: '' },
    boosts: { 0: { value: ['con'] }, 1: { value: ['str', 'dex', ...] } },
    flaws: { 0: { value: ['cha'] } },
    hp: 10,
    traits: { value: ['dwarf', 'humanoid'], rarity: 'common' },
  }
}
```

#### Background Item
```js
{
  type: 'background',
  system: {
    trainedSkills: { value: ['athletics', 'intimidation'], lore: ['Warfare Lore'] },
    boosts: { 0: { value: ['str', 'con'] }, 1: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } },
  }
}
```

#### Class Item
```js
{
  type: 'class',
  system: {
    keyAbility: { value: ['str', 'dex'], selected: null },
    trainedSkills: { value: ['arcana'], additional: 3 },
    classFeatLevels: { value: [1, 2, 4, 6, ...] },
    items: {
      // Level-1 class features granted by this class
      '0': { uuid: 'Compendium.pf2e.classfeatures.Item.xxx', level: 1, name: 'Feature' },
    },
    rules: [
      // ChoiceSet for subclass selection
      { key: 'ChoiceSet', flag: 'bloodline', choices: { filter: ['item:tag:sorcerer-bloodline'] } }
    ]
  }
}
```

#### Subclass (Class Feature) Item
```js
{
  type: 'feat',  // subclasses are feats with classfeature traits
  system: {
    traits: { value: ['sorcerer'], otherTags: ['sorcerer-bloodline'], rarity: 'common' },
    description: { value: '<p>HTML with spell UUIDs, granted spells, etc.</p>' },
    rules: [
      // May have ChoiceSet for sub-selection (element, dragon type, etc.)
      { key: 'ChoiceSet', flag: 'elementalBloodline', choices: [...] },
      // May have ActiveEffectLike for skill training
      { key: 'ActiveEffectLike', path: 'system.skills.nature.rank', value: 1 },
    ]
  }
}
```

#### Spellcasting Entry
```js
{
  type: 'spellcastingEntry',
  system: {
    tradition: { value: 'arcane' },     // arcane, divine, occult, primal
    prepared: { value: 'prepared' },     // prepared, spontaneous, focus, innate
    ability: { value: 'int' },           // casting ability modifier
    proficiency: { value: 1 },           // 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
    slots: {
      slot0: { max: 5, value: 5 },      // cantrips
      slot1: { max: 3, value: 3 },      // rank 1
      // ...
    }
  }
}
```

Spellcasting entry types:
- **`prepared`**: Wizard, Cleric, Druid, Magus, Witch - prepare from known spells
- **`spontaneous`**: Sorcerer, Bard, Oracle, Psychic - cast from repertoire
- **`focus`**: Focus spells - no slots, uses focus pool
- **`innate`**: Innate spells from ancestry/items

#### Spell Item
```js
{
  type: 'spell',
  system: {
    level: { value: 1 },                 // spell rank (0 for some cantrips)
    location: { value: 'entryId123' },   // links to spellcasting entry
    traits: { 
      value: ['attack', 'fire', 'cantrip'],  // spell traits
      traditions: ['arcane', 'primal'],        // which traditions have this spell
      rarity: 'common'
    },
  }
}
```

#### Deity Item
```js
{
  type: 'deity',
  system: {
    category: 'deity',
    font: ['heal', 'harm'],              // divine font options
    sanctification: { modal: 'can', what: ['holy', 'unholy'] },
    domains: { primary: ['fire', 'sun'], alternate: ['light'] },
    attribute: ['str', 'cha'],
    skill: ['athletics'],
    weapons: ['longsword'],
    spells: {},                           // deity-granted spells
  }
}
```

### Actor Shortcuts

The PF2e system provides convenience getters on actors:
```js
actor.ancestry    // the ancestry item (or null)
actor.heritage    // the heritage item
actor.class       // the class item
actor.items       // all embedded items (IterableWeakMap)
```

### CONFIG.PF2E

The system exposes runtime configuration:
```js
CONFIG.PF2E.languages     // { slug: 'i18n.key' } map - resolve with game.i18n.localize()
CONFIG.PF2E.abilities     // ability score config
CONFIG.PF2E.skills        // skill config
```

### Boosts and Build System

The PF2e system tracks character build choices:
```js
actor.system.build.attributes.boosts = {
  1: ['str', 'dex', 'con', 'int'],  // level 1 free boosts
  5: ['str', 'wis', 'cha', 'int'],  // level 5 boosts
  // ...
};
```

Ancestry/Background/Class boosts are stored ON the respective items:
```js
ancestryItem.system.boosts.{slotKey}.selected = 'str'
backgroundItem.system.boosts.{slotKey}.selected = 'int'
classItem.system.keyAbility.selected = 'cha'
```

Alternate ancestry boosts bypass the normal boost structure:
```js
ancestryItem.system.alternateAncestryBoosts = ['str', 'dex']
```

### Skills

Standard skills stored on actor:
```js
actor.system.skills.athletics.rank = 1  // 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
```

Class and background auto-train skills via their rules. We only set ADDITIONAL chosen skills.

Lore skills are separate items:
```js
{ type: 'lore', name: 'Warfare Lore', system: { proficient: { value: 1 } } }
```

### Languages

Character languages:
```js
actor.system.details.languages.value = ['common', 'dwarven', 'elven']
```

Ancestry defines granted vs choosable:
```js
ancestry.system.languages.value = ['common', 'dwarven']         // auto-granted
ancestry.system.additionalLanguages.count = 2                     // number of choices
ancestry.system.additionalLanguages.value = ['elven', 'gnomish']  // available pool
```

Language display names are i18n keys in CONFIG.PF2E.languages:
```js
CONFIG.PF2E.languages = { 'common': 'PF2E.Actor.Creature.Language.common', ... }
game.i18n.localize('PF2E.Actor.Creature.Language.common') // -> 'Common'
```

### Focus Pool

```js
actor.system.resources.focus = { max: 1, value: 1 }
// max = pool size, value = current points available
```

We set this when creating focus spell entries. The system manages refocus mechanics.

### Timing and waitForSystem()

When adding items to an actor, the PF2e system processes rules asynchronously. We MUST wait before reading state that depends on those rules. Our `waitForSystem()` delays 600ms. Key timing issues:

1. Add class item -> system processes ChoiceSet -> we can't read subclass yet
2. Add ancestry item -> system grants languages -> we need to wait before checking language count
3. Add background item -> system trains skills -> we need to wait before checking trained skills

### UUID Format

All PF2e compendium items use hash-based UUIDs:
```
Compendium.pf2e.spells-srd.Item.rfZpqmj0AIIdkVIs  (Heal)
Compendium.pf2e.spells-srd.Item.wdA52JJnsuQWeyqz  (Harm)
```

NOT human-readable names. The `fromUuid()` function resolves these. Always use `.catch(() => null)` as items may be removed in system updates.

---

## Character Creation Flow

### Wizard Steps
```
ancestry -> heritage -> background -> class -> [deity] -> [sanctification] -> 
[subclass] -> [subclassChoices] -> boosts -> languages -> skills -> feats -> 
[spells] -> summary
```
Steps in brackets are conditional (handler-driven).

### Data Model (`creation-model.js`)
```js
{
  version: 1,
  ancestry: { uuid, name, img },
  heritage: { uuid, name, img },
  background: { uuid, name, img },
  class: { uuid, name, img, slug },
  subclass: { uuid, name, img, slug, tradition, spellUuids, grantedSkills, 
              grantedLores, choiceSets, choices, curriculum },
  deity: { uuid, name, img, font, sanctification },
  sanctification: 'holy' | 'unholy' | 'heal' | 'harm' | null,
  devotionSpell: { uuid, name, img } | null,
  alternateAncestryBoosts: false,
  boosts: { free: [], ancestry: [], background: [], class: [] },
  languages: [],
  lores: [],
  skills: [],
  ancestryFeat: { uuid, name, slug, img },
  classFeat: { uuid, name, slug, img },
  spells: { cantrips: [], rank1: [] },
}
```

### Apply Order
1. Ancestry, Heritage, Background, Class items
2. Wait for system processing
3. Boosts (ancestry, background, class, free)
4. Languages
5. Skills
6. Lores
7. Feats (ancestry, class)
8. **Class handler** `applyExtras()`:
   - CasterBase: spellcasting entry + granted spells + focus spells + tradition spells
   - Champion: deity item + devotion focus spell
   - Cleric: deity item + spellcasting + focus + divine font

---

## Level-Up Planner

### Plan Data
```js
{
  classSlug: 'sorcerer',
  levels: {
    2: { classFeats: [...], skillFeats: [...], spells: [...] },
    3: { generalFeats: [...], skillIncrease: {...} },
    ...
  }
}
```

### What the Planner Shows Per Level
- Class features (from class definition)
- Ability boosts (at 5, 10, 15, 20)
- Feat slots (class, skill, general, ancestry, archetype, mythic)
- Skill increases
- Spell slots (new/changed)
- **Granted spells** (from subclass data file - new at each rank)
- **Focus spells** (when matching feat is taken)
- Spellbook additions (wizard/witch/magus)

### Apply Order (Level-Up)
1. Boosts
2. Skill increases
3. Feats
4. Spells (slots + planned + granted + divine font scaling)
5. Class-specific (animist apparitions, etc.)

---

## Key Design Decisions

### Why We Don't Apply the Subclass Item
The PF2e system's class item has ChoiceSet rules that grant the subclass feature. If we also apply it as a separate item, the character gets duplicates. We let the system handle it and show a reminder banner.

### Why Spell Data is in a Static File
Parsing spell UUIDs from HTML descriptions is fragile - each bloodline/order/mystery has different formatting. The static data file (`subclass-spells.js`) is:
- Correct by definition (verified UUIDs)
- Fast (no runtime parsing)
- Extensible (add new subclasses by running the macro)

### Why ChoiceSet Options Are Parsed at Runtime
Subclass ChoiceSet options (like element selection for Elemental bloodline) come from the compendium item's rules. These are parsed by `_parseChoiceSets()` when the subclass is loaded, not stored in the data file. This ensures they stay in sync with the PF2e system.

### Sanitization of ChoiceSet Values
PF2e ChoiceSet choices can have `value` as an object (e.g., `{ slug: "air", damageType: "slashing" }`). The parser extracts the string slug: `typeof c.value === 'string' ? c.value : (c.slug ?? c.value?.slug)`. Old saved data may have `"[object Object]"` which is filtered out.

---

## DRY/SOLID Principles

### Constants
All shared constants live in `constants.js`:
- `SUBCLASS_TAGS` - maps class slug to subclass tag
- `SPELLBOOK_CLASSES` - classes with spellbooks
- `SKILLS`, `ATTRIBUTES` - standard arrays

### Utilities
- `capitalize()` in `utils/pf2e-api.js` - single source
- `slugify()` in `utils/pf2e-api.js` - single source

### No Class Slug Checks Outside Handlers
All `if (slug === 'champion')` type checks should be in:
- Handler files (`class-handlers/*.js`) for creation
- `apply-spells.js` for planner (divine font only, acceptable until planner is handler-ized)

### Single Responsibility
- `apply-creation.js` - universal apply only (no class-specific logic)
- `character-wizard.js` - UI orchestration only (delegates to handlers)
- `caster-base.js` - all caster spell resolution and application
- Each handler file - one class's specific behavior

---

## Common Patterns

### Loading Compendium Items
```js
const pack = game.packs.get('pf2e.spells-srd');
const docs = await pack.getDocuments();
```
Results are cached in `this._compendiumCache[key]`.

### Resolving Items by UUID
```js
const item = await fromUuid('Compendium.pf2e.spells-srd.Item.abc123').catch(() => null);
```
Always use `.catch(() => null)` for safety.

### Spell UUID Format
```
Compendium.pf2e.spells-srd.Item.{16-char-hash-id}
```
NOT human-readable names. Use the macro to look up IDs.

### Template Helpers (registered in lifecycle.js)
- `eq`, `notEqual`, `or`, `and` - comparison
- `includes` - array.includes check
- `json` - JSON.stringify for data attributes
- `capitalize`, `titleCase` - string formatting
- `signed` - +/- number display
- `format` - i18n with params

---

## Known Limitations / Future Work

### Planner
- Not fully handler-ized (2 wizard slug checks remain)
- Granted spells only show for new ranks (not all ranks retrospectively)
- Focus spell planner limited to initial/advanced/greater tiers

### Data File
- Elemental bloodline has explicit choices map; Draconic/Genie higher ranks need manual mapping for planner
- Oracle mysteries, Druid orders covered but not all with explicit choice maps
- Run the macro after PF2e system updates to refresh UUIDs

### Champion
- Cause filtering by sanctification uses hardcoded map (CAUSE_SANCTIFICATION in handler)
- Deity edicts/anathema not shown

### General
- No undo/rollback for applied changes
- Subclass applied by system ChoiceSet (user must pick correctly when prompted)
