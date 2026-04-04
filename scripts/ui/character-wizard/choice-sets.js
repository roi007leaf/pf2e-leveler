import { SUBCLASS_TAGS } from '../../constants.js';

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
    options: cs.options.map((opt) => {
      const value = extractChoiceValue(opt);
      const label = extractChoiceLabel(opt) || value;
      const uuid = extractChoiceUuid(opt);
      return {
        ...opt,
        value,
        label,
        uuid,
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
  ];

  const resolveSelectedChoiceItem = async (choiceSet, currentChoices) => {
    const selectedValue = currentChoices?.[choiceSet.flag];
    if (typeof selectedValue !== 'string' || selectedValue === '[object Object]') return null;

    const option = choiceSet.options?.find((entry) => extractChoiceValue(entry) === selectedValue);
    const uuid = option?.uuid ?? (selectedValue.startsWith('Compendium.') ? selectedValue : null);
    if (!uuid) return null;
    return fromUuid(uuid).catch(() => null);
  };

  const scanItem = async (item, sourceName, { skipDirectSection = false, choiceSource = null } = {}) => {
    if (!item?.uuid || scannedItems.has(item.uuid)) return;
    scannedItems.add(item.uuid);

    const parsedChoiceSets = await parseChoiceSets(wizard, item.system?.rules ?? []);
    const currentChoices = choiceSource?.choices ?? wizard.data.grantedFeatChoices?.[item.uuid] ?? {};

    if (!skipDirectSection && parsedChoiceSets.length > 0 && !seenSections.has(item.uuid)) {
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
      const granted = await fromUuid(rule.uuid).catch(() => null);
      if (!granted) continue;
      await scanItem(granted, `${sourceName} -> ${granted.name}`);
    }

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature?.uuid || feature.level > 1) continue;
        const featureItem = await fromUuid(feature.uuid).catch(() => null);
        if (!featureItem) continue;
        await scanItem(featureItem, `${sourceName} -> ${feature.name}`);
      }
    }
  };

  for (const entry of topItems) {
    if (!entry.uuid || !entry.label) continue;
    const item = await fromUuid(entry.uuid).catch(() => null);
    if (!item) continue;
    await scanItem(item, entry.label, entry);
  }

  return sections;
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
      const granted = await fromUuid(rule.uuid).catch(() => null);
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
  ];

  for (const { uuid, label } of topItems) {
    if (!uuid) continue;
    const item = await fromUuid(uuid).catch(() => null);
    if (!item) continue;
    const optionSource = uuid === wizard.data.ancestryFeat?.uuid ? wizard.data.ancestryFeat
      : uuid === wizard.data.classFeat?.uuid ? wizard.data.classFeat
        : null;
    await scanItem(item, label, optionSource);

    if (item.system?.items) {
      for (const feature of Object.values(item.system.items)) {
        if (!feature.uuid || feature.level > 1) continue;
        const featItem = await fromUuid(feature.uuid).catch(() => null);
        if (!featItem) continue;
        await scanItem(featItem, `${label} -> ${feature.name}`);
      }
    }
  }

  return choices;
}

export async function parseChoiceSets(wizard, rules) {
  const sets = [];
  for (const rule of rules) {
    if (rule.key !== 'ChoiceSet') continue;
    if (!rule.flag) continue;
    const options = await resolveChoiceSetOptions(wizard, rule);
    if (options.length > 0) {
      const prompt = rule.prompt ? (game.i18n.has(rule.prompt) ? game.i18n.localize(rule.prompt) : rule.prompt) : rule.flag;
      sets.push({ flag: rule.flag, prompt, options });
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
    .map((item) => ({
      value: slugsAsValues ? (item.slug ?? item.uuid ?? item.name) : (item.uuid ?? item.slug ?? item.name),
      label: item.name,
      uuid: item.uuid ?? null,
      img: item.img ?? null,
      traits: item.traits ?? [],
      rarity: item.rarity ?? 'common',
      type: item.type ?? null,
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

function isCommonAncestryChoiceSet(rule) {
  if (!isAncestryChoiceSet(rule)) return false;

  const promptKey = String(rule.prompt ?? '');
  if (promptKey.includes('AdoptedAncestry')) return true;

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
    item = await fromUuid(choiceUuid).catch(() => null);
  } else if (value.startsWith('Compendium.')) {
    item = await fromUuid(value).catch(() => null);
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
      ?? rawValue.name
      ?? rawValue.label
      ?? choice.slug
      ?? choice.name
      ?? choice.label
      ?? '';
  }
  return choice.slug ?? choice.uuid ?? choice.name ?? choice.label ?? String(rawValue ?? '');
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

async function findChoiceItemBySlugOrName(wizard, choice, value, label) {
  const exactSlug = choice.slug ?? value;
  const normalizedValue = normalizeChoiceLookupValue(value);
  const normalizedLabel = normalizeChoiceLookupValue(label);

  for (const packKey of ['pf2e.feats-srd', 'pf2e.classfeatures']) {
    const entries = await wizard._loadCompendium(packKey);
    const match = entries.find((entry) => {
      const entrySlug = normalizeChoiceLookupValue(entry.slug ?? '');
      const entryName = normalizeChoiceLookupValue(entry.name ?? '');
      return entrySlug === exactSlug
        || entrySlug === normalizedValue
        || entryName === normalizedValue
        || entryName === normalizedLabel;
    });
    if (match) return await fromUuid(match.uuid).catch(() => null);
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
        slug: item.slug ?? item.name.toLowerCase().replace(/[:\s]+/g, '-').replace(/^-|-$/g, ''),
      })));
      continue;
    }

    lists.push(await wizard._loadCompendium(key));
  }

  return lists.flat();
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
  if (parts[0] !== 'item' || parts.length < 3) return true;

  const [, field, ...rest] = parts;
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
