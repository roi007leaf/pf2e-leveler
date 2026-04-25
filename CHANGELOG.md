# Changelog

## 3.3.0

### Starfinder 2e Support

- **Standalone Starfinder 2e worlds are now supported** - PF2e Leveler now detects the active Foundry system profile and uses SF2e compendiums, skills, ruleset config, predicates, spell grants, class features, equipment, actions, and deities in `sf2e` worlds while keeping the module name unchanged
- **PF2e worlds with Starfinder 2e Anachronism now use Anachronism content only** - Mixed PF2e campaigns now add `sf2e-anachronism` packs alongside PF2e packs when the module is active, without pulling standalone SF2e system packs into PF2e worlds
- **SF2e character creation uses the correct skill and subclass data** - Standalone SF2e creation now shows SF2e skills such as Computers and Piloting, and Starfinder subclass prompts such as envoy leadership styles appear in the apply prompt summary
- **PF2e worlds with Starfinder 2e Anachronism now show Anachronism skills** - Character creation adds Anachronism's extra skills, such as Computers and Piloting, to the PF2e skill list when the module is active
- **Wizard publication filters now collapse by default** - Character creation browser and global publication filters now use the same compact collapsible header pattern as the feat, spell, and item pickers, with selected publication counts visible while collapsed
- **Compendium discovery now filters by active system** - The Compendium Manager and player content access controls now expose PF2e packs in PF2e worlds, SF2e packs in SF2e worlds, and Anachronism packs only when active in a PF2e world
- **README now documents Starfinder support** - Requirements and feature notes now cover standalone SF2e worlds and PF2e plus Anachronism campaigns

## 3.2.5

### Feat Grants

- **Alchemist formula progression now surfaces correctly** - Character creation now offers 4 formulas from `Alchemical Crafting`, 4 from `Formula Book`, and 2 more from the selected research field, while later alchemist level-ups surface the 2 new Formula Book picks for that level
- **Bomber and research-field formula filters are tighter** - Bomber formulas no longer pick up a broad `magical` trait filter from unrelated description text, and formula grants can infer focused traits such as `bomb` or `mutagen`
- **Spell grant detection no longer triggers on unrelated spell mentions** - Options such as `Firework Technician Dedication` and `Protective Screen` no longer ask for spell choices when their text mentions spells without granting one

## 3.2.4

### Feat Grants

- **Level Planner now supports spell and item grants from feat text** - Feats that add spells to a spellbook or repertoire or grant item choices now surface `Granted choices` in the planner so those picks can be made when the feat is selected
- **Formula grants are now supported as a new granted-choice type** - Feats and class features that grant formulas, including `Alchemical Crafting`, alchemist research fields, and similar options, now open formula selection through the Leveler item picker
- **Formula choices now apply to Known Formulas** - Selected formula items now add their UUIDs to the actor crafting formulas instead of trying to create nonexistent formula items
- **Feat-granted items now create owned items when applied** - Generic item grants inferred from feat text can now be selected in Leveler and created on the actor during level-up application
- **Formula grant pickers now enforce inferred item restrictions** - Formula choices now lock rarity filters such as `common`, cap item level to the level being planned, preserve detected filters when reopening older/manual grant entries, and narrow Mutagenist-style grants to mutagens
- **Formula grants no longer duplicate inline formula choice grids** - Formula text is now handled by the generic `Granted choices` item picker path instead of also generating repeated inline `Select a formula` choice sections
- **Formula grant text parsing now handles labeled formula sections** - Class features such as `Mutagenist` that say `Formulas Two common 1st-level alchemical mutagens` now correctly require two formula picks instead of reading an earlier number from unrelated description text
- **Spellcasting dedication cantrip picks now use the right spell picker constraints** - Wizard Dedication and similar cantrip grants now open a common-only, cantrip-only, tradition-locked spell picker instead of exposing higher-rank or uncommon/rare options
- **Spellcasting dedication grants now create and target archetype spellcasting entries** - Selected dedication cantrips are placed in the matching `X Dedication Spells` entry instead of the character's main class spellcasting entry, and existing zero-slot dedication entries are updated to the correct two cantrip slots
- **Spellcasting dedication subclass choices now surface generically** - Dedications that ask for a school, bloodline, patron, order, mystery, or similar class option now show an appropriate feat choice prompt when tagged class-feature options can be resolved

## 3.2.3

### Item Picker

- **Item picker filters now match the compact feat and spell picker layout** - Search and trait filtering now sit together at the top, the level filter is an inline `Level` row with plain level values, and obvious standalone labels were removed from simple inputs
- **Item picker publication, armor, and weapon filters are now collapsible** - Publication filtering now uses the same chevron collapse treatment as the feat and spell pickers, while armor and weapon filters can also collapse independently and show active counts in their headers
- **Armor and weapon filter controls now stay inline and left-aligned** - The `AND`/`OR` logic toggle now lives beside each filter header, and stacked equipment filter chips align their dot and label from the left instead of centering text in full-width rows
- **Item picker compact styling now applies correctly to item-specific controls** - Shared picker CSS now covers item picker utility rows, compact groups, stacked chip lists, collapsible section headers, chevrons, and compact search/select inputs so item filters no longer fall back to default button styling

### Character Wizard

- **Background lore training from rule elements now applies during character creation** - Backgrounds that grant lore skills through `ActiveEffectLike` rule elements, including examples like Noble and Street Urchin, now surface and apply their expected lore training instead of only backgrounds with simpler lore metadata working
- **Clan Pistol now replaces the Dwarf clan dagger selection correctly** - Choosing the `Clan Pistol` ancestry feat now infers the Dwarf `clanWeapon` choice as Clan Pistol, so the creation wizard no longer prompts for Clan Dagger or grants Clan Dagger alongside the feat-specific replacement

## 3.2.2

### Level Planner

- **Ancestral Paragon granted ancestry feats now keep their planned subchoices visible** - Granted ancestry-feat slots under `Ancestral Paragon` now surface their own choice sets in the planner UI, so picks that should appear nested under the granted feat no longer vanish from the select menu or fall back to odd bonus-feat placement behavior
- **Arcane Evolution skill-training choices now apply during level-up** - Planned feat-driven skill training is now applied alongside normal skill increases, so choices like `Stealth` from `Arcane Evolution` correctly make the actor trained when the plan is applied
- **Draconic Advanced Bloodline now applies Dragon Breath** - Sorcerer advanced bloodline focus-spell application now overrides bad draconic focus UUID data by resolving `Dragon Breath` directly, so draconic and wyrmblessed sorcerers get the correct advanced focus spell at apply time

## 3.2.1

### Suggested Character Options

- **GM guidance can now choose hidden vs unselectable player bans and refresh open windows immediately** - Suggested Character Options now includes a world setting that lets GMs decide whether disallowed player content is removed entirely or shown with a disabled `Select` state, and changing that mode now rerenders already open Leveler wizard, planner, feat, spell, and item picker windows so ancestry and other browser steps update live for players

## 3.2.0

### Level Planner

- **Arcane Evolution now surfaces its missing skill training pick** - Direct feat wording such as `You become trained in one skill of your choice` now generates a planner skill-choice prompt, so sorcerers correctly get the Arcane Evolution training selection instead of losing it
- **Bloodline Paragon now grants both 10th-rank repertoire picks** - Sorcerer level 19 spell planning now accounts for Bloodline Paragon's extra repertoire addition on top of the single 10th-rank slot, so the planner shows two spell selections instead of one
- **Publication filters no longer silently narrow rarity selection in pickers** - Feat, spell, and item pickers now keep your rarity selection anchored to the full rarity set instead of rewriting it to only the temporarily visible rarities, so adding or removing publication filters no longer makes valid results disappear unexpectedly

### Suggested Character Options

- **Disallowed content now stays visible but follows GM/player selection rules across guided pickers and browsers** - Ancestries, heritages, backgrounds, classes, subclasses, feats, spells, and other guided options now keep their red `Disallowed` badge visible for everyone, block selection for players, and remain selectable for GMs with an override tooltip explaining why

### Character Wizard

- **Wizard browsers now include publication filters for source-title browsing** - Ancestry, heritage, background, class, and other browser steps now expose publication chips built from `system.publication.title`, letting you narrow wizard results by book while still starting in unrestricted `show all` mode when nothing is selected; the labels now localize correctly, and ancestry publication filtering now works even when the list mixes sourced entries with synthetic rows that have no publication title
- **Wizard browser publication filters replace the old source-pack filter** - The previous compendium/source filter has been removed from the main browser steps so browsing now keys off publication titles instead of pack names, which is more intuitive for book-based filtering
- **Wizard browser publication lists now scroll locally without leaving dead pane space** - The sidebar publication chip list now has its own scroll box, and browser layout overflow was tightened so both the left filter column and right results pane stop carrying useless extra scroll slack when their content is short

## 3.1.16

### Suggested Character Options

- **Sources search no longer breaks multi-word typing** - The `Sources` tab now filters the visible list in place while you type and reapplies the active query after rerenders, so spaces and later words no longer get interrupted by full rerenders

### Prerequisites

- **Bard muse prerequisite checks now include subclass identity and selected subclass aliases in picker build state** - Feat pickers now carry class subclass types plus selected subclass feat aliases into prerequisite evaluation, fixing bard muse checks like `Muse de barde` and `Muse Maestro` in planner and other picker flows that rely on local prerequisite build state

## 3.1.15

### Suggested Character Options

- **Source guidance now filters wizard ancestries, heritages, backgrounds, and classes correctly** - Character Wizard loaders now preserve publication titles on browser entries, so source-level suggested, warning, and disallowed rules inherit properly beyond feats
- **Sources tab search now refreshes correctly after changing guidance** - Clearing the `Sources` search box now rerenders from current search state instead of leaving a stale filtered subset behind until you switch categories

### Prerequisites

- **Bard muse prerequisites now understand more English and French phrasing variants** - Muse requirements now treat generic `Bard Muse` / `Muse de barde` as the bard `muse` subclass identity and normalize specific forms like `Muse Maestro`, `Maestro (Bard Muse)`, and `Virtuose (muse de barde)` to the correct named muse aliases

## 3.1.14

### Level Planner

