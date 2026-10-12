import { createCreationData, setClass, setDualClass, setFlexiblePreparation } from '../../../scripts/creation/creation-model.js';
import { buildFlexiblePreparationOptions } from '../../../scripts/ui/character-wizard/spells.js';
import { activateCharacterWizardListeners } from '../../../scripts/ui/character-wizard/listeners.js';

describe('flexible preparation creation choices', () => {
  it('persists checkbox changes for the selected class target', () => {
    const data = createCreationData();
    setClass(data, { slug: 'wizard', name: 'Wizard' });
    setDualClass(data, { slug: 'druid', name: 'Druid' });
    const wizard = { data, _saveAndRender: jest.fn() };
    const root = document.createElement('div');
    root.innerHTML = '<input type="checkbox" data-action="setFlexiblePreparation" data-target="secondary">';
    activateCharacterWizardListeners(wizard, root);
    const checkbox = root.querySelector('input');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(data.dualFlexiblePreparation).toBe(true);
    expect(data.flexiblePreparation).toBe(false);
    expect(wizard._saveAndRender).toHaveBeenCalledTimes(1);
  });

  it('keeps primary and secondary choices independent and preserves subclasses', () => {
    const data = createCreationData();
    setClass(data, { slug: 'wizard', name: 'Wizard' });
    setDualClass(data, { slug: 'druid', name: 'Druid' });
    data.subclass = { slug: 'school-of-unified-magical-theory' };
    data.dualSubclass = { slug: 'storm-order' };
    setFlexiblePreparation(data, true);
    expect(data.flexiblePreparation).toBe(true);
    expect(data.dualFlexiblePreparation).toBe(false);
    setFlexiblePreparation(data, true, 'secondary');
    expect(buildFlexiblePreparationOptions(data)).toEqual([
      { target: 'primary', className: 'Wizard', enabled: true },
      { target: 'secondary', className: 'Druid', enabled: true },
    ]);
    expect(data.subclass.slug).toBe('school-of-unified-magical-theory');
    expect(data.dualSubclass.slug).toBe('storm-order');
    expect(JSON.parse(JSON.stringify(data)).dualFlexiblePreparation).toBe(true);

    setDualClass(data, { slug: 'fighter', name: 'Fighter' });
    expect(data.dualFlexiblePreparation).toBe(false);
    expect(data.flexiblePreparation).toBe(true);
    setClass(data, { slug: 'sorcerer', name: 'Sorcerer' });
    setFlexiblePreparation(data, true);
    expect(data.flexiblePreparation).toBe(false);
    expect(buildFlexiblePreparationOptions(data)).toEqual([]);
  });
});
