// scripts/ship-oracle.ts — Phase 5 "ship imported live" step (LOCAL Cloudflare D1 ONLY).
//
// The council correctness mandate (memory: kuuki-phase5-migration-correctness): regen-from-
// final-state can NOT reconstruct live cumulative derived state. scripts/derive.ts regenerates
// the 5 derived tables and DIFFS them vs the live oracle, but it does NOT load the oracle rows.
// Where the TS regen diverges from live we SHIP THE LIVE (imported) oracle:
//   * user_badges  — live is founding-user-only; the regen awards a different set.
//   * user_stats   — live has parity-gap columns the TS port never computes.
//   * visits       — live diverges for edited/deleted flights (visits never decrement).
//   * user_advanced_stats / leaderboard_cache — shipped live for completeness/consistency.
//
// This script therefore SHIPS THE LIVE ORACLE for ALL 5 derived tables. It runs AFTER
// derive.ts (which leaves regenerated rows): for each table it DELETEs the regenerated rows
// then INSERTs the live oracle rows verbatim (with import-time transforms), so the subsequent
// scripts/validate.ts gates 2 (derived stats), 5 (leaderboard), and 7 (canonical timestamps)
// pass against the live oracle.
//
// Run:   npx tsx scripts/ship-oracle.ts        (NEVER against remote D1)
//
// SAFETY: LOCAL D1 ONLY. getPlatformProxy() with NO persist override reads the default
// .wrangler/state/v3 — the SAME local DB that sb-to-d1.ts / derive.ts / validate.ts use.
// This snapshot is the only copy of real user data; every assert FAILS LOUD (throw).
//
// Column lists below are the AUTHORITATIVE D1 target columns from db/migrations/0001_init.sql.
// Per-column transform KINDS are driven from db/_snapshot/_schema.json (LIVE Postgres
// data_type) and cross-checked against the ColSpec kinds in scripts/validate.ts so what we
// WRITE matches what validate COMPARES. Columns that exist only in D1 (not in the snapshot)
// are OMITTED from the INSERT and rely on the D1 DEFAULT (none for these 5 tables — every
// snapshot column maps 1:1 to a D1 column).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { getPlatformProxy } from 'wrangler'

// Reuse the REAL canonical timestamp normalizer — do NOT reimplement it. normalizeIso turns
// a Postgres timestamptz into the canonical YYYY-MM-DDTHH:MM:SS.sssZ form (gate 7).
import { normalizeIso } from '../functions/api/_lib/time'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = join(__dirname, '..', 'db', '_snapshot')

const CANONICAL_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// ---------------------------------------------------------------------------
// Snapshot loading
// ---------------------------------------------------------------------------

