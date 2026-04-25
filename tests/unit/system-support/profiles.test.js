import {
  buildCompendiumUuid,
  extractCompendiumUuidsByCategory,
  getActiveSystemProfile,
  getCampaignLanguages,
  getDefaultPackKeysForCategory,
  getRulesetConfig,
  getSystemSetting,
  isCompendiumUuidInCategory,
  isAnachronismActive,
  parseCompendiumUuid,
  resolveSystemPredicate,
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

  test('reads settings from the active system namespace', () => {
    const settings = {
      get: jest.fn((namespace, key) => `${namespace}:${key}`),
    };

    expect(getSystemSetting('freeArchetypeVariant', { systemId: 'sf2e', settings }))
      .toBe('sf2e:freeArchetypeVariant');
    expect(settings.get).toHaveBeenCalledWith('sf2e', 'freeArchetypeVariant');
  });

  test('returns fallback when active system setting is missing', () => {
    const settings = {
      get: jest.fn(() => {
        throw new Error('missing setting');
      }),
    };

    expect(getSystemSetting('mythic', { systemId: 'sf2e', settings, fallback: 'disabled' }))
      .toBe('disabled');
  });

  test('returns fallback when active system setting is undefined', () => {
    const settings = {
      get: jest.fn(() => undefined),
    };

    expect(getSystemSetting('automaticBonusVariant', { systemId: 'sf2e', settings, fallback: 'noABP' }))
      .toBe('noABP');
  });

  test('resolves Predicate from the active SF2e namespace before PF2e fallback', () => {
    const sf2ePredicate = class Sf2ePredicate {};
    const pf2ePredicate = class Pf2ePredicate {};
    const root = {
      game: {
        sf2e: { Predicate: sf2ePredicate },
        pf2e: { Predicate: pf2ePredicate },
      },
    };

    expect(resolveSystemPredicate({ systemId: 'sf2e', root })).toBe(sf2ePredicate);
  });

  test('reads active ruleset config and campaign languages', () => {
    const sf2eLanguages = { common: { label: 'Common' } };
    const campaignLanguages = { commonLanguage: 'common' };
    const root = {
      CONFIG: {
        SF2E: { languages: sf2eLanguages },
        PF2E: { languages: { taldane: { label: 'Taldane' } } },
      },
      game: {
        sf2e: {
          settings: {
            campaign: {
              languages: campaignLanguages,
            },
          },
        },
      },
    };

    expect(getRulesetConfig({ systemId: 'sf2e', root }).languages).toBe(sf2eLanguages);
    expect(getCampaignLanguages({ systemId: 'sf2e', root })).toBe(campaignLanguages);
  });

  test('builds compendium UUIDs from the active system pack defaults', () => {
    expect(buildCompendiumUuid('spells', 'dragon-breath', { systemId: 'sf2e' }))
      .toBe('Compendium.sf2e.spells.Item.dragon-breath');
    expect(buildCompendiumUuid('equipment', 'spellbook', { systemId: 'pf2e' }))
      .toBe('Compendium.pf2e.equipment-srd.Item.spellbook');
  });

  test('parses and filters compendium UUIDs by active category packs', () => {
    const modules = moduleMap([['sf2e-anachronism', true]]);
    const sf2eSpell = 'Compendium.sf2e-anachronism.spells.Item.quantum-pulse';
    const pf2eSpell = 'Compendium.pf2e.spells-srd.Item.force-barrage';
    const pf2eFeat = 'Compendium.pf2e.feats-srd.Item.reach-spell';

    expect(parseCompendiumUuid(sf2eSpell)).toEqual({
      packageName: 'sf2e-anachronism',
      packName: 'spells',
      packKey: 'sf2e-anachronism.spells',
      documentName: 'Item',
      documentId: 'quantum-pulse',
    });
    expect(isCompendiumUuidInCategory(sf2eSpell, 'spells', { systemId: 'pf2e', modules })).toBe(true);
    expect(isCompendiumUuidInCategory(pf2eSpell, 'spells', { systemId: 'pf2e', modules })).toBe(true);
    expect(isCompendiumUuidInCategory(pf2eFeat, 'spells', { systemId: 'pf2e', modules })).toBe(false);
  });

  test('extracts UUID links from text for active category packs only', () => {
    const html = [
      '@UUID[Compendium.sf2e.spells.Item.gravity-well]{Gravity Well}',
      '<a data-uuid="Compendium.sf2e.spells.Item.hologram">Hologram</a>',
      '@UUID[Compendium.sf2e.equipment.Item.spellbook]{Spellbook}',
      '@UUID[Compendium.pf2e.spells-srd.Item.force-barrage]{Force Barrage}',
    ].join(' ');

    expect(extractCompendiumUuidsByCategory(html, 'spells', { systemId: 'sf2e' })).toEqual([
      'Compendium.sf2e.spells.Item.gravity-well',
      'Compendium.sf2e.spells.Item.hologram',
    ]);
  });
});
