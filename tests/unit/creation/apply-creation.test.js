import { getAdditionalSelectedItems } from '../../../scripts/creation/apply-creation.js';

describe('getAdditionalSelectedItems', () => {
  it('collects dedicated class selections and subclass choice UUIDs', () => {
    const items = getAdditionalSelectedItems({
      implement: { uuid: 'implement-uuid', name: 'Amulet' },
      tactics: [{ uuid: 'tactic-uuid', name: 'Raise Morale' }],
      ikons: [{ uuid: 'ikon-uuid', name: 'Gleaming Blade' }],
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

    expect(items.map((entry) => entry.uuid)).toEqual([
      'implement-uuid',
      'tactic-uuid',
      'ikon-uuid',
      'weapon-uuid',
      'mod-uuid',
      'metal-uuid',
      'impulse-uuid',
      'sub-uuid',
      'thesis-uuid',
      'app-uuid',
      'dedication-uuid',
    ]);
  });

  it('deduplicates overlapping subclass choice items', () => {
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

    expect(items).toHaveLength(1);
    expect(items[0].uuid).toBe('shared-uuid');
  });

  it('accepts direct compendium UUID subclass choices', () => {
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

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.tremor',
        _type: 'subclass choice (impulseOne)',
      }),
    ]);
  });

  it('collects selected feat choice UUIDs', () => {
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

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.feats-srd.Item.reactive-shield',
        _type: 'feat choice (grantedClassFeat)',
      }),
    ]);
  });

  it('collects selected granted feat choice UUIDs', () => {
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

    expect(items).toEqual([
      expect.objectContaining({
        uuid: 'Compendium.pf2e.ancestries.Item.android',
        _type: 'granted feat choice (ancestry)',
      }),
    ]);
  });
});
