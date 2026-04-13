import { ClassRegistry } from '../../../scripts/classes/registry.js';
import { getDedicationAliasesFromDescription } from '../../../scripts/utils/feat-aliases.js';
import { extractFeatSpellcastingMetadata } from '../../../scripts/utils/spellcasting-support.js';

describe('source description parsing', () => {
  beforeEach(() => {
    ClassRegistry.clear();
    ClassRegistry.register({
      slug: 'wizard',
      name: 'Wizard',
      keyAbility: ['int'],
      spellcasting: {
        tradition: 'arcane',
        type: 'prepared',
      },
    });
  });

  test('dedication aliases prefer _source description over translated system description', () => {
    const feat = {
      name: 'Spellshot Dedication',
      slug: 'spellshot-dedication',
      _source: {
        system: {
          description: {
            value: '<p>This feat counts as Wizard Dedication for the prerequisites of Basic Wizard Spellcasting.</p>',
          },
        },
      },
      system: {
        description: {
          value: '<p>Ce don compte comme dedication de magicien pour les prerequis de sorts de base de magicien.</p>',
        },
      },
    };

    expect(getDedicationAliasesFromDescription(feat)).toContain('wizard-dedication');
  });

  test('spellcasting metadata prefers _source description over translated system description', () => {
    const feat = {
      name: 'Wizard Dedication',
      slug: 'wizard-dedication',
      _source: {
        system: {
          description: {
            value: '<p>You gain a spellbook with four common arcane cantrips of your choice.</p>',
          },
        },
      },
      system: {
        description: {
          value: '<p>Vous gagnez un grimoire avec quatre tours profanes communs de votre choix.</p>',
        },
        traits: {
          value: ['archetype', 'dedication', 'wizard'],
        },
      },
      aliases: [],
    };

    expect(extractFeatSpellcastingMetadata(feat)).toMatchObject({
      classSlug: 'wizard',
      cantripCount: 4,
      cantripSelectionCount: 4,
      tradition: 'arcane',
      requiresSpellbook: true,
    });
  });
});
