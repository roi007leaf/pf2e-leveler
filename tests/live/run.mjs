import { confirm, input, password } from '@inquirer/prompts';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fullCases, smokeCases } from './cases.mjs';
import { coverageFor, validateCases } from './coverage.mjs';
import { sourceFingerprint } from './evidence.mjs';
import { finishCleanup, readJournal, validateCredentials, writeJournal } from './lifecycle.mjs';
import { loadLocalDefaults, promptAccount } from './local-defaults.mjs';
import { caseAppliesToProfile, detectProfile } from './profiles.mjs';
import { assessRequirements } from './requirements.mjs';
import { assertQaWorld, DEFAULT_QA_WORLD } from './world-guard.mjs';

const directory = path.resolve('artifacts/live');
const journalPath = path.join(directory, 'recovery.json');
const lockPath = path.join(directory, 'runner.lock');
const expectedWorld = process.env.LEVELER_DISPOSABLE_WORLD ?? DEFAULT_QA_WORLD;
const abort = new AbortController();
const secrets = [];
const report = {
  started: new Date().toISOString(),
  cases: [],
  startupErrors: [],
  cleanup: 'not-needed',
};
let browser;
let gm;
let player;
let journal;
let locked = false;
let collectingStartup = true;
const browserErrors = [];

process.once('SIGINT', () => abort.abort());
process.once('SIGTERM', () => abort.abort());

function safeError(error) {
  let text = String(error?.stack ?? error?.message ?? error);
  for (const secret of secrets.filter(Boolean)) text = text.split(secret).join('[redacted]');
  return text;
}

async function rpc(page, method, data) {
  return page.evaluate(
    async ({ method, data }) => {
      const api = await import('/modules/pf2e-leveler/tests/live/world.js');
      if (typeof api[method] !== 'function') throw Error(`Unknown live-test RPC: ${method}`);
      return api[method](data);
    },
    { method, data },
  );
}

async function login(context, url, credentials, isGM) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => {
    (collectingStartup ? report.startupErrors : browserErrors).push(safeError(error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error')
      (collectingStartup ? report.startupErrors : browserErrors).push(safeError(message.text()));
  });
  await page.goto(`${url}/join`);
  const accountSelect = page.locator('select[name="userid"]');
  await page.locator('select[name="userid"], input[name="username"]').first().waitFor();
  assertQaWorld(await page.evaluate(() => globalThis.game?.world?.id), expectedWorld);
  if (await accountSelect.count()) {
    const options = await accountSelect.locator('option').evaluateAll((entries) =>
      entries.map((entry) => ({
        label: entry.textContent.trim(),
        value: entry.value,
      })),
    );
    const match = options.find(
      (entry) => entry.label.toLowerCase() === credentials.username.trim().toLowerCase(),
    );
    if (!match) throw Error(`Account not found for ${isGM ? 'GM' : 'player'} session`);
    await accountSelect.selectOption(match.value);
  } else {
    await page.locator('input[name="username"]').fill(credentials.username);
  }
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[name="join"]').click();
  await page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 90000 });
  const state = await rpc(page, 'preflight');
  assertQaWorld(state.world, expectedWorld);
  if (state.isGM !== isGM) throw Error(`Wrong account role: expected ${isGM ? 'GM' : 'player'}`);
  return { page, state };
}

