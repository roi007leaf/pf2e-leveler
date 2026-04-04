import { SUBCLASS_TAGS } from '../../constants.js';

async function resolveDocument(wizard, uuid) {
  if (!uuid) return null;
  if (typeof wizard?._getCachedDocument === 'function') return wizard._getCachedDocument(uuid);
  return fromUuid(uuid).catch(() => null);
}

export async function buildSubclassChoicesContext(wizard) {
  return {
    subclassName: wizard.data.subclass?.name,
    choiceSets: await hydrateChoiceSets(wizard, wizard.data.subclass?.choiceSets ?? [], wizard.data.subclass?.choices ?? {}),
  };
}

export async function buildFeatChoicesContext(wizard) {
  const sections = [];
  if (wizard.data.ancestryFeat?.choiceSets?.length) {
    sections.push({
      slot: 'ancestry',
      featName: wizard.data.ancestryFeat.name,
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.ancestryFeat.choiceSets, wizard.data.ancestryFeat.choices ?? {}),
    });
  }
  if (wizard.data.classFeat?.choiceSets?.length) {
    sections.push({
      slot: 'class',
      featName: wizard.data.classFeat.name,
      choiceSets: await hydrateChoiceSets(wizard, wizard.data.classFeat.choiceSets, wizard.data.classFeat.choices ?? {}),
    });
  }
  for (const section of (wizard.data.grantedFeatSections ?? [])) {
    sections.push({
      slot: section.slot,
      featName: section.featName,
      sourceName: section.sourceName ?? null,
      choiceSets: await hydrateChoiceSets(wizard, section.choiceSets ?? [], wizard.data.grantedFeatChoices?.[section.slot] ?? {}),
    });
  }
  return { featChoiceSections: sections };
}

export async function hydrateChoiceSets(wizard, choiceSets, currentChoices) {
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
    isWeaponChoice: cs.options.length > 0 && cs.options.every((opt) => String(opt?.type ?? '').toLowerCase() === 'weapon'),
    options: cs.options.map((opt) => {
      const value = extractChoiceValue(opt);
      const label = extractChoiceLabel(opt) || value;
      const uuid = extractChoiceUuid(opt);
      return {
        ...opt,
        value,
        label,
        uuid,
        category: opt?.category ?? null,
        range: opt?.range ?? null,
        isRanged: !!opt?.isRanged,
        selected: currentChoices[cs.flag] === value,
      };
    }),
    hasSelection: !!currentChoices[cs.flag] && currentChoices[cs.flag] !== '[object Object]',
  }));
}

export async function getSelectedSubclassChoiceLabels(wizard) {
  return getSelectedChoiceLabels(wizard, wizard.data.subclass);
}

export async function getSelectedFeatChoiceLabels(wizard, slot) {
  const grantedSection = (wizard.data.grantedFeatSections ?? []).find((section) => section.slot === slot);
  const feat = slot === 'ancestry' ? wizard.data.ancestryFeat
    : slot === 'class' ? wizard.data.classFeat
      : grantedSection
        ? { choiceSets: grantedSection.choiceSets ?? [], choices: wizard.data.grantedFeatChoices?.[slot] ?? {} }
        : null;
  return getSelectedChoiceLabels(wizard, feat);
}

