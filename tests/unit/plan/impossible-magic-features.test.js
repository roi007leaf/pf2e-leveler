import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { MAGUS } from '../../../scripts/classes/magus.js';
import { NECROMANCER } from '../../../scripts/classes/necromancer.js';
import { RUNESMITH } from '../../../scripts/classes/runesmith.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { createCreationData, setClass, setDualClass } from '../../../scripts/creation/creation-model.js';
import { getClassFeaturesForLevel } from '../../../scripts/ui/level-planner/level-context.js';

beforeEach(() => {
  ClassRegistry.clear();
  for (const classDef of [MAGUS, NECROMANCER, RUNESMITH]) ClassRegistry.register(classDef);
});

function actorFor(slug, remaster = true) {
  return { items: [{ type: 'class', slug, system: { publication: { remaster } } }],
    system: { saves: { fortitude: { rank: 2 }, will: { rank: 2 }, reflex: { rank: 1 } } } };
}

test.each(['necromancer', 'runesmith'])('%s gains master Fortitude at level 11 in future planning', (slug) => {
  const actor = actorFor(slug);
  const plan = { classSlug: slug, levels: {} };
  expect(computeBuildState(actor, plan, 10).proficiencies.fortitude).toBe(2);
  expect(computeBuildState(actor, plan, 11).proficiencies.fortitude).toBe(3);
  expect(actor.system.saves.fortitude.rank).toBe(2);
});

test('remastered Magus projects current feature names and save ranks at their proper levels', () => {
  const actor = actorFor('magus');
  const plan = { classSlug: 'magus', levels: {} };
  for (const [level, key, oldKey, proficiency, rank] of [
    [5, 'reflex-expertise', 'lightning-reflexes', 'reflex', 2],
    [9, 'perception-expertise', 'alertness', 'perception', 2],
    [9, 'twofold-will', 'resolve', 'will', 3],
    [15, 'spell-tempered-body', 'juggernaut', 'fortitude', 3],
  ]) {
    expect(computeBuildState(actor, plan, level - 1).classFeatures.has(key)).toBe(false);
    const state = computeBuildState(actor, plan, level);
    expect(state.classFeatures.has(key)).toBe(true);
    expect(state.classFeatures.has(oldKey)).toBe(false);
    expect(state.proficiencies[proficiency]).toBe(rank);
  }
  expect(ClassRegistry.get('magus', actorFor('magus', false)).classFeatures).toEqual(MAGUS.classFeatures);
});

test.each([true, false])('Magus creation keeps class edition for primary and secondary spellbooks (remaster=%s)', (remaster) => {
  const data = createCreationData();
  const item = { slug: 'magus', name: 'Magus', uuid: 'class-magus', system: { publication: { remaster } } };
  setClass(data, item);
  setDualClass(data, item);
  const handler = new CasterBaseHandler();
  for (const selectedClass of [data.class, data.dualClass]) {
    const counts = handler.getSpellbookCounts({ class: selectedClass }, MAGUS);
    expect(counts).toEqual({ cantrips: 8, rank1: remaster ? 5 : 4 });
    expect(handler.isSpellsComplete({ spells: { cantrips: Array(8).fill({}), rank1: Array(4).fill({}) } }, counts.cantrips, counts.rank1)).toBe(!remaster);
  }
});

test('dual-class planner displays remastered Magus feature names', () => {
  const actor = actorFor('magus');
  actor.class = { slug: 'fighter', system: { items: {} } };
  const features = getClassFeaturesForLevel({ actor, plan: { classSlug: 'fighter', dualClassSlug: 'magus' } }, 9);
  expect(features.map((feature) => feature.name)).toEqual(['Perception Expertise', 'Expert Spellcaster', 'Twofold Will']);
});
