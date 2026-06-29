import fs from 'node:fs';
import path from 'node:path';

const TPL = path.resolve(__dirname, '../../../templates/level-planner.hbs');

describe('level-planner comment anchors', () => {
  const src = fs.readFileSync(TPL, 'utf8');
  const keys = [
    'classFeatures', 'retraining', 'grantedChoices', 'boosts', 'intSkills',
    'intLanguages', 'classFeat', 'skillFeat', 'generalFeat', 'ancestryFeat',
    'skillIncrease', 'archetypeFeat', 'mythicFeat', 'dualClassFeat', 'equipment',
    'customPlan', 'abp', 'spellcasting', 'apparitions',
  ];

  it.each(keys)('anchors the %s section', (key) => {
    expect(src).toContain(`data-comment-part="level:{{selectedLevel}}:${key}"`);
  });

  it('places anchors only on top-level .level-section divs', () => {
    const count = (src.match(/data-comment-part="level:\{\{selectedLevel\}\}:/g) || []).length;
    expect(count).toBe(keys.length);
  });
});
