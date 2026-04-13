import { MODULE_ID, PLAN_FLAG } from '../constants.js';

export function getPlan(actor) {
  return actor.getFlag(MODULE_ID, PLAN_FLAG) ?? null;
}

export async function savePlan(actor, plan) {
  await actor.setFlag(MODULE_ID, PLAN_FLAG, plan);
}

export async function clearPlan(actor) {
  await actor.unsetFlag(MODULE_ID, PLAN_FLAG);
}

export function hasPlan(actor) {
  return getPlan(actor) !== null;
}

export function exportPlan(plan) {
  return JSON.stringify(plan, null, 2);
}

export function importPlan(jsonString) {
  const plan = JSON.parse(jsonString);
  if (!plan?.classSlug || !plan?.levels || !plan?.version) {
    throw new Error('Invalid plan format');
  }
  plan.apparitions ??= [];
  plan.dualClassSlug ??= null;
  return plan;
}
