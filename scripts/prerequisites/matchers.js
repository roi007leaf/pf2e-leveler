export function matchSkill(parsed, buildState) {
  const currentRank = buildState.skills?.[parsed.skill] ?? 0;
  return {
    met: currentRank >= parsed.minRank,
    text: parsed.text,
  };
}

export function matchAnySkill(parsed, buildState) {
  const skills = Object.values(buildState.skills ?? {});
  return {
    met: skills.some((rank) => Number(rank ?? 0) >= parsed.minRank),
    text: parsed.text,
  };
}

const RECALL_KNOWLEDGE_SKILLS = new Set([
  'arcana',
  'crafting',
  'medicine',
  'nature',
  'occultism',
  'religion',
  'society',
]);

export function matchRecallKnowledgeSkill(parsed, buildState) {
  const skillMet = Object.entries(buildState.skills ?? {}).some(
    ([skill, rank]) => RECALL_KNOWLEDGE_SKILLS.has(String(skill ?? '').trim().toLowerCase()) && Number(rank ?? 0) >= parsed.minRank,
  );
  if (skillMet) {
    return { met: true, text: parsed.text };
  }

  const loreMet = Object.values(buildState.lores ?? {}).some((rank) => Number(rank ?? 0) >= parsed.minRank);
  return {
    met: loreMet,
    text: parsed.text,
  };
}

export function matchWeaponFamilyProficiency(parsed, buildState) {
  const weaponProficiencies = buildState.weaponProficiencies ?? {};
  const family = normalizeWeaponFamily(parsed.family);
  const candidates = new Set([family]);

  for (const alias of getWeaponFamilyAliases(family)) candidates.add(alias);

  const met = [...candidates].some((key) => Number(weaponProficiencies[key] ?? 0) >= parsed.minRank);
  return {
    met,
    text: parsed.text,
  };
}

export function matchLore(parsed, buildState) {
  const currentRank = buildState.lores?.[parsed.loreSlug] ?? 0;
  return {
    met: currentRank >= parsed.minRank,
    text: parsed.text,
  };
}

export function matchLanguage(parsed, buildState) {
  const knownLanguages = buildState.languages ?? new Set();
  return {
    met: parsed.languages.every((language) => knownLanguages.has(language)),
    text: parsed.text,
  };
}

export function matchAbility(parsed, buildState) {
  const currentMod = buildState.attributes?.[parsed.ability] ?? 0;
  if (parsed.isModifier) {
    return { met: currentMod >= parsed.minValue, text: parsed.text };
  }
  const currentScore = 10 + currentMod * 2;
  return { met: currentScore >= parsed.minValue, text: parsed.text };
}

export function matchLevel(parsed, buildState) {
  return {
    met: buildState.level >= parsed.minLevel,
    text: parsed.text,
  };
}

export function matchFeat(parsed, buildState) {
  const classSlugs = new Set(
    getTrackedClasses(buildState)
      .map((entry) => normalizeText(entry?.slug))
      .filter(Boolean),
  );
  const met =
    !!buildState.feats?.has(parsed.slug) ||
    !!buildState.classFeatures?.has(parsed.slug) ||
    classSlugs.has(normalizeText(parsed.slug));
  if (!met) return { met, text: parsed.text };

  const aliasSources = buildState.featAliasSources?.get?.(parsed.slug);
  if (aliasSources instanceof Map) {
    const viaEntry = [...aliasSources.entries()].find(([slug]) => slug && slug !== parsed.slug);
    if (viaEntry) {
      const viaName = viaEntry[1] || viaEntry[0];
      return { met, text: `${parsed.text} (via ${viaName})` };
    }
  }

  return { met, text: parsed.text };
}

export function matchClassFeature(parsed, buildState) {
  return {
    met: !!buildState.classFeatures?.has(parsed.slug),
    text: parsed.text,
  };
}

export function matchBackground(parsed, buildState) {
  return {
    met: buildState.backgroundSlug === parsed.slug,
    text: parsed.text,
  };
}

export function matchHeritage(parsed, buildState) {
  const aliases = buildState.heritageAliases instanceof Set
    ? buildState.heritageAliases
    : new Set(
      [buildState.heritageSlug]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase()),
    );
  return {
    met: aliases.has(String(parsed.slug ?? '').trim().toLowerCase()),
    text: parsed.text,
  };
}

