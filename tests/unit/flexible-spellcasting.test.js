import { supportsFlexiblePreparation, getFlexibleSpellSlots, findClassSpellcastingEntry, ensureFlexibleRank10Entry } from '../../scripts/utils/flexible-spellcasting.js';

describe('flexible spellcasting', () => {
  test.each([[1, 3], [2, 4], [3, 4], [4, 5], [20, 5]])('reduces daily slots at level %s', (level, cantrips) => {
    const slots = { cantrips: 5, 1: [3, 1], 2: 3, 10: 1 };
    expect(getFlexibleSpellSlots(slots, level)).toEqual({ cantrips, 1: 2, 2: 2 });
    expect(slots[1]).toEqual([3, 1]);
  });

  test('limits eligibility to full prepared classes', () => {
    for (const slug of ['wizard', 'witch', 'cleric', 'druid']) {
      expect(supportsFlexiblePreparation({ slug, spellcasting: { type: 'prepared' } })).toBe(true);
    }
    expect(supportsFlexiblePreparation({ slug: 'magus', spellcasting: { type: 'prepared' } })).toBe(false);
    expect(supportsFlexiblePreparation({ slug: 'wizard', spellcasting: { type: 'spontaneous' } })).toBe(false);
  });

  test('matches class identity before tradition, excludes unrelated restricted entries', () => {
    const unrelated = { type: 'spellcastingEntry', name: 'Curriculum', system: { tradition: { value: 'arcane' }, prepared: { value: 'prepared' } } };
    const wizard = { ...unrelated, name: 'Wizard Spells', flags: { 'pf2e-leveler': { classSpellcastingEntry: 'wizard' } } };
    expect(findClassSpellcastingEntry({ items: [unrelated, wizard] }, { classSlug: 'wizard', tradition: 'arcane', prepared: 'prepared' })).toBe(wizard);
    expect(findClassSpellcastingEntry({ items: [unrelated] }, { classSlug: 'wizard', tradition: 'arcane', prepared: 'prepared' })).toBeNull();
    expect(findClassSpellcastingEntry({ items: [wizard] }, { classSlug: 'wizard', name: 'Wizard' })).toBe(wizard);
    expect(findClassSpellcastingEntry({ items: { contents: [wizard] } }, { classSlug: 'wizard', name: 'Wizard' })).toBe(wizard);
  });

  test('migrates existing tenth-rank spells and preparations into restricted entry', async () => {
    const primary = { id: 'primary', system: { tradition: { value: 'arcane' }, ability: { value: 'int' }, slots: { slot10: { prepared: { 0: { id: 'spell', expended: false } } } } } };
    const actor = {
      items: { contents: [{ id: 'spell', type: 'spell', system: { level: { value: 10 }, location: { value: 'primary' } } }] },
      createEmbeddedDocuments: jest.fn(async (_type, docs) => [{ ...docs[0], id: 'restricted' }]),
      updateEmbeddedDocuments: jest.fn(async () => []),
    };
    await ensureFlexibleRank10Entry(actor, primary, { slug: 'wizard', name: 'Wizard' }, { 10: 1 });
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith('Item', [expect.objectContaining({ _id: 'restricted', 'system.slots.slot10.prepared': primary.system.slots.slot10.prepared }), { _id: 'spell', 'system.location.value': 'restricted' }]);
  });
});
