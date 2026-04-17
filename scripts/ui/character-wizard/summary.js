export async function buildSummaryContext(wizard) {
  const classSummaryLabel = [wizard.data.class?.name, wizard.data.dualClass?.name].filter(Boolean).join(' + ') || null;
  const choiceLabels = await wizard._getSelectedSubclassChoiceLabels();
  const dualChoiceLabels = await wizard._getSelectedDualSubclassChoiceLabels?.() ?? [];
  const ancestryFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('ancestry');
  const ancestryParagonFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('ancestryParagon');
  const classFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('class');
  const dualClassFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('dualClass');
  const skillFeatChoiceLabels = await wizard._getSelectedFeatChoiceLabels('skill');
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
  const subclassParts = [];
  if (wizard.data.subclass) {
    subclassParts.push(choiceLabels.length > 0
      ? `${wizard.data.subclass.name} (${choiceLabels.join(', ')})`
      : wizard.data.subclass.name);
  }
  if (wizard.data.dualSubclass) {
    subclassParts.push(dualChoiceLabels.length > 0
      ? `${wizard.data.dualSubclass.name} (${dualChoiceLabels.join(', ')})`
      : wizard.data.dualSubclass.name);
  }
  const showSubclassSummary = subclassParts.length > 0 && wizard.data.class?.slug !== 'kineticist';
  const subclassSummaryLabel = subclassParts.join(' + ') || null;
  const sanctStep = wizard.classHandler.getExtraSteps().find((s) => s.id === 'sanctification');
  const fontStep = wizard.classHandler.getExtraSteps().find((s) => s.id === 'divineFont');
  const sanctLabel = sanctStep?.label ?? 'Sanctification';
  const fontLabel = fontStep?.label ?? 'Divine Font';
  const sanctValue = formatSanctificationValue(wizard.data.sanctification);
  const fontValue = formatCapitalizedValue(wizard.data.divineFont);

  return {
    pendingChoices: await wizard._getPendingChoices(),
    classSummaryLabel,
    focusSpells: await wizard._resolveSummaryFocusSpells(),
    curriculumSummarySpells: await wizard._resolveSummaryCurriculumSpells(),
    subclassChoiceLabels: choiceLabels,
    ancestryFeatChoiceLabels,
    ancestryParagonFeatChoiceLabels,
    classFeatChoiceLabels,
    dualClassFeatChoiceLabels,
    skillFeatChoiceLabels,
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
    dualClassFeatLabel: wizard.data.dualClass?.name
      ? `${wizard.data.dualClass.name} Class Feat`
      : 'Dual Class Feat',
  };
}

function formatSanctificationValue(value) {
  if (!value) return null;
  if (value === 'none') return 'None';
  return formatCapitalizedValue(value);
}

function formatCapitalizedValue(value) {
  if (!value) return null;
  if (value === 'healing') return 'Healing';
  if (value === 'harmful') return 'Harmful';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
