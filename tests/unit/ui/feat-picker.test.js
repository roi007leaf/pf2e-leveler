import fs from 'node:fs';
import path from 'node:path';
import { FeatPicker } from '../../../scripts/ui/feat-picker.js';
import * as featCache from '../../../scripts/feats/feat-cache.js';

describe('FeatPicker prerequisite enforcement', () => {
  function createFeat({ name, prereqText, uuid = 'feat-1', slug = 'feat-1' }) {
    return {
      uuid,
      slug,
      name,
      img: 'icons/svg/mystery-man.svg',
      system: {
        level: { value: 2 },
        maxTakable: 1,
        traits: { value: ['archetype'], rarity: 'common' },
        prerequisites: prereqText ? { value: [{ value: prereqText }] } : { value: [] },
      },
    };
  }

  function createBuildState(overrides = {}) {
    return {
      level: 2,
      class: { slug: 'cleric', hp: 8, subclassType: null },
      ancestrySlug: 'human',
      heritageSlug: 'versatile-heritage',
      attributes: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      skills: { athletics: 0, religion: 0 },
      lores: {},
      proficiencies: {},
      equipment: {
        hasShield: false,
        armorCategories: new Set(),
        weaponCategories: new Set(),
        weaponGroups: new Set(),
        weaponTraits: new Set(),
        wieldedMelee: false,
        wieldedRanged: false,
      },
      feats: new Set(),
      deity: null,
      spellcasting: { hasAny: false, traditions: new Set(), focusPool: false, focusPointsMax: 0 },
      classArchetypeDedications: new Set(),
      classFeatures: new Set(),
      ...overrides,
    };
  }

  function createActor() {
    return {
      name: 'Test Character',
      class: { slug: 'cleric' },
      items: {
        filter: jest.fn(() => []),
      },
    };
  }

  test('prepares inactive publication metadata when publications are unrestricted', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [
      createFeat({
        name: 'Feat One',
        uuid: 'feat-1',
        slug: 'feat-1',
        prereqText: null,
      }),
      createFeat({
        name: 'Feat Two',
        uuid: 'feat-2',
        slug: 'feat-2',
        prereqText: null,
      }),
    ];
    picker.allFeats[0].publicationTitle = 'Player Core';
    picker.allFeats[1].publicationTitle = 'Rage of Elements';
    picker.selectedPublications = new Set(['Player Core', 'Rage of Elements']);

    const context = await picker._prepareContext();

    expect(context.filterSections.publications).toEqual(
      expect.objectContaining({
        collapsed: true,
        activeCount: 0,
        summary: '',
      }),
    );
  });

  test('prepares publication metadata with the effective selected count', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [
      createFeat({
        name: 'Feat One',
        uuid: 'feat-1',
        slug: 'feat-1',
        prereqText: null,
      }),
      createFeat({
        name: 'Feat Two',
        uuid: 'feat-2',
        slug: 'feat-2',
        prereqText: null,
      }),
    ];
    picker.allFeats[0].publicationTitle = 'Player Core';
    picker.allFeats[1].publicationTitle = 'Rage of Elements';
    picker.selectedPublications = new Set(['Player Core']);

    const context = await picker._prepareContext();

    expect(context.filterSections.publications).toEqual(
      expect.objectContaining({
        collapsed: true,
        activeCount: 1,
        summary: '1',
      }),
    );
  });

  test('refreshes the publications section during the fast update path when selections change', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [
      createFeat({
        name: 'Feat One',
        uuid: 'feat-1',
        slug: 'feat-1',
        prereqText: null,
      }),
      createFeat({
        name: 'Feat Two',
        uuid: 'feat-2',
        slug: 'feat-2',
        prereqText: null,
      }),
    ];
    picker.allFeats[0].publicationTitle = 'Player Core';
    picker.allFeats[1].publicationTitle = 'Rage of Elements';
    picker.selectedPublications = new Set(['Player Core']);
    picker.filterSections = { publications: true };
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="pf2e-leveler feat-picker">
        <aside class="picker__sidebar">
          <div class="picker__filter-group picker__filter-group--collapsible" data-section="publications">
            <button type="button" class="picker__section-toggle" data-action="toggleFilterSection" data-section="publications" aria-expanded="false">
              <span>Publications</span>
              <span class="picker__section-summary" data-section-summary="publications">(1)</span>
            </button>
            <div class="picker__section-body">
              <input type="text" class="picker__search picker__search--compact" data-action="searchPublications">
              <div class="picker__source-list picker__source-list--stacked">
                <button type="button" class="picker__source-chip picker__source-chip--publication selected" data-action="togglePublication" data-publication="Player Core" data-publication-name="Player Core"><span class="picker__source-chip-label">Player Core</span></button>
                <button type="button" class="picker__source-chip picker__source-chip--publication" data-action="togglePublication" data-publication="Rage of Elements" data-publication-name="Rage of Elements"><span class="picker__source-chip-label">Rage of Elements</span></button>
              </div>
            </div>
          </div>
        </aside>
        <section class="picker__results">
          <div class="feat-list"></div>
          <div class="picker__results-count">2</div>
        </section>
      </div>
    `;

    const renderedContexts = [];
    const renderSpy = jest
      .spyOn(foundry.applications.handlebars, 'renderTemplate')
      .mockImplementation(async (_template, context) => {
        renderedContexts.push(context);
        return `
        <div class="pf2e-leveler feat-picker">
          <aside class="picker__sidebar">
            ${
              context.publicationOptions?.length
                ? `
              <div class="picker__filter-group picker__filter-group--collapsible" data-section="publications">
                <button type="button" class="picker__section-toggle" data-action="toggleFilterSection" data-section="publications" aria-expanded="${context.filterSections.publications.collapsed ? 'false' : 'true'}">
                  <span>Publications</span>
                  <span class="picker__section-summary" data-section-summary="publications">${context.filterSections.publications.activeCount ? `(${context.filterSections.publications.summary})` : ''}</span>
                </button>
                ${
                  context.filterSections.publications.collapsed
                    ? ''
                    : `
                    <div class="picker__section-body">
                      <input type="text" class="picker__search picker__search--compact" data-action="searchPublications">
                      <div class="picker__source-list picker__source-list--stacked">
                        ${(context.publicationOptions ?? [])
                          .map(
                            (entry) => `
                          <button type="button" class="picker__source-chip picker__source-chip--publication ${entry.selected ? 'selected' : ''}" data-action="togglePublication" data-publication="${entry.key}" data-publication-name="${entry.label}"><span class="picker__source-chip-label">${entry.label}</span></button>
                        `,
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                }
              </div>
            `
                : ''
            }
          </aside>
          <section class="picker__results">
            <div class="feat-list">
              ${(context.feats ?? []).map((feat) => `<div class="feat-option" data-uuid="${feat.uuid}">${feat.name}</div>`).join('')}
            </div>
            <div class="picker__results-count">${context.filteredCount}</div>
          </section>
        </div>
      `;
      });

    picker.selectedPublications = new Set(['Player Core', 'Rage of Elements']);
    await picker._updateFeatList();

    expect(renderedContexts).toHaveLength(1);
    expect(renderedContexts[0].publicationOptions).toHaveLength(2);
    expect(renderedContexts[0].filterSections.publications).toEqual(
      expect.objectContaining({
        activeCount: 0,
        summary: '',
      }),
    );
    expect(
      picker.element.querySelector('[data-section-summary="publications"]')?.textContent.trim(),
    ).toBe('');
    expect(
      picker.element.querySelector('[data-section="publications"] .picker__section-body'),
    ).toBeNull();

    renderSpy.mockRestore();
  });

  test('fast updates do not duplicate persistent action bindings', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      multiSelect: true,
    });
    picker.allFeats = [
      createFeat({
        name: 'Feat One',
        uuid: 'feat-1',
        slug: 'feat-1',
        prereqText: null,
      }),
      createFeat({
        name: 'Feat Two',
        uuid: 'feat-2',
        slug: 'feat-2',
        prereqText: null,
      }),
    ];
    picker.allFeats[0].publicationTitle = 'Player Core';
    picker.allFeats[1].publicationTitle = 'Rage of Elements';
    picker.selectedPublications = new Set(['Player Core']);
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="pf2e-leveler feat-picker">
        <aside class="picker__sidebar">
          <button type="button" data-action="toggleSelectAll"></button>
          <button type="button" data-action="confirmSelection"></button>
        </aside>
        <section class="picker__results">
          <div class="feat-list"></div>
          <div class="picker__results-count"></div>
        </section>
      </div>
    `;

    const controller = new AbortController();
    picker._bindActionButtons(picker.element, controller.signal);
    picker._toggleSelectAllVisible = jest.fn();
    picker._updateSelectionUI = jest.fn();

    const renderSpy = jest
      .spyOn(foundry.applications.handlebars, 'renderTemplate')
      .mockImplementation(
        async (_template, context) => `
        <div class="pf2e-leveler feat-picker">
          <aside class="picker__sidebar">
            ${context.publicationOptions?.length ? '<div data-section="publications"></div>' : ''}
          </aside>
          <section class="picker__results">
            <div class="feat-list">
              ${(context.feats ?? [])
                .map(
                  (feat) => `<div class="feat-option" data-uuid="${feat.uuid}">${feat.name}</div>`,
                )
                .join('')}
            </div>
            <div class="picker__results-count">${context.filteredCount}</div>
          </section>
        </div>
      `,
      );

    await picker._updateFeatList();
    picker.selectedPublications = new Set(['Player Core', 'Rage of Elements']);
    await picker._updateFeatList();
    picker.element.querySelector('[data-action="toggleSelectAll"]').click();

    expect(picker._toggleSelectAllVisible).toHaveBeenCalledTimes(1);

    renderSpy.mockRestore();
    controller.abort();
  });

  test('toggling the publication section is reflected in the next prepared context', async () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.render = jest.fn();
    picker.filterSections = { publications: true };
    picker.selectedPublications = new Set(['Player Core']);

    const root = document.createElement('div');
    root.innerHTML = `
      <button type="button" data-action="toggleFilterSection" data-section="publications"></button>
    `;

    const controller = new AbortController();
    picker._bindActionButtons(root, controller.signal);
    root.querySelector('[data-action="toggleFilterSection"]').click();

    expect(picker.filterSections.publications).toBe(false);
    expect([...picker.selectedPublications]).toEqual(['Player Core']);
    expect(picker.render).toHaveBeenCalledWith(false);

    picker.allFeats = [
      createFeat({
        name: 'Feat One',
        uuid: 'feat-1',
        slug: 'feat-1',
        prereqText: null,
        publicationTitle: 'Player Core',
      }),
      createFeat({
        name: 'Feat Two',
        uuid: 'feat-2',
        slug: 'feat-2',
        prereqText: null,
        publicationTitle: 'Rage of Elements',
      }),
    ];
    picker.allFeats[0].publicationTitle = 'Player Core';
    picker.allFeats[1].publicationTitle = 'Rage of Elements';
    const context = await picker._prepareContext();

    expect(context.filterSections.publications).toEqual(
      expect.objectContaining({
        collapsed: false,
        activeCount: 1,
        summary: '1',
      }),
    );

    controller.abort();
  });

  test('feat picker template uses compact labels and a collapsible publications section', () => {
    const template = fs.readFileSync(path.join(process.cwd(), 'templates/feat-picker.hbs'), 'utf8');

    expect(template).not.toContain('PF2E_LEVELER.CREATION.SEARCH');
    expect(template.match(/PF2E_LEVELER\.SPELLS\.TRAIT_FILTER/g)).toHaveLength(1);
    expect(template.match(/PF2E_LEVELER\.FEAT_PICKER\.SKILL_FILTER/g)).toHaveLength(1);
    expect(template).toContain('picker__filter-group--compact');
    expect(template).toContain('picker__filter-group--utility');
    expect(template).toContain('picker__filter-group--collapsible');
    expect(template).toContain('data-action="toggleFilterSection"');
    expect(template).toContain('data-section="publications"');
    expect(template).toContain('data-section-summary="publications"');
    expect(template).toContain('picker__section-chevron');
    expect(template).toContain('picker__search picker__search--compact');
    expect(template).toContain('picker__source-list picker__source-list--compact');
    expect(template).toContain('class="picker__select picker__select--compact"');
    expect(template).toContain('{{#unless filterSections.publications.collapsed}}');
  });

  test('unknown narrative prerequisites are shown but do not block selection', () => {
    const feat = createFeat({
      name: 'Vampire Dedication',
      prereqText: 'You were killed by a vampire drinking your blood.',
      uuid: 'vampire-dedication',
      slug: 'vampire-dedication',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('mechanically unmet prerequisites still block selection when enforcement is enabled', () => {
    const feat = createFeat({
      name: 'Heavy Armor Trick',
      prereqText: 'wearing heavy armor',
      uuid: 'heavy-armor-trick',
      slug: 'heavy-armor-trick',
    });

    const picker = new FeatPicker(createActor(), 'archetype', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Heavy Armor Trick');
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('mechanical alternative prerequisites do not block selection when one branch is met', () => {
    const feat = createFeat({
      name: 'Break Curse',
      prereqText: 'master in Occultism or Religion',
      uuid: 'break-curse',
      slug: 'break-curse',
    });
    feat.system.level.value = 7;
    feat.system.traits.value = ['skill', 'general'];

    const picker = new FeatPicker(
      createActor(),
      'general',
      7,
      createBuildState({
        level: 7,
        skills: { athletics: 0, religion: 3, occultism: 0 },
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.prereqResults).toHaveLength(2);
    expect(result.prereqResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'master in Occultism', met: false }),
        expect.objectContaining({ text: 'master in Religion', met: true }),
      ]),
    );
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('mechanical alternative prerequisites render as a grouped prerequisite cluster', () => {
    const feat = createFeat({
      name: 'Break Curse',
      prereqText: 'master in Occultism or Religion',
      uuid: 'break-curse',
      slug: 'break-curse',
    });
    feat.system.level.value = 7;
    feat.system.traits.value = ['skill', 'general'];

    const picker = new FeatPicker(
      createActor(),
      'general',
      7,
      createBuildState({
        level: 7,
        skills: { athletics: 0, religion: 3, occultism: 0 },
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();
    const templated = picker._toTemplateFeat(result);

    expect(templated.prereqGroups).toHaveLength(1);
    expect(templated.prereqGroups[0]).toEqual(
      expect.objectContaining({
        grouped: true,
      }),
    );
    expect(templated.prereqGroups[0].items).toHaveLength(2);
    expect(templated.prereqGroups[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Master In Occultism', met: false }),
        expect.objectContaining({ text: 'Master In Religion', met: true }),
      ]),
    );
  });

  test('signature trick prerequisites are shown as unknown and do not block selection', () => {
    const feat = createFeat({
      name: 'Additional Circus Trick',
      prereqText: 'You Must Have A Signature Trick',
      uuid: 'additional-circus-trick',
      slug: 'additional-circus-trick',
    });

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      3,
      createBuildState({ level: 3 }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBeNull();
    expect(result.hasUnknownPrerequisites).toBe(true);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('multi-ancestry feat selection prerequisites pass with adopted ancestry in build state', () => {
    const feat = createFeat({
      name: 'Different Worlds',
      prereqText: 'Ability To Select Ancestry Feats From Multiple Ancestries',
      uuid: 'different-worlds',
      slug: 'different-worlds',
    });

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      2,
      createBuildState({
        level: 2,
        feats: new Set(['adopted-ancestry']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBe(true);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('Recall Knowledge skill prerequisites pass when the build has a trained applicable skill', () => {
    const feat = createFeat({
      name: 'Dubious Knowledge',
      prereqText: 'Trained in a skill with the Recall Knowledge action',
      uuid: 'dubious-knowledge',
      slug: 'dubious-knowledge',
    });

    const picker = new FeatPicker(
      createActor(),
      'skill',
      2,
      createBuildState({
        skills: { athletics: 0, religion: 1 },
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result.prereqResults).toHaveLength(1);
    expect(result.prereqResults[0].met).toBe(true);
    expect(result.hasUnknownPrerequisites).toBe(false);
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('archetype additional feats stay visible but respect their native prerequisites', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: 'trap-finder',
    });
    feat.system.traits.value = ['rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      4,
      createBuildState({
        level: 4,
        feats: new Set(['archaeologist-dedication']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['trap-finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('archetype additional feats remain visible under locked archetype trait filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      4,
      createBuildState({
        level: 4,
        feats: new Set(['dual-weapon-warrior-dedication']),
      }),
      jest.fn(),
      {
        preset: {
          selectedTraits: ['archetype', 'dedication'],
          lockedTraits: ['archetype', 'dedication'],
          traitLogic: 'or',
        },
      },
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('archetype additional feats inherit their dedication archetype trait for filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      4,
      createBuildState({
        level: 4,
        feats: new Set(['dual-weapon-warrior-dedication']),
      }),
      jest.fn(),
      {
        preset: {
          selectedTraits: ['dual-weapon-warrior'],
          lockedTraits: ['dual-weapon-warrior'],
        },
      },
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);
    picker.additionalArchetypeFeatTraits = new Map([
      ['quick-draw', new Set(['dual-weapon-warrior'])],
    ]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('archetype additional feats count as archetype feat type for locked feat-type filtering', () => {
    const feat = createFeat({
      name: 'Quick Draw',
      uuid: 'Compendium.pf2e.feats-srd.Item.quick-draw',
      slug: 'quick-draw',
    });
    feat.system.traits.value = ['fighter'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      4,
      createBuildState({
        level: 4,
        feats: new Set(['dual-weapon-warrior-dedication']),
      }),
      jest.fn(),
      {
        preset: {
          selectedFeatTypes: ['archetype'],
          lockedFeatTypes: ['archetype'],
        },
      },
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['quick-draw', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Quick Draw');
  });

  test('class feat picker preset hides dedication toggle and keeps archetype feat type selected', async () => {
    const classFeat = createFeat({
      name: 'Power Attack',
      uuid: 'class-power-attack',
      slug: 'power-attack',
    });
    classFeat.system.traits.value = ['cleric'];
    const archetypeFeat = createFeat({
      name: 'Medic Dedication',
      uuid: 'medic-dedication',
      slug: 'medic-dedication',
    });
    archetypeFeat.system.traits.value = ['archetype', 'dedication', 'medic'];

    const picker = new FeatPicker(createActor(), 'class', 4, createBuildState(), jest.fn(), {
      preset: {
        selectedFeatTypes: ['class', 'archetype'],
        lockedFeatTypes: ['class'],
        extraVisibleFeatTypes: ['archetype'],
      },
    });
    picker.allFeats = [classFeat, archetypeFeat];

    const context = await picker._prepareContext();

    expect([...picker.selectedFeatTypes].sort()).toEqual(['archetype', 'class']);
    expect([...picker.lockedFeatTypes]).toEqual(['class']);
    expect(context.featTypeOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'class', locked: true, selected: true }),
        expect.objectContaining({ value: 'archetype', locked: false, selected: true }),
      ]),
    );
  });

  test('free archetype preset can show locked dedication trait chip with no-entry icon while dedication toggle stays hidden', async () => {
    const archetypeFeat = createFeat({
      name: 'Medic Dedication',
      uuid: 'medic-dedication',
      slug: 'medic-dedication',
    });
    archetypeFeat.system.traits.value = ['archetype', 'dedication', 'medic'];

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState(), jest.fn(), {
      preset: {
        selectedFeatTypes: ['archetype'],
        lockedFeatTypes: ['archetype'],
        selectedTraits: ['archetype'],
        excludedTraits: ['dedication'],
        lockedTraits: ['archetype', 'dedication'],
        traitLogic: 'and',
      },
    });
    picker.allFeats = [archetypeFeat];

    const context = await picker._prepareContext();

    expect(context.traitLogic).toBe('and');
    expect(context.selectedTraitChips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'archetype',
          excluded: false,
          locked: true,
        }),
        expect.objectContaining({
          value: 'dedication',
          excluded: true,
          locked: true,
        }),
      ]),
    );
  });

  test('free archetype dedication trait narrows archetypes when re-enabled', () => {
    const dedicationFeat = createFeat({
      name: 'Medic Dedication',
      uuid: 'medic-dedication',
      slug: 'medic-dedication',
    });
    dedicationFeat.system.traits.value = ['archetype', 'dedication', 'medic'];

    const followupFeat = createFeat({
      name: 'Treat Condition',
      uuid: 'treat-condition',
      slug: 'treat-condition',
    });
    followupFeat.system.traits.value = ['archetype', 'medic'];

    const picker = new FeatPicker(createActor(), 'archetype', 4, createBuildState(), jest.fn(), {
      preset: {
        selectedFeatTypes: ['archetype'],
        lockedFeatTypes: ['archetype'],
        selectedTraits: ['archetype'],
        lockedTraits: ['archetype', 'dedication'],
        traitLogic: 'and',
      },
    });
    picker.allFeats = [dedicationFeat, followupFeat];

    picker.excludedTraits = new Set(['dedication']);
    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Treat Condition']);

    picker.excludedTraits.clear();
    picker.selectedTraits.add('dedication');
    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Medic Dedication']);
  });

  test('locked trait chips can still toggle between included and excluded states', () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        selectedTraits: ['dedication'],
        lockedTraits: ['dedication'],
      },
    });

    const root = document.createElement('div');
    root.innerHTML = `
      <button type="button" data-action="toggleTraitExclude" data-trait="dedication"></button>
      <button type="button" data-action="removeTraitChip" data-trait="dedication"></button>
    `;
    const controller = new AbortController();

    picker._bindTraitChipListeners(root, controller.signal);

    root.querySelector('[data-action="toggleTraitExclude"]').click();
    expect([...picker.selectedTraits]).toEqual([]);
    expect([...picker.excludedTraits]).toEqual(['dedication']);

    root.querySelector('[data-action="toggleTraitExclude"]').click();
    expect([...picker.selectedTraits]).toEqual(['dedication']);
    expect([...picker.excludedTraits]).toEqual([]);

    root.querySelector('[data-action="removeTraitChip"]').click();
    expect([...picker.selectedTraits]).toEqual(['dedication']);
    expect([...picker.excludedTraits]).toEqual([]);

    controller.abort();
  });

  test('template feats expose dedication unlock level for additional archetype feats', () => {
    const feat = createFeat({
      name: 'Twin Parry',
      uuid: 'Compendium.pf2e.feats-srd.Item.twin-parry',
      slug: 'twin-parry',
    });
    feat.system.traits.value = ['fighter', 'ranger'];
    feat.system.level.value = 4;

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      6,
      createBuildState({
        level: 6,
        feats: new Set(['dual-weapon-warrior-dedication']),
      }),
      jest.fn(),
    );
    picker.additionalArchetypeFeatLevels = new Map([['twin-parry', 6]]);

    const templated = picker._toTemplateFeat(feat);

    expect(templated.isAdditionalArchetypeFeat).toBe(true);
    expect(templated.additionalArchetypeUnlockLevel).toBe(6);
  });

  test('custom feat picker treats dedication additional feats as archetype feats for filtering', () => {
    const feat = createFeat({
      name: 'Twin Parry',
      uuid: 'Compendium.pf2e.feats-srd.Item.twin-parry',
      slug: 'twin-parry',
    });
    feat.system.traits.value = ['fighter', 'ranger'];
    feat.system.level.value = 4;

    const picker = new FeatPicker(
      createActor(),
      'custom',
      6,
      createBuildState({
        level: 6,
        feats: new Set(['dual-weapon-warrior-dedication']),
      }),
      jest.fn(),
      {
        preset: {
          selectedFeatTypes: ['archetype'],
          lockedFeatTypes: ['archetype'],
          selectedTraits: ['archetype', 'dedication'],
          lockedTraits: ['archetype', 'dedication'],
          traitLogic: 'or',
        },
      },
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['twin-parry', 6]]);
    picker.additionalArchetypeFeatTraits = new Map([
      ['twin-parry', new Set(['dual-weapon-warrior'])],
    ]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.name).toBe('Twin Parry');
    expect(picker._getFeatTypes(feat)).toContain('archetype');
    expect(picker._getTraitFilterValues(feat)).toEqual(
      expect.arrayContaining(['archetype', 'dual-weapon-warrior']),
    );
  });

  test('skill-tagged dedication additional feats do not gain virtual archetype type or trait filtering', () => {
    const feat = createFeat({
      name: 'Graceful Leaper',
      uuid: 'Compendium.pf2e.feats-srd.Item.graceful-leaper',
      slug: 'graceful-leaper',
    });
    feat.system.traits.value = ['archetype', 'skill'];
    feat.system.level.value = 7;

    const picker = new FeatPicker(
      createActor(),
      'custom',
      7,
      createBuildState({
        level: 7,
        feats: new Set(['acrobat-dedication']),
      }),
      jest.fn(),
    );
    picker.additionalArchetypeFeatLevels = new Map([['graceful-leaper', 7]]);
    picker.additionalArchetypeFeatTraits = new Map([['graceful-leaper', new Set(['acrobat'])]]);

    expect(picker._getFeatTypes(feat)).not.toContain('archetype');
    expect(picker._getFeatTypes(feat)).toContain('skill');
    expect(picker._getTraitFilterValues(feat)).not.toContain('archetype');
    expect(picker._getTraitFilterValues(feat)).toEqual(
      expect.arrayContaining(['skill', 'acrobat']),
    );
  });

  test('dedication-unlocked archetype feats still respect unrelated failed prerequisites', () => {
    const feat = createFeat({
      name: 'Holistic Care',
      prereqText: 'trained in Diplomacy, Treat Condition',
      uuid: 'Compendium.pf2e.feats-srd.Item.holistic-care',
      slug: 'holistic-care',
    });
    feat.system.traits.value = ['archetype', 'skill'];
    feat.system.level.value = 6;

    const picker = new FeatPicker(
      createActor(),
      'skill',
      6,
      createBuildState({
        level: 6,
        skills: { athletics: 0, religion: 0, diplomacy: 0 },
        feats: new Set(['medic-dedication', 'treat-condition']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['holistic-care', 6]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.selectionBlocked).toBe(true);
    expect(
      result.prereqResults.some(
        (entry) => entry.text.toLowerCase().includes('trained in diplomacy') && entry.met === false,
      ),
    ).toBe(true);
  });

  test('archetype-unlocked skill feats stay visible in the general picker when skill feats are enabled', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: 'trap-finder',
    });
    feat.system.traits.value = ['skill', 'rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'general',
      7,
      createBuildState({
        level: 7,
        feats: new Set(['archaeologist-dedication']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];
    picker.showSkillFeats = true;
    picker.additionalArchetypeFeatLevels = new Map([['trap-finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.hasFailedPrerequisites).toBe(true);
    expect(result.prerequisitesFailed).toBe(true);
    expect(result.selectionBlocked).toBe(true);
  });

  test('archetype additional feat matching through normalized fallback keys still respects prerequisites', () => {
    const feat = createFeat({
      name: 'Trap Finder',
      prereqText: 'master in Thievery',
      uuid: 'Compendium.pf2e.feats-srd.Item.oA866uVEFu1OrAX0',
      slug: '',
    });
    feat.system.traits.value = ['skill', 'rogue'];
    feat.system.level.value = 1;

    const picker = new FeatPicker(
      createActor(),
      'class',
      6,
      createBuildState({
        level: 6,
        feats: new Set(['archaeologist-dedication']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['name:trap finder', 4]]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(true);
  });

  test('archetype additional feats can satisfy dedication prerequisites via their unlocking archetype', () => {
    const feat = createFeat({
      name: 'Reactive Striker',
      prereqText: 'Fighter Dedication',
      uuid: 'Compendium.pf2e.feats-srd.Item.reactive-striker',
      slug: 'reactive-striker',
    });
    feat.system.level.value = 4;
    feat.system.traits.value = ['archetype'];

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      6,
      createBuildState({
        level: 6,
        feats: new Set(['blackjacket-dedication']),
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];
    picker.additionalArchetypeFeatLevels = new Map([['reactive-striker', 6]]);
    picker.additionalArchetypeFeatTraits = new Map([
      ['reactive-striker', new Set(['blackjacket'])],
    ]);

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.prereqResults).toEqual(
      expect.arrayContaining([expect.objectContaining({ met: true })]),
    );
    expect(result.prereqResults[0].text).toContain('Blackjacket Dedication');
    expect(result.hasFailedPrerequisites).toBe(false);
    expect(result.prerequisitesFailed).toBe(false);
    expect(result.selectionBlocked).toBe(false);
  });

  test('custom feat picker can filter by multiple feat types', () => {
    const classFeat = createFeat({
      name: 'Power Attack',
      uuid: 'power-attack',
      slug: 'power-attack',
    });
    classFeat.system.traits.value = ['cleric'];

    const skillFeat = createFeat({
      name: 'Battle Medicine',
      uuid: 'battle-medicine',
      slug: 'battle-medicine',
    });
    skillFeat.system.traits.value = ['skill'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [classFeat, skillFeat];
    picker.selectedFeatTypes = new Set(['class']);

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Power Attack']);

    picker.selectedFeatTypes = new Set(['class', 'skill']);
    expect(picker._applyFilters().map((feat) => feat.name)).toEqual([
      'Battle Medicine',
      'Power Attack',
    ]);
  });

  test('can filter feats by a min and max level range', () => {
    const lowFeat = createFeat({
      name: 'Low Feat',
      uuid: 'low-feat',
      slug: 'low-feat',
    });
    lowFeat.system.level.value = 1;
    lowFeat.system.traits.value = ['cleric'];

    const midFeat = createFeat({
      name: 'Mid Feat',
      uuid: 'mid-feat',
      slug: 'mid-feat',
    });
    midFeat.system.level.value = 4;
    midFeat.system.traits.value = ['cleric'];

    const highFeat = createFeat({
      name: 'High Feat',
      uuid: 'high-feat',
      slug: 'high-feat',
    });
    highFeat.system.level.value = 8;
    highFeat.system.traits.value = ['cleric'];

    const picker = new FeatPicker(
      createActor(),
      'custom',
      8,
      createBuildState({ level: 8 }),
      jest.fn(),
    );
    picker.allFeats = [lowFeat, midFeat, highFeat];
    picker.minLevel = '2';
    picker.maxLevel = '6';

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Mid Feat']);
  });

  test('defaults max level filter to the picker target level', async () => {
    const picker = new FeatPicker(
      createActor(),
      'custom',
      7,
      createBuildState({ level: 7 }),
      jest.fn(),
    );
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(picker.maxLevel).toBe('7');
    expect(context.maxLevel).toBe('7');
  });

  test('required skill filters still enforce feat limitations even if visible skill chips change', () => {
    const deceptionFeat = createFeat({
      name: 'Charming Liar',
      uuid: 'charming-liar',
      slug: 'charming-liar',
    });
    deceptionFeat.system.level.value = 3;
    deceptionFeat.system.traits.value = ['skill'];
    deceptionFeat.system.prerequisites.value = [{ value: 'trained in Deception' }];

    const arcanaFeat = createFeat({
      name: 'Arcane Sense',
      uuid: 'arcane-sense',
      slug: 'arcane-sense',
    });
    arcanaFeat.system.level.value = 3;
    arcanaFeat.system.traits.value = ['skill'];
    arcanaFeat.system.prerequisites.value = [{ value: 'trained in Arcana' }];

    const picker = new FeatPicker(
      createActor(),
      'skill',
      3,
      createBuildState({ level: 3 }),
      jest.fn(),
      {
        preset: {
          requiredSkills: ['deception', 'diplomacy'],
          selectedSkills: ['deception', 'diplomacy'],
        },
      },
    );
    picker.allFeats = [deceptionFeat, arcanaFeat];
    picker.selectedSkills.clear();

    expect(picker._applyFilters().map((feat) => feat.slug)).toEqual(['charming-liar']);
  });

  test('custom feat picker starts with all rarities enabled regardless of hide settings', () => {
    global._testSettings = {
      ...(global._testSettings ?? {}),
      'pf2e-leveler': {
        ...(global._testSettings?.['pf2e-leveler'] ?? {}),
        hideUncommonFeats: true,
        hideRareFeats: true,
      },
    };

    const commonFeat = createFeat({
      name: 'Common Feat',
      uuid: 'common-feat',
      slug: 'common-feat',
    });
    commonFeat.system.traits.value = ['general'];
    commonFeat.system.traits.rarity = 'common';

    const uncommonFeat = createFeat({
      name: 'Uncommon Feat',
      uuid: 'uncommon-feat',
      slug: 'uncommon-feat',
    });
    uncommonFeat.system.traits.value = ['general'];
    uncommonFeat.system.traits.rarity = 'uncommon';

    const rareFeat = createFeat({
      name: 'Rare Feat',
      uuid: 'rare-feat',
      slug: 'rare-feat',
    });
    rareFeat.system.traits.value = ['general'];
    rareFeat.system.traits.rarity = 'rare';

    const picker = new FeatPicker(
      createActor(),
      'custom',
      6,
      createBuildState({ level: 6 }),
      jest.fn(),
    );
    picker.allFeats = [commonFeat, uncommonFeat, rareFeat];

    expect([...picker.selectedRarities].sort()).toEqual(['common', 'rare', 'uncommon', 'unique']);
    expect(picker._applyFilters().map((feat) => feat.name)).toEqual([
      'Common Feat',
      'Rare Feat',
      'Uncommon Feat',
    ]);
  });

  test('hides rarity chips that have no feats in the current non-rarity view', async () => {
    const commonFeat = createFeat({
      name: 'Common Feat',
      uuid: 'common-feat',
      slug: 'common-feat',
    });
    commonFeat.system.level.value = 4;
    commonFeat.system.traits.value = ['general'];
    commonFeat.system.traits.rarity = 'common';

    const rareFeat = createFeat({
      name: 'Rare Feat',
      uuid: 'rare-feat',
      slug: 'rare-feat',
    });
    rareFeat.system.level.value = 6;
    rareFeat.system.traits.value = ['general'];
    rareFeat.system.traits.rarity = 'rare';

    const picker = new FeatPicker(
      createActor(),
      'custom',
      6,
      createBuildState({ level: 6 }),
      jest.fn(),
    );
    picker.allFeats = [commonFeat, rareFeat];
    picker.maxLevel = '4';

    const context = await picker._prepareContext();

    expect(context.rarityOptions.map((entry) => entry.value)).toEqual(['common']);
  });

  test('restricts custom feat picker results to allowed feat uuids from a preset', () => {
    const allowedFeat = createFeat({
      name: 'Allowed Feat',
      uuid: 'Compendium.test.feats.Item.allowed',
      slug: 'allowed-feat',
    });
    allowedFeat.system.traits.value = ['general'];

    const blockedFeat = createFeat({
      name: 'Blocked Feat',
      uuid: 'Compendium.test.feats.Item.blocked',
      slug: 'blocked-feat',
    });
    blockedFeat.system.traits.value = ['general'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        allowedFeatUuids: ['Compendium.test.feats.Item.allowed'],
      },
    });
    picker.allFeats = [allowedFeat, blockedFeat];

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Allowed Feat']);
  });

  test('surfaces allowed class feats that do not match the actor class trait', async () => {
    const guardianFeat = createFeat({
      name: 'Intercept Foe',
      uuid: 'Compendium.pf2e.feats-srd.Item.intercept-foe',
      slug: 'intercept-foe',
    });
    guardianFeat.system.traits.value = ['guardian'];
    guardianFeat.system.category = 'class';
    game.packs.get.mockImplementation((key) =>
      key === 'pf2e.feats-srd' ? { getDocuments: jest.fn(async () => []) } : null);

    const picker = new FeatPicker(
      createActor(),
      'class',
      2,
      createBuildState({ level: 2 }),
      jest.fn(),
      {
        preset: {
          allowedFeatUuids: [guardianFeat.uuid],
          minLevel: 1,
          maxLevel: 2,
          lockMinLevel: true,
          lockMaxLevel: true,
        },
      },
    );
    picker._loadDirectlyAllowedFeats = jest.fn(async () => [guardianFeat]);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await picker._initializeFeats();
    } finally {
      warnSpy.mockRestore();
    }

    expect(picker._applyFilters().map((feat) => feat.name)).toEqual(['Intercept Foe']);
  });

  test('marks required allowed feats with a subclass limitation badge', () => {
    const feat = {
      uuid: 'Compendium.test.feats.Item.allowed',
      slug: 'battle-harbinger-dedication',
      name: 'Battle Harbinger Dedication',
      img: 'icons/svg/mystery-man.svg',
      system: {
        level: { value: 2 },
        maxTakable: 1,
        traits: { value: ['archetype', 'dedication', 'class'], rarity: 'common' },
        prerequisites: { value: [] },
      },
    };

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        allowedFeatUuids: ['Compendium.test.feats.Item.allowed'],
        requiredFeatLimitation: true,
      },
    });
    picker.allFeats = [feat];

    const [result] = picker._applyFilters().map((entry) => picker._toTemplateFeat(entry));

    expect(result.hasSelectionLimitationBadge).toBe(true);
  });

  test('disables level filters when the preset locks them', async () => {
    const picker = new FeatPicker(
      createActor(),
      'custom',
      3,
      createBuildState({ level: 3 }),
      jest.fn(),
      {
        preset: {
          minLevel: 1,
          maxLevel: 1,
          lockMinLevel: true,
          lockMaxLevel: true,
        },
      },
    );
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(context.minLevel).toBe('1');
    expect(context.maxLevel).toBe('1');
    expect(context.minLevelLocked).toBe(true);
    expect(context.maxLevelLocked).toBe(true);
  });

  test('uses a custom picker title when provided', () => {
    const picker = new FeatPicker(
      createActor(),
      'custom',
      3,
      createBuildState({ level: 3 }),
      jest.fn(),
      {
        title: 'General Training | Select a 1st-level general feat.',
      },
    );

    expect(picker.title).toBe('General Training | Select a 1st-level general feat.');
  });

  test('level range options are capped at the picker target level', async () => {
    const picker = new FeatPicker(
      createActor(),
      'custom',
      4,
      createBuildState({ level: 4 }),
      jest.fn(),
    );
    picker.allFeats = [];

    const context = await picker._prepareContext();

    expect(context.levelOptions.map((entry) => entry.value)).toEqual(['1', '2', '3', '4']);
  });

  test('supports multi-select confirmation for custom feat picking', async () => {
    const classFeat = createFeat({
      name: 'Power Attack',
      uuid: 'power-attack',
      slug: 'power-attack',
    });
    classFeat.system.traits.value = ['cleric'];

    const skillFeat = createFeat({
      name: 'Battle Medicine',
      uuid: 'battle-medicine',
      slug: 'battle-medicine',
    });
    skillFeat.system.traits.value = ['skill'];

    const onSelect = jest.fn();
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), onSelect, {
      multiSelect: true,
    });
    picker.allFeats = [classFeat, skillFeat];
    await picker._prepareContext();
    picker.close = jest.fn();

    picker._toggleSelectedFeat('power-attack');
    picker._toggleSelectedFeat('battle-medicine');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ uuid: 'battle-medicine', name: 'Battle Medicine' }),
      expect.objectContaining({ uuid: 'power-attack', name: 'Power Attack' }),
    ]);
    expect(picker.close).toHaveBeenCalled();
  });

  test('keeps rarity chips rendered after a list update', async () => {
    const commonFeat = createFeat({
      name: 'Common Feat',
      uuid: 'common-feat',
      slug: 'common-feat',
    });
    commonFeat.system.traits.value = ['general'];
    commonFeat.system.traits.rarity = 'common';

    const rareFeat = createFeat({
      name: 'Rare Feat',
      uuid: 'rare-feat',
      slug: 'rare-feat',
    });
    rareFeat.system.traits.value = ['general'];
    rareFeat.system.traits.rarity = 'rare';

    const picker = new FeatPicker(
      createActor(),
      'custom',
      6,
      createBuildState({ level: 6 }),
      jest.fn(),
    );
    picker.allFeats = [commonFeat, rareFeat];
    picker.element = document.createElement('div');
    picker.element.innerHTML = `
      <div class="pf2e-leveler feat-picker">
        <div data-role="rarity-chips"></div>
        <div class="feat-list"></div>
        <div class="picker__results-count"></div>
      </div>
    `;

    const renderSpy = jest
      .spyOn(foundry.applications.handlebars, 'renderTemplate')
      .mockImplementation(
        async (_template, context) => `
      <div class="pf2e-leveler feat-picker">
        <div data-role="rarity-chips">${(context.rarityOptions ?? []).map((entry) => `<button data-action="toggleRarityChip" data-rarity="${entry.value}">${entry.label}</button>`).join('')}</div>
        <div class="feat-list"></div>
      </div>
    `,
      );

    await picker._prepareContext();
    await picker._updateFeatList();

    expect(renderSpy).toHaveBeenCalled();
    expect(
      picker.element.querySelectorAll(
        '[data-role="rarity-chips"] [data-action="toggleRarityChip"]',
      ),
    ).toHaveLength(2);

    renderSpy.mockRestore();
  });

  test('uses sourceId fallback when feat uuid is missing', async () => {
    const feat = createFeat({
      name: 'Fallback Feat',
      slug: 'fallback-feat',
    });
    feat.uuid = '';
    feat.sourceId = 'Compendium.test.feats.Item.fallbackFeat';

    const onSelect = jest.fn();
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), onSelect, {
      multiSelect: true,
    });
    picker.allFeats = [feat];

    const context = await picker._prepareContext();
    expect(context.feats[0].uuid).toBe('Compendium.test.feats.Item.fallbackFeat');

    picker._toggleSelectedFeat('Compendium.test.feats.Item.fallbackFeat');
    await picker._confirmSelection();

    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceId: 'Compendium.test.feats.Item.fallbackFeat',
        name: 'Fallback Feat',
      }),
    ]);
  });

  test('commits typed trait input for feat filtering', () => {
    const feat = createFeat({
      name: 'Attack Feat',
      uuid: 'attack-feat',
      slug: 'attack-feat',
    });
    feat.system.traits.value = ['attack'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [feat];

    picker._commitTraitInput({ value: 'attack' });

    expect([...picker.selectedTraits]).toEqual(['attack']);
    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Attack Feat']);
  });

  test('excluded trait filters out feats containing that trait', () => {
    const attackFeat = createFeat({
      name: 'Attack Feat',
      uuid: 'attack-feat',
      slug: 'attack-feat',
    });
    attackFeat.system.traits.value = ['attack'];

    const concentrateFeat = createFeat({
      name: 'Concentrate Feat',
      uuid: 'concentrate-feat',
      slug: 'concentrate-feat',
    });
    concentrateFeat.system.traits.value = ['concentrate'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [attackFeat, concentrateFeat];
    picker.excludedTraits = new Set(['attack']);

    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Concentrate Feat']);
  });

  test('excluded trait preset initializes exclusion filter state', () => {
    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn(), {
      preset: {
        excludedTraits: ['attack'],
      },
    });

    expect([...picker.excludedTraits]).toEqual(['attack']);
  });

  test('search filters by feat title instead of matching trait text', () => {
    const matchingName = createFeat({
      name: 'Skill Training',
      uuid: 'skill-training',
      slug: 'skill-training',
    });
    matchingName.system.traits.value = ['general'];

    const traitOnly = createFeat({
      name: 'Unrelated Feat',
      uuid: 'unrelated-feat',
      slug: 'unrelated-feat',
    });
    traitOnly.system.traits.value = ['skill'];

    const picker = new FeatPicker(createActor(), 'custom', 2, createBuildState(), jest.fn());
    picker.allFeats = [matchingName, traitOnly];
    picker.searchText = 'skill';

    expect(picker._applyFilters().map((entry) => entry.name)).toEqual(['Skill Training']);
  });

  test('new dedication feats are not blocked in the custom all-feats picker', () => {
    const feat = createFeat({
      name: 'Pirate Dedication',
      uuid: 'pirate-dedication',
      slug: 'pirate-dedication',
    });
    feat.system.traits.value = ['archetype', 'dedication'];

    const picker = new FeatPicker(
      createActor(),
      'custom',
      4,
      createBuildState({
        level: 4,
        archetypeDedications: new Set(['medic-dedication']),
        canTakeNewArchetypeDedication: false,
      }),
      jest.fn(),
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(false);
  });

  test('free archetype picker can ignore dedication lock when the preset requests it', () => {
    const feat = createFeat({
      name: 'Pirate Dedication',
      uuid: 'pirate-dedication',
      slug: 'pirate-dedication',
    });
    feat.system.traits.value = ['archetype', 'dedication'];

    const picker = new FeatPicker(
      createActor(),
      'archetype',
      4,
      createBuildState({
        level: 4,
        archetypeDedications: new Set(['medic-dedication']),
        canTakeNewArchetypeDedication: false,
      }),
      jest.fn(),
      {
        preset: {
          ignoreDedicationLock: true,
          selectedTraits: ['archetype', 'dedication'],
          lockedTraits: ['archetype', 'dedication'],
          traitLogic: 'or',
        },
      },
    );
    picker.allFeats = [feat];

    const [result] = picker._applyFilters();

    expect(result).toBeDefined();
    expect(result.selectionBlocked).toBe(false);
    expect(
      result.prereqResults.some((entry) =>
        String(entry.text ?? '').includes('Complete your current dedication'),
      ),
    ).toBe(false);
  });

  test('custom picker surfaces allowed classfeature documents even when feat cache excludes them', async () => {
    const classfeature = {
      uuid: 'Compendium.pf2e.classfeatures.Item.school-of-thassilonian-rune-magic-envy',
      slug: 'school-of-thassilonian-rune-magic-envy',
      name: 'Envy',
      img: 'envy.png',
      type: 'classfeature',
      system: {
        level: { value: 1 },
        maxTakable: 1,
        traits: { value: [], rarity: 'common' },
        prerequisites: { value: [] },
      },
    };

    jest.spyOn(featCache, 'getCachedFeats').mockReturnValue([]);
    jest.spyOn(featCache, 'loadFeats').mockResolvedValue([]);
    global.fromUuid = jest.fn(async (uuid) => (uuid === classfeature.uuid ? classfeature : null));

    const picker = new FeatPicker(
      createActor(),
      'custom',
      1,
      createBuildState({ level: 1 }),
      jest.fn(),
      {
        preset: {
          allowedFeatUuids: [classfeature.uuid],
          minLevel: 1,
          maxLevel: 1,
          lockMinLevel: true,
          lockMaxLevel: true,
        },
      },
    );

    await picker._initializeFeats();
    const context = await picker._prepareContext();

    expect(context.feats).toEqual([
      expect.objectContaining({
        uuid: classfeature.uuid,
        name: 'Envy',
      }),
    ]);
  });
});
