import {
  buildPlanCommentPartId,
  buildPlanCommentMessage,
  addMessageToThreads,
  setThreadResolvedInThreads,
  removeMessageFromThreads,
  getPlanComments,
  getThread,
  getCommentSummary,
  canCommentOnActor,
  postPlanComment,
  setPlanCommentResolved,
  deletePlanComment,
} from '../../../scripts/access/plan-comments.js';

const msg = (over = {}) => buildPlanCommentMessage({ id: 'm1', authorId: 'u1', authorName: 'GM', isGM: true, text: 'hi', ts: 1, ...over });

describe('plan-comments part IDs', () => {
  it('builds level and creation part IDs', () => {
    expect(buildPlanCommentPartId({ scope: 'level', level: 3, key: 'classFeat' })).toBe('level:3:classFeat');
    expect(buildPlanCommentPartId({ scope: 'creation', key: 'ancestry' })).toBe('creation:ancestry');
    expect(buildPlanCommentPartId({ scope: 'nope', key: 'x' })).toBeNull();
  });
});

describe('buildPlanCommentMessage', () => {
  it('normalizes fields and filters non-string item uuids', () => {
    expect(buildPlanCommentMessage({ id: 'a', text: 'x', items: ['U', 5, '', null, 'V'] }))
      .toEqual({ id: 'a', authorId: null, authorName: '', isGM: false, text: 'x', ts: 0, items: ['U', 'V'] });
    expect(buildPlanCommentMessage({}).items).toEqual([]);
  });
});

describe('thread transforms (immutable)', () => {
  it('addMessageToThreads creates a thread and does not mutate input', () => {
    const threads = {};
    const next = addMessageToThreads(threads, 'level:3:classFeat', msg());
    expect(next['level:3:classFeat']).toEqual({ resolved: false, messages: [msg()] });
    expect(threads).toEqual({});
  });

  it('addMessageToThreads appends to an existing thread preserving resolved', () => {
    const threads = { p: { resolved: true, messages: [msg({ id: 'm1' })] } };
    const next = addMessageToThreads(threads, 'p', msg({ id: 'm2' }));
    expect(next.p.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(next.p.resolved).toBe(true);
    expect(threads.p.messages).toHaveLength(1);
  });

  it('setThreadResolvedInThreads toggles resolved, no-op when thread missing', () => {
    const threads = { p: { resolved: false, messages: [msg()] } };
    expect(setThreadResolvedInThreads(threads, 'p', true).p.resolved).toBe(true);
    expect(setThreadResolvedInThreads(threads, 'missing', true).missing).toBeUndefined();
    expect(threads.p.resolved).toBe(false);
  });

  it('removeMessageFromThreads drops the thread key when last message removed', () => {
    const threads = { p: { resolved: false, messages: [msg({ id: 'm1' })] } };
    const next = removeMessageFromThreads(threads, 'p', 'm1');
    expect(next.p).toBeUndefined();
    expect(threads.p.messages).toHaveLength(1);
  });

  it('removeMessageFromThreads keeps the thread when other messages remain', () => {
    const threads = { p: { resolved: true, messages: [msg({ id: 'm1' }), msg({ id: 'm2' })] } };
    const next = removeMessageFromThreads(threads, 'p', 'm1');
    expect(next.p.messages.map((m) => m.id)).toEqual(['m2']);
    expect(next.p.resolved).toBe(true);
  });
});

describe('reads', () => {
  const actor = (threads) => ({ getFlag: jest.fn(() => threads) });

  it('getPlanComments defends against non-objects', () => {
    expect(getPlanComments(actor(undefined))).toEqual({});
    expect(getPlanComments(actor(null))).toEqual({});
    expect(getPlanComments(actor({ p: 1 }))).toEqual({ p: 1 });
  });

  it('getCommentSummary reports count/resolved/hasUnresolved', () => {
    const a = actor({ p: { resolved: false, messages: [msg(), msg({ id: 'm2' })] } });
    expect(getCommentSummary(a, 'p')).toEqual({ count: 2, isEmpty: false, resolved: false, hasUnresolved: true });
    expect(getCommentSummary(actor({}), 'p')).toEqual({ count: 0, isEmpty: true, resolved: false, hasUnresolved: false });
    const r = actor({ p: { resolved: true, messages: [msg()] } });
    expect(getCommentSummary(r, 'p').hasUnresolved).toBe(false);
  });
});

describe('canCommentOnActor', () => {
  const realGM = global.game.user.isGM;
  afterEach(() => { global.game.user.isGM = realGM; });
  it('is true for GM or owner, false otherwise', () => {
    global.game.user.isGM = true;
    expect(canCommentOnActor({ isOwner: false })).toBe(true);
    global.game.user.isGM = false;
    expect(canCommentOnActor({ isOwner: true })).toBe(true);
    expect(canCommentOnActor({ isOwner: false })).toBe(false);
  });
});

describe('writers', () => {
  const realGM = global.game.user.isGM;
  beforeEach(() => { global.foundry.utils.randomID = jest.fn(() => 'gen-id'); });
  afterEach(() => { global.game.user.isGM = realGM; });

  it('postPlanComment writes a new message with recursive:false and returns it', async () => {
    global.game.user.isGM = true;
    const update = jest.fn(() => Promise.resolve());
    const actor = { isOwner: true, getFlag: jest.fn(() => ({})), update };
    const out = await postPlanComment(actor, 'level:3:classFeat', { text: '  hello  ', items: ['U'] });
    expect(out).toMatchObject({ id: 'gen-id', text: 'hello', items: ['U'], isGM: true });
    expect(update).toHaveBeenCalledWith(
      { 'flags.pf2e-leveler.planComments': { 'level:3:classFeat': { resolved: false, messages: [expect.objectContaining({ id: 'gen-id', text: 'hello' })] } } },
      { recursive: false },
    );
  });

  it('postPlanComment refuses empty text and non-commenters', async () => {
    global.game.user.isGM = true;
    const actor = { isOwner: true, getFlag: jest.fn(() => ({})), update: jest.fn() };
    expect(await postPlanComment(actor, 'p', { text: '   ' })).toBeNull();
    global.game.user.isGM = false;
    const denied = { isOwner: false, getFlag: jest.fn(() => ({})), update: jest.fn() };
    expect(await postPlanComment(denied, 'p', { text: 'hi' })).toBeNull();
    expect(denied.update).not.toHaveBeenCalled();
  });

  it('deletePlanComment removes the message via recursive:false write', async () => {
    global.game.user.isGM = true;
    const update = jest.fn(() => Promise.resolve());
    const actor = { isOwner: true, getFlag: jest.fn(() => ({ p: { resolved: false, messages: [{ id: 'm1' }] } })), update };
    await deletePlanComment(actor, 'p', 'm1');
    expect(update).toHaveBeenCalledWith({ 'flags.pf2e-leveler.planComments': {} }, { recursive: false });
  });
});
