import { getLevelData, getRemindersForLevel } from '../plan/plan-model.js';
import { applyBoosts } from './apply-boosts.js';
import { applyLanguages } from './apply-languages.js';
import { applySkillIncreases } from './apply-skills.js';
import { applySkillRetrains } from './apply-skill-retrains.js';
import { applyFeats } from './apply-feats.js';
import { applyFeatRetrains } from './apply-feat-retrains.js';
import { applyFeatGrants } from './apply-feat-grants.js';
import { applyClassFeatureChoices } from './apply-class-feature-choices.js';
import { applySpells } from './apply-spells.js';
import { applyClassSpecific } from './apply-class-specific.js';
import { info, error as logError, notify } from '../utils/logger.js';
import { format } from '../utils/i18n.js';

const RANK_LABELS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];
const FEAT_KEYS = ['classFeats', 'skillFeats', 'generalFeats', 'ancestryFeats', 'archetypeFeats', 'mythicFeats', 'dualClassFeats', 'customFeats'];

export async function promptApplyPlan(actor, plan, level, previousLevel = level - 1) {
  const levelsToApply = getPlannedLevelsInRange(plan, previousLevel + 1, level);
  if (levelsToApply.length === 0) {
    notify(format('NOTIFICATIONS.NO_PLAN_FOR_LEVEL', { level }), 'warn');
    return false;
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

  if (!confirmed) return false;

  return applyPlan(actor, plan, level, previousLevel);
}

export async function promptApplyRetraining(actor, plan, level) {
  const levelData = getLevelData(plan, level);
  const retrainCount = (levelData?.retrainedFeats?.length ?? 0) + (levelData?.retrainedSkillIncreases?.length ?? 0);
  if (retrainCount === 0) {
    notify('No retraining planned for this level.', 'warn');
    return false;
  }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: 'Apply Downtime Retraining' },
    content: `<p>Apply downtime retraining for level ${level}?</p>`,
    modal: true,
  });

  if (!confirmed) return false;
  return applyRetraining(actor, plan, level);
}

export async function applyPlan(actor, plan, level, previousLevel = level - 1) {
  try {
    const levelsToApply = getPlannedLevelsInRange(plan, previousLevel + 1, level);
    if (levelsToApply.length === 0) {
      notify(format('NOTIFICATIONS.NO_PLAN_FOR_LEVEL', { level }), 'warn');
      return false;
    }

    info(`Applying plan for ${actor.name} at levels ${levelsToApply.join(', ')}`);

    for (const plannedLevel of levelsToApply) {
      const boosts = await applyBoosts(actor, plan, plannedLevel);
      const languages = await applyLanguages(actor, plan, plannedLevel);
      const skills = await applySkillIncreases(actor, plan, plannedLevel);
      const feats = await applyFeats(actor, plan, plannedLevel);
      const featGrants = await applyFeatGrants(actor, plan, plannedLevel);
      const classFeatureChoices = await applyClassFeatureChoices(actor, plan, plannedLevel);
      const spells = await applySpells(actor, plan, plannedLevel);
      const equipment = await applyEquipment(actor, plan, plannedLevel);
      await applyClassSpecific(actor, plan, plannedLevel);

      await createLevelUpMessage(actor, plan, plannedLevel, { boosts, languages, skillRetrains: [], skills, featRetrains: [], feats, spells, equipment, featGrants, classFeatureChoices });

      const reminders = getRemindersForLevel(plan, plannedLevel);
      if (reminders.length > 0) {
        showReminders(actor, plannedLevel, reminders);
      }
    }

    notify(format('NOTIFICATIONS.APPLIED', { actorName: actor.name, level }));
    return true;
  } catch (err) {
    logError(`Failed to apply plan: ${err.message}`);
    notify(format('NOTIFICATIONS.APPLY_FAILED', { error: err.message }), 'error');
    return false;
  }
}

export async function applyRetraining(actor, plan, level) {
  try {
    const levelData = getLevelData(plan, level);
    const retrainCount = (levelData?.retrainedFeats?.length ?? 0) + (levelData?.retrainedSkillIncreases?.length ?? 0);
    if (retrainCount === 0) {
      notify('No retraining planned for this level.', 'warn');
      return false;
    }

    info(`Applying retraining for ${actor.name} at level ${level}`);

    const skillRetrains = await applySkillRetrains(actor, plan, level);
    const featRetrains = await applyFeatRetrains(actor, plan, level);
    await createRetrainingMessage(actor, level, { skillRetrains, featRetrains });

    notify(`Applied retraining for ${actor.name}.`);
    return true;
  } catch (err) {
    logError(`Failed to apply retraining: ${err.message}`);
    notify(`Retraining failed: ${err.message}`, 'error');
    return false;
  }
}

