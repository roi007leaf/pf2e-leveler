import { SUBCLASS_TAGS } from '../../constants.js';
import { getGrantedFeatChoiceValues } from '../../creation/creation-model.js';
import {
  getSelectedHandlerChoiceSourceItems,
  buildChoiceSetRollOptions,
  extractChoiceLabel,
  findMatchingChoiceOption,
  inferChoiceSetSelection,
  matchesChoiceSetPredicate,
} from './choice-sets.js';
import { evaluatePredicate } from '../../utils/predicate.js';

const CLASS_SUBCLASS_TYPES = {
  alchemist: 'research field',
  animist: 'practice',
  barbarian: 'instinct',
  bard: 'muse',
  champion: 'cause',
  cleric: 'doctrine',
  druid: 'order',
  gunslinger: 'way',
  inventor: 'innovation',
  investigator: 'methodology',
  kineticist: 'gate',
  magus: 'study',
  oracle: 'mystery',
  psychic: 'conscious mind',
  ranger: "hunter's edge",
  rogue: 'racket',
  sorcerer: 'bloodline',
  summoner: 'eidolon',
  swashbuckler: 'style',
  witch: 'patron',
  wizard: 'school',
};

async function resolveDocument(wizard, uuid) {
  if (!uuid) return null;
  if (typeof wizard?._getCachedDocument === 'function') return wizard._getCachedDocument(uuid);
  return fromUuid(uuid).catch(() => null);
}

export async function buildApplyOverlayContext(wizard) {
  const promptRows = await wizard._getApplyPromptRows();
  const dedupedPromptRows = dedupePromptRows(promptRows).filter((row) => {
    if (row?.pending) return false;
    const value = String(row?.value ?? '').trim();
    return value.length > 0 && value !== 'Pending selection';
  });
  const activeApplyPrompt = matchActivePromptRow(wizard, dedupedPromptRows);

  return { applySelectionRows: [], applyPromptRows: dedupedPromptRows, activeApplyPrompt };
}

export function matchActivePromptRow(wizard, promptRows) {
  const activeTitle = wizard._activeSystemPrompt?.title ?? null;
  if (!activeTitle) return null;
  const normalizedTitle = normalizePromptText(activeTitle);
  return promptRows.find((row) => getPromptMatchTexts(row).some((text) => {
    const normalizedText = normalizePromptText(text);
    return normalizedText && (normalizedTitle.includes(normalizedText) || normalizedText.includes(normalizedTitle));
  })) ?? null;
}

export function normalizePromptText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getPromptMatchTexts(row) {
  const texts = [row.prompt, row.label];
  if (typeof row.label === 'string' && row.label.includes('->')) {
    texts.push(row.label.split('->').at(-1)?.trim());
  }
  return texts.filter((text) => typeof text === 'string' && text.trim().length > 0);
}

