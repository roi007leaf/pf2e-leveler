import { resolveSubclassSpells } from '../../../scripts/data/subclass-spells.js';

describe('resolveSubclassSpells', () => {
  test('resolves Genie bloodline variable spells by explicit genie type', () => {
    expect(resolveSubclassSpells('bloodline-genie', { genie: 'janni' }, 2)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.0qaqksrGGDj74HXE' }),
    );
    expect(resolveSubclassSpells('bloodline-genie', { genie: 'jaathoom' }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.bay4AfSu2iIozNNW' }),
    );
    expect(resolveSubclassSpells('bloodline-genie', { genie: 'ifrit' }, 8)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.Oj1PJBMQD9vuwCv7' }),
    );
    expect(resolveSubclassSpells('bloodline-genie', { genie: 'faydhaan' }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.zfn5RqAdF63neqpP' }),
    );
    expect(resolveSubclassSpells('bloodline-genie', { genie: 'jabali' }, 2)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.XXqE1eY3w3z6xJCB' }),
    );
  });
});
