import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const EN_PATH = path.join(ROOT, 'lang', 'en.json');

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flattenKeys(value, full)) keys.add(nested);
    } else {
      keys.add(full);
    }
  }
  return keys;
}

function collectTemplateFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectTemplateFiles(full));
    else if (entry.name.endsWith('.hbs')) files.push(full);
  }
  return files;
}

describe('template localization keys', () => {
  it('every literal {{localize "PF2E_LEVELER..."}} key exists in en.json', () => {
    const enKeys = flattenKeys(JSON.parse(fs.readFileSync(EN_PATH, 'utf8')));
    const keyPattern = /localize\s+"(PF2E_LEVELER\.[A-Za-z0-9_.]+)"/g;

    const missing = [];
    for (const file of collectTemplateFiles(TEMPLATES_DIR)) {
      const source = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = keyPattern.exec(source)) !== null) {
        if (!enKeys.has(match[1])) {
          missing.push(`${match[1]} (${path.relative(ROOT, file)})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