function readSnapshot<T = Record<string, unknown>>(name: string): T[] {
  const path = join(SNAPSHOT_DIR, `${name}.json`)
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as T[]
  if (!Array.isArray(parsed)) {
    throw new Error(`Snapshot ${name}.json did not parse to an array`)
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Per-column transform kinds (mirror scripts/validate.ts ColSpec semantics).
//
//   verbatim  — uuid / text / character varying / date / time → string carried as-is.
//   int       — integer / bigint / smallint → Number(value).
//   real      — numeric / double precision / real → Number(value).
//   bool      — boolean → INTEGER 1/0.
//   json      — jsonb / json → JSON.stringify(object|array); already-string kept; null → null.
//   timestamp — timestamptz → normalizeIso(value) (canonical ISO; gate 7).
// ---------------------------------------------------------------------------

type Kind = 'verbatim' | 'int' | 'real' | 'bool' | 'json' | 'timestamp'

interface ColSpec {
  /** D1 column name (== snapshot key for all 5 derived tables). */
  col: string
  kind: Kind
  /** Whether the D1 column is NOT NULL. A null in the snapshot for a NOT NULL column = fail loud. */
  notNull: boolean
}

type Bind = string | number | null

/**
 * Transform one snapshot value into its D1 bind form per the column kind. Fails loud on a
 * NOT NULL column holding a null/undefined, and on shape violations (e.g. a non-boolean for a
 * bool column, a non-finite number for an int/real column).
 */
function transform(spec: ColSpec, value: unknown, ctx: string): Bind {
  const isNullish = value === null || value === undefined

  if (isNullish) {
    if (spec.notNull) {
      throw new Error(`NOT NULL column ${ctx} is null in snapshot`)
    }
    return null
  }

  switch (spec.kind) {
    case 'verbatim': {
      if (typeof value !== 'string') {
        throw new Error(`Expected string (verbatim) for ${ctx}, got ${typeof value}: ${JSON.stringify(value)}`)
      }
      return value
    }
    case 'int': {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        throw new Error(`Expected finite integer for ${ctx}, got ${JSON.stringify(value)}`)
      }
      return n
    }
    case 'real': {
      const n = Number(value)
      if (!Number.isFinite(n)) {
        throw new Error(`Expected finite real for ${ctx}, got ${JSON.stringify(value)}`)
      }
      return n
    }
    case 'bool': {
      if (typeof value !== 'boolean') {
        throw new Error(`Expected boolean for ${ctx}, got ${typeof value}: ${JSON.stringify(value)}`)
      }
      return value ? 1 : 0
    }
    case 'json': {
      // jsonb/json column stored as D1 TEXT. Objects/arrays → JSON.stringify; an already-
      // serialized string is kept verbatim. (null handled above.)
      if (typeof value === 'string') return value
      return JSON.stringify(value)
    }
    case 'timestamp': {
      const iso = normalizeIso(value as string)
      if (iso === null) {
        throw new Error(`Required timestamp ${ctx} normalized to null from ${JSON.stringify(value)}`)
      }
      return iso
    }
  }
}

// ---------------------------------------------------------------------------
// Table definitions — D1 column order (0001_init.sql) × transform kind (_schema.json).
//
// Each column listed exists in BOTH the live snapshot and the D1 schema, so EVERY snapshot
// column is inserted (none rely on a D1 DEFAULT). D1-only columns (none for these 5 tables)
// would be omitted here.
// ---------------------------------------------------------------------------

interface TableDef {
  /** Snapshot file name == D1 table name. */
  table: string
  /** Snapshot/D1 columns to insert, in D1 column order. */
  specs: ColSpec[]
  /** AUTOINCREMENT id column to bump in sqlite_sequence after load, or null (text-PK tables). */
  autoincrement: boolean
  /** Expected row count after load (== snapshot length; asserted). */
  expectedCount: number
  /** Expected MAX(id) after load for autoincrement tables (asserted), else null. */
  expectedMaxId: number | null
  /** Timestamp columns to validate against CANONICAL_TS post-load (gate-7 invariant). */
  tsColumns: string[]
}

// visits — DERIVED airport visits. PK id is AUTOINCREMENT (insert explicitly).
// NOTE: first_visit / last_visit are data_type `date` in _schema.json (YYYY-MM-DD), NOT
// timestamptz — they are VERBATIM text, not timestamps. (validate.ts gate 7 does not list
// `visits`, consistent with this: visits has no canonical-ISO timestamp column.)
const VISITS: TableDef = {
  table: 'visits',
  specs: [
    { col: 'id', kind: 'int', notNull: true }, // INTEGER PK AUTOINCREMENT, preserved
    { col: 'user_id', kind: 'verbatim', notNull: true },
    { col: 'country_code', kind: 'verbatim', notNull: true },
    { col: 'airport_iata', kind: 'verbatim', notNull: false },
    { col: 'city', kind: 'verbatim', notNull: false },
    { col: 'first_visit', kind: 'verbatim', notNull: true }, // DATE YYYY-MM-DD verbatim
    { col: 'last_visit', kind: 'verbatim', notNull: true }, // DATE YYYY-MM-DD verbatim
    { col: 'visit_count', kind: 'int', notNull: true },
  ],
  autoincrement: true,
  expectedCount: 171,
  expectedMaxId: 1840,
  tsColumns: [],
}

// user_stats — DERIVED per-user stats. PK is user_id (text), inserted verbatim.
// Specs mirror validate.ts USER_STATS_SPECS exactly (plus user_id and NOT NULL flags).
const USER_STATS: TableDef = {
  table: 'user_stats',
  specs: [
    { col: 'user_id', kind: 'verbatim', notNull: true },
    { col: 'total_flights', kind: 'int', notNull: true },
    { col: 'total_distance_km', kind: 'int', notNull: true }, // bigint → int
    { col: 'total_duration_minutes', kind: 'int', notNull: true }, // bigint → int
    { col: 'longest_flight_minutes', kind: 'int', notNull: true },
    { col: 'airports_count', kind: 'int', notNull: true },
    { col: 'cities_count', kind: 'int', notNull: true },
    { col: 'countries_count', kind: 'int', notNull: true },
    { col: 'continents_count', kind: 'int', notNull: true },
    { col: 'airlines_count', kind: 'int', notNull: true },
    { col: 'aircraft_count', kind: 'int', notNull: true },
    { col: 'time_zones_count', kind: 'int', notNull: true },
    { col: 'most_visited_country', kind: 'verbatim', notNull: false },
    { col: 'most_visited_count', kind: 'int', notNull: true },
    { col: 'world_completion_pct', kind: 'real', notNull: true },
    { col: 'has_night_departure', kind: 'bool', notNull: true },
    { col: 'updated_at', kind: 'timestamp', notNull: true },
  ],
  autoincrement: false,
  expectedCount: 17,
  expectedMaxId: null,
  tsColumns: ['updated_at'],
}

// user_advanced_stats — DERIVED. PK is user_id (text), inserted verbatim. JSONB cols → TEXT.
// Specs mirror validate.ts USER_ADVANCED_STATS_SPECS exactly (plus user_id and NOT NULL flags).
const USER_ADVANCED_STATS: TableDef = {
  table: 'user_advanced_stats',
  specs: [
    { col: 'user_id', kind: 'verbatim', notNull: true },
    { col: 'aircraft_breakdown', kind: 'json', notNull: false },
    { col: 'aircraft_type_breakdown', kind: 'json', notNull: false },
    { col: 'manufacturer_breakdown', kind: 'json', notNull: false },
    { col: 'manufacturer_insights', kind: 'json', notNull: false },
    { col: 'fleet_insights', kind: 'json', notNull: false },
    { col: 'continent_breakdown', kind: 'json', notNull: false },
    { col: 'region_breakdown', kind: 'json', notNull: false },
    { col: 'departure_patterns', kind: 'json', notNull: false },
    { col: 'duration_stats', kind: 'json', notNull: false },
    { col: 'duration_year_comparison', kind: 'json', notNull: false },
    { col: 'patterns', kind: 'json', notNull: false },
    { col: 'card_insights', kind: 'json', notNull: false },
    { col: 'duration_coverage', kind: 'real', notNull: false },
    { col: 'duration_unlocked', kind: 'bool', notNull: true },
    { col: 'avia_geek_unlocked', kind: 'bool', notNull: true },
    { col: 'country_geek_unlocked', kind: 'bool', notNull: true },
    { col: 'featured_fact', kind: 'verbatim', notNull: false },
    { col: 'featured_fact_index', kind: 'int', notNull: false },
    { col: 'created_at', kind: 'timestamp', notNull: true },
    { col: 'updated_at', kind: 'timestamp', notNull: true },
  ],
  autoincrement: false,
  expectedCount: 17,
  expectedMaxId: null,
  tsColumns: ['created_at', 'updated_at'],
}

// user_badges — DERIVED (founding-user-only live set). PK id is AUTOINCREMENT (insert
// explicitly). Specs mirror validate.ts USER_BADGES_SPECS (id added; preserved verbatim).
const USER_BADGES: TableDef = {
  table: 'user_badges',
  specs: [
    { col: 'id', kind: 'int', notNull: true }, // INTEGER PK AUTOINCREMENT, preserved
    { col: 'user_id', kind: 'verbatim', notNull: true },
    { col: 'badge_id', kind: 'int', notNull: true },
    { col: 'earned_at', kind: 'timestamp', notNull: true },
  ],
  autoincrement: true,
  expectedCount: 26,
  expectedMaxId: 43,
  tsColumns: ['earned_at'],
}

// leaderboard_cache — DERIVED cache. PK id is AUTOINCREMENT (insert explicitly). metadata is
// JSONB → TEXT. value/percentile numeric → real. validate.ts gate 7 lists updated_at.
const LEADERBOARD_CACHE: TableDef = {
  table: 'leaderboard_cache',
  specs: [
    { col: 'id', kind: 'int', notNull: true }, // INTEGER PK AUTOINCREMENT, preserved
    { col: 'user_id', kind: 'verbatim', notNull: true },
    { col: 'category', kind: 'verbatim', notNull: true },
    { col: 'value', kind: 'real', notNull: true },
    { col: 'rank', kind: 'int', notNull: true },
    { col: 'percentile', kind: 'real', notNull: false },
    { col: 'metadata', kind: 'json', notNull: false },
    { col: 'updated_at', kind: 'timestamp', notNull: true },
  ],
  autoincrement: true,
  expectedCount: 25,
  expectedMaxId: 1545,
  tsColumns: ['updated_at'],
}

const TABLES: TableDef[] = [VISITS, USER_STATS, USER_ADVANCED_STATS, USER_BADGES, LEADERBOARD_CACHE]

// ---------------------------------------------------------------------------
// Chunked INSERT builder (mirrors scripts/sb-to-d1.ts buildInserts).
// Bind-variable budget per D1 statement = 100; rowsPerInsert = floor(100 / numCols).
// ---------------------------------------------------------------------------

function rowsPerInsert(numCols: number): number {
  return Math.floor(100 / numCols)
}

function buildInserts(
  db: D1Database,
  table: string,
  columns: string[],
  rows: Bind[][],
): D1PreparedStatement[] {
  const numCols = columns.length
  for (const r of rows) {
    if (r.length !== numCols) {
      throw new Error(`Row arity ${r.length} != ${numCols} columns for ${table}`)
    }
  }
  const perInsert = rowsPerInsert(numCols)
  const colList = columns.join(', ')
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`
  const statements: D1PreparedStatement[] = []
  for (let i = 0; i < rows.length; i += perInsert) {
    const chunk = rows.slice(i, i + perInsert)
    const placeholders = chunk.map(() => rowPlaceholder).join(', ')
    const binds: Bind[] = []
    for (const r of chunk) binds.push(...r)
    statements.push(
      db.prepare(`INSERT INTO ${table} (${colList}) VALUES ${placeholders}`).bind(...binds),
    )
  }
  return statements
}

// ---------------------------------------------------------------------------
// Transform a whole snapshot table into ordered bind tuples (throws on any shape violation
// BEFORE any DB write for that table).
// ---------------------------------------------------------------------------

function buildRows(def: TableDef, snapshot: Record<string, unknown>[]): Bind[][] {
  return snapshot.map((row, i) =>
    def.specs.map((spec) => transform(spec, row[spec.col], `${def.table}[${i}].${spec.col}`)),
  )
}

// ---------------------------------------------------------------------------
// D1 query helpers
// ---------------------------------------------------------------------------

async function count(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return Number(row?.n ?? -1)
}

async function maxId(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${table}`).first<{ m: number }>()
  return Number(row?.m ?? 0)
}

