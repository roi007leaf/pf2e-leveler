import { buildSkillRetrainSources, getClassFeaturesForLevel, isAdvancedMulticlassFeatCandidate } from '../../../scripts/ui/level-planner/level-context.js';
import { buildSkillContext } from '../../../scripts/ui/level-planner/context.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { ALCHEMIST } from '../../../scripts/classes/alchemist.js';
import { ROGUE } from '../../../scripts/classes/rogue.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';

describe('isAdvancedMulticlassFeatCandidate', () => {
  test('true for an "Advanced" archetype feat with no GrantItem', () => {
    const source = { system: { slug: 'advanced-bloodline', traits: { value: ['archetype'] }, rules: [] } };
    expect(isAdvancedMulticlassFeatCandidate({ slug: 'advanced-bloodline' }, source)).toBe(true);
  });

  test('false for a base class feat like Advanced Domain (no archetype trait)', () => {
    const source = { system: { slug: 'advanced-domain', traits: { value: ['cleric'] }, rules: [{ key: 'ActiveEffectLike', path: 'flags.system.soulWarden.featCount', value: 1 }] } };
    expect(isAdvancedMulticlassFeatCandidate({ slug: 'advanced-domain' }, source)).toBe(false);
  });

  test('false for an "Advanced" archetype feat that already grants an item', () => {
    const source = { system: { slug: 'advanced-deity', traits: { value: ['archetype'] }, rules: [{ key: 'GrantItem', uuid: 'Compendium.x.Item.y' }] } };
    expect(isAdvancedMulticlassFeatCandidate({ slug: 'advanced-deity' }, source)).toBe(false);
  });

  test('true for Basic/Advanced Concoction regardless of traits', () => {
    expect(isAdvancedMulticlassFeatCandidate({ slug: 'advanced-concoction' }, { system: { slug: 'advanced-concoction', traits: { value: ['archetype'] }, rules: [] } })).toBe(true);
  });
});

describe('level planner class feature context', () => {
  beforeAll(() => {
    ClassRegistry.clear();
    ClassRegistry.register(ALCHEMIST);
    ClassRegistry.register(ROGUE);
  });

  test('includes secondary dual-class features in level display', () => {
    const planner = {
      actor: createMockActor({
        class: {
          slug: 'alchemist',
          name: 'Alchemist',
          system: {
            items: {
              fieldDiscovery: {
                level: 5,
                name: 'Field Discovery',
                uuid: 'Compendium.pf2e.classes.Item.field-discovery',
                img: 'field.png',
              },
            },
          },
        },
      }),
      plan: {
        classSlug: 'alchemist',
        dualClassSlug: 'rogue',
      },
    };

    const features = getClassFeaturesForLevel(planner, 5);

    expect(features).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Field Discovery' }),
      expect.objectContaining({ name: 'Weapon Tricks' }),
    ]));
  });

  test('uses SF2e skills in planner skill increase choices', () => {
    const originalConfig = global.CONFIG;
    const originalSystemId = global.game.system.id;
    global.game.system.id = 'sf2e';
    global.CONFIG = {
      SF2E: {
        skills: {
          acrobatics: { label: 'Acrobatics' },
          computers: { label: 'Computers' },
          piloting: { label: 'Piloting' },
        },
      },
      PF2E: {
        skills: {
          acrobatics: { label: 'Acrobatics' },
          arcana: { label: 'Arcana' },
        },
      },
    };

    try {
      const actor = createMockActor();
      actor.system.skills = {
        acrobatics: { rank: 0 },
        computers: { rank: 0 },
        piloting: { rank: 0 },
      };
      const context = buildSkillContext({
        actor,
        plan: { classSlug: 'envoy', levels: {} },
      }, { skillIncreases: [] }, 3);

      expect(context.map((entry) => entry.slug)).toEqual(['acrobatics', 'computers', 'piloting']);
      expect(context.find((entry) => entry.slug === 'computers')).toEqual(expect.objectContaining({
        label: 'Computers',
      }));
    } finally {
      global.CONFIG = originalConfig;
      global.game.system.id = originalSystemId;
    }
  });

  test('includes automatic initial granted skills as retrain sources', () => {
    const actor = createMockActor();
    actor.class.slug = 'rogue';
    actor.class.system.trainedSkills = { value: ['stealth'], additional: 7 };
    actor.background = {
      type: 'background',
      name: 'Field Medic',
      system: {
        trainedSkills: { value: ['medicine'] },
      },
    };
    actor.items = [
      actor.background,
      {
        type: 'feat',
        name: 'Thief Racket',
        system: {
          traits: { otherTags: ['rogue-racket'] },
          rules: [
            {
              key: 'ActiveEffectLike',
              path: 'system.skills.thievery.rank',
              value: 1,
            },
          ],
        },
      },
    ];
    const plan = {
      ...createPlan('rogue'),
      importedFromActor: {
        actorLevel: 8,
        hideHistoricalSkillIncreases: true,
        initialSkills: ['acrobatics'],
      },
    };

    const sources = buildSkillRetrainSources({ actor, plan }, 2);

    expect(sources.map((source) => source.skill)).toEqual(expect.arrayContaining([
      'acrobatics',
      'medicine',
      'stealth',
      'thievery',
    ]));
  });
});
