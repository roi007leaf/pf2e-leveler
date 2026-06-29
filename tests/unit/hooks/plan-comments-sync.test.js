import {
  planCommentsChanged,
  findActorPlanCommentWindows,
  refreshActorPlanCommentWindows,
  onUpdateActorPlanComments,
} from '../../../scripts/hooks/plan-comments-sync.js';

beforeAll(() => {
  global.foundry.utils.hasProperty = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj) !== undefined;
});

// A leveler window with a live-DOM stub; refreshPlanComments queries element.* so we can
// detect that a refresh ran by watching querySelectorAll.
const makeWindow = (id, actorId) => ({
  options: { id },
  actor: { id: actorId },
  element: { querySelectorAll: jest.fn(() => []), querySelector: jest.fn(() => null) },
});

describe('planCommentsChanged', () => {
  it('detects the planComments flag in a change diff', () => {
    expect(planCommentsChanged({ flags: { 'pf2e-leveler': { planComments: {} } } })).toBe(true);
    expect(planCommentsChanged({ system: { details: {} } })).toBe(false);
    expect(planCommentsChanged({})).toBe(false);
  });
});

describe('findActorPlanCommentWindows', () => {
  afterEach(() => { global.ui.windows = {}; });
  it('returns only leveler planner/wizard windows bound to the actor', () => {
    const planner = makeWindow('pf2e-leveler-planner', 'a1');
    const wizardOther = makeWindow('pf2e-leveler-wizard', 'a2');
    const other = makeWindow('something-else', 'a1');
    global.ui.windows = { 0: planner, 1: wizardOther, 2: other };
    expect(findActorPlanCommentWindows('a1')).toEqual([planner]);
  });
});

describe('refreshActorPlanCommentWindows', () => {
  afterEach(() => { global.ui.windows = {}; });
  it('refreshes only the matching actor windows (queries their live DOM)', () => {
    const planner = makeWindow('pf2e-leveler-planner', 'a1');
    const wizardOther = makeWindow('pf2e-leveler-wizard', 'a2');
    global.ui.windows = { 0: planner, 1: wizardOther };
    refreshActorPlanCommentWindows('a1');
    expect(planner.element.querySelectorAll).toHaveBeenCalled();
    expect(wizardOther.element.querySelectorAll).not.toHaveBeenCalled();
  });
});

describe('onUpdateActorPlanComments', () => {
  afterEach(() => { global.ui.windows = {}; });
  it('refreshes when the comments flag changed, ignores otherwise', () => {
    const planner = makeWindow('pf2e-leveler-planner', 'a1');
    global.ui.windows = { 0: planner };
    onUpdateActorPlanComments({ id: 'a1' }, { system: {} });
    expect(planner.element.querySelectorAll).not.toHaveBeenCalled();
    onUpdateActorPlanComments({ id: 'a1' }, { flags: { 'pf2e-leveler': { planComments: { p: {} } } } });
    expect(planner.element.querySelectorAll).toHaveBeenCalled();
  });
});
