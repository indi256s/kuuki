import { assertRows } from '../_lib/d1'
import {
  buildFlightWhere,
  orderByClause,
  type FlightFilters,
  type SortConfig,
} from '../_lib/flightQuery'
import { FLIGHT_COLUMNS, toOwnFlight, type FlightRow } from '../_lib/flights'
import { familyOf } from '../../../packages/data/src/aircraft-lookup'
import airlineCatalog from '../../../packages/data/src/airlines.json'
import { isDerivedReady, legacyEvidenceStatement } from './derivedState'
import { journalFirsts, type FirstsInput } from './firsts'
import type { JournalPayload, JournalRefs } from './journalPayload'

export type JournalData = {
  flights: ReturnType<typeof toOwnFlight>[]
  total: number
  updatedAt: number
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
}

type StateRow = {
  revision: number
  published_revision: number
  evidence_revision: number
  last_error: string | null
}

const derivedStateOf = (state: StateRow | undefined): JournalData['derivedState'] =>
  !state || isDerivedReady(state) ? 'ready' : state.last_error ? 'error' : 'pending'

/** One owner-scoped batch supplies the page, count, and revision metadata. */
export async function readJournal(
  db: D1Database,
  userId: string,
  filters: FlightFilters,
  sort: SortConfig,
  limit: number,
  offset: number,
): Promise<JournalData> {
  const { where, binds } = buildFlightWhere(userId, filters)
  const statements = [
    db
      .prepare(
        `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE ${where} ${orderByClause(sort)} LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset),
    db.prepare(`SELECT COUNT(*) AS total FROM flights WHERE ${where}`).bind(...binds),
    db
      .prepare(
        'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
      )
      .bind(userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Journal read failed', statements.length)
  const state = results[2].results[0] as StateRow | undefined
  return {
    flights: (results[0].results as FlightRow[]).map(toOwnFlight),
    total: (results[1].results[0] as { total: number } | undefined)?.total ?? 0,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
    derivedState: derivedStateOf(state),
  }
}

type JournalRow = FlightRow & {
  origin_country: string | null
  origin_city: string | null
  destination_country: string | null
  destination_city: string | null
}
type AirportRow = { iata: string; name: string; city: string | null; country_code: string | null }
type AircraftRow = {
  icao: string
  manufacturer: string | null
  type: string | null
  model: string | null
  name: string | null
}

const airlineNames = new Map(airlineCatalog.map((row) => [row.iata, row.name]))
const flightColumns = FLIGHT_COLUMNS.split(',')
  .map((column) => `f.${column.trim()}`)
  .join(', ')

/** The whole journal (spec D3): every owner flight with its endpoint countries, refs, firsts and revisions in one batch. */
export async function readJournalAll(db: D1Database, userId: string): Promise<JournalPayload> {
  const statements = [
    db
      .prepare(
        `SELECT ${flightColumns}, o.country_code AS origin_country, o.city AS origin_city,
              d.country_code AS destination_country, d.city AS destination_city
       FROM flights f
       LEFT JOIN airports_reference o ON o.iata = f.origin
       LEFT JOIN airports_reference d ON d.iata = f.destination
       WHERE f.user_id = ? ORDER BY f.date DESC, f.id DESC`,
      )
      .bind(userId),
    db
      .prepare(
        'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
      )
      .bind(userId),
    db
      .prepare(`SELECT iata, name, city, country_code FROM airports_reference
      WHERE iata IN (SELECT origin FROM flights WHERE user_id = ? UNION SELECT destination FROM flights WHERE user_id = ?)`)
      .bind(userId, userId),
    db
      .prepare(`SELECT icao, manufacturer, type, model, name FROM aircraft_reference
      WHERE icao IN (SELECT aircraft_icao FROM flights WHERE user_id = ?)`)
      .bind(userId),
    db.prepare('SELECT country_code FROM country_claims WHERE user_id = ?').bind(userId),
    db.prepare('SELECT country_code, visit_year FROM ground_visits WHERE user_id = ?').bind(userId),
    legacyEvidenceStatement(db, userId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Journal read failed', statements.length)
  const rows = results[0].results as JournalRow[]
  const state = results[1].results[0] as StateRow | undefined

  const airports = new Map((results[2].results as AirportRow[]).map((row) => [row.iata, row]))
  const aircraft = new Map((results[3].results as AircraftRow[]).map((row) => [row.icao, row]))
  const refs: JournalRefs = { airports: {}, airlines: {}, aircraft: {} }
  for (const code of [...new Set(rows.flatMap((row) => [row.origin, row.destination]))].sort()) {
    const ref = airports.get(code)
    refs.airports[code] = {
      city: ref?.city ?? null,
      name: ref?.name ?? code,
      country: ref?.country_code || null,
    }
  }
  for (const code of [...new Set(rows.map((row) => row.airline_iata))]
    .filter((code): code is string => !!code)
    .sort()) {
    const name = airlineNames.get(code)
    if (name) refs.airlines[code] = { name }
  }
  for (const code of [...new Set(rows.map((row) => row.aircraft_icao))]
    .filter((code): code is string => !!code)
    .sort()) {
    const ref = aircraft.get(code)
    refs.aircraft[code] = {
      name: ref?.name ?? null,
      family: familyOf(code, ref),
      manufacturer: ref?.manufacturer ?? null,
      type: ref?.type ?? null,
    }
  }

  return {
    flights: rows.map((row) => ({
      ...toOwnFlight(row),
      origin_country: row.origin_country,
      destination_country: row.destination_country,
    })),
    firsts: journalFirsts({
      flights: rows,
      claims: results[4].results as FirstsInput['claims'],
      ground: results[5].results as FirstsInput['ground'],
      legacy: results[6].results as FirstsInput['legacy'],
    }),
    refs,
    updatedAt: Date.now(),
    revision: state?.revision ?? 0,
    publishedRevision: state?.published_revision ?? 0,
    derivedState: derivedStateOf(state),
  }
}
