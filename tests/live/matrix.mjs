import { readFile } from 'node:fs/promises';
import { fullCases } from './cases.mjs';
import { sourceFingerprint } from './evidence.mjs';
import { assessMatrix } from './profiles.mjs';

const files = process.argv.slice(2);
if (!files.length) throw Error('Pass one or more live report JSON paths');
const reports = await Promise.all(
  files.map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
);
const assessment = assessMatrix(fullCases, reports, await sourceFingerprint());
console.log(JSON.stringify(assessment, null, 2));
process.exitCode = assessment.complete ? 0 : 1;