- **Picker rarity chips now hide empty rarities in the current view** - Feat, spell, and item pickers now rebuild their rarity filters from the active non-rarity result set, so rarities with no matching entries at the current level, rank, or other filter state no longer show as dead options
- **Planner feat pickers no longer expose the old Dedications toggle** - Class feat pickers now open with locked `Class` plus selectable `Archetype` feat types, while Free Archetype pickers stay locked to the `Archetype` feat type and show `Dedication` as a locked excluded trait with a ban icon instead of a separate toggle
- **Planner dedication filtering is now trait-only** - The leftover hidden `showDedications` gating path has been removed, so class and free-archetype feat browsing now relies entirely on feat type and trait chips instead of a second internal dedication filter that could conflict with the visible UI
- **French feat prerequisites with lowercase parenthetical clarifiers no longer split into fake extra badges** - Requirements such as `Virtuose (muse de barde)` now stay one feat prerequisite keyed to the base feat instead of being misread as separate `Virtuose` and `muse de barde` requirements in the planner picker

### Suggested Character Options

- **Source-level guidance rules can now inherit from publication titles** - Suggested Character Options now includes a dedicated `Sources` tab that indexes unique `system.publication.title` values across ancestry, heritage, background, class, feat, spell, item, action, and deity content, letting GMs mark whole books as suggested, not recommended, or disallowed while still allowing per-item overrides to win
- **Item guidance badges now resolve inherited source rules** - Content guidance rows and existing wizard/planner consumers now resolve status by item first and publication source second, so options from books like `Pathfinder Player Core` can inherit suggested or banned status automatically without manually tagging each document

## 3.1.13

### Character Wizard

- **Ancient Elf dedication choices now use earlier level-1 ability boosts for prerequisite checks** - Free dedication pickers opened from `Ancient Elf` now build feat prerequisite state from already selected ancestry, background, class, and free boosts, so multiclass dedications unlock as soon as their Ability Modifier requirements are met instead of all appearing locked

## 3.1.12

### Character Wizard

- **Player compendium restrictions now refresh correctly in open creation wizards** - Changing GM compendium assignments or allowed player sources now invalidates stale wizard-side caches immediately, so removed custom ancestry, heritage, background, and similar packs stop showing to players without needing a reopen
- **Selected class names in the wizard now open their item sheets correctly** - Single-class browser cards now keep the selected class UUID in browser context, so clicking the chosen class title opens its details instead of doing nothing
- **Background skill and attribute filters now apply consistently after rerenders** - Switching filter logic or rerendering the Background step now reapplies the active filter state and updates the visible result count, so entries like `Acolyte` no longer reappear incorrectly after toggling `AND` / `OR`
- **Background attribute filters now match PF2E's full ability names** - Attribute chips such as `INT` and `WIS` now normalize values like `intelligence` and `wisdom` from PF2E-authored background data, so the attribute filter works on more backgrounds instead of silently missing valid matches
- **Background attribute filters now ignore free-boost rows when matching specific background stats** - Background browser entries now derive their attribute tags from the narrow authored boost choice set instead of flattening the free boost row into all six abilities, so backgrounds like `Acolyte` only match `INT` / `WIS` instead of every attribute
- **Background filter logic controls are now clearer** - The old one-button `AND` / `OR` chip was replaced with explicit `Any` / `All` segmented controls for skills and attributes, making it clearer that the control changes filter mode rather than selecting another filter value
- **Selected feats with direct spell grants now apply their spells during creation** - Character creation now scans selected ancestry, class, skill, paragon, and granted follow-up feats for direct `GrantItem` spell rules and description-linked spell UUIDs, so feats like `Timber Sentinel` correctly create their spellcasting entry and granted spell even when PF2E does not expose a separate rule element

### Item Picker

- **Armor and weapon subfilters now stay hidden until their parent category is selected** - The equipment picker only shows `Armor Filters` after selecting `Armor` and `Weapon Filters` after selecting `Weapon`, instead of surfacing both blocks immediately on first open
- **Armor and weapon subfilters now only affect matching parent categories** - Hidden armor or weapon subfilters no longer keep filtering results in the background when their parent category is not active, preventing confusing empty or over-restricted equipment lists
- **Equipment cards now show curated armor and weapon metadata tags** - Weapon and armor rows now display extra tags such as `Martial Weapon`, `Sword`, `Medium Armor`, or `Chain` to make key PF2E item classification easier to see at a glance
- **Unfiltered equipment browsing now stays capped to the first 200 items** - The item picker once again treats empty category and source selections as unrestricted instead of as active filters, so the initial equipment browser stops rendering all ~5k results at once and only expands beyond 200 after a real filter or search is applied

## 3.1.11

### Level Planner

- **Investigators now get their odd-level `Skillful Lessons` feat slots with the right skill limits** - Investigator progression now includes the extra odd-level skill feat slots, and those odd-level feat pickers are restricted to Intelligence-, Wisdom-, and Charisma-based skill feats plus the methodology-granted skill instead of omitting the slot or allowing invalid picks
- **Cleric into Champion dedication grant prompts no longer crash the planner** - Choice-set filter parsing now safely handles non-serializable PF2E filter shapes when building granted feat preview prompts, so deity, sanctification, and related Champion Dedication follow-up selections render instead of failing with `Cannot read properties of undefined (reading 'includes')` or `toLowerCase`

## 3.1.10

### Character Wizard

- **Runelord sin selections now populate Thassilonian curriculum spells correctly** - Granted `School of Thassilonian Rune Magic` sin choices now preserve their curriculum metadata through feat-choice selection and mirror it onto the secondary wizard subclass state, so sin spells such as `Envy` appear in the wizard curriculum picker and summary instead of being dropped

### Feat Picker

- **Multitalented dedication choices now unlock their follow-up class feats correctly** - Chosen multiclass dedications from `Multitalented` now count as owned class archetype dedications in build-state and prerequisite checks, so later class feat selection correctly unlocks feats from the selected dedication instead of treating the dedication as missing
- **Subclass and spell-list prerequisites now unlock more feats correctly** - Prerequisite checks now recognize subclass-name aliases and wording such as `bloodline with the arcane spell list`, while build-state infers variable class traditions from subclass choices, so feats tied to bloodlines, muses, rackets, and similar subclass identities no longer stay locked when their prerequisites are met

### Level Planner

- **Feat-granted skill ranks no longer block legal later skill increases** - Skills raised by feats such as `Medic Dedication` now stay selectable when a later level legally allows another increase, so Medicine can advance from expert to master at level 7 instead of staying locked as `Set by Medic Dedication`

## 3.1.9

### Character Wizard

- **Dual-class creation now keeps both classes' feature trees intact** - Level 1 dual-class application now batches the secondary and primary class items in one embedded-item operation, so PF2E keeps both class feature sets instead of dropping the secondary side or treating the wrong class as active on the sheet
- **Dual-class prompt summaries now include subclass and feat choices from both classes** - The wizard now carries secondary subclass prompts, dual-class subclass follow-up choices, and dual-class feat choice rows through the Feat Choices step and apply overlay instead of only reflecting the primary class path
- **Primary and secondary subclass prompts now resolve against more PF2E rule shapes** - Apply-overlay prompt matching now handles both string and object-shaped subclass filters for all mapped subclass-bearing classes, so prompts such as Alchemist research fields, Barbarian instincts, and Bard muses show their selected values instead of staying pending or disappearing
- **Fixed-skill `Assurance` grants no longer reopen full manual skill prompts** - Granted `Assurance` selections now align source-facing preselected skill flags with the feat's actual choice flag, so backgrounds and other grants that lock `Assurance` to a specific skill stop surfacing an unnecessary all-skills prompt

## 3.1.8

### Character Wizard

- **Mixed Ancestry heritage creation now finalizes correctly on PF2E 7.12.2** - Synthetic Mixed Ancestry heritage application now creates valid PF2E heritage data, so finalizing character creation no longer fails with heritage validation errors about invalid `versatile` traits or null ancestry fields
- **Dual-class character creation is now supported end-to-end** - The wizard now lets you pick separate primary and secondary classes, separate subclasses for each class, class-owned level 1 feat slots for both classes when applicable, and handler-driven extra steps from both classes instead of silently following only the primary class
- **Dual-class starting skills now follow PF2E rules** - The Skills step now auto-trains fixed skills granted by both classes and uses the larger of the two additional trained-skill counts, while still respecting subclass and class-feature granted starting skills such as witch patron skills
- **Dual-class casters can now plan spells for both classes during character creation** - The Spells step now renders a separate spell section for each caster class in a dual-class build, so secondary class cantrips, rank 1 spells, and curriculum selections are visible and selectable instead of being hidden behind the primary class only
- **Dual-class spell and focus setup now creates separate class entries on the actor** - Character creation no longer reuses the primary class spellcasting or focus entries for the secondary class, so dual-class casters get distinct spellcasting entries and focus sections where PF2E expects them
- **Secondary dual-class spell setup now applies through the correct class handler** - Finalizing character creation now projects the secondary class, subclass, and spell selections into that class's `applyExtras` flow, so second-class spellcasting choices are actually created on the actor instead of being skipped
- **Dual-class class-specific choices and feat choices now persist correctly per class** - Owner-scoped class selection state now keeps thesis, apparitions, subconscious mind, devotion spell, subclass follow-up choices, fighter-style skill choices, and other handler-driven selections separated between the two classes instead of letting primary-only state overwrite them
- **System-managed dual subclasses no longer get duplicated** - When PF2E already grants the subclass item as part of class processing, Leveler no longer creates a second duplicate subclass item for the secondary class

### Level Planner

- **Dual-class planners now bootstrap the correct primary and secondary classes from character creation data** - Planner startup now prefers Leveler's stored primary and dual class pairing instead of trusting whichever class PF2E currently exposes through `actor.class`, preventing dual-class builds such as `witch + wizard` from being inverted and losing their dual-class feat access
- **Dual-class planner recovery is now more resilient for existing actors** - If the saved plan is stale or missing its secondary class, the planner now repairs `dualClassSlug` from stored creation data and actor class items, including custom classes, before dual-class feat picking or spell planning runs
- **Dual-class progression now follows PF2E advancement rules more closely** - Planner/build-state progression merges primary and secondary class feature schedules, preserves extra rogue-style skill feats and skill increases when only one class grants them, and shows class features from both tracked classes at each level
- **Dual-class spell planning now supports separate secondary class spell and focus sections** - The planner now renders distinct spell and focus sections for a secondary caster class and routes spell picks to the correct class-specific entry instead of treating all planned casting as primary-class only
- **Dual Class feats now apply to Workbench dual-class feat slots** - Planned `Dual Class Feats` now create items in the `xdy_dualclass` campaign feat section when PF2E Workbench dual-class support is present, instead of incorrectly applying them to normal class feat slots
- **Existing Workbench dual-class feats now import back into the planner correctly** - Actor feats stored in `xdy_dualclass-*` locations now bootstrap into Leveler's `Dual Class Feats` slots instead of being missed or treated like standard class feats

