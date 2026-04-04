import { getAdditionalSelectedItems } from '../../../scripts/creation/apply-creation.js';

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
});
