import {
  canResolveThread,
  countAwaitingComments,
  getCommentNotifyRecipients,
  notifyCommentPosted,
  threadAwaitsViewer,
} from '../../../scripts/access/plan-comments.js';

const gmMsg = (over = {}) => ({ id: 'g', isGM: true, authorName: 'GM', text: 'hi', ts: 1, items: [], ...over });
const plMsg = (over = {}) => ({ id: 'p', isGM: false, authorName: 'Alice', text: 'ok', ts: 2, items: [], ...over });
const actorWith = (threads) => ({ getFlag: jest.fn(() => threads) });

describe('countAwaitingComments (whose-turn semantics)', () => {
  it('awaits the player when the GM spoke last and the thread is unresolved', () => {
    const a = actorWith({ 'level:3:classFeat': { resolved: false, messages: [plMsg(), gmMsg()] } });
    expect(countAwaitingComments(a, { forGM: false })).toBe(1);
    expect(countAwaitingComments(a, { forGM: true })).toBe(0);
  });

  it('awaits the GM when the player spoke last and the thread is unresolved', () => {
    const a = actorWith({ 'level:3:classFeat': { resolved: false, messages: [gmMsg(), plMsg()] } });
    expect(countAwaitingComments(a, { forGM: true })).toBe(1);
    expect(countAwaitingComments(a, { forGM: false })).toBe(0);
  });

  it('ignores resolved and empty threads', () => {
    const a = actorWith({
      resolved: { resolved: true, messages: [gmMsg()] },
      empty: { resolved: false, messages: [] },
    });
    expect(countAwaitingComments(a, { forGM: false })).toBe(0);
    expect(countAwaitingComments(a, { forGM: true })).toBe(0);
  });

  it('filters by scope prefix', () => {
    const a = actorWith({
      'level:3:classFeat': { resolved: false, messages: [gmMsg()] },
      'creation:ancestry': { resolved: false, messages: [gmMsg()] },
    });
    expect(countAwaitingComments(a, { forGM: false, scope: 'level' })).toBe(1);
    expect(countAwaitingComments(a, { forGM: false, scope: 'creation' })).toBe(1);
    expect(countAwaitingComments(a, { forGM: false })).toBe(2);
  });
});

describe('canResolveThread', () => {
  const realGM = global.game.user.isGM;
  const realId = global.game.user.id;
  afterEach(() => { global.game.user.isGM = realGM; global.game.user.id = realId; });

  it('lets the GM resolve any thread', () => {
    global.game.user.isGM = true;
    expect(canResolveThread({ isOwner: false }, { messages: [plMsg({ authorId: 'someone' })] })).toBe(true);
  });

  it('lets a player resolve only a thread they started', () => {
    global.game.user.isGM = false;
    global.game.user.id = 'u1';
    const actor = { isOwner: true };
    expect(canResolveThread(actor, { messages: [plMsg({ authorId: 'u1' }), gmMsg()] })).toBe(true);
    expect(canResolveThread(actor, { messages: [gmMsg({ authorId: 'gm' }), plMsg({ authorId: 'u1' })] })).toBe(false);
  });

  it('denies non-commenters', () => {
    global.game.user.isGM = false;
    expect(canResolveThread({ isOwner: false }, { messages: [plMsg()] })).toBe(false);
  });
});

describe('threadAwaitsViewer', () => {
  it('awaits the GM viewer when a player spoke last and the thread is unresolved', () => {
    expect(threadAwaitsViewer({ resolved: false, messages: [gmMsg(), plMsg()] }, true)).toBe(true);
    expect(threadAwaitsViewer({ resolved: false, messages: [gmMsg(), plMsg()] }, false)).toBe(false);
  });
  it('awaits the player viewer when the GM spoke last and the thread is unresolved', () => {
    expect(threadAwaitsViewer({ resolved: false, messages: [plMsg(), gmMsg()] }, false)).toBe(true);
    expect(threadAwaitsViewer({ resolved: false, messages: [plMsg(), gmMsg()] }, true)).toBe(false);
  });
  it('never awaits when resolved, empty, or missing', () => {
    expect(threadAwaitsViewer({ resolved: true, messages: [plMsg()] }, true)).toBe(false);
    expect(threadAwaitsViewer({ resolved: false, messages: [] }, true)).toBe(false);
    expect(threadAwaitsViewer(null, true)).toBe(false);
  });
});

describe('getCommentNotifyRecipients', () => {
  const realGM = global.game.user.isGM;
  const realUsers = global.game.users;
  afterEach(() => {
    global.game.user.isGM = realGM;
    global.game.users = realUsers;
    delete global.ChatMessage.getWhisperRecipients;
  });

  it('GM poster notifies owning players', () => {
    global.game.user.isGM = true;
    const players = [{ id: 'u1', isGM: false }, { id: 'u2', isGM: false }];
    global.game.users = { players };
    const actor = { testUserPermission: (u) => u.id === 'u1' };
    expect(getCommentNotifyRecipients(actor)).toEqual([players[0]]);
  });

  it('player poster notifies the GMs', () => {
    global.game.user.isGM = false;
    const gms = [{ id: 'gm1', isGM: true }];
    global.ChatMessage.getWhisperRecipients = jest.fn(() => gms);
    expect(getCommentNotifyRecipients({})).toEqual(gms);
  });
});

describe('notifyCommentPosted', () => {
  const realGM = global.game.user.isGM;
  const realUsers = global.game.users;
  beforeEach(() => { global.foundry.utils.escapeHTML = (s) => String(s ?? ''); });
  afterEach(() => {
    global.game.user.isGM = realGM;
    global.game.users = realUsers;
    global.ChatMessage.create.mockClear();
  });

  it('whispers the other party with an actor link and snippet, excluding self', () => {
    global.game.user.isGM = true;
    global.game.user.id = 'me-gm';
    global.game.users = { players: [{ id: 'u1', isGM: false }] };
    const actor = { uuid: 'Actor.abc', name: 'Calder', testUserPermission: (u) => u.id === 'u1' };
    const formatSpy = jest.spyOn(global.game.i18n, 'format');
    return notifyCommentPosted({ actor, partLabel: 'Class Feat', message: { authorName: 'GM', text: 'rethink this', isGM: true } }).then(() => {
      expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
      const arg = global.ChatMessage.create.mock.calls[0][0];
      expect(arg.whisper).toEqual(['u1']);
      expect(arg.content).toContain('@UUID[Actor.abc]{Calder}');
      expect(arg.content).toContain('rethink this');
      // The part label reaches the message via the NOTIFY i18n template (not expanded by the test mock).
      expect(formatSpy).toHaveBeenCalledWith('PF2E_LEVELER.PLAN_COMMENTS.NOTIFY', expect.objectContaining({ part: 'Class Feat', author: 'GM' }));
      formatSpy.mockRestore();
    });
  });

  it('does nothing when there are no recipients', () => {
    global.game.user.isGM = true;
    global.game.users = { players: [] };
    const actor = { uuid: 'Actor.abc', name: 'Calder', testUserPermission: () => false };
    return notifyCommentPosted({ actor, partLabel: 'X', message: { authorName: 'GM', text: 'y', isGM: true } }).then(() => {
      expect(global.ChatMessage.create).not.toHaveBeenCalled();
    });
  });
});
