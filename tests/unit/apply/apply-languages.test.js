import { applyLanguages } from '../../../scripts/apply/apply-languages.js';

describe('applyLanguages', () => {
  let mockActor;

  beforeEach(() => {
    mockActor = {
      system: {
        details: {
          languages: {
            value: ['common'],
          },
        },
      },
      update: jest.fn(() => Promise.resolve()),
    };
  });

  test('applies Intelligence bonus languages', async () => {
    const plan = {
      levels: { 5: { intBonusLanguages: ['draconic'] } },
    };
    const result = await applyLanguages(mockActor, plan, 5);
    expect(mockActor.update).toHaveBeenCalledWith({
      'system.details.languages.value': ['common', 'draconic'],
    });
    expect(result).toEqual(['draconic']);
  });

  test('applies languages selected from planned feat language choices', async () => {
    const plan = {
      levels: {
        4: {
          archetypeFeats: [{
            name: 'Settlement Scholastics',
            choices: {
              levelerLanguageChoice: 'draconic',
            },
          }],
        },
      },
    };

    const result = await applyLanguages(mockActor, plan, 4);

    expect(mockActor.update).toHaveBeenCalledWith({
      'system.details.languages.value': ['common', 'draconic'],
    });
    expect(result).toEqual(['draconic']);
  });

  test('returns empty when no bonus languages exist', async () => {
    const plan = { levels: { 5: { abilityBoosts: ['int'] } } };
    const result = await applyLanguages(mockActor, plan, 5);
    expect(mockActor.update).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
