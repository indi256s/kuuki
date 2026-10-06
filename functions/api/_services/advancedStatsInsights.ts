import { EARTH_CIRCUMFERENCE_KM, MOON_DISTANCE_KM } from '../../../packages/shared/src/constants'
// Advanced-stats PROSE/insight breakdowns — faithful ports of the live PL/pgSQL
// `compute_*` functions (see db/_extracted/LOGIC_SPEC.md "refresh_advanced_stats").
//
// These produce the user-facing GLaDOS-persona copy embedded in user_advanced_stats.
// Every template string below is copied CHARACTER-FOR-CHARACTER from the live function
// bodies (pg_get_functiondef on ref cwmotwkvpdkfrtjxmoce); thresholds, branch order and
// tie-breaks match the source. Do NOT "improve" the prose — drift is a defect.
//
// Each function is PURE/read-only and returns the EXACT JSON shape the live Supabase
// function returns. The orchestrator's composer JSON.stringifies these into the
// user_advanced_stats TEXT columns (this module returns JS values, never strings).
//
// Parity notes (do NOT "fix"):
//   * fleet/manufacturer insights aggregate COMPLETED flights only (lifecycle_state
//     awaiting or logged) with aircraft_icao not null, LEFT JOIN aircraft_reference on icao.
//   * Postgres ROUND(numeric) rounds HALF-AWAY-FROM-ZERO. All rounded values here are
//     non-negative, so JS Math.round (half toward +Infinity) matches for 0-decimal
//     cases; roundHalfAwayFromZero handles the 1-decimal cases for safety.
//   * NUMERIC values placed in a jsonb_build_object serialize as plain JSON numbers
//     (40.0 -> 40, 26.7 -> 26.7): use roundN -> number.
//   * NUMERIC values concatenated into a STRING via format('%s', ...) or `||` keep the
//     numeric's TEXT form, which preserves a trailing .0 (2.0 laps, 13.0 days): use
//     toFixed1 for those embeds.

import { firstOf, type BatchedRead } from './stats'

// --- rounding helpers (Postgres-numeric parity) -------------------------------------------

/** Postgres ROUND(numeric, d): half-away-from-zero. Returns a number (for jsonb fields). */
function roundN(x: number, d: number): number {
  const f = 10 ** d
  return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f
}

/**
 * Render a value the way Postgres renders a NUMERIC rounded to 1 decimal when it is
 * concatenated into text (always one fractional digit, e.g. 2 -> "2.0", 12.97 -> "13.0").
 */
function toFixed1(x: number): string {
  return roundN(x, 1).toFixed(1)
}

// --- types --------------------------------------------------------------------------------

export interface FleetHero {
  icao: string
  model: string
  manufacturer: string
  name: string
  type: string
  count: number
  pct: number
  total_distance_km: number
  total_duration_minutes: number
  fun_fact: string
}

export interface FleetInsights {
  hero: FleetHero
}

export interface ManufacturerDominant {
  name: string
  pct: number
  count: number
  types_count: number
  loyalty_label: string
  loyalty_quip: string
}

export interface ManufacturerInsights {
  dominant: ManufacturerDominant
}

export type CardInsights = Record<string, string>

export interface DurationYearComparison {
  current_year: number
  current_total_minutes: number
  previous_total_minutes: number
  delta_percent: number | null
}

// =========================================================================================
// 1. compute_fleet_insights -> { hero: { ...top aircraft by count..., fun_fact } }
//    Completed flights, aircraft_icao not null, LEFT JOIN aircraft_reference. Hero = top
//    aircraft by COUNT(*) DESC (LIMIT 1). fun_fact by distance/duration thresholds.
//    Returns null when there are no completed flights with an aircraft.
// =========================================================================================

