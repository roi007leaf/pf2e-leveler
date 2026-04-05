export const REAL_PREREQUISITE_FIXTURES = [
  {
    label: 'Guardian Resiliency class hp requirement',
    featName: 'Guardian Resiliency',
    source: 'https://2e.aonprd.com/Feats.aspx?ID=688',
    text: 'Class granting no more Hit Points per level than 10 + your Constitution modifier',
    buildState: {
      class: { slug: 'cleric', hp: 8 },
      attributes: { con: 2 },
    },
    expected: true,
  },
  {
    label: 'deity domain requirement',
    featName: 'Domain feat style prerequisite',
    text: 'deity with the fire domain',
    buildState: {
      deity: { slug: 'sarenrae', name: 'Sarenrae', domains: new Set(['fire', 'sun']) },
    },
    expected: true,
  },
  {
    label: 'Streetwise style lore skill requirement',
    featName: 'Streetwise',
    text: 'trained in Underworld Lore',
    buildState: {
      lores: { 'underworld-lore': 1 },
    },
    expected: true,
  },
  {
    label: 'armor category requirement',
    featName: 'armor feat style prerequisite',
    text: 'wearing medium or heavy armor',
    buildState: {
      equipment: { armorCategories: new Set(['medium']) },
    },
    expected: true,
  },
  {
    label: 'weapon group requirement',
    featName: 'weapon group feat style prerequisite',
    text: 'wielding a weapon in the sword group',
    buildState: {
      equipment: { weaponGroups: new Set(['sword']) },
    },
    expected: true,
  },
  {
    label: 'weapon trait requirement',
    featName: 'weapon trait feat style prerequisite',
    text: 'wielding a weapon with the sweep trait',
    buildState: {
      equipment: { weaponTraits: new Set(['sweep']) },
    },
    expected: true,
  },
  {
    label: 'Adaptive Adept direct spellcasting tradition requirement',
    featName: 'Adaptive Adept',
    source: 'https://2e.aonprd.com/Feats.aspx?ID=4478',
    text: 'ability to cast divine spells',
    buildState: {
      spellcasting: { traditions: new Set(['divine']) },
    },
    expected: true,
  },
  {
    label: 'Barbarian class feature requirement',
    featName: 'rage feat style prerequisite',
    text: 'Rage class feature',
    buildState: {
      classFeatures: new Set(['rage']),
    },
    expected: true,
  },
  {
    label: 'rank requirement with parenthetical clarifier',
    featName: 'deity-associated skill feat style prerequisite',
    text: 'trained in Religion (or another skill associated with your deity)',
    buildState: {
      skills: { religion: 1 },
    },
    expected: true,
  },
  {
    label: 'Vampire Dedication narrative prerequisite remains unverified',
    featName: 'Vampire Dedication',
    source: 'https://2e.aonprd.com/Feats.aspx?ID=3545',
    text: 'You were a killed by a vampire drinking your blood.',
    buildState: {},
    expected: true,
    expectedResult: null,
  },
  {
    label: 'Lastwall Sentry Dedication narrative membership does not hard-fail',
    featName: 'Lastwall Sentry Dedication',
    source: 'https://2e.aonprd.com/Feats.aspx?ID=882',
    text: 'member of the Knights of Lastwall; Shield Block',
    buildState: {
      classFeatures: new Set(['shield-block']),
    },
    expected: true,
    expectedResult: null,
  },
  {
    label: 'Manipulative Charm mixed feat and skill prerequisites',
    featName: 'Manipulative Charm',
    source: 'https://2e.aonprd.com/Feats.aspx?ID=3549',
    text: 'Vampire Dedication; trained in Deception or Diplomacy',
    buildState: {
      feats: new Set(['vampire-dedication']),
      skills: { deception: 1, diplomacy: 0 },
    },
    expected: true,
  },
];
