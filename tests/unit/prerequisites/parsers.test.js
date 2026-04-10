import { parsePrerequisite, parsePrerequisiteNode, parseAllPrerequisites, parseAllPrerequisiteNodes } from '../../../scripts/prerequisites/parsers.js';

describe('parsePrerequisite', () => {
  test('parses skill rank requirement', () => {
    const result = parsePrerequisite('trained in Athletics');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('athletics');
    expect(result.minRank).toBe(1);
  });

  test('parses expert rank requirement', () => {
    const result = parsePrerequisite('expert in Stealth');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('stealth');
    expect(result.minRank).toBe(2);
  });

  test('parses generic any-skill requirement', () => {
    const result = parsePrerequisite('trained in at least one skill');
    expect(result.type).toBe('anySkill');
    expect(result.minRank).toBe(1);
  });

  test('parses master rank requirement', () => {
    const result = parsePrerequisite('master in Deception');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('deception');
    expect(result.minRank).toBe(3);
  });

  test('parses legendary rank requirement', () => {
    const result = parsePrerequisite('legendary in Crafting');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('crafting');
    expect(result.minRank).toBe(4);
  });

  test('parses proficiency in non-skill subject', () => {
    const result = parsePrerequisite('expert in Perception');
    expect(result.type).toBe('proficiency');
    expect(result.key).toBe('perception');
    expect(result.minRank).toBe(2);
  });

  test('parses class dc proficiency requirement', () => {
    const result = parsePrerequisite('expert in Class DC');
    expect(result.type).toBe('proficiency');
    expect(result.key).toBe('classdc');
    expect(result.minRank).toBe(2);
  });

  test('parses save proficiency requirement with trailing clause', () => {
    const result = parsePrerequisite('master in Fortitude, expert in Reflex');
    expect(result.type).toBe('proficiency');
    expect(result.key).toBe('fortitude');
    expect(result.minRank).toBe(3);
  });

  test('parses ability score requirement', () => {
    const result = parsePrerequisite('Strength 14');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('str');
    expect(result.minValue).toBe(14);
  });

  test('parses dexterity requirement', () => {
    const result = parsePrerequisite('Dexterity 16');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('dex');
    expect(result.minValue).toBe(16);
    expect(result.isModifier).toBe(false);
  });

  test('parses ability modifier requirement with plus sign', () => {
    const result = parsePrerequisite('Dexterity +2');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('dex');
    expect(result.minValue).toBe(2);
    expect(result.isModifier).toBe(true);
  });

  test('parses ability modifier requirement with minus sign', () => {
    const result = parsePrerequisite('Constitution -1');
    expect(result.type).toBe('ability');
    expect(result.ability).toBe('con');
    expect(result.minValue).toBe(-1);
    expect(result.isModifier).toBe(true);
  });

  test('parses level requirement', () => {
    const result = parsePrerequisite('4th level');
    expect(result.type).toBe('level');
    expect(result.minLevel).toBe(4);
  });

  test('parses class HP prerequisite with Constitution modifier text', () => {
    const result = parsePrerequisite('Class granting no more Hit Points per level than 10 + your Constitution modifier');
    expect(result.type).toBe('classHp');
    expect(result.comparator).toBe('lte');
    expect(result.maxHp).toBe(10);
    expect(result.includesConModifier).toBe(true);
  });

  test('parses deity follower prerequisite', () => {
    const result = parsePrerequisite('You follow a deity');
    expect(result.type).toBe('deityState');
    expect(result.requiresFollower).toBe(true);
  });

  test('parses exact deity prerequisite', () => {
    const result = parsePrerequisite('deity is Achaekek');
    expect(result.type).toBe('deityState');
    expect(result.requiredDeity).toBe('achaekek');
  });

  test('parses deity domain prerequisite', () => {
    const result = parsePrerequisite('deity with the fire domain');
    expect(result.type).toBe('deityState');
    expect(result.requiredDomain).toBe('fire');
  });

  test('parses forbidden deity prerequisite', () => {
    const result = parsePrerequisite('not a worshipper of Walkena');
    expect(result.type).toBe('deityState');
    expect(result.forbiddenDeity).toBe('walkena');
  });

  test('parses focus pool prerequisite', () => {
    const result = parsePrerequisite('Focus pool');
    expect(result.type).toBe('spellcastingState');
    expect(result.focusPool).toBe(true);
  });

  test('parses focus-spell casting prerequisite', () => {
    const result = parsePrerequisite('ability to cast focus spells');
    expect(result.type).toBe('spellcastingState');
    expect(result.focusPool).toBe(true);
  });

  test('parses direct spellcasting tradition prerequisite', () => {
    const result = parsePrerequisite('ability to cast divine spells');
    expect(result.type).toBe('spellcastingState');
    expect(result.tradition).toBe('divine');
  });

  test('parses spell-slot casting prerequisite', () => {
    const result = parsePrerequisite('ability to cast spells from spell slots');
    expect(result.type).toBe('spellcastingState');
    expect(result.spellSlots).toBe(true);
  });

  test('parses spell-slot casting prerequisite wording variant', () => {
    const result = parsePrerequisite('able to cast spells using spell slots');
    expect(result.type).toBe('spellcastingState');
    expect(result.spellSlots).toBe(true);
  });

  test('parses specific spell with spell-slot prerequisite', () => {
    const result = parsePrerequisite('able to cast animate dead with a spell slot');
    expect(result.type).toBe('spellcastingState');
    expect(result.spellSlots).toBe(true);
    expect(result.spellSlug).toBe('animate-dead');
  });

  test('parses spell-trait casting prerequisite', () => {
    const result = parsePrerequisite('able to cast at least one necromancy spell');
    expect(result.type).toBe('spellcastingState');
    expect(result.spellTrait).toBe('necromancy');
  });

  test('parses subclass tradition prerequisite', () => {
    const result = parsePrerequisite('bloodline that grants divine spells');
    expect(result.type).toBe('classIdentity');
    expect(result.subclassType).toBe('bloodline');
    expect(result.tradition).toBe('divine');
  });

  test('parses lore rank requirement', () => {
    const result = parsePrerequisite('trained in Underworld Lore');
    expect(result.type).toBe('lore');
    expect(result.loreSlug).toBe('underworld-lore');
    expect(result.minRank).toBe(1);
  });

  test('parses language prerequisite with Ancient Osiriani normalization', () => {
    const result = parsePrerequisite('Ancient Osiriani and Sphinx languages');
    expect(result.type).toBe('language');
    expect(result.languages).toEqual(['osiriani', 'sphinx']);
  });

  test('parses shield equipment prerequisite', () => {
    const result = parsePrerequisite('wielding a shield');
    expect(result.type).toBe('equipmentState');
    expect(result.shield).toBe(true);
  });

  test('parses armor equipment prerequisite with alternatives', () => {
    const result = parsePrerequisite('wearing medium or heavy armor');
    expect(result.type).toBe('equipmentState');
    expect(result.armorCategories).toEqual(['medium', 'heavy']);
  });

  test('parses melee weapon prerequisite', () => {
    const result = parsePrerequisite('wielding a melee weapon');
    expect(result.type).toBe('equipmentState');
    expect(result.weaponUsage).toBe('melee');
  });

  test('parses weapon category prerequisite with alternatives', () => {
    const result = parsePrerequisite('wielding a simple or martial weapon');
    expect(result.type).toBe('equipmentState');
    expect(result.weaponCategories).toEqual(['simple', 'martial']);
  });

  test('parses weapon group prerequisite', () => {
    const result = parsePrerequisite('wielding a weapon in the sword group');
    expect(result.type).toBe('equipmentState');
    expect(result.weaponGroups).toEqual(['sword']);
  });

  test('parses weapon trait prerequisite', () => {
    const result = parsePrerequisite('wielding a weapon with the sweep trait');
    expect(result.type).toBe('equipmentState');
    expect(result.weaponTraits).toEqual(['sweep']);
  });

  test('parses class feature prerequisite', () => {
    const result = parsePrerequisite('Rage class feature');
    expect(result.type).toBe('classFeature');
    expect(result.slug).toBe('rage');
  });

  test('parses background prerequisite', () => {
    const result = parsePrerequisite('Bright Lion Background');
    expect(result.type).toBe('background');
    expect(result.slug).toBe('bright-lion');
  });

  test('parses heritage prerequisite', () => {
    const result = parsePrerequisite('Charhide Goblin Heritage');
    expect(result.type).toBe('heritage');
    expect(result.slug).toBe('charhide-goblin');
  });

  test('parses requirements with trailing parenthetical clarifier', () => {
    const result = parsePrerequisite('trained in Religion (or another skill associated with your deity)');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('religion');
  });

  test('parses various level ordinals', () => {
    expect(parsePrerequisite('1st level').minLevel).toBe(1);
    expect(parsePrerequisite('2nd level').minLevel).toBe(2);
    expect(parsePrerequisite('3rd level').minLevel).toBe(3);
    expect(parsePrerequisite('12th level').minLevel).toBe(12);
  });

  test('parses feat prerequisite', () => {
    const result = parsePrerequisite('Fighter Dedication');
    expect(result.type).toBe('feat');
    expect(result.slug).toBe('fighter-dedication');
  });

  test('parses feat with apostrophe', () => {
    const result = parsePrerequisite("Alchemist's Fire");
    expect(result.type).toBe('feat');
    expect(result.slug).toBe('alchemists-fire');
  });

  test('returns unknown for empty input', () => {
    const result = parsePrerequisite('');
    expect(result.type).toBe('unknown');
  });

  test('returns unknown for null input', () => {
    const result = parsePrerequisite(null);
    expect(result.type).toBe('unknown');
  });

  test('treats descriptive sentence prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('Class granting no more Hit Points per level than your Constitution modifier.');
    expect(result.type).toBe('unknown');
  });

  test('treats narrative membership prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('member of the Knights of Lastwall');
    expect(result.type).toBe('unknown');
  });

  test('treats Red Mantis membership prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('member of the Red Mantis assassins');
    expect(result.type).toBe('unknown');
  });

  test('treats narrative attendance prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('attended the University of Lepidstadt');
    expect(result.type).toBe('unknown');
  });

  test('treats narrative death-history prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('you are dead and were mummified (by natural or ritualistic means)');
    expect(result.type).toBe('unknown');
  });

  test('treats narrative initiation prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite('must have earned the trust of a saumen kar who initiates you into the archetype');
    expect(result.type).toBe('unknown');
  });

  test('parses action-capability any-skill prerequisites as generic any-skill requirements', () => {
    const result = parsePrerequisite('trained in at least one skill to Decipher Writing');
    expect(result.type).toBe('anySkill');
    expect(result.minRank).toBe(1);
  });

  test('treats weapon-type proficiency prerequisites as unknown instead of fake proficiency keys', () => {
    const result = parsePrerequisite('trained in at least one type of one-handed firearm');
    expect(result.type).toBe('unknown');
  });

  test('parses weapon-family proficiency prerequisites like crossbows', () => {
    const result = parsePrerequisite('trained in at least one crossbow');
    expect(result.type).toBe('weaponFamilyProficiency');
    expect(result.family).toBe('crossbow');
    expect(result.minRank).toBe(1);
  });

  test('treats weapon-name proficiency prerequisites as unknown instead of fake proficiency keys', () => {
    const result = parsePrerequisite('trained in sawtooth sabres');
    expect(result.type).toBe('unknown');
  });

  test('treats negative companion prerequisites as unknown instead of feat slugs', () => {
    const result = parsePrerequisite("you don't have an animal companion, construct companion, or other companion that functions similarly");
    expect(result.type).toBe('unknown');
  });

  test('treats alignment prerequisites as unknown legacy text', () => {
    const result = parsePrerequisite('evil alignment');
    expect(result.type).toBe('unknown');
  });

  test('treats curse-state prerequisites as unknown legacy text', () => {
    const result = parsePrerequisite('You are cursed or have previously been cursed.');
    expect(result.type).toBe('unknown');
  });

  test('keeps narrative membership prerequisites with internal or wording as a single unknown node', () => {
    const result = parsePrerequisiteNode('You are or were a crew member of the Nightwave');
    expect(result).toEqual(expect.objectContaining({
      kind: 'leaf',
      type: 'unknown',
      text: 'You are or were a crew member of the Nightwave',
    }));
  });

  test('treats signature trick prerequisites as unknown legacy text', () => {
    const result = parsePrerequisite('You Must Have A Signature Trick');
    expect(result.type).toBe('unknown');
  });

  test('treats multi-ancestry feat selection prerequisites as unknown legacy text', () => {
    const result = parsePrerequisite('Ability To Select Ancestry Feats From Multiple Ancestries');
    expect(result.type).toBe('unknown');
  });
});

