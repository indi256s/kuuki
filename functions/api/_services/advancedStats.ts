// Advanced-stats composer — ports refresh_advanced_stats(p_user_id) plus the two
// SEPARATE writer functions compute_card_insights / compute_duration_year_comparison
// (which, in the live DB, UPDATE user_advanced_stats directly rather than going through
// refresh_advanced_stats). See db/_extracted/LOGIC_SPEC.md "refresh_advanced_stats".
//
// Order matters: card_insights reads the breakdown columns (aircraft_breakdown,
// manufacturer_breakdown, continent_breakdown, duration_stats), so it must run AFTER the
// main upsert has written them. duration_year_comparison reads flights directly.
//
// Parity (do NOT "fix"): only the 13 value columns + unlock flags below are written by the
// refresh; `patterns`, `featured_fact*` are left untouched (live refresh_advanced_stats
// does not set them). Unlock thresholds: avia_geek aircraft_count>=5, country_geek
// countries_count>=5, duration total_flights>=10.

import { nowIso } from '../_lib/time'
import {
  computeAircraftBreakdown,
  computeAircraftTypeBreakdown,
  computeContinentBreakdown,
  computeRegionBreakdown,
  computeDurationStats,
  computeDeparturePatterns,
  computeDurationCoverage,
  continentBreakdownForCountries,
  regionBreakdownForCountries,
} from './advancedStatsBreakdowns'
import {
  computeFleetInsights,
  computeManufacturerInsights,
  computeCardInsights,
  computeDurationYearComparison,
  cardInsightsFromBreakdowns,
} from './advancedStatsInsights'
import type { ComputedUserStats, DerivedVisit } from './stats'

/** JSON.stringify for a TEXT/JSON column, mapping null/undefined to a SQL NULL bind. */
function j(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value)
}

/**
 * Recompute every advanced-stats column for a user and upsert user_advanced_stats.
 * No-op if the user has no user_stats row yet (mirrors the live guard).
 */