export function matchAncestryFeatAccess(parsed, buildState) {
  if (parsed.multipleAncestries !== true) {
    return { met: null, text: parsed.text };
  }

  const featSlugs = buildState.feats instanceof Set ? buildState.feats : new Set(buildState.feats ?? []);
  const heritageSlug = normalizeText(buildState.heritageSlug);
  const heritageAliases = buildState.heritageAliases instanceof Set
    ? new Set([...buildState.heritageAliases].map((value) => normalizeText(value)))
    : new Set();

  return {
    met: featSlugs.has('adopted-ancestry') || heritageSlug === 'mixed-ancestry' || heritageAliases.has('mixed-ancestry'),
    text: parsed.text,
  };
}

export function matchProficiency(parsed, buildState) {
  const proficiencies = buildState.proficiencies ?? {};
  const normalizedKey = normalizeProficiencyKey(parsed.key);
  const currentRank = Object.entries(proficiencies).find(([key]) => normalizeProficiencyKey(key) === normalizedKey)?.[1] ?? 0;
  return {
    met: currentRank >= parsed.minRank,
    text: parsed.text,
  };
}

export function matchClassHp(parsed, buildState) {
  const conModifier = buildState.attributes?.con ?? 0;
  const classHps = getTrackedClasses(buildState)
    .map((entry) => entry?.hp)
    .filter((hp) => Number.isFinite(hp));

  if (classHps.length === 0) {
    return { met: null, text: parsed.text };
  }

  return {
    met: parsed.comparator === 'lte'
      ? classHps.some((classHp) => {
        const currentValue = parsed.includesConModifier ? classHp + conModifier : classHp;
        const threshold = parsed.includesConModifier ? parsed.maxHp + conModifier : parsed.maxHp;
        return currentValue <= threshold;
      })
      : null,
    text: parsed.text,
  };
}

export function matchLivingCreature(parsed, buildState) {
  const traits = buildState.ancestryTraits instanceof Set
    ? buildState.ancestryTraits
    : new Set(buildState.ancestryTraits ?? []);
  const normalizedTraits = new Set([...traits].map((trait) => normalizeText(trait)));
  return {
    met: !normalizedTraits.has('construct') && !normalizedTraits.has('undead'),
    text: parsed.text,
  };
}

export function matchDeityState(parsed, buildState) {
  if (parsed.requiredDeity) {
    const currentDeitySlug = normalizeText(buildState.deity?.slug ?? buildState.deity?.name);
    return {
      met: currentDeitySlug === normalizeText(parsed.requiredDeity),
      text: parsed.text,
    };
  }

  if (parsed.forbiddenDeity) {
    const currentDeitySlug = normalizeText(buildState.deity?.slug ?? buildState.deity?.name);
    return {
      met: currentDeitySlug !== normalizeText(parsed.forbiddenDeity),
      text: parsed.text,
    };
  }

  if (!parsed.requiresFollower) return { met: null, text: parsed.text };

  if (parsed.requiredDomain) {
    return {
      met: !!buildState.deity && !!buildState.deity.domains?.has(parsed.requiredDomain),
      text: parsed.text,
    };
  }

  return {
    met: !!buildState.deity,
    text: parsed.text,
  };
}

export function matchSpellcastingState(parsed, buildState) {
  if (parsed.focusPool === true) {
    return {
      met: !!buildState.spellcasting?.focusPool,
      text: parsed.text,
    };
  }

  if (parsed.spellSlots === true) {
    if (parsed.spellSlug) {
      return {
        met: !!buildState.spellcasting?.hasSpellSlots && !!buildState.spellcasting?.spellNames?.has(parsed.spellSlug),
        text: parsed.text,
      };
    }

    return {
      met: !!buildState.spellcasting?.hasSpellSlots,
      text: parsed.text,
    };
  }

  if (parsed.spellSlug) {
    return {
      met: !!buildState.spellcasting?.spellNames?.has(parsed.spellSlug),
      text: parsed.text,
    };
  }

  if (parsed.spellTrait) {
    return {
      met: !!buildState.spellcasting?.spellTraits?.has(parsed.spellTrait),
      text: parsed.text,
    };
  }

  if (parsed.tradition) {
    return {
      met: !!buildState.spellcasting?.traditions?.has(parsed.tradition),
      text: parsed.text,
    };
  }

  return { met: null, text: parsed.text };
}

