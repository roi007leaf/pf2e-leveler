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

describe('CharacterWizard._parseCurriculum', () => {
  it('parses the markdown-style curriculum format used by PF2E v13 wizard schools', () => {
    const wizard = new CharacterWizard(createMockActor());
    const curriculum = wizard._parseCurriculum(`
Magic is power.

Curriculum

  * cantrips: @UUID[Compendium.pf2e.spells-srd.Item.Shield], @UUID[Compendium.pf2e.spells-srd.Item.Telekinetic Projectile]
  * 1st: @UUID[Compendium.pf2e.spells-srd.Item.Breathe Fire], @UUID[Compendium.pf2e.spells-srd.Item.Force Barrage], @UUID[Compendium.pf2e.spells-srd.Item.Mystic Armor]
  * 2nd: @UUID[Compendium.pf2e.spells-srd.Item.Mist], @UUID[Compendium.pf2e.spells-srd.Item.Resist Energy]

School Spells initial: @UUID[Compendium.pf2e.spells-srd.Item.Force Bolt]; advanced: @UUID[Compendium.pf2e.spells-srd.Item.Energy Absorption]
    `);

    expect(curriculum).toEqual({
      0: [
        'Compendium.pf2e.spells-srd.Item.Shield',
        'Compendium.pf2e.spells-srd.Item.Telekinetic Projectile',
      ],
      1: [
        'Compendium.pf2e.spells-srd.Item.Breathe Fire',
        'Compendium.pf2e.spells-srd.Item.Force Barrage',
        'Compendium.pf2e.spells-srd.Item.Mystic Armor',
      ],
      2: [
        'Compendium.pf2e.spells-srd.Item.Mist',
        'Compendium.pf2e.spells-srd.Item.Resist Energy',
      ],
    });
  });

  it('still parses the older HTML curriculum format', () => {
    const wizard = new CharacterWizard(createMockActor());
    const curriculum = wizard._parseCurriculum(`
      <p><strong>Additional Curriculum</strong></p>
      <ul>
        <li><strong>cantrips:</strong> @UUID[Compendium.pf2e.spells-srd.Item.Telekinetic Projectile]</li>
        <li><strong>1st:</strong> @UUID[Compendium.pf2e.spells-srd.Item.Force Barrage], @UUID[Compendium.pf2e.spells-srd.Item.Mystic Armor]</li>
      </ul>
      <p><strong>School Spells</strong> initial: @UUID[Compendium.pf2e.spells-srd.Item.Force Bolt]</p>
    `);

    expect(curriculum).toEqual({
      0: ['Compendium.pf2e.spells-srd.Item.Telekinetic Projectile'],
      1: [
        'Compendium.pf2e.spells-srd.Item.Force Barrage',
        'Compendium.pf2e.spells-srd.Item.Mystic Armor',
      ],
    });
  });

  it('parses school entries whose rank label has no colon after the strong tag', () => {
    const wizard = new CharacterWizard(createMockActor());
    const curriculum = wizard._parseCurriculum(`
      <p><strong>Curriculum</strong></p>
      <ul>
        <li><strong>cantrips:</strong> @UUID[Compendium.pf2e.spells-srd.Item.Figment], @UUID[Compendium.pf2e.spells-srd.Item.Gouging Claw]</li>
        <li><strong>1st</strong> @UUID[Compendium.pf2e.spells-srd.Item.Fleet Step], @UUID[Compendium.pf2e.spells-srd.Item.Illusory Disguise], @UUID[Compendium.pf2e.spells-srd.Item.Sure Strike]</li>
      </ul>
      <p><strong>School Spells</strong> initial: @UUID[Compendium.pf2e.spells-srd.Item.Debilitating Terror]</p>
    `);

    expect(curriculum).toEqual({
      0: [
        'Compendium.pf2e.spells-srd.Item.Figment',
        'Compendium.pf2e.spells-srd.Item.Gouging Claw',
      ],
      1: [
        'Compendium.pf2e.spells-srd.Item.Fleet Step',
        'Compendium.pf2e.spells-srd.Item.Illusory Disguise',
        'Compendium.pf2e.spells-srd.Item.Sure Strike',
      ],
    });
  });
});
