import { MODULE_ID } from '../constants.js';
import { getLevelData, getRemindersForLevel } from '../plan/plan-model.js';
import { applyBoosts } from './apply-boosts.js';
import { applySkillIncreases } from './apply-skills.js';
import { applyFeats } from './apply-feats.js';
import { applySpells } from './apply-spells.js';
import { applyClassSpecific } from './apply-class-specific.js';
import { info, error as logError, notify } from '../utils/logger.js';
import { format } from '../utils/i18n.js';

export async function promptApplyPlan(actor, plan, level) {
  const levelData = getLevelData(plan, level);
  if (!levelData) {
    notify(format('NOTIFICATIONS.NO_PLAN_FOR_LEVEL', { level }), 'warn');
    return;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: game.i18n.localize('PF2E_LEVELER.UI.CONFIRM_APPLY_TITLE'),
    },
    content: `<p>${format('UI.CONFIRM_APPLY', { level })}</p>`,
    modal: true,
  });

  if (!confirmed) return;

  await applyPlan(actor, plan, level);
}

export async function applyPlan(actor, plan, level) {
  try {
    info(`Applying plan for ${actor.name} at level ${level}`);

    const boosts = await applyBoosts(actor, plan, level);
    const skills = await applySkillIncreases(actor, plan, level);
    const feats = await applyFeats(actor, plan, level);
    const spells = await applySpells(actor, plan, level);
    await applyClassSpecific(actor, plan, level);

    await createLevelUpMessage(actor, level, { boosts, skills, feats, spells });

    notify(format('NOTIFICATIONS.APPLIED', { actorName: actor.name, level }));

    const reminders = getRemindersForLevel(plan, level);
    if (reminders.length > 0) {
      showReminders(actor, level, reminders);
    }
  } catch (err) {
    logError(`Failed to apply plan: ${err.message}`);
    notify(format('NOTIFICATIONS.APPLY_FAILED', { error: err.message }), 'error');
  }
}

async function createLevelUpMessage(actor, level, applied) {
  const featNames = applied.feats.map((f) => f.name ?? 'Unknown').join(', ');
  const skillInfo = applied.skills
    .map((s) => `${s.skill} → ${s.toRank}`)
    .join(', ');
  const boostInfo = applied.boosts.join(', ').toUpperCase();

  let content = `<h2>${format('MESSAGES.GLOBAL_HEADER', { actorName: actor.name, targetLevel: level })}</h2>`;

  if (featNames) {
    content += `<p><strong>${game.i18n.localize('PF2E_LEVELER.MESSAGES.FEATS_SELECTED')}</strong> ${featNames}</p>`;
  }

  if (skillInfo) {
    content += `<p><strong>${game.i18n.localize('PF2E_LEVELER.MESSAGES.SKILL_INCREASE')}</strong> ${skillInfo}</p>`;
  }

  if (boostInfo) {
    content += `<p><strong>${format('MESSAGES.BOOSTS_APPLIED', { boosts: boostInfo })}</strong></p>`;
  }

  const spellNames = applied.spells?.map((s) => `${s.name} (${s.rank})`).join(', ');
  if (spellNames) {
    content += `<p><strong>${game.i18n.localize('PF2E_LEVELER.MESSAGES.SPELLS_ADDED')}</strong> ${spellNames}</p>`;
  }

  await ChatMessage.create({
    content,
    speaker: { alias: actor.name },
    whisper: getWhisperTargets(actor),
  });
}

function getWhisperTargets(actor) {
  const targets = new Set();
  for (const user of game.users) {
    if (user.isGM || actor.testUserPermission(user, 'OWNER')) {
      targets.add(user.id);
    }
  }
  return [...targets];
}

function showReminders(actor, level, reminders) {
  const items = reminders.map((r) => `<li><strong>${r.featName}</strong>: ${r.message}</li>`).join('');
  const body = `<p>${game.i18n.format('PF2E_LEVELER.REMINDERS.HEADER', { actorName: actor.name, level })}</p><ul>${items}</ul>`;

  foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.localize('PF2E_LEVELER.REMINDERS.TITLE'),
    },
    content: body,
    ok: {
      label: game.i18n.localize('PF2E_LEVELER.REMINDERS.OK'),
    },
  });
}
