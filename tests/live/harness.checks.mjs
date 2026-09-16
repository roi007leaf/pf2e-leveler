import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fullCases } from './cases.mjs';
import { casePassed, coverageFor, validateCases } from './coverage.mjs';
import { sourceFingerprint } from './evidence.mjs';
import {
  finishCleanup,
  readJournal,
  validateCredentials,
  validateRunId,
  writeJournal,
} from './lifecycle.mjs';
import { accountDefaults, loadLocalDefaults, promptAccount } from './local-defaults.mjs';
import { documentRunMarker, ownedDocumentIds } from './ownership.mjs';
import { assessMatrix, detectProfile, profiles } from './profiles.mjs';
import { assessRequirements } from './requirements.mjs';
import { assertQaWorld } from './world-guard.mjs';

const RUN = '12345678-1234-4123-8123-123456789abc';
const passedResult = (name) => ({
  name,
  mode: 'automated',
  status: 'passed',
  steps: [{ status: 'passed' }],
});

test('QA world guard defaults to leveler-qa and requires exact explicit alternates', () => {
  assert.doesNotThrow(() => assertQaWorld('leveler-qa'));
  assert.throws(() => assertQaWorld('campaign'), /Wrong Foundry world.*campaign.*leveler-qa/);
  assert.doesNotThrow(() => assertQaWorld('other-qa', 'other-qa'));
  assert.throws(() => assertQaWorld('other-qa', ''), /must not be blank/);
});

test('run IDs must be UUID v4 values', () => {
  assert.equal(validateRunId(RUN), RUN);
  for (const value of [undefined, null, '', 'ours', {}, '*'])
    assert.throws(() => validateRunId(value));
});