## 3.1.7

### Feat Picker

- **Recall Knowledge skill prerequisites are now recognized correctly** - Prerequisites like `Trained in a skill with the Recall Knowledge action` now check trained Recall Knowledge skills and lore properly, so feats such as `Dubious Knowledge` no longer fail or show as blocked incorrectly

## 3.1.6

### Feat Picker

- **Alternative prerequisites now enforce correctly when one branch is met** - Feats with prerequisite text such as `master in Occultism or Religion` no longer stay blocked just because one displayed alternative fails; Leveler now respects the overall `or` prerequisite result when deciding eligibility
- **Grouped prerequisite alternatives now render inside a shared border** - Alternative branches that belong to one prerequisite, including shared-rank lists such as `master in Nature, Occultism, or Religion`, now display as a single bordered cluster so it is clear they are one grouped requirement rather than separate independent prerequisites

## 3.1.5

### Level Planner

- **A manual button can now apply a plan on demand** - Added an explicit planner action so builds can be applied manually instead of only through the existing flow triggers

### Equipment Selection

- **Equipment browser now supports multi-select item picking** - The equipment selection menu can now add several items in one pass, matching the existing spell-picker multi-select flow and avoiding repeated reopen cycles

## 3.1.4

### Character Wizard

- **Ranger now correctly shows both class-trained skills during character creation** - The Skills step now merges PF2E-authored class trained skills from both structured item data and description text, so Rangers correctly mark both `Survival` and `Nature` as already trained instead of only locking `Survival`

## 3.1.3

### Content Sources

- **Pickers now include custom world items from the Items tab for feats, spells, and equipment** - Spell picker, item picker, and character wizard category loading now pull eligible world `Item` documents alongside configured compendium content, so custom feats, spells, and gear created directly in the world are available in Leveler flows

### Character Wizard

- **GMs can now allow incomplete character creation** - A new world setting lets players apply character creation from the Summary step even when not every wizard step is complete, while keeping the default strict completion gate unchanged

## 3.1.2

### Spell Picker

- **Prepared spellbook pickers now keep already taken spells visible** - Spells already known in the actor's spellbook now remain in the picker with a `TAKEN` badge and disabled selection instead of disappearing from the list
- **Selected spell `x` removal now works reliably from the picker sidebar** - The `Already Selected` section now exposes a working remove control, and spellbook picks stored with any-rank planner entries now remove correctly by their displayed rank without popping the planner in front of the picker
- **Removing selected spells now fully refreshes picker and parent spellbook state** - Clearing a spell from `Already Selected` now updates the picker's selection cap/count and refreshes the underlying planner or wizard spell chips immediately instead of leaving stale selected entries visible

### Sheet Integration

- **Higher-level characters now redirect into the planner when creation would conflict with existing ancestry and class data** - Clicking the character creation button on a level 2+ actor that already has both ancestry and class chosen now prompts the user and opens the level planner instead of allowing duplicate wizard selection flow

## 3.1.1

### Feat Picker

- **`Eligible Only` now works correctly in Babele-translated environments** - Prerequisite evaluation now prefers raw source prerequisite text when available, so translated feat text from modules like `pf2-fr` no longer breaks skill-rank prerequisite checks or hides valid feats from the filtered picker
- **Custom ancestry feats from world items now match against the ancestry's actual traits** - Leveler now includes world `Item` feats in its feat cache and treats the selected ancestry's own trait list as valid ancestry-feat match tags, so custom ancestries without a slug can still surface feats tagged with traits like `human`, `humanoid`, or `beast-folk`

### Character Wizard

- **Flawed ancestry abilities can now still be selected when the ancestry grants a choice boost there** - Boost rows no longer treat flaw-marked abilities as dead cells when that same ability is also a valid selectable boost, and combined flaw/boost buttons now render their `-` and `+` state more clearly

## 3.1.0

### Feat Picker

- **Trait and skill filters now open browseable dropdowns on focus** - The feat picker now shows available traits and skills immediately when those filter fields are focused, instead of requiring typed input before suggestions appear
- **Skill filter suggestions now show current proficiency with mastery colors** - Skill autocomplete entries now display the actor's current proficiency rank using the same rank color scheme already used elsewhere in Leveler, making it easier to filter against trained, expert, master, and legendary skills at a glance
- **`Eligible Only` can now be enabled by default** - A new client setting lets you open feat pickers with the `Eligible Only` filter already active, so unmet options stay hidden without having to toggle that filter every time
- **The `Options` section now appears directly under trait filters** - Feat picker filter layout was adjusted so the most commonly used toggles sit closer to the trait controls instead of lower in the sidebar
- **Dedication toggle state now matches the actual filtered results on first render** - Class and archetype feat pickers no longer show the `Dedications` button as off while still rendering dedication feats in the results list
- **Prerequisite rank words now use mastery colors inside feat tags** - Proficiency requirements such as `Trained`, `Expert`, `Master`, and `Legendary` are now colorized inside prerequisite tags to match PF2E Leveler's existing mastery color language

### Compendium Manager

- **Pack assignments can now be auto-filled in one click** - The `Assign Packs` view now includes an `Apply Auto` action that fills draft category assignments from Leveler's auto-detected compendium matches instead of requiring each category to be assigned manually
- **`Apply Auto` now confirms before overwriting draft assignments** - Using the auto-assignment action now prompts for confirmation first so existing draft pack selections are not replaced accidentally

## 3.0.1

### Level Planner

- **Archetype spellcasting is now derived from feat data instead of one-off slug mappings** - Spell-giving dedications now persist parsed spellcasting metadata onto planned feats, so planner display, validation, and apply all use the same generic archetype spellcasting definition instead of relying on hardcoded feat-specific overrides
- **Direct archetype cantrip grants now honor feat-authored counts and rarity limits** - Dedications that grant specific cantrip picks, such as `Spellshot Dedication`, now derive their cantrip selection counts and rarity restrictions from the feat text and carry those limits consistently through the planner and apply flow
- **Direct archetype ranked-spell grants now create the correct planned spell requirements** - Dedications that grant ranked spells of your choice on the dedication itself now expose the proper per-rank spell-pick counts in the planner instead of assuming all archetype rank picks come only from later `Basic/Expert/Master Spellcasting` feats
- **Archetype spellcasting progression now separates current slot capacity from newly due spell picks** - Taking a spellcasting archetype feat late no longer underfills the archetype entry's available ranks, while validation still only requires the new spell selections that become due at the current level

### Character Wizard

- **Imported character creation plans now open `Feat Choices` much faster when the imported choice data is already present** - The wizard now reuses hydrated imported feat-choice sections instead of immediately rebuilding all granted feat choice data from compendiums on first render

## 3.0.0

### Compatibility

- **Added Foundry VTT v14 support** - Leveler now supports Foundry Virtual Tabletop v14

### Level Planner

- **Granted feat skill choices now respect same-level Intelligence bonus skill picks** - If you already reserve a skill such as `Survival` from an Intelligence increase at that level, planner skill-choice prompts like `Spellshot Dedication` now block that same skill instead of letting it be selected twice
- **Granted feat skill selections now persist more reliably after reopen** - Nested granted-feat choice prompts now keep their selected trained skill in planner state, so reopening or rerendering the planner no longer loses those picks
- **Granted skill-choice buttons now sync their training rules correctly** - Choosing a trained skill from a granted feat prompt now updates the planned build state immediately instead of behaving like an unrelated item choice
- **Save-rank prerequisite checks now recognize PF2E wording like `Expert in Reflex Saves`** - Planner feat prerequisite checks now normalize singular and plural save wording properly, so feats such as `Evasiveness` no longer fail when the actor already has the required save proficiency
- **Guardian prerequisite checks now recognize `Intercept Attack` from `Guardian's Techniques`** - Class-feature prerequisite matching now understands linked granted actions and features embedded inside owned class-feature descriptions, so Guardian feats like `Armored Counterattack` no longer fail that requirement incorrectly

### Level-Up Apply

- **PF2E-owned granted dedications are no longer duplicated during planner apply** - When a selected feat already grants another feat through `GrantItem`, Leveler now skips manually creating that same feat again, preventing duplicates such as extra copies of `Spellshot Dedication`
- **Same-batch feat dedupe is now more precise** - Manual feat creation now dedupes against real source IDs instead of over-treating transient runtime UUIDs as the same source, avoiding false skips while still blocking duplicate granted feats

## 2.1.17

### Feat Picker

- **Prerequisite tags now show when a requirement is met via a different feat** - Feats that count as another dedication now display the match source, e.g. `Wizard Dedication (via Spellshot Dedication)`

### Level Planner

- **Dedication alias matching is now more robust** - Spellshot and similar feats now reliably satisfy dedication prerequisites in the planner even when the description uses UUID links

## 2.1.16

### Character Wizard

- **Manual `Assurance` now only appears for true replacement-skill cases from `Scholar`-style backgrounds** - If a background like `Scholar` can still use one of its original authored skills, the extra manual `Assurance` section is now hidden; it only appears when the background has to widen to an off-list replacement skill

## 2.1.15

### Sheet Integration

- **The `Plan Levels` button now self-recovers when the built-in class registry is empty** - Characters with valid built-in PF2E classes no longer lose planner access after an update or reload just because the runtime class registry failed to populate during startup
- **Custom compendium classes can now open the planner directly from the sheet** - If a character uses a class from a custom compendium, Leveler now derives a temporary class definition from the actor's class item so the planner button appears and the initial plan can bootstrap correctly
- **Planner and wizard windows now reload missing Handlebars partials before rendering** - Opening the planner or character wizard now ensures shared partial templates such as `featSlot` are loaded even if the initial startup preload was missed, preventing render failures like `The partial featSlot could not be found`

## 2.1.14

### Character Wizard

- **Imported creation plans now handle replacement skill training more safely** - If a widened background or feat skill choice selects a replacement skill outside the source item's original authored list, Leveler now applies that replacement training directly without writing an invalid rules selection back onto the PF2E item
- **Backfilled granted feats such as `Assurance` now keep their stored choice when imported plans use replacement skill training** - Imported creation plans that combine replacement skill training with granted follow-up feats no longer lose or corrupt the granted feat's own selected option during creation

### Sheet Integration

