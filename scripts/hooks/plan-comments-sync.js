import { MODULE_ID } from '../constants.js';
import { PLAN_COMMENTS_FLAG } from '../access/plan-comments.js';

const LEVELER_WINDOW_IDS = new Set(['pf2e-leveler-planner', 'pf2e-leveler-wizard']);

export function planCommentsChanged(changes) {
  return foundry.utils.hasProperty(changes ?? {}, `flags.${MODULE_ID}.${PLAN_COMMENTS_FLAG}`);
}

export function refreshActorPlanCommentWindows(actorId) {
  for (const app of Object.values(ui.windows ?? {})) {
    const id = app?.options?.id ?? app?.id ?? null;
    if (!LEVELER_WINDOW_IDS.has(id)) continue;
    if (app.actor?.id !== actorId) continue;
    // render(true) is the planner/wizard re-render convention; render(false) does not
    // re-render an already-open ApplicationV2 window (changes would only show on reopen).
    // Bring-to-front is gated to the first render, so this won't steal focus.
    if (typeof app.render === 'function') app.render(true);
  }
}

export function onUpdateActorPlanComments(actor, changes) {
  if (!planCommentsChanged(changes)) return;
  refreshActorPlanCommentWindows(actor?.id ?? null);
}

export function registerPlanCommentsHooks() {
  Hooks.on('updateActor', onUpdateActorPlanComments);
}
