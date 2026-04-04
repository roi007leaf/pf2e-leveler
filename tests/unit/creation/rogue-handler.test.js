import { RogueHandler } from '../../../scripts/creation/class-handlers/rogue.js';

jest.mock('../../../scripts/classes/registry.js', () => ({
  ClassRegistry: {
    get: jest.fn((slug) => {
      const map = {
        wizard: { keyAbility: ['int'] },
        cleric: { keyAbility: ['wis'] },
        psychic: { keyAbility: ['int', 'cha'] },
      };
      return map[slug] ?? null;
    }),
  },
}));

describe('RogueHandler', () => {
  it('uses INT for Mastermind', async () => {
    const handler = new RogueHandler();
    await expect(handler.getKeyAbilityOptions({
      subclass: { slug: 'mastermind' },
    }, { keyAbility: ['dex'] })).resolves.toEqual(['int']);
  });

  it('uses STR for Ruffian', async () => {
    const handler = new RogueHandler();
    await expect(handler.getKeyAbilityOptions({
      subclass: { slug: 'ruffian' },
    }, { keyAbility: ['dex'] })).resolves.toEqual(['str']);
  });

  it('uses CHA for Scoundrel', async () => {
    const handler = new RogueHandler();
    await expect(handler.getKeyAbilityOptions({
      subclass: { slug: 'scoundrel' },
    }, { keyAbility: ['dex'] })).resolves.toEqual(['cha']);
  });

  it('uses the selected eldritch trickster dedication class key ability', async () => {
    global.fromUuid = jest.fn(async () => ({
      slug: 'wizard-dedication',
      name: 'Wizard Dedication',
    }));

    const handler = new RogueHandler();
    await expect(handler.getKeyAbilityOptions({
      subclass: {
        slug: 'eldritch-trickster',
        choices: {
          multiclassDedication: 'Compendium.pf2e.feats-srd.Item.wizard-dedication',
        },
      },
    }, { keyAbility: ['dex'] })).resolves.toEqual(['int']);
  });

  it('supports multi-option key abilities from the selected dedication', async () => {
    global.fromUuid = jest.fn(async () => ({
      slug: 'psychic-dedication',
      name: 'Psychic Dedication',
    }));

    const handler = new RogueHandler();
    await expect(handler.getKeyAbilityOptions({
      subclass: {
        slug: 'eldritch-trickster',
        choices: {
          multiclassDedication: 'Compendium.pf2e.feats-srd.Item.psychic-dedication',
        },
      },
    }, { keyAbility: ['dex'] })).resolves.toEqual(['int', 'cha']);
  });
});
