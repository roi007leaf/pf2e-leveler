import {
  canCommentOnActor,
  canResolveThread,
  deletePlanComment,
  getCommentSummary,
  getThread,
  notifyCommentPosted,
  postPlanComment,
  setPlanCommentResolved,
  threadAwaitsViewer,
} from '../access/plan-comments.js';

const t = (key) => game.i18n.localize(`PF2E_LEVELER.PLAN_COMMENTS.${key}`);

export function markerStateClass(summary) {
  if (!summary) return 'empty';
  if (summary.isEmpty) return 'empty';
  if (summary.resolved) return 'resolved';
  return 'unresolved';
}

export function collectPlannerCommentAnchors(rootEl) {
  const anchors = [];
  for (const section of rootEl.querySelectorAll('.level-section[data-comment-part]')) {
    const partId = section.getAttribute('data-comment-part');
    const host = section.querySelector(':scope > .section-header');
    if (partId && host) anchors.push({ partId, host, label: host.textContent.trim() });
  }
  return anchors;
}

export function collectWizardCommentAnchors(rootEl) {
  const content = rootEl.querySelector('.wizard-content[data-comment-part]');
  if (!content) return [];
  const partId = content.getAttribute('data-comment-part');
  if (!partId) return [];
  // Anchor the marker on the current step's heading so it sits inline with the
  // step content (mirroring the planner), falling back to the content container.
  const heading = content.querySelector('h2');
  const host = heading ?? content;
  const label = (heading?.textContent ?? '').trim() || partId;
  return [{ partId, host, label }];
}

export function mountPlanComments(app, rootEl, actor, anchors) {
  if (!rootEl || !actor || !Array.isArray(anchors)) return;
  const canComment = canCommentOnActor(actor);
  rootEl.querySelector('.plan-comments-popover')?.remove();

  for (const anchor of anchors) injectMarker(app, rootEl, actor, anchor, canComment);

  if (app._openCommentPartId) {
    const reopen = anchors.find((a) => a.partId === app._openCommentPartId);
    if (reopen) openPopover(app, rootEl, actor, reopen, canComment);
    else app._openCommentPartId = null;
  }
}

// Re-sync markers and the open popover from current flag data on the live DOM, WITHOUT
// a full app re-render. The updateActor hook calls this so a post/resolve/delete shows
// immediately on every client — ApplicationV2's render pipeline does not reliably
// repaint an already-open window when invoked from a hook.
export function refreshPlanComments(app) {
  const rootEl = app?.element;
  const actor = app?.actor;
  if (!rootEl?.querySelectorAll || !actor) return;
  rootEl.querySelectorAll('.plan-comment-marker').forEach((m) => m.remove());
  const anchors = rootEl.querySelector('.wizard-content[data-comment-part]')
    ? collectWizardCommentAnchors(rootEl)
    : collectPlannerCommentAnchors(rootEl);
  mountPlanComments(app, rootEl, actor, anchors);
}

function injectMarker(app, rootEl, actor, anchor, canComment) {
  const summary = getCommentSummary(actor, anchor.partId);
  const state = markerStateClass(summary);
  const awaiting = threadAwaitsViewer(getThread(actor, anchor.partId), game.user?.isGM === true);
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `plan-comment-marker plan-comment-marker--${state}${awaiting ? ' plan-comment-marker--awaiting' : ''}`;
  marker.dataset.commentMarker = anchor.partId;
  marker.setAttribute('data-tooltip', awaiting ? t('AWAITING_TOOLTIP') : `${t('MARKER_TOOLTIP')}${summary.isEmpty ? '' : ` (${summary.count})`}`);
  marker.innerHTML = summary.isEmpty
    ? '<i class="fa-regular fa-comment"></i>'
    : `<i class="fa-solid fa-comment"></i><span class="plan-comment-marker__count">${summary.count}</span>`;
  marker.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (app._openCommentPartId === anchor.partId) {
      app._openCommentPartId = null;
      rootEl.querySelector('.plan-comments-popover')?.remove();
      return;
    }
    openPopover(app, rootEl, actor, anchor, canComment);
  });
  anchor.host.appendChild(marker);
}

