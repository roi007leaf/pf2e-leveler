import { MODULE_ID } from '../constants.js';

export const REVIEW_REQUESTS_SETTING = 'reviewRequests';
export const REVIEW_REQUEST_CHANNEL = `module.${MODULE_ID}`;
export const REVIEW_REQUEST_STATUS = { PENDING: 'pending', RESOLVED: 'resolved', DISMISSED: 'dismissed' };

export function buildReviewRequest({ id, ts, itemUuid, itemName, actorId, actorName, requesterUserId, requesterName, note } = {}) {
  return {
    id: id ?? null,
    ts: ts ?? 0,
    status: REVIEW_REQUEST_STATUS.PENDING,
    itemUuid: itemUuid ?? null,
    itemName: itemName ?? '',
    actorId: actorId ?? null,
    actorName: actorName ?? '',
    requesterUserId: requesterUserId ?? null,
    requesterName: requesterName ?? '',
    note: note ?? '',
  };
}

export function addReviewRequest(list, request) {
  return [...(Array.isArray(list) ? list : []), request];
}

export function updateReviewRequestStatus(list, id, status) {
  return (Array.isArray(list) ? list : []).map((entry) => (entry?.id === id ? { ...entry, status } : entry));
}

export function getReviewRequests() {
  try {
    const value = game.settings.get(MODULE_ID, REVIEW_REQUESTS_SETTING);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function isResponsibleGM() {
  return game.users?.activeGM?.isSelf === true;
}

async function saveReviewRequests(list) {
  await game.settings.set(MODULE_ID, REVIEW_REQUESTS_SETTING, list);
}

export async function recordIncomingReviewRequest(request) {
  if (!isResponsibleGM()) return;
  await saveReviewRequests(addReviewRequest(getReviewRequests(), request));
  ui.notifications?.info(
    game.i18n.format('PF2E_LEVELER.REVIEW_REQUEST.RECEIVED', {
      name: request?.requesterName ?? '',
      item: request?.itemName ?? '',
    }),
  );
}

export async function setReviewRequestStatus(id, status) {
  await saveReviewRequests(updateReviewRequestStatus(getReviewRequests(), id, status));
}

export function registerReviewRequestSocket() {
  game.socket?.on(REVIEW_REQUEST_CHANNEL, (data) => {
    if (data?.type === 'review-request' && data.request) recordIncomingReviewRequest(data.request);
  });
}

export async function submitReviewRequest({ item, actor, note } = {}) {
  const request = buildReviewRequest({
    id: foundry.utils.randomID(),
    ts: Date.now(),
    itemUuid: item?.uuid ?? null,
    itemName: item?.name ?? '',
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? '',
    requesterUserId: game.user?.id ?? null,
    requesterName: game.user?.name ?? '',
    note: note ?? '',
  });
  if (game.users?.activeGM) {
    game.socket?.emit(REVIEW_REQUEST_CHANNEL, { type: 'review-request', request });
    ui.notifications?.info(game.i18n.localize('PF2E_LEVELER.REVIEW_REQUEST.SENT'));
  } else {
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients('GM').map((user) => user.id),
      flags: { [MODULE_ID]: { reviewRequest: request } },
      content: `<p><strong>${request.requesterName}</strong> requests GM review of <strong>${request.itemName}</strong>${request.note ? `: ${request.note}` : ''}</p>`,
    });
    ui.notifications?.warn(game.i18n.localize('PF2E_LEVELER.REVIEW_REQUEST.NO_GM'));
  }
  return request;
}