export function computeFleetInsights(db: D1Database, userId: string): BatchedRead<FleetInsights | null> {
  const total = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM flights
       WHERE user_id = ?
         AND aircraft_icao IS NOT NULL
         AND lifecycle_state IN ('awaiting', 'logged')`,
    )
    .bind(userId)

  const hero = db
    .prepare(
      `SELECT
         f.aircraft_icao AS icao,
         COALESCE(ar.model, f.aircraft_icao) AS model,
         COALESCE(ar.manufacturer, 'Unknown') AS manufacturer,
         COALESCE(ar.name, f.aircraft_icao) AS name,
         COALESCE(ar.type, 'unknown') AS type,
         COUNT(*) AS flight_count,
         COALESCE(SUM(f.distance_km), 0) AS total_distance_km,
         COALESCE(SUM(f.duration_minutes), 0) AS total_duration_minutes
       FROM flights f
       LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
       WHERE f.user_id = ?
         AND f.aircraft_icao IS NOT NULL
         AND f.lifecycle_state IN ('awaiting', 'logged')
       GROUP BY f.aircraft_icao, ar.model, ar.manufacturer, ar.name, ar.type
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
    )
    .bind(userId)

  return {
    statements: [total, hero],
    derive: ([totalResult, heroResult]) => fleetInsights(
      firstOf<{ n: number }>(totalResult)?.n ?? 0,
      firstOf<FleetHeroRow>(heroResult),
    ),
  }
}

interface FleetHeroRow {
  icao: string
  model: string
  manufacturer: string
  name: string
  type: string
  flight_count: number
  total_distance_km: number
  total_duration_minutes: number
}

function fleetInsights(totalFlights: number, hero: FleetHeroRow | null): FleetInsights | null {
  if (totalFlights === 0) return null
  if (!hero) return null

  const distanceKm = hero.total_distance_km
  const durationMin = hero.total_duration_minutes

  let funFact: string
  if (distanceKm >= MOON_DISTANCE_KM) {
    funFact = 'Enough to reach the Moon. The irony of going nowhere in particular is not lost on us.'
  } else if (distanceKm >= EARTH_CIRCUMFERENCE_KM) {
    funFact = `That's ${toFixed1(distanceKm / EARTH_CIRCUMFERENCE_KM)} laps around Earth on this aircraft alone. For science.`
  } else if (distanceKm >= 10000) {
    funFact = `Enough to cross the Atlantic ${roundN(distanceKm / 5570, 0)} times. The cabin air was complimentary.`
  } else if (distanceKm >= 3000) {
    funFact = `${roundN(distanceKm, 0)} km on this type alone. The seat cushion remembers you.`
  } else if (durationMin >= 1440) {
    funFact = `${roundN(durationMin / 60, 0)} hours of recycled cabin air on this aircraft. Your lungs have been noted.`
  } else if (durationMin >= 120) {
    funFact = `${roundN(durationMin / 60, 0)} hours logged. The tray table has become a familiar workspace.`
  } else {
    funFact = `${hero.flight_count} flights. Developing a preference, are we?`
  }

  return {
    hero: {
      icao: hero.icao,
      model: hero.model,
      manufacturer: hero.manufacturer,
      name: hero.name,
      type: hero.type,
      count: hero.flight_count,
      pct: roundN((hero.flight_count / totalFlights) * 100, 1),
      total_distance_km: roundN(distanceKm, 0),
      total_duration_minutes: roundN(durationMin, 0),
      fun_fact: funFact,
    },
  }
}

// =========================================================================================
// 2. compute_manufacturer_insights -> { dominant: { ...top manufacturer..., loyalty } }
//    Completed flights, aircraft_icao not null, LEFT JOIN aircraft_reference, COALESCE
//    manufacturer 'Unknown'. Dominant = top manufacturer by COUNT(*) DESC (LIMIT 1).
//    types_count = COUNT(DISTINCT aircraft_icao) within the dominant manufacturer.
//    loyalty by pct thresholds >=80 / >=60 / >=40 / else. Null when no completed flights.
// =========================================================================================

export function computeManufacturerInsights(db: D1Database, userId: string): BatchedRead<ManufacturerInsights | null> {
  const total = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM flights
       WHERE user_id = ?
         AND aircraft_icao IS NOT NULL
         AND lifecycle_state IN ('awaiting', 'logged')`,
    )
    .bind(userId)

  // types_count = COUNT(DISTINCT aircraft_icao) within the dominant manufacturer's group.
  const dominant = db
    .prepare(
      `SELECT
         COALESCE(ar.manufacturer, 'Unknown') AS name,
         COUNT(*) AS flight_count,
         COUNT(DISTINCT f.aircraft_icao) AS types_count
       FROM flights f
       LEFT JOIN aircraft_reference ar ON f.aircraft_icao = ar.icao
       WHERE f.user_id = ?
         AND f.aircraft_icao IS NOT NULL
         AND f.lifecycle_state IN ('awaiting', 'logged')
       GROUP BY COALESCE(ar.manufacturer, 'Unknown')
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
    )
    .bind(userId)

  return {
    statements: [total, dominant],
    derive: ([totalResult, dominantResult]) => manufacturerInsights(
      firstOf<{ n: number }>(totalResult)?.n ?? 0,
      firstOf<{ name: string; flight_count: number; types_count: number }>(dominantResult),
    ),
  }
}