export async function refreshAdvancedStats(db: D1Database, userId: string): Promise<void> {
  const stats = await db
    .prepare('SELECT aircraft_count, countries_count, total_flights FROM user_stats WHERE user_id = ?')
    .bind(userId)
    .first<{ aircraft_count: number; countries_count: number; total_flights: number }>()
  if (!stats) return

  // Breakdown + insight computations (all read-only; flights/visits, independent of the row).
  const aircraft = await computeAircraftBreakdown(db, userId)
  const aircraftType = await computeAircraftTypeBreakdown(db, userId)
  const continent = await computeContinentBreakdown(db, userId)
  const region = await computeRegionBreakdown(db, userId)
  const duration = await computeDurationStats(db, userId)
  const departure = await computeDeparturePatterns(db, userId)
  const coverage = await computeDurationCoverage(db, userId)
  const fleet = await computeFleetInsights(db, userId)
  const manufacturer = await computeManufacturerInsights(db, userId)

  const now = nowIso()
  await db
    .prepare(
      `INSERT INTO user_advanced_stats (
         user_id, avia_geek_unlocked, country_geek_unlocked, duration_unlocked,
         aircraft_breakdown, manufacturer_breakdown, aircraft_type_breakdown,
         continent_breakdown, region_breakdown, duration_stats, departure_patterns,
         duration_coverage, fleet_insights, manufacturer_insights, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         avia_geek_unlocked = excluded.avia_geek_unlocked,
         country_geek_unlocked = excluded.country_geek_unlocked,
         duration_unlocked = excluded.duration_unlocked,
         aircraft_breakdown = excluded.aircraft_breakdown,
         manufacturer_breakdown = excluded.manufacturer_breakdown,
         aircraft_type_breakdown = excluded.aircraft_type_breakdown,
         continent_breakdown = excluded.continent_breakdown,
         region_breakdown = excluded.region_breakdown,
         duration_stats = excluded.duration_stats,
         departure_patterns = excluded.departure_patterns,
         duration_coverage = excluded.duration_coverage,
         fleet_insights = excluded.fleet_insights,
         manufacturer_insights = excluded.manufacturer_insights,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      stats.aircraft_count >= 5 ? 1 : 0,
      stats.countries_count >= 5 ? 1 : 0,
      stats.total_flights >= 10 ? 1 : 0,
      j(aircraft.aircraft),
      j(aircraft.manufacturers),
      j(aircraftType),
      j(continent),
      j(region),
      j(duration),
      j(departure),
      coverage,
      j(fleet),
      j(manufacturer),
      now,
    )
    .run()

  // card_insights depends on the breakdown columns just written; year comparison reads
  // flights. Both are separate live writers — fold their two UPDATEs into one.
  const card = await computeCardInsights(db, userId)
  const yearComparison = await computeDurationYearComparison(db, userId)
  await db
    .prepare(
      `UPDATE user_advanced_stats
       SET card_insights = ?, duration_year_comparison = ?, updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(j(card), j(yearComparison), nowIso(), userId)
    .run()
}

/** Prepare one complete advanced row from canonical flights and proposed visits. */
export async function computedAdvancedStatsStatement(
  db: D1Database,
  userId: string,
  stats: ComputedUserStats,
  visits: DerivedVisit[],
): Promise<D1PreparedStatement> {
  const aircraft = await computeAircraftBreakdown(db, userId)
  const aircraftType = await computeAircraftTypeBreakdown(db, userId)
  const countries = visits.map(v => v.country_code)
  const continent = continentBreakdownForCountries(countries)
  const region = regionBreakdownForCountries(countries)
  const duration = await computeDurationStats(db, userId)
  const departure = await computeDeparturePatterns(db, userId)
  const coverage = await computeDurationCoverage(db, userId)
  const fleet = await computeFleetInsights(db, userId)
  const manufacturer = await computeManufacturerInsights(db, userId)
  const yearComparison = await computeDurationYearComparison(db, userId)
  const card = cardInsightsFromBreakdowns({
    aircraft_breakdown: j(aircraft.aircraft),
    manufacturer_breakdown: j(aircraft.manufacturers),
    continent_breakdown: j(continent),
    duration_stats: j(duration),
  })
  return db.prepare(
    `INSERT INTO user_advanced_stats (
       user_id, avia_geek_unlocked, country_geek_unlocked, duration_unlocked,
       aircraft_breakdown, manufacturer_breakdown, aircraft_type_breakdown,
       continent_breakdown, region_breakdown, duration_stats, departure_patterns,
       duration_coverage, fleet_insights, manufacturer_insights, card_insights,
       duration_year_comparison, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       avia_geek_unlocked=excluded.avia_geek_unlocked,
       country_geek_unlocked=excluded.country_geek_unlocked,
       duration_unlocked=excluded.duration_unlocked,
       aircraft_breakdown=excluded.aircraft_breakdown,
       manufacturer_breakdown=excluded.manufacturer_breakdown,
       aircraft_type_breakdown=excluded.aircraft_type_breakdown,
       continent_breakdown=excluded.continent_breakdown,
       region_breakdown=excluded.region_breakdown,
       duration_stats=excluded.duration_stats,
       departure_patterns=excluded.departure_patterns,
       duration_coverage=excluded.duration_coverage,
       fleet_insights=excluded.fleet_insights,
       manufacturer_insights=excluded.manufacturer_insights,
       card_insights=excluded.card_insights,
       duration_year_comparison=excluded.duration_year_comparison,
       updated_at=excluded.updated_at`,
  ).bind(
    userId,
    stats.aircraft_count >= 5 ? 1 : 0,
    stats.countries_count >= 5 ? 1 : 0,
    stats.total_flights >= 10 ? 1 : 0,
    j(aircraft.aircraft), j(aircraft.manufacturers), j(aircraftType),
    j(continent), j(region), j(duration), j(departure), coverage,
    j(fleet), j(manufacturer), j(card), j(yearComparison), nowIso(),
  )
}
