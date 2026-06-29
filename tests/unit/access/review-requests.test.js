import {
  buildReviewRequest,
  addReviewRequest,
  updateReviewRequestStatus,
  removeReviewRequest,
  deleteReviewRequest,
  getReviewRequests,
  isResponsibleGM,
  REVIEW_REQUEST_STATUS,
  hasApprovedReview,
  isApplyBlockedForActor,
  isReviewFeatureActive,
} from '../../../scripts/access/review-requests.js';

describe('review-requests', () => {
  it('builds a normalized pending request', () => {
    const r = buildReviewRequest({ id: 'a', ts: 5, itemName: 'Fireball', requesterName: 'Bob' });
    expect(r).toMatchObject({
      id: 'a', ts: 5, status: 'pending', itemName: 'Fireball', requesterName: 'Bob',
      itemUuid: null, actorId: null, actorName: '', requesterUserId: null, note: '',
    });
  });

  it('appends without mutating the original list', () => {
    const list = [{ id: '1' }];
    const next = addReviewRequest(list, { id: '2' });
    expect(next).toHaveLength(2);
    expect(list).toHaveLength(1);
    expect(addReviewRequest(null, { id: 'x' })).toEqual([{ id: 'x' }]);
  });

  it('updates only the matching request status immutably', () => {
    const list = [{ id: '1', status: 'pending' }, { id: '2', status: 'pending' }];
    const next = updateReviewRequestStatus(list, '2', REVIEW_REQUEST_STATUS.RESOLVED);
    expect(next.find((e) => e.id === '2').status).toBe('resolved');
    expect(next.find((e) => e.id === '1').status).toBe('pending');
    expect(list[1].status).toBe('pending');
  });

  it('removes the matching request immutably', () => {
    const list = [{ id: '1' }, { id: '2' }];
    const next = removeReviewRequest(list, '1');
    expect(next).toEqual([{ id: '2' }]);
    expect(list).toHaveLength(2);
    expect(removeReviewRequest(null, 'x')).toEqual([]);
  });

  describe('deleteReviewRequest', () => {
    const realGet = global.game.settings.get;
    const realSet = global.game.settings.set;
    const realMessages = global.game.messages;
    afterEach(() => {
      global.game.settings.get = realGet;
      global.game.settings.set = realSet;
      global.game.messages = realMessages;
    });

    it('saves the list without the id and deletes the source whisper', async () => {
      global.game.settings.get = jest.fn(() => [{ id: '1' }, { id: '2' }]);
      global.game.settings.set = jest.fn(() => Promise.resolve());
      const del = jest.fn(() => Promise.resolve());
      global.game.messages = [{ flags: { 'pf2e-leveler': { reviewRequest: { id: '1' } } }, delete: del }];
      await deleteReviewRequest('1');
      expect(global.game.settings.set).toHaveBeenCalledWith('pf2e-leveler', 'reviewRequests', [{ id: '2' }]);
      expect(del).toHaveBeenCalled();
    });

    it('still saves when no source whisper exists', async () => {
      global.game.settings.get = jest.fn(() => [{ id: '1' }]);
      global.game.settings.set = jest.fn(() => Promise.resolve());
      global.game.messages = [];
      await deleteReviewRequest('1');
      expect(global.game.settings.set).toHaveBeenCalledWith('pf2e-leveler', 'reviewRequests', []);
    });
  });

  describe('getReviewRequests', () => {
    const realGet = global.game.settings.get;
    afterEach(() => { global.game.settings.get = realGet; });
    it('returns the stored array', () => {
      global.game.settings.get = jest.fn(() => [{ id: '1' }]);
      expect(getReviewRequests()).toEqual([{ id: '1' }]);
    });
    it('returns [] when unset or on error', () => {
      global.game.settings.get = jest.fn(() => undefined);
      expect(getReviewRequests()).toEqual([]);
      global.game.settings.get = jest.fn(() => { throw new Error('x'); });
      expect(getReviewRequests()).toEqual([]);
    });
  });

  describe('isResponsibleGM', () => {
    const realUsers = global.game.users;
    afterEach(() => { global.game.users = realUsers; });
    it('is true only when activeGM is self', () => {
      global.game.users = { activeGM: { isSelf: true } };
      expect(isResponsibleGM()).toBe(true);
      global.game.users = { activeGM: { isSelf: false } };
      expect(isResponsibleGM()).toBe(false);
      global.game.users = { activeGM: null };
      expect(isResponsibleGM()).toBe(false);
    });
  });

  describe('review approval gating', () => {
    const realGet = global.game.settings.get;
    const realIsGM = global.game.user.isGM;
    afterEach(() => { global.game.settings.get = realGet; global.game.user.isGM = realIsGM; });

    const mockSettings = (overrides) => {
      global.game.settings.get = jest.fn((_mod, key) => overrides[key]);
    };

    it('hasApprovedReview is true only for a resolved request matching the actor', () => {
      mockSettings({ reviewRequests: [{ actorId: 'a1', status: 'resolved' }, { actorId: 'a2', status: 'pending' }] });
      expect(hasApprovedReview('a1')).toBe(true);
      expect(hasApprovedReview('a2')).toBe(false);
      expect(hasApprovedReview('a3')).toBe(false);
      expect(hasApprovedReview(null)).toBe(false);
    });

    it('blocks a non-GM without approval when approval is required', () => {
      global.game.user.isGM = false;
      mockSettings({ requireReviewApproval: true, reviewRequests: [] });
      expect(isApplyBlockedForActor({ id: 'a1' })).toBe(true);
    });

    it('allows a non-GM once an approval exists', () => {
      global.game.user.isGM = false;
      mockSettings({ requireReviewApproval: true, reviewRequests: [{ actorId: 'a1', status: 'resolved' }] });
      expect(isApplyBlockedForActor({ id: 'a1' })).toBe(false);
    });

    it('never blocks a GM, and never blocks when approval is not required', () => {
      mockSettings({ requireReviewApproval: true, reviewRequests: [] });
      global.game.user.isGM = true;
      expect(isApplyBlockedForActor({ id: 'a1' })).toBe(false);
      global.game.user.isGM = false;
      mockSettings({ requireReviewApproval: false, reviewRequests: [] });
      expect(isApplyBlockedForActor({ id: 'a1' })).toBe(false);
    });

    it('isReviewFeatureActive is true if either setting is on', () => {
      mockSettings({ enableReviewRequests: true, requireReviewApproval: false });
      expect(isReviewFeatureActive()).toBe(true);
      mockSettings({ enableReviewRequests: false, requireReviewApproval: true });
      expect(isReviewFeatureActive()).toBe(true);
      mockSettings({ enableReviewRequests: false, requireReviewApproval: false });
      expect(isReviewFeatureActive()).toBe(false);
    });
  });
});