export async function refreshGrantedFeatChoiceSections(wizard) {
  const sections = [];
  const seenSections = new Set();
  const scannedItems = new Set();

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name, skipDirectSection: true },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name, skipDirectSection: true },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name, skipDirectSection: true },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name, skipDirectSection: true },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name, skipDirectSection: true, choiceSource: wizard.data.ancestryFeat },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name, skipDirectSection: true, choiceSource: wizard.data.classFeat },
    ...getSelectedHandlerChoiceSourceItems(wizard),
  ];

  const resolveSelectedChoiceItem = async (choiceSet, currentChoices) => {
    const selectedValue = currentChoices?.[choiceSet.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') return null;

    const option = choiceSet.options?.find((entry) => extractChoiceValue(entry) === selectedValue);
    const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
    if (!uuid) return null;
    return resolveDocument(wizard, uuid);
  };

  const scanItem = async (item, sourceName, { skipDirectSection = false, choiceSource = null } = {}) => {
    if (!item?.uuid || scannedItems.has(item.uuid)) return;
    scannedItems.add(item.uuid);

    const currentChoices = choiceSource?.choices ?? wizard.data.grantedFeatChoices?.[item.uuid] ?? {};
    const parsedChoiceSets = await parseChoiceSets(wizard, item.system?.rules ?? [], currentChoices);
    const isSubclassSelector = isSubclassSelectionItem(wizard, item, parsedChoiceSets);
    const isHandlerManagedSelector = isHandlerManagedSelectionItem(wizard, item);

    if (!skipDirectSection && !isSubclassSelector && !isHandlerManagedSelector && parsedChoiceSets.length > 0 && !seenSections.has(item.uuid)) {
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
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      await scanItem(granted, `${sourceName} -> ${granted.name}`);
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

  return sections;
}

function isSubclassSelectionItem(wizard, item, parsedChoiceSets) {
  if (!item || !Array.isArray(parsedChoiceSets) || parsedChoiceSets.length === 0) return false;
  const subclassTag = SUBCLASS_TAGS[wizard.data.class?.slug];
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
  const filterText = String(JSON.stringify(rule?.choices?.filter ?? []) ?? '').toLowerCase();

  if (managedStepIds.has('deity')) {
    if (rule.flag === 'deity') return true;
    if (prompt.includes('deity')) return true;
    if (filterText.includes('item:type:deity') || filterText.includes('item:category:deity')) return true;
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

export async function getSelectedChoiceLabels(wizard, choiceContainer) {
  const choiceSets = choiceContainer?.choiceSets ?? [];
  const currentChoices = choiceContainer?.choices ?? {};
  const labels = [];

  for (const cs of choiceSets) {
    const selectedValue = currentChoices[cs.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') continue;

    const match = cs.options?.find((opt) => extractChoiceValue(opt) === selectedValue);
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

  const addChoice = (source, prompt) => {
    const text = game.i18n.has(prompt) ? game.i18n.localize(prompt) : prompt.replace(/^PF2E\./, '').replace(/([A-Z])/g, ' $1').trim();
    const key = `${source}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    choices.push({ source, prompt: text });
  };

  const subclassTag = SUBCLASS_TAGS[wizard.data.class?.slug];
  const hasSubclass = !!wizard.data.subclass;

  const scanItem = async (item, sourceLabel, optionSource = null) => {
    const rules = item.system?.rules ?? [];
    for (const rule of rules) {
      if (rule.key !== 'ChoiceSet' || !rule.prompt) continue;
      if (hasSubclass && rule.choices?.filter?.some?.((f) => typeof f === 'string' && f.includes(subclassTag))) continue;
      if (hasSubclass && rule.flag && subclassTag?.includes(rule.flag)) continue;
      if (optionSource?.choices?.[rule.flag]) continue;
      if (optionSource?.uuid && wizard.data.grantedFeatChoices?.[optionSource.uuid]?.[rule.flag]) continue;
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
      const granted = await resolveDocument(wizard, rule.uuid);
      if (!granted) continue;
      for (const grantedRule of (granted.system?.rules ?? [])) {
        if (grantedRule.key === 'ChoiceSet' && grantedRule.prompt) {
          addChoice(`${sourceLabel} -> ${granted.name}`, grantedRule.prompt);
        }
      }
    }
  };

  const topItems = [
    { uuid: wizard.data.ancestry?.uuid, label: wizard.data.ancestry?.name },
    { uuid: wizard.data.heritage?.uuid, label: wizard.data.heritage?.name },
    { uuid: wizard.data.background?.uuid, label: wizard.data.background?.name },
    { uuid: wizard.data.class?.uuid, label: wizard.data.class?.name },
    { uuid: wizard.data.ancestryFeat?.uuid, label: wizard.data.ancestryFeat?.name },
    { uuid: wizard.data.classFeat?.uuid, label: wizard.data.classFeat?.name },
    ...getSelectedHandlerChoiceSourceItems(wizard).map((entry) => ({ uuid: entry.uuid, label: entry.label, optionSource: entry })),
  ];

  for (const { uuid, label, optionSource } of topItems) {
    if (!uuid) continue;
    const item = await resolveDocument(wizard, uuid);
    if (!item) continue;
    const sourceChoices = optionSource ?? (uuid === wizard.data.ancestryFeat?.uuid ? wizard.data.ancestryFeat
      : uuid === wizard.data.classFeat?.uuid ? wizard.data.classFeat
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
  }

  return choices;
}

export async function parseChoiceSets(wizard, rules, currentChoices = {}) {
  const sets = [];
  for (const [index, rule] of (rules ?? []).entries()) {
    if (rule.key !== 'ChoiceSet') continue;
    const flag = getChoiceSetFlag(rule, index);
    if (!flag) continue;
    const normalizedRule = { ...rule, flag };
    if (!matchesChoiceSetPredicate(normalizedRule.predicate, buildChoiceSetRollOptions(rules, currentChoices))) continue;
    const options = await resolveChoiceSetOptions(wizard, normalizedRule);
    if (options.length > 0) {
      const prompt = normalizedRule.prompt ? (game.i18n.has(normalizedRule.prompt) ? game.i18n.localize(normalizedRule.prompt) : normalizedRule.prompt) : normalizedRule.flag;
      sets.push({ flag: normalizedRule.flag, prompt, options });
    }
  }
  return sets;
}

async function resolveChoiceSetOptions(wizard, rule) {
  if (isSkillChoiceSet(rule)) {
    return resolveConfigChoiceOptions('skills');
  }

  if (typeof rule.choices === 'string') {
    return resolveConfigChoiceOptions(rule.choices);
  }

  if (Array.isArray(rule.choices)) {
    return Promise.all(rule.choices
      .filter((c) => extractChoiceValue(c) || extractChoiceLabel(c))
      .map((c) => enrichChoiceOption(wizard, c)));
  }

  if (!rule.choices || typeof rule.choices !== 'object') return [];
  if (typeof rule.choices.config === 'string') {
    return resolveConfigChoiceOptions(rule.choices.config);
  }

  const candidates = await loadChoiceSetCandidates(wizard, rule.choices);
  const slugsAsValues = !!rule.choices.slugsAsValues;
  const promptImpliesCommonAncestry = isCommonAncestryChoiceSet(rule)
    && !String(JSON.stringify(rule.choices.filter ?? [])).includes('item:rarity:')
  return candidates
    .filter((item) => matchesChoiceSetFilters(item, rule.choices.filter ?? []))
    .filter((item) => !promptImpliesCommonAncestry || String(item.rarity ?? 'common').toLowerCase() === 'common')
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

function getChoiceSetFlag(rule, index = 0) {
  if (typeof rule?.flag === 'string' && rule.flag.length > 0) return rule.flag;
  if (typeof rule?.rollOption === 'string' && rule.rollOption.length > 0) return rule.rollOption;
  return typeof index === 'number' ? `choiceSet${index + 1}` : null;
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
      value,
      label: label ?? value,
      uuid: choiceUuid,
      img: choice?.img ?? choiceValue?.img ?? null,
      traits: choice?.traits ?? choiceValue?.traits ?? [],
      rarity: choice?.rarity ?? choiceValue?.rarity ?? 'common',
      type: choice?.type ?? choiceValue?.type ?? null,
      description: choice?.description ?? choiceValue?.description ?? '',
      summary: summarizeChoiceDescription(choice?.description ?? choiceValue?.description ?? ''),
    };
  }

    return {
      value,
      label: label ?? item.name ?? value,
      uuid: item.uuid,
      img: item.img ?? null,
    traits: item.system?.traits?.value ?? [],
      rarity: item.system?.traits?.rarity ?? 'common',
      type: item.type ?? null,
      category: item.system?.category ?? null,
      range: normalizeRangeValue(item.system?.range ?? null),
      isRanged: isRangedWeaponItem(item),
      description: item.system?.description?.value ?? choice?.description ?? choiceValue?.description ?? '',
      summary: summarizeChoiceDescription(item.system?.description?.value ?? choice?.description ?? choiceValue?.description ?? ''),
    };
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

  for (const packKey of ['pf2e.feats-srd', 'pf2e.classfeatures']) {
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

  if (normalizedType === 'classfeature') keys.add('pf2e.classfeatures');
  if (normalizedType === 'feat') keys.add('pf2e.feats-srd');
  if (normalizedType === 'spell') keys.add('pf2e.spells-srd');
  if (normalizedType === 'action') keys.add('pf2e.actionspf2e');
  if (normalizedType === 'weapon' || normalizedType === 'armor' || normalizedType === 'equipment') keys.add('pf2e.equipment-srd');
  if (normalizedType === 'ancestry') keys.add('pf2e.ancestries');
  if (normalizedType === 'deity') keys.add('pf2e.deities');

  const flattenedFilters = JSON.stringify(filters ?? []);
  if (flattenedFilters.includes('item:type:feat')) keys.add('pf2e.feats-srd');
  if (flattenedFilters.includes('item:type:deity') || flattenedFilters.includes('item:category:deity')) keys.add('pf2e.deities');
  if (flattenedFilters.includes('item:type:spell')) keys.add('pf2e.spells-srd');
  if (flattenedFilters.includes('item:type:action')) keys.add('pf2e.actionspf2e');
  if (flattenedFilters.includes('item:type:weapon') || flattenedFilters.includes('item:type:armor')) keys.add('pf2e.equipment-srd');
  if (flattenedFilters.includes('item:type:ancestry')) keys.add('pf2e.ancestries');
  if (flattenedFilters.includes('item:tag:') || flattenedFilters.includes('item:trait:')) {
    keys.add('pf2e.classfeatures');
    keys.add('pf2e.feats-srd');
  }

  if (keys.size === 0) {
    keys.add('pf2e.classfeatures');
    keys.add('pf2e.feats-srd');
  }

  return [...keys];
}

function matchesChoiceSetFilters(item, filters) {
  if (!Array.isArray(filters) || filters.length === 0) return true;
  return filters.every((filter) => matchesChoiceSetFilter(item, filter));
}

function matchesChoiceSetFilter(item, filter) {
  if (typeof filter === 'string') return matchesChoiceSetFilterString(item, filter);
  if (Array.isArray(filter)) return filter.every((entry) => matchesChoiceSetFilter(item, entry));
  if (!filter || typeof filter !== 'object') return true;
  if (Array.isArray(filter.or)) return filter.or.some((entry) => matchesChoiceSetFilter(item, entry));
  if (Array.isArray(filter.and)) return filter.and.every((entry) => matchesChoiceSetFilter(item, entry));
  if ('not' in filter) return !matchesChoiceSetFilter(item, filter.not);
  if (Array.isArray(filter.nor)) return filter.nor.every((entry) => !matchesChoiceSetFilter(item, entry));
  return true;
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
      return (item.otherTags ?? []).includes(value);
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
    category: rawSystem?.category ?? null,
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

  add(wizard.data.implement);
  add(wizard.data.innovationItem);
  add(wizard.data.innovationModification);
  add(wizard.data.secondElement);
  add(wizard.data.subconsciousMind);
  add(wizard.data.thesis);
  for (const entry of (wizard.data.tactics ?? [])) add(entry);
  for (const entry of (wizard.data.ikons ?? [])) add(entry);
  for (const entry of (wizard.data.kineticImpulses ?? [])) add(entry);
  for (const entry of (wizard.data.apparitions ?? [])) add(entry);

  return items;
}
