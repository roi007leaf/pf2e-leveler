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

export function exportCreationData(data) {
  return JSON.stringify({
    format: 'pf2e-leveler-creation',
    version: data?.version ?? 1,
    data,
  }, null, 2);
}

export function importCreationData(jsonString) {
  const parsed = JSON.parse(jsonString);
  const payload = parsed?.format === 'pf2e-leveler-creation' ? parsed.data : parsed;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid creation format');
  }

  if (!payload.version || typeof payload.version !== 'number') {
    throw new Error('Invalid creation format');
  }

  return normalizeCreationImport(payload);
}

function normalizeCreationImport(payload) {
  const normalized = foundry.utils.deepClone(payload);

  normalized.boosts ??= { free: [] };
  normalized.boosts.free ??= [];
  normalized.languages ??= [];
  normalized.lores ??= [];
  normalized.skills ??= [];
  normalized.tactics ??= [];
  normalized.ikons ??= [];
  normalized.kineticImpulses ??= [];
  normalized.apparitions ??= [];
  normalized.grantedFeatSections ??= [];
  normalized.grantedFeatChoices ??= {};
  normalized.spells ??= { cantrips: [], rank1: [] };
  normalized.spells.cantrips ??= [];
  normalized.spells.rank1 ??= [];
  normalized.curriculumSpells ??= { cantrips: [], rank1: [] };
  normalized.curriculumSpells.cantrips ??= [];
  normalized.curriculumSpells.rank1 ??= [];
  normalized.alternateAncestryBoosts ??= false;
  normalized.equipment ??= [];
  normalized.permanentItems ??= [];

  return normalized;
}
