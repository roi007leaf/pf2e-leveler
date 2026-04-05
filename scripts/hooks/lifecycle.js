import { MODULE_ID } from '../constants.js';
import { registerSettings } from '../settings.js';
import { migrateLegacyFeatCompendiumsSetting } from '../compendiums/catalog.js';
import { ClassRegistry } from '../classes/registry.js';
import { ALCHEMIST } from '../classes/alchemist.js';
import { ANIMIST } from '../classes/animist.js';
import { BARBARIAN } from '../classes/barbarian.js';
import { BARD } from '../classes/bard.js';
import { CHAMPION } from '../classes/champion.js';
import { CLERIC } from '../classes/cleric.js';
import { COMMANDER } from '../classes/commander.js';
import { DRUID } from '../classes/druid.js';
import { EXEMPLAR } from '../classes/exemplar.js';
import { FIGHTER } from '../classes/fighter.js';
import { GUARDIAN } from '../classes/guardian.js';
import { GUNSLINGER } from '../classes/gunslinger.js';
import { INVENTOR } from '../classes/inventor.js';
import { INVESTIGATOR } from '../classes/investigator.js';
import { KINETICIST } from '../classes/kineticist.js';
import { MAGUS } from '../classes/magus.js';
import { MONK } from '../classes/monk.js';
import { ORACLE } from '../classes/oracle.js';
import { PSYCHIC } from '../classes/psychic.js';
import { RANGER } from '../classes/ranger.js';
import { ROGUE } from '../classes/rogue.js';
import { SORCERER } from '../classes/sorcerer.js';
import { SUMMONER } from '../classes/summoner.js';
import { SWASHBUCKLER } from '../classes/swashbuckler.js';
import { THAUMATURGE } from '../classes/thaumaturge.js';
import { WITCH } from '../classes/witch.js';
import { WIZARD } from '../classes/wizard.js';
import { registerSheetIntegration } from '../ui/sheet-integration.js';
import { info } from '../utils/logger.js';

export function registerLifecycleHooks() {
  Hooks.once('init', onInit);
  Hooks.once('ready', onReady);
}

async function onInit() {
  info('Initializing module');

  registerSettings();
  await migrateLegacyFeatCompendiumsSetting();
  registerClasses();
  registerHandlebarsHelpers();
  await preloadTemplates();
}

function onReady() {
  info('Module ready');
  registerSheetIntegration();
}

function registerClasses() {
  [
    ALCHEMIST, ANIMIST, BARBARIAN, BARD, CHAMPION, CLERIC, COMMANDER, DRUID,
    EXEMPLAR, FIGHTER, GUARDIAN, GUNSLINGER, INVENTOR, INVESTIGATOR, KINETICIST,
    MAGUS, MONK, ORACLE, PSYCHIC, RANGER, ROGUE, SORCERER, SUMMONER,
    SWASHBUCKLER, THAUMATURGE, WITCH, WIZARD,
  ].forEach((cls) => ClassRegistry.register(cls));
  info(`Registered ${ClassRegistry.getAll().length} classes`);
}

export function registerHandlebarsHelpers() {
  registerHandlebarsHelper('eq', (a, b) => a === b);
  registerHandlebarsHelper('notEqual', (a, b) => a !== b);
  registerHandlebarsHelper('or', (...args) => {
    args.pop();
    return args.some(Boolean);
  });
  registerHandlebarsHelper('capitalize', (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  registerHandlebarsHelper('titleCase', (str) => {
    if (!str) return '';
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  });
  registerHandlebarsHelper('and', (...args) => {
    args.pop();
    return args.every(Boolean);
  });
  registerHandlebarsHelper('includes', (arr, val) => {
    return Array.isArray(arr) && arr.includes(val);
  });
  registerHandlebarsHelper('json', (obj) => {
    return JSON.stringify(obj ?? null);
  });
  registerHandlebarsHelper('signed', (num) => {
    return num >= 0 ? `+${num}` : `${num}`;
  });
  registerHandlebarsHelper('format', (key, options) => {
    return game.i18n.format(key, options.hash);
  });
}

function registerHandlebarsHelper(name, fn) {
  if (Handlebars.helpers?.[name]) return;
  Handlebars.registerHelper(name, fn);
}

async function preloadTemplates() {
  const partials = {
    featSlot: `modules/${MODULE_ID}/templates/partials/feat-slot.hbs`,
    boostSelector: `modules/${MODULE_ID}/templates/partials/boost-selector.hbs`,
    skillSelector: `modules/${MODULE_ID}/templates/partials/skill-selector.hbs`,
    prerequisiteTag: `modules/${MODULE_ID}/templates/partials/prerequisite-tag.hbs`,
    levelSidebarItem: `modules/${MODULE_ID}/templates/partials/level-sidebar-item.hbs`,
    levelDetail: `modules/${MODULE_ID}/templates/partials/level-detail.hbs`,
    alchemistPanel: `modules/${MODULE_ID}/templates/partials/alchemist-panel.hbs`,
    animistPanel: `modules/${MODULE_ID}/templates/partials/animist-panel.hbs`,
  };
  await foundry.applications.handlebars.loadTemplates(partials);
}
