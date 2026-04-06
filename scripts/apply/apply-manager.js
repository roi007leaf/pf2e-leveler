import { getLevelData, getRemindersForLevel } from '../plan/plan-model.js';
import { applyBoosts } from './apply-boosts.js';
import { applyLanguages } from './apply-languages.js';
import { applySkillIncreases } from './apply-skills.js';
import { applyFeats } from './apply-feats.js';
import { applySpells } from './apply-spells.js';
import { applyClassSpecific } from './apply-class-specific.js';
import { info, error as logError, notify } from '../utils/logger.js';
import { format } from '../utils/i18n.js';

const RANK_LABELS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

export async function promptApplyPlan(actor, plan, level, previousLevel = level - 1) {
  const levelsToApply = getPlannedLevelsInRange(plan, previousLevel + 1, level);
  if (levelsToApply.length === 0) {
    notify(format('NOTIFICATIONS.NO_PLAN_FOR_LEVEL', { level }), 'warn');
    return;
  }

  const isMultiLevel = levelsToApply.length > 1;
  const startLevel = levelsToApply[0];
  const endLevel = levelsToApply.at(-1);

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: game.i18n.localize('PF2E_LEVELER.UI.CONFIRM_APPLY_TITLE'),
    },
    content: `<p>${isMultiLevel
      ? `Apply all planned levels from ${startLevel} to ${endLevel}?`
      : format('UI.CONFIRM_APPLY', { level })}</p>`,
    modal: true,
  });

  if (!confirmed) return;

  await applyPlan(actor, plan, level, previousLevel);
}

export async function applyPlan(actor, plan, level, previousLevel = level - 1) {
  try {
    const levelsToApply = getPlannedLevelsInRange(plan, previousLevel + 1, level);
    if (levelsToApply.length === 0) {
      notify(format('NOTIFICATIONS.NO_PLAN_FOR_LEVEL', { level }), 'warn');
      return;
    }

    info(`Applying plan for ${actor.name} at levels ${levelsToApply.join(', ')}`);

    for (const plannedLevel of levelsToApply) {
      const boosts = await applyBoosts(actor, plan, plannedLevel);
      const languages = await applyLanguages(actor, plan, plannedLevel);
      const skills = await applySkillIncreases(actor, plan, plannedLevel);
      const feats = await applyFeats(actor, plan, plannedLevel);
      const spells = await applySpells(actor, plan, plannedLevel);
      await applyClassSpecific(actor, plan, plannedLevel);

      await createLevelUpMessage(actor, plannedLevel, { boosts, languages, skills, feats, spells });

      const reminders = getRemindersForLevel(plan, plannedLevel);
      if (reminders.length > 0) {
        showReminders(actor, plannedLevel, reminders);
      }
    }

    notify(format('NOTIFICATIONS.APPLIED', { actorName: actor.name, level }));
  } catch (err) {
    logError(`Failed to apply plan: ${err.message}`);
    notify(format('NOTIFICATIONS.APPLY_FAILED', { error: err.message }), 'error');
  }
}

function getPlannedLevelsInRange(plan, startLevel, endLevel) {
  const levels = [];
  for (let level = startLevel; level <= endLevel; level++) {
    if (getLevelData(plan, level)) levels.push(level);
  }
  return levels;
}

async function createLevelUpMessage(actor, level, applied) {
  const sections = [];

  const feats = applied.feats.map((f) => formatChatLink(f)).filter(Boolean);
  if (feats.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.FEATS_SELECTED'), feats));
  }

  const skillChanges = applied.skills
    .map((s) => `${formatSkillSlug(s.skill)} -> ${RANK_LABELS[s.toRank] ?? s.toRank}${s.intBonus ? ' (INT)' : ''}`)
    .filter(Boolean);
  if (skillChanges.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.SKILL_INCREASE'), skillChanges));
  }

  const languages = applied.languages.map((slug) => localizeLanguageSlug(slug)).filter(Boolean);
  if (languages.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.CREATION.STEPS.LANGUAGES'), languages));
  }

  const boosts = applied.boosts.map((boost) => String(boost).toUpperCase()).filter(Boolean);
  if (boosts.length) {
    sections.push(buildChatSection('Ability Boosts', boosts));
  }

  const spells = applied.spells?.map((s) => `${formatChatLink(s)}${s.rank ? ` (${s.rank})` : ''}`).filter(Boolean) ?? [];
  if (spells.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.SPELLS_ADDED'), spells));
  }

  const content = buildChatCard({
    eyebrow: `Level ${level}`,
    title: format('MESSAGES.GLOBAL_HEADER', { actorName: actor.name, targetLevel: level }),
    accent: '#2f9e44',
    sections,
  });

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

function buildChatCard({ eyebrow, title, accent, sections }) {
  return `
    <section style="border:1px solid rgba(0,0,0,0.15); border-left:4px solid ${accent}; border-radius:12px; padding:12px 14px; background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,245,245,0.96)); box-shadow:0 2px 10px rgba(0,0,0,0.08);">
      <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${accent}; margin-bottom:4px;">${eyebrow}</div>
      <div style="font-size:30px; font-weight:800; line-height:0.95; margin-bottom:12px; color:#1f1f1f;">${title}</div>
      <div style="display:grid; gap:10px;">${sections.join('')}</div>
    </section>
  `;
}

function buildChatSection(label, entries) {
  return `
    <div style="padding:10px 12px; background:rgba(255,255,255,0.72); border:1px solid rgba(0,0,0,0.08); border-radius:10px;">
      <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#666; margin-bottom:6px;">${label}</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; min-width:0;">
        ${entries.map((entry) => `<span style="display:inline-flex; align-items:center; min-width:0; max-width:100%; padding:4px 8px; border-radius:999px; background:#f1efe7; border:1px solid rgba(0,0,0,0.08); font-size:12px; font-weight:600; color:#222; overflow-wrap:anywhere; word-break:break-word;">${entry}</span>`).join('')}
      </div>
    </div>
  `;
}

function formatSkillSlug(skill) {
  return String(skill ?? '')
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function localizeLanguageSlug(slug) {
  const raw = CONFIG.PF2E?.languages?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
}

function formatChatLink(entry) {
  if (!entry) return '';
  const uuid = typeof entry.uuid === 'string' ? entry.uuid : (typeof entry.sourceId === 'string' ? entry.sourceId : null);
  const name = typeof entry.name === 'string' ? entry.name : uuid ?? '';
  if (!uuid || !name) return name;
  return `@UUID[${uuid}]{${name}}`;
}
