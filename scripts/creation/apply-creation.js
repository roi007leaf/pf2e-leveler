import { getClassHandler } from './class-handlers/registry.js';
import { debug, info, warn } from '../utils/logger.js';
import { capitalize } from '../utils/pf2e-api.js';
import { format, localize } from '../utils/i18n.js';

export async function applyCreation(actor, data, onProgress = null) {
  info(`Applying character creation for ${actor.name}`);
  const reportProgress = (progress, message) => {
    if (typeof onProgress === 'function') onProgress({ progress, message });
  };

  reportProgress(0.05, 'Applying ancestry, background, and class...');
  if (data.ancestry) await applyItem(actor, data.ancestry, 'ancestry');
  if (data.heritage) await applyItem(actor, data.heritage, 'heritage');
  if (data.background) await applyItem(actor, data.background, 'background');
  if (data.class) await applyItem(actor, data.class, 'class');
  reportProgress(0.28, 'Waiting for the PF2E system to finish initializing items...');
  await waitForSystem();

  reportProgress(0.42, 'Applying boosts, languages, and skills...');
  await applyBoosts(actor, data);
  await applyLanguages(actor, data);

  if (data.skills.length > 0) {
    const updates = {};
    for (const skill of data.skills) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    await actor.update(updates);
    debug(`Trained ${data.skills.length} skills`);
  }

  reportProgress(0.58, 'Applying lore and level 1 feats...');
  await applyLores(actor, data);

  if (data.ancestryFeat) await applyFeat(actor, data.ancestryFeat, 'ancestry', 1);
  if (data.classFeat) await applyFeat(actor, data.classFeat, 'class', 1);

  reportProgress(0.72, 'Waiting for PF2E class option prompts...');
  await applySelectedItems(actor, data);

  // Class-specific apply (spellcasting, focus spells, deity, divine font, etc.)
  const handler = getClassHandler(data.class?.slug);
  reportProgress(0.86, 'Finalizing class-specific features...');
  await handler.applyExtras(actor, data);

  reportProgress(0.97, 'Creating summary message...');
  await createCreationMessage(actor, data);
  reportProgress(1, 'Character creation complete.');

  info(`Character creation complete for ${actor.name}`);
}

export async function applyItem(actor, entry, type) {
  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) {
    warn(`Failed to resolve ${type}: ${entry.uuid}`);
    return;
  }
  const itemData = foundry.utils.deepClone(item.toObject());
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied ${type}: ${entry.name}`);
}

async function applyFeat(actor, entry, group, level) {
  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) return;
  const itemData = foundry.utils.deepClone(item.toObject());
  itemData.system.location = `${group}-${level}`;
  itemData.system.level = { ...itemData.system.level, taken: level };
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied feat: ${entry.name} (${group}-${level})`);
}

async function applyBoosts(actor, data) {
  const ancestryBoosts = data.boosts.ancestry ?? [];
  const backgroundBoosts = data.boosts.background ?? [];
  const classBoosts = data.boosts.class ?? [];
  const freeBoosts = data.boosts.free ?? [];

  const ancestry = actor.ancestry;
  if (ancestry && data.alternateAncestryBoosts) {
    await ancestry.update({ 'system.alternateAncestryBoosts': ancestryBoosts });
  } else if (ancestry && ancestryBoosts.length) {
    const boostSlots = ancestry.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < ancestryBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = ancestryBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await ancestry.update(update);
    }
  }

  const background = actor.items?.find((i) => i.type === 'background');
  if (background && backgroundBoosts.length) {
    const boostSlots = background.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < backgroundBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = backgroundBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await background.update(update);
    }
  }

  const classItem = actor.class;
  if (classItem && classBoosts.length) {
    await classItem.update({ 'system.keyAbility.selected': classBoosts[0] });
  }

  if (freeBoosts.length) {
    const buildSource = foundry.utils.mergeObject(actor.toObject().system.build ?? {}, { attributes: { boosts: {} } });
    buildSource.attributes.boosts[1] = freeBoosts;
    await actor.update({ 'system.build': buildSource });
  }
}

async function applyLanguages(actor, data) {
  const additionalLangs = data.languages ?? [];
  if (additionalLangs.length === 0) return;

  const current = actor.system?.details?.languages?.value ?? [];
  const merged = [...new Set([...current, ...additionalLangs])];
  await actor.update({ 'system.details.languages.value': merged });
  debug(`Applied ${additionalLangs.length} additional languages: ${additionalLangs.join(', ')}`);
}