function getPlannedLevelsInRange(plan, startLevel, endLevel) {
  const levels = [];
  for (let level = startLevel; level <= endLevel; level++) {
    if (getLevelData(plan, level)) levels.push(level);
  }
  return levels;
}

async function createRetrainingMessage(actor, level, applied) {
  const sections = [];

  const featRetrains = applied.featRetrains
    ?.map((entry) => `${entry.original?.name ?? 'Old Feat'} -> ${formatChatLink(entry.replacement)}`)
    .filter(Boolean) ?? [];
  if (featRetrains.length) sections.push(buildChatSection('Retrained Feats', featRetrains));

  const skillRetrains = applied.skillRetrains
    ?.map((entry) => `${formatSkillSlug(entry.original?.skill)} -> ${formatSkillSlug(entry.replacement?.skill)} (${RANK_LABELS[entry.replacement?.rank] ?? entry.replacement?.rank})`)
    .filter(Boolean) ?? [];
  if (skillRetrains.length) sections.push(buildChatSection('Retrained Skills', skillRetrains));

  const content = buildChatCard({
    eyebrow: `Level ${level}`,
    title: 'Downtime Retraining',
    accent: '#9f7aea',
    sections,
  });

  await ChatMessage.create({
    content,
    speaker: { alias: actor.name },
    whisper: getWhisperTargets(actor),
  });
}

