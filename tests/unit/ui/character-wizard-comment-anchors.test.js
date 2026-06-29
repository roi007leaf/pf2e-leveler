import fs from 'node:fs';
import path from 'node:path';

const TPL = path.resolve(__dirname, '../../../templates/character-wizard.hbs');

describe('character-wizard comment anchors', () => {
  const src = fs.readFileSync(TPL, 'utf8');
  it('tags the step content container with the current creation part id', () => {
    expect(src).toContain('data-comment-part="creation:{{stepId}}"');
  });
});
