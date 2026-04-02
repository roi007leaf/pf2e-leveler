global.game = {
  modules: {
    get: jest.fn(() => ({
      api: {},
      version: '1.0.0',
    })),
  },
  settings: {
    get: jest.fn((moduleId, settingId) => {
      if (global._testSettings?.[moduleId]?.[settingId] !== undefined) {
        return global._testSettings[moduleId][settingId];
      }
      const defaults = {
        'pf2e-leveler': {
          showPlanButton: true,
          autoApplyOnLevelUp: true,
          showPrerequisites: true,
          hideUncommonFeats: false,
          featSortMethod: 'LEVEL_DESC',
          additionalFeatCompendiums: '',
        },
        pf2e: {
          freeArchetypeVariant: false,
          gradualBoostsVariant: false,
          automaticBonusVariant: 'noABP',
          mythic: 'disabled',
        },
      };
      return defaults[moduleId]?.[settingId] ?? false;
    }),
    set: jest.fn((moduleId, settingId, value) => {
      if (!global._testSettings) global._testSettings = {};
      if (!global._testSettings[moduleId]) global._testSettings[moduleId] = {};
      global._testSettings[moduleId][settingId] = value;
    }),
    register: jest.fn(),
  },
  user: {
    isGM: true,
    id: 'test-user-id',
    character: null,
  },
  system: {
    id: 'pf2e',
    version: '7.0.0',
  },
  i18n: {
    has: jest.fn(() => false),
    localize: jest.fn((key) => key),
    format: jest.fn((key, data) => {
      let result = key;
      if (data) {
        Object.entries(data).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, v);
        });
      }
      return result;
    }),
  },
  packs: {
    get: jest.fn(),
  },
  pf2e: {
    settings: {
      variants: {
        fa: false,
      },
    },
  },
};

global.canvas = {
  scene: {
    id: 'test-scene',
  },
  tokens: {
    controlled: [],
    placeables: [],
  },
};

global.ui = {
  notifications: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  windows: {},
};

global.Hooks = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  callAll: jest.fn(),
};

global.Handlebars = {
  registerHelper: jest.fn(),
};

global.foundry = {
  utils: {
    deepClone: jest.fn((obj) => JSON.parse(JSON.stringify(obj))),
    mergeObject: jest.fn((original, other) => ({ ...original, ...other })),
    getProperty: jest.fn((obj, key) => {
      return key.split('.').reduce((o, k) => o?.[k], obj);
    }),
    setProperty: jest.fn((obj, key, value) => {
      const keys = key.split('.');
      const last = keys.pop();
      const target = keys.reduce((o, k) => {
        if (!o[k]) o[k] = {};
        return o[k];
      }, obj);
      target[last] = value;
    }),
    fetchJsonWithTimeout: jest.fn(),
  },
  applications: {
    api: {
      ApplicationV2: class ApplicationV2 {
        constructor() {}
        render() {}
        close() {}
      },
      HandlebarsApplicationMixin: (cls) => cls,
      DialogV2: {
        confirm: jest.fn(() => Promise.resolve(true)),
      },
    },
    handlebars: {
      loadTemplates: jest.fn(() => Promise.resolve()),
    },
  },
};

global.fromUuid = jest.fn((uuid) => {
  return Promise.resolve({
    uuid,
    name: 'Mock Item',
    slug: 'mock-item',
    type: 'feat',
    img: 'icons/svg/mystery-man.svg',
    system: {
      level: { value: 1 },
      traits: { value: [], rarity: 'common' },
      prerequisites: { value: [] },
      category: 'class',
    },
    toObject: jest.fn(function () {
      return { ...this };
    }),
  });
});

global.fromUuidSync = jest.fn((uuid) => ({
  uuid,
  name: 'Mock Item',
  slug: 'mock-item',
}));

global.renderTemplate = jest.fn(() => Promise.resolve('<div>Mock Template</div>'));

global.ChatMessage = {
  create: jest.fn(() => Promise.resolve()),
};

global.$ = jest.fn((selector) => ({
  find: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  off: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  prepend: jest.fn().mockReturnThis(),
  css: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  html: jest.fn().mockReturnThis(),
  addClass: jest.fn().mockReturnThis(),
  removeClass: jest.fn().mockReturnThis(),
  toggleClass: jest.fn().mockReturnThis(),
  hasClass: jest.fn(() => false),
  attr: jest.fn(),
  data: jest.fn(),
  val: jest.fn(),
  prop: jest.fn().mockReturnThis(),
  each: jest.fn().mockReturnThis(),
}));

global.CONST = {
  DOCUMENT_OWNERSHIP_LEVELS: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3,
  },
};

global.createMockActor = (overrides = {}) => {
  const defaults = {
    id: 'mock-actor-id',
    name: 'Test Character',
    type: 'character',
    system: {
      details: {
        level: { value: 1 },
        xp: { value: 0, max: 1000 },
      },
      build: {
        attributes: {
          boosts: {
            1: [],
            5: [],
            10: [],
            15: [],
            20: [],
          },
          allowedBoosts: { 5: 4, 10: 4, 15: 4, 20: 4 },
          flaws: { ancestry: [] },
        },
      },
      abilities: {
        str: { mod: 0 },
        dex: { mod: 0 },
        con: { mod: 0 },
        int: { mod: 0 },
        wis: { mod: 0 },
        cha: { mod: 0 },
      },
      skills: {
        acrobatics: { rank: 0, value: 0 },
        arcana: { rank: 0, value: 0 },
        athletics: { rank: 0, value: 0 },
        crafting: { rank: 0, value: 0 },
        deception: { rank: 0, value: 0 },
        diplomacy: { rank: 0, value: 0 },
        intimidation: { rank: 0, value: 0 },
        medicine: { rank: 0, value: 0 },
        nature: { rank: 0, value: 0 },
        occultism: { rank: 0, value: 0 },
        performance: { rank: 0, value: 0 },
        religion: { rank: 0, value: 0 },
        society: { rank: 0, value: 0 },
        stealth: { rank: 0, value: 0 },
        survival: { rank: 0, value: 0 },
        thievery: { rank: 0, value: 0 },
      },
    },
    class: {
      name: 'Alchemist',
      slug: 'alchemist',
      system: {
        classFeatLevels: { value: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
        skillFeatLevels: { value: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
        generalFeatLevels: { value: [3, 7, 11, 15, 19] },
        skillIncreaseLevels: { value: [3, 5, 7, 9, 11, 13, 15, 17, 19] },
        items: {},
        spellcasting: 0,
      },
    },
    ancestry: {
      name: 'Human',
      slug: 'human',
    },
    heritage: {
      name: 'Versatile Heritage',
      slug: 'versatile-heritage',
    },
    items: {
      filter: jest.fn(() => []),
      find: jest.fn(),
      map: jest.fn(() => []),
    },
    skills: {},
    getFlag: jest.fn(),
    setFlag: jest.fn(() => Promise.resolve()),
    unsetFlag: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    deleteEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
  };

  return foundry.utils.deepClone({ ...defaults, ...overrides });
};

beforeEach(() => {
  jest.clearAllMocks();
  global._testSettings = {};
});
