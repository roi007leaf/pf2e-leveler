import fs from 'node:fs';
import path from 'node:path';

const TPL = path.resolve(__dirname, '../../../templates/character-wizard.hbs');

describe('character-wizard comment anchors', () => {
  const src = fs.readFileSync(TPL, 'utf8');
  it('tags each step nav item with its step id', () => {
    expect(src).toContain('data-step-id="{{this.id}}"');
  });
});
