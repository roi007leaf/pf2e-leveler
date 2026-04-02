import { ClassRegistry } from '../classes/registry.js';
import { debug, info, warn } from '../utils/logger.js';

export async function applyCreation(actor, data) {
  info(`Applying character creation for ${actor.name}`);

  if (data.ancestry) await applyItem(actor, data.ancestry, 'ancestry');
  if (data.heritage) await applyItem(actor, data.heritage, 'heritage');
  if (data.background) await applyItem(actor, data.background, 'background');
  if (data.class) await applyItem(actor, data.class, 'class');
  if (data.subclass) await applyItem(actor, data.subclass, 'subclass');

  await waitForSystem();
  await waitForSystem();
  await waitForSystem();

  await applyBoosts(actor, data);

  if (data.skills.length > 0) {
    const updates = {};
    for (const skill of data.skills) {
      updates[`system.skills.${skill}.rank`] = 1;
    }
    await actor.update(updates);
    debug(`Trained ${data.skills.length} skills`);
  }

  if (data.ancestryFeat) await applyFeat(actor, data.ancestryFeat, 'ancestry', 1);
  if (data.classFeat) await applyFeat(actor, data.classFeat, 'class', 1);

  await applySpellcasting(actor, data);

  await createCreationMessage(actor, data);

  info(`Character creation complete for ${actor.name}`);
}

