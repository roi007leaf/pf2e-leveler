import { checkPrerequisites } from '../../../scripts/prerequisites/prerequisite-checker.js';

describe('checkPrerequisites', () => {
  const buildState = {
    level: 5,
    class: { slug: 'alchemist', hp: 8 },
    backgroundSlug: 'bright-lion',
    heritageSlug: 'charhide-goblin',
    heritageAliases: new Set(['charhide-goblin', 'charhide-goblin-heritage']),
    deity: null,
    spellcasting: {
      hasAny: false,
      hasSpellSlots: false,
      spellNames: new Set(),
      spellTraits: new Set(),
      traditions: new Set(),
      focusPool: false,
      focusPointsMax: 0,
    },
    attributes: { str: 2, dex: 1, con: 1, int: 3, wis: 0, cha: 0 },
    skills: { athletics: 2, crafting: 1, stealth: 0 },
    languages: new Set(['common', 'osiriani', 'sphinx']),
    lores: { 'underworld-lore': 1 },
    feats: new Set(['quick-bomber', 'alchemical-crafting']),
    classFeatures: new Set(['alchemy', 'research-field']),
    proficiencies: { perception: 1, classDC: 1, fortitude: 2 },
    equipment: {
      hasShield: true,
      armorCategories: new Set(['medium']),
      weaponCategories: new Set(['simple']),
      weaponGroups: new Set(['club']),
      weaponTraits: new Set(['sweep']),
      wieldedMelee: true,
      wieldedRanged: false,
    },
  };

  test('feat with no prerequisites is met', () => {
    const feat = { system: { prerequisites: { value: [] } } };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  test('feat with met skill prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'trained in Athletics' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('uses raw source prerequisite text when translated system text is not parseable', () => {
    const feat = {
      _source: {
        system: {
          prerequisites: {
            value: [{ value: 'trained in Arcana, Nature, Occultism, or Religion' }],
          },
        },
      },
      system: {
        prerequisites: {
          value: [{ value: 'qualifié en Arcanes, Nature, Occultisme ou Religion' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      skills: { ...buildState.skills, arcana: 3 },
    });
    expect(result.met).toBe(true);
    expect(result.results.some((entry) => entry.met === true)).toBe(true);
  });

  test('meets French-only translated skill prerequisites when actor has matching skill', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'qualifi\u00e9 en Arcanes, Nature, Occultisme ou Religion' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      skills: { ...buildState.skills, arcana: 3 },
    });
    expect(result.met).toBe(true);
    expect(result.results.some((entry) => entry.met === true)).toBe(true);
  });

  test('feat with met generic any-skill prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'trained in at least one skill' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('feat with unmet skill prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'expert in Stealth' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].met).toBe(false);
  });

  test('feat with met feat prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Quick Bomber' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('feat with unmet feat prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Power Attack' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });

  test('feat with met ability prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Strength 14' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('feat with unmet ability prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Charisma 16' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });

  test('feat with multiple prerequisites (all met)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in Athletics' }, { value: 'Quick Bomber' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  test('feat with multiple prerequisites (one unmet)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in Athletics' }, { value: 'Power Attack' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].met).toBe(true);
    expect(result.results[1].met).toBe(false);
  });

  test('unrecognized text is treated as feat prerequisite (slug match)', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Some Obscure Requirement' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].text).toBe('Some Obscure Requirement');
  });

  test('matches feat prerequisites against parenthetical feat aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Efficient Alchemy' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['efficient-alchemy-alchemist', 'efficient-alchemy']),
    });
    expect(result.met).toBe(true);
  });

  test('matches feat prerequisites against a feat and its selected choice alias', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Order Explorer (Wave Order)' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['order-explorer', 'wave-order']),
    });
    expect(result.met).toBe(true);
  });

  test('matches English bard muse feat prerequisites against subclass aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Maestro (Bard Muse)' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['maestro-muse']),
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        met: true,
        text: 'Maestro (Bard Muse)',
      }),
    );
  });

  test('matches plain English bard muse feat prerequisites when build state includes subclass alias', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'maestro muse' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['maestro', 'maestro-muse']),
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        met: true,
        text: 'maestro muse',
      }),
    );
  });

  test('matches French bard muse feat prerequisites against subclass aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Virtuose (muse de barde)' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['virtuose-muse']),
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        met: true,
        text: 'Virtuose (muse de barde)',
      }),
    );
  });

  test('matches prefixed English bard muse feat prerequisites against subclass aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Muse Maestro' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['maestro-muse']),
    });
    expect(result.met).toBe(true);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        met: true,
        text: 'Muse Maestro',
      }),
    );
  });

  test('matches generic French bard muse prerequisites from bard subclass identity', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Muse de barde' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      classes: [{ slug: 'bard', subclassType: 'muse', traditions: new Set(['occult']) }],
    });
    expect(result.met).toBe(true);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        met: true,
        text: 'Muse de barde',
      }),
    );
  });

  test('meets class-or-dedication prerequisites from the base class identity', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Guardian or Sentinel Dedication' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      class: { slug: 'guardian', hp: 10 },
      feats: new Set(),
    });
    expect(result.met).toBe(true);
  });

  test('applies trailing dedication suffix across comma-or feat alternatives', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Acrobat, Celebrity, Dandy, or Gladiator Dedication' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['acrobat-dedication']),
    });
    expect(result.met).toBe(true);
  });

  test('requires the shared skill after dedication alternatives', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Celebrity Dedication or Dandy Dedication, trained in Deception' }],
        },
      },
    };

    expect(checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['dandy-dedication']),
      skills: { ...buildState.skills, deception: 1 },
    }).met).toBe(true);

    expect(checkPrerequisites(feat, {
      ...buildState,
      feats: new Set(['celebrity-dedication']),
      skills: { ...buildState.skills, deception: 0 },
    }).met).toBe(false);
  });

  test('meets multi-ancestry feat access prerequisites via adopted ancestry', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Ability to select ancestry feats from multiple ancestries' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      feats: new Set([...buildState.feats, 'adopted-ancestry']),
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('met level prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: '4th level' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('unmet level prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: '8th level' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
  });

  test('met perception proficiency prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'expert in Perception' }] } },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      proficiencies: { ...buildState.proficiencies, perception: 2 },
    });
    expect(result.met).toBe(true);
  });

  test('met class dc proficiency prerequisite', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'trained in Class DC' }] } },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('meets plural save proficiency prerequisite wording', () => {
    const feat = {
      system: { prerequisites: { value: [{ value: 'Expert in Reflex Saves' }] } },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      proficiencies: { ...buildState.proficiencies, reflex: 2 },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets class HP prerequisite for lower-HP classes', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            {
              value:
                'Class granting no more Hit Points per level than 10 + your Constitution modifier',
            },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      class: { slug: 'cleric', hp: 8 },
      attributes: { ...buildState.attributes, con: 2 },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets deity follower prerequisite when a deity is selected', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'You follow a deity' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire']) },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets exact deity prerequisite when selected deity matches', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'deity is Achaekek' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      deity: { slug: 'achaekek', name: 'Achaekek', domains: new Set() },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets deity domain prerequisite when selected deity has the domain', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'deity with the fire domain' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire', 'sun']) },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets forbidden deity prerequisite when character does not worship that deity', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'not a worshipper of Walkena' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire']) },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets focus pool prerequisite when actor has a focus pool', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Focus pool' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: false,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['occult']),
        focusPool: true,
        focusPointsMax: 1,
      },
    });
    expect(result.met).toBe(true);
  });

  test('meets focus-spell prerequisite when actor has a focus pool', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'ability to cast focus spells' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: false,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['occult']),
        focusPool: true,
        focusPointsMax: 1,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets healing font prerequisite when healing font is selected', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'healing font' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      divineFont: 'healing',
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets direct spellcasting tradition prerequisite when tradition matches', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'ability to cast divine spells' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['divine']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets spell-slot casting prerequisite when actor has spell slots', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'ability to cast spells from spell slots' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['occult']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets specific spell-with-slot prerequisite when actor has spell slots and knows the spell', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'able to cast animate dead with a spell slot' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(['animate-dead']),
        spellTraits: new Set(['necromancy']),
        traditions: new Set(['divine']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets spell-slot casting prerequisite with using-slots wording when actor has spell slots', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'able to cast spells using spell slots' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['occult']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets spell-trait casting prerequisite when actor can cast a matching spell trait', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'able to cast at least one necromancy spell' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(['necromancy']),
        traditions: new Set(['divine']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets charisma-or-spell-slot prerequisite when spell slots satisfy the alternative', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Charisma +2 or ability to cast spells from spell slots' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      attributes: { ...buildState.attributes, cha: 0 },
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['occult']),
        focusPool: false,
        focusPointsMax: 0,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  test('meets subclass tradition prerequisite when class context matches', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'bloodline that grants divine spells' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      class: { slug: 'sorcerer', hp: 6, subclassType: 'bloodline' },
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['divine']),
        focusPool: true,
        focusPointsMax: 1,
      },
    });
    expect(result.met).toBe(true);
  });

  test('meets subclass spell-list prerequisite wording when class context matches', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'bloodline with the arcane spell list' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      class: { slug: 'sorcerer', hp: 6, subclassType: 'bloodline' },
      spellcasting: {
        hasAny: true,
        hasSpellSlots: true,
        spellNames: new Set(),
        spellTraits: new Set(),
        traditions: new Set(['arcane']),
        focusPool: true,
        focusPointsMax: 1,
      },
    });
    expect(result.met).toBe(true);
  });

  test('meets lore prerequisite when trained in matching lore', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in Underworld Lore' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets language prerequisite when all required languages are known', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Ancient Osiriani and Sphinx languages' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets shield prerequisite when shield is equipped', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'wielding a shield' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('meets armor prerequisite when one allowed armor category is equipped', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'wearing medium or heavy armor' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('fails ranged weapon prerequisite when only melee weapon is wielded', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'wielding a ranged weapon' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results[0].met).toBe(false);
  });

  test('meets weapon group prerequisite when matching weapon group is wielded', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'wielding a weapon in the sword group' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      equipment: {
        ...buildState.equipment,
        weaponGroups: new Set(['sword']),
      },
    });
    expect(result.met).toBe(true);
  });

  test('meets weapon trait prerequisite when matching weapon trait is wielded', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'wielding a weapon with the sweep trait' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
  });

  test('meets class feature prerequisite when class feature is present', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Rage class feature' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      classFeatures: new Set(['rage', 'mighty-rage']),
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets linked granted class feature prerequisite aliases', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Intercept Attack class feature' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      classFeatures: new Set(['guardians-techniques', 'intercept-attack']),
    });
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets background prerequisite when matching background is selected', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Bright Lion Background' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('meets heritage prerequisite when matching heritage is selected', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Charhide Goblin Heritage' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results[0].met).toBe(true);
  });

  test('requires all semicolon-separated prerequisites to be met', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Quick Bomber; 8th level' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].met).toBe(true);
    expect(result.results[1].met).toBe(false);
  });

  test('treats or-separated prerequisites as alternatives', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in Athletics or trained in Stealth' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  test('requires Diplomacy and one of several listed skills for as-well-as-either phrasing', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            {
              value:
                'trained in Diplomacy as well as either Arcana, Nature, Occultism, or Religion',
            },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      skills: {
        ...buildState.skills,
        diplomacy: 1,
        religion: 1,
      },
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(5);
    expect(result.results[0].met).toBe(true);
  });

  test('allows either listed language to satisfy a language alternative prerequisite', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Erutaki or Jotun language' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      languages: new Set(['common', 'jotun']),
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  test('treats unsupported negative companion prerequisite text as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            {
              value:
                "you don't have an animal companion, construct companion, or other companion that functions similarly",
            },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('treats narrative attendance prerequisites as unverified while still checking mechanical prerequisites', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            { value: 'trained in Medicine' },
            { value: 'attended the University of Lepidstadt' },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      skills: { ...buildState.skills, medicine: 1 },
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].met).toBe(true);
    expect(result.results[1].met).toBeNull();
  });

  test('treats narrative death-history prerequisites as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'you are dead and were mummified (by natural or ritualistic means)' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('treats saumen-kar trust/initiation prerequisites as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [
            {
              value:
                'must have earned the trust of a saumen kar who initiates you into the archetype',
            },
          ],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('meets action-capability any-skill prerequisites when any skill is trained', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in at least one skill to Decipher Writing' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBe(true);
  });

  test('meets Recall Knowledge skill prerequisites when trained in an applicable skill', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'Trained in a skill with the Recall Knowledge action' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBe(true);
  });

  test('treats weapon-type proficiency prerequisites as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in at least one type of one-handed firearm' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('meets crossbow proficiency prerequisites from simple weapon proficiency', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in at least one crossbow' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      weaponProficiencies: { simple: 1 },
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBe(true);
  });

  test('treats weapon-name proficiency prerequisites as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'trained in sawtooth sabres' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('treats Red Mantis membership prerequisites as unverified instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'member of the Red Mantis assassins' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('treats alignment prerequisites as unverified legacy text instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'evil alignment' }, { value: 'trained in Religion' }],
        },
      },
    };
    const result = checkPrerequisites(feat, {
      ...buildState,
      skills: { ...buildState.skills, religion: 1 },
    });
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].met).toBeNull();
    expect(result.results[1].met).toBe(true);
  });

  test('treats curse-state prerequisites as a single unverified clause instead of mixed false and unknown results', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'You are cursed or have previously been cursed.' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('treats age prerequisites as unverified legacy text instead of unmet', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'At Least 100 Years Old' }],
        },
      },
    };
    const result = checkPrerequisites(feat, buildState);
    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBeNull();
  });

  test('meets living creature prerequisite when actor is not construct or undead', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'You are a living creature' }],
        },
      },
    };

    const result = checkPrerequisites(feat, {
      ...buildState,
      ancestryTraits: new Set(['human', 'humanoid']),
    });

    expect(result.met).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].met).toBe(true);
  });

  test('fails living creature prerequisite for construct or undead actors', () => {
    const feat = {
      system: {
        prerequisites: {
          value: [{ value: 'You are a living creature' }],
        },
      },
    };

    const constructResult = checkPrerequisites(feat, {
      ...buildState,
      ancestryTraits: new Set(['construct']),
    });
    const undeadResult = checkPrerequisites(feat, {
      ...buildState,
      ancestryTraits: new Set(['undead']),
    });

    expect(constructResult.met).toBe(false);
    expect(constructResult.results[0].met).toBe(false);
    expect(undeadResult.met).toBe(false);
    expect(undeadResult.results[0].met).toBe(false);
  });
});
