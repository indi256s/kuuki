#!/usr/bin/env npx tsx
/**
 * Phase 5 — DERIVE + DUAL-PATH ORACLE DIFF (LOCAL D1 ONLY).
 *
 * This script does NOT touch flights/profiles/users/badge_definitions — it assumes the
 * IMPORT step already loaded the source-of-truth tables (flights, profiles, users,
 * airports_reference, badge_definitions). It regenerates the DERIVED tables from those
 * imported flights using the SAME write-path services the live app uses, then loads the
 * live ORACLE snapshots and diffs regenerated-vs-imported across every user/column so a
 * human can decide which rows to ship.
 *
 * Derived tables in scope (the ONLY tables this script writes / truncates):
 *   visits, user_stats, user_advanced_stats, user_badges, leaderboard_cache
 *
 * CORRECTNESS MANDATE (see memory: kuuki-phase5-migration-correctness): regen-from-final-
 * state can NOT reconstruct live cumulative state (visits never decrement; badges were
 * awarded by a different code path / at a different clock). So this script NEVER silently
 * overwrites the live rows: it computes a diff, LOGS every divergence, and recommends
 * shipping the live (imported) rows wherever regen diverges. Nothing here is auto-applied
 * beyond the regen pass — the operator reads the report and chooses.
 *
 * Run:  npx tsx scripts/derive.ts            (uses getPlatformProxy -> env.DB)
 *
 * GUARDRAILS: LOCAL ONLY. getPlatformProxy reads .wrangler/state/v3 (the schema-applied,
 * import-populated local D1). Never --remote, never deploy, never push.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPlatformProxy } from 'wrangler'

import {
  syncVisitsFromFlight,
  recomputeUserStats,
  updateAdvancedStatsUnlocks,
  evaluateBadges,
} from '../functions/api/_services/stats'
import { refreshAdvancedStats } from '../functions/api/_services/advancedStats'
import { refreshLeaderboards } from '../functions/api/_services/leaderboard'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = join(__dirname, '..', 'db', '_snapshot')

// ---------------------------------------------------------------------------
// FAIL-LOUD assert. Every invariant in this migration must throw, never warn.
// ---------------------------------------------------------------------------
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

function loadSnapshot<T = Record<string, unknown>>(name: string): T[] {
  const raw = readFileSync(join(SNAPSHOT_DIR, `${name}.json`), 'utf8')
  const parsed = JSON.parse(raw)
  assert(Array.isArray(parsed), `snapshot ${name}.json must be a JSON array`)
  return parsed as T[]
}

// ---------------------------------------------------------------------------
// BADGE CLOCK DECISION (documented + implemented):
//
// evaluateBadges keys on "now" only for the `earned_at` TIMESTAMP it writes — NOT for any
// badge-selection criterion. Inspecting db/_snapshot/badge_definitions.json: every criteria
// key is a STAT THRESHOLD (flights, distance_km, airlines, aircraft, continents,
// flight_minutes), a static flag (night_departure, beta_invite) or a signup-order check
// (early_adopter). There is NO date-window criterion, so freezing the clock does not change
// WHICH badges regen would award — only the earned_at values, which would be wrong anyway
// (regen runs in 2026-06, the live awards happened 2026-02..03).
//
// MOREOVER the live ORACLE user_badges contains ONLY badge_id 63 (founding-user) for all 26
// users — 26 rows, nothing else. founding-user has criteria {"beta_invite": true}, so the
// live `evaluate_badges` ELSIF chain WOULD award it, but no stat-threshold badge was ever
// persisted live (the live trigger path apparently only ever wrote founding-user). regen via
// evaluateBadges, by contrast, WILL award first_flight / frequent_flyer / distance / etc. to
// the 17 users whose stats exceed thresholds — producing FAR MORE rows than the oracle.
//
// DECISION: treat regenerated user_badges as DIFF-CHECK ONLY. SHIP the live user_badges
// rows verbatim (correct earned_at, correct historical award set). We still RUN evaluateBadges
// during regen so the diff surfaces exactly which badges regen would have added/removed, but
// we DO NOT ship regenerated badges. The clock is therefore irrelevant to the ship decision;
// we leave it at real `now` and rely on the diff + ship-live policy.
//
// Founding-user provenance: live createUserWithProfile awards founding-user at signup; in
// this regen DB the import step is expected to have already loaded user_badges OR seeded
// founding-user. We do NOT re-seed it here. Because we ship the live user_badges rows, the
// founding-user rows are covered by the oracle regardless of regen.
// ---------------------------------------------------------------------------

// Tables this script is allowed to mutate. Truncated before regen, in child→safe order.
const DERIVED_TABLES = [
  'visits',
  'user_badges',
  'user_stats',
  'user_advanced_stats',
  'leaderboard_cache',
] as const

interface FlightReplayRow {
  user_id: string
  origin: string
  destination: string
  date: string
  is_upcoming: number | null
}

// Column sets to diff per derived table. Driven by the schema (0001_init.sql), NOT the stale
// generated types. AUTOINCREMENT ids (visits.id, user_badges.id, leaderboard_cache.id) and
// volatile timestamps (updated_at/created_at) are intentionally EXCLUDED from value diffs —
// they never match between regen and live and are not load-bearing for correctness.
const STATS_COLS = [
  'total_flights',
  'total_distance_km',
  'total_duration_minutes',
  'longest_flight_minutes',
  'airports_count',
  'cities_count',
  'countries_count',
  'continents_count',
  'airlines_count',
  'aircraft_count',
  'has_night_departure',
  // NOTE: time_zones_count / most_visited_* / world_completion_pct are NOT written by
  // recomputeUserStats (documented parity gap) — included so the diff flags them as divergent.
  'time_zones_count',
  'most_visited_country',
  'most_visited_count',
  'world_completion_pct',
] as const

const ADV_STATS_COLS = [
  'avia_geek_unlocked',
  'country_geek_unlocked',
  'duration_unlocked',
  'aircraft_breakdown',
  'aircraft_type_breakdown',
  'manufacturer_breakdown',
  'manufacturer_insights',
  'fleet_insights',
  'continent_breakdown',
  'region_breakdown',
  'departure_patterns',
  'duration_stats',
  'duration_year_comparison',
  'patterns',
  'card_insights',
  'duration_coverage',
  'featured_fact',
  'featured_fact_index',
] as const

const VISIT_COLS = ['country_code', 'city', 'first_visit', 'last_visit', 'visit_count'] as const
const BADGE_COLS = ['badge_id'] as const
const LB_COLS = ['value', 'rank', 'percentile', 'metadata'] as const

// ---------------------------------------------------------------------------
// Normalization for diff comparison. Live snapshots emit Postgres-flavored values
// (booleans as true/false, NUMERIC as 0.0, JSON columns as already-parsed objects).
// D1 stores 0/1 ints, REAL, and JSON columns as TEXT strings. Normalize both sides to a
// canonical comparable form before equality.
// ---------------------------------------------------------------------------
function normBool(v: unknown): number {
  if (v === true || v === 1 || v === '1') return 1
  if (v === false || v === 0 || v === '0' || v == null) return 0
  return Number(v) ? 1 : 0
}

/** Parse a possibly-stringified JSON column to a stable canonical string, or null. */
function normJson(v: unknown): string | null {
  if (v == null) return null
  let obj: unknown = v
  if (typeof v === 'string') {
    try {
      obj = JSON.parse(v)
    } catch {
      return v // not JSON — compare raw
    }
  }
  return stableStringify(obj)
}

