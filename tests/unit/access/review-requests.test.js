import {
  buildReviewRequest,
  addReviewRequest,
  updateReviewRequestStatus,
  getReviewRequests,
  isResponsibleGM,
  REVIEW_REQUEST_STATUS,
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
});
