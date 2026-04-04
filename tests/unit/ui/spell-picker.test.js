import { SpellPicker } from '../../../scripts/ui/spell-picker.js';

describe('SpellPicker', () => {
  beforeEach(() => {
    game.packs.get = jest.fn(() => ({
      getDocuments: jest.fn(async () => [
        makeSpell('magic-missile', 'Magic Missile', 1, ['arcane']),
        makeSpell('acid-grip', 'Acid Grip', 2, ['arcane']),
        makeSpell('heal', 'Heal', 1, ['divine']),
      ]),
    }));
  });

  test('allows lower-rank spells for higher-rank spontaneous selections', async () => {
    const actor = createMockActor({
      items: [],
    });
    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), { excludedSelections: [] });

    const context = await picker._prepareContext();
    const names = context.spells.map((spell) => spell.name);

    expect(names).toContain('Magic Missile');
    expect(names).toContain('Acid Grip');
    expect(names).not.toContain('Heal');
  });

  test('allows same spell at a different rank but blocks same spell and rank', async () => {
    const actor = createMockActor({
      items: [
        {
          type: 'spell',
          sourceId: 'magic-missile',
          system: {
            level: { value: 1 },
            location: { value: 'entry-1' },
          },
        },
      ],
    });

    const picker = new SpellPicker(actor, 'arcane', 2, jest.fn(), { excludedSelections: [] });
    const context = await picker._prepareContext();
    expect(context.spells.map((spell) => spell.uuid)).toContain('magic-missile');

    const sameRankPicker = new SpellPicker(actor, 'arcane', 1, jest.fn(), { excludedSelections: [] });
    const sameRankContext = await sameRankPicker._prepareContext();
    expect(sameRankContext.spells.map((spell) => spell.uuid)).not.toContain('magic-missile');
  });
});

function makeSpell(uuid, name, level, traditions) {
  return {
    uuid,
    name,
    system: {
      level: { value: level },
      traits: {
        value: [],
        traditions,
      },
    },
  };
}