function openPopover(app, rootEl, actor, anchor, canComment) {
  rootEl.querySelector('.plan-comments-popover')?.remove();
  app._openCommentPartId = anchor.partId;

  // Repaint locally and immediately after the author's own action — the updateActor
  // hook covers other clients, but the author should never wait for a round-trip.
  const refresh = () => refreshPlanComments(app);
  const thread = getThread(actor, anchor.partId);
  const resolved = thread?.resolved === true;
  const pendingItems = [];

  const pop = document.createElement('div');
  pop.className = 'plan-comments-popover';
  pop.innerHTML = `
    <div class="plan-comments-popover__header">
      <span class="plan-comments-popover__title">${escapeHtml(anchor.label)}</span>
      ${resolved ? `<span class="plan-comments-popover__resolved">${t('RESOLVED_BADGE')}</span>` : ''}
      <button type="button" class="plan-comments-popover__close" data-tooltip="${t('CLOSE')}"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="plan-comments-popover__body"></div>
    ${canComment ? composerMarkup(thread, canResolveThread(actor, thread)) : `<div class="plan-comments-popover__readonly">${t('READ_ONLY')}</div>`}
  `;
  positionPopover(pop, anchor.host, rootEl);
  rootEl.appendChild(pop);

  renderThreadBody(pop.querySelector('.plan-comments-popover__body'), actor, anchor.partId, canComment, refresh);

  pop.querySelector('.plan-comments-popover__close').addEventListener('click', () => {
    app._openCommentPartId = null;
    pop.remove();
  });

  if (canComment) wireComposer(pop, actor, anchor.partId, anchor.label, pendingItems, refresh);
}