async function acquireLock() {
  await mkdir(directory, { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(lockPath, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0)
      throw Error('Invalid runner lock; inspect before removing it');
    try {
      process.kill(pid, 0);
      throw Error(`Live suite already running (PID ${pid})`);
    } catch (probe) {
      if (probe.code !== 'ESRCH') throw probe;
    }
    await unlink(lockPath);
    handle = await open(lockPath, 'wx');
  }
  await handle.writeFile(String(process.pid));
  await handle.close();
  locked = true;
}

async function recover(record) {
  if (
    record.world !== gm.state.world ||
    record.gm.user !== gm.state.user ||
    record.player.user !== player.state.user
  ) {
    throw Error('Recovery requires original world, GM, and player accounts');
  }
  report.cleanup = 'running';
  await finishCleanup({
    journal: journalPath,
    cleanup: async () => {
      await rpc(player.page, 'closeRunApplications', record.runId);
      await rpc(gm.page, 'cleanup', record.runId);
    },
    restore: async () => {
      await rpc(gm.page, 'restoreVariantSettings', {
        world: record.world,
        settings: record.variantSettings,
      });
      await rpc(gm.page, 'restore', { ...record.gm, runId: record.runId });
      await rpc(player.page, 'restore', { ...record.player, runId: record.runId });
      if (record.moduleWasActive === false) {
        await rpc(gm.page, 'setModuleActive', { world: record.world, active: false });
      }
    },
    verify: async () => {
      const remaining = await rpc(gm.page, 'leftovers', record.runId);
      if (Object.values(remaining).some((ids) => ids.length))
        throw Error('Test documents remain after cleanup');
      const variants = await rpc(gm.page, 'verifyVariantSettings', {
        world: record.world,
        settings: record.variantSettings,
      });
      if (!variants.restored) {
        throw Error(`Variant settings were not restored: ${variants.mismatches.join(', ')}`);
      }
    },
  });
  report.cleanup = 'complete';
}

function matches(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

async function runCase(testCase, index) {
  const result = {
    name: testCase.name,
    area: testCase.area,
    mode: 'automated',
    status: 'running',
    steps: [],
  };
  report.cases.push(result);
  let fixture = null;
  const firstBrowserError = browserErrors.length;
  try {
    if (testCase.fixture) {
      const fixtureOperation = {
        true: 'createFixture',
        planner: 'createPlannerFixture',
        spellbook: 'createSpellbookFixture',
      }[testCase.fixture];
      if (!fixtureOperation) throw Error(`Unknown fixture type: ${testCase.fixture}`);
      fixture = await rpc(gm.page, fixtureOperation, {
        runId: journal.runId,
        playerId: player.state.user,
      });
      await player.page.waitForFunction((actorId) => game.actors.has(actorId), fixture.actor);
    }
    for (const [stepIndex, step] of testCase.steps.entries()) {
      const stepResult = {
        index: stepIndex,
        operation: step.operation,
        session: step.session,
        expected: step.expect,
        status: 'running',
      };
      result.steps.push(stepResult);
      const session = step.session === 'player' ? player : gm;
      stepResult.actual = await rpc(
        session.page,
        step.operation === 'actor' ? 'actorSnapshot' : step.operation,
        {
          ...step,
          runId: journal.runId,
          world: journal.world,
          ...fixture,
        },
      );
      if (!matches(stepResult.actual, step.expect)) {
        throw Error(
          `Expected ${JSON.stringify(step.expect)}; got ${JSON.stringify(stepResult.actual)}`,
        );
      }
      await session.page.screenshot({
        path: path.join(
          directory,
          journal.runId,
          `${String(index).padStart(3, '0')}-${testCase.name}-${stepIndex}.png`,
        ),
      });
      stepResult.status = 'passed';
    }
    const allowedErrors = testCase.steps
      .map((step) => step.expectedBrowserError)
      .filter((message) => typeof message === 'string' && message.length > 0);
    const unexpectedErrors = browserErrors
      .slice(firstBrowserError)
      .filter((error) => !allowedErrors.some((message) => error.includes(message)));
    if (unexpectedErrors.length) {
      throw Error(`Browser exception: ${unexpectedErrors.join('; ')}`);
    }
    result.status = 'passed';
    console.log(`PASS ${testCase.name}`);
  } catch (error) {
    result.status = 'failed';
    result.error = safeError(error);
    if (result.steps.at(-1)?.status === 'running') result.steps.at(-1).status = 'failed';
    console.error(`FAIL ${testCase.name}: ${result.error}`);
  } finally {
    try {
      await rpc(player.page, 'closeRunApplications', journal.runId);
      await rpc(gm.page, 'restoreVariantSettings', {
        world: journal.world,
        settings: journal.variantSettings,
      });
      await rpc(gm.page, 'cleanup', journal.runId);
      const remaining = await rpc(gm.page, 'leftovers', journal.runId);
      if (Object.values(remaining).some((ids) => ids.length)) {
        result.status = 'failed';
        result.cleanup = 'failed';
        result.cleanupError = 'Test documents remain';
        abort.abort();
      } else {
        result.cleanup = 'complete';
      }
    } catch (error) {
      result.status = 'failed';
      result.cleanup = 'failed';
      result.cleanupError = safeError(error);
      abort.abort();
    }
    result.finished = new Date().toISOString();
    await saveReport();
  }
}

async function saveReport() {
  report.functionalCoverage = assessRequirements(fullCases, report.cases);
  const applicableCases = report.profile
    ? fullCases.filter((testCase) => caseAppliesToProfile(testCase, report.profile))
    : fullCases;
  report.coverage = coverageFor(applicableCases, report.cases);
  report.shippingReady =
    report.functionalCoverage.complete &&
    !report.error &&
    !report.startupErrors.length &&
    !report.sourceChangedDuringRun &&
    report.cleanup === 'complete' &&
    !report.coverage.failed.length &&
    !report.coverage.unrun.length;
  if (locked) await writeJournal(path.join(directory, 'report.json'), report);
  if (journal?.runId)
    await writeJournal(path.join(directory, journal.runId, 'report.json'), report);
}

async function run() {
  validateCases(fullCases);
  if (process.argv.includes('--list')) {
    console.table(
      fullCases.map((entry) => ({
        case: entry.name,
        area: entry.area,
        smoke: smokeCases.includes(entry),
        steps: entry.steps.length,
      })),
    );
    return;
  }
  if (process.argv.includes('--coverage')) {
    console.log(JSON.stringify(assessRequirements(fullCases, []), null, 2));
    return;
  }
  const requested = process.env.LEVELER_LIVE_CASE?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const catalog = process.argv.includes('--full') ? fullCases : smokeCases;
  const unknown = requested?.filter((name) => !catalog.some((entry) => entry.name === name)) ?? [];
  if (unknown.length && !process.argv.includes('--cleanup-only'))
    throw Error(`Unknown live cases: ${unknown.join(', ')}`);
  await acquireLock();
  const defaults = await loadLocalDefaults();
  const url = (
    process.env.LEVELER_FOUNDRY_URL ??
    (await input(
      {
        message: 'Foundry URL:',
        default: defaults.url || 'https://localhost:30000',
      },
      { signal: abort.signal },
    ))
  ).replace(/\/$/, '');
  const prompts = { input, password, confirm };
  const gmCredentials = await promptAccount('gm', defaults, process.env, prompts, {
    signal: abort.signal,
  });
  const playerCredentials = await promptAccount('player', defaults, process.env, prompts, {
    signal: abort.signal,
  });
  secrets.push(gmCredentials.password, playerCredentials.password);
  validateCredentials(gmCredentials, playerCredentials);
  browser = await chromium.launch({
    headless: process.argv.includes('--headless'),
    channel: process.env.LEVELER_BROWSER_CHANNEL || undefined,
  });
  const contextOptions = {
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: new URL(url).hostname === 'localhost',
  };
  gm = await login(await browser.newContext(contextOptions), url, gmCredentials, true);
  player = await login(await browser.newContext(contextOptions), url, playerCredentials, false);
  if (gm.state.world !== player.state.world) throw Error('Accounts joined different worlds');

  let environment = await rpc(gm.page, 'environment');
  const profile = detectProfile(environment);
  if (!profile)
    throw Error(
      `Unsupported live-test environment: Foundry ${environment.core}, system ${environment.system}`,
    );
  report.profile = profile.name;
  const applicableCatalog = catalog.filter((testCase) =>
    caseAppliesToProfile(testCase, profile.name),
  );
  const cases = requested
    ? applicableCatalog.filter((entry) => requested.includes(entry.name))
    : applicableCatalog;
  if (!cases.length && !process.argv.includes('--cleanup-only'))
    throw Error('No live cases selected for active profile');
  report.sourceFingerprint = await sourceFingerprint();
  journal = { url, world: gm.state.world, runId: randomUUID(), gm: gm.state, player: player.state };
  const pending = await readJournal(journalPath);
  if (pending) await recover(pending);
  if (process.argv.includes('--cleanup-only')) return;
  await mkdir(path.join(directory, journal.runId), { recursive: true });
  if (!environment.moduleActive) {
    if (!process.argv.includes('--temporary-enable')) {
      throw Error('PF2e Leveler must be active in disposable QA world');
    }
    journal.moduleWasActive = false;
    await writeJournal(journalPath, journal);
    await rpc(gm.page, 'setModuleActive', { world: journal.world, active: true });
    await Promise.all([gm.page.reload(), player.page.reload()]);
    await Promise.all([
      gm.page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 90000 }),
      player.page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 90000 }),
    ]);
    gm.state = await rpc(gm.page, 'preflight');
    player.state = await rpc(player.page, 'preflight');
    environment = await rpc(gm.page, 'environment');
    if (!environment.moduleActive)
      throw Error('Temporary Leveler activation did not survive reload');
  } else {
    await writeJournal(journalPath, journal);
  }
  journal.variantSettings = await rpc(gm.page, 'snapshotVariantSettings', {
    world: journal.world,
  });
  await writeJournal(journalPath, journal);
  report.environment = environment;
  collectingStartup = false;
  for (const [index, testCase] of cases.entries()) {
    if (abort.signal.aborted) break;
    await runCase(testCase, index);
  }
}

try {
  await run();
} catch (error) {
  report.error = safeError(error);
  console.error(report.error);
} finally {
  try {
    const pending = await readJournal(journalPath);
    if (pending && gm && player) await recover(pending);
  } catch (error) {
    report.cleanup = 'failed';
    report.cleanupError = safeError(error);
  }
  await browser?.close().catch(() => {});
  if (report.sourceFingerprint) {
    report.sourceChangedDuringRun =
      report.sourceFingerprint !== (await sourceFingerprint().catch(() => 'unavailable'));
  }
  if (locked) await unlink(lockPath).catch(() => {});
  report.finished = new Date().toISOString();
  await saveReport();
}

const failed =
  report.error ||
  report.startupErrors.length ||
  report.cleanup === 'failed' ||
  report.sourceChangedDuringRun ||
  report.cases.some((entry) => entry.status !== 'passed');
console.log(
  `Live tests: ${report.cases.filter((entry) => entry.status === 'passed').length}/${report.cases.length} passed; cleanup: ${report.cleanup}`,
);
process.exitCode = failed ? 1 : 0;
