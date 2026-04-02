import { MODULE_ID, PLAN_FLAG } from '../constants.js';
import { debug } from '../utils/logger.js';

export function registerCharacterHooks() {
  Hooks.on('updateActor', onUpdateActor);
}

function onUpdateActor(actor, updateData, _options, userId) {
  if (actor.type !== 'character' || game.user.id !== userId) return;

  const newLevel = updateData?.system?.details?.level?.value;
  if (!newLevel) return;

  const plan = actor.getFlag(MODULE_ID, PLAN_FLAG);
  if (!plan) return;

  if (!plan.levels[newLevel]) {
    debug(`No plan data for level ${newLevel}`);
    return;
  }

  const autoApply = game.settings.get(MODULE_ID, 'autoApplyOnLevelUp');
  if (!autoApply) return;

  debug(`Level change detected for ${actor.name}: now level ${newLevel}`);

  import('../apply/apply-manager.js').then(({ promptApplyPlan }) => {
    promptApplyPlan(actor, plan, newLevel);
  });
}
