import { activateLevelPlannerListeners } from '../../../scripts/ui/level-planner/listeners.js';

describe('Level planner skill increase listeners', () => {
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

  it('stores planner feat follow-up choices on the selected feat', () => {
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

    expect(planner.plan.levels[2].archetypeFeats[0].choices).toEqual({
      deity: 'Compendium.pf2e.deities.Item.abadar',
    });
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('stores custom feat follow-up choices on the matching custom feat entry', () => {
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
});
