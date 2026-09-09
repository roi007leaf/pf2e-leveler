import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { BARD } from '../../../scripts/classes/bard.js';
import { computeBuildState } from '../../../scripts/plan/build-state.js';
import { createPlan, setLevelFeat } from '../../../scripts/plan/plan-model.js';
import { checkPrerequisites } from '../../../scripts/prerequisites/prerequisite-checker.js';

const vulpineScamper = {
  name: 'Vulpine Scamper',
  system: { prerequisites: { value: [{ value: 'fox alternate form' }] } },
};

function formRule(form) {
  return {
    key: 'RollOption', option: 'change-shape', alwaysActive: true,
    mergeable: true, toggleable: true, value: false,
    suboptions: [{ label: `PF2E.NPCAbility.ChangeShape.Form.${form}`, value: form }],
  };
}

function kitsune(heritageRules) {
  const heritage = {
    type: 'heritage', name: 'Dark Fields Kitsune', slug: 'dark-fields-kitsune',
    system: { rules: heritageRules },
  };
  return createMockActor({
    ancestry: { name: 'Kitsune', slug: 'kitsune' }, heritage,
    items: [heritage, { type: 'action', name: 'Change Shape', slug: 'change-shape', system: {} }],
  });
}

beforeAll(() => ClassRegistry.register(BARD));

test('Dark Fields fox form qualifies even while Change Shape is inactive', () => {
  const state = computeBuildState(kitsune([formRule('fox')]), createPlan('bard'), 5);
  expect(checkPrerequisites(vulpineScamper, state)).toMatchObject({ met: true });
  expect(state.featAliasSources.get('fox-alternate-form')?.get('dark-fields-kitsune')).toBe('Dark Fields Kitsune');
});

test('Change Shape with only a tailless form does not qualify', () => {
  const state = computeBuildState(kitsune([formRule('tailless')]), createPlan('bard'), 5);
  expect(state.feats.has('change-shape')).toBe(true);
  expect(checkPrerequisites(vulpineScamper, state).met).toBe(false);
});

test('Myriad Forms grants fox prerequisites at its planned level, not before', () => {
  const actor = kitsune([formRule('tailless')]);
  const plan = createPlan('bard');
  setLevelFeat(plan, 5, 'ancestryFeats', {
    uuid: 'Compendium.pf2e.feats-srd.Item.l2JaSC3NA9S6Qq46',
    name: 'Myriad Forms', slug: 'myriad-forms',
    system: { rules: [formRule('fox')] },
  });
  expect(checkPrerequisites(vulpineScamper, computeBuildState(actor, plan, 4)).met).toBe(false);
  const state = computeBuildState(actor, plan, 5);
  expect(checkPrerequisites(vulpineScamper, state).met).toBe(true);
  expect(state.featAliasSources.get('fox-alternate-form')?.get('myriad-forms')).toBe('Myriad Forms');
});

test('a level-gated fox form does not qualify before its predicate is met', () => {
  const actor = kitsune([{ ...formRule('fox'), predicate: [{ gte: ['self:level', 5] }] }]);
  expect(checkPrerequisites(vulpineScamper, computeBuildState(actor, createPlan('bard'), 4)).met).toBe(false);
  expect(checkPrerequisites(vulpineScamper, computeBuildState(actor, createPlan('bard'), 5)).met).toBe(true);
});