async function applyItem(actor, entry, type) {
  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) {
    warn(`Failed to resolve ${type}: ${entry.uuid}`);
    return;
  }
  const itemData = foundry.utils.deepClone(item.toObject());
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied ${type}: ${entry.name}`);
}

async function applyFeat(actor, entry, group, level) {
  const item = await fromUuid(entry.uuid).catch(() => null);
  if (!item) return;
  const itemData = foundry.utils.deepClone(item.toObject());
  itemData.system.location = `${group}-${level}`;
  itemData.system.level = { ...itemData.system.level, taken: level };
  await actor.createEmbeddedDocuments('Item', [itemData]);
  debug(`Applied feat: ${entry.name} (${group}-${level})`);
}

async function applyBoosts(actor, data) {
  const ancestryBoosts = data.boosts.ancestry ?? [];
  const backgroundBoosts = data.boosts.background ?? [];
  const classBoosts = data.boosts.class ?? [];
  const freeBoosts = data.boosts.free ?? [];

  const ancestry = actor.ancestry;
  if (ancestry && data.alternateAncestryBoosts) {
    await ancestry.update({ 'system.alternateAncestryBoosts': ancestryBoosts });
  } else if (ancestry && ancestryBoosts.length) {
    const boostSlots = ancestry.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < ancestryBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = ancestryBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await ancestry.update(update);
    }
  }

  const background = actor.items?.find((i) => i.type === 'background');
  if (background && backgroundBoosts.length) {
    const boostSlots = background.system?.boosts ?? {};
    const update = {};
    let boostIdx = 0;
    for (const [slotKey, slot] of Object.entries(boostSlots)) {
      const vals = slot.value ?? [];
      if (vals.length === 1) continue;
      if (boostIdx < backgroundBoosts.length) {
        update[`system.boosts.${slotKey}.selected`] = backgroundBoosts[boostIdx];
        boostIdx++;
      }
    }
    if (Object.keys(update).length) {
      await background.update(update);
    }
  }

  const classItem = actor.class;
  if (classItem && classBoosts.length) {
    await classItem.update({ 'system.keyAbility.selected': classBoosts[0] });
  }

  if (freeBoosts.length) {
    const buildSource = foundry.utils.mergeObject(actor.toObject().system.build ?? {}, { attributes: { boosts: {} } });
    buildSource.attributes.boosts[1] = freeBoosts;
    await actor.update({ 'system.build': buildSource });
  }
}

async function applySpellcasting(actor, data) {
  const grantedUuids = [];
  const granted = data.subclass?.grantedSpells;
  if (granted?.cantrip) grantedUuids.push(granted.cantrip);
  if (granted?.rank1) grantedUuids.push(granted.rank1);

  const curriculum = data.subclass?.curriculum;
  if (curriculum) {
    for (const uuid of (curriculum[0] ?? [])) {
      if (!grantedUuids.includes(uuid)) grantedUuids.push(uuid);
    }
    for (const uuid of (curriculum[1] ?? [])) {
      if (!grantedUuids.includes(uuid)) grantedUuids.push(uuid);
    }
  }

  const grantedEntries = grantedUuids.map((uuid) => ({ uuid, name: 'Granted' }));

  const allSpells = [...grantedEntries, ...data.spells.cantrips, ...data.spells.rank1];

  const classDef = data.class?.slug ? ClassRegistry.get(data.class.slug) : null;
  if (allSpells.length === 0 && !classDef?.spellcasting) return;

  await waitForSystem();

  let entry = actor.items?.find((i) => i.type === 'spellcastingEntry');

  if (entry && data.subclass?.tradition) {
    await entry.update({ 'system.tradition.value': data.subclass.tradition });
  }

  if (!entry && data.class?.slug) {
    const classDef = ClassRegistry.get(data.class.slug);
    if (classDef?.spellcasting) {
      const sc = classDef.spellcasting;
      const tradition = resolveCreationTradition(sc.tradition, data.subclass);
      const ability = classDef.keyAbility.length === 1 ? classDef.keyAbility[0] : 'cha';
      const created = await actor.createEmbeddedDocuments('Item', [{
        name: `${capitalize(data.class.name)} Spells`,
        type: 'spellcastingEntry',
        system: {
          tradition: { value: tradition },
          prepared: { value: sc.type === 'dual' ? 'prepared' : sc.type },
          ability: { value: ability },
          proficiency: { value: 1 },
        },
      }]);
      entry = created[0];
      debug(`Created spellcasting entry: ${data.class.name} Spells`);
    }
  }

  if (!entry) {
    debug('No spellcasting entry found, skipping spell application');
    return;
  }

  if (data.class?.slug) {
    const classDef = ClassRegistry.get(data.class.slug);
    const level1Slots = classDef?.spellcasting?.slots?.[1];
    if (level1Slots) {
      const slotUpdate = { _id: entry.id };
      for (const [rank, counts] of Object.entries(level1Slots)) {
        const max = Array.isArray(counts) ? counts[0] + counts[1] : counts;
        if (rank === 'cantrips') {
          slotUpdate['system.slots.slot0.max'] = max;
          slotUpdate['system.slots.slot0.value'] = max;
        } else {
          slotUpdate[`system.slots.slot${rank}.max`] = max;
          slotUpdate[`system.slots.slot${rank}.value`] = max;
        }
      }
      await actor.updateEmbeddedDocuments('Item', [slotUpdate]);
    }
  }

  for (const spellEntry of allSpells) {
    const spell = await fromUuid(spellEntry.uuid).catch(() => null);
    if (!spell) continue;
    const spellData = foundry.utils.deepClone(spell.toObject());
    spellData.system.location = { value: entry.id };
    await actor.createEmbeddedDocuments('Item', [spellData]);
    debug(`Added spell: ${spellEntry.name}`);
  }
}

function resolveCreationTradition(tradition, subclass) {
  if (['bloodline', 'patron'].includes(tradition)) {
    return subclass?.tradition ?? 'arcane';
  }
  return tradition;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function waitForSystem() {
  return new Promise((resolve) => setTimeout(resolve, 200));
}

async function createCreationMessage(actor, data) {
  const parts = [];
  if (data.ancestry) parts.push(`**Ancestry:** ${data.ancestry.name}`);
  if (data.heritage) parts.push(`**Heritage:** ${data.heritage.name}`);
  if (data.background) parts.push(`**Background:** ${data.background.name}`);
  if (data.class) parts.push(`**Class:** ${data.class.name}`);
  if (data.subclass) parts.push(`**Subclass:** ${data.subclass.name}`);
  if (data.ancestryFeat) parts.push(`**Ancestry Feat:** ${data.ancestryFeat.name}`);
  if (data.classFeat) parts.push(`**Class Feat:** ${data.classFeat.name}`);

  const content = `<h2>${actor.name} has been created!</h2><p>${parts.join('<br>')}</p>`;
  const whisper = [];
  for (const user of game.users) {
    if (user.isGM || actor.testUserPermission(user, 'OWNER')) whisper.push(user.id);
  }
  await ChatMessage.create({ content, speaker: { alias: actor.name }, whisper });
}
