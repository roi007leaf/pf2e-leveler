import { debug, warn } from '../utils/logger.js';

const CATEGORY_TO_GROUP = {
  classFeats: 'class',
  skillFeats: 'skill',
  generalFeats: 'general',
  ancestryFeats: 'ancestry',
  archetypeFeats: 'archetype',
  mythicFeats: 'mythic',
};

const FEAT_KEYS = Object.keys(CATEGORY_TO_GROUP);

export async function applyFeats(actor, plan, level) {
  const levelData = plan.levels[level];
  if (!levelData) return [];

  const itemsToCreate = [];

  for (const key of FEAT_KEYS) {
    const feats = levelData[key];
    if (!feats?.length) continue;

    const group = CATEGORY_TO_GROUP[key];
    for (const featEntry of feats) {
      const item = await resolveFeat(featEntry.uuid);
      if (!item) continue;

      const featData = prepareForCreation(item, group, level);
      itemsToCreate.push(featData);
    }
  }

  if (itemsToCreate.length === 0) return [];

  const created = await actor.createEmbeddedDocuments('Item', itemsToCreate);
  debug(`Applied ${created.length} feats at level ${level}`);
  return created;
}

async function resolveFeat(uuid) {
  try {
    return await fromUuid(uuid);
  } catch (err) {
    warn(`Failed to resolve feat UUID: ${uuid}`);
    return null;
  }
}

function prepareForCreation(item, group, level) {
  const data = foundry.utils.deepClone(item.toObject());
  data.system.location = `${group}-${level}`;
  data.system.level = { ...data.system.level, taken: level };
  return data;
}
