import {
  markerStateClass,
  collectPlannerCommentAnchors,
  collectWizardCommentAnchors,
} from '../../../scripts/ui/plan-comments-ui.js';

function el(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('markerStateClass', () => {
  it('maps summary to a state suffix', () => {
    expect(markerStateClass({ isEmpty: true, resolved: false })).toBe('empty');
    expect(markerStateClass({ isEmpty: false, resolved: true })).toBe('resolved');
    expect(markerStateClass({ isEmpty: false, resolved: false })).toBe('unresolved');
  });
  it('returns empty for null/undefined summary', () => {
    expect(markerStateClass(undefined)).toBe('empty');
    expect(markerStateClass(null)).toBe('empty');
  });
});

describe('collectPlannerCommentAnchors', () => {
  it('returns one anchor per .level-section[data-comment-part], hosting its leading section-header', () => {
    const root = el(`
      <div class="level-section" data-comment-part="level:3:classFeat">
        <div class="section-header"><i></i>Class Feat</div>
        <div class="level-section__body"><div class="section-header">nested ignored</div></div>
      </div>
      <div class="level-section"><div class="section-header">no part id</div></div>
    `);
    const anchors = collectPlannerCommentAnchors(root);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].partId).toBe('level:3:classFeat');
    expect(anchors[0].host.classList.contains('section-header')).toBe(true);
    expect(anchors[0].label).toBe('Class Feat');
  });
});

describe('collectWizardCommentAnchors', () => {
  it('returns one anchor for the current step, hosting its content heading', () => {
    const root = el(`
      <div class="wizard-content" data-comment-part="creation:ancestry">
        <div class="wizard-main"><h2>Ancestry</h2></div>
      </div>
    `);
    const anchors = collectWizardCommentAnchors(root);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].partId).toBe('creation:ancestry');
    expect(anchors[0].host.tagName).toBe('H2');
    expect(anchors[0].label).toBe('Ancestry');
  });

  it('falls back to the content container and partId label when no heading is present', () => {
    const root = el(`
      <div class="wizard-content" data-comment-part="creation:summary">
        <div class="wizard-main"></div>
      </div>
    `);
    const anchors = collectWizardCommentAnchors(root);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].host.classList.contains('wizard-content')).toBe(true);
    expect(anchors[0].label).toBe('creation:summary');
  });

  it('returns no anchors when the content has no data-comment-part', () => {
    const root = el(`<div class="wizard-content"><div class="wizard-main"><h2>X</h2></div></div>`);
    expect(collectWizardCommentAnchors(root)).toEqual([]);
  });
});