function manufacturerInsights(
  totalFlights: number,
  dominant: { name: string; flight_count: number; types_count: number } | null,
): ManufacturerInsights | null {
  if (totalFlights === 0) return null
  if (!dominant) return null

  const pct = roundN((dominant.flight_count / totalFlights) * 100, 1)
  const typesCount = dominant.types_count

  let loyaltyLabel: string
  let loyaltyQuip: string
  if (pct >= 80) {
    loyaltyLabel = 'Devoted test subject'
    loyaltyQuip = `Your ${dominant.name} loyalty has been recorded. They should name a seat after you. Row 17B, perhaps.`
  } else if (pct >= 60) {
    loyaltyLabel = 'Reliably predictable'
    loyaltyQuip = `You favor ${dominant.name} ${roundN(pct, 0)}% of the time. The predictability is... comforting. For them.`
  } else if (pct >= 40) {
    loyaltyLabel = 'Mildly committed'
    loyaltyQuip = `${dominant.name} leads your fleet at ${roundN(pct, 0)}%. A plurality, not a mandate. How democratic.`
  } else {
    loyaltyLabel = 'Manufacturer-agnostic'
    loyaltyQuip = 'No clear manufacturer preference. You fly whatever gets you there. A pragmatist. How refreshing.'
  }

  return {
    dominant: {
      name: dominant.name,
      pct,
      count: dominant.flight_count,
      types_count: typesCount,
      loyalty_label: loyaltyLabel,
      loyalty_quip: loyaltyQuip,
    },
  }
}

// --- card-insight helpers (jsonb_each_text + ORDER BY value DESC/ASC LIMIT 1 parity) -------

/** Parse a stored JSON TEXT column into a {key:number} map; {} for null/empty/invalid. */
function parseCountMap(raw: string | null | undefined): Record<string, number> {
  if (!raw || raw === '{}') return {}
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const k of Object.keys(obj)) out[k] = Number(obj[k])
    return out
  } catch {
    return {}
  }
}

/**
 * jsonb_each_text iterates keys in jsonb STORAGE order: shorter keys first, then
 * bytewise. Live card_insights does `ORDER BY value::int DESC/ASC LIMIT 1` with NO
 * secondary key, so a value tie is broken by that storage order. Reproduce it so the
 * single max/min we pick matches the live row.
 */
function jsonbKeyOrder(map: Record<string, number>): string[] {
  return Object.keys(map).sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0))
}

function topKey(map: Record<string, number>): string | null {
  const keys = jsonbKeyOrder(map)
  if (keys.length === 0) return null
  let best = keys[0]
  for (const k of keys) if (map[k] > map[best]) best = k
  return best
}

function leastKey(map: Record<string, number>): string | null {
  const keys = jsonbKeyOrder(map)
  if (keys.length === 0) return null
  let best = keys[0]
  for (const k of keys) if (map[k] < map[best]) best = k
  return best
}

function sumValues(map: Record<string, number>): number {
  let s = 0
  for (const k of Object.keys(map)) s += map[k]
  return s
}

// =========================================================================================
// 3. compute_card_insights -> { aircraft?, manufacturer?, continent?, duration? }
//    Live function UPDATEs user_advanced_stats.card_insights from the aircraft / manufacturer
//    / continent / duration breakdown columns. This port computes the same JSON object from
//    the freshly computed breakdowns. Keys are only added when their breakdown is present &
//    non-empty.
//
//    Number embeds use `||` in the live SQL: percentages are ROUND(x, 0) integers, the
//    duration days value is ROUND(min/1440, 1) which keeps a trailing .0 in text form.
// =========================================================================================