export async function getApplyPromptRows(wizard) {
  const promptRows = [];
  const scannedItems = new Set();
  const scannedChoiceSources = new Set();
  const promptFlagIndex = new Map();
  const exactRows = new Set();

  const addStaticRow = (label, prompt, value, flag = '') => {
    const normalizedLabel = normalizeSourceLabel(label);
    const normalizedPrompt = String(prompt ?? '').trim();
    const rowValue = String(value ?? '').trim();
    if (!normalizedLabel || !normalizedPrompt || !rowValue) return;

    const exactKey = `${normalizedLabel}:${normalizedPrompt}:${flag}:${rowValue}`;
    if (exactRows.has(exactKey)) return;

    const promptKey = `${normalizedLabel}:${normalizedPrompt}:${flag}`;
    const existingIndex = promptFlagIndex.get(promptKey);
    if (existingIndex != null) {
      const existing = promptRows[existingIndex];
      if (!existing?.pending) return;
      exactRows.delete(`${existing.label}:${existing.prompt}:${existing.flag ?? ''}:${existing.value}`);
      promptRows[existingIndex] = {
        ...existing,
        label: normalizedLabel,
        prompt: normalizedPrompt,
        value: rowValue,
        pending: false,
        flag,
      };
      exactRows.add(exactKey);
      return;
    }

    exactRows.add(exactKey);
    promptFlagIndex.set(promptKey, promptRows.length);
    promptRows.push({
      label: normalizedLabel,
      prompt: normalizedPrompt,
      value: rowValue,
      pending: false,
      flag,
    });
  };

  const addRow = async (source, rule, optionSource = null) => {
    const prompt = getRulePrompt(rule);
    if (!prompt) return;
    const value = await resolvePromptSelectionLabel(wizard, rule, optionSource);
    const rowValue = value;
    const normalizedSource = normalizeSourceLabel(source);
    const flag = getRuleSelectionFlag(rule) ?? '';
    const exactKey = `${normalizedSource}:${prompt}:${flag}:${rowValue}`;
    if (exactRows.has(exactKey)) return;

    const promptKey = `${normalizedSource}:${prompt}:${flag}`;
    const existingIndex = promptFlagIndex.get(promptKey);
    if (existingIndex != null) {
      const existing = promptRows[existingIndex];
      if (existing.pending && value) {
        exactRows.delete(`${existing.label}:${existing.prompt}:${existing.flag ?? ''}:${existing.value}`);
        promptRows[existingIndex] = {
          ...existing,
          label: normalizedSource,
          value: rowValue,
          pending: false,
          flag,
        };
        exactRows.add(exactKey);
        return;
      }
      if (!existing.pending && !value) return;
    }

    exactRows.add(exactKey);
    promptFlagIndex.set(promptKey, promptRows.length);
    promptRows.push({ label: normalizedSource, prompt, value: rowValue, pending: !value, flag });
  };

  const resolveSelectedChoiceItem = async (rule, optionSource = null) => {
    const selectedSubclass = getPromptSelectedSubclass(wizard, rule, optionSource);
    if (selectedSubclass?.uuid) {
      const item = await resolveDocument(wizard, selectedSubclass.uuid);
      if (item) return item;
    }

    const flag = getRuleSelectionFlag(rule);
    if (!flag) return null;

    let selectedValue = null;
    if (flag && optionSource?.choices?.[flag]) {
      selectedValue = optionSource.choices[flag];
    } else if (flag && optionSource?.uuid && getGrantedFeatChoiceValues(wizard.data, optionSource.uuid)?.[flag]) {
      selectedValue = getGrantedFeatChoiceValues(wizard.data, optionSource.uuid)[flag];
    } else if (flag && wizard.data.subclass?.choices?.[flag]) {
      selectedValue = wizard.data.subclass.choices[flag];
    }

    if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') return null;

    const section = optionSource?.uuid
      ? (wizard.data.grantedFeatSections ?? []).find((entry) => entry.slot === optionSource.uuid)
      : null;
    const choiceSets = optionSource?.choiceSets ?? section?.choiceSets ?? wizard.data.subclass?.choiceSets ?? [];
    const option = findMatchingChoiceOption(
      choiceSets.find((cs) => cs.flag === flag)?.options,
      selectedValue,
    );
    const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
    if (!uuid) return null;
    return resolveDocument(wizard, uuid);
  };

  const scanItem = async (item, sourceLabel, optionSource = null) => {
    if (!item?.uuid || scannedItems.has(item.uuid)) return;
    scannedItems.add(item.uuid);

    const rules = item.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'ChoiceSet') continue;
      if (!matchesChoiceSetPredicate(rule.predicate, buildChoiceSetRollOptions(wizard, rules, getCurrentChoices(wizard, item, optionSource)))) continue;
      await addRow(sourceLabel, rule, optionSource);

      const selectedItem = await resolveSelectedChoiceItem(rule, optionSource);
      if (selectedItem) {
        await scanItem(selectedItem, `${sourceLabel} -> ${selectedItem.name}`, selectedItem);
      }
    }
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || !rule.uuid) continue;
      if (!matchesGrantPredicate(rule, wizard)) continue;
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      await scanItem(granted, `${sourceLabel} -> ${granted.name}`, granted);
    }
  };

  const scanChoiceSource = async (sourceLabel, optionSource = null) => {
    const sourceKey = `${sourceLabel}:${optionSource?.uuid ?? 'inline'}`;
    if (scannedChoiceSources.has(sourceKey)) return;
    scannedChoiceSources.add(sourceKey);

    for (const rule of (optionSource?.choiceSets ?? [])) {
      await addRow(sourceLabel, rule, optionSource);

      const selectedItem = await resolveSelectedChoiceItem(rule, optionSource);
      if (selectedItem) {
        await scanItem(selectedItem, `${sourceLabel} -> ${selectedItem.name}`, selectedItem);
      }
    }
  };

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name, optionSource: wizard.data.ancestry?.uuid ? { uuid: wizard.data.ancestry.uuid } : null },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name, optionSource: wizard.data.heritage?.uuid ? { uuid: wizard.data.heritage.uuid } : null },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name, optionSource: wizard.data.background?.uuid ? { uuid: wizard.data.background.uuid } : null },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name, optionSource: wizard.data.class?.uuid ? { uuid: wizard.data.class.uuid } : null },
    { uuid: wizard.data.dualClass?.uuid, label: wizard.data.dualClass?.name, optionSource: wizard.data.dualClass?.uuid ? { uuid: wizard.data.dualClass.uuid } : null },
    { uuid: wizard.data.subclass?.uuid, label: wizard.data.subclass?.name, optionSource: wizard.data.subclass },
    { uuid: wizard.data.dualSubclass?.uuid, label: wizard.data.dualSubclass?.name, optionSource: wizard.data.dualSubclass },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name, optionSource: wizard.data.ancestryFeat },
    { uuid: wizard.data.ancestryParagonFeat?.uuid, label: wizard.data.ancestryParagonFeat?.name, optionSource: wizard.data.ancestryParagonFeat },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name, optionSource: wizard.data.classFeat },
    { uuid: wizard.data.dualClassFeat?.uuid, label: wizard.data.dualClassFeat?.name, optionSource: wizard.data.dualClassFeat },
    ...((wizard.data.grantedFeatSections ?? []).map((section) => ({
      uuid: section.slot,
      label: section.sourceName ? `${section.sourceName} -> ${section.featName}` : section.featName,
      optionSource: { uuid: section.slot, choiceSets: section.choiceSets ?? [] },
    }))),
    ...getSelectedHandlerChoiceSourceItems(wizard).map((entry) => ({ uuid: entry.uuid, label: entry.label, optionSource: entry })),
  ];

  for (const { uuid, label, optionSource } of topItems) {
    if (!uuid || !label) continue;
    const item = await resolveDocument(wizard, uuid);
    if (!item) {
      if ((optionSource?.choiceSets?.length ?? 0) > 0) {
        await scanChoiceSource(label, optionSource);
      }
      continue;
    }
    await scanItem(item, label, optionSource);

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature.uuid || feature.level > 1) continue;
        const featItem = await resolveDocument(wizard, feature.uuid);
        if (!featItem) continue;
        await scanItem(featItem, `${label} -> ${feature.name}`, featItem);
      }
    }

    if ((optionSource?.choiceSets?.length ?? 0) > 0) {
      await scanChoiceSource(label, optionSource);
    }
  }

  addFallbackSubclassSelectionRow(wizard.data.class, wizard.data.subclass, promptRows, addStaticRow);
  addFallbackSubclassSelectionRow(wizard.data.dualClass, wizard.data.dualSubclass, promptRows, addStaticRow);

  return promptRows;
}

