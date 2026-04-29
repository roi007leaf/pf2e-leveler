import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { DRUID } from '../../../scripts/classes/druid.js';
import { FIGHTER } from '../../../scripts/classes/fighter.js';
import { GUARDIAN } from '../../../scripts/classes/guardian.js';
import { INVESTIGATOR } from '../../../scripts/classes/investigator.js';
import { ROGUE } from '../../../scripts/classes/rogue.js';
import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { WIZARD } from '../../../scripts/classes/wizard.js';
import {
  MIXED_ANCESTRY_CHOICE_FLAG,
  MIXED_ANCESTRY_UUID,
  PROFICIENCY_RANKS,
} from '../../../scripts/constants.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import {
  createPlan,
  setLevelBoosts,
  setLevelFeat,
  setLevelSkillIncrease,
  toggleLevelIntBonusSkill,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
  ClassRegistry.register(DRUID);
  ClassRegistry.register(FIGHTER);
  ClassRegistry.register(GUARDIAN);
  ClassRegistry.register(INVESTIGATOR);
  ClassRegistry.register(ROGUE);
  ClassRegistry.register(SORCERER);
  ClassRegistry.register(WIZARD);
});

describe('computeBuildState', () => {
  let mockActor;
  let plan;

  beforeEach(() => {
    mockActor = createMockActor();
    plan = createPlan('alchemist');
    global._testSettings = {};
  });

  test('returns basic state at level 2', () => {
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.level).toBe(2);
    expect(state.classSlug).toBe('alchemist');
  });

  test('includes the secondary class in tracked classes when dual class is enabled', () => {
    global._testSettings = {
      pf2e: { dualClassVariant: true },
      'pf2e-leveler': { enableDualClassSupport: true },
    };
    plan.dualClassSlug = 'fighter';
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.dualClassSlug).toBe('fighter');
    expect(state.dualClass?.slug).toBe('fighter');
    expect(state.classes.map((entry) => entry.slug)).toEqual(['alchemist', 'fighter']);
  });

  test('uses the best proficiency progression across primary and dual classes', () => {
    global._testSettings = {
      pf2e: { dualClassVariant: true },
      'pf2e-leveler': { enableDualClassSupport: true },
    };
    plan.dualClassSlug = 'fighter';
    const state = computeBuildState(mockActor, plan, 7);
    expect(state.proficiencies.perception).toBe(PROFICIENCY_RANKS.MASTER);
  });

  test('includes secondary rogue class features in dual class state', () => {
    global._testSettings = {
      pf2e: { dualClassVariant: true },
      'pf2e-leveler': { enableDualClassSupport: true },
    };
    plan.classSlug = 'alchemist';
    plan.dualClassSlug = 'rogue';

    const state = computeBuildState(mockActor, plan, 5);

    expect(state.classFeatures.has('weapon-tricks')).toBe(true);
  });

  test('includes secondary wizard spell tradition in dual class state', () => {
    global._testSettings = {
      pf2e: { dualClassVariant: true },
      'pf2e-leveler': { enableDualClassSupport: true },
    };
    plan.classSlug = 'fighter';
    plan.dualClassSlug = 'wizard';

    const state = computeBuildState(mockActor, plan, 3);

    expect(state.spellcasting.traditions.has('arcane')).toBe(true);
  });

  test('applies ability boosts', () => {
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'int']);
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.attributes.str).toBe(1);
    expect(state.attributes.dex).toBe(1);
    expect(state.attributes.con).toBe(1);
    expect(state.attributes.int).toBe(1);
    expect(state.attributes.wis).toBe(0);
  });

  test('partial boosts at high modifiers', () => {
    mockActor.system.abilities.str.mod = 4;
    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'int']);
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.attributes.str).toBe(4);
  });

  test('preserves imported pending partial boosts from actor base modifiers', () => {
    mockActor.system.details.level.value = 5;
    mockActor.system.abilities.str.mod = 4;
    mockActor.abilities = {
      str: { base: 4.5 },
      dex: { base: 0 },
      con: { base: 0 },
      int: { base: 0 },
      wis: { base: 0 },
      cha: { base: 0 },
    };

    setLevelBoosts(plan, 5, ['str', 'dex', 'con', 'int']);
    setLevelBoosts(plan, 10, ['str', 'dex', 'con', 'int']);

    const level5State = computeBuildState(mockActor, plan, 5);
    expect(level5State.attributes.str).toBe(4);
    expect(level5State.rawAttributes.str).toBe(4.5);

    const level10State = computeBuildState(mockActor, plan, 10);
    expect(level10State.attributes.str).toBe(5);
    expect(level10State.rawAttributes.str).toBe(5);
  });

  test('does not reapply past planned boosts that are already reflected on the actor', () => {
    mockActor.system.details.level.value = 14;
    mockActor.system.abilities.dex.mod = 5;
    mockActor.system.abilities.con.mod = 2;
    mockActor.system.abilities.int.mod = 2;
    mockActor.system.abilities.wis.mod = 2;
    mockActor.system.abilities.cha.mod = 4;

    setLevelBoosts(plan, 5, ['dex', 'con', 'int', 'cha']);
    setLevelBoosts(plan, 10, ['dex', 'con', 'wis', 'cha']);
    setLevelBoosts(plan, 15, ['dex', 'con', 'wis', 'cha']);

    const state = computeBuildState(mockActor, plan, 14);
    expect(state.attributes.con).toBe(2);
    expect(state.attributes.wis).toBe(2);

    const level15State = computeBuildState(mockActor, plan, 15);
    expect(level15State.attributes.con).toBe(3);
    expect(level15State.attributes.wis).toBe(3);
    expect(level15State.attributes.dex).toBe(5);
    expect(level15State.attributes.cha).toBe(4);
  });

  test('computes skills from actor current state', () => {
    mockActor.system.skills.crafting.rank = 1;
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.skills.crafting).toBe(PROFICIENCY_RANKS.TRAINED);
  });

  test('applies planned skill increases', () => {
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    const state = computeBuildState(mockActor, plan, 3);
    expect(state.skills.athletics).toBe(2);
  });

  test('applies actor-owned skill rank rules with selected heritage skill at matching level', () => {
    mockActor.items = [
      {
        type: 'heritage',
        slug: 'skilled-human',
        flags: {
          pf2e: {
            rulesSelections: {
              skill: 'athletics',
            },
          },
        },
        system: {
          rules: [
            {
              key: 'ActiveEffectLike',
              path: 'system.skills.{item|flags.pf2e.rulesSelections.skill}.rank',
              value: 2,
              predicate: ['self:level:5'],
            },
          ],
        },
      },
    ];
    mockActor.system.skills.athletics.rank = 1;

    expect(computeBuildState(mockActor, plan, 4).skills.athletics).toBe(1);
    expect(computeBuildState(mockActor, plan, 5).skills.athletics).toBe(2);
  });

  test('evaluates formula-based skill rank rules such as Acrobat Dedication', () => {
    setLevelFeat(plan, 2, 'archetypeFeats', {
      uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
      name: 'Acrobat Dedication',
      slug: 'acrobat-dedication',
      skillRules: [
        {
          skill: 'acrobatics',
          value: 'ternary(gte(@actor.level,15),4,ternary(gte(@actor.level,7),3,2))',
        },
      ],
      skillRulesResolved: true,
    });
    mockActor.system.skills.acrobatics.rank = 1;

    expect(computeBuildState(mockActor, plan, 2).skills.acrobatics).toBe(2);
    expect(computeBuildState(mockActor, plan, 7).skills.acrobatics).toBe(3);
    expect(computeBuildState(mockActor, plan, 15).skills.acrobatics).toBe(4);
  });

  test('applies textual trained-or-expert feat skill rules based on current rank', () => {
    setLevelFeat(plan, 2, 'archetypeFeats', {
      uuid: 'Compendium.pf2e.feats-srd.Item.blackjacket-dedication',
      name: 'Blackjacket Dedication',
      slug: 'blackjacket-dedication',
      skillRules: [
        {
          skill: 'intimidation',
          value: 1,
          valueIfAlreadyTrained: 2,
        },
      ],
      skillRulesResolved: true,
    });

    mockActor.system.skills.intimidation.rank = 0;
    expect(computeBuildState(mockActor, plan, 2).skills.intimidation).toBe(1);

    mockActor.system.skills.intimidation.rank = 1;
    expect(computeBuildState(mockActor, plan, 2).skills.intimidation).toBe(2);
  });

  test('applies Intelligence bonus skill training before same-level skill increases', () => {
    toggleLevelIntBonusSkill(plan, 5, 'athletics');
    setLevelSkillIncrease(plan, 5, { skill: 'athletics', toRank: 2 });

    const state = computeBuildState(mockActor, plan, 5);
    expect(state.skills.athletics).toBe(2);
  });

  test('skill increases respect upToLevel', () => {
    setLevelSkillIncrease(plan, 3, { skill: 'athletics', toRank: 2 });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.skills.athletics).toBe(0);
  });

  test('collects planned feats', () => {
    setLevelFeat(plan, 1, 'classFeats', { uuid: 'x', name: 'X', slug: 'quick-bomber' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'battle-medicine' });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('quick-bomber')).toBe(true);
    expect(state.feats.has('battle-medicine')).toBe(true);
  });

  test('includes custom feats, custom skill increases, and custom spells in build state awareness', () => {
    plan.levels[2].customFeats = [
      { uuid: 'z', name: 'Secret Technique', slug: 'secret-technique' },
    ];
    plan.levels[2].customSkillIncreases = [{ skill: 'athletics', toRank: 2 }];
    plan.levels[2].customSpells = [
      { uuid: 'spell-z', name: 'Mystic Bolt', slug: 'mystic-bolt', traits: ['evocation'] },
    ];

    const state = computeBuildState(mockActor, plan, 2);

    expect(state.feats.has('secret-technique')).toBe(true);
    expect(state.skills.athletics).toBe(2);
    expect(state.spellcasting.spellNames.has('mystic-bolt')).toBe(true);
    expect(state.spellcasting.spellTraits.has('evocation')).toBe(true);
  });

  test('collects feat aliases from parenthetical feat names', () => {
    mockActor.items = [
      {
        type: 'feat',
        slug: 'efficient-alchemy-alchemist',
        name: 'Efficient Alchemy (Alchemist)',
        system: { level: { taken: 4 } },
      },
    ];

    const state = computeBuildState(mockActor, plan, 10);

    expect(state.feats.has('efficient-alchemy-alchemist')).toBe(true);
    expect(state.feats.has('efficient-alchemy')).toBe(true);
  });

  test('collects planned feat choice aliases for prerequisite checks', () => {
    plan.levels[2].classFeats = [
      {
        uuid: 'feat-order-explorer',
        slug: 'order-explorer',
        name: 'Order Explorer',
        choices: {
          druidicOrder: 'wave-order',
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 6);

    expect(state.feats.has('order-explorer')).toBe(true);
    expect(state.feats.has('wave-order')).toBe(true);
  });

  test('feats respect upToLevel', () => {
    setLevelFeat(plan, 1, 'classFeats', { uuid: 'x', name: 'X', slug: 'quick-bomber' });
    setLevelFeat(plan, 3, 'generalFeats', { uuid: 'y', name: 'Y', slug: 'toughness' });
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('quick-bomber')).toBe(true);
    expect(state.feats.has('toughness')).toBe(false);
  });

  test('computes class features for level', () => {
    const state = computeBuildState(mockActor, plan, 5);
    expect(state.classFeatures.has('field-discovery')).toBe(true);
    expect(state.classFeatures.has('powerful-alchemy')).toBe(true);
    expect(state.classFeatures.has('double-brew')).toBe(false);
  });

  test('includes linked granted feature aliases from owned class-feature items', () => {
    const guardianActor = createMockActor({
      class: { slug: 'guardian', name: 'Guardian' },
      items: [
        {
          type: 'feat',
          slug: 'guardians-techniques',
          name: "Guardian's Techniques",
          system: {
            category: 'classfeature',
            level: { value: 1, taken: 1 },
            description: {
              value:
                '<p>You gain the @UUID[Compendium.pf2e.actionspf2e.Item.intercept-attack]{Intercept Attack} reaction.</p>',
            },
          },
        },
      ],
    });

    const guardianPlan = createPlan('guardian');
    const state = computeBuildState(guardianActor, guardianPlan, 12);
    expect(state.classFeatures.has('guardians-techniques')).toBe(true);
    expect(state.classFeatures.has('intercept-attack')).toBe(true);
  });

  test('ancestry and heritage from actor', () => {
    const state = computeBuildState(mockActor, plan, 1);
    expect(state.ancestrySlug).toBe('human');
    expect(state.heritageSlug).toBe('versatile-heritage');
  });

  test('collects heritage aliases from heritage slug and name', () => {
    mockActor.heritage = {
      slug: 'charhide-goblin',
      name: 'Charhide Goblin',
    };
    mockActor.items = [
      {
        type: 'heritage',
        slug: 'charhide-goblin',
        name: 'Charhide Goblin',
      },
    ];

    const state = computeBuildState(mockActor, plan, 1);
    expect(state.heritageAliases).toEqual(expect.any(Set));
    expect(state.heritageAliases.has('charhide-goblin')).toBe(true);
  });

  test('includes ancestry name as ancestry trait when ancestry slug is missing', () => {
    mockActor.ancestry = {
      slug: null,
      name: 'Intelligent Weapon',
    };
    mockActor.system.details.ancestry = { trait: null };

    const state = computeBuildState(mockActor, plan, 1);
    expect(state.ancestryTraits.has('intelligent-weapon')).toBe(true);
  });

  test('includes ancestry item trait values when ancestry slug is missing', () => {
    mockActor.ancestry = {
      slug: null,
      name: 'Person',
      system: {
        traits: {
          value: ['human', 'beast-folk'],
        },
      },
    };
    mockActor.system.details.ancestry = { trait: null };

    const state = computeBuildState(mockActor, plan, 1);

    expect(state.ancestryTraits.has('person')).toBe(true);
    expect(state.ancestryTraits.has('human')).toBe(true);
    expect(state.ancestryTraits.has('beast-folk')).toBe(true);
  });

  test('includes focus-pool in feats when actor has focus pool', () => {
    mockActor.system.resources = { focus: { max: 1, value: 1 } };
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('focus-pool')).toBe(true);
  });

  test('tracks slot-based spellcasting when actor has a spellcasting entry with slots', () => {
    mockActor.items = [
      {
        type: 'spellcastingEntry',
        system: {
          tradition: { value: 'divine' },
          slots: {
            slot1: { max: 2, value: 2 },
          },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.spellcasting.hasSpellSlots).toBe(true);
  });

  test('includes planned spellcasting dedication traditions in spellcasting state', () => {
    setLevelFeat(plan, 2, 'archetypeFeats', {
      uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
      name: 'Druid Dedication',
      slug: 'druid-dedication',
      traits: ['archetype', 'dedication', 'druid', 'multiclass'],
    });

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.spellcasting.traditions.has('primal')).toBe(true);
  });

  test('detects healing divine font from owned spellcasting entry', () => {
    mockActor.items = [
      {
        type: 'spellcastingEntry',
        name: 'Divine Font (Healing)',
        system: {
          tradition: { value: 'divine' },
          slots: {
            slot1: { max: 4, value: 4 },
          },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.divineFont).toBe('healing');
  });

  test('collects spell traits from owned spell items', () => {
    mockActor.items = [
      {
        type: 'spell',
        name: 'Harm',
        system: {
          traits: { value: ['necromancy', 'death'] },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.spellcasting.spellNames.has('harm')).toBe(true);
    expect(state.spellcasting.spellTraits.has('necromancy')).toBe(true);
    expect(state.spellcasting.spellTraits.has('death')).toBe(true);
  });

  test('excludes focus-pool when actor has no focus pool', () => {
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.feats.has('focus-pool')).toBe(false);
  });

  test('builds proficiency state from actor and class features', () => {
    mockActor.system.perception = { rank: 1 };
    mockActor.system.saves = {
      fortitude: { rank: 1 },
      reflex: { rank: 1 },
      will: { rank: 1 },
    };
    mockActor.system.attributes = {
      classDC: { rank: 1 },
    };

    const state = computeBuildState(mockActor, plan, 11);

    expect(state.proficiencies.perception).toBe(PROFICIENCY_RANKS.EXPERT);
    expect(state.proficiencies.fortitude).toBe(PROFICIENCY_RANKS.TRAINED);
    expect(state.proficiencies.reflex).toBe(PROFICIENCY_RANKS.TRAINED);
    expect(state.proficiencies.will).toBe(PROFICIENCY_RANKS.EXPERT);
    expect(state.proficiencies.classdc).toBe(PROFICIENCY_RANKS.EXPERT);
  });

  test('applies fighter battlefield surveyor as perception mastery at level 7', () => {
    mockActor.system.perception = { rank: PROFICIENCY_RANKS.EXPERT };
    const fighterPlan = createPlan('fighter');

    const state = computeBuildState(mockActor, fighterPlan, 7);

    expect(state.proficiencies.perception).toBe(PROFICIENCY_RANKS.MASTER);
  });

  test('applies explicit fighter class DC progression metadata', () => {
    mockActor.system.attributes = {
      classDC: { rank: PROFICIENCY_RANKS.TRAINED },
    };
    const fighterPlan = createPlan('fighter');

    expect(computeBuildState(mockActor, fighterPlan, 11).proficiencies.classdc).toBe(
      PROFICIENCY_RANKS.EXPERT,
    );
    expect(computeBuildState(mockActor, fighterPlan, 19).proficiencies.classdc).toBe(
      PROFICIENCY_RANKS.LEGENDARY,
    );
  });

  test('applies explicit investigator perception and reflex progression metadata', () => {
    mockActor.system.perception = { rank: PROFICIENCY_RANKS.TRAINED };
    mockActor.system.saves = {
      fortitude: { rank: PROFICIENCY_RANKS.TRAINED },
      reflex: { rank: PROFICIENCY_RANKS.EXPERT },
      will: { rank: PROFICIENCY_RANKS.TRAINED },
    };
    const investigatorPlan = createPlan('investigator');

    expect(computeBuildState(mockActor, investigatorPlan, 7).proficiencies.perception).toBe(
      PROFICIENCY_RANKS.EXPERT,
    );
    expect(computeBuildState(mockActor, investigatorPlan, 13).proficiencies.perception).toBe(
      PROFICIENCY_RANKS.MASTER,
    );
    expect(computeBuildState(mockActor, investigatorPlan, 15).proficiencies.reflex).toBe(
      PROFICIENCY_RANKS.MASTER,
    );
  });

  test('collects weapon proficiency categories from actor data', () => {
    mockActor.system.proficiencies = {
      attacks: {
        simple: { rank: 1 },
        martial: { rank: 2 },
      },
    };

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.weaponProficiencies.simple).toBe(PROFICIENCY_RANKS.TRAINED);
    expect(state.weaponProficiencies.martial).toBe(PROFICIENCY_RANKS.EXPERT);
  });

  test('collects lore ranks from owned lore items', () => {
    mockActor.items = [
      {
        type: 'lore',
        name: 'Underworld Lore',
        system: {
          proficient: { value: 2 },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.lores['underworld-lore']).toBe(2);
  });

  test('includes planned lore skill increases in lore ranks', () => {
    const actor = createMockActor();
    const plan = createPlan('alchemist');
    plan.levels[3].skillIncreases = [{ skill: 'underworld-lore', toRank: 1 }];

    const state = computeBuildState(actor, plan, 3);

    expect(state.lores['underworld-lore']).toBe(1);
  });

  test('collects known languages with Ancient Osiriani normalized to Osiriani', () => {
    mockActor.system.details.languages = {
      value: ['common', 'osiriani', 'sphinx'],
    };

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.languages.has('common')).toBe(true);
    expect(state.languages.has('osiriani')).toBe(true);
    expect(state.languages.has('sphinx')).toBe(true);
  });

  test('includes adopted ancestry traits from planned feats in build state', () => {
    setLevelFeat(plan, 1, 'generalFeats', {
      uuid: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
      name: 'Adopted Ancestry',
      slug: 'adopted-ancestry',
      choices: { adoptedAncestry: 'kholo' },
    });

    const state = computeBuildState(mockActor, plan, 5);
    expect(state.ancestryTraits.has('human')).toBe(true);
    expect(state.ancestryTraits.has('kholo')).toBe(true);
    expect(state.ancestryTraits.has('gnoll')).toBe(true);
  });

  test('includes the actor ancestry trait in build state ancestry traits', () => {
    mockActor.ancestry.slug = 'awakened-animal';
    mockActor.system.details.ancestry = { trait: 'animal' };

    const state = computeBuildState(mockActor, plan, 5);

    expect(state.ancestryTraits.has('awakened-animal')).toBe(true);
    expect(state.ancestryTraits.has('animal')).toBe(true);
  });

  test('includes mixed ancestry secondary ancestry traits from the actor heritage selection', () => {
    mockActor.heritage = {
      uuid: MIXED_ANCESTRY_UUID,
      slug: 'mixed-ancestry',
      flags: {
        pf2e: {
          rulesSelections: {
            [MIXED_ANCESTRY_CHOICE_FLAG]: 'kholo',
          },
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 5);

    expect(state.ancestryTraits.has('human')).toBe(true);
    expect(state.ancestryTraits.has('kholo')).toBe(true);
    expect(state.ancestryTraits.has('gnoll')).toBe(true);
  });

  test('collects equipped armor, shield, and wielded weapon state', () => {
    mockActor.items = [
      {
        type: 'armor',
        name: 'Breastplate',
        system: {
          category: { value: 'medium' },
          equipped: { inSlot: true },
        },
      },
      {
        type: 'armor',
        name: 'Steel Shield',
        system: {
          category: { value: 'shield' },
          equipped: { inSlot: true },
        },
      },
      {
        type: 'weapon',
        name: 'Longsword',
        system: {
          category: { value: 'martial' },
          group: { value: 'sword' },
          traits: { value: ['versatile-p'] },
          equipped: { handsHeld: 1 },
        },
      },
      {
        type: 'weapon',
        name: 'Shortbow',
        system: {
          category: { value: 'martial' },
          group: { value: 'bow' },
          traits: { value: [] },
          range: { increment: 60 },
          equipped: { handsHeld: 2 },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);

    expect(state.equipment.hasShield).toBe(true);
    expect(state.equipment.armorCategories.has('medium')).toBe(true);
    expect(state.equipment.weaponCategories.has('martial')).toBe(true);
    expect(state.equipment.weaponGroups.has('sword')).toBe(true);
    expect(state.equipment.weaponTraits.has('versatile-p')).toBe(true);
    expect(state.equipment.wieldedMelee).toBe(true);
    expect(state.equipment.wieldedRanged).toBe(true);
  });

  test('collects deity domains from the selected deity', () => {
    mockActor.items = [
      {
        type: 'deity',
        slug: 'sarenrae',
        name: 'Sarenrae',
        system: {
          domains: {
            primary: ['fire'],
            alternate: ['sun'],
          },
        },
      },
    ];

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.deity?.domains?.has('fire')).toBe(true);
    expect(state.deity?.domains?.has('sun')).toBe(true);
  });

  test('applies planned feat fallback skill choices as trained skills', () => {
    const actor = createMockActor({
      system: {
        details: { level: { value: 1 } },
        skills: {
          deception: { rank: 0 },
        },
      },
    });

    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.champion-dedication',
              name: 'Champion Dedication',
              slug: 'champion-dedication',
              choices: {
                levelerSkillFallback1: 'deception',
              },
            },
          ],
        },
      },
    };

    const state = computeBuildState(actor, plan, 2);
    expect(state.skills.deception).toBe(1);
  });

  test('tracks planned class archetype dedications from stored planner feat traits', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
              name: 'Druid Dedication',
              slug: 'druid-dedication',
              traits: ['archetype', 'multiclass', 'dedication', 'druid'],
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 4);
    expect(state.archetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeTraits.has('druid')).toBe(true);
  });

  test('tracks planned non-class archetype dedications from stored planner feat traits', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.aldori-duelist-dedication',
              name: 'Aldori Duelist Dedication',
              slug: 'aldori-duelist-dedication',
              traits: ['archetype', 'dedication'],
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 4);
    expect(state.archetypeDedications.has('aldori-duelist-dedication')).toBe(true);
    expect(state.classArchetypeDedications.has('aldori-duelist-dedication')).toBe(false);
  });

  test('counts same-level archetype feats from class and archetype slots toward dedication completion', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
              name: 'Archaeologist Dedication',
              slug: 'archaeologist-dedication',
              traits: ['archetype', 'dedication', 'archaeologist'],
            },
          ],
        },
        4: {
          classFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
              name: 'Trap Finder',
              slug: 'trap-finder',
              traits: ['archetype', 'archaeologist'],
              system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
            },
          ],
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
              name: 'Settlement Scholastics',
              slug: 'settlement-scholastics',
              traits: ['archetype', 'archaeologist'],
              system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 4);

    expect(state.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });

  test('counts same-level generic archetype feats by stored dedication prerequisite text', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
              name: 'Archaeologist Dedication',
              slug: 'archaeologist-dedication',
              traits: ['archetype', 'dedication', 'archaeologist'],
            },
          ],
        },
        4: {
          classFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
              name: 'Trap Finder',
              slug: 'trap-finder',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
            },
          ],
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
              name: 'Settlement Scholastics',
              slug: 'settlement-scholastics',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Archaeologist Dedication' }] } },
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 4);

    expect(state.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });

  test('counts generic same-level skill and free-archetype feats after earlier completed dedications', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
              name: 'Medic Dedication',
              slug: 'medic-dedication',
              traits: ['archetype', 'dedication', 'medic'],
            },
          ],
        },
        3: {
          skillFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
              name: 'Treat Condition',
              slug: 'treat-condition',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
            },
          ],
        },
        4: {
          classFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.holistic-care',
              name: 'Holistic Care',
              slug: 'holistic-care',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
            },
          ],
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.archaeologist-dedication',
              name: 'Archaeologist Dedication',
              slug: 'archaeologist-dedication',
              traits: ['archetype', 'dedication', 'archaeologist'],
            },
          ],
        },
        5: {
          skillFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.settlement-scholastics',
              name: 'Settlement Scholastics',
              slug: 'settlement-scholastics',
              traits: ['archetype', 'skill'],
            },
          ],
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.trap-finder',
              name: 'Trap Finder',
              slug: 'trap-finder',
              traits: ['skill'],
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 5);

    expect(state.archetypeDedicationProgress.get('archaeologist-dedication')).toBe(2);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });

  test('tracks planned Multitalented dedication choices as class archetype dedications', () => {
    const plan = {
      levels: {
        9: {
          ancestryFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.multitalented',
              name: 'Multitalented',
              slug: 'multitalented',
              choices: {
                multiclassDedication: 'druid-dedication',
              },
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 10);
    expect(state.feats.has('druid-dedication')).toBe(true);
    expect(state.archetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeTraits.has('druid')).toBe(true);
  });

  test('tracks applied Multitalented dedication choices from PF2E rules selections', () => {
    const actor = createMockActor();
    actor.items = {
      filter: jest.fn((predicate) => {
        const items = [
          {
            type: 'feat',
            uuid: 'Compendium.pf2e.feats-srd.Item.multitalented',
            name: 'Multitalented',
            slug: 'multitalented',
            flags: {
              pf2e: {
                rulesSelections: {
                  multiclassDedication: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
                },
              },
            },
          },
        ];
        return items.filter(predicate);
      }),
    };

    const state = computeBuildState(actor, createPlan('alchemist'), 10);
    expect(state.feats.has('druid-dedication')).toBe(true);
    expect(state.archetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeDedications.has('druid-dedication')).toBe(true);
    expect(state.classArchetypeTraits.has('druid')).toBe(true);
  });

  test('tracks subclass aliases from subclass feat slugs', () => {
    const actor = createMockActor();
    actor.items = {
      filter: jest.fn((predicate) => {
        const items = [
          {
            type: 'feat',
            slug: 'bard-muse-warrior',
            system: { traits: { otherTags: ['bard-muse'] } },
          },
          {
            type: 'feat',
            slug: 'rogue-racket-mastermind',
            system: { traits: { otherTags: ['rogue-racket'] } },
          },
        ];
        return items.filter(predicate);
      }),
    };

    const state = computeBuildState(actor, createPlan('alchemist'), 4);
    expect(state.feats.has('warrior-muse')).toBe(true);
    expect(state.feats.has('mastermind-racket')).toBe(true);
    expect(state.featAliasSources.get('warrior-muse')?.has('bard-muse-warrior')).toBe(true);
  });

  test('tracks subclass aliases from plain subclass feat slugs when subclass tag is present', () => {
    const actor = createMockActor();
    actor.items = {
      filter: jest.fn((predicate) => {
        const items = [
          {
            type: 'feat',
            slug: 'maestro',
            system: { traits: { otherTags: ['bard-muse'] } },
          },
        ];
        return items.filter(predicate);
      }),
    };

    const state = computeBuildState(actor, createPlan('alchemist'), 4);
    expect(state.feats.has('maestro')).toBe(true);
    expect(state.feats.has('maestro-muse')).toBe(true);
    expect(state.featAliasSources.get('maestro-muse')?.has('maestro')).toBe(true);
  });

  test('infers variable bloodline tradition from subclass choice without an embedded spellcasting entry', () => {
    const actor = createMockActor();
    actor.items = {
      filter: jest.fn((predicate) => {
        const items = [
          {
            type: 'feat',
            slug: 'bloodline-draconic',
            flags: {
              pf2e: {
                rulesSelections: {
                  dragonBloodline: 'fortune',
                },
              },
            },
            system: {
              traits: {
                otherTags: ['sorcerer-bloodline'],
              },
            },
          },
        ];
        return items.filter(predicate);
      }),
    };

    const state = computeBuildState(actor, createPlan('sorcerer'), 4);
    expect(state.spellcasting.traditions.has('arcane')).toBe(true);
  });

  test('tracks incomplete dedication progress until two other archetype feats are taken', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
              name: 'Medic Dedication',
              slug: 'medic-dedication',
              traits: ['archetype', 'dedication', 'medic'],
            },
          ],
        },
        4: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
              name: 'Treat Condition',
              slug: 'treat-condition',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 4);
    expect(state.archetypeDedicationProgress.get('medic-dedication')).toBe(1);
    expect(state.incompleteArchetypeDedications.has('medic-dedication')).toBe(true);
    expect(state.canTakeNewArchetypeDedication).toBe(false);
  });

  test('completed dedication progress reopens taking another dedication', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
              name: 'Medic Dedication',
              slug: 'medic-dedication',
              traits: ['archetype', 'dedication', 'medic'],
            },
          ],
        },
        4: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
              name: 'Treat Condition',
              slug: 'treat-condition',
              traits: ['archetype', 'skill'],
              system: { prerequisites: { value: [{ value: 'Medic Dedication' }] } },
            },
          ],
        },
        6: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.holistic-care',
              name: 'Holistic Care',
              slug: 'holistic-care',
              traits: ['archetype', 'skill'],
              system: {
                prerequisites: { value: [{ value: 'trained in Diplomacy, Treat Condition' }] },
              },
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 6);
    expect(state.archetypeDedicationProgress.get('medic-dedication')).toBe(2);
    expect(state.incompleteArchetypeDedications.has('medic-dedication')).toBe(false);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });

  test('does not count non-archetype feats toward dedication completion', () => {
    const actor = {
      ...mockActor,
      items: [
        {
          type: 'feat',
          uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
          name: 'Medic Dedication',
          slug: 'medic-dedication',
          system: { traits: { value: ['archetype', 'dedication', 'medic'] } },
        },
        {
          type: 'feat',
          uuid: 'Compendium.pf2e.feats-srd.Item.battle-medicine',
          name: 'Battle Medicine',
          slug: 'battle-medicine',
          system: {
            traits: { value: ['general', 'healing', 'skill'] },
            prerequisites: { value: [{ value: 'trained in Medicine' }] },
          },
        },
        {
          type: 'feat',
          uuid: 'Compendium.pf2e.feats-srd.Item.treat-condition',
          name: 'Treat Condition',
          slug: 'treat-condition',
          system: {
            traits: { value: ['archetype', 'skill'] },
            prerequisites: { value: [{ value: 'Medic Dedication' }] },
          },
        },
      ],
    };

    const state = computeBuildState(actor, createPlan('alchemist'), 6);
    expect(state.archetypeDedicationProgress.get('medic-dedication')).toBe(1);
    expect(state.canTakeNewArchetypeDedication).toBe(false);
  });

  test('single-dedication plans count selected archetype feats even without stored prerequisite metadata', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.some-dedication',
              name: 'Some Dedication',
              slug: 'some-dedication',
              traits: ['archetype', 'dedication'],
            },
          ],
        },
        4: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.follow-up-1',
              name: 'Follow-Up One',
              slug: 'follow-up-one',
              traits: ['archetype'],
            },
          ],
        },
        6: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.follow-up-2',
              name: 'Follow-Up Two',
              slug: 'follow-up-two',
              traits: ['archetype'],
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 8);
    expect(state.archetypeDedicationProgress.get('some-dedication')).toBe(2);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });

  test('multiple completed dedications reopen taking another dedication', () => {
    const plan = {
      levels: {
        2: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.first-dedication',
              name: 'First Dedication',
              slug: 'first-dedication',
              traits: ['archetype', 'dedication', 'first-archetype'],
            },
          ],
        },
        4: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.first-follow-up-1',
              name: 'First Follow Up One',
              slug: 'first-follow-up-one',
              traits: ['archetype'],
            },
          ],
        },
        6: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.first-follow-up-2',
              name: 'First Follow Up Two',
              slug: 'first-follow-up-two',
              traits: ['archetype'],
            },
          ],
        },
        8: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.second-dedication',
              name: 'Second Dedication',
              slug: 'second-dedication',
              traits: ['archetype', 'dedication', 'second-archetype'],
            },
          ],
        },
        10: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.second-follow-up-1',
              name: 'Second Follow Up One',
              slug: 'second-follow-up-one',
              traits: ['archetype'],
            },
          ],
        },
        12: {
          archetypeFeats: [
            {
              uuid: 'Compendium.pf2e.feats-srd.Item.second-follow-up-2',
              name: 'Second Follow Up Two',
              slug: 'second-follow-up-two',
              traits: ['archetype'],
            },
          ],
        },
      },
    };

    const state = computeBuildState(mockActor, plan, 14);
    expect(state.archetypeDedicationProgress.get('first-dedication')).toBe(2);
    expect(state.archetypeDedicationProgress.get('second-dedication')).toBe(2);
    expect(state.incompleteArchetypeDedications.size).toBe(0);
    expect(state.canTakeNewArchetypeDedication).toBe(true);
  });
});
