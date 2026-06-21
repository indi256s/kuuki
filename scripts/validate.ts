// scripts/validate.ts — HARD validation gates for the Phase 5 Supabase → LOCAL D1 migration.
//
// Compares the migrated LOCAL D1 (via getPlatformProxy().env.DB on .wrangler/state/v3)
// against the live oracle snapshot in db/_snapshot/*.json (md5-verified vs Postgres).
//
// Philosophy: correctness over speed. This is the only copy of real user data. Every gate
// is EXACT-EQUALITY and FAILS LOUD: any mismatch prints the offending rows and the process
// exits non-zero. Nothing here writes to D1 — read-only verification.
//
// Run with:  npx tsx scripts/validate.ts        (NEVER against remote D1)
//
// Transforms applied at import time (docs/plans/SUPABASE_TO_CLOUDFLARE.md §3) and therefore
// undone here when comparing oracle (Postgres-shaped) vs D1 (SQLite-shaped):
//   * timestamptz "2026-02-01 10:03:33.581014+00:00"  -> normalizeIso -> "YYYY-MM-DDTHH:MM:SS.sssZ"
//   * boolean true/false                              -> INTEGER 1/0
//   * DECIMAL/NUMERIC                                 -> REAL  (compare numerically)
//   * JSONB object/null                               -> TEXT  (JSON.stringify; compare canonically)
//   * UUID / text PKs                                 -> verbatim
//   * email                                           -> lowercased
//
// Column lists are driven from db/_snapshot/_schema.json (LIVE information_schema), NOT the
// stale apps/web/src/lib/database.types.ts. The D1-only column flights.aircraft_lookup_attempts
// is omitted by the import and relies on the D1 DEFAULT 0 — it is not in the oracle and is not
// diffed here.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { normalizeIso } from '../functions/api/_lib/time'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SNAPSHOT_DIR = join(REPO_ROOT, 'db', '_snapshot')
const DATA_SRC_DIR = join(REPO_ROOT, 'packages', 'data', 'src')

// ---------------------------------------------------------------------------
// Oracle loaders
// ---------------------------------------------------------------------------

function loadJson<T = Record<string, unknown>>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, 'utf8')) as T
}

function loadSnapshot<T = Record<string, unknown>>(name: string): T[] {
  return loadJson<T[]>(join(SNAPSHOT_DIR, `${name}.json`))
}

// ---------------------------------------------------------------------------
// Reporting / failure tracking
// ---------------------------------------------------------------------------

let FAILED = false
const MAX_OFFENDERS = 20 // cap noisy dumps; counts are always exact

function pass(gate: string, detail = ''): void {
  console.log(`PASS  ${gate}${detail ? ` — ${detail}` : ''}`)
}

function fail(gate: string, detail: string, offenders: unknown[] = []): void {
  FAILED = true
  console.error(`FAIL  ${gate} — ${detail}`)
  if (offenders.length > 0) {
    const shown = offenders.slice(0, MAX_OFFENDERS)
    for (const o of shown) {
      console.error(`        ${typeof o === 'string' ? o : JSON.stringify(o)}`)
    }
    if (offenders.length > shown.length) {
      console.error(`        … and ${offenders.length - shown.length} more`)
    }
  }
}

/** Assert an exact count. */
function gateCount(gate: string, actual: number, expected: number): void {
  if (actual === expected) pass(gate, `count=${actual}`)
  else fail(gate, `expected count ${expected}, got ${actual}`)
}

// ---------------------------------------------------------------------------
// Value comparators (oracle Postgres shape vs D1 SQLite shape)
// ---------------------------------------------------------------------------

const CANONICAL_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** boolean | 0 | 1 | null  ->  0 | 1 | null  (the SQLite storage form). */
function toBit(v: unknown): 0 | 1 | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === 1 || v === '1') return 1
  if (v === 0 || v === '0') return 0
  throw new Error(`not a boolean-ish value: ${JSON.stringify(v)}`)
}