- **The `Plan Levels` button now recovers if the class registry was not populated during startup** - Characters with valid PF2E class items no longer lose the planner button just because the local class registry ended up empty after an update or reload
- **Custom compendium classes can now open the planner more reliably** - If a class is not one of Leveler's built-in class definitions, the module now derives a temporary class definition from the actor's owned class item so custom class actors can still show the planner button and bootstrap a plan

### Level Planner

- **Custom planned spells now use the same compact chip style as the main spell sections** - Custom spell and cantrip selections in the planner now render as the same compact spell chips used by the normal planned spell UI instead of oversized pill rows
- **Custom planned spells are now grouped by spellcasting entry** - The custom spell section now organizes planned spells under each spellcasting entry first, then splits them into `Cantrip`, `Rank 1`, and higher-rank groups so it is easier to see where each spell will be added

### Class Progression

- **Future proficiency checks now handle more class-specific progression features correctly** - The planner now reads explicit proficiency progression metadata from class features, which fixes prerequisite checks for progression features whose names do not follow the generic `Perception Mastery` / `Class DC Expertise` pattern
- **Fighter level 7 Perception progression is now recognized correctly** - `Battlefield Surveyor` now upgrades Perception to `Master` in planned build state, so feats like `Bloodsense` no longer fail their level 7 Perception prerequisite incorrectly
- **Additional class progression metadata was aligned with AoN class tables** - Ambiguous progression features such as investigator sense upgrades, class DC progression features, and corrected `Reflex Expertise` entries for classes like `Inventor` and `Thaumaturge` are now tracked more accurately in the planner

## 2.1.13

### Character Wizard

- **Scholar and similar granted-feat prompts now behave correctly** - Backgrounds and other sources that grant a follow-up feat with its own choice, such as `Scholar` granting `Assurance`, now surface that granted feat as its own `Feat Choices` section instead of silently dropping it
- **Background skill replacement prompts recover cleanly when all authored skills are already trained** - If a background like `Scholar` would normally train one of a small set of skills but all of them are already trained, the wizard now widens the training choice to other valid skills while still keeping the granted follow-up feat restricted to the background's authored list
- **Assurance skill choices no longer lock out already trained skills** - `Assurance` selections now allow trained skills as PF2E expects, and only stay blocked when the character already has `Assurance` for that specific skill from another source
- **Widened feat-choice skill selections now persist after reopen** - When a feat or background skill prompt widens beyond its original authored list, the chosen skill now stays selected after reopening the wizard instead of snapping back to the original options
- **Direct feat-granted training now shows up in Skills** - Feats that directly grant trained skills, such as `Kobold Lore` granting `Stealth` and `Thievery`, now correctly mark those skills as already granted in the wizard
- **PF2E-owned subclass assignments no longer get duplicated by Leveler** - Subclass features such as instincts and similar class options are no longer added a second time during creation when the PF2E system already applies them
- **Manual fallback grants are now clearly labeled if PF2E misses them** - If PF2E fails to create a granted feat that Leveler has to backfill manually, the created item is now marked with a source label such as `Assurance (Background: Scholar)` so the origin stays visible on the actor
- **Feat choice interactions no longer force the wizard back to the top** - Selecting or changing wizard feat-choice options now preserves scroll position instead of jumping the step back to the top

### Level Planner

- **Archetype feat choice filters now honor PF2E level-cap rule shapes** - Planner prompts such as `Basic Trickery` now respect tuple and comparison-style ChoiceSet filters, so higher-level class feats no longer appear in selections limited to low-level feats
- **Custom spell planning can now target a specific spellcasting entry** - The custom level plan spell section now detects existing spellcasting entries, lets you choose which entry to add planned spells to, and can also create planned spellcasting entries for later use
- **Planned custom spellcasting entries are created before their spells are applied** - Custom spell entries added in the planner are now created during level-up apply before their selected spells and cantrips are embedded, so planned picks land on the intended entry
- **Importing a planner file now shows a real loading state** - Importing a saved level-up plan now displays a visible overlay while the file is parsed and validated instead of doing the work silently in the background
- **Planned spell selections now use the same chip style as the wizard** - Selected spellbook spells, cantrip expansion picks, and dedication spell choices in the level planner now render as compact spell chips instead of full-width rows, matching the character creation spell UI
- **Spellbook cantrip expansion picks now render under the correct section** - Bonus cantrip selections such as `Cantrip Expansion` now appear in the cantrip block instead of being mixed into the main ranked spell list
- **Dedication progress across multiple archetypes is tracked more reliably** - Dedication completion now handles longer archetype timelines more accurately, so later dedication browsing reopens when earlier dedications have actually been satisfied

### Feat Picker

- **Trait filters now support explicit exclusion** - Selected trait chips in the feat picker now include a `NOT` action, letting you filter out feats that contain a specific trait in addition to the existing include-based trait filtering

## 2.1.12

### Character Wizard

- **Arcane Tattoos and similar spell-choice feats now open correctly** - Direct spell-choice feats that only allow a small set of spells, including cantrips, now open a populated picker instead of an empty window
- **Custom classes now behave more like built-in PF2E classes** - Custom classes such as `Elemental Avatar` and `Eldamon Trainer` now surface their class key ability and subclass choices correctly in the wizard
- **Subclass items are no longer added twice** - The wizard now skips manually embedding subclass items when PF2E already handles that assignment, which prevents duplicate subclass features such as duplicated instincts or schools
- **Prompt cards no longer select every option at once** - Item-backed option lists such as `Dragon Instinct` now keep a stable identity per card, so clicking one choice only selects that one
- **Fallback skill prompts now recover cleanly** - If all authored skill options are already trained, the wizard now widens the prompt to other valid untrained skills and keeps the chosen fallback skill selected after reopening
- **Pending prompt rows are no longer shown in the summary** - The PF2E prompts summary now removes unresolved `Pending selection` rows and also collapses duplicate resolved rows caused by source-label or prompt-text differences

### Level Planner

- **Gradual Ability Boost rows reopen correctly** - Applied gradual boosts no longer come back in a broken state after reopening the planner, and clearing one no longer leaves the same ability stuck unusable
- **Feat-choice skill grants now persist properly** - Selected skills from feat-choice prompts, including replacement training from dedications, now survive reopen, apply correctly, and no longer show broken `Set by: null` tooltips

### Feat Picker

- **Marshal stance feats now appear at their real level** - Native archetype feats such as `Dread Marshal Stance` and `Inspiring Marshal Stance` now show in the level 4 archetype picker correctly instead of being treated like later dedication-unlocked extras
- **Dedication overlay badges no longer appear on native archetype feats** - Real archetype feats no longer show misleading badges such as `Dedication Lv 8+` when that badge only belongs on synthetic additional-feat unlocks
- **Cold-start loading is clearer and warm opens are faster** - The feat picker now shows a visible reindexing/loading state only on a true cold cache warm instead of flashing `Reindexing` every time you open the picker

### Compendium Indexing

- **Reindexing is now visible when sources change** - Saving compendium source settings now shows a proper rebuild/loading state instead of silently rebuilding caches in the background
- **Repeated reloads avoid unnecessary rescans** - Raw feat-pack discovery is cached between reloads, and unchanged compendium saves no longer force a full invalidation/rebuild

### Compatibility

- **Pickers now use Foundry V13's namespaced template renderer** - Updated picker rendering to avoid deprecated global template helper usage in newer Foundry versions

## 2.1.11

### Character Wizard

- **Spell-choice pickers now honor direct allowed spell UUIDs** - Feat and ancestry spell choices such as `Arcane Tattoos` now load their specifically allowed spells even when those spells are not present in the currently configured spell compendium category results
- **Wizard school subclass items no longer get applied twice** - Wizard schools and similar subclass entries now avoid duplicate application during creation, preventing duplicate school items on the actor
- **Fallback trained-skill feat choices now stay resolved after selection** - When a blocked skill-choice prompt widens to other trainable skills, the selected fallback skill now remains visible instead of snapping back to the original disabled authored list

### Level Planner

- **Class-feat pickers still include archetype feats but no longer hard-lock them on** - The level planner class-feat picker now keeps `class` selected while allowing `archetype` to be deselected when you want to browse only class feats
- **Gradual ability boosts reopen correctly from actor history** - Reopening a level with an already-applied gradual boost now reconstructs the correct pre/post display, no longer marks the level incomplete incorrectly, and allows the same attribute to be reselected after clearing it

## 2.1.10

### Prerequisites

- **Heritage prerequisites now match the selected heritage correctly** - Prerequisites such as `Charhide Goblin Heritage` now resolve against the actor's selected heritage instead of falling through as generic feat requirements

### Ancestry Feats

- **Custom ancestries without slugs now surface their ancestry feats correctly** - When an ancestry item is missing a usable slug, Leveler now derives the ancestry trait from the ancestry name so ancestry feats keyed only by that ancestry trait, such as `intelligent-weapon`, still appear

## 2.1.9

### Level Planner

- **Higher-level skill increases now support Lore** - Skill increase pickers can now train and advance existing Lore skills in addition to the standard skill list
- **Subclass dedication requirements can be enforced by setting** - A new GM setting can restrict level 2 class-feat selection to a required dedication such as `Battle Harbinger Dedication` when a subclass says you must take it
- **Required subclass dedications are labeled in the picker** - When that setting is enabled, the forced dedication feat now shows a `Subclass/Archetype Limitation` badge so the restriction is obvious in the UI

### Spellcasting

- **Planned dedication spell selections now apply to their new spellcasting entries** - When a level-up plan creates an archetype spellcasting entry such as `Wizard Dedication Spells`, the selected dedication cantrips and spells are now embedded onto that entry during apply instead of only creating empty slots

## 2.1.8

### Character Wizard

- **Mixed Ancestry now has its own step** - Selecting `Mixed Ancestry` as a heritage now opens a dedicated `Mixed Ancestry` step right after Heritage instead of incorrectly surfacing the second ancestry choice under Feat Choices
- **Mixed Ancestry browser cards now show ancestry names correctly** - Fixed the ancestry browser on the Mixed Ancestry step so entries display their proper ancestry names instead of only showing trait tags
- **Mixed Ancestry source filtering now works** - The synthetic `Mixed Ancestry` heritage now survives step source filtering and appears correctly under versatile heritages
- **Wizard browser sorting no longer crashes on synthetic entries** - Fixed a `localeCompare` render crash when browser-backed steps included synthetic or partially-hydrated entries without a `name`
- **Ancestry feat spell choices now use the spell picker** - Ancestry feats such as `Otherworldly Magic` can now open a real spell picker, store the selected spell correctly, and apply it to the actor during creation
- **Subclass grant items now apply correctly** - Order and similar subclass items are now applied and grant-scanned properly during creation, so features like `Untamed Order` can contribute granted feat content such as `Untamed Form`
- **Long content-source chip lists no longer shove step content down** - The source chip panel on wizard steps now has a capped height with its own scroll area
- **Skill cards keep a consistent height when sourced** - Skill rows no longer shrink when they display a source such as `Feat Choices` or a later grant

