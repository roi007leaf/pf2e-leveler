import { activateLevelPlannerListeners } from '../../../scripts/ui/level-planner/listeners.js';
import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';

jest.mock('../../../scripts/apply/apply-manager.js', () => ({
  promptApplyPlan: jest.fn(async () => true),
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

  it('stores planned class feature choices', () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedClassFeatureChoice" data-feature-key="blessing-of-the-devoted" data-flag="blessing" data-value="Compendium.pf2e.classfeatures.Item.blessing-swiftness" data-label="Blessing of Swiftness" data-slug="blessing-of-swiftness"></button>';

    const planner = {
      plan: {
        levels: {
          3: {},
        },
      },
      selectedLevel: 3,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedClassFeatureChoice"]').click();

    expect(planner.plan.levels[3].classFeatureChoices).toEqual({
      'blessing-of-the-devoted': {
        blessing: {
          value: 'Compendium.pf2e.classfeatures.Item.blessing-swiftness',
          label: 'Blessing of Swiftness',
          slug: 'blessing-of-swiftness',
        },
      },
    });
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('removes planned feat and skill retrains', () => {
    document.body.innerHTML = `
      <button type="button" data-action="removeFeatRetrain" data-index="0"></button>
      <button type="button" data-action="removeSkillRetrain" data-index="0"></button>
    `;

    const planner = {
      plan: {
        levels: {
          8: {
            retrainedFeats: [{ original: { name: 'Old Feat' }, replacement: { name: 'New Feat' } }],
            retrainedSkillIncreases: [{ original: { skill: 'stealth' }, replacement: { skill: 'occultism' } }],
          },
        },
      },
      selectedLevel: 8,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="removeFeatRetrain"]').click();
    document.querySelector('[data-action="removeSkillRetrain"]').click();

    expect(planner.plan.levels[8].retrainedFeats).toEqual([]);
    expect(planner.plan.levels[8].retrainedSkillIncreases).toEqual([]);
    expect(planner._savePlanAndRender).toHaveBeenCalledTimes(2);
  });

  it('filters intelligence bonus languages by label or slug without rerendering', () => {
    document.body.innerHTML = `
      <div class="level-section">
        <input type="text" data-action="searchIntBonusLanguages">
        <button type="button" data-action="toggleIntBonusLanguage" data-language="draconic" data-name="Draconic"></button>
        <button type="button" data-action="toggleIntBonusLanguage" data-language="elven" data-name="Elven"></button>
        <button type="button" data-action="toggleIntBonusLanguage" data-language="undercommon" data-name="Undercommon"></button>
      </div>
    `;

    const planner = {
      _handleIntBonusLanguageToggle: jest.fn(),
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    const search = document.querySelector('[data-action="searchIntBonusLanguages"]');
    search.value = 'dra';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.querySelector('[data-language="draconic"]').hidden).toBe(false);
    expect(document.querySelector('[data-language="elven"]').hidden).toBe(true);
    expect(document.querySelector('[data-language="undercommon"]').hidden).toBe(true);
    expect(planner._savePlanAndRender).not.toHaveBeenCalled();

    search.value = 'under';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.querySelector('[data-language="draconic"]').hidden).toBe(true);
    expect(document.querySelector('[data-language="undercommon"]').hidden).toBe(false);
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

  it('moves the same-level skill increase onto a selected feat-trained skill when legal', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="generalFeats" data-flag="levelerSkillFallback1" data-value="arcana" data-grants-skill-training="true"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          3: {
            generalFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
                name: 'Ancestral Paragon',
                slug: 'ancestral-paragon',
              },
            ],
            skillIncreases: [{ skill: 'acrobatics', toRank: 2 }],
          },
        },
      },
      selectedLevel: 3,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[3].generalFeats[0].dynamicSkillRules).toEqual([
      { skill: 'arcana', value: 1, source: 'choice:levelerskillfallback1' },
    ]);
    expect(planner.plan.levels[3].skillIncreases).toEqual([
      { skill: 'arcana', toRank: 2 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('moves the same-level skill increase onto a browsed feat that grants a skill rank', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="generalFeats" data-flag="ancestralParagon" data-value="Compendium.pf2e.feats-srd.Item.eye-for-treasure"></button>';
    global.fromUuid = jest.fn(async () => ({
      uuid: 'Compendium.pf2e.feats-srd.Item.eye-for-treasure',
      name: 'Eye for Treasure',
      system: {
        rules: [
          { key: 'ActiveEffectLike', mode: 'upgrade', path: 'system.skills.crafting.rank', value: 1 },
        ],
      },
    }));

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          3: {
            generalFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
                name: 'Ancestral Paragon',
                slug: 'ancestral-paragon',
              },
            ],
            skillIncreases: [{ skill: 'acrobatics', toRank: 2 }],
          },
        },
      },
      selectedLevel: 3,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[3].generalFeats[0].dynamicSkillRules).toEqual([
      { skill: 'crafting', value: 1, predicate: null, source: 'choice:ancestralparagon' },
    ]);
    expect(planner.plan.levels[3].skillIncreases).toEqual([
      { skill: 'crafting', toRank: 2 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('does not move the same-level skill increase when the feat-trained skill cannot be upgraded', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="generalFeats" data-flag="levelerSkillFallback1" data-value="arcana" data-grants-skill-training="true"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          3: {
            generalFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
                name: 'Ancestral Paragon',
                slug: 'ancestral-paragon',
              },
            ],
            skillIncreases: [{ skill: 'acrobatics', toRank: 2 }],
          },
        },
      },
      selectedLevel: 3,
      _savePlanAndRender: jest.fn(),
    };
    planner.actor.system.skills.arcana.rank = 2;

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[3].skillIncreases).toEqual([
      { skill: 'acrobatics', toRank: 2 },
    ]);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('stores nested granted feat choices on the source planned feat', async () => {
    document.body.innerHTML = '<button type="button" data-action="selectPlannedFeatChoice" data-category="generalFeats" data-flag="cantrip" data-value="Compendium.pf2e.spells-srd.Item.daze"></button>';

    const planner = {
      actor: createMockActor(),
      plan: {
        levels: {
          3: {
            generalFeats: [
              {
                uuid: 'Compendium.pf2e.feats-srd.Item.ancestral-paragon',
                name: 'Ancestral Paragon',
                slug: 'ancestral-paragon',
                choices: {
                  ancestralParagon: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
                },
              },
            ],
          },
        },
      },
      selectedLevel: 3,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="selectPlannedFeatChoice"]').click();
    await flushAsyncListeners();

    expect(planner.plan.levels[3].generalFeats[0].choices).toEqual({
      ancestralParagon: 'Compendium.pf2e.feats-srd.Item.arcane-tattoos',
      cantrip: 'Compendium.pf2e.spells-srd.Item.daze',
    });
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });

  it('opens a planned feat choice picker from nested choice set browse controls', () => {
    document.body.innerHTML = '<button type="button" data-action="openPlannedFeatChoicePicker" data-category="generalFeats" data-flag="cantrip" data-index="0"></button>';

    const planner = {
      selectedLevel: 3,
      _openPlannedFeatChoicePicker: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="openPlannedFeatChoicePicker"]').click();

    expect(planner._openPlannedFeatChoicePicker).toHaveBeenCalledWith({
      category: 'generalFeats',
      flag: 'cantrip',
      index: 0,
    });
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

  it('opens feat grant picker from requirement buttons', () => {
    document.body.innerHTML = '<button type="button" data-action="openFeatGrantPicker" data-requirement-id="req-formula"></button>';

    const planner = {
      _openFeatGrantPicker: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="openFeatGrantPicker"]').click();

    expect(planner._openFeatGrantPicker).toHaveBeenCalledWith('req-formula');
  });

  it('removes stored feat grant selections from the current level', () => {
    document.body.innerHTML = '<button type="button" data-action="removeFeatGrantSelection" data-requirement-id="req-formula" data-uuid="item-a"></button>';

    const planner = {
      plan: {
        levels: {
          2: {
            featGrants: [
              {
                requirementId: 'req-formula',
                kind: 'formula',
                selections: [
                  { uuid: 'item-a', name: 'Item A' },
                ],
              },
            ],
          },
        },
      },
      selectedLevel: 2,
      _savePlanAndRender: jest.fn(),
    };

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="removeFeatGrantSelection"]').click();

    expect(planner.plan.levels[2].featGrants).toEqual([]);
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

  it('wires sequential finish to apply every planned level before ending sequential mode', async () => {
    document.body.innerHTML = '<button type="button" data-action="sequentialFinish"></button>';

    const actor = createMockActor({
      system: {
        details: {
          level: { value: 8 },
        },
      },
    });
    actor.getFlag = jest.fn(() => null);
    actor.setFlag = jest.fn();

    const planner = new LevelPlanner(actor);
    planner.plan = createPlan('alchemist');
    planner.plan.sequentialMode = { active: true, targetLevel: 8, currentLevel: 8 };
    planner._savePlanAndRender = jest.fn();

    activateLevelPlannerListeners(planner, document.body);
    document.querySelector('[data-action="sequentialFinish"]').click();
    await flushAsyncListeners();

    expect(promptApplyPlan).toHaveBeenCalledWith(planner.actor, planner.plan, 8, 1);
    expect(planner.plan.sequentialMode.active).toBe(false);
    expect(planner._savePlanAndRender).toHaveBeenCalled();
  });
});
