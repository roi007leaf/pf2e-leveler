import { SKILLS, SUBCLASS_TAGS } from '../../constants.js';
import { getCompendiumKeysForCategory } from '../../compendiums/catalog.js';
import { getClassSelectionData } from '../../creation/creation-model.js';
import { debug } from '../../utils/logger.js';
import { localize } from '../../utils/i18n.js';
import { evaluatePredicate } from '../../utils/predicate.js';
import { buildSkillContext } from './skills-languages.js';
import { parseCurriculum } from './loaders.js';

async function resolveDocument(wizard, uuid) {
  if (!uuid) return null;
  if (typeof wizard?._getCachedDocument === 'function') return wizard._getCachedDocument(uuid);
  return fromUuid(uuid).catch(() => null);
}

export async function buildSubclassChoicesContext(wizard) {
  const sections = [];
  if ((wizard.data.subclass?.choiceSets?.length ?? 0) > 0) {
    sections.push({
      target: 'class',
      subclassName: wizard.data.subclass?.name,
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.subclass?.choiceSets ?? [], wizard.data.subclass?.choices ?? {}),
    });
  }
  if ((wizard.data.dualSubclass?.choiceSets?.length ?? 0) > 0) {
    sections.push({
      target: 'dualClass',
      subclassName: wizard.data.dualSubclass?.name,
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.dualSubclass?.choiceSets ?? [], wizard.data.dualSubclass?.choices ?? {}),
    });
  }
  return {
    subclassName: sections[0]?.subclassName ?? wizard.data.subclass?.name ?? wizard.data.dualSubclass?.name,
    choiceSets: sections[0]?.choiceSets ?? [],
    subclassChoiceSections: sections,
  };
}

export async function buildFeatChoicesContext(wizard) {
  const sections = [];
  if (wizard.data.ancestryFeat?.choiceSets?.length) {
    sections.push({
      slot: 'ancestry',
      featName: await resolveChoiceSectionName(wizard, wizard.data.ancestryFeat),
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.ancestryFeat.choiceSets, wizard.data.ancestryFeat.choices ?? {}),
    });
  }
  if (wizard.data.ancestryParagonFeat?.choiceSets?.length) {
    sections.push({
      slot: 'ancestryParagon',
      featName: await resolveChoiceSectionName(wizard, wizard.data.ancestryParagonFeat),
      sourceName: 'Ancestry Paragon',
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.ancestryParagonFeat.choiceSets, wizard.data.ancestryParagonFeat.choices ?? {}),
    });
  }
  if (wizard.data.classFeat?.choiceSets?.length) {
    sections.push({
      slot: 'class',
      target: 'class',
      featName: await resolveChoiceSectionName(wizard, wizard.data.classFeat),
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.classFeat.choiceSets, wizard.data.classFeat.choices ?? {}),
    });
  }
  if (wizard.data.dualClassFeat?.choiceSets?.length) {
    sections.push({
      slot: 'dualClass',
      target: 'dualClass',
      featName: await resolveChoiceSectionName(wizard, wizard.data.dualClassFeat),
      sourceName: wizard.data.dualClass?.name ?? 'Dual Class',
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.dualClassFeat.choiceSets, wizard.data.dualClassFeat.choices ?? {}),
    });
  }
  if (wizard.data.skillFeat?.choiceSets?.length) {
    sections.push({
      slot: 'skill',
      featName: await resolveChoiceSectionName(wizard, wizard.data.skillFeat),
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.skillFeat.choiceSets, wizard.data.skillFeat.choices ?? {}),
    });
  }
  for (const section of (wizard.data.grantedFeatSections ?? [])) {
    sections.push({
      slot: section.slot,
      target: inferGrantedFeatChoiceTarget(wizard, section),
      featName: await resolveChoiceSectionName(wizard, { uuid: section.slot, name: section.featName }),
      sourceName: section.sourceName ?? null,
      choiceSets: await hydrateChoiceSets(wizard, section.choiceSets ?? [], wizard.data.grantedFeatChoices?.[section.slot] ?? {}),
    });
  }
  return { featChoiceSections: sections };
}

function inferGrantedFeatChoiceTarget(wizard, section) {
  const sourceName = String(section?.sourceName ?? '')
    .trim()
    .toLowerCase();
  if (!sourceName) return null;

  const candidates = [
    { target: 'dualClass', label: wizard.data.dualSubclass?.name ?? wizard.data.dualClass?.name ?? '' },
    { target: 'class', label: wizard.data.subclass?.name ?? wizard.data.class?.name ?? '' },
  ];

  for (const candidate of candidates) {
    const normalizedLabel = String(candidate.label ?? '')
      .trim()
      .toLowerCase();
    if (normalizedLabel && sourceName.startsWith(normalizedLabel)) return candidate.target;
  }

  return null;
}

async function resolveChoiceSectionName(wizard, entry) {
  const storedName = typeof entry?.name === 'string' ? entry.name.trim() : '';
  if (storedName && !looksLikeUuid(storedName)) return storedName;

  const resolved = entry?.uuid ? await resolveDocument(wizard, entry.uuid) : null;
  const resolvedName = typeof resolved?.name === 'string' ? resolved.name.trim() : '';
  return resolvedName || storedName || entry?.uuid || '';
}

function looksLikeUuid(value) {
  return typeof value === 'string' && value.startsWith('Compendium.');
}

export async function hydrateChoiceSets(wizard, choiceSets, currentChoices) {
  const skillContext = await buildSkillContext(wizard);
  const skillState = createSkillStateMap(skillContext);
  const hydratedChoiceSets = await Promise.all((choiceSets ?? []).map(async (cs) => {
    const options = await Promise.all((cs.options ?? []).map(async (opt) => {
      const value = extractChoiceValue(opt);
      const needsHydration = !opt?.uuid
        && (typeof value === 'string' && value.startsWith('Compendium.')
          || (opt?.value && typeof opt.value === 'object')
          || !opt?.img
          || !opt?.description);
      if (!needsHydration) return opt;
      return enrichChoiceOption(wizard, opt);
    }));
    return { ...cs, options };
  }));

  return hydratedChoiceSets.map((cs) => ({
    ...cs,
    isItemChoice: cs.options.some((opt) => !!extractChoiceUuid(opt) || !!opt?.img || !!opt?.description),
    isFeatChoice: cs.options.length > 0 && cs.options.every((opt) => String(opt?.type ?? '').toLowerCase() === 'feat'),
    isSpellChoice: cs.options.length > 0 && cs.options.every((opt) => String(opt?.type ?? '').toLowerCase() === 'spell'),
    isWeaponChoice: cs.options.length > 0 && cs.options.every((opt) => String(opt?.type ?? '').toLowerCase() === 'weapon'),
    options: hydrateChoiceSetOptions(wizard, cs, skillState, currentChoices),
    selectedOption: findMatchingChoiceOption(cs.options, currentChoices?.[cs.flag] ?? null),
    hasSelection: !!currentChoices[cs.flag] && currentChoices[cs.flag] !== '[object Object]',
  }));
}

export async function getSelectedSubclassChoiceLabels(wizard) {
  return getSelectedChoiceLabels(wizard, wizard.data.subclass);
}

export async function getSelectedFeatChoiceLabels(wizard, slot) {
  const grantedSection = (wizard.data.grantedFeatSections ?? []).find((section) => section.slot === slot);
  const feat = slot === 'ancestry' ? wizard.data.ancestryFeat
      : slot === 'ancestryParagon' ? wizard.data.ancestryParagonFeat
      : slot === 'class' ? wizard.data.classFeat
        : slot === 'dualClass' ? wizard.data.dualClassFeat
        : slot === 'skill' ? wizard.data.skillFeat
          : grantedSection
            ? { choiceSets: grantedSection.choiceSets ?? [], choices: wizard.data.grantedFeatChoices?.[slot] ?? {} }
            : null;
  return getSelectedChoiceLabels(wizard, feat);
}

