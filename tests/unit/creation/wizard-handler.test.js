import { WizardHandler } from '../../../scripts/creation/class-handlers/wizard.js';
import { CasterBaseHandler } from '../../../scripts/creation/class-handlers/caster-base.js';

describe('WizardHandler.getSpellContext', () => {
  it('shows fixed curriculum spells even when there is no choice to make', async () => {
    const spells = {
      'Compendium.pf2e.spells-srd.Item.Light': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Light',
        name: 'Light',
        img: 'icons/light.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Force Barrage': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Force Barrage',
        name: 'Force Barrage',
        img: 'icons/force-barrage.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Mystic Armor': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Mystic Armor',
        name: 'Mystic Armor',
        img: 'icons/mystic-armor.webp',
      },
    };

    global.fromUuid = jest.fn((uuid) => Promise.resolve(spells[uuid] ?? null));

    const handler = new WizardHandler();
    const context = await handler.getSpellContext({
      subclass: {
        curriculum: {
          0: ['Compendium.pf2e.spells-srd.Item.Light'],
          1: [
            'Compendium.pf2e.spells-srd.Item.Force Barrage',
            'Compendium.pf2e.spells-srd.Item.Mystic Armor',
          ],
        },
      },
    });

    expect(context.hasCurriculum).toBe(true);
    expect(context.curriculumNeedsCantripSelection).toBe(false);
    expect(context.curriculumNeedsRank1Selection).toBe(false);
    expect(context.curriculumCantripSelected.map((spell) => spell.uuid)).toEqual([
      'Compendium.pf2e.spells-srd.Item.Light',
    ]);
    expect(context.curriculumRank1Selected.map((spell) => spell.uuid)).toEqual([
      'Compendium.pf2e.spells-srd.Item.Force Barrage',
      'Compendium.pf2e.spells-srd.Item.Mystic Armor',
    ]);
    expect(context.curriculumSelectedCount).toBe(3);
    expect(context.curriculumTargetCount).toBe(3);
    expect(context.curriculumRank1Full).toBe(true);
  });

  it('requires picking 1 cantrip and 2 rank-1 spells when the curriculum offers choices', async () => {
    const spells = {
      'Compendium.pf2e.spells-srd.Item.Message': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Message',
        name: 'Message',
        img: 'icons/message.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Sigil': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Sigil',
        name: 'Sigil',
        img: 'icons/sigil.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Command': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Command',
        name: 'Command',
        img: 'icons/command.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Disguise Magic': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Disguise Magic',
        name: 'Disguise Magic',
        img: 'icons/disguise.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Runic Body': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Runic Body',
        name: 'Runic Body',
        img: 'icons/runic-body.webp',
      },
      'Compendium.pf2e.spells-srd.Item.Runic Weapon': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Runic Weapon',
        name: 'Runic Weapon',
        img: 'icons/runic-weapon.webp',
      },
    };

    global.fromUuid = jest.fn((uuid) => Promise.resolve(spells[uuid] ?? null));

    const handler = new WizardHandler();
    const context = await handler.getSpellContext({
      subclass: {
        curriculum: {
          0: [
            'Compendium.pf2e.spells-srd.Item.Message',
            'Compendium.pf2e.spells-srd.Item.Sigil',
          ],
          1: [
            'Compendium.pf2e.spells-srd.Item.Command',
            'Compendium.pf2e.spells-srd.Item.Disguise Magic',
            'Compendium.pf2e.spells-srd.Item.Runic Body',
            'Compendium.pf2e.spells-srd.Item.Runic Weapon',
          ],
        },
      },
      curriculumSpells: {
        cantrips: [{ uuid: 'Compendium.pf2e.spells-srd.Item.Message', name: 'Message', img: 'icons/message.webp' }],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Command', name: 'Command', img: 'icons/command.webp' },
          { uuid: 'Compendium.pf2e.spells-srd.Item.Disguise Magic', name: 'Disguise Magic', img: 'icons/disguise.webp' },
        ],
      },
    });

    expect(context.curriculumNeedsCantripSelection).toBe(true);
    expect(context.curriculumNeedsRank1Selection).toBe(true);
    expect(context.maxCurriculumCantrips).toBe(1);
    expect(context.maxCurriculumRank1).toBe(2);
    expect(context.curriculumSelectedCount).toBe(3);
    expect(context.curriculumTargetCount).toBe(3);
  });
});