/** Canonical JSON string for a JSONB column, with stable key ordering. null stays null. */
function canonicalJson(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const parsed = typeof v === 'string' ? safeParse(v) : v
  return stableStringify(parsed)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s // non-JSON text stored as-is; compare raw
  }
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** Numeric equality tolerant of REAL round-trip (e.g. NUMERIC -> REAL). */
function numEq(a: unknown, b: unknown): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  const na = Number(a)
  const nb = Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) return false
  return Math.abs(na - nb) < 1e-9
}

/** Strict equality for text / int PKs (verbatim columns). */
function strictEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined
  return a === b
}

/** Per-column comparison kind. */
type Kind = 'verbatim' | 'int' | 'real' | 'bool' | 'json' | 'timestamp'

interface ColSpec {
  col: string
  kind: Kind
}

/** Compare one oracle value against the stored D1 value for a given column kind. */
function cellMatches(kind: Kind, oracleVal: unknown, d1Val: unknown): boolean {
  switch (kind) {
    case 'verbatim':
      return strictEq(oracleVal, d1Val)
    case 'int':
      return numEq(oracleVal, d1Val)
    case 'real':
      return numEq(oracleVal, d1Val)
    case 'bool':
      return toBit(oracleVal) === toBit(d1Val)
    case 'json':
      return canonicalJson(oracleVal) === canonicalJson(d1Val)
    case 'timestamp': {
      const o = normalizeIso(oracleVal as string | null)
      const d = (d1Val ?? null) as string | null
      return o === d
    }
  }
}

// ---------------------------------------------------------------------------
// Row-by-row differ keyed by a stable primary key
// ---------------------------------------------------------------------------

interface DiffResult {
  missing: unknown[] // keys present in oracle, absent in D1
  extra: unknown[] // keys present in D1, absent in oracle
  mismatched: string[] // human-readable "key.col oracle=… d1=…"
}

function diffRows(
  gate: string,
  oracle: Record<string, unknown>[],
  d1Rows: Record<string, unknown>[],
  keyCols: string[],
  specs: ColSpec[],
): void {
  const keyOf = (r: Record<string, unknown>) => keyCols.map((k) => String(r[k])).join('|')
  const d1ByKey = new Map<string, Record<string, unknown>>()
  for (const r of d1Rows) d1ByKey.set(keyOf(r), r)
  const oracleKeys = new Set(oracle.map(keyOf))

  const result: DiffResult = { missing: [], extra: [], mismatched: [] }

  for (const orow of oracle) {
    const key = keyOf(orow)
    const drow = d1ByKey.get(key)
    if (!drow) {
      result.missing.push(key)
      continue
    }
    for (const { col, kind } of specs) {
      if (!cellMatches(kind, orow[col], drow[col])) {
        result.mismatched.push(
          `${key}.${col} [${kind}] oracle=${JSON.stringify(orow[col])} d1=${JSON.stringify(drow[col])}`,
        )
      }
    }
  }
  for (const d of d1Rows) {
    const key = keyOf(d)
    if (!oracleKeys.has(key)) result.extra.push(key)
  }

  const problems = result.missing.length + result.extra.length + result.mismatched.length
  if (problems === 0) {
    pass(gate, `${oracle.length} rows × ${specs.length} cols matched`)
    return
  }
  const offenders: unknown[] = [
    ...result.missing.map((k) => `MISSING in D1: ${k}`),
    ...result.extra.map((k) => `EXTRA in D1: ${k}`),
    ...result.mismatched,
  ]
  fail(
    gate,
    `${result.missing.length} missing, ${result.extra.length} extra, ${result.mismatched.length} cell mismatches`,
    offenders,
  )
}

// ---------------------------------------------------------------------------
// D1 query helper
// ---------------------------------------------------------------------------

async function all(
  db: D1Database,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const res = await db.prepare(sql).all<Record<string, unknown>>()
  return res.results ?? []
}

async function count(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return Number(row?.n ?? -1)
}

// ---------------------------------------------------------------------------
// Column specs (driven from live _schema.json semantics)
// ---------------------------------------------------------------------------