function addFallbackSubclassSelectionRow(classEntry, subclassEntry, promptRows, addStaticRow) {
  const classSlug = String(classEntry?.slug ?? '').trim().toLowerCase();
  const className = String(classEntry?.name ?? '').trim();
  const subclassName = String(subclassEntry?.name ?? '').trim();
  const subclassLabel = CLASS_SUBCLASS_TYPES[classSlug];
  if (!className || !subclassName || !subclassLabel) return;
  if ((subclassEntry?.choiceSets?.length ?? 0) > 0) return;

  const prompt = `Select a ${subclassLabel}.`;
  const hasEquivalentRow = (promptRows ?? []).some((row) =>
    normalizePromptText(row?.prompt) === normalizePromptText(prompt)
    && String(row?.value ?? '').trim() === subclassName);
  if (hasEquivalentRow) return;

  addStaticRow(className, prompt, subclassName, 'subclassSelection');
}

function matchesGrantPredicate(rule, wizard) {
  if (!rule?.predicate) return true;
  const actorLevel = wizard?.actor?.system?.details?.level?.value ?? 1;
  return evaluatePredicate(rule.predicate, actorLevel);
}

function getCurrentChoices(wizard, item, optionSource = null) {
  if (optionSource?.choices) return optionSource.choices;
  if (optionSource?.uuid) return getGrantedFeatChoiceValues(wizard.data, optionSource.uuid);
  if (item?.uuid) return getGrantedFeatChoiceValues(wizard.data, item.uuid);
  return {};
}

