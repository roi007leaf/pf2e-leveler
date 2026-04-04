import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';
import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { DRUID } from '../../../scripts/classes/druid.js';

describe('CasterBaseHandler._applySpellcasting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ClassRegistry.clear();
    ClassRegistry.register(DRUID);
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };
    global.fromUuid = jest.fn(async (uuid) => {
      const name = uuid.split('.').pop();
      const rank = name === 'tangle-vine' ? 0 : 1;
      const traits = name === 'tangle-vine' ? ['cantrip'] : [];
      return {
        uuid,
        name,
        img: `${name}.webp`,
        system: {
          level: { value: rank },
          traits: { value: traits },
        },
        toObject: () => ({
          name,
          type: 'spell',
          system: {
            level: { value: rank },
            traits: { value: traits },
          },
        }),
      };
    });
  });

  it('adds only selected or granted spells for prepared non-spellbook casters', async () => {
    const createdDocs = [];
    const actor = {
      items: [],
      createEmbeddedDocuments: jest.fn(async (_type, docs) => {
        createdDocs.push(...docs);
        return docs.map((doc, index) => ({ id: doc.type === 'spellcastingEntry' ? 'entry-1' : `spell-${index}`, ...doc }));
      }),
      updateEmbeddedDocuments: jest.fn(async () => []),
    };

    const handler = new CasterBaseHandler();
    await handler._applySpellcasting(actor, {
      class: { slug: 'druid', name: 'Druid' },
      subclass: null,
      spells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.tangle-vine', name: 'Tangle Vine' },
        ],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.heal-animal', name: 'Heal Animal' },
        ],
      },
    });

    const createdSpells = createdDocs.filter((doc) => doc.type === 'spell');
    expect(createdSpells.map((doc) => doc.name)).toEqual(['tangle-vine', 'heal-animal']);
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(3);
  });
});
