import { z } from 'zod'
import {
  decodeAirportScope,
  encodeAirportScope,
  type AirportHistory,
} from '../../../packages/shared/src/airportHistory'
import { effectiveScopeFromPresence, matches } from '../../../packages/shared/src/overview/filter'
import { assertRows } from '../_lib/d1'
import type { FlightRow } from '../_lib/flights'
import { HttpError } from '../_lib/http'
import { isDerivedReady, type DerivedStateRow } from './derivedState'
import {
  OVERVIEW_FLIGHT_COLUMNS,
  overviewFlightRefs,
  projectOverviewFlights,
  type AircraftRow,
  type AirportRow,
} from './overviewFlightProjection'

const PAGE_SIZE = 50
const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const cursorSchema = z.strictObject({
  v: z.literal(1),
  owner: z.string().min(1).max(256),
  airport: z.string().regex(/^[A-Z]{3}$/),
  scope: z.string().regex(/^[a-f0-9]{64}$/),
  revision: counter,
  published: counter,
  evidence: counter,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})
type Cursor = z.infer<typeof cursorSchema>

function encodeCursor(cursor: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeCursor(value: string): Cursor {
  try {
    if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    const cursor = cursorSchema.parse(
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
          Uint8Array.from(binary, (char) => char.charCodeAt(0)),
        ),
      ),
    )
    if (encodeCursor(cursor) !== value) throw new Error()
    return cursor
  } catch {
    throw new HttpError(400, 'Invalid airport history cursor', 'INVALID_CURSOR')
  }
}

/** Exact completed flights, before Overview aggregation; every private read shares one snapshot. */
export async function readAirportHistory(
  db: D1Database,
  ownerId: string,
  iata: string,
  scope: string | null,
  after: string | null,
): Promise<AirportHistory> {
  if (!/^[A-Z]{3}$/.test(iata)) throw new HttpError(400, 'Invalid airport', 'INVALID_AIRPORT')
  let filter
  try {
    filter = scope === null ? {} : decodeAirportScope(scope)
  } catch {
    throw new HttpError(400, 'Invalid airport history scope', 'INVALID_SCOPE')
  }
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(encodeAirportScope(filter)),
  )
  const scopeFingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const cursor = after === null ? null : decodeCursor(after)
  if (
    cursor &&
    (cursor.owner !== ownerId || cursor.airport !== iata || cursor.scope !== scopeFingerprint)
  )
    throw new HttpError(400, 'Cursor does not belong to this airport history', 'INVALID_CURSOR')
  const statements = [
    db
      .prepare(`SELECT ${OVERVIEW_FLIGHT_COLUMNS} FROM flights
      WHERE user_id = ? AND (origin = ? OR destination = ?) AND lifecycle_state IN ('logged','awaiting')
      ORDER BY date DESC, id DESC`)
      .bind(ownerId, iata, iata),
    db
      .prepare('SELECT flight_id, endpoint FROM country_evidence_suppressions WHERE user_id = ?')
      .bind(ownerId),
    db
      .prepare(`SELECT iata, latitude, longitude, country_code, city, name FROM airports_reference
      WHERE iata IN (SELECT origin FROM flights WHERE user_id = ? AND (origin = ? OR destination = ?)
        UNION SELECT destination FROM flights WHERE user_id = ? AND (origin = ? OR destination = ?))
      ORDER BY iata`)
      .bind(ownerId, iata, iata, ownerId, iata, iata),
    db
      .prepare(`SELECT icao, manufacturer, type, model, name FROM aircraft_reference
      WHERE icao IN (SELECT aircraft_icao FROM flights WHERE user_id = ? AND (origin = ? OR destination = ?))
      ORDER BY icao`)
      .bind(ownerId, iata, iata),
    db
      .prepare(
        'SELECT revision, published_revision, evidence_revision, last_error FROM user_derived_state WHERE user_id = ?',
      )
      .bind(ownerId),
    db
      .prepare(`SELECT EXISTS(SELECT 1 FROM ground_journeys WHERE user_id = ?
      AND status IN ('planned','completed') AND deleted_at IS NULL) AS present`)
      .bind(ownerId),
  ]
  const results = await db.batch(statements)
  assertRows(results, 'Airport history unavailable', statements.length)
  const state = results[4].results[0] as DerivedStateRow | undefined
  const revision = state?.revision ?? 0
  const publishedRevision = state?.published_revision ?? 0
  const evidenceRevision = state?.evidence_revision ?? 0
  if (
    cursor &&
    (cursor.revision !== revision ||
      cursor.published !== publishedRevision ||
      cursor.evidence !== evidenceRevision)
  )
    throw new HttpError(409, 'Airport history changed; refresh the first page', 'STALE_CURSOR')
  const derivedState =
    !state || isDerivedReady(state) ? 'ready' : state.last_error ? 'error' : 'pending'
  const base = { ownerId, revision, publishedRevision, scopeFingerprint, derivedState } as const
  const hasGround = (results[5].results[0] as { present: number }).present !== 0
  if (effectiveScopeFromPresence(hasGround, filter) === 'ground')
    return { ...base, status: 'ready', total: 0, items: [], nextCursor: null }
  if (derivedState !== 'ready' && (filter.countries?.length || filter.regions?.length))
    return { ...base, status: 'scope-updating', total: null, items: [], nextCursor: null }
  const rows = projectOverviewFlights(
    results[0].results as FlightRow[],
    results[1].results as { flight_id: number; endpoint: 'origin' | 'destination' }[],
  )
  const refs = overviewFlightRefs(
    rows,
    results[2].results as AirportRow[],
    results[3].results as AircraftRow[],
  )
  const matching = rows.filter((row) => matches(row, filter, refs))
  const page = matching
    .filter(
      (row) =>
        !cursor || row.date < cursor.date || (row.date === cursor.date && row.id < cursor.id),
    )
    .slice(0, PAGE_SIZE + 1)
  const items = page.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    date: row.date,
    origin: row.origin,
    destination: row.destination,
    airline: row.airline,
    flightNumber: row.flightNumber,
    state: row.state as 'logged' | 'awaiting',
  }))
  const last = items.at(-1)
  const nextCursor =
    page.length > PAGE_SIZE && last
      ? encodeCursor({
          v: 1,
          owner: ownerId,
          airport: iata,
          scope: scopeFingerprint,
          revision,
          published: publishedRevision,
          evidence: evidenceRevision,
          date: last.date,
          id: last.id,
        })
      : null
  return { ...base, status: 'ready', total: matching.length, items, nextCursor }
}