function dedupePromptRows(rows) {
  const deduped = [];
  const seen = new Map();
  const promptFlagIndex = new Map();

  for (const row of rows ?? []) {
    const label = normalizeSourceLabel(row.label);
    const prompt = String(row.prompt ?? '');
    const normalizedPrompt = normalizePromptText(prompt);
    const flag = String(row.flag ?? '');
    const value = String(row.value ?? '');
    const pending = row.pending === true || value === 'Pending selection';
    const promptKey = `${label}:${normalizedPrompt}:${flag}`;
    const exactKey = `${label}:${normalizedPrompt}:${flag}:${value}`;

    if (seen.has(exactKey)) continue;
    const existingIndex = promptFlagIndex.get(promptKey);
    if (existingIndex != null) {
      const existing = deduped[existingIndex];
      const existingPending = existing.pending === true || String(existing.value ?? '') === 'Pending selection';
      if (!existingPending && pending) continue;
      if (existingPending && !pending) {
        seen.delete(
          `${normalizeSourceLabel(existing.label)}:${normalizePromptText(existing.prompt)}:${String(existing.flag ?? '')}:${String(existing.value ?? '')}`,
        );
        deduped[existingIndex] = { ...row, label };
        seen.set(exactKey, existingIndex);
        continue;
      }
    }

    seen.set(exactKey, deduped.length);
    promptFlagIndex.set(promptKey, deduped.length);
    deduped.push({ ...row, label });
  }

  return deduped;
}

function normalizeSourceLabel(source) {
  const parts = String(source ?? '')
    .split('->')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length <= 1) return parts[0] ?? '';

  const normalized = [];
  for (const part of parts) {
    if (normalized.length > 0 && normalized.at(-1).toLowerCase() === part.toLowerCase()) continue;
    normalized.push(part);
  }

  return normalized.join(' -> ');
}

export async function resolvePromptSelectionLabel(wizard, rule, optionSource = null) {
  const flag = getRuleSelectionFlag(rule);
  const rawPrompt = String(rule?.prompt ?? '');
  const localizedPrompt = game.i18n?.has?.(rule?.prompt)
    ? game.i18n.localize(rule.prompt)
    : rule?.prompt;
  const normalizedPrompt = normalizePromptText(localizedPrompt);
  const normalizedRawPrompt = normalizePromptText(rawPrompt);
  const filterStrings = Array.isArray(rule.choices?.filter)
    ? rule.choices.filter.filter((entry) => typeof entry === 'string')
    : [];

  const selectedSubclass = getPromptSelectedSubclass(wizard, rule, optionSource);
  if (selectedSubclass?.name) {
    return selectedSubclass.name;
  }

  if (
    flag === 'deity'
    || flag === 'deityChoice'
    || flag === 'clericDeity'
    || filterStrings.includes('item:type:deity')
    || filterStrings.includes('item:category:deity')
    || normalizedPrompt === 'select a deity.'
    || normalizedPrompt === 'select a deity'
  ) {
    return wizard.data.deity?.name ?? null;
  }

  if (
    flag === 'sanctification'
    || flag === 'clericSanctification'
    || normalizedPrompt === 'select a sanctification.'
    || normalizedPrompt === 'select a sanctification'
    || normalizedPrompt.includes('sanctification')
    || normalizedRawPrompt.includes('sanctification')
  ) {
    if (!wizard.data.sanctification) return null;
    if (wizard.data.sanctification === 'none') return 'None';
    return wizard.data.sanctification.charAt(0).toUpperCase() + wizard.data.sanctification.slice(1);
  }

  if (flag && optionSource?.choices?.[flag]) {
    const selectedValue = optionSource.choices[flag];
    const option = findMatchingChoiceOption(
      (optionSource.choiceSets ?? []).find((cs) => cs.flag === flag)?.options,
      selectedValue,
    );
    return option ? (extractChoiceLabel(option) ?? selectedValue) : String(selectedValue);
  }

  if (flag && optionSource?.uuid && getGrantedFeatChoiceValues(wizard.data, optionSource.uuid)?.[flag]) {
    const selectedValue = getGrantedFeatChoiceValues(wizard.data, optionSource.uuid)[flag];
    const section = (wizard.data.grantedFeatSections ?? []).find((entry) => entry.slot === optionSource.uuid);
    const option = findMatchingChoiceOption(
      section?.choiceSets?.find((cs) => cs.flag === flag)?.options,
      selectedValue,
    );
    return option ? (extractChoiceLabel(option) ?? selectedValue) : String(selectedValue);
  }

  if (flag && wizard.data.subclass?.choices?.[flag]) {
    const selectedValue = wizard.data.subclass.choices[flag];
    const option = findMatchingChoiceOption(
      (wizard.data.subclass.choiceSets ?? []).find((cs) => cs.flag === flag)?.options,
      selectedValue,
    );
    return option ? (extractChoiceLabel(option) ?? selectedValue) : String(selectedValue);
  }

  const inferredValue = inferChoiceSetSelection(wizard, flag, rule?.choices);
  if (inferredValue) {
    const option = findMatchingChoiceOption(rule?.choices, inferredValue);
    return option ? (extractChoiceLabel(option) ?? inferredValue) : String(inferredValue);
  }

  if (flag === 'implement') return wizard.data.implement?.name ?? null;
  if (['firstTactic', 'secondTactic', 'thirdTactic', 'fourthTactic', 'fifthTactic'].includes(flag)) {
    const index = ['firstTactic', 'secondTactic', 'thirdTactic', 'fourthTactic', 'fifthTactic'].indexOf(flag);
    return wizard.data.tactics?.[index]?.name ?? null;
  }
  if (['firstIkon', 'secondIkon', 'thirdIkon'].includes(flag)) {
    const index = ['firstIkon', 'secondIkon', 'thirdIkon'].indexOf(flag);
    return wizard.data.ikons?.[index]?.name ?? null;
  }
  if (['weaponInnovation', 'armorInnovation'].includes(flag)) return wizard.data.innovationItem?.name ?? null;
  if (flag === 'initialModification') return wizard.data.innovationModification?.name ?? null;
  if (flag === 'elementTwo') return wizard.data.secondElement?.name ?? null;
  if (flag === 'impulseOne') return wizard.data.kineticImpulses?.[0]?.name ?? null;
  if (flag === 'impulseTwo') return wizard.data.kineticImpulses?.[1]?.name ?? null;
  if (flag === 'arcaneThesis') return wizard.data.thesis?.name ?? null;
  if (flag === 'subconsciousMind') return wizard.data.subconsciousMind?.name ?? null;
  if (flag === 'divineFont') return wizard.data.divineFont ? wizard.data.divineFont.charAt(0).toUpperCase() + wizard.data.divineFont.slice(1) : null;
  if (rule.prompt === 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Gate') {
    return wizard.data.kineticGateMode === 'dual-gate' ? 'Dual Gate' : wizard.data.kineticGateMode === 'single-gate' ? 'Single Gate' : null;
  }

  return null;
}

