import { readFileSync } from 'node:fs';

describe('LevelPlanner template', () => {
  function readTemplate() {
    return readFileSync('templates/level-planner.hbs', 'utf8');
  }

  it('places plan actions above the level list', () => {
    const template = readTemplate();
    const actionIndex = template.indexOf('class="sidebar-actions"');
    const levelsIndex = template.indexOf('class="sidebar-levels"');

    expect(actionIndex).toBeGreaterThan(-1);
    expect(levelsIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeLessThan(levelsIndex);
  });

  it('renders visible labels for import and export actions', () => {
    const template = readTemplate();
    const actions = template.slice(
      template.indexOf('class="sidebar-actions"'),
      template.indexOf('class="sidebar-levels"'),
    );

    expect(actions).toContain('{{localize "PF2E_LEVELER.UI.EXPORT"}}');
    expect(actions).toContain('{{localize "PF2E_LEVELER.UI.IMPORT"}}');
  });

  it('renders planned class spells beneath their matching rank rows', () => {
    const template = readTemplate();
    const classSpellSection = template.slice(
      template.indexOf('{{#each classSpellSections}}'),
      template.indexOf('{{#each dedicationSpellSections}}'),
    );

    expect(classSpellSection).toContain('class="spell-slot-planned-row"');
    expect(classSpellSection).toContain('{{#each this.plannedSpells}}');
    expect(classSpellSection).not.toContain('{{localize "PF2E_LEVELER.SPELLS.PLANNED"}}');
    expect(template).not.toContain('{{#if plannedSpells.length}}');
  });

  it('renders signature spell selection controls for spontaneous class sections', () => {
    const template = readTemplate();

    expect(template).toContain('data-action="openSignatureSpellPicker"');
    expect(template).toContain('data-action="removeSignatureSpell"');
  });
});
