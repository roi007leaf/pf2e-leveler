import { applySkillIncreases } from '../../../scripts/apply/apply-skills.js';
import { applySkillRetrains } from '../../../scripts/apply/apply-skill-retrains.js';

describe('applySkillIncreases', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      update: jest.fn(() => Promise.resolve()),
    };
  });

  test('applies single skill increase', async () => {
    const plan = {
      levels: { 3: { skillIncreases: [{ skill: 'athletics', toRank: 2 }] } },
    };
    const result = await applySkillIncreases(mockActor, plan, 3);
    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.athletics.rank': 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].skill).toBe('athletics');
  });

  test('returns empty for level without skill increases', async () => {
    const plan = { levels: { 2: { classFeats: [] } } };
    const result = await applySkillIncreases(mockActor, plan, 2);
    expect(mockActor.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('returns empty for nonexistent level', async () => {
    const plan = { levels: {} };
    const result = await applySkillIncreases(mockActor, plan, 5);
    expect(result).toEqual([]);
  });

  test('applies Intelligence bonus trained skills', async () => {
    mockActor.system = { skills: { arcana: { rank: 0 } } };
    const plan = {
      levels: { 5: { intBonusSkills: ['arcana'] } },
    };
    const result = await applySkillIncreases(mockActor, plan, 5);
    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.arcana.rank': 1,
    });
    expect(result).toEqual([{ skill: 'arcana', toRank: 1, intBonus: true }]);
  });

  test('applies custom skill increases alongside normal skill increases', async () => {
    const plan = {
      levels: {
        5: {
          skillIncreases: [{ skill: 'athletics', toRank: 2 }],
          customSkillIncreases: [{ skill: 'acrobatics', toRank: 3 }],
        },
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 5);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.athletics.rank': 2,
      'system.skills.acrobatics.rank': 3,
    });
    expect(result).toEqual([
      { skill: 'athletics', toRank: 2 },
      { skill: 'acrobatics', toRank: 3 },
    ]);
  });

  test('applies skill training granted by planned feat choice rules', async () => {
    mockActor.system = {
      skills: {
        stealth: { rank: 0 },
      },
    };

    const plan = {
      levels: {
        4: {
          classFeats: [{
            slug: 'arcane-evolution',
            skillRules: [],
            dynamicSkillRules: [{ skill: 'stealth', value: 1, source: 'choice:levelerskillchoice1' }],
          }],
        },
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 4);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.stealth.rank': 1,
    });
    expect(result).toEqual([
      { skill: 'stealth', toRank: 1, featChoice: true },
    ]);
  });

  test('retraining moves a skill increase to the replacement skill', async () => {
    mockActor.system = {
      skills: {
        stealth: { rank: 2 },
        occultism: { rank: 1 },
      },
    };
    const plan = {
      levels: {
        8: {
          retrainedSkillIncreases: [{
            fromLevel: 3,
            original: { skill: 'stealth', fromRank: 1, toRank: 2 },
            replacement: { skill: 'occultism', fromRank: 1, toRank: 2 },
          }],
        },
      },
    };

    const result = await applySkillRetrains(mockActor, plan, 8);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.stealth.rank': 1,
      'system.skills.occultism.rank': 2,
    });
    expect(result).toEqual([
      { original: { skill: 'stealth', rank: 2 }, replacement: { skill: 'occultism', rank: 2 } },
    ]);
  });

  test('retraining updates PF2e short skill keys on the actor', async () => {
    mockActor.system = {
      skills: {
        ste: { rank: 2 },
        occ: { rank: 1 },
      },
    };
    const plan = {
      levels: {
        8: {
          retrainedSkillIncreases: [{
            fromLevel: 3,
            original: { skill: 'stealth', fromRank: 1, toRank: 2 },
            replacement: { skill: 'occultism', fromRank: 1, toRank: 2 },
          }],
        },
      },
    };

    const result = await applySkillRetrains(mockActor, plan, 8);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.ste.rank': 1,
      'system.skills.occ.rank': 2,
    });
    expect(result).toEqual([
      { original: { skill: 'stealth', rank: 2 }, replacement: { skill: 'occultism', rank: 2 } },
    ]);
  });

  test('retraining downgrades the old skill by the retrained rank amount', async () => {
    mockActor.system = {
      skills: {
        athletics: { rank: 2 },
        occultism: { rank: 0 },
      },
    };
    const plan = {
      levels: {
        8: {
          retrainedSkillIncreases: [{
            fromLevel: 1,
            sourceType: 'initialSkill',
            original: { skill: 'athletics', fromRank: 0, toRank: 1 },
            replacement: { skill: 'occultism', fromRank: 0, toRank: 1 },
          }],
        },
      },
    };

    const result = await applySkillRetrains(mockActor, plan, 8);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.athletics.rank': 1,
      'system.skills.occultism.rank': 1,
    });
    expect(result).toEqual([
      { original: { skill: 'athletics', rank: 1 }, replacement: { skill: 'occultism', rank: 1 } },
    ]);
  });

  test('retraining increases the replacement skill by one moved step', async () => {
    mockActor.system = {
      skills: {
        stealth: { rank: 3 },
        occultism: { rank: 1 },
      },
    };
    const plan = {
      levels: {
        16: {
          retrainedSkillIncreases: [{
            fromLevel: 15,
            original: { skill: 'stealth', fromRank: 2, toRank: 3 },
            replacement: { skill: 'occultism', fromRank: 1, toRank: 3 },
          }],
        },
      },
    };

    const result = await applySkillRetrains(mockActor, plan, 16);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.stealth.rank': 2,
      'system.skills.occultism.rank': 2,
    });
    expect(result).toEqual([
      { original: { skill: 'stealth', rank: 3 }, replacement: { skill: 'occultism', rank: 2 } },
    ]);
  });

  test('applies Operatic Adventurer Performance scaling and Theater Lore at later levels', async () => {
    mockActor = {
      system: {
        skills: {
          performance: { rank: 3 },
        },
      },
      items: [{
        id: 'theater-lore',
        type: 'lore',
        slug: 'theater-lore',
        name: 'Theater Lore',
        system: { proficient: { value: 1 } },
      }],
      update: jest.fn(() => Promise.resolve()),
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
      updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    };

    const plan = {
      levels: {
        12: {
          skillFeats: [{
            slug: 'operatic-adventurer',
            name: 'Operatic Adventurer',
            skillRules: [{ skill: 'performance', value: 3 }],
          }],
        },
        15: {},
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 15);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.skills.performance.rank': 4,
    });
    expect(mockActor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(mockActor.updateEmbeddedDocuments).not.toHaveBeenCalled();
    expect(result).toEqual([
      { skill: 'performance', toRank: 4, featChoice: true },
    ]);
  });

  test('creates Gossip Lore from the planned Gossip Lore feat', async () => {
    mockActor = {
      system: { skills: { society: { rank: 1 } } },
      items: [],
      update: jest.fn(() => Promise.resolve()),
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
      updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    };

    const plan = {
      levels: {
        4: {
          skillFeats: [{
            slug: 'gossip-lore',
            name: 'Gossip Lore',
          }],
        },
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 4);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      name: 'Gossip Lore',
      type: 'lore',
      system: {
        proficient: { value: 1 },
      },
    }]);
    expect(result).toEqual([
      { skill: 'gossip-lore', toRank: 1, featChoice: true },
    ]);
  });

  test('creates Dueling Lore from Aldori Duelist Dedication', async () => {
    mockActor = {
      system: { skills: {} },
      items: [],
      update: jest.fn(() => Promise.resolve()),
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
      updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    };

    const plan = {
      levels: {
        2: {
          archetypeFeats: [{
            slug: 'aldori-duelist-dedication',
            name: 'Aldori Duelist Dedication',
          }],
        },
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 2);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      name: 'Dueling Lore',
      type: 'lore',
      system: {
        proficient: { value: 1 },
      },
    }]);
    expect(result).toEqual([
      { skill: 'dueling-lore', toRank: 1, featChoice: true },
    ]);
  });

  test('creates lore granted by a selected Free Heart background', async () => {
    mockActor = {
      system: { skills: {} },
      items: [],
      update: jest.fn(() => Promise.resolve()),
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
      updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    };

    const plan = {
      levels: {
        13: {
          ancestryFeats: [{
            slug: 'free-heart',
            name: 'Free Heart',
            dynamicLoreRules: [
              { skill: 'abadar-lore', value: 1, source: 'choice:levelerfreeheartbackground' },
            ],
          }],
        },
      },
    };

    const result = await applySkillIncreases(mockActor, plan, 13);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      name: 'Abadar Lore',
      type: 'lore',
      system: {
        proficient: { value: 1 },
      },
    }]);
    expect(result).toEqual([
      { skill: 'abadar-lore', toRank: 1, featChoice: true },
    ]);
  });

  test('creates expert Gossip Lore when Society is legendary', async () => {
    mockActor = {
      system: { skills: { society: { rank: 4 } } },
      items: [],
      update: jest.fn(() => Promise.resolve()),
      createEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
      updateEmbeddedDocuments: jest.fn(() => Promise.resolve([])),
    };

    const plan = {
      levels: {
        4: {
          skillFeats: [{
            slug: 'gossip-lore',
            name: 'Gossip Lore',
          }],
        },
      },
    };

    await applySkillIncreases(mockActor, plan, 4);

    expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [{
      name: 'Gossip Lore',
      type: 'lore',
      system: {
        proficient: { value: 2 },
      },
    }]);
  });
});
