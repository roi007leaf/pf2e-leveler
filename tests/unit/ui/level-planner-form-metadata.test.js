import { LevelPlanner } from '../../../scripts/ui/level-planner/index.js';
import { FeatPicker } from '../../../scripts/ui/feat-picker.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { BARD } from '../../../scripts/classes/bard.js';
import { createPlan } from '../../../scripts/plan/plan-model.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';

const source = {
  uuid: 'Compendium.pf2e.feats-srd.Item.myriad-forms',
  name: 'Myriad Forms', slug: 'myriad-forms', type: 'feat',
  system: {
    level: { value: 5 }, traits: { value: ['kitsune'] },
    rules: [{ key: 'RollOption', domain: 'all', option: 'change-shape',
      toggleable: true, value: false, predicate: [{ gte: ['self:level', 5] }],
      suboptions: [{ label: 'Fox', value: 'fox', predicate: [{ gte: ['self:level', 5] }] }],
    }],
  },
};

function createPlanner() {
  const actor = createMockActor();
  actor.items = [];
  actor.getFlag = jest.fn(() => null);
  actor.setFlag = jest.fn(async () => {});
  const planner = new LevelPlanner(actor);
  planner.plan = createPlan('bard');
  planner.selectedLevel = 5;
  planner._savePlanAndRender = jest.fn();
  return planner;
}

beforeEach(() => {
  ClassRegistry.register(BARD);
  global.fromUuid = jest.fn(async (uuid) => uuid === source.uuid ? source : null);
});

test('ancestry feat picker preserves planned fox-form capability through plan serialization', async () => {
  const planner = createPlanner();
  let picker;
  const renderSpy = jest.spyOn(FeatPicker.prototype, 'render').mockImplementation(function render() { picker = this; });
  try {
    await planner._openFeatPicker('ancestryFeats', 5);
    await picker.onSelect(source);
    planner.plan = JSON.parse(JSON.stringify(planner.plan));
    const stored = planner.plan.levels[5].ancestryFeats[0];
    expect(stored.system?.rules).toEqual(source.system.rules);
    expect(computeBuildState(planner.actor, planner.plan, 4).feats.has('fox-alternate-form')).toBe(false);
    expect(computeBuildState(planner.actor, planner.plan, 5).feats.has('fox-alternate-form')).toBe(true);
  } finally {
    renderSpy.mockRestore();
  }
});

test('backfills fox rules into existing version-one planned feat metadata', async () => {
  const planner = createPlanner();
  planner.plan.levels[5].ancestryFeats = [{
    uuid: source.uuid, name: source.name, slug: source.slug, coreMetadataVersion: 1,
  }];
  await planner._backfillFeatCoreMetadata();
  expect(computeBuildState(planner.actor, planner.plan, 5).feats.has('fox-alternate-form')).toBe(true);
});

test('stored feat metadata retains existing language-rule projection and skips unrelated rules', async () => {
  const planner = createPlanner();
  const languageRule = { key: 'ActiveEffectLike', path: 'system.build.languages.max', mode: 'add', value: 1 };
  const feat = await planner._buildStoredFeatEntry({
    ...source,
    system: { ...source.system, rules: [
      ...source.system.rules, languageRule,
      { key: 'RollOption', domain: 'all', option: 'other-feature' },
    ] },
  });
  expect(feat.system.rules).toEqual([...source.system.rules, languageRule]);
  expect(feat.system.rules[0]).not.toBe(source.system.rules[0]);
});
