import {
  doesFeatMatchRequiredSecondLevelClassFeat,
  getRequiredSecondLevelClassFeatForActor,
} from '../../../scripts/classes/class-archetype-requirements.js';

function entry(classSlug, flexible = true, extraFlags = {}) {
  return {
    type: 'spellcastingEntry',
    name: `${classSlug} Spells`,
    flags: { 'pf2e-leveler': { classSpellcastingEntry: classSlug, ...extraFlags } },
    system: { prepared: { value: 'prepared', flexible }, tradition: { value: 'arcane' } },
  };
}

describe('flexible class archetype requirement', () => {
  test.each(['wizard', 'druid', 'cleric', 'witch'])('requires dedication for native flexible %s entry', (classSlug) => {
    const actor = { class: { slug: classSlug }, items: [entry(classSlug)] };
    const requirement = getRequiredSecondLevelClassFeatForActor(actor);
    expect(requirement).toEqual({
      uuid: 'Compendium.pf2e.feats-srd.Item.CrS0iDwHmjKqvKti',
      name: 'Flexible Spellcaster Dedication',
      slug: 'flexible-spellcaster-dedication',
      text: 'Flexible Spellcaster Dedication',
    });
    expect(doesFeatMatchRequiredSecondLevelClassFeat({ slug: 'flexible-spellcaster-dedication' }, requirement)).toBe(true);
    expect(doesFeatMatchRequiredSecondLevelClassFeat({ slug: 'reach-spell' }, requirement)).toBe(false);
  });

  test('regular prepared casters retain unrestricted class feat selection', () => {
    expect(getRequiredSecondLevelClassFeatForActor({ class: { slug: 'wizard' }, items: [entry('wizard', false)] })).toBeNull();
  });

  test('unsupported caster cannot acquire requirement from flexible entry', () => {
    expect(getRequiredSecondLevelClassFeatForActor({ class: { slug: 'magus' }, items: [entry('magus')] })).toBeNull();
  });

  test('dual class requirement only applies to matching class', () => {
    const actor = { class: { slug: 'wizard' }, items: [entry('wizard', false), entry('witch')] };
    expect(getRequiredSecondLevelClassFeatForActor(actor)).toBeNull();
    expect(getRequiredSecondLevelClassFeatForActor(actor, 'witch')?.slug).toBe('flexible-spellcaster-dedication');
  });

  test.each(['archetypeSpellcastingEntry', 'classRestrictedSpellcastingEntry', 'customSpellcastingEntry'])('ignores %s entry', (flag) => {
    const actor = { class: { slug: 'wizard' }, items: [entry('wizard', true, { [flag]: 'wizard' })] };
    expect(getRequiredSecondLevelClassFeatForActor(actor)).toBeNull();
  });

  test('recognizes imported native named class entry without module flags', () => {
    const imported = entry('wizard');
    delete imported.flags;
    expect(getRequiredSecondLevelClassFeatForActor({ class: { slug: 'wizard' }, items: [imported] })?.slug).toBe('flexible-spellcaster-dedication');
  });

  test('does not attribute an unnamed primary casting entry to a secondary class', () => {
    const imported = entry('wizard');
    delete imported.flags;
    imported.name = 'Arcane Magic';
    const actor = { class: { slug: 'wizard' }, items: [imported] };
    expect(getRequiredSecondLevelClassFeatForActor(actor)?.slug).toBe('flexible-spellcaster-dedication');
    expect(getRequiredSecondLevelClassFeatForActor(actor, 'witch')).toBeNull();
  });

  test('preserves subclass dedication requirement without flexible preparation', () => {
    const actor = {
      class: { slug: 'cleric' },
      items: [{ type: 'feat', system: {
        traits: { otherTags: ['cleric-doctrine'] },
        description: { value: 'You must select Battle Harbinger Dedication as your 2nd-level class feat.' },
      } }],
    };
    expect(getRequiredSecondLevelClassFeatForActor(actor)?.slug).toBe('battle-harbinger-dedication');
  });
});
