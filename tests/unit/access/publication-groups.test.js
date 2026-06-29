import {
  PUBLICATION_GROUPS,
  getPublicationGroupMembers,
  buildPublicationGroupChips,
} from '../../../scripts/access/source-classification.js';

const TITLES = [
  'Pathfinder #219: Lord of the Trinity Star',
  'Pathfinder Adventure Path: Gatewalkers',
  "Gatewalkers Player's Guide (Remastered)",
  "Pathfinder Advanced Player's Guide",
  'Pathfinder Adventure: The Slithering',
  'Paizo Blog: Foolish Housekeeping and Other Articles',
  'Pathfinder Lost Omens Ancestry Guide',
  'Pathfinder Player Core',
];

describe('publication groups', () => {
  it('exposes the five groups', () => {
    expect(PUBLICATION_GROUPS.map((g) => g.id)).toEqual([
      'adventure-paths', 'ap-players-guides', 'standalone-adventures', 'blogs', 'lost-omens',
    ]);
  });

  it('classifies adventure paths (numbered, named, compilations)', () => {
    const m = getPublicationGroupMembers('adventure-paths', TITLES);
    expect(m).toContain('Pathfinder #219: Lord of the Trinity Star');
    expect(m).toContain('Pathfinder Adventure Path: Gatewalkers');
    expect(m).not.toContain('Pathfinder Player Core');
  });

  it("excludes Advanced Player's Guide from AP player's guides", () => {
    const m = getPublicationGroupMembers('ap-players-guides', TITLES);
    expect(m).toContain("Gatewalkers Player's Guide (Remastered)");
    expect(m).not.toContain("Pathfinder Advanced Player's Guide");
  });

  it('classifies stand-alone adventures and blogs', () => {
    expect(getPublicationGroupMembers('standalone-adventures', TITLES)).toEqual(['Pathfinder Adventure: The Slithering']);
    expect(getPublicationGroupMembers('blogs', TITLES)).toEqual(['Paizo Blog: Foolish Housekeeping and Other Articles']);
  });

  it('classifies lost omens', () => {
    expect(getPublicationGroupMembers('lost-omens', TITLES)).toContain('Pathfinder Lost Omens Ancestry Guide');
  });

  it('returns [] for an unknown group id', () => {
    expect(getPublicationGroupMembers('nope', TITLES)).toEqual([]);
  });

  it('builds chips only for groups with members, with selected/partial state', () => {
    const chips = buildPublicationGroupChips(TITLES, new Set(['Pathfinder #219: Lord of the Trinity Star']));
    const ap = chips.find((c) => c.id === 'adventure-paths');
    expect(ap).toBeTruthy();
    expect(ap.partial).toBe(true);
    expect(ap.selected).toBe(false);
    const onlyCore = buildPublicationGroupChips(['Pathfinder Player Core'], new Set());
    expect(onlyCore.find((c) => c.id === 'blogs')).toBeUndefined();
    expect(onlyCore.find((c) => c.id === 'lost-omens')).toBeUndefined();
  });

  it('marks a group selected when all its members are selected', () => {
    const chips = buildPublicationGroupChips(
      ['Paizo Blog: Foolish Housekeeping and Other Articles'],
      new Set(['Paizo Blog: Foolish Housekeeping and Other Articles']),
    );
    expect(chips.find((c) => c.id === 'blogs').selected).toBe(true);
  });
});