async function all(db: D1Database, sql: string): Promise<Record<string, unknown>[]> {
  const res = await db.prepare(sql).all<Record<string, unknown>>()
  return res.results ?? []
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  // Build all bind tuples first — any shape/null violation throws before a single write.
  const loaded = TABLES.map((def) => {
    const snapshot = readSnapshot(def.table)
    assert(
      snapshot.length === def.expectedCount,
      `${def.table} snapshot has ${snapshot.length} rows, expected ${def.expectedCount}`,
    )
    const columns = def.specs.map((s) => s.col)
    const rows = buildRows(def, snapshot)
    return { def, columns, rows }
  })

  const proxy = await getPlatformProxy<{ DB: D1Database }>()
  try {
    const db = proxy.env.DB
    if (!db) throw new Error('env.DB is undefined — local D1 binding not found')

    const summary: { table: string; rows: number; maxId: number | null }[] = []

    for (const { def, columns, rows } of loaded) {
      // (d) idempotent preamble: clear derive.ts's regenerated rows first.
      await db.prepare(`DELETE FROM ${def.table}`).run()

      // (f) chunked INSERTs at floor(100/numCols) via db.batch.
      await db.batch(buildInserts(db, def.table, columns, rows))

      // (g) bump sqlite_sequence for AUTOINCREMENT tables so future inserts don't collide.
      let loadedMaxId: number | null = null
      if (def.autoincrement) {
        // Inserting rows with explicit ids already created the sqlite_sequence row and set it
        // to MAX(id); UPDATE it explicitly to be safe. (sqlite_sequence has no UNIQUE/PK, so
        // ON CONFLICT is invalid — D1 rejects it.)
        await db
          .prepare(
            `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM ${def.table}) WHERE name = '${def.table}'`,
          )
          .run()
        loadedMaxId = await maxId(db, def.table)
      }

      summary.push({ table: def.table, rows: rows.length, maxId: loadedMaxId })
    }

    // ── POST-LOAD ASSERTS (throw on any failure) ──────────────────────────
    for (const def of TABLES) {
      const n = await count(db, def.table)
      assert(n === def.expectedCount, `${def.table} count ${n} != ${def.expectedCount}`)

      if (def.expectedMaxId !== null) {
        const m = await maxId(db, def.table)
        assert(m === def.expectedMaxId, `${def.table} MAX(id) ${m} != ${def.expectedMaxId}`)
      }

      // Every written timestamp column must be canonical YYYY-MM-DDTHH:MM:SS.sssZ.
      if (def.tsColumns.length > 0) {
        const rows = await all(db, `SELECT rowid AS _rid, ${def.tsColumns.join(', ')} FROM ${def.table}`)
        for (const r of rows) {
          for (const c of def.tsColumns) {
            const v = r[c]
            assert(
              typeof v === 'string' && CANONICAL_TS.test(v),
              `${def.table}.rowid=${r._rid}.${c} is not canonical: ${JSON.stringify(v)}`,
            )
          }
        }
      }
    }

    // leaderboard_cache must have exactly 5 distinct categories.
    const cats = (await all(db, 'SELECT DISTINCT category FROM leaderboard_cache ORDER BY category')).map(
      (r) => String(r.category),
    )
    assert(
      cats.length === 5,
      `leaderboard_cache has ${cats.length} distinct categories, expected 5: ${JSON.stringify(cats)}`,
    )

    // ── Summary ───────────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log('Shipped live oracle into LOCAL D1 (replacing derive.ts regenerated rows):')
    for (const s of summary) {
      const idPart = s.maxId !== null ? ` (max id ${s.maxId})` : ''
      // eslint-disable-next-line no-console
      console.log(`  ${s.table.padEnd(20)} rows=${s.rows}${idPart}`)
    }
    // eslint-disable-next-line no-console
    console.log(
      `Asserts passed: counts [171/17/17/26/25], max ids [visits 1840, user_badges 43, leaderboard_cache 1545], ` +
        `canonical timestamps, leaderboard categories=${cats.length} ${JSON.stringify(cats)}.`,
    )
  } finally {
    await proxy.dispose()
  }
}

// Only run when invoked directly (npx tsx scripts/ship-oracle.ts), not on import.
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
}
