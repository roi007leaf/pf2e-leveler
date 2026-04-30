import { getPlan, savePlan, clearPlan, hasPlan } from '../../../scripts/plan/plan-store.js';

describe('Plan Store', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      name: 'Test Character',
      getFlag: jest.fn(),
      setFlag: jest.fn(() => Promise.resolve()),
      unsetFlag: jest.fn(() => Promise.resolve()),
    };
  });

  test('getPlan returns null when no plan exists', () => {
    mockActor.getFlag.mockReturnValue(undefined);
    expect(getPlan(mockActor)).toBeNull();
  });

  test('getPlan returns stored plan', () => {
    const plan = { version: 1, classSlug: 'alchemist' };
    mockActor.getFlag.mockReturnValue(plan);
    expect(getPlan(mockActor)).toBe(plan);
  });

  test('savePlan calls setFlag with correct args', async () => {
    const plan = { version: 1, classSlug: 'alchemist', levels: {} };
    await savePlan(mockActor, plan);
    expect(plan.archetypeDedicationProgress).toEqual({
      version: 1,
      atLevel: 20,
      canTakeNewDedication: true,
      dedications: [],
    });
    expect(mockActor.setFlag).toHaveBeenCalledWith('pf2e-leveler', 'plan', plan);
  });

  test('clearPlan calls unsetFlag', async () => {
    await clearPlan(mockActor);
    expect(mockActor.unsetFlag).toHaveBeenCalledWith('pf2e-leveler', 'plan');
  });

  test('hasPlan returns true when plan exists', () => {
    mockActor.getFlag.mockReturnValue({ version: 1 });
    expect(hasPlan(mockActor)).toBe(true);
  });

  test('hasPlan returns false when no plan', () => {
    mockActor.getFlag.mockReturnValue(undefined);
    expect(hasPlan(mockActor)).toBe(false);
  });
});