async function createLevelUpMessage(actor, plan, level, applied) {
  const sections = [];

  const feats = await buildAppliedFeatChatEntries(applied.feats, plan, level);
  if (feats.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.FEATS_SELECTED'), feats));
  }

  const featRetrains = applied.featRetrains
    ?.map((entry) => `${entry.original?.name ?? 'Old Feat'} -> ${formatChatLink(entry.replacement)}`)
    .filter(Boolean) ?? [];
  if (featRetrains.length) {
    sections.push(buildChatSection('Retrained Feats', featRetrains));
  }

  const skillChanges = applied.skills
    .map((s) => `${formatSkillSlug(s.skill)} -> ${RANK_LABELS[s.toRank] ?? s.toRank}${s.intBonus ? ' (INT)' : ''}`)
    .filter(Boolean);
  if (skillChanges.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.SKILL_INCREASE'), skillChanges));
  }

  const skillRetrains = applied.skillRetrains
    ?.map((entry) => `${formatSkillSlug(entry.original?.skill)} -> ${formatSkillSlug(entry.replacement?.skill)} (${RANK_LABELS[entry.replacement?.rank] ?? entry.replacement?.rank})`)
    .filter(Boolean) ?? [];
  if (skillRetrains.length) {
    sections.push(buildChatSection('Retrained Skills', skillRetrains));
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
  const featGrantSpells = applied.featGrants?.spells?.map((s) => formatChatLink(s)).filter(Boolean) ?? [];
  spells.push(...featGrantSpells);
  if (spells.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.MESSAGES.SPELLS_ADDED'), spells));
  }

  const equipment = applied.equipment?.map((e) => formatChatLink(e)).filter(Boolean) ?? [];
  const featGrantItems = applied.featGrants?.items?.map((e) => formatChatLink(e)).filter(Boolean) ?? [];
  equipment.push(...featGrantItems);
  if (equipment.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.SECTIONS.EQUIPMENT'), equipment));
  }

  const formulas = applied.featGrants?.formulas?.map((entry) => formatChatLink(entry)).filter(Boolean) ?? [];
  if (formulas.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E.Actor.Character.Crafting.FormulaKnownTitle'), formulas));
  }

  const classFeatureChoices = applied.classFeatureChoices
    ?.map((entry) => `${entry.name}: ${Object.values(entry.choiceLabels ?? entry.choices ?? {}).join(', ')}`)
    .filter(Boolean) ?? [];
  if (classFeatureChoices.length) {
    sections.push(buildChatSection(game.i18n.localize('PF2E_LEVELER.SECTIONS.CLASS_FEATURES'), classFeatureChoices));
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

async function buildAppliedFeatChatEntries(feats, plan, level) {
  const plannedFeats = getPlannedFeatEntriesForChat(plan, level);
  const entries = [];

  for (const feat of feats ?? []) {
    const plannedFeat = findMatchingPlannedFeatForChat(feat, plannedFeats);
    const choiceLabels = plannedFeat ? await getSelectedItemChoiceLabels(plannedFeat) : [];
    const link = formatChatLink(feat);
    if (choiceLabels.length === 0) {
      if (link) entries.push(link);
      continue;
    }

    const name = getEntryName(feat);
    const detail = `${name}: ${choiceLabels.join(', ')}`;
    if (link && link !== name) {
      entries.push(`${link} (${choiceLabels.join(', ')})`);
    } else {
      entries.push(detail);
    }
  }

  return entries.filter(Boolean);
}

function getPlannedFeatEntriesForChat(plan, level) {
  const levelData = plan?.levels?.[level] ?? null;
  if (!levelData) return [];
  return FEAT_KEYS.flatMap((key) => levelData[key] ?? []);
}

function findMatchingPlannedFeatForChat(appliedFeat, plannedFeats) {
  const appliedUuid = String(appliedFeat?.uuid ?? appliedFeat?.sourceId ?? appliedFeat?.flags?.core?.sourceId ?? '');
  const appliedName = String(appliedFeat?.name ?? '').trim().toLowerCase();
  const appliedSlug = String(appliedFeat?.slug ?? appliedFeat?.system?.slug ?? '').trim().toLowerCase();

  return plannedFeats.find((feat) => {
    const featUuid = String(feat?.uuid ?? feat?.sourceId ?? '').trim();
    if (appliedUuid && featUuid && appliedUuid === featUuid) return true;
    const featName = String(feat?.name ?? '').trim().toLowerCase();
    if (appliedName && featName && appliedName === featName) return true;
    const featSlug = String(feat?.slug ?? '').trim().toLowerCase();
    return !!appliedSlug && !!featSlug && appliedSlug === featSlug;
  }) ?? null;
}

async function getSelectedItemChoiceLabels(feat) {
  const labels = [];
  for (const [flag, value] of Object.entries(feat?.choices ?? {})) {
    if (typeof value !== 'string' || !value || value === '[object Object]') continue;
    const matchingOption = findChoiceOptionForValue(feat, flag, value);
    const isItemChoice = String(value).startsWith('Compendium.')
      || String(matchingOption?.uuid ?? matchingOption?.value ?? '').startsWith('Compendium.')
      || matchingOption?.type != null
      || matchingOption?.category != null;
    if (!isItemChoice) continue;

    const label = matchingOption?.label ?? matchingOption?.name ?? await resolveChoiceLabelFromUuid(value);
    if (label) labels.push(label);
  }
  return [...new Set(labels)];
}

function findChoiceOptionForValue(feat, flag, value) {
  const choiceSets = [
    ...(Array.isArray(feat?.choiceSets) ? feat.choiceSets : []),
    ...(Array.isArray(feat?.grantChoiceSets) ? feat.grantChoiceSets : []),
  ];
  const choiceSet = choiceSets.find((entry) => String(entry?.flag ?? '') === String(flag));
  return (choiceSet?.options ?? []).find((option) => {
    const candidates = [option?.value, option?.uuid, option?.slug, option?.label, option?.name]
      .map((candidate) => String(candidate ?? '').trim())
      .filter(Boolean);
    return candidates.includes(value);
  }) ?? null;
}

async function resolveChoiceLabelFromUuid(value) {
  if (!String(value).startsWith('Compendium.') || typeof fromUuid !== 'function') return null;
  const item = await fromUuid(value).catch(() => null);
  return item?.name ?? null;
}

function getEntryName(entry) {
  return String(entry?.name ?? entry?.uuid ?? entry?.sourceId ?? '').trim();
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

async function applyEquipment(actor, plan, level) {
  const levelData = getLevelData(plan, level);
  if (!levelData) return [];

  const entries = [
    ...(levelData.equipment ?? []).filter(Boolean),
    ...(levelData.customEquipment ?? []),
  ];

  const applied = [];
  for (const entry of entries) {
    if (!entry?.uuid) continue;
    const item = await fromUuid(entry.uuid).catch(() => null);
    if (!item) continue;
    const itemData = foundry.utils.deepClone(item.toObject());
    const quantity = entry.quantity ?? 1;
    if (quantity > 1) itemData.system.quantity = quantity;
    await actor.createEmbeddedDocuments('Item', [itemData]);
    applied.push({ uuid: entry.uuid, name: entry.name });
    info(`Applied equipment: ${entry.name}`);
  }
  return applied;
}

function formatChatLink(entry) {
  if (!entry) return '';
  const uuid = typeof entry.uuid === 'string' ? entry.uuid : (typeof entry.sourceId === 'string' ? entry.sourceId : null);
  const name = typeof entry.name === 'string' ? entry.name : uuid ?? '';
  if (!uuid || !name) return name;
  return `@UUID[${uuid}]{${name}}`;
}
