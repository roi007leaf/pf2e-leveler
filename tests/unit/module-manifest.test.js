import fs from 'node:fs';
import path from 'node:path';

function readManifest() {
  const manifestPath = path.resolve(process.cwd(), 'module.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

describe('module manifest', () => {
  test('declares support for PF2e and SF2e systems', () => {
    const manifest = readManifest();
    const systemIds = (manifest.relationships?.systems ?? []).map((system) => system.id);

    expect(systemIds).toEqual(expect.arrayContaining(['pf2e', 'sf2e']));
  });
});
