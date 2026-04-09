import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { PLAN_STATUS } from '../../../scripts/constants.js';
import { DRUID } from '../../../scripts/classes/druid.js';
import { SORCERER } from '../../../scripts/classes/sorcerer.js';
import { WIZARD } from '../../../scripts/classes/wizard.js';
import { validatePlan, validateLevel } from '../../../scripts/plan/plan-validator.js';
import * as buildState from '../../../scripts/plan/build-state.js';
import {
  createPlan,
  addLevelSpell,
  setLevelBoosts,
  setLevelFeat,
  setLevelSkillIncrease,
} from '../../../scripts/plan/plan-model.js';

beforeAll(() => {
  ClassRegistry.clear();
  ClassRegistry.register(ALCHEMIST);
  ClassRegistry.register(DRUID);
  ClassRegistry.register(SORCERER);
  ClassRegistry.register(WIZARD);
});

describe('validateLevel', () => {
  test('empty plan level 2 is incomplete', () => {
    const plan = createPlan('alchemist');
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
  });

  test('level beyond 20 returns empty', () => {
    const plan = createPlan('alchemist');
    const result = validateLevel(plan, ALCHEMIST, 21);
    expect(result.status).toBe(PLAN_STATUS.EMPTY);
  });

  test('complete level 2 passes validation', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'x', name: 'X', slug: 'x' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('missing class feat at level 2 is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const result = validateLevel(plan, ALCHEMIST, 2);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('Class Feat'))).toBe(true);
  });

  test('enforces required 2nd-level class feat from linked class-archetype text', () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'wrong', name: 'Wrong Feat', slug: 'wrong-feat' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const actor = {
      class: { slug: 'gunslinger' },
      items: [
        {
          type: 'feat',
          system: {
            traits: { otherTags: ['gunslinger-way'] },
            description: {
              value: 'You must select <a data-uuid="Compendium.pf2e.feats-srd.Item.spellshot-dedication">Spellshot Dedication</a> as your 2nd-level class feat.',
            },
          },
        },
      ],
    };

    const result = validateLevel(plan, ALCHEMIST, 2, {}, actor);

    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((issue) => issue.message.includes('Spellshot Dedication'))).toBe(true);
    game.settings.get = originalGet;
  });

  test('enforces required 2nd-level class feat from plain text class-archetype wording', () => {
    const originalGet = game.settings.get;
    game.settings.get = jest.fn((module, key) => (
      key === 'enforceSubclassDedicationRequirement' ? true : originalGet(module, key)
    ));
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'feat-avenger-dedication', name: 'Avenger Dedication', slug: 'avenger-dedication' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const actor = {
      class: { slug: 'rogue' },
      items: [
        {
          type: 'feat',
          system: {
            traits: { otherTags: ['rogue-racket'] },
            description: {
              value: 'You must select Avenger Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    };

    const result = validateLevel(plan, ALCHEMIST, 2, {}, actor);

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
    game.settings.get = originalGet;
  });

  test('does not enforce required 2nd-level class feat when subclass dedication requirement setting is disabled', () => {
    const plan = createPlan('alchemist');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'wrong', name: 'Wrong Feat', slug: 'wrong-feat' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'y', name: 'Y', slug: 'y' });
    const actor = {
      class: { slug: 'cleric' },
      items: [
        {
          type: 'classfeature',
          system: {
            traits: { otherTags: ['cleric-doctrine'] },
            description: {
              value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.',
            },
          },
        },
      ],
    };

    const result = validateLevel(plan, ALCHEMIST, 2, {}, actor);

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('wrong number of boosts is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'dex']);
    const result = validateLevel(plan, ALCHEMIST, 5);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('boosts'))).toBe(true);
  });

  test('duplicate boosts is incomplete', () => {
    const plan = createPlan('alchemist');
    setLevelBoosts(plan, 5, ['str', 'str', 'dex', 'con']);
    const result = validateLevel(plan, ALCHEMIST, 5);
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('Duplicate'))).toBe(true);
  });

  test('duplicate gradual boosts across the same set is incomplete', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 2, ['str']);
    setLevelBoosts(plan, 3, ['dex']);
    setLevelBoosts(plan, 4, ['str']);
    const result = validateLevel(plan, ALCHEMIST, 4, { gradualBoosts: true });
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((i) => i.message.includes('gradual ability boost set'))).toBe(true);
  });

  test('gradual boosts reset when a new four-level set begins', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 2, ['dex']);
    setLevelBoosts(plan, 3, ['con']);
    setLevelBoosts(plan, 4, ['int']);
    setLevelBoosts(plan, 5, ['wis']);
    setLevelBoosts(plan, 7, ['int']);
    plan.levels[7].intBonusSkills = ['arcana'];
    plan.levels[7].intBonusLanguages = ['draconic'];
    setLevelFeat(plan, 7, 'generalFeats', { uuid: 'g', name: 'G', slug: 'g' });
    setLevelSkillIncrease(plan, 7, { skill: 'crafting', toRank: 2 });

    const result = validateLevel(plan, ALCHEMIST, 7, { gradualBoosts: true });

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
    expect(result.issues.some((i) => i.message.includes('gradual ability boost set'))).toBe(false);
  });

  test('spontaneous granted subclass spells count toward level completion', () => {
    const actor = {
      items: [
        {
          type: 'feat',
          slug: 'bloodline-genie',
          flags: { pf2e: { rulesSelections: { genie: 'ifrit' } } },
          system: { traits: { otherTags: ['sorcerer-bloodline'] } },
        },
      ],
    };
    const plan = createPlan('sorcerer');
    setLevelFeat(plan, 3, 'generalFeats', { uuid: 'general-1', name: 'Keen Follower', slug: 'keen-follower' });
    setLevelSkillIncrease(plan, 3, { skill: 'arcana', toRank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-1', name: 'Acid Arrow', rank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-2', name: 'Acidic Burst', rank: 2 });

    const result = validateLevel(plan, SORCERER, 3, {}, actor);

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('intelligence bonus selections validate correctly when INT increases from +4 to +5', () => {
    const plan = createPlan('alchemist', { gradualBoosts: true });
    setLevelBoosts(plan, 9, ['int']);
    plan.levels[9].intBonusSkills = ['diplomacy'];
    plan.levels[9].intBonusLanguages = ['aklo'];
    setLevelFeat(plan, 9, 'ancestryFeats', { uuid: 'a', name: 'A', slug: 'a' });
    setLevelSkillIncrease(plan, 9, { skill: 'crafting', toRank: 1 });

    jest.spyOn(buildState, 'computeBuildState')
      .mockImplementation((_actor, _plan, atLevel) => ({
        attributes: { int: atLevel >= 9 ? 5 : 4 },
      }));

    const result = validateLevel(plan, ALCHEMIST, 9, { gradualBoosts: true }, {});

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('spellbook casters with cantrip expansion require two extra cantrip selections', () => {
    const plan = createPlan('wizard');
    setLevelFeat(plan, 3, 'generalFeats', {
      uuid: 'feat-cantrip-expansion',
      name: 'Cantrip Expansion',
      slug: 'cantrip-expansion',
    });
    setLevelSkillIncrease(plan, 3, { skill: 'arcana', toRank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-a', name: 'Magic Missile', rank: 1 });
    addLevelSpell(plan, 3, { uuid: 'spell-b', name: 'Runic Weapon', rank: 1 });
    addLevelSpell(plan, 3, { uuid: 'spell-c', name: 'Shield', rank: 0, isCantrip: true });
    addLevelSpell(plan, 3, { uuid: 'spell-d', name: 'Mystic Armor', rank: 1 });

    const result = validateLevel(plan, WIZARD, 3, {}, { items: [] });

    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);
    expect(result.issues.some((issue) => issue.message.includes('spellbook cantrip'))).toBe(true);
  });

  test('spellbook cantrip expansion passes when two extra cantrips are selected', () => {
    const plan = createPlan('wizard');
    setLevelFeat(plan, 3, 'generalFeats', {
      uuid: 'feat-cantrip-expansion',
      name: 'Cantrip Expansion',
      slug: 'cantrip-expansion',
    });
    setLevelSkillIncrease(plan, 3, { skill: 'arcana', toRank: 2 });
    addLevelSpell(plan, 3, { uuid: 'spell-a', name: 'Magic Missile', rank: 1 });
    addLevelSpell(plan, 3, { uuid: 'spell-b', name: 'Runic Weapon', rank: 1 });
    addLevelSpell(plan, 3, { uuid: 'spell-c', name: 'Shield', rank: 0, isCantrip: true });
    addLevelSpell(plan, 3, { uuid: 'spell-d', name: 'Message', rank: 0, isCantrip: true });

    const result = validateLevel(plan, WIZARD, 3, {}, { items: [] });

    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });

  test('spellcasting dedications validate their own cantrip and rank picks separately from the main spellbook', () => {
    const plan = createPlan('wizard');
    setLevelFeat(plan, 2, 'classFeats', { uuid: 'wizard-feat', name: 'Reach Spell', slug: 'reach-spell' });
    setLevelFeat(plan, 2, 'skillFeats', { uuid: 'skill-feat', name: 'Trick Magic Item', slug: 'trick-magic-item' });
    setLevelFeat(plan, 2, 'archetypeFeats', {
      uuid: 'feat-druid',
      name: 'Druid Dedication',
      slug: 'druid-dedication',
      traits: ['archetype', 'dedication', 'druid', 'multiclass'],
    });
    addLevelSpell(plan, 2, { uuid: 'wizard-spell-a', name: 'Magic Missile', rank: 1, entryType: 'primary' });
    addLevelSpell(plan, 2, { uuid: 'wizard-spell-b', name: 'Runic Weapon', rank: 1, entryType: 'primary' });
    addLevelSpell(plan, 2, { uuid: 'druid-cantrip-a', name: 'Electric Arc', rank: 0, isCantrip: true, entryType: 'archetype:druid' });
    addLevelSpell(plan, 2, { uuid: 'druid-cantrip-b', name: 'Guidance', rank: 0, isCantrip: true, entryType: 'archetype:druid' });

    let result = validateLevel(plan, WIZARD, 2, {}, { items: [] });
    expect(result.status).toBe(PLAN_STATUS.COMPLETE);

    setLevelFeat(plan, 4, 'classFeats', { uuid: 'class-feat-4', name: 'Widen Spell', slug: 'widen-spell' });
    setLevelFeat(plan, 4, 'skillFeats', { uuid: 'skill-feat-4', name: 'Assurance', slug: 'assurance' });
    setLevelFeat(plan, 4, 'archetypeFeats', {
      uuid: 'feat-basic-druid',
      name: 'Basic Druid Spellcasting',
      slug: 'basic-druid-spellcasting',
      traits: ['archetype', 'druid'],
    });
    addLevelSpell(plan, 4, { uuid: 'wizard-spell-c', name: 'See Invisibility', rank: 2, entryType: 'primary' });
    addLevelSpell(plan, 4, { uuid: 'wizard-spell-d', name: 'Invisibility', rank: 2, entryType: 'primary' });

    result = validateLevel(plan, WIZARD, 4, {}, { items: [] });
    expect(result.status).toBe(PLAN_STATUS.INCOMPLETE);

    addLevelSpell(plan, 4, { uuid: 'druid-rank-1', name: 'Runic Body', rank: 1, entryType: 'archetype:druid' });
    result = validateLevel(plan, WIZARD, 4, {}, { items: [] });
    expect(result.status).toBe(PLAN_STATUS.COMPLETE);
  });
});

describe('validatePlan', () => {
  test('empty plan is invalid', () => {
    const plan = createPlan('alchemist');
    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
  });

  test('returns per-level results starting from level 2', () => {
    const plan = createPlan('alchemist');
    const result = validatePlan(plan);
    expect(result.levelResults[1]).toBeUndefined();
    expect(result.levelResults[2]).toBeDefined();
    expect(result.levelResults[21]).toBeUndefined();
  });
});