const USER_STATS_SPECS: ColSpec[] = [
  { col: 'total_flights', kind: 'int' },
  { col: 'total_distance_km', kind: 'int' },
  { col: 'total_duration_minutes', kind: 'int' },
  { col: 'longest_flight_minutes', kind: 'int' },
  { col: 'airports_count', kind: 'int' },
  { col: 'cities_count', kind: 'int' },
  { col: 'countries_count', kind: 'int' },
  { col: 'continents_count', kind: 'int' },
  { col: 'airlines_count', kind: 'int' },
  { col: 'aircraft_count', kind: 'int' },
  { col: 'time_zones_count', kind: 'int' },
  { col: 'most_visited_country', kind: 'verbatim' },
  { col: 'most_visited_count', kind: 'int' },
  { col: 'world_completion_pct', kind: 'real' },
  { col: 'has_night_departure', kind: 'bool' },
  { col: 'updated_at', kind: 'timestamp' },
]

const USER_ADVANCED_STATS_SPECS: ColSpec[] = [
  { col: 'aircraft_breakdown', kind: 'json' },
  { col: 'aircraft_type_breakdown', kind: 'json' },
  { col: 'manufacturer_breakdown', kind: 'json' },
  { col: 'manufacturer_insights', kind: 'json' },
  { col: 'fleet_insights', kind: 'json' },
  { col: 'continent_breakdown', kind: 'json' },
  { col: 'region_breakdown', kind: 'json' },
  { col: 'departure_patterns', kind: 'json' },
  { col: 'duration_stats', kind: 'json' },
  { col: 'duration_year_comparison', kind: 'json' },
  { col: 'patterns', kind: 'json' },
  { col: 'card_insights', kind: 'json' },
  { col: 'duration_coverage', kind: 'real' },
  { col: 'duration_unlocked', kind: 'bool' },
  { col: 'avia_geek_unlocked', kind: 'bool' },
  { col: 'country_geek_unlocked', kind: 'bool' },
  { col: 'featured_fact', kind: 'verbatim' },
  { col: 'featured_fact_index', kind: 'int' },
  { col: 'created_at', kind: 'timestamp' },
  { col: 'updated_at', kind: 'timestamp' },
]

const USER_BADGES_SPECS: ColSpec[] = [
  { col: 'user_id', kind: 'verbatim' },
  { col: 'badge_id', kind: 'int' },
  { col: 'earned_at', kind: 'timestamp' },
]

const COUNTRY_CLAIMS_SPECS: ColSpec[] = [
  { col: 'user_id', kind: 'verbatim' },
  { col: 'country_code', kind: 'verbatim' },
  { col: 'claimed_at', kind: 'timestamp' },
]

const GROUND_VISITS_SPECS: ColSpec[] = [
  { col: 'user_id', kind: 'verbatim' },
  { col: 'country_code', kind: 'verbatim' },
  { col: 'visit_year', kind: 'int' },
  { col: 'entry_method', kind: 'verbatim' },
  { col: 'note', kind: 'verbatim' },
  { col: 'created_at', kind: 'timestamp' },
]

const BADGE_DEF_SPECS: ColSpec[] = [
  { col: 'code', kind: 'verbatim' },
  { col: 'name', kind: 'verbatim' },
  { col: 'description', kind: 'verbatim' },
  { col: 'category', kind: 'verbatim' },
  { col: 'tier', kind: 'verbatim' },
  { col: 'icon', kind: 'verbatim' },
  { col: 'points', kind: 'int' },
  { col: 'criteria', kind: 'json' },
]

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