/** Deterministic JSON stringify with sorted object keys, so key order can't cause false diffs. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
}

function normNum(v: unknown): number {
  return v == null ? 0 : Number(v)
}

interface Divergence {
  table: string
  key: string // user_id (+ category / airport_iata / badge_id) identifying the row
  column: string
  regenerated: unknown
  live: unknown
}

function pushIfDiff(
  out: Divergence[],
  table: string,
  key: string,
  column: string,
  regen: unknown,
  live: unknown,
  kind: 'num' | 'bool' | 'json' | 'text',
): void {
  let a: unknown = regen
  let b: unknown = live
  if (kind === 'num') {
    a = normNum(regen)
    b = normNum(live)
  } else if (kind === 'bool') {
    a = normBool(regen)
    b = normBool(live)
  } else if (kind === 'json') {
    a = normJson(regen)
    b = normJson(live)
  } else {
    a = regen ?? null
    b = live ?? null
  }
  if (a !== b) out.push({ table, key, column, regenerated: a, live: b })
}

const NUM_STATS = new Set<string>([
  'total_flights',
  'total_distance_km',
  'total_duration_minutes',
  'longest_flight_minutes',
  'airports_count',
  'cities_count',
  'countries_count',
  'continents_count',
  'airlines_count',
  'aircraft_count',
  'time_zones_count',
  'most_visited_count',
  'world_completion_pct',
])
const BOOL_STATS = new Set<string>(['has_night_departure'])

const BOOL_ADV = new Set<string>(['avia_geek_unlocked', 'country_geek_unlocked', 'duration_unlocked'])
const NUM_ADV = new Set<string>(['duration_coverage', 'featured_fact_index'])
const JSON_ADV = new Set<string>([
  'aircraft_breakdown',
  'aircraft_type_breakdown',
  'manufacturer_breakdown',
  'manufacturer_insights',
  'fleet_insights',
  'continent_breakdown',
  'region_breakdown',
  'departure_patterns',
  'duration_stats',
  'duration_year_comparison',
  'patterns',
  'card_insights',
])

async function main(): Promise<void> {
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>()
  const db = env.DB
  assert(db, 'env.DB binding missing — check wrangler.toml [[d1_databases]] binding="DB"')

  try {
    // ----- Preconditions: import must have already run -----------------------
    const pre = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM flights) AS flights,
           (SELECT COUNT(*) FROM profiles) AS profiles,
           (SELECT COUNT(*) FROM badge_definitions) AS bdefs,
           (SELECT COUNT(*) FROM airports_reference) AS airports`,
      )
      .first<{ flights: number; profiles: number; bdefs: number; airports: number }>()
    assert(pre, 'precondition query returned nothing')
    assert(pre.flights === 343, `expected 343 imported flights, found ${pre.flights} (run import first)`)
    assert(pre.profiles === 26, `expected 26 imported profiles, found ${pre.profiles}`)
    assert(pre.bdefs === 60, `expected 60 badge_definitions, found ${pre.bdefs}`)
    assert(pre.airports > 0, `airports_reference is empty (${pre.airports}) — distance/visits cannot derive`)

    // ----- DUAL-PATH step 1: truncate derived tables ------------------------
    console.log('[derive] truncating derived tables:', DERIVED_TABLES.join(', '))
    await db.batch(DERIVED_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE 1 = 1`)))

    // ----- Regen: per profile WITH flights, replay flights date ASC, id ASC --
    const flightUsers = await db
      .prepare(`SELECT DISTINCT user_id FROM flights ORDER BY user_id`)
      .all<{ user_id: string }>()
    const userIds = flightUsers.results.map((r) => r.user_id)
    assert(
      userIds.length === 17,
      `expected 17 users with flights (17 of 26 profiles), found ${userIds.length}`,
    )

    for (const userId of userIds) {
      // Replay in stable chronological then insertion order — the same order the live
      // triggers fired, so cumulative visit_count / first_visit / last_visit reproduce.
      const flights = await db
        .prepare(
          `SELECT user_id, origin, destination, date, is_upcoming
           FROM flights WHERE user_id = ? ORDER BY date ASC, id ASC`,
        )
        .bind(userId)
        .all<FlightReplayRow>()

      for (const f of flights.results) {
        // syncVisitsFromFlight itself skips upcoming; pass through verbatim.
        await syncVisitsFromFlight(db, userId, {
          origin: f.origin,
          destination: f.destination,
          date: f.date,
          is_upcoming: f.is_upcoming,
        })
      }

      // Stats chain (all (db, userId)). recomputeUserStats counts ONLY non-upcoming flights,
      // so upcoming-only users correctly land at total_flights=0 (matches live oracle).
      await recomputeUserStats(db, userId)
      await updateAdvancedStatsUnlocks(db, userId)
      await evaluateBadges(db, userId) // DIFF-CHECK ONLY (see BADGE CLOCK note); not shipped.
      await refreshAdvancedStats(db, userId)
    }

    // ----- Leaderboards: full rebuild ONCE at the end -----------------------
    await refreshLeaderboards(db)

    // ----- DUAL-PATH step 2: load ORACLE snapshots --------------------------
    const oVisits = loadSnapshot('visits')
    const oStats = loadSnapshot('user_stats')
    const oAdv = loadSnapshot('user_advanced_stats')
    const oBadges = loadSnapshot('user_badges')
    const oLb = loadSnapshot('leaderboard_cache')

    const divergences: Divergence[] = []

    // ---- user_stats diff (regen vs oracle), per user, per column -----------
    const rStats = (await db.prepare(`SELECT * FROM user_stats`).all<Record<string, unknown>>()).results
    diffByUser(divergences, 'user_stats', rStats, oStats, STATS_COLS, (col) =>
      NUM_STATS.has(col) ? 'num' : BOOL_STATS.has(col) ? 'bool' : 'text',
    )

    // ---- user_advanced_stats diff -----------------------------------------
    const rAdv = (await db.prepare(`SELECT * FROM user_advanced_stats`).all<Record<string, unknown>>()).results
    diffByUser(divergences, 'user_advanced_stats', rAdv, oAdv, ADV_STATS_COLS, (col) =>
      BOOL_ADV.has(col) ? 'bool' : NUM_ADV.has(col) ? 'num' : JSON_ADV.has(col) ? 'json' : 'text',
    )

    // ---- visits diff (keyed by user_id + airport_iata) --------------------
    const rVisits = (await db.prepare(`SELECT * FROM visits`).all<Record<string, unknown>>()).results
    diffByCompositeKey(
      divergences,
      'visits',
      rVisits,
      oVisits,
      (row) => `${row.user_id}|${row.airport_iata}`,
      VISIT_COLS,
      (col) => (col === 'visit_count' ? 'num' : 'text'),
    )

    // ---- user_badges diff (keyed by user_id + badge_id). EXPECTED to diverge
    //      heavily: regen awards stat badges; oracle has only founding-user. -
    const rBadges = (await db.prepare(`SELECT * FROM user_badges`).all<Record<string, unknown>>()).results
    diffByCompositeKey(
      divergences,
      'user_badges',
      rBadges,
      oBadges,
      (row) => `${row.user_id}|${row.badge_id}`,
      BADGE_COLS,
      () => 'num',
    )

    // ---- leaderboard_cache diff (keyed by user_id + category) -------------
    const rLb = (await db.prepare(`SELECT * FROM leaderboard_cache`).all<Record<string, unknown>>()).results
    diffByCompositeKey(
      divergences,
      'leaderboard_cache',
      rLb,
      oLb,
      (row) => `${row.user_id}|${row.category}`,
      LB_COLS,
      (col) => (col === 'metadata' ? 'json' : col === 'percentile' || col === 'value' ? 'num' : 'num'),
    )

    // ----- REPORT + ship recommendation -------------------------------------
    report(divergences, {
      user_stats: { regen: rStats.length, live: oStats.length },
      user_advanced_stats: { regen: rAdv.length, live: oAdv.length },
      visits: { regen: rVisits.length, live: oVisits.length },
      user_badges: { regen: rBadges.length, live: oBadges.length },
      leaderboard_cache: { regen: rLb.length, live: oLb.length },
    })
  } finally {
    await dispose()
  }
}

// ---------------------------------------------------------------------------
// Diff helpers
// ---------------------------------------------------------------------------

type KindFn = (col: string) => 'num' | 'bool' | 'json' | 'text'

/** Diff two row sets keyed by user_id (1 row per user). Flags missing rows on either side. */
function diffByUser(
  out: Divergence[],
  table: string,
  regenRows: Record<string, unknown>[],
  liveRows: Record<string, unknown>[],
  cols: readonly string[],
  kindOf: KindFn,
): void {
  const rMap = new Map(regenRows.map((r) => [String(r.user_id), r]))
  const lMap = new Map(liveRows.map((r) => [String(r.user_id), r]))
  const allKeys = new Set<string>([...rMap.keys(), ...lMap.keys()])
  for (const k of allKeys) {
    const r = rMap.get(k)
    const l = lMap.get(k)
    if (!r) {
      out.push({ table, key: k, column: '*ROW*', regenerated: 'MISSING', live: 'present' })
      continue
    }
    if (!l) {
      out.push({ table, key: k, column: '*ROW*', regenerated: 'present', live: 'MISSING' })
      continue
    }
    for (const col of cols) pushIfDiff(out, table, k, col, r[col], l[col], kindOf(col))
  }
}

