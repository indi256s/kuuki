// Advanced-stats composer — ports refresh_advanced_stats(p_user_id) plus the two
// SEPARATE writer functions compute_card_insights / compute_duration_year_comparison
// (which, in the live DB, UPDATE user_advanced_stats directly rather than going through
// refresh_advanced_stats). See db/_extracted/LOGIC_SPEC.md "refresh_advanced_stats".
//
// Here card_insights is computed from the freshly computed breakdowns, so the whole row is
// written by one statement. duration_year_comparison reads flights directly.
//
// Parity (do NOT "fix"): only the 13 value columns + unlock flags below are written by the
// refresh; `patterns`, `featured_fact*` are left untouched (live refresh_advanced_stats
// does not set them). Unlock thresholds: avia_geek aircraft_count>=5, country_geek
// countries_count>=5, duration total_flights>=10.

import { nowIso } from '../_lib/time'
import {
  computeAircraftBreakdown,
  computeAircraftTypeBreakdown,
  computeDurationStats,
  computeDeparturePatterns,
  computeDurationCoverage,
  continentBreakdownForCountries,
  regionBreakdownForCountries,
  type AircraftBreakdown,
  type AircraftTypeBreakdown,
  type DeparturePatterns,
  type DurationStats,
} from './advancedStatsBreakdowns'
import {
  computeFleetInsights,
  computeManufacturerInsights,
  computeDurationYearComparison,
  cardInsightsFromBreakdowns,
  type DurationYearComparison,
  type FleetInsights,
  type ManufacturerInsights,
} from './advancedStatsInsights'
import { combineReads, type BatchedRead, type ComputedUserStats, type DerivedVisit } from './stats'

/** JSON.stringify for a TEXT/JSON column, mapping null/undefined to a SQL NULL bind. */
function j(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value)
}

/** Prepare one complete advanced row from canonical flights and proposed visits. */
export function computedAdvancedStatsStatement(
  db: D1Database,
  userId: string,
): BatchedRead<(stats: ComputedUserStats, visits: DerivedVisit[]) => D1PreparedStatement> {
  const read = combineReads(
    computeAircraftBreakdown(db, userId),
    computeAircraftTypeBreakdown(db, userId),
    computeDurationStats(db, userId),
    computeDeparturePatterns(db, userId),
    computeDurationCoverage(db, userId),
    computeFleetInsights(db, userId),
    computeManufacturerInsights(db, userId),
    computeDurationYearComparison(db, userId),
  )
  return {
    statements: read.statements,
    derive: (results) => (stats, visits) =>
      advancedStatsStatement(db, userId, stats, visits, read.derive(results)),
  }
}

function advancedStatsStatement(
  db: D1Database,
  userId: string,
  stats: ComputedUserStats,
  visits: DerivedVisit[],
  [aircraft, aircraftType, duration, departure, coverage, fleet, manufacturer, yearComparison]: [
    AircraftBreakdown, AircraftTypeBreakdown, DurationStats, DeparturePatterns | null, number,
    FleetInsights | null, ManufacturerInsights | null, DurationYearComparison,
  ],
): D1PreparedStatement {
  const countries = visits.map(v => v.country_code)
  const continent = continentBreakdownForCountries(countries)
  const region = regionBreakdownForCountries(countries)
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