/** Gate 1: top-level counts (user data + reference/seed). */
async function gate1Counts(db: D1Database): Promise<void> {
  console.log('\n── Gate 1: counts ──')
  gateCount('1.users', await count(db, 'users'), 26)
  gateCount('1.profiles', await count(db, 'profiles'), 26)
  gateCount('1.flights', await count(db, 'flights'), 343)
  gateCount('1.country_claims', await count(db, 'country_claims'), 37)
  gateCount('1.ground_visits', await count(db, 'ground_visits'), 15)
  gateCount('1.badge_definitions', await count(db, 'badge_definitions'), 60)
  gateCount('1.code_adjectives', await count(db, '_code_adjectives'), 50)
  gateCount('1.code_nouns', await count(db, '_code_nouns'), 50)

  // Seed reference counts derive from the seed SOURCE (packages/data) using the same
  // dedup-by-PK the seed layer applies, so the gate is self-consistent regardless of when
  // the seed SQL is authored/run. Verified: aircraft distinct-by-ICAO = 214, airports
  // distinct-by-IATA = 557.
  const aircraftExpected = distinctBy(loadJson<{ icao: string }[]>(join(DATA_SRC_DIR, 'aircraft.json')), (a) =>
    a.icao.toUpperCase(),
  )
  const airportsExpected = distinctBy(loadJson<{ iata: string }[]>(join(DATA_SRC_DIR, 'airports.json')), (a) =>
    a.iata.toUpperCase(),
  )
  gateCount('1.aircraft_reference', await count(db, 'aircraft_reference'), aircraftExpected)
  gateCount('1.airports_reference', await count(db, 'airports_reference'), airportsExpected)
}

function distinctBy<T>(arr: T[], key: (t: T) => string): number {
  return new Set(arr.map(key)).size
}

/** Gate 2: full row-by-row diff of derived per-user tables across ALL users × ALL columns. */
async function gate2DerivedStats(db: D1Database): Promise<void> {
  console.log('\n── Gate 2: derived per-user stats (row × column) ──')
  diffRows(
    '2.user_stats',
    loadSnapshot('user_stats'),
    await all(db, 'SELECT * FROM user_stats'),
    ['user_id'],
    USER_STATS_SPECS,
  )
  diffRows(
    '2.user_advanced_stats',
    loadSnapshot('user_advanced_stats'),
    await all(db, 'SELECT * FROM user_advanced_stats'),
    ['user_id'],
    USER_ADVANCED_STATS_SPECS,
  )
  // user_badges PK `id` is reassigned by AUTOINCREMENT on import, so key on the natural
  // (user_id, badge_id) unique pair rather than the synthetic id.
  diffRows(
    '2.user_badges',
    loadSnapshot('user_badges'),
    await all(db, 'SELECT * FROM user_badges'),
    ['user_id', 'badge_id'],
    USER_BADGES_SPECS,
  )
}

/** Gate 3: passport tables post-transform, row-by-row vs oracle. */
async function gate3Passport(db: D1Database): Promise<void> {
  console.log('\n── Gate 3: passport (country_claims + ground_visits) ──')
  // country_claims PK is a UUID carried verbatim → key on id.
  diffRows(
    '3.country_claims',
    loadSnapshot('country_claims'),
    await all(db, 'SELECT * FROM country_claims'),
    ['id'],
    COUNTRY_CLAIMS_SPECS,
  )
  // ground_visits CANONICAL CHOICE: RAW import (not regenerated). ground_visits is user-entered
  // passport data with no derivation rule, so the live rows ARE the source of truth; we import
  // each row verbatim (UUID id carried) and key on id. (Contrast: `visits` is derived from
  // flights and is regenerated, not imported — and is intentionally NOT gated here.)
  diffRows(
    '3.ground_visits',
    loadSnapshot('ground_visits'),
    await all(db, 'SELECT * FROM ground_visits'),
    ['id'],
    GROUND_VISITS_SPECS,
  )
}

/** Gate 4: seed-layer diffs (counts + sample/row-level vs source). */
async function gate4Seed(db: D1Database): Promise<void> {
  console.log('\n── Gate 4: seed layer ──')

  // badge_definitions is imported from the live snapshot (has real ids/criteria) → full diff.
  diffRows(
    '4.badge_definitions',
    loadSnapshot('badge_definitions'),
    await all(db, 'SELECT * FROM badge_definitions'),
    ['id'],
    BADGE_DEF_SPECS,
  )

  // code words: exact set equality vs source snapshot.
  await diffSeedWords(db, '4.code_adjectives', '_code_adjectives', 'code_adjectives')
  await diffSeedWords(db, '4.code_nouns', '_code_nouns', 'code_nouns')

  // aircraft / airports: count gated in Gate 1; here we sample-verify a deterministic subset
  // of PKs round-tripped from the seed source into D1 (name must match).
  await sampleAircraft(db)
  await sampleAirports(db)
}

