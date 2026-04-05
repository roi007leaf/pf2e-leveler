import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { PROFICIENCY_RANKS } from '../../../scripts/constants.js';
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
});

describe('computeBuildState', () => {
  let mockActor;
  let plan;

  beforeEach(() => {
    mockActor = createMockActor();
    plan = createPlan('alchemist');
  });

  test('returns basic state at level 2', () => {
    const state = computeBuildState(mockActor, plan, 2);
    expect(state.level).toBe(2);
    expect(state.classSlug).toBe('alchemist');
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

  test('ancestry and heritage from actor', () => {
    const state = computeBuildState(mockActor, plan, 1);
    expect(state.ancestrySlug).toBe('human');
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
    expect(state.proficiencies.classdc).toBe(PROFICIENCY_RANKS.TRAINED);
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

  test('collects known languages with Ancient Osiriani normalized to Osiriani', () => {
    mockActor.system.details.languages = {
      value: ['common', 'osiriani', 'sphinx'],
    };

    const state = computeBuildState(mockActor, plan, 2);
    expect(state.languages.has('common')).toBe(true);
    expect(state.languages.has('osiriani')).toBe(true);
    expect(state.languages.has('sphinx')).toBe(true);
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
});
