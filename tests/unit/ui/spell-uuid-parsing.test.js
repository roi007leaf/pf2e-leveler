import { parseSpellUuidsFromDescription } from '../../../scripts/ui/character-wizard/loaders.js';

describe('spell UUID parsing', () => {
  afterEach(() => {
    global.game.system.id = 'pf2e';
  });

  test('parses SF2e spell UUIDs from GrantItem rules and description links', () => {
    global.game.system.id = 'sf2e';

    const uuids = parseSpellUuidsFromDescription(
      [{ key: 'GrantItem', uuid: 'Compendium.sf2e.spells.Item.quantum-pulse' }],
      [
        '@UUID[Compendium.sf2e.spells.Item.gravity-well]{Gravity Well}',
        '<a data-uuid="Compendium.sf2e.spells.Item.hologram">Hologram</a>',
        '@UUID[Compendium.sf2e.equipment.Item.spellbook]{Spellbook}',
        '@UUID[Compendium.pf2e.spells-srd.Item.force-barrage]{Force Barrage}',
      ].join(' '),
    );

    expect(uuids).toEqual([
      'Compendium.sf2e.spells.Item.quantum-pulse',
      'Compendium.sf2e.spells.Item.gravity-well',
      'Compendium.sf2e.spells.Item.hologram',
    ]);
  });
});