### Level Planner

- **Archetype dedication completion is now tracked correctly** - The planner now follows the PF2e dedication rule more closely: before taking a dedication it shows dedication feats, after taking one it focuses on archetype follow-up feats, and once you have two other archetype feats from that dedication it reopens dedication feat browsing again
- **Additional archetype feats still respect their own prerequisites** - Feats unlocked by a dedication chain, such as `Holistic Care`, now become visible when relevant without becoming freely selectable if their normal prerequisites are still unmet
- **Custom / All Feats browsing still bypasses dedication locking** - The special dedication lock now stays in the normal archetype browsing flows and no longer blocks the unrestricted custom feat picker
- **Planned subclass choices now satisfy later prerequisites** - Earlier planned choices like `Order Explorer (Wave Order)` now count for later feat prerequisite checks
- **Druid and similar dedication overlap skill choices now appear correctly** - The planner now recovers text-based granted skills, selected order skills, and fallback overlap wording so dedications like `Druid Dedication` correctly surface replacement skill choices when you were already trained
- **Druid dedication choice flow is cleaner** - The planner now avoids duplicate order choice sections, shows the order choice before any replacement skill prompts, and lets you open an order item sheet by clicking its name or image
- **Planned spellbook sections are now split correctly** - Base spellbook picks and spellcasting-dedication picks now use separate planner sections instead of sharing one combined pool
- **Spellcasting dedications only grant picks on the levels that actually grant them** - Initial dedication cantrips only appear on the level where you take the dedication, and later slot picks only appear when `Basic`, `Expert`, or `Master Spellcasting` actually grants a new slot
- **Main spellbook pickers no longer inherit dedication traditions** - Regular spellbook pickers now stay locked to the main class tradition, while dedication spell sections use their own tradition separately
- **Empty dedication cantrip rows are hidden** - Dedication spell sections no longer render a useless `0/0` cantrip subsection
- **Planned spellcasting dedications now create spell entries when applied** - Dedication spellcasting support now creates the appropriate separate spellcasting entry from planned feats as well as embedded actor feats

### Feat Picker

- **Archetype follow-up feats now unlock transitively** - If a dedication has no clean `Additional Feats` block, prerequisite-based archetype unlock inference now follows the chain through earlier archetype feats so later follow-ups like `Holistic Care` can surface properly
- **Archetype follow-up feats still respect normal prerequisites** - Dedication-unlocked visibility no longer makes unmet prerequisites selectable in normal archetype browsing
- **Feat search now matches titles only** - Picker search no longer matches on trait text, which makes searches like `skill training` much easier to use

### Spellcasting

- **Wizard curriculum spells are duplicated into the main spellbook** - School or curriculum spells can now still be prepared in normal wizard spell slots instead of only existing on the separate curriculum entry
- **Cantrip Expansion now grants planner cantrip picks correctly** - The level planner now tracks the feat's bonus cantrip picks as dedicated cantrip-only selections
- **Spellcasting archetypes now create their own entries** - Dedication spellcasting benefits such as `Druid Dedication` now create separate archetype spellcasting entries instead of disappearing into the main class entry

### Prerequisites

- **Weapon-family proficiency prerequisites now alias correctly** - Prerequisites like `trained in at least one crossbow` now recognize broader proficiencies such as simple weapon training when PF2e rules say they should qualify

### Suggested Character Options

- **Planner skill and language guidance now renders fully** - Suggested, not recommended, disallowed, rarity, and GM guidance now appear correctly in planner skill and bonus-language choices, and disallowed planner bonus languages are no longer selectable

## 2.1.7

### Character Wizard

- **Witch focus spell choices are selectable again** - Witch focus spell options such as `Patron's Puppet` and `Phase Familiar` now render as real focus-spell choices instead of static cards, so the patron focus spell can be picked correctly during creation
- **Psychic psi cantrips now use the focus-spell lane** - Psi cantrips from conscious minds are no longer mixed into the normal cantrip list, while granted rank-1 spells such as `Sure Strike` are still preserved in the main spell selection flow
- **Skills and languages now keep disallowed options visible** - Disallowed skills and languages remain visible in Character Creation with disabled controls and guidance badges instead of disappearing from the list
- **Not Recommended guidance now affects wizard ordering** - Suggested options rise to the top, neutral options stay in the middle, and not-recommended options sink to the bottom across wizard browsers, skills, and languages
- **Language badges no longer overlap** - Language rows now stack and wrap guidance / rarity badges cleanly so suggested, ancestry-suggested, and rarity tags no longer collide
- **General-feat grant previews no longer crash when skills data is missing** - Fixed an initialization bug in the skill context builder that could throw an `includes` error while previewing feat-granted skill choices

### Suggested Character Options

- **Layout now uses horizontal space more effectively** - Flat categories now use a tighter two-column layout with a less oversized window, and the bulk rarity actions render as compact cards instead of leaving a large empty middle
- **Searching no longer hides rarity bulk controls** - Filtering the list now only narrows the visible items and keeps all rarity bulk actions available for the active category

## 2.1.6

### Fixed

- Improved archetype journal parsing for dedications whose follow-up feats are listed directly on the journal page instead of under an `Additional Feats` block, including Acrobat and similar archetypes.
- Fixed skill feat browsing so unlocked archetype skill feats such as `Graceful Leaper` are not hidden by duplicate-name entries from other packs.
- Fixed skill feat browsing so dedication-unlocked archetype skill feats such as `Graceful Leaper` appear correctly in the skill feat picker.

## 2.1.5

### Feat Picker

- **Archetype additional feat parsing now handles full PF2e HTML formatting** - Additional feats lists that use PF2e content-link anchors, bolded level markers, paragraph breaks, and multiple feats at the same level now parse correctly, including later unlocks such as `Twin Riposte`, `Improved Twin Riposte`, `Two-Weapon Flurry`, and `Twinned Defense`
- **Dedication-unlocked feats now show their unlock level** - Feats made selectable by a dedication now display a badge such as `Dedication Lv 6+` in the feat picker so players can immediately see why the feat is available
- **Removed the old Dedications toggle from the feat picker** - The separate `Dedications` option was leftover UI and is now gone, since feat type and trait filters already cover that use case

### Suggested Character Options

- **Selection changes no longer jump back to the top** - Changing a mark in Suggested Character Options now preserves the current scroll position instead of rerendering back at the top of the list

## 2.1.4

### Feat Picker

- **Custom plan feat picker now opens truly unfiltered** - The `All Feats` custom planner picker no longer inherits default rarity restrictions from module settings. It now starts with all rarities visible and only limits results by level until the user applies filters
- **Archetype additional feats now parse correctly from PF2e journal content** - Fixed dedication `Additional Feats` parsing so linked feats like `Twin Parry` are resolved correctly from archetype journal pages instead of being misread as raw `@UUID[...]` text or mixed with unrelated archetype pages

## 2.1.3

### Character Wizard

- **Older characters can recover missing creation plans when reopened** - If a character's saved creation snapshot was lost by earlier versions, reopening Character Creation now rebuilds a best-effort level 1 plan from the actor's ancestry, heritage, background, class, deity, and recoverable level 1 feat selections, then saves that recovered snapshot for future edits
- **Granted feat Browse Feats buttons now open correctly** - Fixed the feat-choice template wiring so granted feat pickers such as `Versatile Human` correctly launch the locked feat picker instead of doing nothing when clicked

### Player Content Sources

- **Player access now follows the main compendium mapping** - The Player Content Sources menu no longer acts like a second compendium assignment tool. It now follows the main compendium manager's category mapping and only controls which of those mapped sources non-GM users are allowed to access

## 2.1.2

### Feat Picker

### Suggested Character Options

- **Openable entries, grouping, and bulk guidance tools** - Compendium-backed options in the Suggested Character Options menu can now be opened directly from the list, heritages are grouped by ancestry, and the menu now supports `Suggested`, `Not Recommended`, and `Disallowed` states. Added bulk actions by rarity for rarity-based categories and by ancestry group for heritages, and `Clear Tab` now only clears the active category
- **Language rarity now matches PF2e campaign settings** - Language rarity badges and guidance grouping now use the same PF2e campaign language rarity buckets as the system selector, including `common`, `uncommon`, `rare`, and `secret`

### Level Planner

- **Planned dedications now unlock archetype follow-up browsing correctly** - Planning a dedication feat now updates later archetype feat pickers correctly, keeping the picker on `archetype OR dedication` instead of remaining locked to `dedication`
- **Dedication choice sets appear in the planner** - Dedications with subclass or order `ChoiceSet`s, such as `Druid Dedication`, now surface those follow-up selections in the planner using the same shared choice-set parsing used by the creation wizard

### Spellcasting

- **Magus uses a separate Studious Spells entry** - Magus spellcasting now keeps bounded caster slots on the main `Magus Spells` entry and creates or updates a separate `Magus Studious Spells` entry for the extra studious slots

- **Skill filter now available in all feat pickers** — A chip-based skill filter (with AND/OR toggle) now appears in any feat picker whose pool contains feats with skill traits or skill prerequisites. Previously the filter only appeared in the dedicated Skill Feats picker. Now class feat, general feat, ancestry feat, archetype feat, and custom plan pickers all show the filter when relevant
- **Skill filter shows when feat type "Skill" is selected** — In pickers with a feat-type filter, the skill filter appears automatically when the Skill type chip is active, and hides when it's deselected
- **Skill filter supports multi-select with AND/OR logic** — Multiple skills can be filtered simultaneously; OR mode shows feats matching any selected skill, AND mode shows feats requiring all of them

### Character Wizard