export function matchClassIdentity(parsed, buildState) {
  const expectedSubclassType = normalizeText(parsed.subclassType);
  const traditions = buildState.spellcasting?.traditions ?? new Set();
  const trackedClasses = getTrackedClasses(buildState);

  if (expectedSubclassType && trackedClasses.length > 0 && !trackedClasses.some((entry) => normalizeText(entry?.subclassType) === expectedSubclassType)) {
    return { met: false, text: parsed.text };
  }

  if (parsed.tradition) {
    const perClassTraditionMatch = trackedClasses.some((entry) => {
      const subclassType = normalizeText(entry?.subclassType);
      const classTraditions = entry?.traditions instanceof Set ? entry.traditions : new Set();
      if (expectedSubclassType && subclassType !== expectedSubclassType) return false;
      return classTraditions.has(parsed.tradition);
    });
    return {
      met: perClassTraditionMatch || traditions.has(parsed.tradition),
      text: parsed.text,
    };
  }

  return {
    met: expectedSubclassType ? trackedClasses.some((entry) => normalizeText(entry?.subclassType) === expectedSubclassType) : null,
    text: parsed.text,
  };
}

export function matchSense(parsed, buildState) {
  const senses = buildState.senses ?? new Set();
  const required = parsed.sense;
  if (required === 'darkvision' || required === 'greater-darkvision') {
    return { met: senses.has('darkvision') || senses.has('greater-darkvision'), text: parsed.text };
  }
  if (required === 'low-light-vision') {
    return { met: senses.has('low-light-vision') || senses.has('darkvision') || senses.has('greater-darkvision'), text: parsed.text };
  }
  return { met: senses.has(required), text: parsed.text };
}

export function matchSubclassSpell(parsed, buildState) {
  const expectedType = normalizeText(parsed.subclassType);
  const trackedClasses = getTrackedClasses(buildState);
  if (!expectedType || !trackedClasses.some((entry) => normalizeText(entry?.subclassType) === expectedType)) {
    return { met: false, text: parsed.text };
  }
  return {
    met: !!buildState.spellcasting?.focusPool,
    text: parsed.text,
  };
}

export function matchDivineFont(parsed, buildState) {
  const currentFont = normalizeDivineFont(buildState.divineFont);
  return {
    met: currentFont === parsed.font,
    text: parsed.text,
  };
}

export function matchEquipmentState(parsed, buildState) {
  const equipment = buildState.equipment ?? {};

  if (parsed.shield === true) {
    return {
      met: !!equipment.hasShield,
      text: parsed.text,
    };
  }

  if (Array.isArray(parsed.armorCategories) && parsed.armorCategories.length > 0) {
    const categories = equipment.armorCategories ?? new Set();
    return {
      met: parsed.armorCategories.some((category) => categories.has(category)),
      text: parsed.text,
    };
  }

  if (parsed.weaponUsage === 'melee' || parsed.weaponUsage === 'ranged') {
    return {
      met: parsed.weaponUsage === 'melee' ? !!equipment.wieldedMelee : !!equipment.wieldedRanged,
      text: parsed.text,
    };
  }

  if (Array.isArray(parsed.weaponCategories) && parsed.weaponCategories.length > 0) {
    const categories = equipment.weaponCategories ?? new Set();
    return {
      met: parsed.weaponCategories.some((category) => categories.has(category)),
      text: parsed.text,
    };
  }

  if (Array.isArray(parsed.weaponGroups) && parsed.weaponGroups.length > 0) {
    const groups = equipment.weaponGroups ?? new Set();
    return {
      met: parsed.weaponGroups.some((group) => groups.has(group)),
      text: parsed.text,
    };
  }

  if (Array.isArray(parsed.weaponTraits) && parsed.weaponTraits.length > 0) {
    const traits = equipment.weaponTraits ?? new Set();
    return {
      met: parsed.weaponTraits.some((trait) => traits.has(trait)),
      text: parsed.text,
    };
  }

  return { met: null, text: parsed.text };
}

export function matchUnknown(parsed) {
  return {
    met: null,
    text: parsed.text,
  };
}

function normalizeWeaponFamily(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getTrackedClasses(buildState) {
  if (Array.isArray(buildState?.classes) && buildState.classes.length > 0) {
    return buildState.classes;
  }
  return buildState?.class ? [buildState.class] : [];
}

function getWeaponFamilyAliases(family) {
  switch (family) {
    case 'crossbow':
      return ['crossbow', 'crossbows', 'simple', 'simple-weapons'];
    case 'bow':
      return ['bow', 'bows', 'martial', 'martial-weapons'];
    case 'firearm':
      return ['firearm', 'firearms'];
    default:
      return [family];
  }
}

function normalizeProficiencyKey(key) {
  return String(key ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function normalizeDivineFont(value) {
  const normalized = normalizeText(value);
  if (['heal', 'healing'].includes(normalized)) return 'healing';
  if (['harm', 'harming', 'harmful'].includes(normalized)) return 'harmful';
  return '';
}
