import {
  matchSkill,
  matchAnySkill,
  matchRecallKnowledgeSkill,
  matchWeaponFamilyProficiency,
  matchLore,
  matchLanguage,
  matchAbility,
  matchLevel,
  matchFeat,
  matchClassFeature,
  matchBackground,
  matchHeritage,
  matchProficiency,
  matchClassHp,
  matchDeityState,
  matchSpellcastingState,
  matchClassIdentity,
  matchSubclassSpell,
  matchDivineFont,
  matchEquipmentState,
  matchAncestryFeatAccess,
  matchUnknown,
} from '../../../scripts/prerequisites/matchers.js';

describe('matchSkill', () => {
  test('met when skill rank is sufficient', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'athletics', minRank: 1, text: 'trained in Athletics' },
      { skills: { athletics: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when skill rank is insufficient', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'athletics', minRank: 2, text: 'expert in Athletics' },
      { skills: { athletics: 1 } },
    );
    expect(result.met).toBe(false);
  });

  test('not met when skill is untrained', () => {
    const result = matchSkill(
      { type: 'skill', skill: 'arcana', minRank: 1, text: 'trained in Arcana' },
      { skills: { arcana: 0 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchAnySkill', () => {
  test('met when any skill rank is sufficient', () => {
    const result = matchAnySkill(
      { type: 'anySkill', minRank: 1, text: 'trained in at least one skill' },
      { skills: { athletics: 0, crafting: 1, stealth: 0 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when no skill rank is sufficient', () => {
    const result = matchAnySkill(
      { type: 'anySkill', minRank: 1, text: 'trained in at least one skill' },
      { skills: { athletics: 0, crafting: 0, stealth: 0 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchRecallKnowledgeSkill', () => {
  test('met when a Recall Knowledge skill rank is sufficient', () => {
    const result = matchRecallKnowledgeSkill(
      { type: 'recallKnowledgeSkill', minRank: 1, text: 'trained in a skill with the Recall Knowledge action' },
      { skills: { athletics: 1, religion: 1 }, lores: {} },
    );
    expect(result.met).toBe(true);
  });

  test('met when a lore rank is sufficient', () => {
    const result = matchRecallKnowledgeSkill(
      { type: 'recallKnowledgeSkill', minRank: 1, text: 'trained in a skill with the Recall Knowledge action' },
      { skills: { athletics: 1 }, lores: { 'underworld-lore': 1 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when neither Recall Knowledge skills nor lore qualify', () => {
    const result = matchRecallKnowledgeSkill(
      { type: 'recallKnowledgeSkill', minRank: 1, text: 'trained in a skill with the Recall Knowledge action' },
      { skills: { athletics: 1, stealth: 0 }, lores: {} },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchWeaponFamilyProficiency', () => {
  test('meets crossbow proficiency when simple weapon proficiency is sufficient', () => {
    const result = matchWeaponFamilyProficiency(
      { type: 'weaponFamilyProficiency', family: 'crossbow', minRank: 1, text: 'trained in at least one crossbow' },
      { weaponProficiencies: { simple: 1 } },
    );
    expect(result.met).toBe(true);
  });

  test('fails crossbow proficiency when no relevant weapon proficiency is present', () => {
    const result = matchWeaponFamilyProficiency(
      { type: 'weaponFamilyProficiency', family: 'crossbow', minRank: 1, text: 'trained in at least one crossbow' },
      { weaponProficiencies: { martial: 1 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchLore', () => {
  test('met when lore rank is sufficient', () => {
    const result = matchLore(
      { type: 'lore', loreSlug: 'underworld-lore', minRank: 1, text: 'trained in Underworld Lore' },
      { lores: { 'underworld-lore': 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when lore is missing', () => {
    const result = matchLore(
      { type: 'lore', loreSlug: 'underworld-lore', minRank: 1, text: 'trained in Underworld Lore' },
      { lores: {} },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchLanguage', () => {
  test('met when all required languages are known', () => {
    const result = matchLanguage(
      { type: 'language', languages: ['osiriani', 'sphinx'], text: 'Ancient Osiriani and Sphinx languages' },
      { languages: new Set(['common', 'osiriani', 'sphinx']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met when one required language is missing', () => {
    const result = matchLanguage(
      { type: 'language', languages: ['osiriani', 'sphinx'], text: 'Ancient Osiriani and Sphinx languages' },
      { languages: new Set(['common', 'osiriani']) },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchAbility', () => {
  test('met when ability score is sufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'str', minValue: 14, text: 'Strength 14' },
      { attributes: { str: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when ability score is insufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'str', minValue: 14, text: 'Strength 14' },
      { attributes: { str: 1 } },
    );
    expect(result.met).toBe(false);
  });

  test('mod 0 gives score 10', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'dex', minValue: 12, text: 'Dexterity 12' },
      { attributes: { dex: 0 } },
    );
    expect(result.met).toBe(false);
  });

  test('met when modifier format and mod is sufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'dex', minValue: 2, isModifier: true, text: 'Dexterity +2' },
      { attributes: { dex: 4 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when modifier format and mod is insufficient', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'dex', minValue: 2, isModifier: true, text: 'Dexterity +2' },
      { attributes: { dex: 1 } },
    );
    expect(result.met).toBe(false);
  });

  test('met when modifier format and mod equals requirement', () => {
    const result = matchAbility(
      { type: 'ability', ability: 'str', minValue: 2, isModifier: true, text: 'Strength +2' },
      { attributes: { str: 2 } },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchLevel', () => {
  test('met when level is sufficient', () => {
    const result = matchLevel(
      { type: 'level', minLevel: 4, text: '4th level' },
      { level: 5 },
    );
    expect(result.met).toBe(true);
  });

  test('not met when level is insufficient', () => {
    const result = matchLevel(
      { type: 'level', minLevel: 4, text: '4th level' },
      { level: 3 },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchFeat', () => {
  test('met when feat is in build state', () => {
    const result = matchFeat(
      { type: 'feat', slug: 'fighter-dedication', text: 'Fighter Dedication' },
      { feats: new Set(['fighter-dedication', 'power-attack']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met when feat is missing', () => {
    const result = matchFeat(
      { type: 'feat', slug: 'fighter-dedication', text: 'Fighter Dedication' },
      { feats: new Set(['power-attack']) },
    );
    expect(result.met).toBe(false);
  });

  test('met when slug matches a class feature', () => {
    const result = matchFeat(
      { type: 'feat', slug: 'focus-pool', text: 'Focus Pool' },
      { feats: new Set(), classFeatures: new Set(['focus-pool', 'spellstrike']) },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchClassFeature', () => {
  test('met when class feature is in build state', () => {
    const result = matchClassFeature(
      { type: 'classFeature', slug: 'rage', text: 'Rage class feature' },
      { classFeatures: new Set(['rage', 'mighty-rage']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met when class feature is missing', () => {
    const result = matchClassFeature(
      { type: 'classFeature', slug: 'rage', text: 'Rage class feature' },
      { classFeatures: new Set(['spellstrike']) },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchDivineFont', () => {
  test('met when healing font is selected', () => {
    const result = matchDivineFont(
      { type: 'divineFont', font: 'healing', text: 'healing font' },
      { divineFont: 'healing' },
    );
    expect(result.met).toBe(true);
  });

  test('not met when the opposite font is selected', () => {
    const result = matchDivineFont(
      { type: 'divineFont', font: 'healing', text: 'healing font' },
      { divineFont: 'harmful' },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchBackground', () => {
  test('met when background matches required background', () => {
    const result = matchBackground(
      { type: 'background', slug: 'bright-lion', text: 'Bright Lion Background' },
      { backgroundSlug: 'bright-lion' },
    );
    expect(result.met).toBe(true);
  });

  test('not met when background does not match', () => {
    const result = matchBackground(
      { type: 'background', slug: 'bright-lion', text: 'Bright Lion Background' },
      { backgroundSlug: 'scholar' },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchHeritage', () => {
  test('met when heritage aliases contain the required heritage', () => {
    const result = matchHeritage(
      { type: 'heritage', slug: 'charhide-goblin', text: 'Charhide Goblin Heritage' },
      { heritageSlug: 'charhide-goblin', heritageAliases: new Set(['charhide-goblin', 'charhide-goblin-heritage']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met when heritage does not match', () => {
    const result = matchHeritage(
      { type: 'heritage', slug: 'charhide-goblin', text: 'Charhide Goblin Heritage' },
      { heritageSlug: 'snow-goblin', heritageAliases: new Set(['snow-goblin']) },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchProficiency', () => {
  test('met when proficiency rank is sufficient', () => {
    const result = matchProficiency(
      { type: 'proficiency', key: 'perception', minRank: 2, text: 'expert in Perception' },
      { proficiencies: { perception: 2 } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when proficiency is insufficient', () => {
    const result = matchProficiency(
      { type: 'proficiency', key: 'perception', minRank: 2, text: 'expert in Perception' },
      { proficiencies: { perception: 1 } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchClassHp', () => {
  test('meets class HP prerequisite when base class HP is within the threshold', () => {
    const result = matchClassHp(
      {
        type: 'classHp',
        comparator: 'lte',
        maxHp: 10,
        includesConModifier: true,
        text: 'Class granting no more Hit Points per level than 10 + your Constitution modifier',
      },
      {
        class: { slug: 'cleric', hp: 8 },
        attributes: { con: 3 },
      },
    );
    expect(result.met).toBe(true);
  });

  test('fails class HP prerequisite when base class HP exceeds the threshold', () => {
    const result = matchClassHp(
      {
        type: 'classHp',
        comparator: 'lte',
        maxHp: 10,
        includesConModifier: true,
        text: 'Class granting no more Hit Points per level than 10 + your Constitution modifier',
      },
      {
        class: { slug: 'barbarian', hp: 12 },
        attributes: { con: 2 },
      },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchDeityState', () => {
  test('meets exact deity prerequisite when selected deity matches', () => {
    const result = matchDeityState(
      { type: 'deityState', requiredDeity: 'achaekek', text: 'deity is Achaekek' },
      { deity: { slug: 'achaekek', name: 'Achaekek', domains: new Set() } },
    );
    expect(result.met).toBe(true);
  });

  test('fails exact deity prerequisite when selected deity differs', () => {
    const result = matchDeityState(
      { type: 'deityState', requiredDeity: 'achaekek', text: 'deity is Achaekek' },
      { deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set() } },
    );
    expect(result.met).toBe(false);
  });

  test('meets deity follower prerequisite when deity is present', () => {
    const result = matchDeityState(
      { type: 'deityState', requiresFollower: true, text: 'You follow a deity' },
      { deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire']) } },
    );
    expect(result.met).toBe(true);
  });

  test('fails deity follower prerequisite when deity is absent', () => {
    const result = matchDeityState(
      { type: 'deityState', requiresFollower: true, text: 'You follow a deity' },
      { deity: null },
    );
    expect(result.met).toBe(false);
  });

  test('meets deity domain prerequisite when deity has the required domain', () => {
    const result = matchDeityState(
      { type: 'deityState', requiresFollower: true, requiredDomain: 'fire', text: 'deity with the fire domain' },
      { deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire', 'sun']) } },
    );
    expect(result.met).toBe(true);
  });

  test('meets forbidden deity prerequisite when character does not worship that deity', () => {
    const result = matchDeityState(
      { type: 'deityState', forbiddenDeity: 'walkena', text: 'not a worshipper of Walkena' },
      { deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set() } },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchSpellcastingState', () => {
  test('meets focus pool prerequisite when actor has a focus pool', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', focusPool: true, text: 'Focus pool' },
      { spellcasting: { focusPool: true } },
    );
    expect(result.met).toBe(true);
  });

  test('fails focus pool prerequisite when actor has no focus pool', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', focusPool: true, text: 'Focus pool' },
      { spellcasting: { focusPool: false } },
    );
    expect(result.met).toBe(false);
  });

  test('meets focus-spell prerequisite when actor has a focus pool', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', focusPool: true, text: 'ability to cast focus spells' },
      { spellcasting: { focusPool: true } },
    );
    expect(result.met).toBe(true);
  });

  test('meets tradition prerequisite when actor can cast from that tradition', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', tradition: 'divine', text: 'ability to cast divine spells' },
      { spellcasting: { traditions: new Set(['divine']) } },
    );
    expect(result.met).toBe(true);
  });

  test('meets spell-slot prerequisite when actor has spell slots', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', spellSlots: true, text: 'ability to cast spells from spell slots' },
      { spellcasting: { hasSpellSlots: true } },
    );
    expect(result.met).toBe(true);
  });

  test('meets specific spell with slot prerequisite when actor has spell slots and knows the spell', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', spellSlots: true, spellSlug: 'animate-dead', text: 'able to cast animate dead with a spell slot' },
      { spellcasting: { hasSpellSlots: true, spellNames: new Set(['animate-dead']) } },
    );
    expect(result.met).toBe(true);
  });

  test('meets specific-cantrip prerequisite when actor knows the cantrip', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', spellSlug: 'shield', text: 'you can cast the shield cantrip' },
      { spellcasting: { spellNames: new Set(['shield']) } },
    );
    expect(result.met).toBe(true);
  });

  test('fails specific-cantrip prerequisite when actor does not know the cantrip', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', spellSlug: 'shield', text: 'you can cast the shield cantrip' },
      { spellcasting: { spellNames: new Set(['light']) } },
    );
    expect(result.met).toBe(false);
  });

  test('meets spell-trait prerequisite when actor can cast a matching spell trait', () => {
    const result = matchSpellcastingState(
      { type: 'spellcastingState', spellTrait: 'necromancy', text: 'able to cast at least one necromancy spell' },
      { spellcasting: { spellTraits: new Set(['necromancy', 'death']) } },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchClassIdentity', () => {
  test('meets subclass tradition prerequisite when subclass type and tradition match', () => {
    const result = matchClassIdentity(
      { type: 'classIdentity', subclassType: 'bloodline', tradition: 'divine', text: 'bloodline that grants divine spells' },
      {
        class: { subclassType: 'bloodline' },
        spellcasting: { traditions: new Set(['divine']) },
      },
    );
    expect(result.met).toBe(true);
  });

  test('fails subclass tradition prerequisite when subclass type mismatches', () => {
    const result = matchClassIdentity(
      { type: 'classIdentity', subclassType: 'bloodline', tradition: 'divine', text: 'bloodline that grants divine spells' },
      {
        class: { subclassType: 'mystery' },
        spellcasting: { traditions: new Set(['divine']) },
      },
    );
    expect(result.met).toBe(false);
  });

  test('meets subclass tradition prerequisite from the secondary dual class', () => {
    const result = matchClassIdentity(
      { type: 'classIdentity', subclassType: 'school', tradition: 'arcane', text: 'school that grants arcane spells' },
      {
        class: { subclassType: 'research field', traditions: new Set() },
        classes: [
          { subclassType: 'research field', traditions: new Set() },
          { subclassType: 'school', traditions: new Set(['arcane']) },
        ],
        spellcasting: { traditions: new Set(['arcane']) },
      },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchEquipmentState', () => {
  test('meets shield prerequisite when shield is equipped', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', shield: true, text: 'wielding a shield' },
      { equipment: { hasShield: true } },
    );
    expect(result.met).toBe(true);
  });

  test('meets armor prerequisite when one matching category is equipped', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', armorCategories: ['medium', 'heavy'], text: 'wearing medium or heavy armor' },
      { equipment: { armorCategories: new Set(['medium']) } },
    );
    expect(result.met).toBe(true);
  });

  test('meets ranged weapon prerequisite when a ranged weapon is wielded', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', weaponUsage: 'ranged', text: 'wielding a ranged weapon' },
      { equipment: { wieldedRanged: true, wieldedMelee: false } },
    );
    expect(result.met).toBe(true);
  });

  test('fails weapon category prerequisite when no matching weapon is wielded', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', weaponCategories: ['martial'], text: 'wielding a martial weapon' },
      { equipment: { weaponCategories: new Set(['simple']) } },
    );
    expect(result.met).toBe(false);
  });

  test('meets weapon group prerequisite when matching group is wielded', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', weaponGroups: ['sword'], text: 'wielding a weapon in the sword group' },
      { equipment: { weaponGroups: new Set(['sword']) } },
    );
    expect(result.met).toBe(true);
  });

  test('meets weapon trait prerequisite when matching trait is wielded', () => {
    const result = matchEquipmentState(
      { type: 'equipmentState', weaponTraits: ['sweep'], text: 'wielding a weapon with the sweep trait' },
      { equipment: { weaponTraits: new Set(['sweep']) } },
    );
    expect(result.met).toBe(true);
  });
});

describe('matchSubclassSpell', () => {
  test('met when character has matching subclass type and focus pool', () => {
    const result = matchSubclassSpell(
      { type: 'subclassSpell', subclassType: 'bloodline', text: 'bloodline spell' },
      { class: { subclassType: 'bloodline' }, spellcasting: { focusPool: true } },
    );
    expect(result.met).toBe(true);
  });

  test('not met when subclass type does not match', () => {
    const result = matchSubclassSpell(
      { type: 'subclassSpell', subclassType: 'bloodline', text: 'bloodline spell' },
      { class: { subclassType: 'mystery' }, spellcasting: { focusPool: true } },
    );
    expect(result.met).toBe(false);
  });

  test('not met when character has no focus pool', () => {
    const result = matchSubclassSpell(
      { type: 'subclassSpell', subclassType: 'bloodline', text: 'bloodline spell' },
      { class: { subclassType: 'bloodline' }, spellcasting: { focusPool: false } },
    );
    expect(result.met).toBe(false);
  });
});

describe('matchUnknown', () => {
  test('returns null met value', () => {
    const result = matchUnknown({ type: 'unknown', text: 'something weird' });
    expect(result.met).toBeNull();
  });
});

describe('matchAncestryFeatAccess', () => {
  test('met when adopted ancestry is in build state feats', () => {
    const result = matchAncestryFeatAccess(
      {
        type: 'ancestryFeatAccess',
        multipleAncestries: true,
        text: 'Ability to select ancestry feats from multiple ancestries',
      },
      { feats: new Set(['adopted-ancestry']) },
    );
    expect(result.met).toBe(true);
  });

  test('not met without multi-ancestry feat access', () => {
    const result = matchAncestryFeatAccess(
      {
        type: 'ancestryFeatAccess',
        multipleAncestries: true,
        text: 'Ability to select ancestry feats from multiple ancestries',
      },
      { feats: new Set(['natural-ambition']) },
    );
    expect(result.met).toBe(false);
  });
});