async function applyLores(actor, data) {
  const lores = data.lores ?? [];
  if (lores.length === 0) return;

  const existingLores = actor.items?.filter((i) => i.type === 'lore').map((i) => i.name) ?? [];
  const toCreate = lores
    .filter((name) => !existingLores.includes(name))
    .map((name) => ({
      name,
      type: 'lore',
      system: {
        proficient: { value: 1 },
      },
    }));

  if (toCreate.length > 0) {
    await actor.createEmbeddedDocuments('Item', toCreate);
    debug(`Created ${toCreate.length} lore skills: ${toCreate.map((l) => l.name).join(', ')}`);
  }
}

async function applySelectedItems(actor, data) {
  const entries = getAdditionalSelectedItems(data);
  for (const entry of entries) {
    await applyItem(actor, entry, entry._type ?? 'selected item');
  }
}

export function getAdditionalSelectedItems(data) {
  void data;
  // PF2E system-owned ChoiceSet selections are intentionally not embedded here.
  // The wizard records the user's intended answers for summary/overlay help, while
  // the system applies the resulting class features/items from its own prompts.
  return [];
}

function waitForSystem() {
  return new Promise((resolve) => setTimeout(resolve, 600));
}

async function createCreationMessage(actor, data) {
  const sections = [];
  const subclassChoiceLabels = await getSelectedSubclassChoiceLabels(data.subclass);
  const identityRows = [];
  if (data.ancestry) identityRows.push({ label: localize('CREATION.STEPS.ANCESTRY'), value: data.ancestry.name });
  if (data.heritage) identityRows.push({ label: localize('CREATION.STEPS.HERITAGE'), value: data.heritage.name });
  if (data.background) identityRows.push({ label: localize('CREATION.STEPS.BACKGROUND'), value: data.background.name });
  if (data.class) identityRows.push({ label: localize('CREATION.STEPS.CLASS'), value: data.class.name });
  if (data.subclass) {
    const subclassLabel = subclassChoiceLabels.length > 0
      ? `${data.subclass.name} (${subclassChoiceLabels.join(', ')})`
      : data.subclass.name;
    identityRows.push({ label: localize('CREATION.STEPS.SUBCLASS'), value: subclassLabel });
  }
  if (identityRows.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.CHARACTER'), identityRows));
  }

  const classChoices = [];
  if (data.implement) classChoices.push({ label: localize('CREATION.CHAT.IMPLEMENT'), value: data.implement.name });
  if (data.tactics?.length) classChoices.push({ label: localize('CREATION.CHAT.TACTICS'), value: data.tactics.map((entry) => entry.name).join(', ') });
  if (data.ikons?.length) classChoices.push({ label: localize('CREATION.CHAT.IKONS'), value: data.ikons.map((entry) => entry.name).join(', ') });
  if (data.innovationItem) classChoices.push({ label: localize('CREATION.CHAT.INNOVATION_ITEM'), value: data.innovationItem.name });
  if (data.innovationModification) classChoices.push({ label: localize('CREATION.CHAT.INNOVATION_MOD'), value: data.innovationModification.name });
  if (data.kineticGateMode) classChoices.push({ label: localize('CREATION.CHAT.KINETIC_GATE'), value: data.kineticGateMode === 'dual-gate' ? localize('CREATION.CHAT.DUAL_GATE') : localize('CREATION.CHAT.SINGLE_GATE') });
  if (data.secondElement) classChoices.push({ label: localize('CREATION.CHAT.SECOND_ELEMENT'), value: data.secondElement.name });
  if (data.kineticImpulses?.length) classChoices.push({ label: localize('CREATION.CHAT.IMPULSES'), value: data.kineticImpulses.map((entry) => entry.name).join(', ') });
  if (data.subconsciousMind) classChoices.push({ label: localize('CREATION.CHAT.SUBCONSCIOUS_MIND'), value: data.subconsciousMind.name });
  if (data.thesis) classChoices.push({ label: localize('CREATION.CHAT.ARCANE_THESIS'), value: data.thesis.name });
  if (data.apparitions?.length) {
    const labels = data.apparitions.map((entry) =>
      entry.uuid === data.primaryApparition ? `${entry.name} (Primary)` : entry.name,
    );
    classChoices.push({ label: localize('CREATION.CHAT.APPARITIONS'), value: labels.join(', ') });
  }
  if (data.deity) classChoices.push({ label: localize('CREATION.STEPS.DEITY'), value: data.deity.name });
  if (data.sanctification) {
    const handler = getClassHandler(data.class?.slug);
    const sanctStep = handler.getExtraSteps().find((s) => s.id === 'sanctification');
    const sanctLabel = sanctStep?.label ?? 'Sanctification';
    classChoices.push({ label: sanctLabel, value: data.sanctification === 'none' ? localize('CREATION.CHAT.NONE') : capitalize(data.sanctification) });
  }
  if (data.divineFont) {
    const handler = getClassHandler(data.class?.slug);
    const fontStep = handler.getExtraSteps().find((s) => s.id === 'divineFont');
    const fontLabel = fontStep?.label ?? 'Divine Font';
    classChoices.push({ label: fontLabel, value: capitalize(data.divineFont) });
  }
  if (classChoices.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.CHOICES'), classChoices));
  }

  const training = [];
  if (data.languages?.length) training.push({ label: localize('CREATION.STEPS.LANGUAGES'), value: data.languages.map((slug) => localizeLanguageSlug(slug)).join(', ') });
  if (data.lores?.length) training.push({ label: localize('CREATION.LORE_SKILLS'), value: data.lores.join(', ') });
  if (data.devotionSpell) {
    training.push({ label: localize('CREATION.CHAT.FOCUS_SPELL'), value: data.devotionSpell.name });
  } else {
    const handler = getClassHandler(data.class?.slug);
    const focusSpells = await handler.resolveFocusSpells(data);
    if (focusSpells.length > 0) {
      training.push({ label: localize('CREATION.CHAT.FOCUS_SPELLS'), value: focusSpells.map((s) => s.name).join(', ') });
    }
  }
  if (data.ancestryFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.ancestryFeat);
    training.push({ label: localize('SECTIONS.ANCESTRY_FEAT'), value: labels.length ? `${data.ancestryFeat.name} (${labels.join(', ')})` : data.ancestryFeat.name });
  }
  if (data.classFeat) {
    const labels = await getSelectedSubclassChoiceLabels(data.classFeat);
    training.push({ label: localize('SECTIONS.CLASS_FEAT'), value: labels.length ? `${data.classFeat.name} (${labels.join(', ')})` : data.classFeat.name });
  }
  for (const section of (data.grantedFeatSections ?? [])) {
    const labels = await getSelectedSubclassChoiceLabels({
      choiceSets: section.choiceSets ?? [],
      choices: data.grantedFeatChoices?.[section.slot] ?? {},
    });
    if (labels.length > 0) {
      const sourceSuffix = section.sourceName ? ` (${section.sourceName})` : '';
      training.push({ label: localize('CREATION.CHAT.GRANTED_FEAT_CHOICE'), value: `${section.featName}${sourceSuffix}: ${labels.join(', ')}` });
    }
  }
  if (training.length) {
    sections.push(buildChatRowsSection(localize('CREATION.CHAT.STARTING_BENEFITS'), training));
  }

  const content = buildChatCard({
    eyebrow: localize('CREATION.CHAT.CHARACTER_CREATED'),
    title: format('CREATION.CHAT.CHARACTER_READY', { actorName: actor.name }),
    accent: '#c6a15b',
    sections,
  });
  const whisper = [];
  for (const user of game.users) {
    if (user.isGM || actor.testUserPermission(user, 'OWNER')) whisper.push(user.id);
  }
  await ChatMessage.create({ content, speaker: { alias: actor.name }, whisper });
}