/** Diff two row sets keyed by a composite key (e.g. user_id+airport_iata). */
function diffByCompositeKey(
  out: Divergence[],
  table: string,
  regenRows: Record<string, unknown>[],
  liveRows: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => string,
  cols: readonly string[],
  kindOf: KindFn,
): void {
  const rMap = new Map(regenRows.map((r) => [keyOf(r), r]))
  const lMap = new Map(liveRows.map((r) => [keyOf(r), r]))
  const allKeys = new Set<string>([...rMap.keys(), ...lMap.keys()])
  for (const k of allKeys) {
    const r = rMap.get(k)
    const l = lMap.get(k)
    if (!r) {
      out.push({ table, key: k, column: '*ROW*', regenerated: 'MISSING', live: 'present' })
      continue
    }
    if (!l) {
      out.push({ table, key: k, column: '*ROW*', regenerated: 'present', live: 'MISSING' })
      continue
    }
    for (const col of cols) pushIfDiff(out, table, k, col, r[col], l[col], kindOf(col))
  }
}

function report(
  divergences: Divergence[],
  counts: Record<string, { regen: number; live: number }>,
): void {
  console.log('\n=================== DUAL-PATH DERIVE REPORT ===================')
  for (const [t, c] of Object.entries(counts)) {
    console.log(`  ${t.padEnd(22)} regen=${c.regen}  live=${c.live}`)
  }

  const byTable = new Map<string, Divergence[]>()
  for (const d of divergences) {
    if (!byTable.has(d.table)) byTable.set(d.table, [])
    byTable.get(d.table)!.push(d)
  }

  console.log('\n--- DIVERGENCES (regenerated vs live oracle) ---')
  if (divergences.length === 0) {
    console.log('  NONE — every derived table is byte-identical to the live oracle.')
  } else {
    for (const [t, ds] of byTable) {
      console.log(`\n  [${t}] ${ds.length} divergence(s):`)
      for (const d of ds) {
        console.log(
          `    ${d.key}  ${d.column}: regen=${JSON.stringify(d.regenerated)}  live=${JSON.stringify(d.live)}`,
        )
      }
    }
  }

  console.log('\n--- SHIP RECOMMENDATION (per table) ---')
  for (const t of DERIVED_TABLES) {
    const n = byTable.get(t)?.length ?? 0
    if (n === 0) {
      console.log(`  ${t.padEnd(22)} IDENTICAL → ship REGENERATED rows.`)
    } else {
      console.log(`  ${t.padEnd(22)} ${n} divergence(s) → ship IMPORTED LIVE rows (never overwrite). See log above.`)
    }
  }
  console.log('===============================================================\n')
}

main().catch((err) => {
  console.error('[derive] FAILED:', err)
  process.exitCode = 1
})
