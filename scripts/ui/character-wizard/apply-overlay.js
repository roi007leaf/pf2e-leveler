import { SUBCLASS_TAGS } from '../../constants.js';
import { getSelectedFeatChoiceLabels, getSelectedSubclassChoiceLabels, extractChoiceLabel, extractChoiceValue } from './choice-sets.js';

export async function buildApplyOverlayContext(wizard) {
  const choiceLabels = await getSelectedSubclassChoiceLabels(wizard);
  const ancestryFeatChoiceLabels = await getSelectedFeatChoiceLabels(wizard, 'ancestry');
  const classFeatChoiceLabels = await getSelectedFeatChoiceLabels(wizard, 'class');
  const grantedFeatChoiceSummaries = [];
  for (const section of (wizard.data.grantedFeatSections ?? [])) {
    const labels = await getSelectedFeatChoiceLabels(wizard, section.slot);
    if (labels.length > 0) {
      grantedFeatChoiceSummaries.push({
        label: section.sourceName ? `${section.featName} (${section.sourceName})` : section.featName,
        value: labels.join(', '),
      });
    }
  }
  const selectionRows = [];

  if (wizard.data.ancestry) selectionRows.push({ label: 'Ancestry', value: wizard.data.ancestry.name });
  if (wizard.data.heritage) selectionRows.push({ label: 'Heritage', value: wizard.data.heritage.name });
  if (wizard.data.background) selectionRows.push({ label: 'Background', value: wizard.data.background.name });
  if (wizard.data.class) selectionRows.push({ label: 'Class', value: wizard.data.class.name });
  if (wizard.data.subclass) {
    selectionRows.push({
      label: 'Subclass',
      value: choiceLabels.length > 0 ? `${wizard.data.subclass.name} (${choiceLabels.join(', ')})` : wizard.data.subclass.name,
    });
  }
  if (wizard.data.implement) selectionRows.push({ label: 'Implement', value: wizard.data.implement.name });
  if (wizard.data.tactics?.length) selectionRows.push({ label: 'Tactics', value: wizard.data.tactics.map((entry) => entry.name).join(', ') });
  if (wizard.data.ikons?.length) selectionRows.push({ label: 'Ikons', value: wizard.data.ikons.map((entry) => entry.name).join(', ') });
  if (wizard.data.innovationItem) selectionRows.push({ label: 'Innovation Item', value: wizard.data.innovationItem.name });
  if (wizard.data.innovationModification) selectionRows.push({ label: 'Innovation Mod', value: wizard.data.innovationModification.name });
  if (wizard.data.kineticGateMode) selectionRows.push({ label: 'Kinetic Gate', value: wizard.data.kineticGateMode === 'dual-gate' ? 'Dual Gate' : 'Single Gate' });
  if (wizard.data.secondElement) selectionRows.push({ label: 'Second Element', value: wizard.data.secondElement.name });
  if (wizard.data.kineticImpulses?.length) selectionRows.push({ label: 'Impulses', value: wizard.data.kineticImpulses.map((entry) => entry.name).join(', ') });
  if (wizard.data.subconsciousMind) selectionRows.push({ label: 'Subconscious Mind', value: wizard.data.subconsciousMind.name });
  if (wizard.data.thesis) selectionRows.push({ label: 'Arcane Thesis', value: wizard.data.thesis.name });
  if (wizard.data.apparitions?.length) {
    const labels = wizard.data.apparitions.map((entry) => entry.uuid === wizard.data.primaryApparition ? `${entry.name} (Primary)` : entry.name);
    selectionRows.push({ label: 'Apparitions', value: labels.join(', ') });
  }
  if (wizard.data.deity) selectionRows.push({ label: 'Deity', value: wizard.data.deity.name });
  if (wizard.data.sanctification) selectionRows.push({ label: 'Sanctification', value: wizard.data.sanctification === 'none' ? 'None' : wizard.data.sanctification.charAt(0).toUpperCase() + wizard.data.sanctification.slice(1) });
  if (wizard.data.divineFont) selectionRows.push({ label: 'Divine Font', value: wizard.data.divineFont.charAt(0).toUpperCase() + wizard.data.divineFont.slice(1) });
  if (wizard.data.ancestryFeat) {
    const value = ancestryFeatChoiceLabels.length ? `${wizard.data.ancestryFeat.name} (${ancestryFeatChoiceLabels.join(', ')})` : wizard.data.ancestryFeat.name;
    selectionRows.push({ label: 'Ancestry Feat', value });
  }
  if (wizard.data.classFeat) {
    const value = classFeatChoiceLabels.length ? `${wizard.data.classFeat.name} (${classFeatChoiceLabels.join(', ')})` : wizard.data.classFeat.name;
    selectionRows.push({ label: 'Class Feat', value });
  }
  for (const summary of grantedFeatChoiceSummaries) {
    selectionRows.push({ label: 'Granted Feat Choice', value: `${summary.label}: ${summary.value}` });
  }

  const promptRows = await getApplyPromptRows(wizard);
  const dedupedPromptRows = promptRows.filter((row, index, rows) => rows.findIndex((candidate) => candidate.label === row.label && candidate.value === row.value && (candidate.prompt ?? '') === (row.prompt ?? '')) === index);
  const activeApplyPrompt = matchActivePromptRow(wizard, dedupedPromptRows);

  return { applySelectionRows: selectionRows, applyPromptRows: dedupedPromptRows, activeApplyPrompt };
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

  const scanItem = async (item, sourceLabel, optionSource = null) => {
    const rules = item.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'ChoiceSet') continue;
      await addRow(sourceLabel, rule, optionSource);
    }
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || !rule.uuid) continue;
      const granted = await fromUuid(rule.uuid).catch(() => null);
      if (!granted) continue;
      await scanItem(granted, `${sourceLabel} -> ${granted.name}`, granted);
    }
  };

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name },
    { uuid: wizard.data.subclass?.uuid, label: wizard.data.subclass?.name, optionSource: wizard.data.subclass },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name, optionSource: wizard.data.ancestryFeat },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name, optionSource: wizard.data.classFeat },
  ];

  for (const { uuid, label, optionSource } of topItems) {
    if (!uuid || !label) continue;
    const item = await fromUuid(uuid).catch(() => null);
    if (!item) continue;
    await scanItem(item, label, optionSource);

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature.uuid || feature.level > 1) continue;
        const featItem = await fromUuid(feature.uuid).catch(() => null);
        if (!featItem) continue;
        await scanItem(featItem, `${label} -> ${feature.name}`, featItem);
      }
    }
  }

  return promptRows;
}

