import { getAdditionalSelectedItems, getAdditionalSelectedSkills } from '../../../scripts/creation/apply-creation.js';
import { applyCreation } from '../../../scripts/creation/apply-creation.js';

jest.mock('../../../scripts/creation/class-handlers/registry.js', () => ({
  getClassHandler: jest.fn(() => ({
    applyExtras: jest.fn(async () => {}),
    resolveFocusSpells: jest.fn(async () => []),
    getExtraSteps: jest.fn(() => []),
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
});

describe('applyCreation ancestry paragon', () => {
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
});
