jest.mock('../../../scripts/apply/apply-boosts.js', () => ({
  applyBoosts: jest.fn(async (_actor, _plan, level) => [`boost-${level}`]),
}));

jest.mock('../../../scripts/apply/apply-languages.js', () => ({
  applyLanguages: jest.fn(async () => []),
}));

jest.mock('../../../scripts/apply/apply-skills.js', () => ({
  applySkillIncreases: jest.fn(async () => []),
}));

jest.mock('../../../scripts/apply/apply-feats.js', () => ({
  applyFeats: jest.fn(async (_actor, _plan, level) => [{ name: `feat-${level}`, uuid: `Compendium.pf2e.feats-srd.Item.feat-${level}` }]),
}));

jest.mock('../../../scripts/apply/apply-spells.js', () => ({
  applySpells: jest.fn(async (_actor, _plan, level) => [{ name: `spell-${level}`, uuid: `Compendium.pf2e.spells-srd.Item.spell-${level}`, rank: 1 }]),
}));

jest.mock('../../../scripts/apply/apply-feat-grants.js', () => ({
  applyFeatGrants: jest.fn(async () => ({
    items: [],
    formulas: [{ name: 'formula-5', uuid: 'Compendium.pf2e.equipment-srd.Item.formula-5' }],
    spells: [],
  })),
}));

jest.mock('../../../scripts/apply/apply-class-specific.js', () => ({
  applyClassSpecific: jest.fn(async () => {}),
}));

import { applyPlan } from '../../../scripts/apply/apply-manager.js';
import { applyBoosts } from '../../../scripts/apply/apply-boosts.js';
import { applyFeats } from '../../../scripts/apply/apply-feats.js';
import { applySpells } from '../../../scripts/apply/apply-spells.js';
import { applyFeatGrants } from '../../../scripts/apply/apply-feat-grants.js';

describe('applyPlan', () => {
  beforeEach(() => {
    global.ui = {
      notifications: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    global.game = {
      i18n: {
        localize: jest.fn((key) => key),
        format: jest.fn((key, data) => `${key}:${JSON.stringify(data)}`),
        has: jest.fn(() => false),
      },
      users: [],
    };

    global.ChatMessage = {
      create: jest.fn(async () => {}),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('applies each planned level between the previous and new levels', async () => {
    const actor = {
      name: 'Alcor',
      testUserPermission: jest.fn(() => true),
    };
    const plan = {
      levels: {
        5: {},
        6: {},
        7: {},
        8: {},
      },
    };

    await applyPlan(actor, plan, 8, 4);

    expect(applyBoosts).toHaveBeenNthCalledWith(1, actor, plan, 5);
    expect(applyBoosts).toHaveBeenNthCalledWith(2, actor, plan, 6);
    expect(applyBoosts).toHaveBeenNthCalledWith(3, actor, plan, 7);
    expect(applyBoosts).toHaveBeenNthCalledWith(4, actor, plan, 8);

    expect(applyFeats).toHaveBeenNthCalledWith(1, actor, plan, 5);
    expect(applyFeats).toHaveBeenNthCalledWith(2, actor, plan, 6);
    expect(applyFeats).toHaveBeenNthCalledWith(3, actor, plan, 7);
    expect(applyFeats).toHaveBeenNthCalledWith(4, actor, plan, 8);

    expect(applySpells).toHaveBeenNthCalledWith(1, actor, plan, 5);
    expect(applyFeatGrants).toHaveBeenNthCalledWith(1, actor, plan, 5);

    expect(ChatMessage.create).toHaveBeenCalledTimes(4);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[Compendium.pf2e.feats-srd.Item.feat-5]{feat-5}'),
    }));
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[Compendium.pf2e.spells-srd.Item.spell-5]{spell-5} (1)'),
    }));
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@UUID[Compendium.pf2e.equipment-srd.Item.formula-5]{formula-5}'),
    }));
  });
});
