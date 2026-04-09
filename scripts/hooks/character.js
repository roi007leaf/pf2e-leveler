import { MODULE_ID, PLAN_FLAG } from '../constants.js';

const pendingLevelChanges = new Map();

export function registerCharacterHooks() {
  Hooks.on('preUpdateActor', onPreUpdateActor);
  Hooks.on('updateActor', onUpdateActor);
}

function onPreUpdateActor(actor, updateData, _options, userId) {
  if (actor.type !== 'character' || game.user.id !== userId) return;

  const newLevel = updateData?.system?.details?.level?.value;
  if (!newLevel) return;

  const oldLevel = actor.system?.details?.level?.value ?? 1;
  pendingLevelChanges.set(actor.id, oldLevel);
}

function onUpdateActor(actor, updateData, _options, userId) {
  if (actor.type !== 'character' || game.user.id !== userId) return;

  const newLevel = updateData?.system?.details?.level?.value;
  if (!newLevel) return;
  const oldLevel = pendingLevelChanges.get(actor.id) ?? Math.max(1, newLevel - 1);
  pendingLevelChanges.delete(actor.id);

  const plan = actor.getFlag(MODULE_ID, PLAN_FLAG);
  if (!plan) return;

  const levelsToApply = [];
  for (let level = oldLevel + 1; level <= newLevel; level++) {
    if (plan.levels[level]) levelsToApply.push(level);
  }

  if (levelsToApply.length === 0) {
    return;
  }

  const autoApply = game.settings.get(MODULE_ID, 'autoApplyOnLevelUp');
  if (!autoApply) return;

  import('../apply/apply-manager.js').then(({ promptApplyPlan }) => {
    promptApplyPlan(actor, plan, newLevel, oldLevel);
  });
}