export async function resolvePromptSelectionLabel(wizard, rule, optionSource = null) {
  const flag = rule.flag ?? null;
  const subclassTag = SUBCLASS_TAGS[wizard.data.class?.slug];
  const filterStrings = Array.isArray(rule.choices?.filter)
    ? rule.choices.filter.filter((entry) => typeof entry === 'string')
    : [];

  if (wizard.data.subclass && subclassTag && filterStrings.some((entry) => entry.includes(subclassTag))) {
    return wizard.data.subclass.name;
  }

  if (wizard.data.subclass && subclassTag && flag && subclassTag.includes(flag)) {
    return wizard.data.subclass.name;
  }

  if (flag && optionSource?.choices?.[flag]) {
    const selectedValue = optionSource.choices[flag];
    const option = (optionSource.choiceSets ?? []).find((cs) => cs.flag === flag)?.options?.find((entry) => extractChoiceValue(entry) === selectedValue);
    return option ? (extractChoiceLabel(option) ?? selectedValue) : String(selectedValue);
  }

  if (flag && optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[flag]) {
    const selectedValue = wizard.data.grantedFeatChoices[optionSource.uuid][flag];
    const section = (wizard.data.grantedFeatSections ?? []).find((entry) => entry.slot === optionSource.uuid);
    const option = section?.choiceSets?.find((cs) => cs.flag === flag)?.options?.find((entry) => extractChoiceValue(entry) === selectedValue);
    return option ? (extractChoiceLabel(option) ?? selectedValue) : String(selectedValue);
  }

  if (flag && wizard.data.subclass?.choices?.[flag]) {
    const selectedValue = wizard.data.subclass.choices[flag];
    const option = (wizard.data.subclass.choiceSets ?? []).find((cs) => cs.flag === flag)?.options?.find((entry) => extractChoiceValue(entry) === selectedValue);
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
