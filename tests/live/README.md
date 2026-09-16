# Local automated Foundry tests

Phase 1 provides Leveler's guarded local live-test engine. It ports Visioner's
core safety model: independent GM/player browser contexts, exact disposable-world
checks before and after login, run-owned fixtures, atomic recovery, verified
cleanup, source fingerprints, screenshots, strict automated assertions, profile
reports, and an explicit missing-contract inventory.

The current catalog contains three engine smoke cases. Missing feature contracts
remain visible in `npm run test:live:coverage`; Phase 1 does **not** claim complete
Leveler coverage.

## Setup

1. Launch a disposable Foundry 14 world with ID `leveler-qa`.
2. Enable this source checkout and use either PF2e or SF2e.
3. Create separate GM and player accounts. Give the player account no campaign
   data; blank passwords require explicit confirmation.
4. Run `npm ci`, then `npx playwright install chromium` once.
5. Run `npm run test:live` and enter URL plus credentials.
6. Require all selected cases to pass with `cleanup: complete` in
   `artifacts/live/report.json`.

Supported evidence profiles:

- Foundry 14 + PF2e
- Foundry 14 + PF2e + `sf2e-anachronism`
- Foundry 14 + SF2e
- Foundry 14 + SF2e + `pf2e-anachronism`

Each profile needs a fresh report from identical source. Combine reports with
`npm run test:live:matrix -- report1.json report2.json report3.json report4.json`.

## Commands

```sh
npm run test:live
npm run test:live:full
npm run test:live:list
npm run test:live:coverage
npm run test:live:harness
npm run test:live:cleanup
npm run test:live:matrix -- report1.json report2.json report3.json report4.json
```

Optional local defaults belong outside repo at
`~/.config/pf2e-leveler/live.json`:

```json
{
  "url": "https://localhost:30000",
  "gm": { "username": "QA GM", "password": "secret" },
  "player": { "username": "QA Player", "password": "", "allowBlankPassword": true }
}
```

Environment overrides use `LEVELER_FOUNDRY_URL`, `LEVELER_GM_USER`,
`LEVELER_GM_PASSWORD`, `LEVELER_PLAYER_USER`, `LEVELER_PLAYER_PASSWORD`, and
`LEVELER_PLAYER_ALLOW_BLANK=1`. `LEVELER_DISPOSABLE_WORLD` permits another exact
disposable-world ID. `LEVELER_LIVE_CASE` filters comma-separated case names.
Credentials never enter reports, screenshots, recovery journals, or repo files.

`--temporary-enable` may enable Leveler in a verified disposable world for one
run. Runner journals original inactive state before changing configuration and
restores it during cleanup or recovery. Never use this flag with a campaign
world.

## Cleanup and evidence

Every created actor carries `flags.pf2e-leveler.liveTestRun=<UUID>`. Cleanup only
deletes documents bearing current run UUID. Recovery retains its journal if any
cleanup, session restoration, or leftover verification stage fails. Rerun suite
or `npm run test:live:cleanup` with same world and accounts to recover.

Reports and screenshots remain under ignored `artifacts/live/`. Live tests stay
local: release ZIP allowlist excludes `tests/`, package metadata, node modules,
and artifacts. Passing smoke catalog cannot satisfy exhaustive feature contract.
