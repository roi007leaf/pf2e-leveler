import {
  planCommentsChanged,
  refreshActorPlanCommentWindows,
  onUpdateActorPlanComments,
} from '../../../scripts/hooks/plan-comments-sync.js';

beforeAll(() => {
  global.foundry.utils.hasProperty = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj) !== undefined;
});

describe('planCommentsChanged', () => {
  it('detects the planComments flag in a change diff', () => {
    expect(planCommentsChanged({ flags: { 'pf2e-leveler': { planComments: {} } } })).toBe(true);
    expect(planCommentsChanged({ system: { details: {} } })).toBe(false);
    expect(planCommentsChanged({})).toBe(false);
  });
});

describe('refreshActorPlanCommentWindows', () => {
  afterEach(() => { global.ui.windows = {}; });
  it('re-renders only leveler windows bound to the actor', () => {
    const planner = { options: { id: 'pf2e-leveler-planner' }, actor: { id: 'a1' }, render: jest.fn() };
    const wizard = { options: { id: 'pf2e-leveler-wizard' }, actor: { id: 'a2' }, render: jest.fn() };
    const other = { options: { id: 'something-else' }, actor: { id: 'a1' }, render: jest.fn() };
    global.ui.windows = { 0: planner, 1: wizard, 2: other };
    refreshActorPlanCommentWindows('a1');
    expect(planner.render).toHaveBeenCalledWith(false);
    expect(wizard.render).not.toHaveBeenCalled();
    expect(other.render).not.toHaveBeenCalled();
  });
});

describe('onUpdateActorPlanComments', () => {
  afterEach(() => { global.ui.windows = {}; });
  it('refreshes when the comments flag changed, ignores otherwise', () => {
    const planner = { options: { id: 'pf2e-leveler-planner' }, actor: { id: 'a1' }, render: jest.fn() };
    global.ui.windows = { 0: planner };
    onUpdateActorPlanComments({ id: 'a1' }, { system: {} });
    expect(planner.render).not.toHaveBeenCalled();
    onUpdateActorPlanComments({ id: 'a1' }, { flags: { 'pf2e-leveler': { planComments: { p: {} } } } });
    expect(planner.render).toHaveBeenCalledWith(false);
  });
});
