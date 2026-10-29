import {
  OVERVIEW_FLIGHT_COLUMNS,
  projectOverviewFlights,
  overviewFlightRefs,
  type AirportRow,
  type AircraftRow,
} from './overviewFlightProjection'
import { aggregateRows } from '../../../packages/shared/src/overview/aggregate'
import {
  AGGREGATE_THRESHOLD,
  type OverviewGroundJourney,
  type OverviewPayload,
} from '../../../packages/shared/src/overview/model'
import {
  railRouteRuns,
  type GroundJourneyDto,
  type GroundPlaceSnapshot,
} from '../../../packages/shared/src/groundTravel'
import { assertRows } from '../_lib/d1'
import type { FlightRow } from '../_lib/flights'
import { COUNTRY_REGION } from '../_lib/countryRegions.generated'
import { passportRead } from './passport'
import { ownerJourneysRead } from './groundJourneyRead'

export const overviewEtag = (
  userId: string,
  state: { revision: number; evidence_revision: number },
): string =>
  `W/"ov5-day-${encodeURIComponent(userId)}-${state.revision}-${state.evidence_revision}"`

/** Places in order as located runs: a place without coordinates ends the current run. */
function locatedRuns(places: readonly GroundPlaceSnapshot[][]): OverviewGroundJourney['runs'] {
  const runs: OverviewGroundJourney['runs'] = []
  for (const run of places) {
    let current: Array<[number, number]> = []
    for (const place of run) {
      if (place.lat === null || place.lon === null) {
        if (current.length) runs.push(current)
        current = []
      } else current.push([place.lon, place.lat])
    }
    if (current.length) runs.push(current)
  }
  return runs
}

function groundJourney(
  journey: GroundJourneyDto & { status: 'planned' | 'completed' },
): OverviewGroundJourney {
  return {
    id: journey.id,
    mode: journey.mode,
    status: journey.status,
    startDate: journey.startDate,
    endDate: journey.endDate,
    runs: locatedRuns(
      journey.mode === 'rail'
        ? railRouteRuns(journey.legs.map((leg) => ({ from: leg.from, to: leg.to })))
        : [journey.points.map((point) => point.place)],
    ),
    countries: journey.countries,
    distanceKm: journey.metrics.distanceKm,
  }
}

export async function readOverviewData(db: D1Database, userId: string): Promise<OverviewPayload> {
  const passport = passportRead(db, userId, { applyHidden: false })
  // One batch, one snapshot: the ground journeys must come from the revision the ETag names.
  const groundRead = ownerJourneysRead(db, userId)
  const statements = [
    db
      .prepare(`SELECT ${OVERVIEW_FLIGHT_COLUMNS} FROM flights WHERE user_id = ? ORDER BY date, id`)
      .bind(userId),
    db
      .prepare('SELECT flight_id, endpoint FROM country_evidence_suppressions WHERE user_id = ?')
      .bind(userId),
    db
      .prepare(`SELECT iata, latitude, longitude, country_code, city, name FROM airports_reference
      WHERE iata IN (SELECT origin FROM flights WHERE user_id = ? UNION SELECT destination FROM flights WHERE user_id = ?
        UNION SELECT home_airport FROM profiles WHERE id = ?)
      ORDER BY iata`)
      .bind(userId, userId, userId),
    db
      .prepare(`SELECT icao, manufacturer, type, model, name FROM aircraft_reference
      WHERE icao IN (SELECT aircraft_icao FROM flights WHERE user_id = ?) ORDER BY icao`)
      .bind(userId),
    db.prepare('SELECT home_airport FROM profiles WHERE id = ?').bind(userId),
    ...passport.statements,
    ...groundRead.statements,
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Overview data read failed', statements.length)
  const groundAt = 5 + passport.statements.length
  const { state, data } = passport.derive(results.slice(5, groundAt))
  const journeys = groundRead.derive(results.slice(groundAt))
  const rows = projectOverviewFlights(
    results[0].results as FlightRow[],
    results[1].results as { flight_id: number; endpoint: 'origin' | 'destination' }[],
  )
  const ground = journeys
    .filter(
      (journey): journey is GroundJourneyDto & { status: 'planned' | 'completed' } =>
        journey.status !== 'cancelled',
    )
    .map(groundJourney)
    .sort((a, b) => {
      const dayA = a.startDate ?? a.endDate ?? '',
        dayB = b.startDate ?? b.endDate ?? ''
      return dayA < dayB ? -1 : dayA > dayB ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
  const homeOverride =
    (results[4].results[0] as { home_airport: string | null } | undefined)?.home_airport ?? null
  const refs = overviewFlightRefs(
    rows,
    results[2].results as AirportRow[],
    results[3].results as AircraftRow[],
    homeOverride,
  )
  for (const journey of ground)
    for (const code of journey.countries) {
      const region = COUNTRY_REGION[code]
      if (region) refs.regions[code] = region
    }
  const mode = rows.length > AGGREGATE_THRESHOLD ? 'aggregate' : 'flights'
  return {
    schemaVersion: 4,
    etag: overviewEtag(userId, state ?? { revision: 0, evidence_revision: 0 }),
    generatedAt: new Date().toISOString(),
    mode,
    ...(mode === 'aggregate' ? { aggregateResolution: 'day' as const } : {}),
    derivedReady: data.derivedState === 'ready',
    passport: {
      countries: data.pressedCountryCount,
      regions: data.regions.filter((region) => region.pressed > 0).length,
      countryCodes: [
        ...new Set(
          data.countries
            .filter((country) => country.status === 'pressed')
            .map((country) => country.country_code),
        ),
      ].sort(),
    },
    homeOverride,
    rows: mode === 'aggregate' ? aggregateRows(rows, 'day') : rows,
    ground,
    refs,
  }
}
