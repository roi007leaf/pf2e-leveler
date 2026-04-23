import { getAdditionalSelectedItems, getAdditionalSelectedSkills } from '../../../scripts/creation/apply-creation.js';
import { applyCreation } from '../../../scripts/creation/apply-creation.js';
import { MIXED_ANCESTRY_CHOICE_FLAG, MIXED_ANCESTRY_UUID, MODULE_ID } from '../../../scripts/constants.js';

jest.mock('../../../scripts/creation/class-handlers/registry.js', () => ({
  getClassHandler: jest.fn(() => ({
    applyExtras: jest.fn(async () => {}),
    resolveFocusSpells: jest.fn(async () => []),
    getExtraSteps: jest.fn(() => []),
    shouldApplySubclassItem: jest.fn(() => false),
  })),
}));

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: { get: jest.fn(() => null) },
}));

jest.mock('../../../scripts/utils/i18n.js', () => ({
  format: jest.fn((key, data) => {
    let result = key;
    Object.entries(data ?? {}).forEach(([name, value]) => {
      result = result.replace(`{${name}}`, value);
    });
    return result;
  }),
  localize: jest.fn((key) => key),
}));

jest.mock('../../../scripts/utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const { getClassHandler } = jest.requireMock('../../../scripts/creation/class-handlers/registry.js');

describe('getAdditionalSelectedItems', () => {
  it('does not manually add handler-owned class selections', () => {
    const items = getAdditionalSelectedItems({
      implement: { uuid: 'implement-uuid', name: 'Amulet' },
      tactics: [{ uuid: 'tactic-uuid', name: 'Raise Morale' }],
      innovationItem: { uuid: 'weapon-uuid', name: 'Crossbow' },
      innovationModification: { uuid: 'mod-uuid', name: 'Razor Prongs' },
      secondElement: { uuid: 'metal-uuid', name: 'Metal Gate' },
      kineticImpulses: [{ uuid: 'impulse-uuid', name: 'Armor in Earth' }],
      subconsciousMind: { uuid: 'sub-uuid', name: 'Gathered Lore' },
      thesis: { uuid: 'thesis-uuid', name: 'Spell Blending' },
      apparitions: [{ uuid: 'app-uuid', name: 'Witness to Ancient Battles' }],
      subclass: {
        choiceSets: [
          {
            flag: 'multiclassDedication',
            options: [{ value: 'wizard-dedication', uuid: 'dedication-uuid', label: 'Wizard Dedication' }],
          },
        ],
        choices: {
          multiclassDedication: 'wizard-dedication',
        },
      },
    });

    expect(items).toEqual([]);
  });

  it('does not manually add exemplar ikons because PF2E grants them from the system choice set', () => {
    const items = getAdditionalSelectedItems({
      ikons: [
        { uuid: 'ikon-one', name: 'Bands of Imprisonment' },
        { uuid: 'ikon-two', name: "Barrow's Edge" },
      ],
    });

    expect(items).toEqual([]);
  });

  it('does not manually add subclass choice results', () => {
    const items = getAdditionalSelectedItems({
      implement: { uuid: 'shared-uuid', name: 'Amulet' },
      subclass: {
        choiceSets: [
          {
            flag: 'implement',
            options: [{ value: 'amulet', uuid: 'shared-uuid', label: 'Amulet' }],
          },
        ],
        choices: {
          implement: 'amulet',
        },
      },
    });

    expect(items).toEqual([]);
  });

  it('does not manually add direct compendium UUID subclass choices', () => {
    const items = getAdditionalSelectedItems({
      subclass: {
        choiceSets: [
          {
            flag: 'impulseOne',
            options: [],
          },
        ],
        choices: {
          impulseOne: 'Compendium.pf2e.feats-srd.Item.tremor',
        },
      },
    });

    expect(items).toEqual([]);
  });

  it('does not manually add selected feat choice results', () => {
    const items = getAdditionalSelectedItems({
      ancestryFeat: {
        name: 'Natural Ambition',
        choiceSets: [
          {
            flag: 'grantedClassFeat',
            options: [{ value: 'Compendium.pf2e.feats-srd.Item.reactive-shield', uuid: 'Compendium.pf2e.feats-srd.Item.reactive-shield', label: 'Reactive Shield' }],
          },
        ],
        choices: {
          grantedClassFeat: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
        },
      },
    });

    expect(items).toEqual([]);
  });

  it('does not manually add selected granted feat choice results', () => {
    const items = getAdditionalSelectedItems({
      grantedFeatSections: [
        {
          slot: 'Compendium.pf2e.feats-srd.Item.adopted-ancestry',
          featName: 'Adopted Ancestry',
          sourceName: 'Adaptive Anadi',
          choiceSets: [
            {
              flag: 'ancestry',
              options: [{ value: 'android', uuid: 'Compendium.pf2e.ancestries.Item.android', label: 'Android' }],
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'Compendium.pf2e.feats-srd.Item.adopted-ancestry': {
          ancestry: 'android',
        },
      },
    });

    expect(items).toEqual([]);
  });

  it('manually adds selected spell choice results from choice sets', () => {
    const items = getAdditionalSelectedItems({
      grantedFeatSections: [
        {
          slot: 'Compendium.pf2e.feats-srd.Item.draconic-feat',
          featName: 'Dragon Spit',
          choiceSets: [
            {
              flag: 'dragonCantrip',
              options: [
                {
                  value: 'Compendium.pf2e.spells-srd.Item.electric-arc',
                  uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc',
                  label: 'Electric Arc',
                  type: 'spell',
                },
              ],
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'Compendium.pf2e.feats-srd.Item.draconic-feat': {
          dragonCantrip: 'Compendium.pf2e.spells-srd.Item.electric-arc',
        },
      },
    });

    expect(items).toEqual([
      {
        uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc',
        name: 'Electric Arc',
        _type: 'spell',
      },
    ]);
  });

  it('manually adds selected ancestry feat spell choice results when the stored selection uses the option UUID', () => {
    const items = getAdditionalSelectedItems({
      ancestryFeat: {
        name: 'Otherworldly Magic',
        choiceSets: [
          {
            flag: 'otherworldlyMagic',
            options: [
              {
                value: 'electric-arc',
                label: 'Electric Arc',
                uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc',
                type: 'spell',
              },
            ],
          },
        ],
        choices: {
          otherworldlyMagic: 'Compendium.pf2e.spells-srd.Item.electric-arc',
        },
      },
    });

    expect(items).toEqual([
      {
        uuid: 'Compendium.pf2e.spells-srd.Item.electric-arc',
        name: 'Electric Arc',
        _type: 'spell',
      },
    ]);
  });
});

describe('getAdditionalSelectedSkills', () => {
  it('collects selected synthetic feat skill-training choices', () => {
    const skills = getAdditionalSelectedSkills({
      ancestryFeat: {
        choiceSets: [
          {
            flag: 'levelerSkillFallback1',
            grantsSkillTraining: true,
            options: [
              { value: 'athletics', label: 'Athletics' },
            ],
          },
        ],
        choices: {
          levelerSkillFallback1: 'athletics',
        },
      },
      grantedFeatSections: [],
      grantedFeatChoices: {},
    });

    expect(skills).toEqual(['athletics']);
  });

  it('collects widened replacement skill choices from non-synthetic skill sections', () => {
    const skills = getAdditionalSelectedSkills({
      grantedFeatSections: [
        {
          slot: 'background-scholar',
          choiceSets: [
            {
              flag: 'skill',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
            },
            {
              flag: 'assurance',
              allowAutoTrainedSelection: true,
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'background-scholar': {
          skill: 'intimidation',
          assurance: 'arcana',
        },
      },
    });

    expect(skills).toEqual(['intimidation']);
  });
});

describe('applyCreation ancestry paragon', () => {
  it('does not manually add the dual subclass when the dual class handler says PF2E will apply it', async () => {
    game.settings.get = jest.fn(() => false);

    const primaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => true),
    };
    const secondaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };

    getClassHandler.mockImplementation((slug) => {
      if (slug === 'witch') return primaryHandler;
      if (slug === 'wizard') return secondaryHandler;
      return {
        applyExtras: jest.fn(async () => {}),
        resolveFocusSpells: jest.fn(async () => []),
        getExtraSteps: jest.fn(() => []),
        shouldApplySubclassItem: jest.fn(() => false),
      };
    });

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid,
      toObject: () => ({
        name: uuid,
        type: uuid.includes('subclass') ? 'feat' : 'class',
        system: { rules: [], description: { value: '' }, level: { value: 1 } },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'witch-class', name: 'Witch', slug: 'witch' },
      subclass: { uuid: 'witch-subclass', name: 'Baba Yaga', slug: 'baba-yaga' },
      dualClass: { uuid: 'wizard-class', name: 'Wizard', slug: 'wizard' },
      dualSubclass: { uuid: 'wizard-subclass', name: 'Runelord', slug: 'runelord' },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: null,
      skillFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
      dualSpells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
      dualCurriculumSpells: { cantrips: [], rank1: [] },
      equipment: [],
    });

    const createdItems = actor.createEmbeddedDocuments.mock.calls
      .filter(([type]) => type === 'Item')
      .flatMap(([, docs]) => docs);

    expect(createdItems.map((item) => item.name)).toContain('witch-subclass');
    expect(createdItems.map((item) => item.name)).not.toContain('wizard-subclass');
    expect(secondaryHandler.shouldApplySubclassItem).toHaveBeenCalled();
  });

  it('keeps the primary class as the final embedded class for dual-class creation', async () => {
    game.settings.get = jest.fn(() => false);

    const primaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };
    const secondaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };

    getClassHandler.mockImplementation((slug) => {
      if (slug === 'witch') return primaryHandler;
      if (slug === 'wizard') return secondaryHandler;
      return {
        applyExtras: jest.fn(async () => {}),
        resolveFocusSpells: jest.fn(async () => []),
        getExtraSteps: jest.fn(() => []),
        shouldApplySubclassItem: jest.fn(() => false),
      };
    });

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      const created = docs.map((doc, index) => ({ ...doc, id: `created-${index}` }));
      for (const doc of created) {
        if (doc.type === 'class') {
          actor.class = {
            name: doc.name,
            slug: doc.system?.slug ?? doc.slug ?? doc.name.toLowerCase(),
            system: doc.system ?? {},
          };
        }
      }
      return created;
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid === 'witch-class' ? 'Witch' : uuid === 'wizard-class' ? 'Wizard' : uuid,
      slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
      toObject: () => ({
        name: uuid === 'witch-class' ? 'Witch' : uuid === 'wizard-class' ? 'Wizard' : uuid,
        type: uuid.includes('class') ? 'class' : 'feat',
        slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
        system: {
          slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
          rules: [],
          description: { value: '' },
          level: { value: 1 },
        },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'witch-class', name: 'Witch', slug: 'witch' },
      dualClass: { uuid: 'wizard-class', name: 'Wizard', slug: 'wizard' },
      subclass: null,
      dualSubclass: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: null,
      skillFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
      dualSpells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
      dualCurriculumSpells: { cantrips: [], rank1: [] },
      equipment: [],
    });

    expect(actor.class.slug).toBe('witch');
  });

  it('creates both classes in one embedded-document operation so PF2E can keep both class feature sets', async () => {
    game.settings.get = jest.fn(() => false);

    const primaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };
    const secondaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };

    getClassHandler.mockImplementation((slug) => {
      if (slug === 'witch') return primaryHandler;
      if (slug === 'wizard') return secondaryHandler;
      return {
        applyExtras: jest.fn(async () => {}),
        resolveFocusSpells: jest.fn(async () => []),
        getExtraSteps: jest.fn(() => []),
        shouldApplySubclassItem: jest.fn(() => false),
      };
    });

    const createdItems = [];
    const actor = createMockActor({ items: createdItems });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      const created = docs.map((doc, index) => ({ ...doc, id: `created-${index}` }));
      createdItems.push(...created);

      const classDocs = created.filter((doc) => doc.type === 'class');
      if (classDocs.length > 0) {
        actor.class = {
          name: classDocs.at(-1).name,
          slug: classDocs.at(-1).system?.slug ?? classDocs.at(-1).slug ?? classDocs.at(-1).name.toLowerCase(),
          system: classDocs.at(-1).system ?? {},
        };

        createdItems.splice(
          0,
          createdItems.length,
          ...createdItems.filter((item) => String(item?.system?.category ?? '').toLowerCase() !== 'classfeature'),
        );

        const grantedFeatures = classDocs.map((doc, index) => ({
          id: `feature-${index}`,
          name: `${doc.name} Feature`,
          type: 'feat',
          system: {
            category: 'classfeature',
            level: { value: 1 },
          },
        }));
        createdItems.push(...grantedFeatures);
      }

      return created;
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid === 'witch-class' ? 'Witch' : uuid === 'wizard-class' ? 'Wizard' : uuid,
      slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
      toObject: () => ({
        name: uuid === 'witch-class' ? 'Witch' : uuid === 'wizard-class' ? 'Wizard' : uuid,
        type: uuid.includes('class') ? 'class' : 'feat',
        slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
        system: {
          slug: uuid === 'witch-class' ? 'witch' : uuid === 'wizard-class' ? 'wizard' : uuid,
          rules: [],
          description: { value: '' },
          level: { value: 1 },
        },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'witch-class', name: 'Witch', slug: 'witch' },
      dualClass: { uuid: 'wizard-class', name: 'Wizard', slug: 'wizard' },
      subclass: null,
      dualSubclass: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: null,
      skillFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
      dualSpells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
      dualCurriculumSpells: { cantrips: [], rank1: [] },
      equipment: [],
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({ name: 'Wizard', type: 'class' }),
      expect.objectContaining({ name: 'Witch', type: 'class' }),
    ]);
    expect(createdItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Wizard Feature' }),
      expect.objectContaining({ name: 'Witch Feature' }),
    ]));
    expect(actor.class.slug).toBe('witch');
  });

  it('applies secondary dual-class extras with the secondary class spell data', async () => {
    game.settings.get = jest.fn(() => false);

    const primaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };
    const secondaryHandler = {
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    };

    getClassHandler.mockImplementation((slug) => {
      if (slug === 'bard') return primaryHandler;
      if (slug === 'wizard') return secondaryHandler;
      return {
        applyExtras: jest.fn(async () => {}),
        resolveFocusSpells: jest.fn(async () => []),
        getExtraSteps: jest.fn(() => []),
        shouldApplySubclassItem: jest.fn(() => false),
      };
    });

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid,
      toObject: () => ({
        name: uuid,
        type: uuid.includes('subclass') ? 'feat' : 'class',
        system: { rules: [], description: { value: '' }, level: { value: 1 } },
      }),
    }));

    const data = {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'bard-class', name: 'Bard', slug: 'bard' },
      dualClass: { uuid: 'wizard-class', name: 'Wizard', slug: 'wizard' },
      subclass: { uuid: 'bard-subclass', name: 'Maestro', slug: 'maestro' },
      dualSubclass: { uuid: 'wizard-subclass', name: 'School of Ars Grammatica', slug: 'ars-grammatica', tradition: 'arcane' },
      classSelections: {
        class: {},
        dualClass: {
          thesis: { uuid: 'thesis-uuid', name: 'Spell Blending', slug: 'spell-blending' },
        },
      },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      dualClassFeat: { uuid: 'dual-class-feat-uuid', name: 'Reach Spell', choices: {} },
      skillFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [{ uuid: 'song-of-strength', name: 'Song of Strength', img: 'song.png' }], rank1: [] },
      dualSpells: { cantrips: [{ uuid: 'shield', name: 'Shield', img: 'shield.png' }], rank1: [{ uuid: 'magic-missile', name: 'Magic Missile', img: 'missile.png' }] },
      curriculumSpells: { cantrips: [], rank1: [] },
      dualCurriculumSpells: { cantrips: [{ uuid: 'detect-magic', name: 'Detect Magic', img: 'detect.png' }], rank1: [] },
      equipment: [],
    };

    await applyCreation(actor, data);

    expect(primaryHandler.applyExtras).toHaveBeenCalledWith(actor, data);
    const createdItems = actor.createEmbeddedDocuments.mock.calls
      .filter(([type]) => type === 'Item')
      .flatMap(([, docs]) => docs);
    expect(createdItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        system: expect.objectContaining({
          location: expect.stringMatching(/^(xdy_dualclass|dualclass|dual_class)-1$/),
        }),
      }),
    ]));
    expect(secondaryHandler.applyExtras).toHaveBeenCalledWith(actor, expect.objectContaining({
      class: data.dualClass,
      subclass: data.dualSubclass,
      thesis: expect.objectContaining({ uuid: 'thesis-uuid' }),
      spells: data.dualSpells,
      curriculumSpells: data.dualCurriculumSpells,
    }));
  });

  it('applies the extra level-1 ancestry feat to the ancestry paragon location', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return true;
      if (scope === 'pf2e' && key === 'campaignFeatSections') return [];
      return false;
    });

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid.includes('paragon') ? 'Paragon Feat' : 'Ancestry Feat',
      toObject: () => ({
        name: uuid.includes('paragon') ? 'Paragon Feat' : 'Ancestry Feat',
        type: 'feat',
        system: { level: { value: 1 }, rules: [], description: { value: '' } },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: { uuid: 'feat-a', name: 'Ancestry Feat', choices: {} },
      ancestryParagonFeat: { uuid: 'feat-paragon', name: 'Paragon Feat', choices: {} },
      classFeat: null,
      subclass: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Ancestry Feat',
        system: expect.objectContaining({ location: 'ancestry-1' }),
      }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Paragon Feat',
        system: expect.objectContaining({ location: 'xdy_ancestryparagon-1' }),
      }),
    ]);
  });

  it('applies synthetic Mixed Ancestry heritage with the selected ancestry stored on the actor', async () => {
    game.settings.get = jest.fn(() => false);

    const actor = createMockActor({
      items: [],
      ancestry: { img: 'human.png' },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});
    global.fromUuid = jest.fn(async () => null);
    game.packs = new Map([
      ['pf2e.ancestries', {
        getDocuments: jest.fn(async () => [
          {
            slug: 'elf',
            name: 'Elf',
            system: { vision: 'lowLightVision' },
          },
        ]),
      }],
    ]);

    await applyCreation(actor, {
      ancestry: null,
      heritage: { uuid: MIXED_ANCESTRY_UUID, name: 'Mixed Ancestry', img: 'human.png' },
      background: null,
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: null,
      subclass: null,
      grantedFeatSections: [],
      grantedFeatChoices: {
        [MIXED_ANCESTRY_UUID]: {
          [MIXED_ANCESTRY_CHOICE_FLAG]: 'elf',
        },
      },
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Mixed Ancestry',
        type: 'heritage',
        system: expect.objectContaining({
          slug: 'mixed-ancestry',
          ancestry: null,
          traits: expect.objectContaining({
            value: [],
            rarity: 'uncommon',
          }),
          vision: 'lowLightVision',
        }),
        flags: expect.objectContaining({
          [MODULE_ID]: expect.objectContaining({
            mixedAncestrySelection: 'elf',
          }),
          pf2e: expect.objectContaining({
            rulesSelections: expect.objectContaining({
              [MIXED_ANCESTRY_CHOICE_FLAG]: 'elf',
            }),
          }),
        }),
      }),
    ]);
  });

  it('trains the selected deity skill during creation', async () => {
    game.settings.get = jest.fn(() => false);

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          society: { rank: 0 },
        },
        details: {
          languages: { value: [] },
        },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async (updates) => {
      if (Object.prototype.hasOwnProperty.call(updates, 'system.skills.society.rank')) {
        actor.system.skills.society.rank = updates['system.skills.society.rank'];
      }
    });
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});
    global.fromUuid = jest.fn(async () => null);

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'class-uuid', name: 'Champion' },
      deity: { uuid: 'deity-uuid', name: 'Abadar', skill: 'society' },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: { uuid: 'feat-uuid', name: 'Natural Ambition', choices: {} },
      ancestryParagonFeat: null,
      classFeat: null,
      subclass: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
    });

    expect(actor.update).toHaveBeenCalledWith({ 'system.skills.society.rank': 1 });
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[class-uuid]{Champion}'),
    }));
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[deity-uuid]{Abadar}'),
    }));
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[feat-uuid]{Natural Ambition}'),
    }));
  });

  it('trains a selected synthetic feat fallback skill during creation', async () => {
    game.settings.get = jest.fn(() => false);
    const originalConfig = global.CONFIG;

    const actor = createMockActor({
      items: [],
      system: {
        skills: {
          athletics: { rank: 0 },
        },
        details: {
          languages: { value: [] },
        },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async (updates) => {
      if (Object.prototype.hasOwnProperty.call(updates, 'system.skills.athletics.rank')) {
        actor.system.skills.athletics.rank = updates['system.skills.athletics.rank'];
      }
    });
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});
    global.CONFIG = {
      ...(global.CONFIG ?? {}),
      PF2E: {
        ...(global.CONFIG?.PF2E ?? {}),
        skills: {
          athletics: 'Athletics',
        },
      },
    };
    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: 'Elven Lore',
      toObject: () => ({
        name: 'Elven Lore',
        type: 'feat',
        system: { level: { value: 1 }, rules: [], description: { value: '' } },
      }),
    }));

    try {
      await applyCreation(actor, {
        ancestry: null,
        heritage: null,
        background: null,
        class: null,
        boosts: { free: [] },
        languages: [],
        skills: [],
        lores: [],
        ancestryFeat: {
          uuid: 'feat-elven-lore',
          name: 'Elven Lore',
          choiceSets: [
            {
              flag: 'levelerSkillFallback1',
              grantsSkillTraining: true,
              options: [{ value: 'athletics', label: 'Athletics' }],
            },
          ],
          choices: {
            levelerSkillFallback1: 'athletics',
          },
        },
        ancestryParagonFeat: null,
        classFeat: null,
        subclass: null,
        grantedFeatSections: [],
        grantedFeatChoices: {},
      });

      expect(actor.update).toHaveBeenCalledWith({ 'system.skills.athletics.rank': 1 });
    } finally {
      global.CONFIG = originalConfig;
    }
  });

  it('backfills missing granted feat section items with stored choices after creation', async () => {
    game.settings.get = jest.fn(() => false);

    const createdItems = [];
    const actor = createMockActor({
      items: createdItems,
      system: {
        skills: {
          arcana: { rank: 1, value: 0 },
          nature: { rank: 1, value: 0 },
          occultism: { rank: 1, value: 0 },
          religion: { rank: 0, value: 0 },
        },
        details: {
          languages: { value: [] },
          level: { value: 1 },
        },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      const embedded = docs.map((doc, index) => ({
        ...doc,
        id: `created-${index}`,
        sourceId: doc.flags?.core?.sourceId ?? doc._stats?.compendiumSource ?? doc.uuid ?? null,
      }));
      createdItems.push(...embedded);
      return embedded;
    });
    actor.update = jest.fn(async (updates) => {
      for (const [path, value] of Object.entries(updates)) {
        if (path === 'system.skills.religion.rank') actor.system.skills.religion.rank = value;
      }
    });
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'background-scholar') {
        return {
          uuid,
          name: 'Scholar',
          toObject: () => ({
            name: 'Scholar',
            type: 'background',
            flags: { core: { sourceId: uuid } },
            system: { rules: [], description: { value: '' } },
          }),
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0') {
        return {
          uuid,
          name: 'Assurance',
          toObject: () => ({
            name: 'Assurance',
            type: 'feat',
            flags: { core: { sourceId: uuid } },
            system: { rules: [], description: { value: '' } },
          }),
        };
      }

      return null;
    });

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: { uuid: 'background-scholar', name: 'Scholar', choices: {} },
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: null,
      subclass: null,
      grantedFeatSections: [
        {
          slot: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
          featName: 'Assurance',
          sourceName: 'Scholar -> Assurance',
          choiceSets: [
            {
              flag: 'skill',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0': {
          skill: 'rel',
        },
      },
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Assurance (Background: Scholar)',
        flags: expect.objectContaining({
          [MODULE_ID]: expect.objectContaining({
            manualGrantedFallback: true,
            manualGrantedFallbackSource: 'Scholar -> Assurance',
            manualGrantedFallbackOriginalName: 'Assurance',
          }),
          pf2e: expect.objectContaining({
            rulesSelections: expect.objectContaining({
              skill: 'rel',
            }),
          }),
        }),
      }),
    ]);
  });

  it('skips invalid widened Scholar skill selections on the background item while still training the replacement skill and backfilling Assurance', async () => {
    game.settings.get = jest.fn(() => false);

    const createdItems = [];
    const actor = createMockActor({
      items: createdItems,
      system: {
        skills: {
          arcana: { rank: 1, value: 0 },
          nature: { rank: 1, value: 0 },
          occultism: { rank: 1, value: 0 },
          religion: { rank: 1, value: 0 },
          intimidation: { rank: 0, value: 0 },
        },
        details: {
          languages: { value: [] },
          level: { value: 1 },
        },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      const embedded = docs.map((doc, index) => ({
        ...doc,
        id: `created-${index}`,
        sourceId: doc.flags?.core?.sourceId ?? doc._stats?.compendiumSource ?? doc.uuid ?? null,
      }));
      createdItems.push(...embedded);
      return embedded;
    });
    actor.update = jest.fn(async (updates) => {
      if ('system.skills.intimidation.rank' in updates) {
        actor.system.skills.intimidation.rank = updates['system.skills.intimidation.rank'];
      }
    });
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'background-scholar') {
        return {
          uuid,
          name: 'Scholar',
          toObject: () => ({
            name: 'Scholar',
            type: 'background',
            flags: { core: { sourceId: uuid } },
            system: {
              description: { value: '' },
              rules: [
                {
                  key: 'ChoiceSet',
                  flag: 'skill',
                  prompt: 'Select a skill.',
                  choices: [
                    { value: 'arc', label: 'Arcana' },
                    { value: 'nat', label: 'Nature' },
                    { value: 'occ', label: 'Occultism' },
                    { value: 'rel', label: 'Religion' },
                  ],
                },
                {
                  key: 'GrantItem',
                  uuid: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
                },
              ],
            },
          }),
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0') {
        return {
          uuid,
          name: 'Assurance',
          toObject: () => ({
            name: 'Assurance',
            type: 'feat',
            flags: { core: { sourceId: uuid } },
            system: {
              description: { value: '' },
              rules: [
                {
                  key: 'ChoiceSet',
                  flag: 'assurance',
                  prompt: 'Select a skill.',
                  choices: { config: 'skills' },
                },
              ],
            },
          }),
        };
      }

      return null;
    });

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: { uuid: 'background-scholar', name: 'Scholar', choices: {} },
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: null,
      subclass: null,
      grantedFeatSections: [
        {
          slot: 'background-scholar',
          featName: 'Scholar',
          sourceName: 'Scholar',
          choiceSets: [
            {
              flag: 'skill',
              prompt: 'Select a skill.',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
            },
          ],
        },
        {
          slot: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
          featName: 'Assurance',
          sourceName: 'Scholar -> Assurance',
          choiceSets: [
            {
              flag: 'assurance',
              prompt: 'Select a skill.',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
              allowAutoTrainedSelection: true,
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'background-scholar': {
          skill: 'intimidation',
        },
        'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0': {
          assurance: 'arcana',
        },
      },
    });

    expect(actor.update).toHaveBeenCalledWith({ 'system.skills.intimidation.rank': 1 });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Scholar',
        flags: expect.not.objectContaining({
          pf2e: expect.anything(),
        }),
      }),
    ]);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Assurance (Background: Scholar)',
        flags: expect.objectContaining({
          pf2e: expect.objectContaining({
            rulesSelections: expect.objectContaining({
              assurance: 'arcana',
            }),
          }),
        }),
      }),
    ]);
  });

  it('does not manually backfill Assurance when Scholar selected one of its authored skills', async () => {
    game.settings.get = jest.fn(() => false);

    const createdItems = [];
    const actor = createMockActor({
      items: createdItems,
      system: {
        skills: {
          arcana: { rank: 1, value: 0 },
          nature: { rank: 0, value: 0 },
          occultism: { rank: 0, value: 0 },
          religion: { rank: 0, value: 0 },
        },
        details: {
          languages: { value: [] },
          level: { value: 1 },
        },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      const embedded = docs.map((doc, index) => ({
        ...doc,
        id: `created-${index}`,
        sourceId: doc.flags?.core?.sourceId ?? doc._stats?.compendiumSource ?? doc.uuid ?? null,
      }));
      createdItems.push(...embedded);
      return embedded;
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'background-scholar') {
        return {
          uuid,
          name: 'Scholar',
          toObject: () => ({
            name: 'Scholar',
            type: 'background',
            flags: { core: { sourceId: uuid } },
            system: {
              description: { value: '' },
              rules: [
                {
                  key: 'ChoiceSet',
                  flag: 'skill',
                  prompt: 'Select a skill.',
                  choices: [
                    { value: 'arc', label: 'Arcana' },
                    { value: 'nat', label: 'Nature' },
                    { value: 'occ', label: 'Occultism' },
                    { value: 'rel', label: 'Religion' },
                  ],
                },
                {
                  key: 'GrantItem',
                  uuid: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
                },
              ],
            },
          }),
        };
      }

      if (uuid === 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0') {
        return {
          uuid,
          name: 'Assurance',
          toObject: () => ({
            name: 'Assurance',
            type: 'feat',
            flags: { core: { sourceId: uuid } },
            system: {
              description: { value: '' },
              rules: [
                {
                  key: 'ChoiceSet',
                  flag: 'assurance',
                  prompt: 'Select a skill.',
                  choices: { config: 'skills' },
                },
              ],
            },
          }),
        };
      }

      return null;
    });

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: { uuid: 'background-scholar', name: 'Scholar', choices: {} },
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: null,
      subclass: null,
      grantedFeatSections: [
        {
          slot: 'background-scholar',
          featName: 'Scholar',
          sourceName: 'Scholar',
          choiceSets: [
            {
              flag: 'skill',
              prompt: 'Select a skill.',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
            },
          ],
        },
        {
          slot: 'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0',
          featName: 'Assurance',
          sourceName: 'Scholar -> Assurance',
          choiceSets: [
            {
              flag: 'assurance',
              prompt: 'Select a skill.',
              options: [
                { value: 'arc', label: 'Arcana' },
                { value: 'nat', label: 'Nature' },
                { value: 'occ', label: 'Occultism' },
                { value: 'rel', label: 'Religion' },
              ],
              allowAutoTrainedSelection: true,
            },
          ],
        },
      ],
      grantedFeatChoices: {
        'background-scholar': {
          skill: 'occ',
        },
        'Compendium.pf2e.feats-srd.Item.W6Gl9ePmItfDHji0': {
          assurance: 'arc',
        },
      },
    });

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Assurance (Background: Scholar)',
      }),
    ]);
  });

  it('applies a rogue level 1 skill feat during creation', async () => {
    game.settings.get = jest.fn(() => false);

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => docs.map((doc, index) => ({ ...doc, id: `created-${index}` })));
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid === 'skill-feat-uuid' ? 'Steady Balance' : 'Rogue',
      toObject: () => ({
        name: uuid === 'skill-feat-uuid' ? 'Steady Balance' : 'Rogue',
        type: uuid === 'skill-feat-uuid' ? 'feat' : 'class',
        system: { level: { value: 1 }, rules: [], description: { value: '' } },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'class-rogue', name: 'Rogue' },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: { uuid: 'skill-feat-uuid', name: 'Steady Balance', choices: {} },
      subclass: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
    });

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [
      expect.objectContaining({
        name: 'Steady Balance',
        system: expect.objectContaining({ location: 'skill-1' }),
      }),
    ]);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[skill-feat-uuid]{Steady Balance}'),
    }));
  });

  it('adds description-linked focus spells from selected ancestry feats during creation', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
      if (scope === 'pf2e' && key === 'campaignFeatSections') return [];
      return false;
    });

    const createdDocs = [];
    const actor = createMockActor({
      items: [],
      system: {
        resources: { focus: { max: 0, value: 0 } },
      },
    });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      createdDocs.push(...docs);
      return docs.map((doc, index) => ({ ...doc, id: `created-${index}` }));
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => {
      if (uuid === 'ancestry-human') {
        return {
          uuid,
          name: 'Human',
          toObject: () => ({
            name: 'Human',
            type: 'ancestry',
            system: { description: { value: '' }, rules: [] },
          }),
        };
      }

      if (uuid === 'ancestry-feat-timber-magic') {
        return {
          uuid,
          name: 'Timber Magic',
          toObject: () => ({
            name: 'Timber Magic',
            type: 'feat',
            system: {
              level: { value: 1 },
              rules: [],
              description: {
                value: '<p>Cast @UUID[Compendium.pf2e.spells-srd.Item.protector-tree]{Protector Tree}.</p>',
              },
            },
          }),
        };
      }

      if (uuid === 'Compendium.pf2e.spells-srd.Item.protector-tree') {
        return {
          uuid,
          name: 'Protector Tree',
          toObject: () => ({
            name: 'Protector Tree',
            type: 'spell',
            system: {
              traits: { value: ['focus'], traditions: [] },
            },
          }),
          system: {
            traits: { value: ['focus'], traditions: [] },
          },
        };
      }

      return null;
    });

    await applyCreation(actor, {
      ancestry: { uuid: 'ancestry-human', name: 'Human', slug: 'human' },
      heritage: null,
      background: null,
      class: null,
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: {
        uuid: 'ancestry-feat-timber-magic',
        name: 'Timber Magic',
        choices: {},
      },
      ancestryParagonFeat: null,
      classFeat: null,
      skillFeat: null,
      subclass: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
    });

    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'spellcastingEntry',
        system: expect.objectContaining({
          prepared: expect.objectContaining({ value: 'focus' }),
        }),
      }),
      expect.objectContaining({
        name: 'Protector Tree',
        type: 'spell',
        system: expect.objectContaining({
          location: expect.objectContaining({ value: 'created-0' }),
        }),
      }),
    ]));
    expect(actor.update).toHaveBeenCalledWith({
      'system.resources.focus.max': 1,
      'system.resources.focus.value': 1,
    });
  });

  it('does not manually apply the selected subclass item during creation', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
      if (scope === 'pf2e' && key === 'campaignFeatSections') return [];
      return false;
    });

    const createdDocs = [];
    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      createdDocs.push(...docs);
      return docs.map((doc, index) => ({ ...doc, id: `created-${index}` }));
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid.includes('untamed-order') ? 'Untamed Order' : 'Druid',
      toObject: () => ({
        name: uuid.includes('untamed-order') ? 'Untamed Order' : 'Druid',
        type: uuid.includes('untamed-order') ? 'feat' : 'class',
        system: {
          level: { value: 1 },
          rules: uuid.includes('untamed-order')
            ? [{ key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.untamed-form' }]
            : [],
          description: { value: '' },
        },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'class-druid', name: 'Druid', slug: 'druid', choices: {} },
      subclass: { uuid: 'subclass-untamed-order', name: 'Untamed Order', slug: 'untamed-order', choices: {} },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
    });

    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Druid', type: 'class' }),
    ]));
    expect(createdDocs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Untamed Order', type: 'feat' }),
    ]));
  });

  it('does not separately apply wizard school subclass items during creation', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
      if (scope === 'pf2e' && key === 'campaignFeatSections') return [];
      return false;
    });

    const createdDocs = [];
    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) => {
      createdDocs.push(...docs);
      return docs.map((doc, index) => ({ ...doc, id: `created-${index}` }));
    });
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});
    getClassHandler.mockReturnValue({
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    });

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid.includes('school') ? 'School of Unified Magical Theory' : 'Wizard',
      toObject: () => ({
        name: uuid.includes('school') ? 'School of Unified Magical Theory' : 'Wizard',
        type: uuid.includes('school') ? 'feat' : 'class',
        system: {
          level: { value: 1 },
          rules: [],
          description: { value: '' },
        },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'class-wizard', name: 'Wizard', slug: 'wizard', choices: {} },
      subclass: {
        uuid: 'subclass-unified-school',
        name: 'School of Unified Magical Theory',
        slug: 'school-of-unified-magical-theory',
        curriculum: {},
        choices: {},
      },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
    });

    expect(createdDocs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Wizard', type: 'class' }),
    ]));
    expect(createdDocs.some((doc) => doc.name === 'School of Unified Magical Theory' && doc.type === 'feat')).toBe(false);
  });

  it('includes selected wizard school choices in the creation chat message when the stored selection uses the option UUID', async () => {
    game.settings.get = jest.fn((scope, key) => {
      if (scope === 'pf2e-leveler' && key === 'ancestralParagon') return false;
      if (scope === 'pf2e' && key === 'campaignFeatSections') return [];
      return false;
    });

    const actor = createMockActor({ items: [] });
    actor.createEmbeddedDocuments = jest.fn(async (_type, docs) =>
      docs.map((doc, index) => ({ ...doc, id: `created-${index}` })),
    );
    actor.update = jest.fn(async () => {});
    actor.testUserPermission = jest.fn(() => true);
    game.users = [{ isGM: true, id: 'gm-user' }];
    ChatMessage.create = jest.fn(async () => {});
    getClassHandler.mockReturnValue({
      applyExtras: jest.fn(async () => {}),
      resolveFocusSpells: jest.fn(async () => []),
      getExtraSteps: jest.fn(() => []),
      shouldApplySubclassItem: jest.fn(() => false),
    });

    global.fromUuid = jest.fn(async (uuid) => ({
      uuid,
      name: uuid.includes('school') ? 'School of Unified Magical Theory' : 'Wizard',
      toObject: () => ({
        name: uuid.includes('school') ? 'School of Unified Magical Theory' : 'Wizard',
        type: uuid.includes('school') ? 'feat' : 'class',
        system: {
          level: { value: 1 },
          rules: [],
          description: { value: '' },
        },
      }),
    }));

    await applyCreation(actor, {
      ancestry: null,
      heritage: null,
      background: null,
      class: { uuid: 'class-wizard', name: 'Wizard', slug: 'wizard', choices: {} },
      subclass: {
        uuid: 'subclass-unified-school',
        name: 'School of Unified Magical Theory',
        slug: 'school-of-unified-magical-theory',
        curriculum: {},
        choiceSets: [
          {
            flag: 'school',
            prompt: 'Choose your school',
            options: [
              {
                uuid: 'Compendium.pf2e.classfeatures.Item.school-of-unified-magical-theory',
                value: 'unified-magical-theory',
                label: 'Unified Magical Theory',
              },
            ],
          },
        ],
        choices: {
          school: 'Compendium.pf2e.classfeatures.Item.school-of-unified-magical-theory',
        },
      },
      boosts: { free: [] },
      languages: [],
      skills: [],
      lores: [],
      ancestryFeat: null,
      ancestryParagonFeat: null,
      classFeat: null,
      grantedFeatSections: [],
      grantedFeatChoices: {},
      spells: { cantrips: [], rank1: [] },
      curriculumSpells: { cantrips: [], rank1: [] },
    });

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('Unified Magical Theory'),
    }));
  });
});
