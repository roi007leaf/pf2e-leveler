import { canOpenCreationWizard, getCreationButtonTitle, normalizePreparationGroupRank } from '../../../scripts/ui/sheet-integration.js';

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
  test('allows opening the creation wizard for any character', () => {
    expect(canOpenCreationWizard(createMockActor())).toBe(true);
    expect(canOpenCreationWizard({ type: 'npc' })).toBe(false);
  });

  test('uses an edit label after a class exists', () => {
    expect(getCreationButtonTitle(createMockActor())).toBe('PF2E_LEVELER.CREATION.EDIT_BUTTON');
    expect(getCreationButtonTitle(createMockActor({ class: null }))).toBe('PF2E_LEVELER.CREATION.BUTTON');
  });
});
