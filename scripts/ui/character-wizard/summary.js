export async function buildSummaryContext(wizard) {
  const choiceLabels = await wizard._getSelectedSubclassChoiceLabels();
  const ancestryFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('ancestry');
  const classFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('class');
  const grantedFeatChoiceSummaries = [];
  for (const section of (wizard.data.grantedFeatSections ?? [])) {
    const labels = await wizard._getSelectedFeatChoiceLabels(section.slot);
    if (labels.length > 0) {
      grantedFeatChoiceSummaries.push({
        featName: section.featName,
        sourceName: section.sourceName ?? null,
        labels,
      });
    }
  }
  const showSubclassSummary = !!wizard.data.subclass && wizard.data.class?.slug !== 'kineticist';
  const subclassSummaryLabel = wizard.data.subclass
    ? choiceLabels.length > 0
      ? `${wizard.data.subclass.name} (${choiceLabels.join(', ')})`
      : wizard.data.subclass.name
    : null;
  const sanctStep = wizard.classHandler.getExtraSteps().find((s) => s.id === 'sanctification');
  const fontStep = wizard.classHandler.getExtraSteps().find((s) => s.id === 'divineFont');
  const sanctLabel = sanctStep?.label ?? 'Sanctification';
  const fontLabel = fontStep?.label ?? 'Divine Font';
  const sanctValue = formatSanctificationValue(wizard.data.sanctification);
  const fontValue = formatCapitalizedValue(wizard.data.divineFont);

  return {
    pendingChoices: await wizard._getPendingChoices(),
    focusSpells: await wizard._resolveSummaryFocusSpells(),
    curriculumSummarySpells: await wizard._resolveSummaryCurriculumSpells(),
    subclassChoiceLabels: choiceLabels,
    ancestryFeatChoiceLabels,
    classFeatChoiceLabels,
    grantedFeatChoiceSummaries,
    subclassSummaryLabel,
    showSubclassSummary,
    implementLabel: wizard.data.implement?.name ?? null,
    tacticsSummary: wizard.data.tactics ?? [],
    ikonsSummary: wizard.data.ikons ?? [],
    innovationItemLabel: wizard.data.innovationItem?.name ?? null,
    innovationModificationLabel: wizard.data.innovationModification?.name ?? null,
    kineticGateModeLabel: wizard.data.kineticGateMode === 'dual-gate' ? 'Dual Gate' : wizard.data.kineticGateMode === 'single-gate' ? 'Single Gate' : null,
    secondElementLabel: wizard.data.secondElement?.name ?? null,
    kineticImpulsesSummary: wizard.data.kineticImpulses ?? [],
    subconsciousMindLabel: wizard.data.subconsciousMind?.name ?? null,
    apparitionsSummary: (wizard.data.apparitions ?? []).map((entry) => ({
      name: entry.name,
      primary: entry.uuid === wizard.data.primaryApparition,
    })),
    thesisLabel: wizard.data.thesis?.name ?? null,
    sanctificationLabel: sanctLabel,
    sanctificationValue: sanctValue,
    divineFontLabel: fontLabel,
    divineFontValue: fontValue,
  };
}

function formatSanctificationValue(value) {
  if (!value) return null;
  if (value === 'none') return 'None';
  return formatCapitalizedValue(value);
}

function formatCapitalizedValue(value) {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
