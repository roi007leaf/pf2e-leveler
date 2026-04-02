import { MODULE_ID } from '../constants.js';

const CREATION_FLAG = 'creation';

export function getCreationData(actor) {
  return actor.getFlag(MODULE_ID, CREATION_FLAG) ?? null;
}

export async function saveCreationData(actor, data) {
  await actor.setFlag(MODULE_ID, CREATION_FLAG, data);
}

export async function clearCreationData(actor) {
  await actor.unsetFlag(MODULE_ID, CREATION_FLAG);
}