function getPromptSelectedSubclass(wizard, rule, optionSource = null) {
  const flag = getRuleSelectionFlag(rule);
  const filterStrings = Array.isArray(rule?.choices?.filter)
    ? rule.choices.filter.filter((entry) => typeof entry === 'string')
    : [];
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();

  const entries = [
    {
      classEntry: wizard.data.class,
      subclassEntry: wizard.data.subclass,
      subclassTag: wizard.data.class?.subclassTag ?? SUBCLASS_TAGS[wizard.data.class?.slug],
    },
    {
      classEntry: wizard.data.dualClass,
      subclassEntry: wizard.data.dualSubclass,
      subclassTag: wizard.data.dualClass?.subclassTag ?? SUBCLASS_TAGS[wizard.data.dualClass?.slug],
    },
  ];

  const scopedEntries = optionSource?.uuid
    ? entries.filter((entry) => entry.classEntry?.uuid === optionSource.uuid)
    : entries;

  for (const entry of scopedEntries) {
    if (!entry.subclassEntry || typeof entry.subclassTag !== 'string' || entry.subclassTag.length === 0) continue;
    if (filterStrings.some((value) => value.includes(entry.subclassTag))) return entry.subclassEntry;
    if (filterText.includes(entry.subclassTag.toLowerCase())) return entry.subclassEntry;
    if (flag && entry.subclassTag.includes(flag)) return entry.subclassEntry;
  }

  return null;
}

function getRuleSelectionFlag(rule) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return null;
}

function getRulePrompt(rule) {
  if (typeof rule?.prompt === 'string' && rule.prompt.length > 0) {
    return game.i18n.has(rule.prompt) ? game.i18n.localize(rule.prompt) : rule.prompt;
  }

  const flag = getRuleSelectionFlag(rule);
  if (flag) return formatPromptFallback(flag);

  return 'Make a selection.';
}

function formatPromptFallback(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
