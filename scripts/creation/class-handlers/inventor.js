import { BaseClassHandler } from './base.js';

export class InventorHandler extends BaseClassHandler {
  getExtraSteps() {
    return [
      {
        id: 'innovationDetails',
        label: 'Innovation Details',
        visible: (data) => ['weapon-innovation', 'armor-innovation'].includes(data.subclass?.slug),
      },
    ];
  }

  shouldShowSubclassChoices(_data) {
    return false;
  }

  isStepComplete(stepId, data) {
    if (stepId !== 'innovationDetails') return null;
    if (!['weapon-innovation', 'armor-innovation'].includes(data.subclass?.slug)) return true;
    return !!data.innovationItem && !!data.innovationModification;
  }

  async getStepContext(stepId, data, wizard) {
    if (stepId !== 'innovationDetails') return null;

    if (data.subclass?.slug === 'weapon-innovation') {
      const weapons = await wizard._loadInventorWeaponOptions();
      const modifications = await wizard._loadInventorWeaponModifications(data.innovationItem);
      return {
        innovationType: 'weapon',
        innovationItemLabel: 'Innovation Weapon',
        innovationModificationLabel: 'Initial Modification',
        innovationItems: weapons,
        innovationModifications: modifications,
      };
    }

    if (data.subclass?.slug === 'armor-innovation') {
      const armor = await wizard._loadInventorArmorOptions();
      const modifications = await wizard._loadInventorArmorModifications(data.innovationItem);
      return {
        innovationType: 'armor',
        innovationItemLabel: 'Innovation Armor',
        innovationModificationLabel: 'Initial Modification',
        innovationItems: armor,
        innovationModifications: modifications,
      };
    }

    return {
      innovationType: null,
      innovationItems: [],
      innovationModifications: [],
    };
  }
}
