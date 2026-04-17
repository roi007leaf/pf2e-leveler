import {
  createCreationData,
  getClassSelectionData,
  normalizeCreationData,
  setThesis,
} from '../../../scripts/creation/creation-model.js';

describe('creation model class-owned selections', () => {
  it('stores dual-class handler selections separately from the primary class', () => {
    const data = createCreationData();

    setThesis(data, { uuid: 'thesis-primary', name: 'Staff Nexus', img: 'staff.png', slug: 'staff-nexus' }, 'class');
    setThesis(data, { uuid: 'thesis-dual', name: 'Spell Blending', img: 'blend.png', slug: 'spell-blending' }, 'dualClass');

    expect(getClassSelectionData(data, 'class').thesis).toEqual(expect.objectContaining({ uuid: 'thesis-primary' }));
    expect(getClassSelectionData(data, 'dualClass').thesis).toEqual(expect.objectContaining({ uuid: 'thesis-dual' }));
    expect(data.thesis).toEqual(expect.objectContaining({ uuid: 'thesis-primary' }));
  });

  it('migrates legacy primary handler selections into the primary class bucket', () => {
    const data = normalizeCreationData({
      version: 1,
      class: { uuid: 'class-wizard', slug: 'wizard', name: 'Wizard' },
      thesis: { uuid: 'legacy-thesis', name: 'Legacy Thesis', slug: 'legacy-thesis' },
    });

    expect(getClassSelectionData(data, 'class').thesis).toEqual(expect.objectContaining({ uuid: 'legacy-thesis' }));
    expect(data.thesis).toEqual(expect.objectContaining({ uuid: 'legacy-thesis' }));
  });
});
