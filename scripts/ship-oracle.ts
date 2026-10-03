/** Read-only local comparison to archived derived rows. No mutation or global reset. */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeIso } from '../functions/api/_lib/time'
import { openLocalTarget, parseLocalTarget } from './migration-target'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
type Kind = 'verbatim' | 'int' | 'real' | 'bool' | 'json' | 'timestamp'
interface ColSpec { col: string; kind: Kind; notNull: boolean }
export type Bind = string | number | null
export interface TableDef {
  table: string
  specs: ColSpec[]
  autoincrement: boolean
  expectedCount: number
  expectedMaxId: number | null
  tsColumns: string[]
}

export function transform(spec: ColSpec, value: unknown, context: string): Bind {
  if (value == null) {
    if (spec.notNull) throw new Error(`Missing required ${context}`)
    return null
  }
  switch (spec.kind) {
    case 'verbatim':
      if (typeof value !== 'string') throw new Error(`Invalid text ${context}`)
      return value
    case 'int':
    case 'real': {
      const n = Number(value)
      if (!Number.isFinite(n) || (spec.kind === 'int' && !Number.isInteger(n))) throw new Error(`Invalid number ${context}`)
      return n
    }
    case 'bool':
      if (typeof value !== 'boolean') throw new Error(`Invalid boolean ${context}`)
      return value ? 1 : 0
    case 'json': return typeof value === 'string' ? value : JSON.stringify(value)
    case 'timestamp': {
      const normalized = normalizeIso(value as string)
      if (!normalized) throw new Error(`Invalid timestamp ${context}`)
      return normalized
    }
  }
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

export const TABLES: TableDef[] = [VISITS, USER_STATS, USER_ADVANCED_STATS, USER_BADGES, LEADERBOARD_CACHE]

export function buildRows(def: TableDef, snapshot: Record<string, unknown>[]): Bind[][] {
  return snapshot.map((row, i) => def.specs.map((spec) => transform(spec, row[spec.col], `${def.table}[${i}].${spec.col}`)))
}

/** Print aggregate comparison only; archived values and identifiers stay private. */
export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseLocalTarget(argv)
  const index = argv.indexOf('--snapshot-dir')
  const snapshotDir = index < 0 ? join(ROOT, 'db', '_snapshot') : resolve(argv[index + 1])
  const target = await openLocalTarget(options)
  try {
    // The cache is regenerated with new IDs on each refresh, so source cache
    // rows are not an authoritative migration comparison.
    for (const def of TABLES.filter((table) => table.table !== 'leaderboard_cache')) {
      const source = JSON.parse(readFileSync(join(snapshotDir, `${def.table}.json`), 'utf8')) as Record<string, unknown>[]
      const expected = buildRows(def, source)
      const columns = def.specs.map((spec) => spec.col)
      const result = await target.db.prepare(`SELECT ${columns.join(', ')} FROM ${def.table}`).all<Record<string, unknown>>()
      const actual = result.results
      const keyColumn = def.autoincrement ? 'id' : 'user_id'
      const keyIndex = columns.indexOf(keyColumn)
      const byKey = new Map(actual.map((row) => [String(row[keyColumn]), row]))
      let missing = 0
      let changed = 0
      for (const values of expected) {
        const row = byKey.get(String(values[keyIndex]))
        if (!row) { missing++; continue }
        if (columns.some((col, i) => String(row[col] ?? '') !== String(values[i] ?? ''))) changed++
      }
      const extra = actual.length - expected.length + missing
      console.log(`${def.table}: source=${expected.length} target=${actual.length} missing=${missing} changed=${changed} extra=${extra}`)
    }
  } finally {
    await target.dispose()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Oracle comparison failed; private values suppressed'); process.exitCode = 1 })
}