test('cleanup selection includes only documents tagged for exact current run', () => {
  const document = (id, marker) => ({ id, getFlag: () => marker });
  assert.deepEqual(
    ownedDocumentIds(
      [
        document('ours', RUN),
        document('untagged', null),
        document('other-run', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      ],
      RUN,
    ),
    ['ours'],
  );
});

test('inactive module flag scopes use raw ownership without calling throwing getFlag', () => {
  const document = {
    id: 'ours',
    _source: { flags: { 'pf2e-leveler': { liveTestRun: RUN } } },
    getFlag: () => {
      throw Error('Flag scope is inactive');
    },
  };
  assert.equal(documentRunMarker(document), RUN);
  assert.deepEqual(ownedDocumentIds([document], RUN), ['ours']);
  assert.deepEqual(ownedDocumentIds([{ id: 'untagged', getFlag: document.getFlag }], RUN), []);
});

test('credentials require separate accounts and explicit blank-player confirmation', () => {
  const gm = { username: 'GM', password: 'secret' };
  assert.throws(() => validateCredentials(gm, { username: 'Player', password: '' }));
  assert.doesNotThrow(() =>
    validateCredentials(gm, { username: 'Player', password: '', allowBlankPassword: true }),
  );
  assert.throws(() => validateCredentials(gm, gm));
});

test('local defaults validate structure without exposing malformed secret text', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'leveler-defaults-'));
  const file = path.join(directory, 'live.json');
  try {
    assert.deepEqual(await loadLocalDefaults(file), {});
    await writeFile(file, JSON.stringify({ gm: { username: 'GM', password: 'secret' } }));
    assert.equal((await loadLocalDefaults(file)).gm.username, 'GM');
    await writeFile(file, '{"password":"private-secret');
    await assert.rejects(
      loadLocalDefaults(file),
      (error) => /Invalid local/.test(error.message) && !error.message.includes('private-secret'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('account changes never inherit another saved password', () => {
  const saved = { gm: { username: 'Saved GM', password: 'secret' } };
  assert.equal(accountDefaults('gm', saved, {}).password, 'secret');
  assert.equal(accountDefaults('gm', saved, { LEVELER_GM_USER: 'Other GM' }).password, undefined);
});

test('password prompts never display saved secrets', async () => {
  const calls = [];
  const prompts = {
    input: async (config) => {
      calls.push(config);
      return config.default;
    },
    password: async (config) => {
      calls.push(config);
      return '';
    },
    confirm: async () => true,
  };
  const result = await promptAccount(
    'gm',
    { gm: { username: 'GM', password: 'secret' } },
    {},
    prompts,
  );
  assert.equal(result.password, 'secret');
  assert.ok(!JSON.stringify(calls).includes('secret'));
});

for (const failAt of [null, 'cleanup', 'restore', 'verify']) {
  test(`cleanup attempts every stage and retains recovery on ${failAt ?? 'success'}`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'leveler-cleanup-'));
    const journal = path.join(directory, 'recovery.json');
    const calls = [];
    try {
      await writeJournal(journal, { runId: RUN });
      const operations = Object.fromEntries(
        ['cleanup', 'restore', 'verify'].map((stage) => [
          stage,
          async () => {
            calls.push(stage);
            if (stage === failAt) throw Error(stage);
          },
        ]),
      );
      const work = finishCleanup({ ...operations, journal });
      if (failAt) {
        await assert.rejects(work);
        await access(journal);
      } else {
        await work;
        assert.equal(await readJournal(journal), null);
      }
      assert.deepEqual(calls, ['cleanup', 'restore', 'verify']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('catalog names are safe, unique, automated, and observable', () => {
  assert.doesNotThrow(() => validateCases(fullCases));
  assert.throws(() => validateCases([{ name: '../escape', steps: [{ expect: { ok: true } }] }]));
  assert.throws(() => validateCases([{ name: 'empty', steps: [{ operation: 'noop' }] }]));
  assert.throws(() => validateCases([fullCases[0], fullCases[0]]));
});

test('failed, manual, blocked, and unrun cases never count as passing', () => {
  assert.equal(casePassed(passedResult('pass')), true);
  assert.equal(
    casePassed({ ...passedResult('manual'), steps: [{ status: 'passed', review: true }] }),
    false,
  );
  assert.deepEqual(
    coverageFor(
      [{ name: 'pass' }, { name: 'blocked' }, { name: 'unrun' }],
      [passedResult('pass'), { name: 'blocked', mode: 'automated', status: 'blocked', steps: [] }],
    ),
    { required: 3, passed: ['pass'], failed: ['blocked'], unrun: ['unrun'] },
  );
});

test('implemented smoke cases cannot hide missing feature contracts', () => {
  const assessment = assessRequirements(
    fullCases,
    fullCases.map((entry) => passedResult(entry.name)),
  );
  assert.equal(assessment.complete, false);
  assert.ok(assessment.details.some((entry) => entry.missing.length));
});

test('profile detection is strict across four supported Foundry 14 profiles', () => {
  for (const profile of profiles) {
    const environment = {
      core: '14.1.0',
      system: profile.system,
      modules: profile.modules.map((id) => ({ id, active: true })),
    };
    assert.equal(detectProfile(environment)?.name, profile.name);
  }
  assert.equal(detectProfile({ core: '13.0', system: 'pf2e', modules: [] }), null);
});

test('matrix requires current complete evidence from every profile', () => {
  const reports = profiles.map((profile) => ({
    profile: profile.name,
    sourceFingerprint: 'current',
    cleanup: 'complete',
    cases: fullCases.map((entry) => passedResult(entry.name)),
    coverage: coverageFor(
      fullCases,
      fullCases.map((entry) => passedResult(entry.name)),
    ),
  }));
  assert.equal(assessMatrix(fullCases, reports, 'current').complete, true);
  assert.equal(assessMatrix(fullCases, reports.slice(1), 'current').complete, false);
  assert.equal(assessMatrix(fullCases, reports, 'changed').complete, false);
});

test('source fingerprint includes current module and live-test sources', async () => {
  assert.match(await sourceFingerprint(), /^[a-f0-9]{64}$/);
});
