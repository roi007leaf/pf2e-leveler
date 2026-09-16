import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { validateRunId } from './ownership.mjs';

export async function writeJournal(file, record) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2), { mode: 0o600 });
  await rename(temporary, file);
}

export async function readJournal(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function finishCleanup({ cleanup, restore, verify, journal }) {
  const failures = [];
  for (const operation of [cleanup, restore, verify]) {
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Cleanup incomplete; recovery journal retained');
  await unlink(journal);
}

export function validateCredentials(gm, player) {
  for (const [role, credentials] of Object.entries({ gm, player })) {
    const blankPlayer = role === 'player' && credentials?.allowBlankPassword === true;
    if (!credentials?.username?.trim() || (!credentials?.password && !blankPlayer)) {
      throw Error(`${role} username and password are required`);
    }
  }
  if (gm.username.trim().toLowerCase() === player.username.trim().toLowerCase()) {
    throw Error('GM and player must be separate accounts');
  }
}
