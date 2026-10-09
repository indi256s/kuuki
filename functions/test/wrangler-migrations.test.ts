// ADR 0001 A1 (T07): the real `wrangler d1 migrations apply --local` path, including its statement
// splitting of CREATE TRIGGER ... BEGIN ... END; bodies. Local Miniflare state only; no remote D1.
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, expect, it } from 'vitest'
import { migrationFiles } from '../../scripts/_migrations'
import { ROOT } from '../../scripts/_cli'

const run = promisify(execFile)
const state = mkdtempSync(join(tmpdir(), 'kuuki-wrangler-a1-'))
afterAll(() => rmSync(state, { recursive: true, force: true }))

const wrangler = (...args: string[]) =>
  run('pnpm', ['exec', 'wrangler', ...args], {
    cwd: ROOT,
    timeout: 120_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
  })

it('applies every migration, including trigger bodies, through wrangler d1 migrations apply --local', async () => {
  const applied = await wrangler(
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--persist-to',
    state,
  )
  for (const file of migrationFiles()) expect(applied.stdout).toContain(file)
  expect(applied.stdout).not.toMatch(/❌|error/i)

  const again = await wrangler('d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state)
  expect(again.stdout).toMatch(/No migrations to apply/i)

  const executed = await wrangler(
    'd1',
    'execute',
    'DB',
    '--local',
    '--persist-to',
    state,
    '--json',
    '--command',
    `INSERT INTO users (id,email,password_hash) VALUES ('a1','a1@example.test','h');
     INSERT INTO flights (user_id,date,origin,destination,is_upcoming) VALUES ('a1','2031-01-01','TBS','IST',1);
     SELECT lifecycle_state, lifecycle_timezone, awaiting_after, is_upcoming FROM flights WHERE user_id = 'a1';
     SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name;
     SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'import_%' OR name LIKE 'country_%evidence%' OR name LIKE 'lifecycle_%' OR name = 'transit_cleanup_markers') ORDER BY name`,
  )
  const results = (
    JSON.parse(executed.stdout) as Array<{ results: Array<Record<string, unknown>> }>
  ).map((entry) => entry.results)
  // The adapter trigger (whole body, not a split fragment) ran for an old-style insert.
  expect(results[2]).toEqual([
    {
      lifecycle_state: 'upcoming',
      lifecycle_timezone: 'UTC',
      awaiting_after: '2031-01-02T00:00:00.000Z',
      is_upcoming: 1,
    },
  ])
  expect(results[3].map((row) => row.name)).toEqual([
    'flights_lifecycle_adapt_flag',
    'flights_lifecycle_adapt_insert',
    'flights_lifecycle_adapt_redate',
    'flights_lifecycle_adapt_route',
    'flights_lifecycle_check_insert',
    'flights_lifecycle_check_update',
  ])
  expect(results[4].map((row) => row.name)).toEqual([
    'country_evidence_suppressions',
    'country_visit_evidence',
    'import_batches',
    'import_conversion_receipts',
    'import_drafts',
    'lifecycle_operation_receipts',
    'transit_cleanup_markers',
  ])
}, 300_000)
