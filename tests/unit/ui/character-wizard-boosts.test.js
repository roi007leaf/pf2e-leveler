import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';

jest.mock('../../../scripts/creation/creation-store.js', () => ({
  getCreationData: jest.fn(() => null),
  saveCreationData: jest.fn(),
  clearCreationData: jest.fn(),
}));

jest.mock('../../../scripts/creation/apply-creation.js', () => ({
  applyCreation: jest.fn(),
}));

jest.mock('../../../scripts/utils/i18n.js', () => ({
  localize: jest.fn((key) => key),
}));

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: {
    get: jest.fn((slug) => ({
      keyAbility: ['ranger', 'monk'].includes(slug) ? ['str', 'dex'] : ['str'],
    })),
  },
}));

describe('CharacterWizard boosts completion', () => {
  it('does not mark boosts complete when only the four free boosts are selected', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-uuid', name: 'Human' };
    wizard.data.background = { uuid: 'background-uuid', name: 'Scholar' };
    wizard.data.class = { uuid: 'class-uuid', slug: 'fighter', name: 'Fighter' };
    wizard.data.boosts = {
      ancestry: [],
      background: [],
      class: ['str'],
      free: ['dex', 'con', 'wis', 'cha'],
    };

    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid === 'ancestry-uuid') {
        return {
          name: 'Human',
          system: {
            boosts: {
              0: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
              1: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
            },
            flaws: {},
          },
        };
      }

      if (uuid === 'background-uuid') {
        return {
          name: 'Scholar',
          system: {
            boosts: {
              0: { value: ['int'] },
              1: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
            },
          },
        };
      }

      return null;
    });

    await wizard._prepareContext();

    expect(wizard._isStepComplete('boosts')).toBe(false);
  });

  it('requires one independent key ability boost selection from each dual class', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.class = { uuid: 'ranger-class-uuid', slug: 'ranger', name: 'Ranger' };
    wizard.data.dualClass = { uuid: 'monk-class-uuid', slug: 'monk', name: 'Monk' };
    wizard.data.boosts = {
      ancestry: [],
      background: [],
      class: ['str'],
      dualClass: [],
      free: ['con', 'int', 'wis', 'cha'],
    };

    const context = await wizard._buildBoostContext();
    const classRows = context.boostRows.filter((row) => ['class', 'dualClass'].includes(row.source));

    expect(classRows).toEqual([
      expect.objectContaining({
        source: 'class',
        label: 'Ranger',
        freeCount: 1,
        options: ['str', 'dex'],
        selected: ['str'],
        complete: true,
      }),
      expect.objectContaining({
        source: 'dualClass',
        label: 'Monk',
        freeCount: 1,
        options: ['str', 'dex'],
        selected: [],
        complete: false,
      }),
    ]);
    expect(wizard._cachedBoostStepComplete).toBe(false);
    wizard._cachedBoostStepComplete = null;
    expect(wizard._isStepComplete('boosts')).toBe(false);
  });

  it('keeps flawed ancestry abilities selectable when they are part of a boost choice', async () => {
    const wizard = new CharacterWizard(createMockActor());
    wizard.data.ancestry = { uuid: 'ancestry-uuid', name: 'Merfolk' };
    wizard.data.boosts = {
      ancestry: [],
      background: [],
      class: [],
      free: [],
    };

    wizard._getCachedDocument = jest.fn(async (uuid) => {
      if (uuid !== 'ancestry-uuid') return null;

      return {
        name: 'Merfolk',
        system: {
          boosts: {
            0: { value: ['dex'] },
            1: { value: ['cha'] },
            2: { value: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
          },
          flaws: {
            0: { value: ['con'] },
          },
        },
      };
    });

    const context = await wizard._buildBoostContext();
    const ancestryRow = context.boostRows.find((row) => row.source === 'ancestry');
    const conCell = ancestryRow.cells.find((cell) => cell.key === 'con');

    expect(conCell).toMatchObject({
      key: 'con',
      type: 'option',
      hasFlaw: true,
      source: 'ancestry',
      selected: false,
      locked: false,
    });

    wizard._saveAndRender = jest.fn();
    wizard._toggleBoost('con', 'ancestry');

    expect(wizard.data.boosts.ancestry).toEqual(['con']);

    const selectedContext = await wizard._buildBoostContext();
    const conTotal = selectedContext.summary.find((cell) => cell.key === 'con');

    expect(conTotal.mod).toBe(0);
  });
});
