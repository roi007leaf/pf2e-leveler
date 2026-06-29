import { MODULE_ID } from '../constants.js';
import { PLAN_COMMENTS_FLAG } from '../access/plan-comments.js';
import { refreshPlanComments } from '../ui/plan-comments-ui.js';

const LEVELER_WINDOW_IDS = new Set(['pf2e-leveler-planner', 'pf2e-leveler-wizard']);

export function planCommentsChanged(changes) {
  return foundry.utils.hasProperty(changes ?? {}, `flags.${MODULE_ID}.${PLAN_COMMENTS_FLAG}`);
}

// Enumerate open apps from BOTH registries: ApplicationV2 instances live in
// foundry.applications.instances (NOT ui.windows, which only holds legacy V1 apps).
// The planner/wizard are ApplicationV2, so ui.windows alone finds nothing.
function getOpenApps() {
  const seen = new Set();
  const out = [];
  const add = (app) => { if (app && !seen.has(app)) { seen.add(app); out.push(app); } };
  const instances = foundry.applications?.instances;
  if (instances?.values) for (const app of instances.values()) add(app);
  if (ui?.windows) for (const app of Object.values(ui.windows)) add(app);
  return out;
}

export function findActorPlanCommentWindows(actorId) {
  return getOpenApps().filter((app) => {
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
