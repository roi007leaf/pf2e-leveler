import { WitchHandler } from '../../../scripts/creation/class-handlers/witch.js';

describe('WitchHandler.getSpellbookCounts', () => {
  it('keeps patron-granted spells from reducing the witchs normal familiar picks', () => {
    const handler = new WitchHandler();
    expect(handler.getSpellbookCounts({}, {})).toEqual({
      cantrips: 11,
      rank1: 6,
    });
  });
});
