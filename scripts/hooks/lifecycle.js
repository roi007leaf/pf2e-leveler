import { registerSettings, migrateWealthSettings } from '../settings.js';
import { migrateLegacyFeatCompendiumsSetting } from '../compendiums/catalog.js';
import { ClassRegistry } from '../classes/registry.js';
import { ensureClassRegistry } from '../classes/ensure.js';
import { registerSheetIntegration } from '../ui/sheet-integration.js';
import { ensureLevelerTemplatesLoaded } from '../ui/template-preload.js';
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
  await ensureLevelerTemplatesLoaded();
}

async function onReady() {
  info('Module ready');
  await migrateWealthSettings();
  registerSheetIntegration();
}

function registerClasses() {
  ensureClassRegistry();
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

