import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { BARD } from '../../../scripts/classes/bard.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import { createPlan, setLevelFeat } from '../../../scripts/plan/plan-model.js';
import { checkPrerequisites } from '../../../scripts/prerequisites/prerequisite-checker.js';

const ENIGMA_UUID = 'Compendium.pf2e.classfeatures.Item.enigma';
const MAESTRO_UUID = 'Compendium.pf2e.classfeatures.Item.maestro';

function buildState(feat, { owned = false } = {}) {
  const actor = createMockActor();
  actor.items = owned ? [{ type: 'feat', ...feat }] : [];
  const plan = createPlan('bard');
  if (!owned) setLevelFeat(plan, 2, 'classFeats', feat);
  return computeBuildState(actor, plan, 2);
}

function assertEnigmaAccess(state) {
  expect(checkPrerequisites({
    name: 'Bardic Lore',
    system: { prerequisites: { value: [{ value: 'enigma muse' }] } },
  }, state).met).toBe(true);
  expect(state.feats.has('enigma-muse')).toBe(true);
  expect(state.feats.has('maestro-muse')).toBe(false);
}

beforeEach(() => {
  ClassRegistry.register(BARD);
  global.fromUuidSync.mockReset();
});

test.each(['choiceSets', 'grantChoiceSets'])('same-level muse uses selected %s option metadata', (key) => {
  assertEnigmaAccess(buildState({
    name: 'Multifarious Muse', slug: 'multifarious-muse',
    choices: { muse: ENIGMA_UUID, feat: 'maestro' },
    [key]: [{ flag: 'muse', options: [
      { value: ENIGMA_UUID, slug: 'enigma', label: 'Enigma', type: 'feat' },
      { value: MAESTRO_UUID, slug: 'maestro', label: 'Maestro', type: 'feat' },
    ] }],
  }));
});

test.each([false, true])('UUID muse resolves cached document when choice metadata absent (owned=%s)', (owned) => {
  global.fromUuidSync.mockImplementation((uuid) => uuid === ENIGMA_UUID
    ? { name: 'Enigma', system: { slug: 'enigma' } } : null);
  assertEnigmaAccess(buildState({
    name: 'Multifarious Muse', slug: 'multifarious-muse',
    ...(owned ? { flags: { system: { rulesSelections: { muse: ENIGMA_UUID } } } }
      : { choices: { muse: ENIGMA_UUID } }),
  }, { owned }));
});

test.each(['choices', 'pf2e', 'system'])('preserves legacy slug choice in %s', (storage) => {
  const selections = { muse: 'enigma', feat: 'maestro' };
  assertEnigmaAccess(buildState({
    name: 'Multifarious Muse', slug: 'multifarious-muse',
    ...(storage === 'choices' ? { choices: selections }
      : { flags: { [storage]: { rulesSelections: selections } } }),
  }));
});

test('unresolved UUID grants no fabricated muse alias and tolerates unavailable compendium', () => {
  global.fromUuidSync.mockImplementation(() => { throw new Error('Compendium unavailable'); });
  const state = buildState({
    name: 'Multifarious Muse', slug: 'multifarious-muse',
    choices: { muse: ENIGMA_UUID, feat: 'maestro' },
  });
  expect([...state.feats].filter((slug) => slug.endsWith('-muse'))).toEqual(['multifarious-muse']);
});
