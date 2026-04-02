import { MODULE_ID } from './constants.js';

export function registerSettings() {
  game.settings.register(MODULE_ID, 'showPlanButton', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.SHOW_BUTTON.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.SHOW_BUTTON.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  game.settings.register(MODULE_ID, 'autoApplyOnLevelUp', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.AUTO_APPLY.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.AUTO_APPLY.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'showPrerequisites', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.SHOW_PREREQUISITES.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.SHOW_PREREQUISITES.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'hideUncommonFeats', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.HIDE_UNCOMMON.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.HIDE_UNCOMMON.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'featSortMethod', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.HINT'),
    scope: 'client',
    config: true,
    type: String,
    default: 'LEVEL_DESC',
    choices: {
      LEVEL_DESC: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.LEVEL_DESC'),
      LEVEL_ASC: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.LEVEL_ASC'),
      ALPHA_ASC: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.ALPHA_ASC'),
      ALPHA_DESC: game.i18n.localize('PF2E_LEVELER.SETTINGS.FEAT_SORT.ALPHA_DESC'),
    },
  });

  game.settings.register(MODULE_ID, 'additionalFeatCompendiums', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.ADDITIONAL_COMPENDIUMS.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.ADDITIONAL_COMPENDIUMS.HINT'),
    scope: 'world',
    config: true,
    type: String,
    default: '',
    requiresReload: true,
  });
}