describe('WizardHandler._applyCurriculumEntry', () => {
  it('adds only the selected curriculum spells to the curriculum entry when the school offers choices', async () => {
    const spells = {
      'Compendium.pf2e.spells-srd.Item.Figment': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Figment',
        name: 'Figment',
        img: 'icons/figment.webp',
        toObject: () => ({ name: 'Figment', type: 'spell', system: {} }),
      },
      'Compendium.pf2e.spells-srd.Item.Gouging Claw': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Gouging Claw',
        name: 'Gouging Claw',
        img: 'icons/gouging-claw.webp',
        toObject: () => ({ name: 'Gouging Claw', type: 'spell', system: {} }),
      },
      'Compendium.pf2e.spells-srd.Item.Fleet Step': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Fleet Step',
        name: 'Fleet Step',
        img: 'icons/fleet-step.webp',
        toObject: () => ({ name: 'Fleet Step', type: 'spell', system: {} }),
      },
      'Compendium.pf2e.spells-srd.Item.Illusory Disguise': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Illusory Disguise',
        name: 'Illusory Disguise',
        img: 'icons/illusory-disguise.webp',
        toObject: () => ({ name: 'Illusory Disguise', type: 'spell', system: {} }),
      },
      'Compendium.pf2e.spells-srd.Item.Sure Strike': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Sure Strike',
        name: 'Sure Strike',
        img: 'icons/sure-strike.webp',
        toObject: () => ({ name: 'Sure Strike', type: 'spell', system: {} }),
      },
    };

    global.fromUuid = jest.fn((uuid) => Promise.resolve(spells[uuid] ?? null));
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };

    const createdItems = [];
    const actor = {
      items: [],
      createEmbeddedDocuments: jest.fn(async (_type, documents) => {
        if (documents[0]?.type === 'spellcastingEntry') {
          return [{ id: 'curriculum-entry', ...documents[0] }];
        }
        createdItems.push(...documents);
        return documents;
      }),
    };

    const data = {
      subclass: {
        name: 'Red Mantis Magic School',
        curriculum: {
          0: [
            'Compendium.pf2e.spells-srd.Item.Figment',
            'Compendium.pf2e.spells-srd.Item.Gouging Claw',
          ],
          1: [
            'Compendium.pf2e.spells-srd.Item.Fleet Step',
            'Compendium.pf2e.spells-srd.Item.Illusory Disguise',
            'Compendium.pf2e.spells-srd.Item.Sure Strike',
          ],
        },
      },
      curriculumSpells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Figment', name: 'Figment', img: 'icons/figment.webp' },
        ],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Fleet Step', name: 'Fleet Step', img: 'icons/fleet-step.webp' },
          { uuid: 'Compendium.pf2e.spells-srd.Item.Illusory Disguise', name: 'Illusory Disguise', img: 'icons/illusory-disguise.webp' },
        ],
      },
    };

    const handler = new WizardHandler();
    await handler._applyCurriculumEntry(actor, data);

    expect(createdItems.map((item) => item.name)).toEqual([
      'Figment',
      'Fleet Step',
      'Illusory Disguise',
    ]);
    expect(createdItems.every((item) => item.system.location.value === 'curriculum-entry')).toBe(true);
  });

  it('reuses an existing flagged curriculum entry even when its name is localized', async () => {
    const spells = {
      'Compendium.pf2e.spells-srd.Item.Figment': {
        uuid: 'Compendium.pf2e.spells-srd.Item.Figment',
        name: 'Figment',
        img: 'icons/figment.webp',
        toObject: () => ({ name: 'Figment', type: 'spell', system: {} }),
      },
    };

    global.fromUuid = jest.fn((uuid) => Promise.resolve(spells[uuid] ?? null));
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };

    const createdItems = [];
    const actor = {
      items: [{
        id: 'entree-fr',
        type: 'spellcastingEntry',
        name: 'Programme de cursus',
        flags: { 'pf2e-leveler': { curriculumEntry: true } },
      }],
      createEmbeddedDocuments: jest.fn(async (_type, documents) => {
        createdItems.push(...documents);
        return documents;
      }),
    };

    const data = {
      subclass: {
        name: 'Ecole de magie',
        curriculum: {
          0: ['Compendium.pf2e.spells-srd.Item.Figment'],
          1: [],
        },
      },
      curriculumSpells: {
        cantrips: [],
        rank1: [],
      },
    };

    const handler = new WizardHandler();
    await handler._applyCurriculumEntry(actor, data);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(createdItems).toHaveLength(1);
    expect(createdItems[0].system.location.value).toBe('entree-fr');
  });
});

describe('WizardHandler._applySpellcasting', () => {
  it('keeps all curriculum spells out of the main wizard entry', async () => {
    global.foundry = {
      utils: {
        deepClone: (value) => JSON.parse(JSON.stringify(value)),
      },
    };

    const superApply = jest.spyOn(CasterBaseHandler.prototype, '_applySpellcasting').mockResolvedValue();

    const handler = new WizardHandler();
    const data = {
      spells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Acid Splash', name: 'Acid Splash', img: 'icons/acid-splash.webp' },
        ],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Magic Missile', name: 'Magic Missile', img: 'icons/magic-missile.webp' },
        ],
      },
      subclass: {
        curriculum: {
          0: [
            'Compendium.pf2e.spells-srd.Item.Message',
            'Compendium.pf2e.spells-srd.Item.Sigil',
          ],
          1: [
            'Compendium.pf2e.spells-srd.Item.Command',
            'Compendium.pf2e.spells-srd.Item.Disguise Magic',
            'Compendium.pf2e.spells-srd.Item.Runic Weapon',
          ],
        },
      },
      curriculumSpells: {
        cantrips: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Message', name: 'Message', img: 'icons/message.webp' },
        ],
        rank1: [
          { uuid: 'Compendium.pf2e.spells-srd.Item.Command', name: 'Command', img: 'icons/command.webp' },
          { uuid: 'Compendium.pf2e.spells-srd.Item.Disguise Magic', name: 'Disguise Magic', img: 'icons/disguise.webp' },
        ],
      },
    };

    await handler._applySpellcasting({}, data);

    expect(superApply).toHaveBeenCalledTimes(1);
    const [, mainData] = superApply.mock.calls[0];
    expect(mainData.spells.cantrips.map((spell) => spell.name)).toEqual(['Acid Splash']);
    expect(mainData.spells.rank1.map((spell) => spell.name)).toEqual(['Magic Missile']);

    superApply.mockRestore();
  });
});