describe('parseAllPrerequisites', () => {
  test('parses all prerequisites from a feat', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'trained in Athletics' },
            { value: 'Strength 14' },
          ],
        },
      },
    };
    const results = parseAllPrerequisites(feat);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('skill');
    expect(results[1].type).toBe('ability');
  });

  test('returns empty array for feat without prerequisites', () => {
    const feat = { system: { prerequisites: { value: [] } } };
    expect(parseAllPrerequisites(feat)).toEqual([]);
  });

  test('returns empty array for null feat', () => {
    expect(parseAllPrerequisites(null)).toEqual([]);
  });
});

describe('parsePrerequisiteNode', () => {
  test('wraps a simple prerequisite as a leaf node', () => {
    const result = parsePrerequisiteNode('trained in Athletics');
    expect(result).toEqual(expect.objectContaining({
      kind: 'leaf',
      type: 'skill',
      skill: 'athletics',
    }));
  });

  test('parses generic any-skill requirement as a leaf node', () => {
    const result = parsePrerequisiteNode('trained in at least one skill');
    expect(result).toEqual(expect.objectContaining({
      kind: 'leaf',
      type: 'anySkill',
      minRank: 1,
    }));
  });

  test('parses feat prerequisites with selected parenthetical choice as an all node', () => {
    const result = parsePrerequisiteNode('Order Explorer (Wave Order)');
    expect(result.kind).toBe('all');
    expect(result.children).toEqual([
      expect.objectContaining({ kind: 'leaf', type: 'feat', slug: 'order-explorer' }),
      expect.objectContaining({ kind: 'leaf', type: 'feat', slug: 'wave-order' }),
    ]);
  });

  test('parses semicolon-separated prerequisites as an all node', () => {
    const result = parsePrerequisiteNode('Champion Dedication; 4th level');
    expect(result.kind).toBe('all');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'feat' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'level' }));
  });

  test('parses or-separated prerequisites as an any node', () => {
    const result = parsePrerequisiteNode('trained in Arcana or trained in Religion');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'arcana' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'religion' }));
  });

  test('parses trained-in-x-as-well-as-either-y-z wording as a composite node', () => {
    const result = parsePrerequisiteNode('trained in Diplomacy as well as either Arcana, Nature, Occultism, or Religion');
    expect(result.kind).toBe('all');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'diplomacy' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'any' }));
    expect(result.children[1].children).toHaveLength(4);
    expect(result.children[1].children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'arcana' }));
    expect(result.children[1].children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'nature' }));
    expect(result.children[1].children[2]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'occultism' }));
    expect(result.children[1].children[3]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'religion' }));
  });

  test('parses language or-language wording as an any node', () => {
    const result = parsePrerequisiteNode('Erutaki or Jotun language');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'language', languages: ['erutaki'] }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'language', languages: ['jotun'] }));
  });

  test('parses mixed ability or spell-slot prerequisites as alternatives', () => {
    const result = parsePrerequisiteNode('Charisma +2 or ability to cast spells from spell slots');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'ability', ability: 'cha' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'spellcastingState', spellSlots: true }));
  });

  test('parses mixed ability or spell-slot prerequisites with using-slots wording as alternatives', () => {
    const result = parsePrerequisiteNode('Charisma +2 or able to cast spells using spell slots');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'ability', ability: 'cha' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'spellcastingState', spellSlots: true }));
  });

  test('parses "trained in Arcana, Nature, Occultism, or Religion" as any-of-skills node', () => {
    const result = parsePrerequisiteNode('trained in Arcana, Nature, Occultism, or Religion');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(4);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'arcana' }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'nature' }));
    expect(result.children[2]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'occultism' }));
    expect(result.children[3]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'religion' }));
  });

  test('parses "expert in Athletics or Acrobatics" as any-of-skills node', () => {
    const result = parsePrerequisiteNode('expert in Athletics or Acrobatics');
    expect(result.kind).toBe('any');
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'athletics', minRank: 2 }));
    expect(result.children[1]).toEqual(expect.objectContaining({ kind: 'leaf', type: 'skill', skill: 'acrobatics', minRank: 2 }));
  });

  test('does not expand rank-with-alternatives when subjects contain parenthetical', () => {
    const result = parsePrerequisiteNode('trained in Religion (or another skill associated with your deity)');
    expect(result.kind).toBe('leaf');
    expect(result.type).toBe('skill');
    expect(result.skill).toBe('religion');
  });

  test('parses "bloodline spell" as subclass spell prerequisite', () => {
    const result = parsePrerequisiteNode('bloodline spell');
    expect(result.kind).toBe('leaf');
    expect(result.type).toBe('subclassSpell');
    expect(result.subclassType).toBe('bloodline');
  });

  test('parses "a mystery spell" as subclass spell prerequisite', () => {
    const result = parsePrerequisiteNode('a mystery spell');
    expect(result.kind).toBe('leaf');
    expect(result.type).toBe('subclassSpell');
    expect(result.subclassType).toBe('mystery');
  });

  test('does not split unsupported companion prohibition text into fake or alternatives', () => {
    const result = parsePrerequisiteNode("you don't have an animal companion, construct companion, or other companion that functions similarly");
    expect(result.kind).toBe('leaf');
    expect(result.type).toBe('unknown');
  });

  test('does not split curse-state text into fake or alternatives', () => {
    const result = parsePrerequisiteNode('You are cursed or have previously been cursed.');
    expect(result.kind).toBe('leaf');
    expect(result.type).toBe('unknown');
  });
});

describe('parseAllPrerequisiteNodes', () => {
  test('parses feat prerequisites into AST nodes', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'Champion Dedication; 4th level' },
          ],
        },
      },
    };

    const results = parseAllPrerequisiteNodes(feat);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('all');
  });
});
