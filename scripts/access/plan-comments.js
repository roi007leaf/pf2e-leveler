import { MODULE_ID } from '../constants.js';

export const PLAN_COMMENTS_FLAG = 'planComments';

export function buildPlanCommentPartId({ scope, key, level } = {}) {
  if (scope === 'level') return `level:${level}:${key}`;
  if (scope === 'creation') return `creation:${key}`;
  return null;
}

export function buildPlanCommentMessage({ id, authorId, authorName, isGM, text, ts, items } = {}) {
  return {
    id: id ?? null,
    authorId: authorId ?? null,
    authorName: authorName ?? '',
    isGM: isGM === true,
    text: typeof text === 'string' ? text : '',
    ts: ts ?? 0,
    items: Array.isArray(items) ? items.filter((u) => typeof u === 'string' && u) : [],
  };
}

export function addMessageToThreads(threads, partId, message) {
  const base = threads && typeof threads === 'object' ? threads : {};
  const existing = base[partId] ?? { resolved: false, messages: [] };
  return {
    ...base,
    [partId]: {
      resolved: existing.resolved === true,
      messages: [...(Array.isArray(existing.messages) ? existing.messages : []), message],
    },
  };
}

export function setThreadResolvedInThreads(threads, partId, resolved) {
  const base = threads && typeof threads === 'object' ? threads : {};
  if (!base[partId]) return { ...base };
  return { ...base, [partId]: { ...base[partId], resolved: resolved === true } };
}

export function removeMessageFromThreads(threads, partId, messageId) {
  const base = threads && typeof threads === 'object' ? threads : {};
  const existing = base[partId];
  if (!existing) return { ...base };
  const messages = (Array.isArray(existing.messages) ? existing.messages : []).filter((m) => m?.id !== messageId);
  const next = { ...base };
  if (messages.length === 0) delete next[partId];
  else next[partId] = { ...existing, messages };
  return next;
}

export function getPlanComments(actor) {
  const value = actor?.getFlag?.(MODULE_ID, PLAN_COMMENTS_FLAG);
  return value && typeof value === 'object' ? value : {};
}

export function getThread(actor, partId) {
  return getPlanComments(actor)[partId] ?? null;
}

export function getCommentSummary(actor, partId) {
  const thread = getThread(actor, partId);
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return {
    count: messages.length,
    isEmpty: messages.length === 0,
    resolved: thread?.resolved === true,
    hasUnresolved: messages.length > 0 && thread?.resolved !== true,
  };
}

export function canCommentOnActor(actor) {
  return game.user?.isGM === true || actor?.isOwner === true;
}

async function writePlanComments(actor, nextThreads) {
  await actor.update({ [`flags.${MODULE_ID}.${PLAN_COMMENTS_FLAG}`]: nextThreads }, { recursive: false });
}

export async function postPlanComment(actor, partId, { text, items } = {}) {
  if (!canCommentOnActor(actor)) return null;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return null;
  const message = buildPlanCommentMessage({
    id: foundry.utils.randomID(),
    authorId: game.user?.id ?? null,
    authorName: game.user?.name ?? '',
    isGM: game.user?.isGM === true,
    text: trimmed,
    ts: Date.now(),
    items,
  });
  await writePlanComments(actor, addMessageToThreads(getPlanComments(actor), partId, message));
  return message;
}

export async function setPlanCommentResolved(actor, partId, resolved) {
  if (!canCommentOnActor(actor)) return;
  await writePlanComments(actor, setThreadResolvedInThreads(getPlanComments(actor), partId, resolved));
}

export async function deletePlanComment(actor, partId, messageId) {
  if (!canCommentOnActor(actor)) return;
  await writePlanComments(actor, removeMessageFromThreads(getPlanComments(actor), partId, messageId));
}
