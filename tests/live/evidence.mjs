import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function sourceFingerprint(root = '.') {
  const hash = createHash('sha256');
  async function walk(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        hash.update(file);
        hash.update(await readFile(path.join(root, file)));
      }
    }
  }
  for (const directory of ['scripts', 'styles', 'templates', 'lang', 'tests/live'])
    await walk(directory);
  for (const file of ['module.json', 'package.json', 'package-lock.json']) {
    hash.update(file);
    hash.update(await readFile(path.join(root, file)));
  }
  return hash.digest('hex');
}
