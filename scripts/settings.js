import { MODULE_ID } from './constants.js';
import { CompendiumSettingsMenu, PlayerCompendiumAccessMenu } from './ui/compendium-settings-menu.js';
import { ContentGuidanceMenu } from './ui/content-guidance-menu.js';
import { invalidateCache } from './feats/feat-cache.js';
import { invalidateGuidanceCache } from './access/content-guidance.js';
import { invalidateItemCache } from './ui/item-picker.js';
import { clearSpellPickerCache } from './ui/spell-picker.js';

function invalidateContentPickers() {
  invalidateCache();
  invalidateItemCache();
  clearSpellPickerCache();
}

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

  game.settings.register(MODULE_ID, 'ignoreFreeArchetypeDedicationLock', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.IGNORE_FREE_ARCHETYPE_DEDICATION_LOCK.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.IGNORE_FREE_ARCHETYPE_DEDICATION_LOCK.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'enforceSubclassDedicationRequirement', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.ENFORCE_SUBCLASS_DEDICATION_REQUIREMENT.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.ENFORCE_SUBCLASS_DEDICATION_REQUIREMENT.HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
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

  game.settings.register(MODULE_ID, 'playerAllowUncommon', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.UNCOMMON_NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.UNCOMMON_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => invalidateContentPickers(),
  });

  game.settings.register(MODULE_ID, 'playerAllowRare', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.RARE_NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.RARE_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => invalidateContentPickers(),
  });

  game.settings.register(MODULE_ID, 'playerAllowUnique', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.UNIQUE_NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_RARITY.UNIQUE_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => invalidateContentPickers(),
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

  game.settings.register(MODULE_ID, 'startingWealthMode', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.MODE_NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.MODE_HINT'),
    scope: 'world',
    config: true,
    type: String,
    default: 'DISABLED',
    choices: {
      DISABLED: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.DISABLED'),
      ITEMS_AND_CURRENCY: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.ITEMS_AND_CURRENCY'),
      LUMP_SUM: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.LUMP_SUM'),
      CUSTOM: game.i18n.localize('PF2E_LEVELER.SETTINGS.STARTING_WEALTH.CUSTOM'),
    },
  });

  game.settings.register(MODULE_ID, 'startingEquipmentGoldLimit', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.EQUIPMENT_GOLD_LIMIT.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.EQUIPMENT_GOLD_LIMIT.HINT'),
    scope: 'world',
    config: true,
    type: Number,
    default: 0,
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

  game.settings.registerMenu(MODULE_ID, 'playerCompendiumAccessMenu', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.NAME'),
    label: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.LABEL'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.HINT'),
    icon: 'fas fa-user-shield',
    type: PlayerCompendiumAccessMenu,
    restricted: true,
  });

  game.settings.register(MODULE_ID, 'restrictPlayerCompendiumAccess', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.ENABLED_NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.ENABLED_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    onChange: () => invalidateContentPickers(),
  });

  game.settings.register(MODULE_ID, 'customCompendiums', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.COMPENDIUM_MANAGER.HINT'),
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => invalidateContentPickers(),
  });

  game.settings.register(MODULE_ID, 'playerCompendiumAccess', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.NAME'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.PLAYER_COMPENDIUM_ACCESS.HINT'),
    scope: 'world',
    config: false,
    type: Object,
    default: { enabled: false, selections: {} },
    onChange: () => invalidateContentPickers(),
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

  game.settings.registerMenu(MODULE_ID, 'contentGuidanceMenu', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.NAME'),
    label: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.LABEL'),
    hint: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.HINT'),
    icon: 'fas fa-star',
    type: ContentGuidanceMenu,
    restricted: true,
  });

  game.settings.register(MODULE_ID, 'gmContentGuidance', {
    name: game.i18n.localize('PF2E_LEVELER.SETTINGS.CONTENT_GUIDANCE.NAME'),
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => invalidateGuidanceCache(),
  });
}

export async function migrateWealthSettings() {
  if (!game.user.isGM) return;
  const mode = game.settings.get(MODULE_ID, 'startingWealthMode');
  if (mode !== 'DISABLED') return;
  const goldLimit = game.settings.get(MODULE_ID, 'startingEquipmentGoldLimit');
  if (goldLimit > 0) {
    await game.settings.set(MODULE_ID, 'startingWealthMode', 'CUSTOM');
  }
}