- **Feat-grant choice sets can launch locked feat pickers** - Granted feat choices such as `General Training` now open the feat picker with locked filtering based on the rule instead of dumping large inline feat lists. The picker title also reflects the source grant and prompt
- **Background and language browsing improvements** - Backgrounds now expose skill and attribute filter metadata for browser filtering, and languages display their PF2e rarity in the wizard
- **Cleric divine font naming and prerequisite alignment** - Divine Font handling now uses the system's `healing` / `harmful` terminology while preserving compatibility with older stored `heal` / `harm` values, and prerequisites like `healing font` are matched correctly during planning and creation
- **Reopening Character Creation now recovers older level 1 plans** - Characters created before creation-plan persistence was preserved can now reopen Character Creation without falling back to a blank wizard. When no saved creation snapshot exists, the wizard rebuilds a best-effort level 1 plan from the actor's ancestry, heritage, background, class, deity, and recoverable level 1 feat selections, then saves that recovered snapshot for future edits

- **Wizard schools no longer falsely grant skill proficiencies** — The subclass skill parser was scanning the full description text for any mention of a skill name, causing items like "Pathfinder **Society**'s School of Spells" to incorrectly show Society as auto-trained. The HTML fallback now only matches explicit "trained in [skill]" phrasing
- **Duplicate auto-trained skills now grant an extra free skill choice** — When a subclass (e.g. Rogue Thief granting Thievery) and a background (e.g. Street Urchin granting Thievery) both auto-train the same skill, the duplicate now correctly increments the free skill choice count. Previously only class-vs-background duplicates were detected; subclass and deity skill grants are now included in the check
- **Skill prerequisites now evaluate correctly in feat pickers** — Feats requiring "Trained in X" (e.g. You're Next requiring Trained in Intimidation) were always shown as unmet in the wizard feat picker because the build state had no skills map. The picker now receives a full skills map built from class, subclass, background, deity, and user-selected skills

### Export / Import

- **`equipment` and `permanentItems` normalized on wizard import** — Importing a creation file exported before equipment features were added now correctly initializes both fields to empty arrays instead of leaving them undefined
- **Planner import normalizes `apparitions`** — Importing an older plan file missing the `apparitions` field no longer requires consumers to guard against undefined

## 2.1.1

### Character Wizard

- **Languages step now appears after feats** — The languages step was moved to after feat selection so that feat-granted languages (e.g. Angelkin granting Empyrean) are already known when the step renders
- **Feat-granted languages shown as auto-granted** — The wizard now scans selected feats for language grants via `system.subfeatures.languages.granted` (PF2e runtime data), `ActiveEffectLike` rules targeting `system.traits.languages.value` and `system.build.languages.granted`, and follows `GrantItem` rules recursively. Granted languages appear in the "granted" (non-removable) section with a "Feat" source label
- **Feat-granted language slots added to maximum** — Feats like Multilingual that add extra language slots via `system.subfeatures.languages.slots` or an `ActiveEffectLike` rule targeting `system.build.languages.max` now correctly increase the choosable language count
- **Feat cards show granted items** — When a feat grants items via `GrantItem` rules, the feat card in the wizard now shows a "Grants" section listing those items (e.g. Angelkin granting the Angelkin Heritage feat item)

- **Dromaar/Aiuvarin heritages grant parent ancestry traits** — Dromaar now correctly unlocks orc ancestry feats, and Aiuvarin unlocks elf ancestry feats. Added ancestry trait aliases for Remaster half-heritage names and heritage rule scanning for `ActiveEffectLike` trait grants
- **Vision/sense prerequisites now checked** — Prerequisites like "low-light vision" and "darkvision" are now parsed, matched against senses from the selected ancestry and heritage, and displayed correctly. Darkvision satisfies low-light vision requirements. Heritage-granted senses (e.g. Dromaar granting low-light vision) are detected from both `system.vision` and `Sense` rules

### Equipment

- **Ammunition and batch-priced items handled correctly** — Items with a per-batch price (e.g. 1 sp per 10 rounds) are now added in the correct batch quantity. The item picker label shows "1 sp / 10", the equipment list displays the actual batch quantity, and the total cost is calculated per-batch. Increment/decrement steps by the batch size

### Level Planner

- **Archetype feat picker no longer locks dedication filter** — When using Free Archetype, the archetype feat picker previously always locked the "dedication" trait filter, preventing browsing non-dedication archetype feats at later levels. Now the dedication filter is only locked when no archetype dedication has been selected yet

## 2.1.0

### GM Content Guidance

- **Suggested & disallowed character options** — GMs can now mark ancestries, heritages, backgrounds, classes, skills, and languages as "Suggested" or "Disallowed" via a new settings menu (Module Settings → Configure Suggestions). Suggested items display a gold star badge and sort to the top of their list. Disallowed items are dimmed with a red "Disallowed" badge and their Select button is disabled
- **Guidance persists per-world** — Marks are stored as a world-scoped setting keyed by item UUID (or `skill:`/`language:` prefix for skills and languages). Changing marks invalidates the cache automatically
- **Disallowed items remain visible** — Disallowed options are shown dimmed with a "Disallowed" badge and their Select button is disabled, rather than being hidden. Items filtered by rarity restrictions are re-injected into the list so players can see they exist but can't select them

### Character Wizard

- **Heritage step groups ancestry and versatile heritages** — The heritage browser now separates ancestry-specific heritages from versatile heritages with labeled section headers ("Ancestry Heritages" / "Versatile Heritages"), making it easier to find the right heritage
- **Heritage ChoiceSets now resolve correctly** — Feats like "Elf Atavism" that have a ChoiceSet with `itemType: "heritage"` were showing feats instead of heritages because the compendium loader had no case for heritage items. Added heritage support to `getChoiceSetPackKeys`, `normalizeChoiceCandidate` (ancestry slug), and `matchesChoiceSetFilterString` (`item:ancestry:` filter)

### Prerequisite Matching

- **Comma-separated skill prerequisites now parse correctly** — Prerequisites like "trained in Arcana, Nature, Occultism, or Religion" were incorrectly parsed: only the first skill was recognized, and the last one (after "or") was treated as a feat name. All skills in comma/or lists are now parsed as an any-of-skills node
- **"Bloodline spell" / "mystery spell" / "patron spell" prerequisites** — Added a new `subclassSpell` prerequisite type that checks whether the character has the matching subclass type (e.g. sorcerer bloodline) and a focus pool. Previously these fell through to feat matching and always failed

### Item Picker

- **Ammunition category now appears** — PF2e stores ammunition as `type: "ammo"` (not `type: "consumable"` with a category). Added `"ammo"` to the equipment type set so ammunition items are loaded from compendiums, and updated the category normalizer to recognize `type === "ammo"`
- **Item count shows rendered vs total when capped** — The results count now shows "200 / 5000" when the initial 200-item render limit is active, instead of showing the full unfiltered count

### Spell Picker

- **Ritual spells appear in tradition-locked pickers** — Fixed `_filterSpells()` to pass ritual spells through the tradition filter, matching the behavior already in `_matchesTradition()`. Also added `system.ritual` property detection as a fallback for identifying rituals

### Bug Fixes

- **`system.category` string vs object handling** — Fixed `normalizeItemCategory` and `normalizeChoiceCandidate` to correctly read `system.category` when PF2e stores it as a plain string instead of `{ value: "..." }`. This was causing ammunition and other category-dependent items to be miscategorized
- **Item picker preserves Document references** — `loadItems()` was spreading FoundryVTT Documents with `...doc`, which loses prototype getters like `system`. Changed to preserve original Document references (matching how `loadSpells` already works)

## 2.0.1

### Spell Picker

- **Wizard spell step uses popup picker** — The character wizard's spell selection step now uses the same popup SpellPicker window as the level planner, replacing the old inline spell browser. Cantrips and 1st-rank spells each get a compact card with a "Browse..." button that opens a pre-configured picker. Curriculum and focus spell selection remain inline since they use fixed option lists
- **Spell category and rank locked in context** — When browsing cantrips, the "Cantrip" category chip is locked; when browsing rank-1 spells, the "Spell" category and "Rank 1" rank chips are locked. Only applies when the picker is opened with `exactRank` mode (wizard and preparation sheets). General-purpose spell pickers (level planner, custom spells) leave all chips toggleable
- **Ritual spells now appear in tradition-locked pickers** — Ritual spells are tradition-agnostic and were previously filtered out when the picker was locked to a specific tradition (e.g. arcane). They now always pass the tradition filter
- **Spell rarity respects player settings** — The spell picker's rarity chips now initialize from the player's allowed rarities instead of defaulting to all four. Players restricted to common content will only see common spells pre-selected

### Feat Picker

- **"Bonus" and "Other" feat types hidden** — Feats without standard PF2e type traits (class, ancestry, skill, general, archetype) were tagged as "Bonus" or "Other" and shown as filterable chips. These noise types are now hidden from the feat type filter. The feats themselves still appear in results — they just don't get a dedicated chip
- **"Mythic" feat type only shown when mythic rules are enabled** — The Mythic chip in the feat type filter is now hidden unless the Mythic variant rule is active in the game system
- **General feat picker shows Skill chip** — The general feat picker now shows "General" (locked) + "Skill" (toggleable) as feat type chips. When "Skill" is deselected, only pure general feats (without the skill trait) are shown — giving a clean way to see just general feats without skill feats mixed in

### Item Picker

- **Level filter added** — The item/equipment picker now has a "Max Level" dropdown filter in the sidebar, letting you filter items by level (0–24)
- **Item level displayed in results** — Each item row now shows "Lv X" before the price
- **Ammunition category fixed** — Ammunition items were incorrectly categorized as "Consumable" because PF2e stores them with `type: 'consumable'` and `category: 'ammunition'`. The consumable check was running first. Ammunition now correctly appears as its own category

### Filter & Chip Fixes

- **Chip toggle no longer re-selects all on empty** — Fixed a bug where deselecting the last chip in any filter (rarity, rank, category, feat type, source) would re-select everything. Clicking a chip on an empty set now correctly selects just that one chip
- **`initializeSelectionSet` no longer falls back to all** — Added `defaultValues: []` to all remaining `initializeSelectionSet` calls (spell ranks, spell traditions, spell categories, item categories, feat types) so empty sets stay empty instead of silently selecting everything

### Character Wizard

- **ChoiceSet options exclude class features** — The wizard's Options step (e.g. "School of Unified Magical Theory") was showing class features (Arcane Bond, Arcane School, Arcane Thesis) alongside actual feats. Items with `category: 'classfeature'` are now excluded from ChoiceSet candidates unless the rule explicitly requests class features
- **Category field normalization** — Fixed `normalizeChoiceCandidate` to correctly resolve `system.category` when it's an object (`{ value: 'classfeature' }`) instead of a plain string, which was causing the classfeature filter to miss some items

### Bug Fixes

- **Ancestral paragon feat error fixed** — Fixed `wizard._getClassTrainedSkills is not a function` crash when enriching feats in the level planner. The planner's mock wizard object was missing the `_getClassTrainedSkills` method, which is called when feats grant skill training with fallback options
- **`matchFeat` null safety** — Added optional chaining to `buildState.feats?.has()` in the prerequisite matcher, preventing crashes when the build state has no feats set (same pattern as the earlier `matchSkill`/`matchAbility` fixes)
- **Feat cache category check** — Updated the feat cache's classfeature exclusion to handle both `system.category` (string) and `system.category.value` (object) formats

## 2.0.0

### High-Level Character Creation

- **Sequential planner mode** — When you create a character above level 1 using the character wizard, the level planner now opens in sequential mode
  - The planner walks you through each level from 2 up to your character's level, one at a time
  - The sidebar locks to the current level — you can't skip ahead until you've made all required picks for the level you're on
  - A **Next Level** button appears at the bottom of the screen once a level is complete; click it to advance
  - After planning the final level, a **Finish Planning** button unlocks the full planner for future use
  - Sequential state persists if you close and reopen — you'll pick up right where you left off

### Equipment Planning in Level Planner

- **Dedicated equipment section (Table 10-10)** — When the Starting Wealth mode is set to "Items + Currency", the planner shows permanent item slots based on PF2e Table 10-10 at the character's current level
  - Each slot has a max item level — browse to fill it with a permanent item (weapon, armor, shield, equipment)
  - Players are restricted to permanent item types and level limits; GMs can bypass both
  - The currency budget for the level is displayed below the slots
- **Custom equipment in every level** — A new "Custom Equipment" sub-section in the Custom Level Plan area lets you plan equipment at any level, regardless of wealth mode
  - Add any item from the equipment compendium as a planning note
  - Click an item name to view its sheet; remove with the X button
- **Equipment applied on level-up** — Both permanent slot items and custom equipment are added to the actor's inventory when the level-up plan is applied, and listed in the level-up chat message

### Compendium & Content Filtering

- **Equipment compendiums are now configurable** — The equipment category is now visible in the compendium settings, so GMs can add custom equipment compendiums from third-party modules
- **Spell picker no longer shows non-spell items** — When a custom compendium contains mixed content (feats, spells, class features), the spell picker now correctly filters to only show spells
- **Content source filter reworked** — Source chips now start deselected; when nothing is selected, all sources are shown. Select a specific source to filter down to just that source's content. No more needing to deselect everything first to isolate one compendium

### Feat Picker Improvements

- **Skill feats no longer include archetype feats** — The skill feat picker now correctly excludes feats with the archetype trait
- **General feats no longer include archetype feats** — Same fix for the general feat picker
- **Feat type filter simplified** — When a feat type is locked (e.g. "Class" for a class feat slot), only the locked type and relevant extras are shown as chips instead of the full list. Class feat slots show "Class" (locked) + "Archetype" (toggleable). Custom feat slots still show all types
- **Dedication toggle removed for class feats** — Replaced by the Archetype feat type chip, which is cleaner and more consistent
- **Skill feats toggle removed for general feats** — Replaced by the Skill feat type chip in the feat types filter
- **Free archetype slot shows all archetype feats** — The free archetype feat slot now correctly lets you pick any archetype feat (not just dedications), matching PF2e rules. If you don't have a dedication yet, the picker filters to only show dedications, multiclass, and class archetype entry feats
- **Trait autocomplete updates dynamically** — The trait input dropdown now shows traits from the current filtered results (respecting feat type, rarity, level, source filters), not from the entire unfiltered list

### Spell Picker Improvements

- **Spell category filter now updates visually** — Toggling spell category chips (Spell, Cantrip, Focus, Ritual) now immediately updates the chip's visual state, matching how rank and tradition chips already worked
- **Cantrip picker locks the category** — When the spell picker is opened specifically for cantrips, the "Cantrip" category chip is shown as locked with a lock icon
- **Tradition locked on class spell pickers** — The regular spell picker (used when adding spells during level-up) now shows only your class's tradition as a locked chip. The custom spell picker still shows all traditions as toggleable
- **Spell rank pre-selected by level** — When opening the spell picker from a level-up slot, the rank filter pre-selects only the spell rank that slot grants, instead of showing all ranks selected. Custom spell pickers pre-select ranks available at that character level

### Ability Boost Improvements

- **Boost count shown in header** — The ability boosts section now shows how many boosts you've selected out of the total, e.g. "Choose 4 Ability Boosts (2/4)"
- **Partial boost display improved** — Selected boosts at 18+ ability scores now show `+4 → +5(partial)` to clearly indicate this is a partial boost that needs a second boost to take full effect. When the second boost completes the partial, it shows a clean `+4 → +5` without the partial label
- **Partial boost tooltips differentiated** — The info icon on partial boosts now shows distinct messages: "Partial boost: two boosts needed for +1" when no half-boost is pending, and "This completes a pending partial +1 boost" when a prior half-boost exists

### Custom Autocomplete

- **Styled trait autocomplete** — The trait filter input across all three pickers (feat, spell, equipment) now uses a custom styled dropdown instead of the browser's native datalist. Features include:
  - Matching text highlighted in gold
  - Keyboard navigation with arrow keys, Enter to select, Escape to close
  - Click to select from the dropdown
  - Already-selected traits are excluded from suggestions

### Bug Fixes

- **Class feat browsing error fixed** — Fixed a crash ("Cannot read properties of undefined reading 'deception'") when opening the class feat picker during character creation, caused by the prerequisite checker accessing an incomplete build state

## 1.5.1

### Added

- **Starting equipment gold limit (GM setting)** — GMs can now set a gold piece budget for starting equipment under module settings; set to 0 to disable
  - Players cannot select an item that would push the total over the budget — a notification explains why the item was blocked; GMs are exempt and can always add any item
  - The equipment list shows the current total against the limit and how much gold remains; the total turns red with a warning icon if the budget is somehow exceeded

## 1.5.0

### New Features

- **Equipment picker** — Character creation now includes a dedicated equipment step where you can browse and add starting gear before finishing character creation
  - Full compendium browser with sidebar filters: category, trait, rarity, and source
  - Items display their price, category, and key traits at a glance
  - Quantities can be adjusted per item with `+` and `−` controls; the same item added twice stacks automatically
  - A running total cost is shown below the equipment list, normalized across gp, sp, and cp
  - The equipment step is optional — skipping it creates the character without any starting gear
  - All selected equipment is applied to the actor on character creation and listed in the creation chat card under "Starting Equipment"

- **Equipment browser performance** — The browser opens instantly with a loading spinner while compendiums load in the background; item data is cached for the rest of the session so re-opening the picker is immediate
  - When no filters are active the list is capped at 200 items to keep the UI responsive; applying any search, trait, category, rarity, or source filter lifts the cap and shows all matching results

### Improved

- **Unified compendium picker design** — The feat picker, spell picker, and new equipment picker now all share the same two-panel layout: a scrollable filter sidebar on the left and a results list on the right
  - Every picker has the same sidebar structure — search field at the top, followed by collapsible filter groups for traits, rarity, category or type chips, and compendium source toggles
  - Switching between picking a feat, a spell, or a piece of equipment feels consistent; the same gestures and filter patterns work everywhere
  - All three pickers open in a resizable floating window at the same size, so they don't feel like separate tools bolted together
  - Under the hood, all pickers share a single stylesheet (`compendium-picker.css`) and a set of shared filter utilities, so visual fixes and improvements apply everywhere at once

- **Trait filter in equipment picker** — The equipment picker includes the same trait autocomplete input found in the feat and spell pickers, with AND/OR toggle and removable chip display

- **Rarity filter chips** — Rarity filter chips across all pickers now show their PF2e rarity color when selected (amber for uncommon, blue for rare, purple for unique) and appear faded when deselected, making the active filter state immediately obvious

- **Feat picker trait autocomplete** — The trait input datalist now updates dynamically as you apply other filters, so only traits that actually appear in the current results are suggested; filtering out archetypes will remove `dedication` from the suggestions, for example

- **Locked filter chips no longer show a remove button** — Trait and feat-type chips that are locked by the context (e.g. the ancestry trait locked when browsing ancestry feats) no longer show the `×` icon, making it clear they cannot be removed

- **Spell picker trait autocomplete fixed** — The trait autocomplete dropdown was showing `[object Object]` instead of trait names; it now correctly displays each trait as a plain string

- **Character wizard feat selection redesigned** — The wizard's feat step no longer embeds a full inline browser that takes over the whole panel; each feat slot (Ancestry Feat, Class Feat, Skill Feat, Ancestry Paragon) is now a compact card with a **Browse** button that opens a pre-configured popup picker
  - Each slot's picker opens pre-filtered and locked to the correct feat type for that slot — class feat slots only show class feats for your chosen class, ancestry feat slots lock to your ancestry's trait, and so on
  - Previously selected feats show their name in the slot card with a clear button; clicking the name opens the feat sheet
  - Class feat picker now correctly filters by the selected class instead of showing zero results

- **Search inputs no longer lose focus while filtering** — All compendium pickers now update only the results list in the DOM when filters change, leaving the sidebar (and the active search input) completely untouched; typing in the search field no longer resets the cursor position after each character

- **Partial ability score boost display** — The `(x2)` label next to partially-boosted ability scores in the level planner has been replaced with a small info icon; hovering over it shows the full explanation as a tooltip, keeping the boost buttons clean and uncluttered

## 1.4.10

### Fixed

- Character wizard heritage selection now works again after the mixed-pack type hardening
  - Restored the `type: heritage` field on loaded heritage entries so the heritage step no longer filters out every valid heritage row
  - Heritage matching now uses ancestry slug, name, UUID-derived tokens, and ancestry aliases so third-party or alias-heavy ancestry data can still resolve the correct heritage list

## 1.4.9

### Fixed

- Character wizard ancestry browsing now ignores non-ancestry records from mixed assigned packs
  - The ancestry step now narrows assigned ancestry sources down to real ancestry documents only, so ancestry-tagged feats and other unrelated records no longer appear in ancestry selection
- Character wizard document browsers now stay strict about mixed assigned packs
  - The heritage step now narrows assigned heritage sources down to real heritage documents only
  - The background step now narrows assigned background sources down to real background documents only
  - The class step now narrows assigned class sources down to real class documents only
- Archetype feat eligibility now picks up additional feats from PF2E archetype journals more reliably
  - Additional archetype feats can now be discovered from dedication descriptions, embedded journal links, matching journal entry names, and matching journal page names
  - Listed additional feats also resolve back to real feat records by UUID or exact name, which helps archetypes whose feat names and slugs do not line up cleanly
- Playtest classes now register as supported planner classes
  - Added built-in class definitions for `Slayer` and `Daredevil`, including feat schedules, skill increase schedules, ability boost schedules, and core class feature milestones
  - Characters using those playtest classes can now see and use the level planner from their character sheet like other supported classes

## 1.4.8

### Improved

- Spell picker filtering is clearer and more complete
  - Added a proper localized label for the new spell tradition filter in both English and French
  - Tradition chips now read as a normal UI label instead of exposing the raw localization key

### Fixed

- Level planner custom plan behavior is more stable and readable
  - Fixed malformed custom-plan template nesting that could push later planner sections out of the main content column
  - Opening or closing `Custom Level Plan` now preserves the planner scroll position instead of jumping back to the top
  - Spellbook entries in the planner no longer show `Rank -1` when they were stored with the internal any-rank sentinel; they now display the spell's actual learned/base rank
- Character wizard ancestry browsing now stays ancestry-only
  - The ancestry step now filters mixed assigned packs down to real ancestry documents instead of showing ancestry-tagged feats or other non-ancestry records
- Compendium manager search is more relevant
  - Pack assignment search no longer matches rows only because a category chip name appears in the row
- Custom spell picking is more robust
  - Fixed a spell picker crash when a spell did not expose `system.level.value` in the expected shape

## 1.4.7

### Fixed

- Crashing compendiums

## 1.4.6

### Improved

- Compendium manager assignment view is smoother to use
  - Changing pack-category assignments in `Assign Packs` now updates in place instead of rerendering the whole window and snapping back to the top
  - The compendium manager no longer exposes `Actions` or `Items and Equipment` as configurable categories, keeping the UI focused on the categories that matter most for manual assignment
- Custom planner skill chips read more clearly
  - Custom skill increase chips now use a neutral base style with rank-colored text and accents instead of a generic blue info style

### Fixed

- Custom feat picker selection now works when compendium feat rows do not provide a direct UUID
  - Feat rows now derive a stable identity from UUID, source ID, core source flag, or compendium pack/id data before rendering selection controls
  - This fixes `Select`, `Select All`, and `Add Selected` in custom feat picking when the rendered buttons would otherwise have empty `data-uuid` attributes

## 1.4.5

### Improved

- Level planner custom planning is now much more flexible
  - Added a per-level `Custom Level Plan` section that can hold bonus/custom feats, skill increases, spells, and cantrips
  - Custom feat and spell entries are planner-aware, so they count toward feat state, skill state, and spell state while planning later levels
  - Custom feats and spells now render as compact chips instead of full-width rows, with clickable names to inspect the item and controls to remove or replace entries
  - Custom skill increases are grouped by target rank and now use neutral rank-aware chips instead of a generic blue status style
  - The custom plan section now stays pinned to the bottom of the level view instead of interrupting the normal progression sections
- Custom feat and spell pickers are easier to use in bulk
  - Custom feat picking now supports multi-select with `Select All`, `Deselect All`, and `Add Selected`
  - Custom spell and cantrip picking now supports multi-select as well, so multiple additions can be made in one pass
  - Added custom feat-type filtering in the feat picker, including class, ancestry, general, skill, archetype, mythic, and other
  - Added multi-rank filtering in the spell picker, including cantrips
- Compendium manager pack assignment is much easier to use
  - Added an `Assign Packs` view so GMs can map a single compendium to multiple PF2E content categories from one screen
  - Added clearer assignment guidance plus pack-assignment search by compendium name, pack key, module/package, and creator
  - Pack-assignment search now filters in place instead of rerendering the window on every keystroke
  - Mixed `Item` compendiums can now be assigned more naturally across feat, spell, and class-feature style categories without relying entirely on auto-detection
- Chat summaries are much easier to navigate
  - Character creation and planned level-up chat messages now render linked content for item-backed selections such as ancestry, heritage, background, class, subclass, feats, spells, and deity choices
  - Long linked rows now wrap more cleanly in chat instead of being clipped
- Feat-granted planner state is clearer in the UI
  - Skills granted or set by feats stay visible in the skill increase grid and can show their source through a tooltip on the info icon
  - Tooltip source labels now resolve more safely from feat data and no longer fall through to raw null values

### Fixed

- Planner feat-granted skills now follow PF2E feat wording more closely
  - Dedications such as `Acrobat Dedication` now correctly apply formula-based skill rank progression across later levels
  - Textual skill rules such as `become trained ... if already trained, become expert instead` are now recognized for dedications like `Blackjacket Dedication`
  - Feat-owned follow-up prompts such as deity selection for `Champion Dedication` now appear in the planner
  - Skill-overlap wording such as `...you instead become trained in a skill of your choice` now creates fallback skill prompts and applies the chosen replacement skill in planner state
- Character wizard feat and skill-choice handling now covers more PF2E edge cases
  - Ancestry lore feats now support the shared PF2E fallback wording for overlapping trained skills, including multiple replacement picks when multiple granted skills overlap
  - Ancestry lore feats also now add their granted lore skill, such as `Elf Lore`
  - Class/background duplicate auto-training now grants replacement free skill selections instead of silently losing value
  - Required feat-step completion now correctly respects missing required class feats
  - Selected feat cards can again be opened from within the wizard card without breaking the layout
  - Cleric/champion style deity-domain or deity-skill related prompt flows now surface more reliably in loading and follow-up choice summaries
- Rogue key ability selection now matches the class rules better
  - Rogues can now choose `Dexterity` or the racket-based alternative instead of being forced into only the racket option
- Custom feat picker selection now works reliably in real Foundry rendering
  - Feat rows now derive stable identities from UUID, source ID, or compendium pack data instead of rendering unusable empty `data-uuid` values
  - Multi-select feat actions now bind cleanly against the rendered picker root and survive list refreshes
- Level planner feat-granted skill tooltips no longer show `Set by: null`
  - Tooltip source names now fall back through planned feat name, resolved UUID document name, slug, and finally a localized generic label

## 1.4.4

### Improved

- Chat summaries are easier to use and read
  - Character creation and planned level-up chat messages now render item-backed selections such as ancestry, heritage, background, class, subclass, feats, spells, and deity choices as clickable Foundry content links
  - Long linked values and granted-feat choice rows now wrap more cleanly in the chat sidebar instead of being cut off
- Level planner follow-up choices now cover more feat-specific cases
  - Planned feats such as `Champion Dedication` can now show deity follow-up choices directly under the feat card
  - Planner feat overlap wording such as `...you instead become trained in a skill of your choice` now surfaces replacement skill choices and applies the selected fallback training in build state

### Fixed

- Mixed `Item` compendiums can now be enabled in more than one content category
  - A single compendium pack that genuinely contains multiple supported item kinds, such as feats and spells together, now appears in each matching category in the compendium settings
  - Existing safety checks for obviously misclassified packs are still preserved for pure non-feat or non-action packs

## 1.4.3

### Fixed

- Character wizard ancestry lore and feat-choice flows now behave more like PF2E expects
  - Ancestry lore feats now add their granted lore skills such as `Elf Lore`, alongside their trained-skill fallback prompts
  - Synthetic feat skill prompts keep already-trained and already-selected skills locked after rerenders instead of visually unlocking invalid choices
  - Rogue key ability selection now correctly offers `Dexterity` or the racket-based alternative, and the Boosts step stays incomplete until that choice is made
- Character wizard browsing and completion state are more stable
  - The Feats step now stays incomplete when a required level-1 class feat is still missing
  - Feat Choices browsing now preserves the inner feat-pane scroll position across save/rerender cycles instead of jumping back to the top

## 1.4.2

### Improved

- Higher-level existing characters now bootstrap into the planner more completely
  - New plans now pull in obvious owned feat selections and stored ability boosts from the actor when clear level data exists
  - Imported past boosts are shown as already applied in the planner instead of only affecting the displayed current modifiers
  - Auto-imported higher-level plans now hide historical skill-increase sections up to the actor's current level, since PF2E only stores current ranks and not the full increase history
  - As soon as a pulled-in plan has real selections above the actor's current level, it is treated as a normal authored plan instead of bootstrap-only imported data
- GMs can now restrict player-facing character options by rarity and source
  - Added world settings to allow or block `Uncommon`, `Rare`, and `Unique` content for non-GM users
  - Added a GM-only `Player Content Sources` configuration menu plus an enable toggle to limit players to approved compendium sources during character creation and leveling

### Fixed

- Wizard skill choice-set handling is now clearer and safer
  - The Skills step now warns when a skill appears in a later choice set
  - Later skill choice sets now recognize skills already chosen in the Skills step and block duplicate selection to avoid conflicts

## 1.4.1

### Fixed

- Custom compendium category discovery now classifies PF2E packs by their actual item data instead of relying on pack names
  - Third-party packs containing subclasses and class features are now detected from PF2E item categories such as `classfeature`, even when the pack is named things like `Player Options` or `Subclasses`
  - Pure class-feature packs no longer leak into the `Feats` category just because their documents use PF2E's feat-like item shape

## 1.4.0

### Improved

- Spell selection windows now support sorting by spell rank as well as name
  - Added a `Sort` control to the reusable spell picker with rank and alphabetical ordering options
  - Mixed-rank spell pickers now default to showing the highest-rank spells first, making higher-level spell selection much easier

## 1.3.9

### Fixed

- Character wizard bootstrap is now resilient to Handlebars helper registration timing
  - The wizard no longer fails with `Missing helper: "notEqual"` when templates render before helper registration completes
  - Handlebars helper registration is now idempotent and can safely run from both lifecycle init and wizard load paths

## 1.3.8

### Fixed

- Champion and Cleric deity selection now grants the deity's trained skill correctly
  - Deity data now preserves PF2E's configured skill through the wizard flow and applies that training to the actor during character creation
  - The Skills step now shows deity-granted skills as auto-trained instead of leaving them ungranted
- Patron-deity backgrounds now add a Lore placeholder when PF2E describes the grant textually
  - Backgrounds such as `Pilgrim` now add `[Deity Name] Lore` when a patron deity is selected
  - If no deity has been chosen yet, the wizard falls back to `Deity Lore`

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