async function getSelectedSubclassChoiceLabels(subclass) {
  const currentChoices = subclass?.choices ?? {};
  const labels = [];

  for (const choiceSet of (subclass?.choiceSets ?? [])) {
    const selectedValue = currentChoices[choiceSet.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') continue;

    const match = choiceSet.options?.find((option) => option.value === selectedValue);
    if (match?.label) {
      labels.push(match.label);
      continue;
    }

    if (selectedValue.startsWith('Compendium.')) {
      const item = await fromUuid(selectedValue).catch(() => null);
      if (item?.name) {
        labels.push(item.name);
        continue;
      }
    }

    labels.push(formatChoiceLabel(selectedValue));
  }

  return labels.filter((label) => typeof label === 'string' && label.length > 0);
}

function formatChoiceLabel(value) {
  return value
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function buildChatRowsSection(label, rows) {
  return `
    <div style="padding:10px 12px; background:rgba(255,255,255,0.72); border:1px solid rgba(0,0,0,0.08); border-radius:10px;">
      <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#666; margin-bottom:8px;">${label}</div>
      <div style="display:grid; gap:6px;">
        ${rows.map((row) => `
          <div style="display:grid; grid-template-columns:140px 1fr; gap:10px; align-items:start;">
            <div style="font-size:12px; font-weight:700; color:#555;">${row.label}</div>
            <div style="font-size:12px; font-weight:600; color:#222;">${row.value}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function localizeLanguageSlug(slug) {
  const raw = CONFIG.PF2E?.languages?.[slug];
  const label = typeof raw === 'string' ? raw : (raw?.label ?? slug);
  return game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
}
