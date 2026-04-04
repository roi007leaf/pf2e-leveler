import { BaseClassHandler } from './base.js';
import { AnimistHandler } from './animist.js';
import { CasterBaseHandler } from './caster-base.js';
import { BardHandler } from './bard.js';
import { ChampionHandler } from './champion.js';
import { ClericHandler } from './cleric.js';
import { CommanderHandler } from './commander.js';
import { PsychicHandler } from './psychic.js';
import { RogueHandler } from './rogue.js';
import { SummonerHandler } from './summoner.js';
import { ThaumaturgeHandler } from './thaumaturge.js';
import { ExemplarHandler } from './exemplar.js';
import { InventorHandler } from './inventor.js';
import { KineticistHandler } from './kineticist.js';
import { WizardHandler } from './wizard.js';
import { WitchHandler } from './witch.js';

const caster = new CasterBaseHandler();
const defaultHandler = new BaseClassHandler();

const handlers = {
  bard: new BardHandler(),
  animist: new AnimistHandler(),
  champion: new ChampionHandler(),
  cleric: new ClericHandler(),
  commander: new CommanderHandler(),
  exemplar: new ExemplarHandler(),
  inventor: new InventorHandler(),
  kineticist: new KineticistHandler(),
  summoner: new SummonerHandler(),
  wizard: new WizardHandler(),
  witch: new WitchHandler(),
  sorcerer: caster,
  oracle: caster,
  druid: caster,
  magus: caster,
  psychic: new PsychicHandler(),
  rogue: new RogueHandler(),
  thaumaturge: new ThaumaturgeHandler(),
};

/**
 * Get the class handler for a given class slug.
 * @param {string} classSlug
 * @returns {BaseClassHandler}
 */
export function getClassHandler(classSlug) {
  return handlers[classSlug] ?? defaultHandler;
}