export function cardInsightsFromBreakdowns(row: {
  aircraft_breakdown: string | null
  manufacturer_breakdown: string | null
  continent_breakdown: string | null
  duration_stats: string | null
}): CardInsights {
  const insights: CardInsights = {}

  // Aircraft insight: most-flown model from aircraft_breakdown.
  const aircraft = parseCountMap(row.aircraft_breakdown)
  if (Object.keys(aircraft).length > 0) {
    const topK = topKey(aircraft)
    const topV = topK ? aircraft[topK] : 0
    const totalV = sumValues(aircraft)
    if (totalV > 0 && topK) {
      const pct = roundN((topV / totalV) * 100, 0)
      insights.aircraft = `${topK} is your workhorse — ${pct}% of all flights`
    }
  }

  // Manufacturer insight: top manufacturer from manufacturer_breakdown.
  const manufacturer = parseCountMap(row.manufacturer_breakdown)
  if (Object.keys(manufacturer).length > 0) {
    const topK = topKey(manufacturer)
    const topV = topK ? manufacturer[topK] : 0
    const totalV = sumValues(manufacturer)
    if (totalV > 0 && topK) {
      const pct = roundN((topV / totalV) * 100, 0)
      insights.manufacturer = `${topK} dominates your fleet — ${pct}% of flights`
    }
  }

  // Continent insight: most and least explored.
  const continent = parseCountMap(row.continent_breakdown)
  if (Object.keys(continent).length > 0) {
    const topK = topKey(continent)
    const leastK = leastKey(continent)
    if (topK && leastK) {
      if (topK === leastK) {
        insights.continent = `Your travel leans ${topK} — time to explore new continents?`
      } else {
        insights.continent = `Your travel leans ${topK} — explore ${leastK} next?`
      }
    }
  }

  // Duration insight: convert total_minutes to days (ROUND(min/1440, 1), keeps trailing .0).
  if (row.duration_stats) {
    let totalMinutes: number | null = null
    try {
      const ds = JSON.parse(row.duration_stats) as { total_minutes?: unknown }
      if (ds && ds.total_minutes != null) totalMinutes = Number(ds.total_minutes)
    } catch {
      totalMinutes = null
    }
    if (totalMinutes != null && totalMinutes > 0) {
      const days = toFixed1(totalMinutes / 1440)
      insights.duration = `Your total time in air equals ${days} days`
    }
  }

  return insights
}

// =========================================================================================
// 4. compute_duration_year_comparison
//    Live function RETURNS void and UPDATEs user_advanced_stats.duration_year_comparison.
//    This port RETURNS the JSON object (caller stringifies into duration_year_comparison).
//    Current vs previous calendar-year total duration over COMPLETED flights with
//    duration not null. delta_percent = ROUND((cur-prev)/prev*100, 1), or null when prev=0.
//    SQLite has no EXTRACT(YEAR FROM date): the year is the first 4 chars of the
//    'YYYY-MM-DD' date string.
// =========================================================================================

export function computeDurationYearComparison(db: D1Database, userId: string): BatchedRead<DurationYearComparison> {
  const currentYear = new Date().getUTCFullYear()

  const cur = db
    .prepare(
      `SELECT COALESCE(SUM(duration_minutes), 0) AS total
       FROM flights
       WHERE user_id = ?
         AND CAST(substr(date, 1, 4) AS INTEGER) = ?
         AND lifecycle_state IN ('awaiting', 'logged')
         AND duration_minutes IS NOT NULL`,
    )
    .bind(userId, currentYear)

  const prev = db
    .prepare(
      `SELECT COALESCE(SUM(duration_minutes), 0) AS total
       FROM flights
       WHERE user_id = ?
         AND CAST(substr(date, 1, 4) AS INTEGER) = ?
         AND lifecycle_state IN ('awaiting', 'logged')
         AND duration_minutes IS NOT NULL`,
    )
    .bind(userId, currentYear - 1)

  return {
    statements: [cur, prev],
    derive([curResult, prevResult]) {
      const currentTotal = firstOf<{ total: number }>(curResult)?.total ?? 0
      const previousTotal = firstOf<{ total: number }>(prevResult)?.total ?? 0
      const deltaPercent = previousTotal > 0 ? roundN(((currentTotal - previousTotal) / previousTotal) * 100, 1) : null
      return {
        current_year: currentYear,
        current_total_minutes: currentTotal,
        previous_total_minutes: previousTotal,
        delta_percent: deltaPercent,
      }
    },
  }
}
