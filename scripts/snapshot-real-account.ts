// Read one production account into a private local snapshot that `pnpm next:preview` loads as me@example.test.
// Read-only on remote D1: every statement is a SELECT. Credentials, sessions and the Gemini key are never copied.
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ROOT } from './_cli'
import { REAL_SNAPSHOT_PATH, type RealSnapshot } from './fixtures/real-account'

// Copied whole so the account's airports, aircraft and badges resolve; the fixture inserts them OR IGNORE.
const REFERENCE_TABLES = ['airports_reference', 'aircraft_reference', 'badge_definitions']
// Credentials, sessions and tokens stay in production; leaderboards are rebuilt by the fixture.
const SKIPPED_USER_TABLES = new Set([
  'account_activation_tokens',
  'auth_sessions',
  'sessions',
  'leaderboard_cache',
  'leaderboard_cache_next',
])
const SKIPPED_PROFILE_COLUMNS = new Set(['gemini_api_key'])

function select<T = Record<string, unknown>>(sql: string): T[] {
  const output = execFileSync(
    'pnpm',
    [
      '--filter',
      '@kuuki/next',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'kuuki-db',
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  )
  return (JSON.parse(output) as Array<{ results: T[] }>)[0].results
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`

function main(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--email')
  const previous = existsSync(REAL_SNAPSHOT_PATH)
    ? (JSON.parse(readFileSync(REAL_SNAPSHOT_PATH, 'utf8')) as RealSnapshot).sourceEmail
    : undefined
  const email = at >= 0 ? argv[at + 1] : previous
  if (!email) throw new Error('First snapshot needs --email <account email>')

  const [user] = select<{ id: string }>(`SELECT id FROM users WHERE email = ${quote(email)}`)
  if (!user) throw new Error(`No production user for ${email}`)
  const userTables = select<{ name: string }>(
    `SELECT DISTINCT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
     WHERE m.type = 'table' AND m.name NOT LIKE '_cf%' AND p.name = 'user_id' ORDER BY m.name`,
  )
    .map(({ name }) => name)
    .filter((name) => !SKIPPED_USER_TABLES.has(name))

  const [profile] = select(`SELECT * FROM profiles WHERE id = ${quote(user.id)}`)
  for (const column of SKIPPED_PROFILE_COLUMNS) delete profile[column]
  const snapshot: RealSnapshot = {
    sourceEmail: email,
    sourceUserId: user.id,
    takenAt: new Date().toISOString(),
    profile,
    reference: Object.fromEntries(
      REFERENCE_TABLES.map((table) => [table, select(`SELECT * FROM ${table}`)]),
    ),
    user: Object.fromEntries(
      userTables.map((table) => [
        table,
        select(`SELECT * FROM ${table} WHERE user_id = ${quote(user.id)}`),
      ]),
    ),
  }

  mkdirSync(dirname(REAL_SNAPSHOT_PATH), { recursive: true, mode: 0o700 })
  writeFileSync(REAL_SNAPSHOT_PATH, JSON.stringify(snapshot), { mode: 0o600 })
  chmodSync(REAL_SNAPSHOT_PATH, 0o600)
  const counts = Object.entries(snapshot.user)
    .filter(([, rows]) => rows.length)
    .map(([table, rows]) => `${table} ${rows.length}`)
  console.log(`Snapshot written to ${REAL_SNAPSHOT_PATH}: ${counts.join(', ')}`)
}

main()
