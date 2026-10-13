import { getInnateSpellGrantUuids } from '../../../scripts/utils/spell-description.js';

describe('description-only innate spell grants', () => {
  const detectMagic = 'Compendium.pf2e.spells-srd.Item.gpzpAAAJ1Lza2JVl';
  const otherSpell = 'Compendium.pf2e.spells-srd.Item.other';

  test('recognizes at-will innate grants and deduplicates linked spells', () => {
    const paragraph = `<p>You can cast @UUID[${detectMagic}]{Detect Magic} at will as an arcane innate spell.</p>`;
    expect(getInnateSpellGrantUuids(paragraph + paragraph)).toEqual([detectMagic]);
  });

  test('does not grant incidental spell references in other paragraphs', () => {
    expect(getInnateSpellGrantUuids(
      `<p>You can cast @UUID[${detectMagic}] as an innate spell.</p><p>This does not affect @UUID[${otherSpell}].</p>`,
    )).toEqual([detectMagic]);
  });

  test('does not grant spells from examples, spellbook learning, or unresolved choices', () => {
    for (const text of [
      `Your innate spells are harder to detect with @UUID[${detectMagic}].`,
      `You learn @UUID[${detectMagic}] and add it to your spellbook.`,
      `Choose @UUID[${detectMagic}] or another spell to cast as an innate spell.`,
    ]) {
      expect(getInnateSpellGrantUuids(`<p>${text}</p>`)).toEqual([]);
    }
  });
});