async function diffSeedWords(
  db: D1Database,
  gate: string,
  table: string,
  snapshot: string,
): Promise<void> {
  const oracle = new Set(loadSnapshot<{ word: string }>(snapshot).map((r) => r.word))
  const d1 = new Set((await all(db, `SELECT word FROM ${table}`)).map((r) => String(r.word)))
  const missing = [...oracle].filter((w) => !d1.has(w))
  const extra = [...d1].filter((w) => !oracle.has(w))
  if (missing.length === 0 && extra.length === 0) {
    pass(gate, `${oracle.size} words matched`)
  } else {
    fail(gate, `${missing.length} missing, ${extra.length} extra`, [
      ...missing.map((w) => `MISSING: ${w}`),
      ...extra.map((w) => `EXTRA: ${w}`),
    ])
  }
}

async function sampleAircraft(db: D1Database): Promise<void> {
  const src = loadJson<{ icao: string; name: string }[]>(join(DATA_SRC_DIR, 'aircraft.json'))
  const sample = deterministicSample(src, 10)
  const offenders: unknown[] = []
  for (const a of sample) {
    const row = await db
      .prepare('SELECT name FROM aircraft_reference WHERE icao = ?')
      .bind(a.icao.toUpperCase())
      .first<{ name: string }>()
    if (!row) offenders.push(`MISSING icao=${a.icao}`)
    else if (row.name !== a.name)
      offenders.push(`icao=${a.icao} name oracle=${JSON.stringify(a.name)} d1=${JSON.stringify(row.name)}`)
  }
  if (offenders.length === 0) pass('4.aircraft_sample', `${sample.length} sampled PKs matched`)
  else fail('4.aircraft_sample', `${offenders.length} sample mismatches`, offenders)
}

async function sampleAirports(db: D1Database): Promise<void> {
  const src = loadJson<{ iata: string; name: string }[]>(join(DATA_SRC_DIR, 'airports.json'))
  const sample = deterministicSample(src, 10)
  const offenders: unknown[] = []
  for (const a of sample) {
    const row = await db
      .prepare('SELECT name FROM airports_reference WHERE iata = ?')
      .bind(a.iata.toUpperCase())
      .first<{ name: string }>()
    if (!row) offenders.push(`MISSING iata=${a.iata}`)
    else if (row.name !== a.name)
      offenders.push(`iata=${a.iata} name oracle=${JSON.stringify(a.name)} d1=${JSON.stringify(row.name)}`)
  }
  if (offenders.length === 0) pass('4.airports_sample', `${sample.length} sampled PKs matched`)
  else fail('4.airports_sample', `${offenders.length} sample mismatches`, offenders)
}

/** Evenly-spaced deterministic sample (first, last, and points between). */
function deterministicSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr
  const step = (arr.length - 1) / (n - 1)
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)])
  return out
}

/** Gate 5: leaderboard_cache non-empty AND exactly 5 categories. */
async function gate5Leaderboard(db: D1Database): Promise<void> {
  console.log('\n── Gate 5: leaderboard_cache ──')
  const total = await count(db, 'leaderboard_cache')
  if (total > 0) pass('5.leaderboard_nonempty', `rows=${total}`)
  else fail('5.leaderboard_nonempty', 'leaderboard_cache is empty')

  const cats = (await all(db, 'SELECT DISTINCT category FROM leaderboard_cache ORDER BY category')).map(
    (r) => String(r.category),
  )
  const EXPECTED = ['airlines', 'cities', 'countries', 'distance', 'flights']
  if (cats.length === 5 && EXPECTED.every((c) => cats.includes(c))) {
    pass('5.leaderboard_categories', `[${cats.join(', ')}]`)
  } else {
    fail('5.leaderboard_categories', `expected exactly 5 categories ${JSON.stringify(EXPECTED)}, got ${JSON.stringify(cats)}`)
  }
}