export async function refreshGrantedFeatChoiceSections(wizard) {
  const sections = [];
  const seenSections = new Set();
  const scannedItems = new Set();
  const shouldLogDeityDomains = wizard.data.class?.slug === 'cleric' && !!wizard.data.deity;

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name },
    { uuid: wizard.data.dualClass?.uuid, label: wizard.data.dualClass?.name },
    { uuid: wizard.data.subclass?.uuid, label: wizard.data.subclass?.name, skipDirectSection: true, choiceSource: wizard.data.subclass },
    { uuid: wizard.data.dualSubclass?.uuid, label: wizard.data.dualSubclass?.name, skipDirectSection: true, choiceSource: wizard.data.dualSubclass },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name, skipDirectSection: true, choiceSource: wizard.data.ancestryFeat },
    { uuid: wizard.data.ancestryParagonFeat?.uuid, label: wizard.data.ancestryParagonFeat?.name, skipDirectSection: true, choiceSource: wizard.data.ancestryParagonFeat },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name, skipDirectSection: true, choiceSource: wizard.data.classFeat },
    { uuid: wizard.data.dualClassFeat?.uuid, label: wizard.data.dualClassFeat?.name, skipDirectSection: true, choiceSource: wizard.data.dualClassFeat },
    { uuid: wizard.data.skillFeat?.uuid, label: wizard.data.skillFeat?.name, skipDirectSection: true, choiceSource: wizard.data.skillFeat },
    ...getSelectedHandlerChoiceSourceItems(wizard),
  ];

  const resolveSelectedChoiceItem = async (choiceSet, currentChoices) => {
    const selectedValue = currentChoices?.[choiceSet.flag];
    let resolvedSelectedValue = typeof selectedValue === 'string' && selectedValue !== '[object Object]'
      ? selectedValue
      : null;

    if (!resolvedSelectedValue) {
      resolvedSelectedValue = getHandlerManagedChoiceValue(wizard, choiceSet);
    }
    if (typeof resolvedSelectedValue !== 'string' || resolvedSelectedValue === '[object Object]') return null;

    const option = findMatchingChoiceOption(choiceSet.options, resolvedSelectedValue);
    const uuid = option?.uuid ?? (resolvedSelectedValue.startsWith('Compendium.') ? resolvedSelectedValue : null);
    if (!uuid) return null;
    return resolveDocument(wizard, uuid);
  };

  const scanItem = async (item, sourceName, {
    skipDirectSection = false,
    choiceSource = null,
    suppressIfSatisfied = false,
    inheritedSkillChoiceSet = null,
  } = {}) => {
    if (!item?.uuid || scannedItems.has(item.uuid)) return;
    scannedItems.add(item.uuid);

    const currentChoices = choiceSource?.choices ?? wizard.data.grantedFeatChoices?.[item.uuid] ?? {};
    let parsedChoiceSets = await parseChoiceSets(wizard, item.system?.rules ?? [], currentChoices, item);
    if (isAssuranceGrant(item) && inheritedSkillChoiceSet) {
      parsedChoiceSets = constrainAssuranceChoiceSets(parsedChoiceSets, inheritedSkillChoiceSet);
    }
    const isSubclassSelector = isSubclassSelectionItem(wizard, item, parsedChoiceSets);
    const isHandlerManagedSelector = isHandlerManagedSelectionItem(wizard, item);

    const fullySatisfied = areChoiceSetsSatisfied(parsedChoiceSets, currentChoices);
    const shouldPushSection = !skipDirectSection
      && !isSubclassSelector
      && !isHandlerManagedSelector
      && parsedChoiceSets.length > 0
      && !seenSections.has(item.uuid)
      && !(suppressIfSatisfied && fullySatisfied);

    if (shouldPushSection) {
      seenSections.add(item.uuid);
      sections.push({
        slot: item.uuid,
        featName: item.name,
        sourceName,
        choiceSets: parsedChoiceSets,
      });
    }

    for (const choiceSet of parsedChoiceSets) {
      const selectedItem = await resolveSelectedChoiceItem(choiceSet, currentChoices);
      if (selectedItem) {
        await scanItem(selectedItem, `${sourceName} -> ${item.name}`);
      }
    }

    for (const rule of item.system?.rules ?? []) {
      if (rule.key !== 'GrantItem' || !rule.uuid) continue;
      if (!matchesGrantPredicate(rule, wizard)) continue;
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      const preselectedChoices = extractGrantPreselectedChoices(rule);
      const grantedChoiceSets = isAssuranceGrant(granted)
        ? await parseChoiceSets(wizard, granted.system?.rules ?? [], preselectedChoices, granted)
        : [];
      const alignedPreselectedChoices = isAssuranceGrant(granted)
        ? alignAssuranceGrantPreselectedChoices(grantedChoiceSets, preselectedChoices)
        : preselectedChoices;
      const choiceSource = Object.keys(alignedPreselectedChoices).length > 0
        ? { choices: alignedPreselectedChoices }
        : null;
      const inheritedSkillChoiceSet = isAssuranceGrant(granted)
        ? (
          findGrantSourceSkillChoiceSet(parsedChoiceSets)
          ?? buildAssurancePreselectedChoiceSet(grantedChoiceSets, alignedPreselectedChoices)
        )
        : null;
      const preserveAsIndependentChoiceSection = isAssuranceGrant(granted)
        && await shouldPreserveIndependentAssuranceSection(
          wizard,
          inheritedSkillChoiceSet,
          choiceSource?.choices ?? currentChoices,
        );
      if (isAssuranceGrant(granted) && !preserveAsIndependentChoiceSection) continue;
      await scanItem(granted, `${sourceName} -> ${granted.name}`, {
        choiceSource,
        suppressIfSatisfied: !preserveAsIndependentChoiceSection && !!choiceSource,
        inheritedSkillChoiceSet,
      });
    }

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature?.uuid || feature.level > 1) continue;
        const featureItem = await resolveDocument(wizard, feature.uuid);
        if (!featureItem) continue;
        await scanItem(featureItem, `${sourceName} -> ${feature.name}`);
      }
    }
  };

  for (const entry of topItems) {
    if (!entry.uuid || !entry.label) continue;
    const item = await resolveDocument(wizard, entry.uuid);
    if (!item) continue;
    await scanItem(item, entry.label, entry);
  }

  maybeAddSyntheticClericDomainInitiateSection(wizard, sections, seenSections, shouldLogDeityDomains);

  return sections;
}

function maybeAddSyntheticClericDomainInitiateSection(wizard, sections, seenSections, shouldLogDeityDomains) {
  if (wizard.data.class?.slug !== 'cleric' || !wizard.data.deity) return;
  if (!isCloisteredClericDoctrine(wizard.data.subclass)) return;

  const hasExistingDomainInitiate = sections.some((section) =>
    section.featName === 'Domain Initiate'
    || String(section.slot ?? '').includes('domain-initiate'),
  );
  if (hasExistingDomainInitiate) return;

  const options = normalizeDeityDomainChoiceOptions(wizard.data.deity?.domains);
  if (options.length === 0) return;

  const syntheticSlot = '__cleric-domain-initiate__';
  if (seenSections.has(syntheticSlot)) return;
  seenSections.add(syntheticSlot);

  sections.push({
    slot: syntheticSlot,
    featName: 'Domain Initiate',
    sourceName: 'Cleric -> Domain Initiate',
    choiceSets: [
      {
        flag: 'domainInitiate',
        prompt: game.i18n?.has?.('PF2E.SpecificRule.Prompt.DeitysDomain')
          ? game.i18n.localize('PF2E.SpecificRule.Prompt.DeitysDomain')
          : "Select a deity's domain.",
        options,
      },
    ],
  });

  if (shouldLogDeityDomains) {
    debug('Added synthetic cleric Domain Initiate section', {
      deity: wizard.data.deity.name,
      doctrine: wizard.data.subclass?.name ?? null,
      optionCount: options.length,
      options: options.map((option) => option.label),
    });
  }
}

function isCloisteredClericDoctrine(subclass) {
  const slug = String(subclass?.slug ?? '').toLowerCase();
  const name = String(subclass?.name ?? '').toLowerCase();
  return slug === 'cloistered-cleric' || name === 'cloistered cleric';
}

function isSubclassSelectionItem(wizard, item, parsedChoiceSets) {
  if (!item || !Array.isArray(parsedChoiceSets) || parsedChoiceSets.length === 0) return false;
  const subclassTag = wizard.data.class?.subclassTag ?? SUBCLASS_TAGS[wizard.data.class?.slug];
  if (typeof subclassTag !== 'string' || subclassTag.length === 0) return false;

  const rules = item.system?.rules ?? [];
  return rules.some((rule) => {
    if (rule.key !== 'ChoiceSet') return false;
    if (typeof rule.flag === 'string' && subclassTag.includes(rule.flag)) return true;

    const filters = JSON.stringify(rule?.choices?.filter ?? []);
    return typeof filters === 'string' && filters.includes(subclassTag);
  });
}

function isHandlerManagedSelectionItem(wizard, item) {
  if (!item) return false;

  const managedStepIds = new Set(
    wizard.classHandler?.getExtraSteps?.()
      ?.map((step) => step?.id)
      .filter((id) => typeof id === 'string' && id.length > 0)
    ?? [],
  );
  const managedFlags = new Set([
    'implement',
    'firstTactic',
    'secondTactic',
    'thirdTactic',
    'fourthTactic',
    'fifthTactic',
    'firstIkon',
    'secondIkon',
    'thirdIkon',
    'weaponInnovation',
    'armorInnovation',
    'initialModification',
    'elementTwo',
    'impulseOne',
    'impulseTwo',
    'arcaneThesis',
    'subconsciousMind',
    'divineFont',
    'sanctification',
  ]);

  const rules = item.system?.rules ?? [];
  return rules.some((rule) =>
    rule.key === 'ChoiceSet'
    && (
      managedFlags.has(rule.flag)
      || isHandlerManagedChoiceRule(rule, managedStepIds)
    ));
}

function isHandlerManagedChoiceRule(rule, managedStepIds) {
  if (!rule || typeof rule !== 'object') return false;

  const prompt = String(rule.prompt ?? '').toLowerCase();
  const normalizedPrompt = game.i18n?.has?.(rule.prompt)
    ? game.i18n.localize(rule.prompt).trim().toLowerCase()
    : prompt.trim();
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();

  if (managedStepIds.has('deity')) {
    if (rule.flag === 'deity') return true;
    if (filterText.includes('item:type:deity') || filterText.includes('item:category:deity')) return true;
    if (normalizedPrompt === 'select a deity.' || normalizedPrompt === 'select a deity') return true;
  }

  if (managedStepIds.has('sanctification')) {
    if (rule.flag === 'sanctification') return true;
    if (prompt.includes('sanctification')) return true;
  }

  if (managedStepIds.has('divineFont')) {
    if (rule.flag === 'divineFont') return true;
    if (prompt.includes('divine font')) return true;
  }

  return false;
}

function getHandlerManagedChoiceValue(wizard, choiceSet) {
  const prompt = String(choiceSet?.prompt ?? '').trim().toLowerCase();
  const localizedPrompt = game.i18n?.has?.(choiceSet?.prompt)
    ? game.i18n.localize(choiceSet.prompt).trim().toLowerCase()
    : prompt;
  const filters = Array.isArray(choiceSet?.choices?.filter)
    ? choiceSet.choices.filter.filter((entry) => typeof entry === 'string')
    : [];
  const filterText = JSON.stringify(filters).toLowerCase();

  if (
    choiceSet?.flag === 'deity'
    || localizedPrompt === 'select a deity.'
    || localizedPrompt === 'select a deity'
    || filterText.includes('item:type:deity')
    || filterText.includes('item:category:deity')
  ) {
    return wizard.data.deity?.uuid ?? null;
  }

  return null;
}

