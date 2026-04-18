import { activateLevelPlannerListeners } from '../../../scripts/ui/level-planner/listeners.js';
import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';

jest.mock('../../../scripts/apply/apply-manager.js', () => ({
  promptApplyPlan: jest.fn(async () => {}),
}));

import { promptApplyPlan } from '../../../scripts/apply/apply-manager.js';

async function flushAsyncListeners() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Level planner skill increase listeners', () => {
  beforeAll(() => {
    ClassRegistry.register(ALCHEMIST);
  });

  it('uses same-level actor-owned skill rank rules when selecting a skill increase', () => {
    document.body.innerHTML = '<button type="button" data-action="selectSkillIncrease" data-skill="society"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          7: {
            skillIncreases: [],
          },
        },
      },
      selectedLevel: 7,
      _savePlanAndRender: jest.fn(),
    };

    planner.actor.items = [
      {
        type: 'heritage',
        slug: 'skilled-human',
        flags: {
          pf2e: {
            rulesSelections: {
              skill: 'society',
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
    planner.actor.system.skills.society.rank = 1;

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectSkillIncrease"]').click();

    expect(planner.plan.levels[7].skillIncreases).toEqual([
      { skill: 'society', toRank: 3 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('uses same-level planned feat skill rank rules when selecting a skill increase', () => {
    document.body.innerHTML = '<button type="button" data-action="selectSkillIncrease" data-skill="acrobatics"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          2: {
            classFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.acrobat-dedication',
                name: 'Acrobat Dedication',
                slug: 'acrobat-dedication',
                skillRules: [
                  { skill: 'acrobatics', value: 2 },
                ],
              },
            ],
            skillIncreases: [],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    planner.actor.system.skills.acrobatics.rank = 1;

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectSkillIncrease"]').click();

    expect(planner.plan.levels[2].skillIncreases).toEqual([
      { skill: 'acrobatics', toRank: 3 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('allows manual increases past expert when a feat only granted the current rank', () => {
    document.body.innerHTML = '<button type="button" data-action="selectSkillIncrease" data-skill="medicine" data-locked="false"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          4: {
            archetypeFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.medic-dedication',
                name: 'Medic Dedication',
                slug: 'medic-dedication',
                skillRules: [
                  { skill: 'medicine', value: 2 },
                ],
              },
            ],
          },
          7: {
            skillIncreases: [],
          },
        },
      },
      selectedLevel: 7,
      _savePlanAndRender: jest.fn(),
    };

    planner.actor.system.skills.medicine.rank = 1;

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectSkillIncrease"]').click();

    expect(planner.plan.levels[7].skillIncreases).toEqual([
      { skill: 'medicine', toRank: 3 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('stores planner feat follow-up choices on the selected feat', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="archetypeFeats" data-flag="deity" data-value="Compendium.pf2e.deities.Item.abadar"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          2: {
            archetypeFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.champion-dedication',
                name: 'Champion Dedication',
                slug: 'champion-dedication',
              },
            ],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[2].archetypeFeats[0].choices).toEqual({
      deity: 'Compendium.pf2e.deities.Item.abadar',
    });
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('adds selected choice-item skill rules onto the planned feat', async () => {
    const originalFromUuid = global.fromUuid;
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="archetypeFeats" data-flag="druidicOrder" data-value="Compendium.pf2e.classfeatures.Item.animal-order"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          2: {
            archetypeFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
                name: 'Druid Dedication',
                slug: 'druid-dedication',
                dynamicSkillRules: [{ skill: 'nature', value: 1, source: 'base-choice' }],
              },
            ],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.classfeatures.Item.animal-order') {
        return {
          uuid,
          name: 'Animal Order',
          system: {
            description: {
              value: '<p>Order Skill Athletics</p>',
            },
            rules: [
              { key: 'ActiveEffectLike', path: 'system.skills.athletics.rank', value: 1 },
            ],
          },
        };
      }
      return null;
    });

    try {
      activateLevelPlannerListeners(planner, document.body);
      document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
      await flushAsyncListeners();

      expect(planner.plan.levels[2].archetypeFeats[0].choices).toEqual({
        druidicOrder: 'Compendium.pf2e.classfeatures.Item.animal-order',
      });
      expect(planner.plan.levels[2].archetypeFeats[0].dynamicSkillRules).toEqual(expect.arrayContaining([
        expect.objectContaining({ skill: 'nature', source: 'base-choice' }),
        expect.objectContaining({ skill: 'athletics', source: 'choice:druidicorder' }),
      ]));
    } finally {
      global.fromUuid = originalFromUuid;
    }
  });

  it('adds selected training-granting skill choices onto the planned feat', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="archetypeFeats" data-flag="skill" data-value="survival" data-grants-skill-training="true"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          4: {
            archetypeFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.investigator-dedication',
                name: 'Investigator Dedication',
                slug: 'investigator-dedication',
              },
            ],
          },
        },
      },
      selectedLevel: 4,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[4].archetypeFeats[0].choices).toEqual({
      skill: 'survival',
    });
    expect(planner.plan.levels[4].archetypeFeats[0].dynamicSkillRules).toEqual([
      expect.objectContaining({ skill: 'survival', value: 1, source: 'choice:skill' }),
    ]);
  });

  it('shows druid dedication replacement skill choices after selecting an order in the planner', async () => {
    const originalConfig = global.CONFIG;
    const originalFromUuid = global.fromUuid;

    global.CONFIG = {
      ...(originalConfig ?? {}),
      PF2E: {
        ...(originalConfig?.PF2E ?? {}),
        skills: {
          nature: 'Nature',
          intimidation: 'Intimidation',
          deception: 'Deception',
          diplomacy: 'Diplomacy',
        },
      },
    };

    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="archetypeFeats" data-flag="druidicOrder" data-value="Compendium.pf2e.classfeatures.Item.flame-order"></button>';

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          nature: { rank: 1 },
          intimidation: { rank: 1 },
          deception: { rank: 0 },
          diplomacy: { rank: 0 },
        },
      },
    });
    actor.class.slug = 'alchemist';
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn();

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist', { freeArchetype: true });
    planner.selectedLevel = 2;
    planner.plan.levels[2].archetypeFeats = [
      {
        uuid: 'Compendium.pf2e.feats-srd.Item.druid-dedication',
        name: 'Druid Dedication',
        slug: 'druid-dedication',
      },
    ];
    planner._savePlanAndRender = jest.fn();

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'Compendium.pf2e.feats-srd.Item.druid-dedication') {
        return {
          uuid,
          name: 'Druid Dedication',
          slug: 'druid-dedication',
          system: {
            description: {
              value: "<p>You become trained in Nature and your order's associated skill; for each of these skills in which you were already trained, you instead become trained in a skill of your choice.</p>",
            },
            rules: [
              {
                key: 'ChoiceSet',
                flag: 'druidicOrder',
                prompt: 'Select a druidic order.',
                choices: { filter: ['item:tag:druid-order', { not: 'item:tag:class-archetype' }] },
              },
            ],
            traits: { value: ['archetype', 'dedication', 'multiclass', 'druid'] },
          },
        };
      }
      if (uuid === 'Compendium.pf2e.classfeatures.Item.flame-order') {
        return {
          uuid,
          name: 'Flame Order',
          system: {
            description: {
              value: '<p>Order Skill Intimidation</p>',
            },
            rules: [],
          },
        };
      }
      return null;
    });

    try {
      activateLevelPlannerListeners(planner, document.body);
      document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
      await flushAsyncListeners();

      const context = await planner._buildLevelContext(ClassRegistry.get('alchemist'), planner._getVariantOptions());
      const fallbackSets = context.archetypeFeatChoiceSets.filter((entry) => entry.flag.startsWith('levelerSkillFallback'));
      expect(fallbackSets).toHaveLength(2);
    } finally {
      global.CONFIG = originalConfig;
      global.fromUuid = originalFromUuid;
    }
  });

  it('stores custom feat follow-up choices on the matching custom feat entry', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="customFeats" data-index="1" data-flag="deity" data-value="Compendium.pf2e.deities.Item.abadar"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          2: {
            customFeats: [
              { uuid: 'feat-a', name: 'Feat A', slug: 'feat-a' },
              { uuid: 'feat-b', name: 'Feat B', slug: 'feat-b' },
            ],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[2].customFeats[0].choices).toBeUndefined();
    expect(planner.plan.levels[2].customFeats[1].choices).toEqual({
      deity: 'Compendium.pf2e.deities.Item.abadar',
    });
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('adds a custom skill increase using current custom-aware rank state', () => {
    document.body.innerHTML = '<button type="button" data-action="addCustomSkillIncrease" data-skill="acrobatics"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        classSlug: 'rogue',
        levels: {
          2: {
            customSkillIncreases: [{ skill: 'acrobatics', toRank: 2 }],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    planner.actor.system.skills.acrobatics.rank = 1;
    planner._addCustomSkillIncrease = function _addCustomSkillIncrease(skill) {
      this.plan.levels[2].customSkillIncreases.push({ skill, toRank: 3 });
      this._savePlanAndRender();
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="addCustomSkillIncrease"]').click();

    expect(planner.plan.levels[2].customSkillIncreases).toEqual([
      { skill: 'acrobatics', toRank: 2 },
      { skill: 'acrobatics', toRank: 3 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('wires the manual apply button to the selected planner level', async () => {
    document.body.innerHTML = '<button type="button" data-action="applySelectedPlan"></button>';

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 2 },
        },
      },
    });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn();

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.selectedLevel = 2;

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="applySelectedPlan"]').click();
    await flushAsyncListeners();

    expect(promptApplyPlan).toHaveBeenCalledWith(planner.actor, planner.plan, 2, 1);
  });
});
