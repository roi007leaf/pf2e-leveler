import {
  buildStandardizedAncestryFeatIndex,
  getStandardizedAncestryFeatAccess,
} from '../../../scripts/feats/standardized-ancestry-feats.js';

describe('standardized ancestry feat access', () => {
  test('parses only feat UUIDs inside each standardized ancestry section', () => {
    const index = buildStandardizedAncestryFeatIndex([
      {
        name: 'Human',
        text: {
          content: `
            <h2>Standardized Ancestry Feats</h2>
            <p>@UUID[Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc]{Ancestral Skills}</p>
            <p>@UUID[Compendium.sf2e.feats.Item.MeBVpW5EIOzoEHCh]{Linguistic Prodigy}</p>
            <h2>Other Feats</h2>
            <p>@UUID[Compendium.sf2e.feats.Item.notStandardized]{Not Standardized}</p>
          `,
        },
      },
      {
        name: 'Vesk',
        text: {
          content: `
            <h2 class="section-header">Standardized Ancestry Feats</h2>
            <p>@UUID[Compendium.sf2e.feats.Item.upMcjxPDgNOLuu7N]{Internal Compartment}</p>
          `,
        },
      },
      {
        name: 'Elf',
        text: {
          content:
            '<h2>Elf Feats</h2><p>@UUID[Compendium.sf2e.feats.Item.elvenLore]{Elven Lore}</p>',
        },
      },
    ]);

    expect([...index.featUuidsByAncestry.get('human')]).toEqual([
      'Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc',
      'Compendium.sf2e.feats.Item.MeBVpW5EIOzoEHCh',
    ]);
    expect([...index.featUuidsByAncestry.get('vesk')]).toEqual([
      'Compendium.sf2e.feats.Item.upMcjxPDgNOLuu7N',
    ]);
    expect(index.featUuidsByAncestry.has('elf')).toBe(false);
    expect(index.allFeatUuids).not.toContain('Compendium.sf2e.feats.Item.notStandardized');
  });

  test('unions exact access for base, adopted, and mixed ancestry traits', async () => {
    const index = buildStandardizedAncestryFeatIndex([
      {
        name: 'Human',
        text: {
          content: `
            <h2>Standardized Ancestry Feats</h2>
            @UUID[Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc]{Ancestral Skills}
          `,
        },
      },
      {
        name: 'Dwarf',
        text: {
          content: `
            <h2>Standardized Ancestry Feats</h2>
            @UUID[Compendium.sf2e.feats.Item.stoneCunning]{Stone Cunning}
          `,
        },
      },
    ]);

    const access = await getStandardizedAncestryFeatAccess(
      {
        ancestrySlug: 'human',
        ancestryFeatTraits: new Set(['human', 'dwarf']),
      },
      { systemId: 'sf2e', index },
    );

    expect([...access.accessibleStandardizedAncestryFeatUuids]).toEqual([
      'Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc',
      'Compendium.sf2e.feats.Item.stoneCunning',
    ]);
    expect(access.standardizedAncestryFeatUuids).toEqual(index.allFeatUuids);
  });

  test('loads only the SF2e Ancestries journal from the journal pack', async () => {
    const ancestryJournal = {
      name: 'Ancestries',
      pages: [
        {
          name: 'Human',
          text: {
            content: `
              <h2>Standardized Ancestry Feats</h2>
              @UUID[Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc]{Ancestral Skills}
            `,
          },
        },
      ],
    };
    const pack = {
      getIndex: jest.fn(async () => [
        { _id: 'rules', name: 'Rules' },
        { _id: 'ancestries', name: 'Ancestries' },
      ]),
      getDocument: jest.fn(async (id) => (id === 'ancestries' ? ancestryJournal : null)),
    };

    const access = await getStandardizedAncestryFeatAccess(
      { ancestryFeatTraits: new Set(['human']) },
      { systemId: 'sf2e', pack },
    );

    expect(pack.getIndex).toHaveBeenCalledWith({ fields: ['name'] });
    expect(pack.getDocument).toHaveBeenCalledWith('ancestries');
    expect([...access.accessibleStandardizedAncestryFeatUuids]).toEqual([
      'Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc',
    ]);
  });

  test('returns no standardized overrides outside SF2e', async () => {
    const access = await getStandardizedAncestryFeatAccess(
      { ancestryFeatTraits: new Set(['human']) },
      {
        systemId: 'pf2e',
        index: {
          featUuidsByAncestry: new Map([
            ['human', new Set(['Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc'])],
          ]),
          allFeatUuids: new Set(['Compendium.sf2e.feats.Item.3iiARSS25VacP3Nc']),
        },
      },
    );

    expect(access.standardizedAncestryFeatUuids).toEqual(new Set());
    expect(access.accessibleStandardizedAncestryFeatUuids).toEqual(new Set());
  });
});
