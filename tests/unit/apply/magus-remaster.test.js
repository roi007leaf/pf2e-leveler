import { applySpells } from '../../../scripts/apply/apply-spells.js';
import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { MAGUS } from '../../../scripts/classes/magus.js';

function makeActor(remaster = true) {
  const entry = (id, name) => ({ id, type: 'spellcastingEntry', name, system: {
    tradition: { value: 'arcane' }, prepared: { value: 'prepared' }, ability: { value: 'int' },
    slots: { slot1: { max: 2, value: 1, prepared: { 0: { id: 'known-spell' } } } },
  } });
  return {
    items: [
      { type: 'class', slug: 'magus', system: { publication: { remaster } } },
      entry('studious', 'Magus Studious Spells'),
      entry('primary', 'My Arcane Spellbook'),
      { id: 'known-spell', type: 'spell', system: { location: { value: 'primary' } } },
    ],
    system: { details: { level: { value: 7 } }, resources: { focus: { max: 0, value: 0 } } },
    createEmbeddedDocuments: jest.fn(async (_type, docs) => docs.map((doc, i) => ({ ...doc, id: `new-${i}` }))),
    updateEmbeddedDocuments: jest.fn(async function (_type, updates) {
      for (const update of updates) {
        const item = this.items.find((candidate) => candidate.id === update._id);
        for (const [path, value] of Object.entries(update)) {
          if (path === '_id') continue;
          const parts = path.split('.');
          let target = item;
          for (const part of parts.slice(0, -1)) target = target[part] ??= {};
          target[parts.at(-1)] = value;
        }
      }
      return [];
    }),
    deleteEmbeddedDocuments: jest.fn(),
    update: jest.fn(async () => {}),
  };
}

beforeEach(() => {
  ClassRegistry.clear();
  ClassRegistry.register(MAGUS);
  global.fromUuid = jest.fn(async () => null);
});

test.each(Array.from({ length: 20 }, (_, i) => i + 1))('remastered Magus retains lower ranks at level %s without touching Studious or known spells', async (level) => {
  const actor = makeActor();
  const untouched = JSON.stringify(actor.items.filter((item) => item.id !== 'primary'));
  const prepared = JSON.stringify(actor.items[2].system.slots.slot1.prepared);
  await applySpells(actor, { classSlug: 'magus', levels: { [level]: {} } }, level);
  const updates = actor.updateEmbeddedDocuments.mock.calls.flatMap(([, docs]) => docs);
  expect(updates).toHaveLength(1);
  expect(updates[0]._id).toBe('primary');
  const highest = Math.min(9, Math.ceil(level / 2));
  for (let rank = 1; rank <= highest; rank++) {
    expect(updates[0][`system.slots.slot${rank}.max`]).toBe(rank === highest && level < 18 && level % 2 ? 1 : 2);
  }
  expect(Object.keys(updates[0]).some((key) => key.includes('prepared'))).toBe(false);
  expect(JSON.stringify(actor.items.filter((item) => item.id !== 'primary'))).toBe(untouched);
  expect(JSON.stringify(actor.items[2].system.slots.slot1.prepared)).toBe(prepared);
  expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  expect(actor.createEmbeddedDocuments.mock.calls.flatMap(([, docs]) => docs).filter((doc) => doc.type === 'spellcastingEntry')).toEqual([]);
});

test('remastered Studious selections go into the primary spellbook', async () => {
  const actor = makeActor();
  global.fromUuid = jest.fn(async (uuid) => uuid === 'planned-spell' ? {
    name: 'Gecko Grip', system: { traits: { value: [] } },
    toObject: () => ({ name: 'Gecko Grip', type: 'spell', system: {} }),
  } : null);
  await applySpells(actor, { classSlug: 'magus', levels: { 7: {
    spells: [{ uuid: 'planned-spell', rank: 2, entryType: 'studious' }],
  } } }, 7);
  expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
    name: 'Gecko Grip', system: expect.objectContaining({ location: { value: 'primary', heightenedLevel: 2 } }),
  })]);
});

test('remastered feature identifies Magus when class publication metadata is absent', async () => {
  const actor = makeActor();
  actor.items[0].system = {};
  actor.items.push({ type: 'feat', system: { slug: 'magus-spellcasting' } });
  await applySpells(actor, { classSlug: 'magus', levels: { 7: {} } }, 7);
  expect(actor.items[2].system.slots.slot1.max).toBe(2);
  expect(actor.updateEmbeddedDocuments.mock.calls[0][1]).toHaveLength(1);
});

test('legacy Magus updates distinct primary and Studious entries regardless of item order', async () => {
  const actor = makeActor(false);
  await applySpells(actor, { classSlug: 'magus', levels: { 7: {} } }, 7);
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [
    expect.objectContaining({ _id: 'primary', 'system.slots.slot1.max': 0, 'system.slots.slot4.max': 2 }),
    expect.objectContaining({ _id: 'studious', 'system.slots.slot2.max': 2 }),
  ]);
});

test('creation reuses remastered Magus entry and retains lower-rank slots', async () => {
  const actor = makeActor();
  await new CasterBaseHandler()._applySpellcasting(actor, {
    class: { slug: 'magus', name: 'Magus' }, spells: { cantrips: [], rank1: [] },
  });
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
  expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({
    _id: 'primary', 'system.slots.slot1.max': 2, 'system.slots.slot4.max': 1,
  })]);
  expect(actor.createEmbeddedDocuments.mock.calls.flatMap(([, docs]) => docs).filter((doc) => doc.type === 'spellcastingEntry')).toEqual([]);
});
