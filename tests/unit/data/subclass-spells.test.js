import { SUBCLASS_SPELLS, resolveSpellcastingTradition, resolveSubclassSpells } from '../../../scripts/data/subclass-spells.js';

describe('resolveSubclassSpells', () => {
  test('maps all three Time mystery revelation spells to their correct tiers', () => {
    expect(SUBCLASS_SPELLS.time.focusSpells).toEqual({
      initial: 'Compendium.pf2e.spells-srd.Item.UbHK19RYbxRXWgWX',
      advanced: 'Compendium.pf2e.spells-srd.Item.LbqunTurwXB3u9Vp',
      greater: 'Compendium.pf2e.spells-srd.Item.MT8usUfwudDVUm5H',
    });
  });

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

  test('resolves Draconic bloodline grants by selected exemplar tradition', () => {
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'forest' }, 2)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.yhz9fF69uwRhnHix' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'forest' }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.F1qxaqsEItmBura2' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'forest' }, 8)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.wi405lBjPcbF1DeR' }),
    );
  });

  test('uses journal-specific Draconic exemplar gifts before broad tradition fallback', () => {
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'adamantine' }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.oXeEbcUdgJGWHGEJ' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'barrage' }, 2)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.mrDi3v933gsmnw25' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: 'primal' }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.xxWhyl81w3ckslAU' }),
    );
  });

  test('resolves Draconic bloodline grants and tradition from raw PF2e choice object', () => {
    const primalDragonChoice = {
      damageType: 'fire',
      skill: 'nature',
      slug: 'primal',
      tradition: 'primal',
    };

    expect(resolveSpellcastingTradition('bloodline', {
      slug: 'bloodline-draconic',
      choices: { dragonBloodline: primalDragonChoice },
    })).toBe('primal');
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: primalDragonChoice }, 2)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.1xbFBQDRs0hT5xZ9' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: primalDragonChoice }, 5)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.xxWhyl81w3ckslAU' }),
    );
    expect(resolveSubclassSpells('bloodline-draconic', { dragonBloodline: primalDragonChoice }, 8)).toEqual(
      expect.objectContaining({ grantedSpell: 'Compendium.pf2e.spells-srd.Item.x7SPrsRxGb2Vy2nu' }),
    );
  });

  test.each([
    ['bloodline-aberrant', 'occult'],
    ['bloodline-aesir', 'divine'],
    ['bloodline-angelic', 'divine'],
    ['bloodline-demonic', 'divine'],
    ['bloodline-diabolic', 'divine'],
    ['bloodline-elemental', 'primal'],
    ['bloodline-fey', 'primal'],
    ['bloodline-genie', 'arcane'],
    ['bloodline-hag', 'occult'],
    ['bloodline-harrow', 'occult'],
    ['bloodline-imperial', 'arcane'],
    ['bloodline-nymph', 'primal'],
    ['bloodline-phoenix', 'primal'],
    ['bloodline-psychopomp', 'divine'],
    ['bloodline-shadow', 'occult'],
    ['bloodline-undead', 'divine'],
    ['bloodline-wyrmblessed', 'divine'],
  ])('resolves %s to its fixed spellcasting tradition', (slug, tradition) => {
    expect(resolveSpellcastingTradition('bloodline', { slug })).toBe(tradition);
  });

  test.each([
    ['bloodline-elemental', { elementalBloodline: 'fire' }, 'primal'],
    ['bloodline-genie', { genie: 'ifrit' }, 'arcane'],
    ['bloodline-wyrmblessed', { dragonBloodline: 'umbral' }, 'divine'],
  ])('keeps %s fixed when its choice only changes gifts', (slug, choices, tradition) => {
    expect(resolveSpellcastingTradition('bloodline', { slug, choices })).toBe(tradition);
  });
});
