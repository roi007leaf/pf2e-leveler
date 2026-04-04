/**
 * Base class handler for the character creation wizard.
 * Contains only universal logic shared by ALL classes:
 * ancestry, heritage, background, boosts, languages, skills, feats.
 *
 * Spell-related methods return empty defaults.
 * Classes with spellcasting override these in their own handlers.
 */
export class BaseClassHandler {
  getExtraSteps() { return []; }

  isStepComplete(_stepId, _data) { return null; }

  async getStepContext(_stepId, _data, _wizard) { return null; }

  shouldShowSubclassChoices(_data) { return (_data.subclass?.choiceSets?.length ?? 0) > 0; }

  needsSpellSelection(_data, _classDef) { return false; }

  isSpellsComplete(_data, _maxCantrips, _maxRank1) { return true; }

  filterSubclasses(subclasses, _data) { return subclasses; }

  async resolveGrantedSpells(_data) { return { cantrips: [], rank1s: [] }; }

  async resolveFocusSpells(_data) { return []; }

  isFocusSpellChoice() { return false; }

  buildFocusContext(_data, focusSpells) {
    return { focusSpells, isDevotionChoice: false };
  }

  needsNonCasterSpellStep(_data) { return false; }

  getSpellbookCounts(_data, _classDef) { return null; }

  getSpellContext(_data, _classDef) { return {}; }

  async getKeyAbilityOptions(_data, classDef) { return classDef?.keyAbility ?? []; }

  async applyExtras(_actor, _data) {}
}
