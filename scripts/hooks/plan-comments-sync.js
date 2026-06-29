import { MODULE_ID } from '../constants.js';
import { PLAN_COMMENTS_FLAG } from '../access/plan-comments.js';
import { refreshPlanComments } from '../ui/plan-comments-ui.js';

const LEVELER_WINDOW_IDS = new Set(['pf2e-leveler-planner', 'pf2e-leveler-wizard']);

export function planCommentsChanged(changes) {
  return foundry.utils.hasProperty(changes ?? {}, `flags.${MODULE_ID}.${PLAN_COMMENTS_FLAG}`);
}

export function findActorPlanCommentWindows(actorId) {
  return Object.values(ui.windows ?? {}).filter((app) => {
    const id = app?.options?.id ?? app?.id ?? null;
    return LEVELER_WINDOW_IDS.has(id) && app?.actor?.id === actorId;
  });
}

export function refreshActorPlanCommentWindows(actorId) {
  // Re-sync comments on the live DOM (markers + open popover) rather than a full app
  // re-render — the latter does not reliably repaint an open ApplicationV2 window from
  // a hook, so posts/resolves/deletes only appeared after reopening the window.
  for (const app of findActorPlanCommentWindows(actorId)) refreshPlanComments(app);
}

export function onUpdateActorPlanComments(actor, changes) {
  if (!planCommentsChanged(changes)) return;
  refreshActorPlanCommentWindows(actor?.id ?? null);
}

export function registerPlanCommentsHooks() {
  Hooks.on('updateActor', onUpdateActorPlanComments);
}
