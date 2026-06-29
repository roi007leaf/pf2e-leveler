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

// A single thread "awaits the viewer" when it is unresolved and the last message came
// from the other side (GM viewer ⇢ player spoke last; player viewer ⇢ GM spoke last).
export function threadAwaitsViewer(thread, isGM) {
  if (!thread || thread.resolved === true) return false;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const last = messages[messages.length - 1];
  if (!last) return false;
  return (last.isGM === true) !== (isGM === true);
}

// "Whose turn" count: unresolved threads whose last message came from the OTHER side.
// forGM=true counts threads where a player spoke last (awaiting the GM); forGM=false
// counts threads where the GM spoke last (awaiting the player). scope ('level'|'creation')
// optionally restricts to one tool's threads.
export function countAwaitingComments(actor, { forGM = false, scope = null } = {}) {
  const threads = getPlanComments(actor);
  let count = 0;
  for (const [partId, thread] of Object.entries(threads)) {
    if (scope && !partId.startsWith(`${scope}:`)) continue;
    if (thread?.resolved === true) continue;
    const messages = Array.isArray(thread?.messages) ? thread.messages : [];
    const last = messages[messages.length - 1];
    if (!last) continue;
    const lastByGM = last.isGM === true;
    if (forGM ? !lastByGM : lastByGM) count += 1;
  }
  return count;
}

// The users to whisper when the current user posts a comment: a GM poster notifies the
// actor's owning players; a player poster notifies the GMs.
export function getCommentNotifyRecipients(actor) {
  if (game.user?.isGM === true) {
    return (game.users?.players ?? []).filter((u) => actor?.testUserPermission?.(u, 'OWNER') === true);
  }
  return ChatMessage?.getWhisperRecipients?.('GM') ?? [];
}

export async function notifyCommentPosted({ actor, partLabel, message } = {}) {
  if (!actor || !message) return;
  const recipients = getCommentNotifyRecipients(actor)
    .map((u) => u?.id)
    .filter((id) => id && id !== game.user?.id);
  if (recipients.length === 0) return;
  const esc = foundry.utils.escapeHTML;
  const link = `@UUID[${actor.uuid}]{${actor.name ?? ''}}`;
  const intro = game.i18n.format('PF2E_LEVELER.PLAN_COMMENTS.NOTIFY', {
    author: esc(message.authorName ?? ''),
    part: esc(partLabel ?? ''),
  });
  const snippet = String(message.text ?? '').slice(0, 140);
  await ChatMessage.create({
    whisper: recipients,
    flags: { [MODULE_ID]: { planCommentNotice: true } },
    content: `<p>${link} — ${intro}</p>${snippet ? `<blockquote>${esc(snippet)}</blockquote>` : ''}`,
  });
}
