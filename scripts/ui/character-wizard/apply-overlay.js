import { SUBCLASS_TAGS } from '../../constants.js';
import {
  getSelectedHandlerChoiceSourceItems,
  extractChoiceLabel,
  findMatchingChoiceOption,
} from './choice-sets.js';

async function resolveDocument(wizard, uuid) {
  if (!uuid) return null;
  if (typeof wizard?._getCachedDocument === 'function') return wizard._getCachedDocument(uuid);
  return fromUuid(uuid).catch(() => null);
}

export async function buildApplyOverlayContext(wizard) {
  const promptRows = await wizard._getApplyPromptRows();
  const dedupedPromptRows = promptRows.filter((row, index, rows) => rows.findIndex((candidate) => candidate.label === row.label && candidate.value === row.value && (candidate.prompt ?? '') === (row.prompt ?? '')) === index);
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
  const seen = new Set();
  const scannedItems = new Set();

  const addRow = async (source, rule, optionSource = null) => {
    if (!rule?.prompt) return;
    const prompt = game.i18n.has(rule.prompt) ? game.i18n.localize(rule.prompt) : rule.prompt;
    const value = await resolvePromptSelectionLabel(wizard, rule, optionSource);
    const rowValue = value || 'Pending selection';
    const key = `${source}:${prompt}:${rowValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    promptRows.push({ label: source, prompt, value: rowValue, pending: !value });
  };

  const resolveSelectedChoiceItem = async (rule, optionSource = null) => {
    const flag = getRuleSelectionFlag(rule);
    if (!flag) return null;

    let selectedValue = null;
    if (flag && optionSource?.choices?.[flag]) {
      selectedValue = optionSource.choices[flag];
    } else if (flag && optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[flag]) {
      selectedValue = wizard.data.grantedFeatChoices[optionSource.uuid][flag];
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
      await addRow(sourceLabel, rule, optionSource);

      const selectedItem = await resolveSelectedChoiceItem(rule, optionSource);
      if (selectedItem) {
        await scanItem(selectedItem, `${sourceLabel} -> ${selectedItem.name}`, selectedItem);
      }
    }
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || !rule.uuid) continue;
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      await scanItem(granted, `${sourceLabel} -> ${granted.name}`, granted);
    }
  };

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name, optionSource: wizard.data.ancestry?.uuid ? { uuid: wizard.data.ancestry.uuid } : null },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name, optionSource: wizard.data.heritage?.uuid ? { uuid: wizard.data.heritage.uuid } : null },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name, optionSource: wizard.data.background?.uuid ? { uuid: wizard.data.background.uuid } : null },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name, optionSource: wizard.data.class?.uuid ? { uuid: wizard.data.class.uuid } : null },
    { uuid: wizard.data.subclass?.uuid, label: wizard.data.subclass?.name, optionSource: wizard.data.subclass },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name, optionSource: wizard.data.ancestryFeat },
    { uuid: wizard.data.ancestryParagonFeat?.uuid, label: wizard.data.ancestryParagonFeat?.name, optionSource: wizard.data.ancestryParagonFeat },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name, optionSource: wizard.data.classFeat },
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
    if (!item) continue;
    await scanItem(item, label, optionSource);

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature.uuid || feature.level > 1) continue;
        const featItem = await resolveDocument(wizard, feature.uuid);
        if (!featItem) continue;
        await scanItem(featItem, `${label} -> ${feature.name}`, featItem);
      }
    }
  }

  return promptRows;
}

export async function resolvePromptSelectionLabel(wizard, rule, optionSource = null) {
  const flag = getRuleSelectionFlag(rule);
  const subclassTag = SUBCLASS_TAGS[wizard.data.class?.slug];
  const rawPrompt = String(rule?.prompt ?? '');
  const localizedPrompt = game.i18n?.has?.(rule?.prompt)
    ? game.i18n.localize(rule.prompt)
    : rule?.prompt;
  const normalizedPrompt = normalizePromptText(localizedPrompt);
  const normalizedRawPrompt = normalizePromptText(rawPrompt);
  const filterStrings = Array.isArray(rule.choices?.filter)
    ? rule.choices.filter.filter((entry) => typeof entry === 'string')
    : [];

  if (wizard.data.subclass && subclassTag && filterStrings.some((entry) => entry.includes(subclassTag))) {
    return wizard.data.subclass.name;
  }

  if (wizard.data.subclass && subclassTag && flag && subclassTag.includes(flag)) {
    return wizard.data.subclass.name;
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

  if (flag && optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[flag]) {
    const selectedValue = wizard.data.grantedFeatChoices[optionSource.uuid][flag];
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

function getRuleSelectionFlag(rule) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return null;
}
