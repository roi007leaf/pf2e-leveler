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
  const met = !!buildState.feats?.has(parsed.slug) || !!buildState.classFeatures?.has(parsed.slug);
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
  const classHp = buildState.class?.hp;
  const conModifier = buildState.attributes?.con ?? 0;

  if (!Number.isFinite(classHp)) {
    return { met: null, text: parsed.text };
  }

  const currentValue = parsed.includesConModifier ? classHp + conModifier : classHp;
  const threshold = parsed.includesConModifier ? parsed.maxHp + conModifier : parsed.maxHp;

  return {
    met: parsed.comparator === 'lte' ? currentValue <= threshold : null,
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
  const subclassType = normalizeText(buildState.class?.subclassType);
  const expectedSubclassType = normalizeText(parsed.subclassType);
  const traditions = buildState.spellcasting?.traditions ?? new Set();

  if (expectedSubclassType && subclassType && expectedSubclassType !== subclassType) {
    return { met: false, text: parsed.text };
  }

  if (parsed.tradition) {
    return {
      met: traditions.has(parsed.tradition),
      text: parsed.text,
    };
  }

  return {
    met: expectedSubclassType ? expectedSubclassType === subclassType : null,
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
  const subclassType = normalizeText(buildState.class?.subclassType);
  const expectedType = normalizeText(parsed.subclassType);
  if (!expectedType || subclassType !== expectedType) {
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
