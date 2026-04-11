import { canOpenCreationWizard, getCreationButtonTitle, isSupportedClass, normalizePreparationGroupRank } from '../../../scripts/ui/sheet-integration.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';

describe('normalizePreparationGroupRank', () => {
  test('maps cantrip group ids to rank 0', () => {
    expect(normalizePreparationGroupRank('cantrips')).toBe(0);
    expect(normalizePreparationGroupRank('cantrip')).toBe(0);
  });

  test('maps numeric group ids to numeric spell ranks', () => {
    expect(normalizePreparationGroupRank('1')).toBe(1);
    expect(normalizePreparationGroupRank(3)).toBe(3);
  });

  test('returns null for unsupported group ids', () => {
    expect(normalizePreparationGroupRank('focus')).toBeNull();
    expect(normalizePreparationGroupRank(null)).toBeNull();
  });
});

describe('creation wizard sheet access', () => {
  beforeEach(() => {
    ClassRegistry.clear();
  });

  test('allows opening the creation wizard for any character', () => {
    expect(canOpenCreationWizard(createMockActor())).toBe(true);
    expect(canOpenCreationWizard({ type: 'npc' })).toBe(false);
  });

  test('uses an edit label after a class exists', () => {
    expect(getCreationButtonTitle(createMockActor())).toBe('PF2E_LEVELER.CREATION.EDIT_BUTTON');
    expect(getCreationButtonTitle(createMockActor({ class: null }))).toBe('PF2E_LEVELER.CREATION.BUTTON');
  });

  test('self-heals class registry checks for supported classes', () => {
    const actor = createMockActor({
      class: { slug: 'druid' },
    });

    expect(ClassRegistry.getSlugs()).toEqual([]);
    expect(isSupportedClass(actor)).toBe(true);
    expect(ClassRegistry.has('druid')).toBe(true);
  });

  test('supports custom compendium classes by registering them from the actor class item', () => {
    const actor = createMockActor({
      class: {
        slug: 'eldamon-trainer',
        name: 'Eldamon Trainer',
        system: {
          hp: 8,
          keyAbility: { value: ['cha'] },
          trainedSkills: { value: ['diplomacy'], additional: 3 },
          classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
          generalFeatLevels: { value: [3, 7, 11, 15, 19] },
          ancestryFeatLevels: { value: [1, 5, 9, 13, 17] },
          skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
          items: {},
        },
      },
    });

    expect(isSupportedClass(actor)).toBe(true);
    expect(ClassRegistry.has('eldamon-trainer')).toBe(true);
  });
});
