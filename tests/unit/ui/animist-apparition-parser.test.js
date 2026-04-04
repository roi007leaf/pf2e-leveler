import { CharacterWizard } from '../../../scripts/ui/character-wizard/index.js';

jest.mock('../../../scripts/creation/creation-store.js', () => ({
  getCreationData: jest.fn(() => null),
  saveCreationData: jest.fn(),
  clearCreationData: jest.fn(),
}));

jest.mock('../../../scripts/creation/apply-creation.js', () => ({
  applyCreation: jest.fn(),
}));

jest.mock('../../../scripts/utils/i18n.js', () => ({
  localize: jest.fn((key) => key),
}));

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: { get: jest.fn() },
}));

describe('CharacterWizard apparition parsers', () => {
  it('parses apparition lores, spell list, and vessel spell', () => {
    const wizard = new CharacterWizard(createMockActor());
    const html = `
      <p><strong>Apparition Skills</strong> Farming Lore, Herbalism Lore</p>
      <p><strong>Apparition Spells</strong></p>
      <ul>
        <li><strong>Cantrip</strong> @UUID[Compendium.pf2e.spells-srd.Item.TangleVine]</li>
        <li><strong>1st</strong> @UUID[Compendium.pf2e.spells-srd.Item.ProtectorTree]</li>
      </ul>
      <p><strong>Vessel Spell</strong> @UUID[Compendium.pf2e.spells-srd.Item.GardenOfHealing]</p>
    `;

    expect(wizard._parseApparitionLores(html)).toEqual([
      'Farming Lore',
      'Herbalism Lore',
    ]);
    expect(wizard._parseApparitionSpells(html)).toEqual({
      0: ['Compendium.pf2e.spells-srd.Item.TangleVine'],
      1: ['Compendium.pf2e.spells-srd.Item.ProtectorTree'],
    });
    expect(wizard._parseVesselSpell(html)).toBe('Compendium.pf2e.spells-srd.Item.GardenOfHealing');
  });
});
