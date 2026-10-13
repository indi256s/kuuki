// GET /api/ground-journeys/export — the owner's versioned JSON export of rail/road journeys and manual places.
// Live journeys only (plans and cancellations included); receipts, tombstones, internal user ids and the shared
// city catalog never leave the database. No reverse import is promised.

import { runHandler, json } from '../_lib/http'
import { requireUser, type RequestData } from '../_lib/auth'
import { assertRows } from '../_lib/d1'

export const GROUND_JOURNEYS_EXPORT_FORMAT = 'kuuki.ground-journeys'
export const GROUND_JOURNEYS_EXPORT_VERSION = 1

interface JourneyRow {
  id: string
  mode: 'rail' | 'road'
  status: string
  version: number
  title: string | null
  note: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
}
interface LegRow {
  journey_id: string
  id: string
  ordinal: number
  from_place: string
  to_place: string
  from_station: string | null
  to_station: string | null
  train_number: string | null
  operator: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_date: string | null
  arrival_time: string | null
  duration_minutes: number | null
  duration_source: string | null
}
interface PointRow {
  journey_id: string
  id: string
  ordinal: number
  place: string
  arrival_date: string | null
  departure_date: string | null
  nights: number | null
  note: string | null
}
interface ManualPlaceRow {
  id: string
  name: string
  country_code: string
  latitude: number | null
  longitude: number | null
  timezone: string | null
  created_at: string
}

/** Stored snapshot JSON as written; a malformed legacy value exports as null rather than failing the file. */
function snapshotOf(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function groupBy<T extends { journey_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) grouped.set(row.journey_id, [...(grouped.get(row.journey_id) ?? []), row])
  return grouped
}

/** One D1 batch, so every table is read from the same snapshot. */
export async function readGroundJourneysExport(db: D1Database, userId: string, now = new Date()) {
  const live = `j.user_id = ? AND j.deleted_at IS NULL`
  const statements = [
    db
      .prepare(
        `SELECT j.id, j.mode, j.status, j.version, j.title, j.note, j.start_date, j.end_date,
              j.created_at, j.updated_at, j.confirmed_at
       FROM ground_journeys j WHERE ${live} ORDER BY j.start_date IS NULL, j.start_date DESC, j.created_at, j.id`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT l.journey_id, l.id, l.ordinal, l.from_place, l.to_place, l.from_station, l.to_station,
              l.train_number, l.operator, l.departure_date, l.departure_time, l.arrival_date, l.arrival_time,
              l.duration_minutes, l.duration_source
       FROM ground_rail_legs l JOIN ground_journeys j ON j.id = l.journey_id AND j.user_id = l.user_id
       WHERE ${live} ORDER BY l.journey_id, l.ordinal`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT p.journey_id, p.id, p.ordinal, p.place, p.arrival_date, p.departure_date, p.nights, p.note
       FROM ground_road_points p JOIN ground_journeys j ON j.id = p.journey_id AND j.user_id = p.user_id
       WHERE ${live} ORDER BY p.journey_id, p.ordinal`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT c.journey_id, c.country_code
       FROM ground_journey_countries c JOIN ground_journeys j ON j.id = c.journey_id AND j.user_id = c.user_id
       WHERE ${live} ORDER BY c.journey_id, c.country_code`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT id, name, country_code, latitude, longitude, timezone, created_at
       FROM ground_manual_places WHERE user_id = ? ORDER BY created_at, id`,
      )
      .bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Ground journeys export unavailable', statements.length)
  const legs = groupBy(results[1].results as unknown as LegRow[])
  const points = groupBy(results[2].results as unknown as PointRow[])
  const countries = groupBy(
    results[3].results as unknown as Array<{ journey_id: string; country_code: string }>,
  )

  const journeys = (results[0].results as unknown as JourneyRow[]).map((row) => {
    const parent = {
      id: row.id,
      mode: row.mode,
      status: row.status,
      version: row.version,
      title: row.title,
      note: row.note,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at,
      countries: (countries.get(row.id) ?? []).map((country) => country.country_code),
    }
    return row.mode === 'rail'
      ? {
          ...parent,
          legs: (legs.get(row.id) ?? []).map((leg) => ({
            id: leg.id,
            ordinal: leg.ordinal,
            from: snapshotOf(leg.from_place),
            to: snapshotOf(leg.to_place),
            fromStation: leg.from_station,
            toStation: leg.to_station,
            trainNumber: leg.train_number,
            operator: leg.operator,
            departureDate: leg.departure_date,
            departureTime: leg.departure_time,
            arrivalDate: leg.arrival_date,
            arrivalTime: leg.arrival_time,
            durationMinutes: leg.duration_minutes,
            durationSource: leg.duration_source,
          })),
        }
      : {
          ...parent,
          points: (points.get(row.id) ?? []).map((point) => ({
            id: point.id,
            ordinal: point.ordinal,
            place: snapshotOf(point.place),
            arrivalDate: point.arrival_date,
            departureDate: point.departure_date,
            nights: point.nights,
            note: point.note,
          })),
        }
  })

  return {
    format: GROUND_JOURNEYS_EXPORT_FORMAT,
    version: GROUND_JOURNEYS_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    journeys,
    manualPlaces: (results[4].results as unknown as ManualPlaceRow[]).map((place) => ({
      id: place.id,
      name: place.name,
      countryCode: place.country_code,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      createdAt: place.created_at,
    })),
  }
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = (context) =>
  exportGroundJourneysRequest(context.request, context.env, context.data)

export function exportGroundJourneysRequest(
  _request: Request,
  env: Env,
  data: RequestData,
): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const now = new Date()
    const body = await readGroundJourneysExport(env.DB, user.id, now)
    return json(body, {
      headers: {
        'Content-Disposition': `attachment; filename="kuuki-ground-journeys-${now.toISOString().slice(0, 10)}.json"`,
      },
    })
  })
}