/** Gate 6: foreign-key closure inside D1 (no orphans). */
async function gate6FkClosure(db: D1Database): Promise<void> {
  console.log('\n── Gate 6: FK closure ──')
  await fkClosure(
    db,
    '6.profiles→users',
    'SELECT p.id FROM profiles p LEFT JOIN users u ON u.id = p.id WHERE u.id IS NULL',
  )
  await fkClosure(
    db,
    '6.flights→profiles',
    'SELECT f.id FROM flights f LEFT JOIN profiles p ON p.id = f.user_id WHERE p.id IS NULL',
  )
  await fkClosure(
    db,
    '6.user_badges→badge_definitions',
    'SELECT ub.id FROM user_badges ub LEFT JOIN badge_definitions b ON b.id = ub.badge_id WHERE b.id IS NULL',
  )
}

async function fkClosure(db: D1Database, gate: string, orphanSql: string): Promise<void> {
  const orphans = await all(db, orphanSql)
  if (orphans.length === 0) pass(gate, 'no orphans')
  else fail(gate, `${orphans.length} orphaned rows`, orphans.map((o) => JSON.stringify(o)))
}

/** Gate 7: canonical timestamps everywhere + no surviving RESET_REQUIRED password hashes. */
async function gate7Invariants(db: D1Database): Promise<void> {
  console.log('\n── Gate 7: timestamp format + password reset ──')

  // Every stored timestamp column must match the canonical YYYY-MM-DDTHH:MM:SS.sssZ form.
  const TS_COLUMNS: { table: string; cols: string[] }[] = [
    { table: 'users', cols: ['created_at'] },
    { table: 'profiles', cols: ['created_at', 'updated_at'] },
    { table: 'flights', cols: ['created_at', 'departure_utc', 'arrival_utc'] },
    { table: 'country_claims', cols: ['claimed_at'] },
    { table: 'ground_visits', cols: ['created_at'] },
    { table: 'user_stats', cols: ['updated_at'] },
    { table: 'user_advanced_stats', cols: ['created_at', 'updated_at'] },
    { table: 'user_badges', cols: ['earned_at'] },
    { table: 'leaderboard_cache', cols: ['updated_at'] },
  ]
  const tsOffenders: unknown[] = []
  for (const { table, cols } of TS_COLUMNS) {
    const rows = await all(db, `SELECT rowid AS _rid, ${cols.join(', ')} FROM ${table}`)
    for (const r of rows) {
      for (const c of cols) {
        const v = r[c]
        if (v === null || v === undefined) continue // nullable timestamps allowed (e.g. flights.*_utc)
        if (typeof v !== 'string' || !CANONICAL_TS.test(v)) {
          tsOffenders.push(`${table}.rowid=${r._rid}.${c} = ${JSON.stringify(v)}`)
        }
      }
    }
  }
  if (tsOffenders.length === 0) pass('7.canonical_timestamps', 'all stored timestamps canonical')
  else fail('7.canonical_timestamps', `${tsOffenders.length} non-canonical timestamps`, tsOffenders)

  // After reset-passwords, NO user may retain the RESET_REQUIRED sentinel as a stored hash.
  const reset = await all(
    db,
    "SELECT id, email FROM users WHERE password_hash = 'RESET_REQUIRED' OR password_hash LIKE '%RESET_REQUIRED%'",
  )
  if (reset.length === 0) pass('7.no_reset_required', 'no RESET_REQUIRED hashes remain')
  else fail('7.no_reset_required', `${reset.length} users still hold RESET_REQUIRED`, reset.map((r) => JSON.stringify(r)))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Kuuki Phase 5 — LOCAL D1 migration validation (read-only, exact-equality)\n')
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    persist: { path: '.wrangler/state/v3' },
  })
  const db = proxy.env.DB

  try {
    await gate1Counts(db)
    await gate2DerivedStats(db)
    await gate3Passport(db)
    await gate4Seed(db)
    await gate5Leaderboard(db)
    await gate6FkClosure(db)
    await gate7Invariants(db)
  } finally {
    await proxy.dispose()
  }

  console.log('')
  if (FAILED) {
    console.error('RESULT: FAIL — one or more gates failed. See offending rows above.')
    process.exit(1)
  }
  console.log('RESULT: PASS — all validation gates passed.')
  process.exit(0)
}

main().catch((err) => {
  console.error('FATAL — validation harness crashed (treated as failure):')
  console.error(err)
  process.exit(1)
})