export async function getSelectedChoiceLabels(wizard, choiceContainer) {
  const choiceSets = choiceContainer?.choiceSets ?? [];
  const currentChoices = choiceContainer?.choices ?? {};
  const labels = [];

  for (const cs of choiceSets) {
    const selectedValue = currentChoices[cs.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') continue;

    const match = findMatchingChoiceOption(cs.options, selectedValue);
    if (match?.label) {
      labels.push(match.label);
      continue;
    }

    if (selectedValue.startsWith('Compendium.')) {
      const item = await resolveDocument(wizard, selectedValue);
      if (item?.name) {
        labels.push(item.name);
        continue;
      }
    }

    labels.push(formatChoiceLabel(selectedValue));
  }

  return labels.filter((label) => typeof label === 'string' && label.length > 0);
}

export function formatChoiceLabel(value) {
  return value
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getPendingChoices(wizard) {
  const choices = [];
  const seen = new Set();
  const scannedItems = new Set();
  const scannedChoiceSources = new Set();

  const addChoice = (source, prompt) => {
    const text = game.i18n.has(prompt) ? game.i18n.localize(prompt) : prompt.replace(/^PF2E\./, '').replace(/([A-Z])/g, ' $1').trim();
    const key = `${source}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    choices.push({ source, prompt: text });
  };

  const subclassTag = wizard.data.class?.subclassTag ?? SUBCLASS_TAGS[wizard.data.class?.slug];
  const hasSubclass = !!wizard.data.subclass;

  const scanItem = async (item, sourceLabel, optionSource = null) => {
    if (!item?.uuid || scannedItems.has(item.uuid)) return;
    scannedItems.add(item.uuid);

    const rules = item.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'ChoiceSet' || !rule.prompt) continue;
      if (hasSubclass && rule.choices?.filter?.some?.((f) => typeof f === 'string' && f.includes(subclassTag))) continue;
      if (hasSubclass && rule.flag && subclassTag?.includes(rule.flag)) continue;
      if (optionSource?.choices?.[rule.flag]) continue;
      if (optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[rule.flag]) continue;
      const storedChoices = optionSource?.choices
        ?? (optionSource?.uuid ? wizard.data.grantedFeatChoices?.[optionSource.uuid] ?? {} : {});
      if (isAssuranceGrant(item) && isSkillChoiceSet(rule) && hasMeaningfulStoredChoice(storedChoices)) continue;
      if (wizard.data.implement && rule.flag === 'implement') continue;
      if (wizard.data.tactics?.length >= 5 && ['firstTactic', 'secondTactic', 'thirdTactic', 'fourthTactic', 'fifthTactic'].includes(rule.flag)) continue;
      if (wizard.data.ikons?.length >= 3 && ['firstIkon', 'secondIkon', 'thirdIkon'].includes(rule.flag)) continue;
      if (wizard.data.innovationItem && ['weaponInnovation', 'armorInnovation'].includes(rule.flag)) continue;
      if (wizard.data.innovationModification && rule.flag === 'initialModification') continue;
      if (wizard.data.class?.slug === 'kineticist' && wizard.data.kineticGateMode && rule.prompt === 'PF2E.SpecificRule.Kineticist.KineticGate.Prompt.Gate') continue;
      if (wizard.data.secondElement && rule.flag === 'elementTwo') continue;
      if ((wizard.data.kineticImpulses?.length ?? 0) >= 1 && rule.flag === 'impulseOne') continue;
      if ((wizard.data.kineticImpulses?.length ?? 0) >= 2 && rule.flag === 'impulseTwo') continue;
      if (wizard.data.thesis && rule.flag === 'arcaneThesis') continue;
      if (wizard.data.subconsciousMind && rule.flag === 'subconsciousMind') continue;
      if (wizard.data.divineFont && rule.flag === 'divineFont') continue;
      addChoice(sourceLabel, rule.prompt);
    }
    for (const rule of rules) {
      if (rule.key !== 'GrantItem' || !rule.uuid) continue;
      if (!matchesGrantPredicate(rule, wizard)) continue;
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      const preselectedChoices = extractGrantPreselectedChoices(rule);
      const grantedChoiceSets = isAssuranceGrant(granted)
        ? await parseChoiceSets(wizard, granted.system?.rules ?? [], preselectedChoices, granted)
        : [];
      const alignedPreselectedChoices = isAssuranceGrant(granted)
        ? alignAssuranceGrantPreselectedChoices(grantedChoiceSets, preselectedChoices)
        : preselectedChoices;
      await scanItem(granted, `${sourceLabel} -> ${granted.name}`, {
        choices: alignedPreselectedChoices,
      });
    }
  };

  const scanChoiceSource = async (sourceLabel, optionSource = null) => {
    const sourceKey = `${sourceLabel}:${optionSource?.uuid ?? 'inline'}`;
    if (scannedChoiceSources.has(sourceKey)) return;
    scannedChoiceSources.add(sourceKey);

    for (const choiceSet of (optionSource?.choiceSets ?? [])) {
      if (!choiceSet?.prompt) continue;
      if (optionSource?.choices?.[choiceSet.flag]) continue;
      if (optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[choiceSet.flag]) continue;
      addChoice(sourceLabel, choiceSet.prompt);
    }
  };

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name },
    { uuid: wizard.data.dualClass?.uuid, label: wizard.data.dualClass?.name },
    { uuid: wizard.data.subclass?.uuid, label: wizard.data.subclass?.name, optionSource: wizard.data.subclass },
    { uuid: wizard.data.dualSubclass?.uuid, label: wizard.data.dualSubclass?.name, optionSource: wizard.data.dualSubclass },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name },
    { uuid: wizard.data.ancestryParagonFeat?.uuid, label: wizard.data.ancestryParagonFeat?.name },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name },
    { uuid: wizard.data.dualClassFeat?.uuid, label: wizard.data.dualClassFeat?.name },
    { uuid: wizard.data.skillFeat?.uuid, label: wizard.data.skillFeat?.name },
    ...getSelectedHandlerChoiceSourceItems(wizard).map((entry) => ({ uuid: entry.uuid, label: entry.label, optionSource: entry })),
  ];

  for (const { uuid, label, optionSource } of topItems) {
    if (!uuid) continue;
    const item = await resolveDocument(wizard, uuid);
    if (!item) {
      if ((optionSource?.choiceSets?.length ?? 0) > 0) {
        await scanChoiceSource(label, optionSource);
      }
      continue;
    }
    const sourceChoices = optionSource ?? (uuid === wizard.data.ancestryFeat?.uuid ? wizard.data.ancestryFeat
      : uuid === wizard.data.subclass?.uuid ? wizard.data.subclass
        : uuid === wizard.data.dualSubclass?.uuid ? wizard.data.dualSubclass
      : uuid === wizard.data.ancestryParagonFeat?.uuid ? wizard.data.ancestryParagonFeat
        : uuid === wizard.data.classFeat?.uuid ? wizard.data.classFeat
          : uuid === wizard.data.dualClassFeat?.uuid ? wizard.data.dualClassFeat
          : uuid === wizard.data.skillFeat?.uuid ? wizard.data.skillFeat
            : null);
    await scanItem(item, label, sourceChoices);

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature.uuid || feature.level > 1) continue;
        const featItem = await resolveDocument(wizard, feature.uuid);
        if (!featItem) continue;
        await scanItem(featItem, `${label} -> ${feature.name}`);
      }
    }

    if ((sourceChoices?.choiceSets?.length ?? 0) > 0) {
      await scanChoiceSource(label, sourceChoices);
    }
  }

  return choices;
}

export async function parseChoiceSets(wizard, rules, currentChoices = {}, sourceItem = null) {
  const allRules = [
    ...(rules ?? []),
    ...await buildSyntheticChoiceSetRules(wizard, rules ?? [], currentChoices, sourceItem),
  ];
  const sets = [];
  for (const [index, rule] of allRules.entries()) {
    if (rule.key !== 'ChoiceSet') continue;
    const flag = getChoiceSetFlag(rule, index);
    if (!flag) continue;
    const normalizedRule = { ...rule, flag };
    if (!matchesChoiceSetPredicate(normalizedRule.predicate, buildChoiceSetRollOptions(allRules, currentChoices))) continue;
    const options = await resolveChoiceSetOptions(wizard, normalizedRule, currentChoices, sourceItem);
    if (options.length > 0) {
      const prompt = normalizedRule.prompt ? (game.i18n.has(normalizedRule.prompt) ? game.i18n.localize(normalizedRule.prompt) : normalizedRule.prompt) : normalizedRule.flag;
      const set = {
        flag: normalizedRule.flag,
        prompt,
        options,
      };
      if (shouldAllowAutoTrainedSkillSelection(sourceItem, normalizedRule)) set.allowAutoTrainedSelection = true;
      if (normalizedRule.leveler?.syntheticType) set.syntheticType = normalizedRule.leveler.syntheticType;
      if (normalizedRule.leveler?.grantsSkillTraining === true) set.grantsSkillTraining = true;
      if (Array.isArray(normalizedRule.leveler?.blockedSkills) && normalizedRule.leveler.blockedSkills.length > 0) {
        set.blockedSkills = [...normalizedRule.leveler.blockedSkills];
      }
      if (normalizedRule.leveler?.sourceName) set.sourceName = normalizedRule.leveler.sourceName;
      sets.push(set);
    }
  }
  return sets;
}

async function buildSyntheticChoiceSetRules(wizard, rules, currentChoices, sourceItem) {
  if (!sourceItem) return [];

  const syntheticRules = [];

  if (!hasSkillFallbackText(sourceItem?.system?.description?.value ?? '')) return syntheticRules;

  const grantedSkills = await extractGrantedTrainedSkills(wizard, rules, currentChoices, sourceItem);
  if (grantedSkills.length === 0) return syntheticRules;

  const skillContext = await buildSkillContext(wizard);
  const skillContextBySlug = new Map((skillContext ?? []).map((entry) => [entry.slug, entry]));
  const overlaps = grantedSkills.filter((skill) => {
    const entry = skillContextBySlug.get(skill);
    if (!entry) return false;
    if (entry.selected) return true;
    if (!entry.autoTrained) return false;
    return !isAutoTrainedBySource(entry, sourceItem);
  });
  if (overlaps.length === 0) return syntheticRules;

  return [
    ...syntheticRules,
    ...overlaps.map((skill, index) => ({
    key: 'ChoiceSet',
    flag: `levelerSkillFallback${index + 1}`,
    prompt: 'Select a skill.',
    choices: { config: 'skills' },
    leveler: {
      syntheticType: 'skill-training-fallback',
      grantsSkillTraining: true,
      sourceSkill: skill,
      blockedSkills: grantedSkills.filter((entry) => entry !== skill),
      sourceName: sourceItem?.name ?? null,
    },
  }))];
}

function isAutoTrainedBySource(entry, sourceItem) {
  if (!entry?.autoTrained || !sourceItem) return false;
  const sourceName = String(sourceItem.name ?? '').trim();
  if (sourceName && entry.source === sourceName) return true;

  const sourceType = String(sourceItem.type ?? '').toLowerCase();
  if (sourceType === 'background') return entry.source === localizeWithFallback('CREATION.AUTO_TRAINED_BACKGROUND', 'Background');
  if (sourceType === 'class') return entry.source === localizeWithFallback('CREATION.AUTO_TRAINED_CLASS', 'Class');
  if (sourceType === 'ancestry') return entry.source === localizeWithFallback('CREATION.AUTO_TRAINED_ANCESTRY', 'Ancestry');
  return false;
}

function localizeWithFallback(key, fallback) {
  const value = localize(key);
  return value === `PF2E_LEVELER.${key}` ? fallback : value;
}

export async function buildMixedAncestryChoiceOptions(wizard) {
  const ancestries = await wizard._loadAncestries();
  const primarySlug = String(wizard?.data?.ancestry?.slug ?? '').trim().toLowerCase();

  return ancestries
    .filter((entry) => entry?.type === 'ancestry')
    .filter((entry) => String(entry?.slug ?? '').trim().toLowerCase() !== primarySlug)
    .map((entry) => ({
      value: entry.slug ?? entry.uuid,
      name: entry.name,
      label: entry.name,
      uuid: entry.uuid,
      img: entry.img ?? null,
      slug: entry.slug ?? null,
      traits: entry.traits ?? [],
      rarity: entry.rarity ?? 'common',
      type: 'ancestry',
      description: entry.description ?? '',
    }));
}

function hasSkillFallbackText(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return false;
  if (description.includes('skill of your choice') && description.includes('already trained')) return true;

  return [
    /if you would automatically become trained in one of those skills(?:\s*\([^)]*\))?,?\s+you instead become trained in a skill of your choice\.?/,
    /for each of (?:these|those) skills in which you were already trained,?\s+you instead become trained in a skill of your choice\.?/,
    /if you were already trained in both,?\s+you become trained in a skill of your choice\.?/,
  ].some((pattern) => pattern.test(description));
}

export async function extractGrantedTrainedSkills(wizard, rules, currentChoices = {}, sourceItem = null) {
  const skills = new Set();
  const scannedUuids = new Set();

  const collectFromItem = async (item, itemRules = item?.system?.rules ?? []) => {
    const itemUuid = item?.uuid ?? null;
    if (itemUuid && scannedUuids.has(itemUuid)) return;
    if (itemUuid) scannedUuids.add(itemUuid);

    for (const rule of (itemRules ?? [])) {
      if (rule?.key !== 'ActiveEffectLike') continue;
      const match = String(rule?.path ?? '').match(/^system\.skills\.([^.]+)\.rank$/);
      if (!match) continue;
      if (Number(rule?.value) < 1) continue;
      if (!SKILLS.includes(match[1])) continue;
      skills.add(match[1]);
    }

    for (const selectedValue of Object.values(currentChoices ?? {})) {
      if (typeof selectedValue !== 'string' || !selectedValue.startsWith('Compendium.')) continue;
      const selectedItem = await resolveDocument(wizard, selectedValue);
      if (selectedItem) await collectFromItem(selectedItem);
    }

    for (const rule of (itemRules ?? [])) {
      if (rule?.key !== 'GrantItem' || typeof rule?.uuid !== 'string') continue;
      if (!matchesGrantPredicate(rule, wizard)) continue;
      const grantedUuid = resolveGrantRuleUuid(rule.uuid, currentChoices);
      if (!grantedUuid) continue;
      const grantedItem = await resolveDocument(wizard, grantedUuid);
      if (grantedItem) await collectFromItem(grantedItem);
    }
  };

  await collectFromItem(sourceItem, rules);
  for (const skill of extractExplicitTrainedSkillsFromDescription(sourceItem?.system?.description?.value ?? '')) {
    skills.add(skill);
  }

  const description = String(sourceItem?.system?.description?.value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (/\byour deity'?s associated skill\b/.test(description)) {
    const deitySkill = await resolveAssociatedDeitySkill(wizard, rules, currentChoices);
    if (SKILLS.includes(deitySkill)) skills.add(deitySkill);
  }

  return [...skills];
}

function resolveGrantRuleUuid(uuid, choices) {
  const raw = String(uuid ?? '').trim();
  if (!raw) return null;
  if (!raw.includes('{item|flags.pf2e.rulesSelections.')) return raw;

  const resolved = raw.replace(/\{item\|flags\.pf2e\.rulesSelections\.([^}]+)\}/g, (_match, flag) => {
    const value = choices?.[flag];
    return typeof value === 'string' ? value : '';
  });

  return resolved.includes('{item|') ? null : resolved;
}

function extractExplicitTrainedSkillsFromDescription(html) {
  const description = String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!description) return [];

  const matches = description.match(/\b(?:you\s+)?(?:become|are)\s+trained\s+in\s+([^.!?]+)/gu) ?? [];
  if (matches.length === 0) return [];

  const skills = new Set();
  for (const clause of matches) {
    for (const skill of SKILLS) {
      const raw = globalThis.CONFIG?.PF2E?.skills?.[skill];
      const label = typeof raw === 'string' ? raw : (raw?.label ?? skill);
      const localized = game.i18n?.has?.(label) ? game.i18n.localize(label) : label;
      if (clause.includes(String(localized).toLowerCase())) skills.add(skill);
    }
  }

  return [...skills];
}

async function resolveAssociatedDeitySkill(wizard, rules, currentChoices = {}) {
  const deityChoiceRule = (rules ?? []).find((rule) => rule?.key === 'ChoiceSet' && isDeityChoiceRule(rule));
  const deityChoiceFlag = deityChoiceRule ? getChoiceSetFlag(deityChoiceRule) : null;
  const selectedDeityUuid = deityChoiceFlag ? currentChoices?.[deityChoiceFlag] : null;

  if (typeof selectedDeityUuid === 'string' && selectedDeityUuid !== '[object Object]') {
    const deityItem = await resolveDocument(wizard, selectedDeityUuid);
    const deitySkill = deityItem?.system?.skill ?? null;
    if (SKILLS.includes(deitySkill)) return deitySkill;
  }

  return wizard?.data?.deity?.skill ?? null;
}

function isDeityChoiceRule(rule) {
  if (!rule || typeof rule !== 'object') return false;

  const prompt = String(rule.prompt ?? '').toLowerCase();
  const localizedPrompt = game.i18n?.has?.(rule.prompt)
    ? game.i18n.localize(rule.prompt).trim().toLowerCase()
    : prompt.trim();
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();

  return rule.flag === 'deity'
    || filterText.includes('item:type:deity')
    || filterText.includes('item:category:deity')
    || localizedPrompt === 'select a deity.'
    || localizedPrompt === 'select a deity';
}

async function resolveChoiceSetOptions(wizard, rule, currentChoices = {}, sourceItem = null) {
  if (Array.isArray(rule.choices)) {
    return Promise.all(rule.choices
      .filter((c) => extractChoiceValue(c) || extractChoiceLabel(c))
      .map((c) => enrichChoiceOption(wizard, c)));
  }

  if (isSkillChoiceSet(rule)) {
    return resolveSkillChoiceSetOptions(wizard, rule, currentChoices, sourceItem);
  }

  if (typeof rule.choices === 'string') {
    return resolveStringChoiceOptions(wizard, rule.choices);
  }

  if (!rule.choices || typeof rule.choices !== 'object') return [];
  if (typeof rule.choices.config === 'string') {
    return resolveConfigChoiceOptions(rule.choices.config);
  }

  const candidates = await loadChoiceSetCandidates(wizard, rule.choices);
  const slugsAsValues = !!rule.choices.slugsAsValues;
  const promptImpliesCommonAncestry = isCommonAncestryChoiceSet(rule)
    && !String(JSON.stringify(rule.choices.filter ?? [])).includes('item:rarity:')
  const itemType = typeof rule.choices.itemType === 'string' ? rule.choices.itemType.toLowerCase() : null;
  return candidates
    .filter((item) => {
      const type = String(item.type ?? '').toLowerCase();
      const category = String(item.category ?? '').toLowerCase();
      if (isAncestryChoiceSet(rule)) return type === 'ancestry';
      if (itemType === 'heritage') return type === 'heritage';
      if (itemType === 'deity') return type === 'deity' || category === 'deity';
      if (itemType === 'classfeature') return category === 'classfeature';
      return true;
    })
    .filter((item) => matchesChoiceSetFilters(item, rule.choices.filter ?? []))
    .filter((item) => !promptImpliesCommonAncestry || String(item.rarity ?? 'common').toLowerCase() === 'common')
    .filter((item) => {
      const cat = String(item.category ?? '').toLowerCase();
      if (cat === 'classfeature') return itemType === 'classfeature';
      return true;
    })
    .filter((item) => slugsAsValues ? !!(item.slug ?? item.uuid) : !!(item.uuid ?? item.slug))
    .map((item) => ({
      value: slugsAsValues ? (item.slug ?? item.uuid) : (item.uuid ?? item.slug),
      label: item.name,
      uuid: item.uuid ?? null,
      img: item.img ?? null,
      traits: item.traits ?? [],
      rarity: item.rarity ?? 'common',
      type: item.type ?? null,
      category: item.category ?? null,
      range: item.range ?? null,
      isRanged: !!item.isRanged,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function resolveSkillChoiceSetOptions(wizard, rule, currentChoices = {}, sourceItem = null) {
  const options = resolveConfigChoiceOptions('skills');
  const skillContext = await buildSkillContext(wizard);
  const skillState = createSkillStateMap(skillContext);
  const allowAutoTrainedSelection = !!rule?.leveler?.allowAutoTrainedSelection
    || shouldAllowAutoTrainedSkillSelection(sourceItem, rule);
  const suppressTrainingBadges = shouldSuppressTrainingBadges(sourceItem, rule);
  return decorateSkillChoiceOptions(options, skillState, currentChoices, {
    flag: rule?.flag ?? null,
    blockedSkills: rule?.leveler?.blockedSkills ?? [],
    blockedSourceName: rule?.leveler?.sourceName ?? null,
    allowAutoTrainedSelection,
    suppressTrainingBadges,
    assuranceTakenSkills: allowAutoTrainedSelection ? collectAssuranceSelectedSkills(wizard, rule?.flag ?? null, currentChoices) : [],
  });
}

function hydrateChoiceSetOptions(wizard, choiceSet, skillState, currentChoices) {
  const selectedValue = currentChoices?.[choiceSet.flag] ?? null;
  const baseOptions = (choiceSet.options ?? []).map((opt) => {
    const value = extractChoiceValue(opt);
    const label = extractChoiceLabel(opt) || value;
    const selected = findMatchingChoiceOption([opt], selectedValue) != null;
    return {
      ...opt,
      value,
      label,
      uuid: extractChoiceUuid(opt),
      category: opt?.category ?? null,
      range: opt?.range ?? null,
      isRanged: !!opt?.isRanged,
      selected,
    };
  });

  if (!isStoredSkillChoiceSet(choiceSet)) {
    return baseOptions.map((opt) => ({
      ...opt,
      selectedInSkills: false,
      autoTrained: false,
      autoTrainedSource: null,
      disabled: false,
    }));
  }

  return decorateSkillChoiceOptions(baseOptions, skillState, currentChoices, {
    flag: choiceSet?.flag ?? null,
    blockedSkills: choiceSet?.blockedSkills ?? [],
    blockedSourceName: choiceSet?.sourceName ?? null,
    allowAutoTrainedSelection: !!choiceSet?.allowAutoTrainedSelection,
    suppressTrainingBadges: shouldSuppressTrainingBadges(choiceSet, { flag: choiceSet?.flag }),
    assuranceTakenSkills: choiceSet?.allowAutoTrainedSelection
      ? collectAssuranceSelectedSkills(wizard, choiceSet?.flag ?? null, currentChoices)
      : [],
  });
}

function isStoredSkillChoiceSet(choiceSet) {
  if (choiceSet?.grantsSkillTraining === true) return true;
  if (choiceSet?.syntheticType === 'skill-training-fallback') return true;
  return isSkillChoiceSet(choiceSet);
}

function decorateSkillChoiceOptions(options, skillState, currentChoices = {}, {
  flag = null,
  blockedSkills = [],
  blockedSourceName = null,
  allowAutoTrainedSelection = false,
  suppressTrainingBadges = false,
  assuranceTakenSkills = [],
} = {}) {
  const featChoicesSource = localizeWithFallback('CREATION.FEAT_CHOICES', 'Feat Choices');
  const normalizedBlockedSkills = new Set((blockedSkills ?? []).map((skill) => normalizeSkillIdentity(skill)));
  const normalizedAssuranceTakenSkills = new Set((assuranceTakenSkills ?? []).map((skill) => normalizeSkillIdentity(skill)));
  const selectedSkills = new Set(
    Object.entries(currentChoices ?? {})
      .filter(([entryFlag]) => entryFlag !== flag)
      .map(([, value]) => value)
      .filter((value) => typeof value === 'string' && value !== '[object Object]')
      .map((value) => normalizeSkillIdentity(value)),
  );
  const currentSelected = normalizeSkillIdentity(currentChoices?.[flag] ?? null);

  const decorated = (options ?? [])
      .filter((option) => {
        const optionKeys = getSkillOptionKeys(option);
        if (optionKeys.includes(currentSelected)) return true;
        if (!matchesSkillOptionPredicate(option?.predicate, skillState)) return false;
        if (optionKeys.some((key) => hasMatchingSkillIdentity(selectedSkills, key))) return false;
      return true;
    })
    .map((option) => {
      const optionKeys = getSkillOptionKeys(option);
      const isCurrentSelection = !!findMatchingChoiceOption([option], currentChoices?.[flag] ?? null);
      const matchedState = optionKeys
        .map((key) => findMatchingSkillState(skillState, key))
        .find(Boolean) ?? null;
      const blockedBySyntheticGrant = optionKeys.some((key) => normalizedBlockedSkills.has(key));
      const suppressFeatChoiceSource = isCurrentSelection && matchedState?.source === featChoicesSource;
      const effectiveState = {
        selected: suppressFeatChoiceSource || suppressTrainingBadges ? false : !!matchedState?.selected,
        autoTrained: suppressFeatChoiceSource || suppressTrainingBadges ? false : !!matchedState?.autoTrained || blockedBySyntheticGrant,
        source: suppressFeatChoiceSource || suppressTrainingBadges ? null : matchedState?.source ?? (blockedBySyntheticGrant ? blockedSourceName : null),
      };
      const alreadyHasAssurance = optionKeys.some((key) => normalizedAssuranceTakenSkills.has(key));

      return {
        ...option,
        selected: isCurrentSelection,
        selectedInSkills: !!effectiveState.selected,
        autoTrained: !!effectiveState.autoTrained,
        autoTrainedSource: effectiveState.source ?? null,
        disabled: isCurrentSelection ? false : allowAutoTrainedSelection
          ? alreadyHasAssurance
          : alreadyHasAssurance || !!effectiveState.selected || !!effectiveState.autoTrained,
        };
      });

  if (decorated.some((option) => option.disabled !== true)) {
    return decorated;
  }

  const fallbackOptions = (resolveConfigChoiceOptions('skills') ?? []).filter((option) => {
    const optionKeys = getSkillOptionKeys(option);
    const selectedHere = optionKeys.some((key) => key === currentSelected);
    if (!selectedHere && optionKeys.some((key) => normalizedBlockedSkills.has(key))) return false;
    if (!selectedHere && optionKeys.some((key) => hasMatchingSkillIdentity(selectedSkills, key))) return false;
    const matchedState = optionKeys
      .map((key) => findMatchingSkillState(skillState, key))
      .find(Boolean) ?? null;
    return selectedHere || (!matchedState?.selected && !matchedState?.autoTrained);
  });

  return fallbackOptions.length > 0
    ? decorateSkillChoiceOptions(fallbackOptions, skillState, currentChoices, { flag, blockedSkills, blockedSourceName, allowAutoTrainedSelection, suppressTrainingBadges, assuranceTakenSkills })
    : decorated;
}

function shouldSuppressTrainingBadges(sourceItem, rule = {}) {
  const flag = String(rule?.flag ?? '').toLowerCase();
  if (flag === 'assurance') return true;
  const sourceSlug = String(sourceItem?.system?.slug ?? sourceItem?.slug ?? '').toLowerCase();
  const sourceName = String(sourceItem?.name ?? sourceItem?.featName ?? '').toLowerCase();
  return sourceSlug === 'assurance' || sourceName === 'assurance';
}

function matchesGrantPredicate(rule, wizard) {
  if (!rule?.predicate) return true;
  const actorLevel = wizard?.actor?.system?.details?.level?.value ?? 1;
  return evaluatePredicate(rule.predicate, actorLevel);
}

function collectAssuranceSelectedSkills(wizard, excludeFlag = null, currentChoices = {}) {
  const selectedSkills = new Set();

  const collectChoiceValue = (value, flag = null) => {
    if (flag && flag === excludeFlag) return;
    const normalized = normalizeSkillIdentity(value);
    if (normalized) selectedSkills.add(normalized);
  };

  const maybeCollectFromChoiceSource = (source, choices = source?.choices ?? {}) => {
    if (!isAssuranceChoiceSource(source)) return;
    for (const [flag, value] of Object.entries(choices ?? {})) {
      collectChoiceValue(value, flag);
    }
  };

  maybeCollectFromChoiceSource(wizard?.data?.ancestryFeat);
  maybeCollectFromChoiceSource(wizard?.data?.ancestryParagonFeat);
  maybeCollectFromChoiceSource(wizard?.data?.classFeat);
  maybeCollectFromChoiceSource(wizard?.data?.dualClassFeat);
  maybeCollectFromChoiceSource(wizard?.data?.skillFeat);

  for (const section of (wizard?.data?.grantedFeatSections ?? [])) {
    if (!isAssuranceChoiceSource(section)) continue;
    const sectionChoices = wizard?.data?.grantedFeatChoices?.[section.slot] ?? {};
    for (const [flag, value] of Object.entries(sectionChoices)) {
      collectChoiceValue(value, flag);
    }
  }

  for (const [flag, value] of Object.entries(currentChoices ?? {})) {
    collectChoiceValue(value, flag);
  }

  return [...selectedSkills];
}

function isAssuranceChoiceSource(source) {
  const slug = String(source?.system?.slug ?? source?.slug ?? '').toLowerCase();
  const name = String(source?.featName ?? source?.name ?? '').toLowerCase();
  return slug === 'assurance' || name === 'assurance';
}

function shouldAllowAutoTrainedSkillSelection(sourceItem, rule) {
  const sourceSlug = String(sourceItem?.system?.slug ?? sourceItem?.slug ?? '').toLowerCase();
  const sourceName = String(sourceItem?.name ?? '').toLowerCase();
  if (!isSkillChoiceSet(rule)) return false;
  return sourceSlug === 'assurance'
    || sourceName === 'assurance';
}

function isAssuranceGrant(item) {
  const slug = String(item?.system?.slug ?? item?.slug ?? '').toLowerCase();
  const name = String(item?.name ?? '').toLowerCase();
  return slug === 'assurance' || name === 'assurance';
}

function findGrantSourceSkillChoiceSet(choiceSets) {
  return (choiceSets ?? []).find((choiceSet) =>
    !choiceSet?.isItemChoice
    && isStoredSkillChoiceSet(choiceSet)
    && Array.isArray(choiceSet.options)
    && choiceSet.options.length > 0);
}

function alignAssuranceGrantPreselectedChoices(choiceSets, preselectedChoices = {}) {
  const choiceSet = findGrantSourceSkillChoiceSet(choiceSets);
  if (!choiceSet) return { ...preselectedChoices };

  const alignedChoices = { ...preselectedChoices };
  const currentValue = alignedChoices[choiceSet.flag];
  if (findMatchingChoiceOption(choiceSet.options ?? [], currentValue)) return alignedChoices;

  for (const value of Object.values(preselectedChoices ?? {})) {
    if (!findMatchingChoiceOption(choiceSet.options ?? [], value)) continue;
    alignedChoices[choiceSet.flag] = value;
    break;
  }

  return alignedChoices;
}

function buildAssurancePreselectedChoiceSet(choiceSets, currentChoices = {}) {
  const choiceSet = findGrantSourceSkillChoiceSet(choiceSets);
  if (!choiceSet) return null;

  const selectedValue = currentChoices?.[choiceSet.flag];
  if (typeof selectedValue !== 'string' || selectedValue.length === 0 || selectedValue === '[object Object]') {
    return null;
  }

  const matchedOption = findMatchingChoiceOption(choiceSet.options ?? [], selectedValue);
  if (!matchedOption) return null;

  return {
    ...choiceSet,
    options: [{ ...matchedOption }],
    allowAutoTrainedSelection: true,
  };
}

function constrainAssuranceChoiceSets(choiceSets, inheritedSkillChoiceSet) {
  if (!inheritedSkillChoiceSet) return choiceSets;

  return (choiceSets ?? []).map((choiceSet) => {
    if (!isStoredSkillChoiceSet(choiceSet)) return choiceSet;
    return {
      ...choiceSet,
      options: inheritedSkillChoiceSet.options.map((option) => ({ ...option })),
      allowAutoTrainedSelection: true,
    };
  });
}

async function shouldPreserveIndependentAssuranceSection(wizard, inheritedSkillChoiceSet, currentChoices = {}) {
  if (!inheritedSkillChoiceSet || !isStoredSkillChoiceSet(inheritedSkillChoiceSet)) return true;

  const selectedValue = currentChoices?.[inheritedSkillChoiceSet.flag];
  if (typeof selectedValue === 'string' && selectedValue.length > 0 && selectedValue !== '[object Object]') {
    if (findMatchingChoiceOption(inheritedSkillChoiceSet.options ?? [], selectedValue)) return false;
  }

  const skillContext = await buildSkillContext(wizard);
  const skillState = createSkillStateMap(skillContext);
  const decoratedOptions = decorateAuthoredSkillChoiceOptions(inheritedSkillChoiceSet.options ?? [], skillState, currentChoices, {
    flag: inheritedSkillChoiceSet.flag ?? null,
    blockedSkills: inheritedSkillChoiceSet.blockedSkills ?? [],
    blockedSourceName: inheritedSkillChoiceSet.sourceName ?? null,
    allowAutoTrainedSelection: !!inheritedSkillChoiceSet.allowAutoTrainedSelection,
    assuranceTakenSkills: [],
  });

  return !decoratedOptions.some((option) => option.disabled !== true);
}

function decorateAuthoredSkillChoiceOptions(options, skillState, currentChoices = {}, {
  flag = null,
  blockedSkills = [],
  blockedSourceName = null,
  allowAutoTrainedSelection = false,
  assuranceTakenSkills = [],
} = {}) {
  const normalizedBlockedSkills = new Set((blockedSkills ?? []).map((skill) => normalizeSkillIdentity(skill)));
  const normalizedAssuranceTakenSkills = new Set((assuranceTakenSkills ?? []).map((skill) => normalizeSkillIdentity(skill)));
  const selectedSkills = new Set(
    Object.entries(currentChoices ?? {})
      .filter(([entryFlag]) => entryFlag !== flag)
      .map(([, value]) => value)
      .filter((value) => typeof value === 'string' && value !== '[object Object]')
      .map((value) => normalizeSkillIdentity(value)),
  );

  return (options ?? [])
    .filter((option) => {
      if (!matchesSkillOptionPredicate(option?.predicate, skillState)) return false;
      const optionKeys = getSkillOptionKeys(option);
      if (optionKeys.some((key) => hasMatchingSkillIdentity(selectedSkills, key))) return false;
      return true;
    })
    .map((option) => {
      const optionKeys = getSkillOptionKeys(option);
      const matchedState = optionKeys
        .map((key) => findMatchingSkillState(skillState, key))
        .find(Boolean) ?? null;
      const blockedBySyntheticGrant = optionKeys.some((key) => normalizedBlockedSkills.has(key));
      const effectiveState = {
        selected: !!matchedState?.selected,
        autoTrained: !!matchedState?.autoTrained || blockedBySyntheticGrant,
        source: matchedState?.source ?? (blockedBySyntheticGrant ? blockedSourceName : null),
      };
      const alreadyHasAssurance = optionKeys.some((key) => normalizedAssuranceTakenSkills.has(key));

      return {
        ...option,
        selected: false,
        selectedInSkills: !!effectiveState.selected,
        autoTrained: !!effectiveState.autoTrained,
        autoTrainedSource: effectiveState.source ?? null,
        disabled: allowAutoTrainedSelection
          ? alreadyHasAssurance
          : alreadyHasAssurance || !!effectiveState.selected || !!effectiveState.autoTrained,
      };
    });
}

function matchesSkillOptionPredicate(predicate, skillState) {
  if (!predicate) return true;
  if (typeof predicate === 'string') return matchesSkillOptionPredicateString(predicate, skillState);
  if (Array.isArray(predicate)) return predicate.every((entry) => matchesSkillOptionPredicate(entry, skillState));
  if (typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.or)) return predicate.or.some((entry) => matchesSkillOptionPredicate(entry, skillState));
  if (Array.isArray(predicate.and)) return predicate.and.every((entry) => matchesSkillOptionPredicate(entry, skillState));
  if ('not' in predicate) return !matchesSkillOptionPredicate(predicate.not, skillState);
  if (Array.isArray(predicate.nor)) return predicate.nor.every((entry) => !matchesSkillOptionPredicate(entry, skillState));
  return true;
}

function matchesSkillOptionPredicateString(predicate, skillState) {
  const text = String(predicate ?? '').trim().toLowerCase();
  const rankMatch = text.match(/^skill:([^:]+):rank:(\d+)$/u);
  if (!rankMatch) return true;

  const [, rawSkill, rawRank] = rankMatch;
  const candidate = normalizeSkillIdentity(rawSkill);
  const state = findMatchingSkillState(skillState, candidate);
  const currentRank = Number(state?.rank ?? (state?.selected || state?.autoTrained ? 1 : 0));
  return currentRank === Number(rawRank);
}

function getSkillOptionKeys(option) {
  return [
    normalizeSkillIdentity(option?.value),
    normalizeSkillIdentity(option?.label),
    normalizeSkillIdentity(option?.slug),
    normalizeSkillIdentity(option?.name),
    normalizeSkillIdentity(option?.value?.slug),
    normalizeSkillIdentity(option?.value?.label),
    normalizeSkillIdentity(option?.value?.name),
  ].filter(Boolean);
}

function normalizeSkillIdentity(value) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/^pf2e\.skill/i, '')
    .replace(/[^a-z0-9]+/g, '');

  return SKILL_ID_ALIASES[normalized] ?? normalized;
}

const SKILL_ID_ALIASES = {
  acr: 'acrobatics',
  arc: 'arcana',
  ath: 'athletics',
  cra: 'crafting',
  dec: 'deception',
  dip: 'diplomacy',
  itm: 'intimidation',
  med: 'medicine',
  nat: 'nature',
  occ: 'occultism',
  prf: 'performance',
  rel: 'religion',
  soc: 'society',
  ste: 'stealth',
  sur: 'survival',
  thi: 'thievery',
};

function hasMatchingSkillIdentity(knownSkills, candidate) {
  if (!candidate) return false;
  for (const known of knownSkills) {
    if (known === candidate) return true;
    if (candidate.length >= 3 && known.startsWith(candidate)) return true;
    if (known.length >= 3 && candidate.startsWith(known)) return true;
  }
  return false;
}

function findMatchingSkillState(skillState, candidate) {
  if (!candidate) return null;
  for (const [known, state] of skillState.entries()) {
    if (known === candidate) return state;
    if (candidate.length >= 3 && known.startsWith(candidate)) return state;
    if (known.length >= 3 && candidate.startsWith(known)) return state;
  }
  return null;
}

function createSkillStateMap(skillContext) {
  const skillState = new Map();
  for (const entry of skillContext ?? []) {
    for (const key of [entry.slug, entry.label]) {
      const normalized = normalizeSkillIdentity(key);
      if (!normalized) continue;
      skillState.set(normalized, entry);
    }
  }
  return skillState;
}

function resolveConfigChoiceOptions(configPath) {
  const candidatePaths = [
    configPath,
    `CONFIG.PF2E.${configPath}`,
  ];
  const value = candidatePaths
    .map((path) => foundry.utils.getProperty(globalThis, path))
    .find((entry) => entry && typeof entry === 'object');
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value)
    .map(([key, entry]) => {
      const rawLabel = typeof entry === 'string' ? entry : (entry?.label ?? key);
      const label = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
      return { value: key, label };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function resolveStringChoiceOptions(wizard, choicePath) {
  const configOptions = resolveConfigChoiceOptions(choicePath);
  if (configOptions.length > 0) return configOptions;

  if (choicePath === 'system.details.deities.domains') {
    const storedOptions = normalizeDeityDomainChoiceOptions(wizard.data.deity?.domains);
    if (storedOptions.length > 0) return storedOptions;

    const deityItem = wizard.data.deity?.uuid ? await resolveDocument(wizard, wizard.data.deity.uuid) : null;
    const resolvedOptions = normalizeDeityDomainChoiceOptions(deityItem?.system?.domains);
    if (resolvedOptions.length > 0) return resolvedOptions;
  }

  if (!String(choicePath ?? '').startsWith('system.')) return [];

  const candidateUuids = [
    wizard.data.deity?.uuid,
    wizard.data.ancestry?.uuid,
    wizard.data.heritage?.uuid,
    wizard.data.background?.uuid,
    wizard.data.class?.uuid,
    wizard.data.subclass?.uuid,
  ].filter((uuid) => typeof uuid === 'string' && uuid.length > 0);

  for (const uuid of candidateUuids) {
    const item = await resolveDocument(wizard, uuid);
    const value = foundry.utils.getProperty(item, choicePath);
    const options = normalizePropertyChoiceOptions(value);
    if (options.length > 0) return options;
  }

  return [];
}

function normalizeDeityDomainChoiceOptions(domains) {
  if (!domains || typeof domains !== 'object') return [];

  const primary = Array.isArray(domains.primary) ? domains.primary : [];
  const alternate = Array.isArray(domains.alternate) ? domains.alternate : [];
  const options = [
    ...primary.map((value) => ({ value: String(value), label: formatChoiceLabel(String(value)) })),
    ...alternate.map((value) => ({
      value: String(value),
      label: `${formatChoiceLabel(String(value))} (apocryphal)`,
    })),
  ];

  return options.filter((entry) => entry.value.length > 0);
}

function normalizePropertyChoiceOptions(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return { value: entry, label: formatChoiceLabel(entry) };
        }
        if (entry && typeof entry === 'object') {
          const optionValue = entry.value ?? entry.slug ?? entry.id ?? entry.name ?? entry.label ?? null;
          if (!optionValue) return null;
          const rawLabel = entry.label ?? entry.name ?? optionValue;
          const label = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : String(rawLabel);
          return { value: String(optionValue), label };
        }
        return null;
      })
      .filter((entry) => !!entry)
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entry]) => {
        const rawLabel = typeof entry === 'string' ? entry : (entry?.label ?? entry?.name ?? key);
        const label = game.i18n?.has?.(rawLabel) ? game.i18n.localize(rawLabel) : String(rawLabel);
        return { value: key, label };
      })
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }

  return [];
}

function getChoiceSetFlag(rule, index = 0) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return typeof index === 'number' ? `choiceSet${index + 1}` : null;
}

function extractGrantPreselectedChoices(rule) {
  const rawChoices = rule?.preselectChoices ?? rule?.preselectChoice;
  if (!rawChoices || typeof rawChoices !== 'object') return {};

  return Object.fromEntries(
    Object.entries(rawChoices)
      .filter(([, value]) => ['string', 'number'].includes(typeof value))
      .map(([flag, value]) => [flag, String(value)]),
  );
}

function hasMeaningfulStoredChoice(choices = {}) {
  return Object.values(choices).some((value) =>
    typeof value === 'string' && value.length > 0 && value !== '[object Object]');
}

function areChoiceSetsSatisfied(choiceSets, currentChoices) {
  return (choiceSets ?? []).every((choiceSet, index) => {
    const flag = choiceSet?.flag ?? getChoiceSetFlag(choiceSet, index);
    const selectedValue = currentChoices?.[flag];
    return typeof selectedValue === 'string' && selectedValue.length > 0 && selectedValue !== '[object Object]';
  });
}

function buildChoiceSetRollOptions(rules, currentChoices) {
  const values = {};
  for (const [index, rule] of (rules ?? []).entries()) {
    if (rule?.key !== 'ChoiceSet') continue;
    const flag = getChoiceSetFlag(rule, index);
    const selectedValue = currentChoices?.[flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') continue;
    values[flag] = selectedValue;
    if (typeof rule.rollOption === 'string' && rule.rollOption.length > 0) {
      values[rule.rollOption] = selectedValue;
    }
  }
  return values;
}

function matchesChoiceSetPredicate(predicate, rollOptions) {
  if (!predicate) return true;
  if (typeof predicate === 'string') return matchesChoiceSetPredicateString(predicate, rollOptions);
  if (Array.isArray(predicate)) return predicate.every((entry) => matchesChoiceSetPredicate(entry, rollOptions));
  if (typeof predicate !== 'object') return true;
  if (Array.isArray(predicate.or)) return predicate.or.some((entry) => matchesChoiceSetPredicate(entry, rollOptions));
  if (Array.isArray(predicate.and)) return predicate.and.every((entry) => matchesChoiceSetPredicate(entry, rollOptions));
  if ('not' in predicate) return !matchesChoiceSetPredicate(predicate.not, rollOptions);
  if (Array.isArray(predicate.nor)) return predicate.nor.every((entry) => !matchesChoiceSetPredicate(entry, rollOptions));
  return true;
}

function matchesChoiceSetPredicateString(predicate, rollOptions) {
  const text = String(predicate ?? '');
  const separator = text.indexOf(':');
  if (separator < 0) return !!rollOptions[text];
  const key = text.slice(0, separator);
  const value = text.slice(separator + 1);
  return String(rollOptions[key] ?? '') === value;
}

function isCommonAncestryChoiceSet(rule) {
  if (!isAncestryChoiceSet(rule)) return false;

  const promptKey = String(rule.prompt ?? '');
  if (promptKey.includes('AdoptedAncestry')) return true;
  if (String(rule.flag ?? '').toLowerCase() === 'ancestry' && promptKey.startsWith('PF2E.')) return true;

  const localizedPrompt = game.i18n?.has?.(promptKey) ? game.i18n.localize(promptKey) : promptKey;
  return /common ancestry/i.test(localizedPrompt);
}

function isAncestryChoiceSet(rule) {
  const itemType = String(rule?.choices?.itemType ?? '').toLowerCase();
  if (itemType === 'ancestry') return true;

  const filters = JSON.stringify(rule?.choices?.filter ?? []);
  return filters.includes('item:type:ancestry');
}

function isSkillChoiceSet(rule) {
  if (String(rule?.flag ?? '').toLowerCase() === 'skill') return true;

  const promptKey = String(rule?.prompt ?? '');
  const localizedPrompt = game.i18n?.has?.(promptKey) ? game.i18n.localize(promptKey) : promptKey;
  if (/select a skill/i.test(localizedPrompt)) return true;

  const choiceString = typeof rule?.choices === 'string' ? rule.choices : '';
  if (choiceString === 'skills' || choiceString === 'CONFIG.PF2E.skills') return true;

  const configPath = typeof rule?.choices?.config === 'string' ? rule.choices.config : '';
  if (configPath === 'skills' || configPath === 'CONFIG.PF2E.skills') return true;

  const itemType = String(rule?.choices?.itemType ?? '').toLowerCase();
  if (itemType === 'skill') return true;

  const rawFilter = Array.isArray(rule?.choices) ? [] : (rule?.choices?.filter ?? []);
  const filters = JSON.stringify(rawFilter) ?? '';
  return filters.includes('item:type:skill');
}

async function enrichChoiceOption(wizard, choice) {
  const value = extractChoiceValue(choice);
  const rawLabel = extractChoiceLabel(choice) || value;
  const label = rawLabel && game.i18n.has(rawLabel) ? game.i18n.localize(rawLabel) : rawLabel;
  const choiceValue = choice?.value;
  const choiceUuid = extractChoiceUuid(choice);

  let item = null;

  if (choiceUuid?.startsWith('Compendium.')) {
    item = await resolveDocument(wizard, choiceUuid);
  } else if (value.startsWith('Compendium.')) {
    item = await resolveDocument(wizard, value);
  } else {
    item = await findChoiceItemBySlugOrName(wizard, choice, value, label);
  }

  if (!item) {
    return {
      ...choice,
      value,
      label: label ?? value,
      uuid: choiceUuid,
      slug: choice?.slug ?? choiceValue?.slug ?? null,
      img: choice?.img ?? choiceValue?.img ?? null,
      traits: choice?.traits ?? choiceValue?.traits ?? [],
      rarity: choice?.rarity ?? choiceValue?.rarity ?? 'common',
      type: choice?.type ?? choiceValue?.type ?? null,
      predicate: choice?.predicate ?? choiceValue?.predicate ?? null,
      rank: choice?.rank ?? choiceValue?.rank ?? null,
      description: choice?.description ?? choiceValue?.description ?? '',
      summary: summarizeChoiceDescription(choice?.description ?? choiceValue?.description ?? ''),
    };
  }

  return {
    ...choice,
    value: item.uuid ?? item.slug ?? value,
    label: resolveChoiceOptionLabel(label, item, value, choiceUuid),
    uuid: item.uuid,
    slug: item.slug ?? choice?.slug ?? choiceValue?.slug ?? null,
    img: item.img ?? null,
    traits: item.system?.traits?.value ?? [],
    rarity: item.system?.traits?.rarity ?? 'common',
    type: item.type ?? null,
    category: item.system?.category ?? null,
    range: normalizeRangeValue(item.system?.range ?? null),
    isRanged: isRangedWeaponItem(item),
    predicate: choice?.predicate ?? choiceValue?.predicate ?? null,
    rank: choice?.rank ?? choiceValue?.rank ?? null,
    description: item.system?.description?.value ?? choice?.description ?? choiceValue?.description ?? '',
    summary: summarizeChoiceDescription(item.system?.description?.value ?? choice?.description ?? choiceValue?.description ?? ''),
    level: Number(item.system?.level?.value ?? choice?.level ?? choiceValue?.level ?? 0) || 0,
    curriculum: parseCurriculum(item.system?.description?.value ?? '') ?? choice?.curriculum ?? choiceValue?.curriculum ?? null,
  };
}

function resolveChoiceOptionLabel(label, item, value, choiceUuid) {
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  if (normalizedLabel && !looksLikeUuid(normalizedLabel) && normalizedLabel !== value && normalizedLabel !== choiceUuid) {
    return normalizedLabel;
  }
  return item?.name ?? normalizedLabel ?? value;
}

export function extractChoiceValue(choice) {
  if (!choice) return '';
  const rawValue = choice.value;
  if (typeof rawValue === 'string') return rawValue;
  if (rawValue && typeof rawValue === 'object') {
    return rawValue.uuid
      ?? rawValue.value
      ?? rawValue.slug
      ?? choice.uuid
      ?? choice.slug
      ?? (typeof choice.label === 'string' ? choice.label : '')
      ?? (typeof choice.name === 'string' ? choice.name : '')
      ?? (typeof rawValue.label === 'string' ? rawValue.label : '')
      ?? (typeof rawValue.name === 'string' ? rawValue.name : '')
      ?? ''
  }
  if (typeof choice.uuid === 'string' && choice.uuid.length > 0) return choice.uuid;
  if (typeof choice.slug === 'string' && choice.slug.length > 0) return choice.slug;
  if (typeof choice.value === 'string') return choice.value;
  return String(rawValue ?? '');
}

export function extractChoiceLabel(choice) {
  if (!choice) return '';
  const rawValue = choice.value;
  return choice.label
    ?? rawValue?.label
    ?? rawValue?.name
    ?? choice.name
    ?? choice.slug
    ?? rawValue?.slug
    ?? '';
}

export function extractChoiceUuid(choice) {
  if (!choice) return null;
  if (typeof choice.uuid === 'string' && choice.uuid.length > 0) return choice.uuid;
  const rawValue = choice.value;
  if (rawValue && typeof rawValue === 'object' && typeof rawValue.uuid === 'string' && rawValue.uuid.length > 0) {
    return rawValue.uuid;
  }
  return null;
}

export function findMatchingChoiceOption(options, selectedValue) {
  if (typeof selectedValue !== 'string' || selectedValue.length === 0) return null;

  const normalizedSelected = normalizeChoiceIdentity(selectedValue);
  const normalizedSelectedSkill = normalizeSkillIdentity(selectedValue);
  if (!normalizedSelected) return null;

  return (options ?? []).find((option) => {
    const candidates = new Set([
      extractChoiceValue(option),
      extractChoiceLabel(option),
      extractChoiceUuid(option),
      option?.slug,
      option?.value?.slug,
      option?.value?.uuid,
      option?.value?.value,
      option?.value?.name,
      option?.name,
    ].filter((entry) => typeof entry === 'string' && entry.length > 0));

    return [...candidates].some((candidate) =>
      normalizeChoiceIdentity(candidate) === normalizedSelected
      || (normalizedSelectedSkill && normalizeSkillIdentity(candidate) === normalizedSelectedSkill));
  }) ?? null;
}

function normalizeChoiceIdentity(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function summarizeChoiceDescription(description) {
  if (typeof description !== 'string' || description.length === 0) return '';
  return description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function findChoiceItemBySlugOrName(wizard, choice, value, _label) {
  const exactSlug = choice.slug ?? value;
  const normalizedValue = normalizeChoiceLookupValue(value);

  for (const packKey of [...getCompendiumKeysForCategory('feats'), ...getCompendiumKeysForCategory('classFeatures')]) {
    const entries = await wizard._loadCompendium(packKey);
    const match = entries.find((entry) => {
      const entrySlug = normalizeChoiceLookupValue(entry.slug ?? '');
      return entrySlug === exactSlug
        || entrySlug === normalizedValue;
    });
    if (match) return await resolveDocument(wizard, match.uuid);
  }

  return null;
}

function normalizeChoiceLookupValue(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadChoiceSetCandidates(wizard, choiceConfig) {
  if (choiceConfig?.ownedItems) {
    return loadOwnedChoiceSetCandidates(wizard, choiceConfig);
  }

  const itemType = typeof choiceConfig.itemType === 'string' ? choiceConfig.itemType.toLowerCase() : null;
  const packKeys = getChoiceSetPackKeys(itemType, choiceConfig.filter ?? []);
  const lists = [];

  for (const key of packKeys) {
    if (key === 'pf2e.deities') {
      const deities = await wizard._loadDeities();
      lists.push(deities.map((item) => ({
        ...item,
        type: 'deity',
        category: 'deity',
        traits: item.font ?? [],
        otherTags: [],
        level: 0,
        slug: item.slug ?? null,
      })));
      continue;
    }

    lists.push(await wizard._loadCompendium(key));
  }

  return lists.flat();
}

function loadOwnedChoiceSetCandidates(wizard, choiceConfig) {
  const allowedTypes = new Set((choiceConfig?.types ?? []).map((type) => String(type).toLowerCase()));
  const ownedItems = wizard.actor?.items?.contents
    ?? (Array.isArray(wizard.actor?.items) ? wizard.actor.items : Array.from(wizard.actor?.items ?? []));

  return ownedItems
    .filter((item) => allowedTypes.size === 0 || allowedTypes.has(String(item.type ?? '').toLowerCase()))
    .map((item) => normalizeChoiceCandidate(item));
}

function getChoiceSetPackKeys(itemType, filters) {
  const normalizedType = itemType?.replace(/[^a-z]/g, '') ?? null;
  const keys = new Set();

  if (normalizedType === 'classfeature') addCategoryKeys(keys, 'classFeatures');
  if (normalizedType === 'feat') addCategoryKeys(keys, 'feats');
  if (normalizedType === 'spell') addCategoryKeys(keys, 'spells');
  if (normalizedType === 'action') addCategoryKeys(keys, 'actions');
  if (normalizedType === 'weapon' || normalizedType === 'armor' || normalizedType === 'equipment') addCategoryKeys(keys, 'equipment');
  if (normalizedType === 'ancestry') addCategoryKeys(keys, 'ancestries');
  if (normalizedType === 'heritage') addCategoryKeys(keys, 'heritages');
  if (normalizedType === 'deity') addCategoryKeys(keys, 'deities');

  const flattenedFilters = JSON.stringify(filters ?? []);
  if (flattenedFilters.includes('item:type:feat')) addCategoryKeys(keys, 'feats');
  if (flattenedFilters.includes('item:type:deity') || flattenedFilters.includes('item:category:deity')) addCategoryKeys(keys, 'deities');
  if (flattenedFilters.includes('item:type:spell')) addCategoryKeys(keys, 'spells');
  if (flattenedFilters.includes('item:type:action')) addCategoryKeys(keys, 'actions');
  if (flattenedFilters.includes('item:type:weapon') || flattenedFilters.includes('item:type:armor')) addCategoryKeys(keys, 'equipment');
  if (flattenedFilters.includes('item:type:ancestry') || flattenedFilters.includes('item:ancestry:')) addCategoryKeys(keys, 'ancestries');
  if (flattenedFilters.includes('item:type:heritage') || flattenedFilters.includes('item:ancestry:')) addCategoryKeys(keys, 'heritages');
  if (flattenedFilters.includes('item:tag:') || flattenedFilters.includes('item:trait:')) {
    addCategoryKeys(keys, 'classFeatures');
    addCategoryKeys(keys, 'feats');
  }

  if (keys.size === 0) {
    addCategoryKeys(keys, 'classFeatures');
    addCategoryKeys(keys, 'feats');
  }

  return [...keys];
}

function addCategoryKeys(target, category) {
  for (const key of getCompendiumKeysForCategory(category)) target.add(key);
}

function matchesChoiceSetFilters(item, filters) {
  if (!Array.isArray(filters) || filters.length === 0) return true;
  return filters.every((filter) => matchesChoiceSetFilter(item, filter));
}

function matchesChoiceSetFilter(item, filter) {
  if (typeof filter === 'string') return matchesChoiceSetFilterString(item, filter);
  if (Array.isArray(filter)) {
    const tupleFilter = normalizeChoiceSetTupleFilter(filter);
    if (tupleFilter) return matchesChoiceSetFilterString(item, tupleFilter);
    return filter.every((entry) => matchesChoiceSetFilter(item, entry));
  }
  if (!filter || typeof filter !== 'object') return true;
  if (Array.isArray(filter.or)) return filter.or.some((entry) => matchesChoiceSetFilter(item, entry));
  if (Array.isArray(filter.and)) return filter.and.every((entry) => matchesChoiceSetFilter(item, entry));
  if (Array.isArray(filter.xor)) return filter.xor.filter((entry) => matchesChoiceSetFilter(item, entry)).length === 1;
  if ('not' in filter) return !matchesChoiceSetFilter(item, filter.not);
  if (Array.isArray(filter.nor)) return filter.nor.every((entry) => !matchesChoiceSetFilter(item, entry));
  for (const operator of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte']) {
    if (Array.isArray(filter[operator])) return compareChoiceSetFilterOperands(item, operator, filter[operator]);
  }
  return true;
}

function normalizeChoiceSetTupleFilter(filter) {
  if (!Array.isArray(filter) || filter.length !== 2) return null;

  const [path, value] = filter;
  if (typeof path !== 'string' || Array.isArray(value) || (value && typeof value === 'object')) return null;

  const normalizedPath = path.trim().toLowerCase();
  if (!normalizedPath.startsWith('item:')) return null;
  if (!CHOICE_SET_TUPLE_FILTER_PATHS.has(normalizedPath)) return null;

  return `${normalizedPath}:${String(value)}`;
}

const CHOICE_SET_TUPLE_FILTER_PATHS = new Set([
  'item:damage:type',
  'item:tag',
  'item:trait',
  'item:type',
  'item:level',
  'item:slug',
  'item:category',
  'item:rarity',
  'item:ancestry',
]);

function compareChoiceSetFilterOperands(item, operator, operands) {
  if (!Array.isArray(operands) || operands.length !== 2) return true;

  const left = resolveChoiceSetFilterOperand(item, operands[0]);
  const right = resolveChoiceSetFilterOperand(item, operands[1]);

  if (left == null || right == null) return true;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const useNumericCompare = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

  const leftValue = useNumericCompare ? leftNumber : String(left).toLowerCase();
  const rightValue = useNumericCompare ? rightNumber : String(right).toLowerCase();

  switch (operator) {
    case 'eq': return leftValue === rightValue;
    case 'ne': return leftValue !== rightValue;
    case 'gt': return leftValue > rightValue;
    case 'gte': return leftValue >= rightValue;
    case 'lt': return leftValue < rightValue;
    case 'lte': return leftValue <= rightValue;
    default: return true;
  }
}

function resolveChoiceSetFilterOperand(item, operand) {
  if (typeof operand !== 'string') return operand;
  if (!operand.startsWith('item:')) return operand;

  const parts = operand.split(':');
  const [, field, ...rest] = parts;

  if (field === 'damage' && rest[0] === 'type') return item.damageTypes ?? [];
  if (parts.length < 3 && field !== 'level') {
    switch (field) {
      case 'melee': return !isRangedWeapon(item);
      case 'ranged': return isRangedWeapon(item);
      case 'thrown-melee': return isThrownMeleeWeapon(item);
      case 'magical': return !!item.isMagical || (item.traits ?? []).includes('magical');
      default: return operand;
    }
  }

  switch (field) {
    case 'tag':
      return (item.otherTags ?? []).map((tag) => String(tag).toLowerCase());
    case 'trait':
      return (item.traits ?? []).map((trait) => String(trait).toLowerCase());
    case 'type':
      return String(item.type ?? '').toLowerCase();
    case 'level':
      return Number(item.level ?? 0);
    case 'slug':
      return String(item.slug ?? '').toLowerCase();
    case 'category':
      return String(item.category ?? '').toLowerCase();
    case 'rarity':
      return String(item.rarity ?? 'common').toLowerCase();
    case 'ancestry':
      return String(item.ancestrySlug ?? '').toLowerCase();
    default:
      return operand;
  }
}

function matchesChoiceSetFilterString(item, filter) {
  const parts = filter.split(':');
  if (parts[0] !== 'item' || parts.length < 2) return true;

  const [, field, ...rest] = parts;
  if (field === 'melee') return !isRangedWeapon(item);
  if (field === 'ranged') return isRangedWeapon(item);
  if (field === 'thrown-melee') return isThrownMeleeWeapon(item);
  if (field === 'magical') return !!item.isMagical || (item.traits ?? []).includes('magical');
  if (field === 'damage' && rest[0] === 'type') {
    const value = rest.slice(1).join(':');
    return (item.damageTypes ?? []).includes(value);
  }

  if (parts.length < 3) return true;
  const value = rest.join(':');

  switch (field) {
    case 'tag':
      return (item.otherTags ?? []).some((tag) => {
        const normalizedTag = String(tag ?? '').toLowerCase();
        const normalizedValue = String(value ?? '').toLowerCase();
        return normalizedTag === normalizedValue || normalizedTag.startsWith(`${normalizedValue}-`);
      });
    case 'trait':
      return (item.traits ?? []).includes(value);
    case 'type':
      return String(item.type ?? '').toLowerCase() === value.toLowerCase();
    case 'level':
      return Number(item.level ?? 0) === Number(value);
    case 'slug':
      return item.slug === value;
    case 'category':
      return String(item.category ?? '').toLowerCase() === value.toLowerCase();
    case 'rarity':
      return String(item.rarity ?? 'common').toLowerCase() === value.toLowerCase();
    case 'ancestry':
      return String(item.ancestrySlug ?? '').toLowerCase() === value.toLowerCase();
    default:
      return true;
  }
}

function normalizeChoiceCandidate(item) {
  const damageTypeEntries = [];
  const rawSystem = item?.system ?? {};
  const rawDamage = rawSystem.damage;
  if (typeof rawDamage?.damageType === 'string') damageTypeEntries.push(rawDamage.damageType);
  if (Array.isArray(rawDamage?.instances)) {
    for (const instance of rawDamage.instances) {
      if (typeof instance?.type === 'string') damageTypeEntries.push(instance.type);
      if (typeof instance?.damageType === 'string') damageTypeEntries.push(instance.damageType);
    }
  }

  return {
    uuid: item.uuid,
    name: item.name,
    img: item.img ?? null,
    type: item.type,
    slug: item.slug ?? null,
    description: rawSystem?.description?.value?.substring?.(0, 150) ?? '',
    traits: rawSystem?.traits?.value ?? [],
    otherTags: rawSystem?.traits?.otherTags ?? [],
    traditions: rawSystem?.traits?.traditions ?? rawSystem?.traditions?.value ?? [],
    rarity: rawSystem?.traits?.rarity ?? 'common',
    level: rawSystem?.level?.value ?? 0,
    category: typeof rawSystem?.category === 'string' ? rawSystem.category : (rawSystem?.category?.value ?? null),
    ancestrySlug: rawSystem?.ancestry?.slug ?? null,
    usage: rawSystem?.usage?.value ?? null,
    range: normalizeRangeValue(rawSystem?.range ?? null),
    isRanged: isRangedWeaponData(rawSystem),
    damageTypes: [...new Set(damageTypeEntries.filter((type) => typeof type === 'string' && type.length > 0))],
    isMagical: !!rawSystem?.traits?.value?.includes?.('magical'),
  };
}

function hasMeaningfulRange(range) {
  return normalizeRangeValue(range) !== null;
}

function normalizeRangeValue(range) {
  if (!range) return null;
  if (typeof range === 'number' && range > 0) return String(range);
  if (typeof range === 'string') return range.trim() || null;
  if (typeof range?.value === 'number' && range.value > 0) return String(range.value);
  if (typeof range?.value === 'string' && range.value.trim().length > 0) return range.value.trim();
  if (typeof range?.increment === 'number' && range.increment > 0) return String(range.increment);
  if (typeof range?.increment === 'string' && range.increment.trim().length > 0) return range.increment.trim();
  if (typeof range?.max === 'number' && range.max > 0) return String(range.max);
  if (typeof range?.max === 'string' && range.max.trim().length > 0) return range.max.trim();
  return null;
}

function hasRangedTrait(item) {
  const traits = item?.traits ?? [];
  return traits.some((trait) => /^range-increment-\d+/i.test(String(trait)))
    || traits.some((trait) => String(trait).toLowerCase() === 'ranged');
}

function hasThrownMeleeTrait(item) {
  const traits = item?.traits ?? [];
  return traits.some((trait) => /^thrown(?:-\d+)?$/i.test(String(trait)));
}

function isRangedWeapon(item) {
  if (typeof item?.isRanged === 'boolean') return item.isRanged;
  return (hasMeaningfulRange(item?.range) || hasRangedTrait(item)) && !hasThrownMeleeTrait(item);
}

function isThrownMeleeWeapon(item) {
  return hasThrownMeleeTrait(item);
}

function isRangedWeaponData(system) {
  const item = {
    range: system?.range ?? null,
    traits: system?.traits?.value ?? [],
  };
  return isRangedWeapon(item);
}

function isRangedWeaponItem(item) {
  return isRangedWeapon({
    range: item?.system?.range ?? null,
    traits: item?.system?.traits?.value ?? [],
  });
}

export function getSelectedHandlerChoiceSourceItems(wizard) {
  const items = [];
  const add = (entry) => {
    if (!entry?.uuid || !entry?.name) return;
    items.push({ uuid: entry.uuid, label: entry.name });
  };
  const addBucket = (bucket) => {
    add(bucket?.deity);
    add(bucket?.implement);
    add(bucket?.innovationItem);
    add(bucket?.innovationModification);
    add(bucket?.secondElement);
    add(bucket?.subconsciousMind);
    add(bucket?.thesis);
    for (const entry of (bucket?.tactics ?? [])) add(entry);
    for (const entry of (bucket?.ikons ?? [])) add(entry);
    for (const entry of (bucket?.kineticImpulses ?? [])) add(entry);
    for (const entry of (bucket?.apparitions ?? [])) add(entry);
  };

  addBucket(getClassSelectionData(wizard.data, 'class'));
  addBucket(getClassSelectionData(wizard.data, 'dualClass'));

  return items;
}
