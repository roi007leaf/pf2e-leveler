import { MODULE_ID } from './constants.js';
import { CompendiumSettingsMenu } from './ui/compendium-settings-menu.js';
import { invalidateCache } from './feats/feat-cache.js';

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

  game.settings.register(MODULE_ID, 'enforcePrerequisites', {
    name: 'Enforce Feat Prerequisites',
    hint: 'Block selecting feats with unmet prerequisites in planner feat pickers. When disabled, prerequisite results are still shown but selection is allowed.',
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

  game.settings.register(MODULE_ID, 'hideRareFeats', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.HIDE_RARE.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.HIDE_RARE.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
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

  game.settings.register(MODULE_ID, 'ancestralParagon', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.ANCESTRAL_PARAGON.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.ANCESTRAL_PARAGON.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  game.settings.registerMenu(MODULE_ID, 'customCompendiumsMenu', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NAME'),
    label: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.LABEL'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.HINT'),
    icon: 'fas fa-atlas',
    type: CompendiumSettingsMenu,
    restricted: true,
  });

  game.settings.register(MODULE_ID, 'customCompendiums', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.HINT'),
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => invalidateCache(),
  });

  game.settings.register(MODULE_ID, 'additionalFeatCompendiums', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.ADDITIONAL_COMPENDIUMS.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.ADDITIONAL_COMPENDIUMS.HINT'),
    scope: 'world',
    config: false,
    type: String,
    default: '',
    requiresReload: true,
  });
}
