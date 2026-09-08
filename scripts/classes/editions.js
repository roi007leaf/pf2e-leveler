export function isRemasteredClass(actor, classSlug, selectedClass = null) {
  const slug = (item) => item?.slug ?? item?.system?.slug;
  const classItem = actor?.items?.find((item) => item.type === 'class' && slug(item) === classSlug)
    ?? (slug(actor?.class) === classSlug ? actor.class : null)
    ?? selectedClass;
  const publication = classItem?.system?.publication ?? classItem?.publication;
  if (typeof publication?.remaster === 'boolean') return publication.remaster;
  if (publication?.title === 'Pathfinder Impossible Magic') return true;
  return actor?.items?.some((item) => item.type === 'feat' && (
    (slug(item) === `${classSlug}-spellcasting` && (classSlug === 'magus' || item.system?.publication?.remaster === true))
    || (classSlug === 'magus' && slug(item) === 'studious-spells' && item.system?.publication?.remaster === true)
  )) ?? false;
}

const remasteredSlots = Object.fromEntries(Array.from({ length: 20 }, (_, index) => {
  const level = index + 1;
  const slots = { cantrips: 5 };
  // Impossible Magic: retain every rank, gaining the second slot next level.
  for (let rank = 1; rank <= Math.min(9, Math.ceil(level / 2)); rank++) {
    slots[rank] = level >= rank * 2 ? 2 : 1;
  }
  return [level, slots];
}));

const remasteredMagusFeatures = {
  'lightning-reflexes': { name: 'Reflex Expertise', key: 'reflex-expertise', proficiencies: { reflex: 2 } },
  alertness: { name: 'Perception Expertise', key: 'perception-expertise', proficiencies: { perception: 2 } },
  resolve: { name: 'Twofold Will', key: 'twofold-will', proficiencies: { will: 3 } },
  juggernaut: { name: 'Spell-Tempered Body', key: 'spell-tempered-body', proficiencies: { fortitude: 3 } },
};

export function resolveClassEdition(classDef, actor, selectedClass = null) {
  if (!['magus', 'summoner'].includes(classDef?.slug) || !isRemasteredClass(actor, classDef.slug, selectedClass)) return classDef;
  return {
    ...classDef,
    classFeatures: (classDef.classFeatures ?? []).map((feature) => {
      if (classDef.slug === 'magus' && remasteredMagusFeatures[feature.key]) {
        return { ...feature, ...remasteredMagusFeatures[feature.key] };
      }
      if (classDef.slug === 'summoner' && feature.key === 'unlimited-signature-spells') {
        return { ...feature, name: 'Signature Spells', key: 'signature-spells' };
      }
      return feature;
    }),
    spellcasting: { ...classDef.spellcasting, slots: remasteredSlots },
  };
}