function composerMarkup(thread, canResolve) {
  const hasMessages = (thread?.messages?.length ?? 0) > 0;
  const resolved = thread?.resolved === true;
  const showResolve = hasMessages && canResolve;
  return `
    <div class="plan-comments-composer">
      <div class="plan-comments-composer__drop">${game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.DROP_HINT')}</div>
      <input type="text" class="plan-comments-composer__uuid" placeholder="${game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.PASTE_HINT')}">
      <div class="plan-comments-composer__chips"></div>
      <textarea class="plan-comments-composer__text" rows="2" placeholder="${hasMessages ? game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.REPLY_PLACEHOLDER') : game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.COMPOSER_PLACEHOLDER')}"></textarea>
      <div class="plan-comments-composer__actions">
        <button type="button" class="plan-comments-composer__post">${game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.POST')}</button>
        ${showResolve ? `<button type="button" class="plan-comments-composer__resolve">${resolved ? game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.REOPEN') : game.i18n.localize('PF2E_LEVELER.PLAN_COMMENTS.RESOLVE')}</button>` : ''}
      </div>
    </div>
  `;
}

function renderThreadBody(bodyEl, actor, partId, canComment, refresh) {
  const thread = getThread(actor, partId);
  const messages = thread?.messages ?? [];
  if (messages.length === 0) {
    bodyEl.innerHTML = `<div class="plan-comments-empty">${t('EMPTY')}</div>`;
    return;
  }
  bodyEl.innerHTML = messages.map((m) => messageMarkup(m, canComment)).join('');
  bodyEl.querySelectorAll('.plan-comment-chip[data-uuid]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      // Load the full document (await fromUuid) — fromUuidSync returns a partial
      // compendium index entry whose sheet render trips a permission warning for players.
      const item = await fromUuid(chip.dataset.uuid).catch(() => null);
      if (item?.sheet) item.sheet.render(true);
    });
  });
  bodyEl.querySelectorAll('.plan-comment-msg__delete[data-message-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deletePlanComment(actor, partId, btn.dataset.messageId);
      refresh?.();
    });
  });
}

function messageMarkup(m, canComment) {
  const canDelete = canComment && m.authorId === game.user?.id;
  const chips = (m.items ?? []).map((uuid) => {
    const doc = fromUuidSync(uuid);
    const name = doc?.name ?? uuid;
    const img = doc?.img ? `<img src="${escapeHtml(doc.img)}" alt="">` : '';
    return `<span class="plan-comment-chip" data-uuid="${escapeHtml(uuid)}">${img}${escapeHtml(name)}</span>`;
  }).join('');
  return `
    <div class="plan-comment-msg ${m.isGM ? 'plan-comment-msg--gm' : ''}">
      <div class="plan-comment-msg__head">
        <span class="plan-comment-msg__author">${escapeHtml(m.authorName)}</span>
        <span class="plan-comment-msg__time">${formatTime(m.ts)}</span>
        ${canDelete ? `<button type="button" class="plan-comment-msg__delete" data-message-id="${escapeHtml(m.id)}" data-tooltip="${t('DELETE')}"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
      <div class="plan-comment-msg__text">${escapeHtml(m.text)}</div>
      ${chips ? `<div class="plan-comment-msg__items">${chips}</div>` : ''}
    </div>
  `;
}

function wireComposer(pop, actor, partId, partLabel, pendingItems, refresh) {
  const drop = pop.querySelector('.plan-comments-composer__drop');
  const chipsEl = pop.querySelector('.plan-comments-composer__chips');
  const textEl = pop.querySelector('.plan-comments-composer__text');

  const renderChips = () => {
    chipsEl.innerHTML = pendingItems.map((uuid, i) => {
      const doc = fromUuidSync(uuid);
      const name = doc?.name ?? uuid;
      return `<span class="plan-comment-chip plan-comment-chip--pending">${escapeHtml(name)}<i class="fa-solid fa-xmark" data-remove="${i}" data-tooltip="${t('ATTACH_REMOVE')}"></i></span>`;
    }).join('');
    chipsEl.querySelectorAll('[data-remove]').forEach((x) => x.addEventListener('click', () => {
      pendingItems.splice(Number(x.dataset.remove), 1);
      renderChips();
    }));
  };

  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-dragover');
    const uuid = parseDropUuid(e);
    if (uuid && !pendingItems.includes(uuid)) { pendingItems.push(uuid); renderChips(); }
  });

  const uuidInput = pop.querySelector('.plan-comments-composer__uuid');
  const attachFromText = async (raw) => {
    const candidate = parseAttachmentUuid(raw);
    if (!candidate) return;
    const doc = await fromUuid(candidate).catch(() => null);
    if (!doc?.uuid) { ui.notifications?.warn(t('ATTACH_INVALID')); return; }
    if (!pendingItems.includes(doc.uuid)) { pendingItems.push(doc.uuid); renderChips(); }
    uuidInput.value = '';
  };
  uuidInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void attachFromText(uuidInput.value);
  });
  uuidInput?.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text');
    if (!text) return;
    e.preventDefault();
    void attachFromText(text);
  });

  pop.querySelector('.plan-comments-composer__post').addEventListener('click', async () => {
    const text = textEl.value;
    if (!text.trim()) return;
    const posted = await postPlanComment(actor, partId, { text, items: [...pendingItems] });
    if (posted) void notifyCommentPosted({ actor, partLabel, message: posted });
    refresh?.();
  });

  pop.querySelector('.plan-comments-composer__resolve')?.addEventListener('click', async () => {
    const current = getThread(actor, partId)?.resolved === true;
    await setPlanCommentResolved(actor, partId, !current);
    refresh?.();
  });
}

function parseDropUuid(event) {
  try {
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    return typeof data?.uuid === 'string' ? data.uuid : null;
  } catch {
    return null;
  }
}

// Extract a UUID candidate from pasted text: a bare UUID, or the UUID inside a
// content link like @UUID[Compendium.pf2e.equipment-srd.Item.abc]{Name}.
export function parseAttachmentUuid(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const link = text.match(/@UUID\[([^\]]+)\]/);
  return link ? link[1].trim() : text;
}

function positionPopover(pop, hostEl, rootEl) {
  const hostRect = hostEl.getBoundingClientRect();
  const rootRect = rootEl.getBoundingClientRect();
  pop.style.top = `${hostRect.bottom - rootRect.top + 4}px`;
  pop.style.left = `${Math.max(0, hostRect.left - rootRect.left)}px`;
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
