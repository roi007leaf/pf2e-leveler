import {
  getActiveSystemProfile,
  getDefaultPackKeysForCategory,
  isAnachronismActive,
} from '../../../scripts/system-support/profiles.js';

function moduleMap(entries = []) {
  return new Map(entries.map(([id, active]) => [id, { id, active }]));
}

describe('system support profiles', () => {
  test('uses PF2e defaults in PF2e worlds without Anachronism', () => {
    const profile = getActiveSystemProfile({
      systemId: 'pf2e',
      modules: moduleMap(),
    });

    expect(profile.id).toBe('pf2e');
    expect(profile.contentProfile).toBe('pf2e');
    expect(profile.defaultPacks.feats).toEqual(['pf2e.feats-srd']);
    expect(getDefaultPackKeysForCategory('spells', { systemId: 'pf2e', modules: moduleMap() }))
      .toEqual(['pf2e.spells-srd']);
  });

  test('uses SF2e defaults in standalone SF2e worlds', () => {
    const profile = getActiveSystemProfile({
      systemId: 'sf2e',
      modules: moduleMap(),
    });

    expect(profile.id).toBe('sf2e');
    expect(profile.contentProfile).toBe('sf2e');
    expect(profile.defaultPacks.feats).toEqual(['sf2e.feats']);
    expect(profile.defaultPacks.classFeatures).toEqual(['sf2e.class-features']);
    expect(profile.defaultPacks.equipment).toEqual(['sf2e.equipment']);
  });

  test('combines PF2e and Anachronism packs when Anachronism is active in PF2e', () => {
    const modules = moduleMap([['sf2e-anachronism', true]]);
    const profile = getActiveSystemProfile({ systemId: 'pf2e', modules });

    expect(isAnachronismActive({ modules })).toBe(true);
    expect(profile.contentProfile).toBe('pf2e+sf2e-anachronism');
    expect(profile.defaultPacks.feats).toEqual(['pf2e.feats-srd', 'sf2e-anachronism.feats']);
    expect(profile.defaultPacks.classFeatures).toEqual(['pf2e.classfeatures', 'sf2e-anachronism.class-features']);
  });

  test('ignores inactive Anachronism module', () => {
    const modules = moduleMap([['sf2e-anachronism', false]]);

    expect(isAnachronismActive({ modules })).toBe(false);
    expect(getDefaultPackKeysForCategory('feats', { systemId: 'pf2e', modules }))
      .toEqual(['pf2e.feats-srd']);
  });
});
