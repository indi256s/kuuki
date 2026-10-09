// GET /api/flights/:id (own) — read one. PATCH — update. DELETE — remove.
// Mutations require CSRF. Every query is scoped "id = ? AND user_id = ?" (no RLS in D1).
// PATCH/DELETE re-run the same service chain as create so stats/badges/advanced stats stay in sync.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBody } from '../_lib/flightValidation'
import { resolveFlightMetrics } from '../_services/flightMetrics'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { LIFECYCLE_COLUMN_NAMES, lifecycleForEdit, lifecycleValues, takeRequestTimezone } from '../_services/lifecycle'
import { FLIGHT_COLUMNS } from './index'

const PATCH_CAS_COLUMNS = [
  'date', 'origin', 'destination', 'airline_iata', 'aircraft_icao', 'flight_number',
  'departure_time', 'arrival_time', 'departure_utc', 'arrival_utc', 'origin_tz', 'dest_tz',
  'distance_km', 'duration_minutes', 'duration_source', 'times_from_schedule', 'zones_overflown', 'source', 'enrichment_status',
  ...LIFECYCLE_COLUMN_NAMES,
] as const satisfies ReadonlyArray<keyof FlightRow>

type UndoSnapshot = { kind: 'flight-undo'; userId: string; id: number; expires: number; before: unknown[]; after: unknown[]; fields: string[] }
const encoder = new TextEncoder()

async function undoKey(secret: string) {
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function createUndoToken(secret: string, userId: string, before: FlightRow, after: FlightRow, fields: string[]): Promise<string> {
  const snapshot: UndoSnapshot = { kind: 'flight-undo', userId, id: before.id, expires: Date.now() + 5 * 60_000,
    before: PATCH_CAS_COLUMNS.map(name => before[name]), after: PATCH_CAS_COLUMNS.map(name => after[name]), fields }
  const payload = btoa(Array.from(encoder.encode(JSON.stringify(snapshot)), byte => String.fromCharCode(byte)).join(''))
  const signature = await crypto.subtle.sign('HMAC', await undoKey(secret), encoder.encode(payload))
  return `${payload}.${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

async function readUndoToken(raw: unknown, secret: string, userId: string, id: number): Promise<UndoSnapshot> {
  const invalid = () => new HttpError(409, 'Undo is no longer available; reload the flight', 'STATE_CONFLICT')
  if (typeof raw !== 'string' || raw.length > 16_000) throw invalid()
  const [payload, signature, extra] = raw.split('.')
  if (!payload || !/^[a-f0-9]{64}$/.test(signature ?? '') || extra !== undefined) throw invalid()
  const bytes = Uint8Array.from(signature.match(/../g)!, byte => Number.parseInt(byte, 16))
  if (!await crypto.subtle.verify('HMAC', await undoKey(secret), bytes, encoder.encode(payload))) throw invalid()
  let snapshot: UndoSnapshot
  try { snapshot = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), char => char.charCodeAt(0)))) as UndoSnapshot } catch { throw invalid() }
  if (snapshot.kind !== 'flight-undo' || snapshot.userId !== userId || snapshot.id !== id || !Number.isFinite(snapshot.expires) || snapshot.expires <= Date.now()
    || !Array.isArray(snapshot.before) || !Array.isArray(snapshot.after) || snapshot.before.length !== PATCH_CAS_COLUMNS.length || snapshot.after.length !== PATCH_CAS_COLUMNS.length
    || !Array.isArray(snapshot.fields) || !snapshot.fields.every(field => PATCH_CAS_COLUMNS.some(name => name === field))) throw invalid()
  return snapshot
}

function parseId(raw: string | undefined): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
  return id
}

async function loadFlight(db: D1Database, id: number, userId: string): Promise<FlightRow> {
  const row = await db
    .prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<FlightRow>()
  if (!row) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
  return row
}

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  readFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function readFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const id = parseId(rawId)
    const row = await loadFlight(env.DB, id, user.id)
    return json(toOwnFlight(row))
  })
}

export const onRequestPatch: PagesFunction<Env, string, RequestData> = context =>
  updateFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function updateFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(rawId)

    const existing = await loadFlight(env.DB, id, user.id)
    const { body: rawBody, timezone } = takeRequestTimezone(await readJson<unknown>(request))
    const controls = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody as Record<string, unknown> : null
    if (controls && 'undo_token' in controls) {
      if (Object.keys(controls).some(key => key !== 'undo_token')) throw new HttpError(400, 'Undo cannot include flight fields', 'INVALID_FLIGHT')
      const snapshot = await readUndoToken(controls.undo_token, env.AUTH_SECRET, user.id, id)
      if (!PATCH_CAS_COLUMNS.every((name, index) => existing[name] === snapshot.after[index])) throw new HttpError(409, 'Flight changed since this edit', 'STATE_CONFLICT')
      const previous = Object.fromEntries(PATCH_CAS_COLUMNS.map((name, index) => [name, snapshot.before[index]]))
      await parseFlightBody(env.DB, Object.fromEntries(snapshot.fields.map(field => [field, previous[field]])), 'patch', existing)
      const [, restored] = await env.DB.batch([
        env.DB.prepare(`UPDATE flights SET ${PATCH_CAS_COLUMNS.map(name => `${name} = ?`).join(', ')}
          WHERE id = ? AND user_id = ? AND ${PATCH_CAS_COLUMNS.map(name => `${name} IS ?`).join(' AND ')} RETURNING ${FLIGHT_COLUMNS}`)
          .bind(...snapshot.before, id, user.id, ...snapshot.after),
        // The route adapter clears transit on every route change; restore it after the guarded route write in the same transaction.
        env.DB.prepare(`UPDATE flights SET arrival_transit = ?, arrival_transit_leg_id = ? WHERE id = ? AND user_id = ? AND changes() > 0 RETURNING ${FLIGHT_COLUMNS}`)
          .bind(previous.arrival_transit, previous.arrival_transit_leg_id, id, user.id),
        dirtyUserStatement(env.DB, user.id, true),
      ])
      const row = restored.results[0] as FlightRow | undefined
      if (!row) { await loadFlight(env.DB, id, user.id); throw new HttpError(409, 'Flight changed since this edit', 'STATE_CONFLICT') }
      return json({ ...toOwnFlight(row), ...await repairUserDerivedState(env.DB, user.id) })
    }
    const { offer_undo: offerUndo, ...body } = controls ?? {}
    if (offerUndo !== undefined && typeof offerUndo !== 'boolean') throw new HttpError(400, 'offer_undo must be a boolean', 'INVALID_FLIGHT')
    const patch = await parseFlightBody(env.DB, controls ? body : rawBody, 'patch', existing)

    // Merge patch over the existing row: a provided key (even null) overrides; undefined keeps existing.
    const merge = <T>(key: keyof typeof patch, current: T): T => (patch[key] === undefined ? current : (patch[key] as T))

    const date = patch.date ?? existing.date
    const origin = patch.origin ?? existing.origin
    const destination = patch.destination ?? existing.destination
    const airlineIata = merge('airline_iata', existing.airline_iata)
    const aircraftIcao = merge('aircraft_icao', existing.aircraft_icao)
    const flightNumber = merge('flight_number', existing.flight_number)
    const departureTime = merge('departure_time', existing.departure_time)
    const arrivalTime = merge('arrival_time', existing.arrival_time)
    const timesFromSchedule = departureTime === existing.departure_time && arrivalTime === existing.arrival_time
      ? existing.times_from_schedule : 0
    const originTz = merge('origin_tz', existing.origin_tz)
    const destTz = merge('dest_tz', existing.dest_tz)
    const routeChanged = origin !== existing.origin || destination !== existing.destination
    const timeChanged = date !== existing.date || departureTime !== existing.departure_time || arrivalTime !== existing.arrival_time || originTz !== existing.origin_tz || destTz !== existing.dest_tz
    const mergedDistance = patch.distance_km !== undefined ? patch.distance_km : routeChanged ? null : existing.distance_km
    const source = patch.source ?? existing.source
    const enrichmentStatus = patch.enrichment_status ?? existing.enrichment_status

    // ADR 0001 §2: date and route edits move lifecycle (and the is_upcoming projection) with the same UPDATE.
    const lifecycle = lifecycleForEdit(existing, { date, origin, destination }, timezone)

    const metricsChanged = routeChanged || timeChanged || flightNumber !== existing.flight_number
    const metrics = metricsChanged ? await resolveFlightMetrics(env.DB, {
      date,
      origin,
      destination,
      airlineIata,
      flightNumber,
      departureTime,
      arrivalTime,
      originTz: patch.origin_tz === undefined && origin !== existing.origin ? null : originTz,
      destTz: patch.dest_tz === undefined && destination !== existing.destination ? null : destTz,
      clientDistanceKm: mergedDistance,
      excludeFlightId: id,
      timesFromSchedule: timesFromSchedule === 1,
    }) : {
      originTz: existing.origin_tz, destTz: existing.dest_tz,
      departureUtc: existing.departure_utc, arrivalUtc: existing.arrival_utc,
      distanceKm: existing.distance_km, durationMinutes: existing.duration_minutes,
      durationSource: existing.duration_source, zonesOverflown: existing.zones_overflown,
    }

    const [update] = await env.DB.batch([env.DB.prepare(
      `UPDATE flights SET
         date = ?, origin = ?, destination = ?, airline_iata = ?, aircraft_icao = ?, flight_number = ?,
         departure_time = ?, arrival_time = ?, departure_utc = ?, arrival_utc = ?, origin_tz = ?, dest_tz = ?,
         distance_km = ?, duration_minutes = ?, duration_source = ?, times_from_schedule = ?, zones_overflown = ?, source = ?, enrichment_status = ?,
         ${LIFECYCLE_COLUMN_NAMES.map(name => `${name} = ?`).join(', ')}
       WHERE id = ? AND user_id = ? AND ${PATCH_CAS_COLUMNS.map(name => `${name} IS ?`).join(' AND ')} RETURNING ${FLIGHT_COLUMNS}`,
    )
      .bind(
        date,
        origin,
        destination,
        airlineIata,
        aircraftIcao,
        flightNumber,
        departureTime,
        arrivalTime,
        metrics.departureUtc,
        metrics.arrivalUtc,
        metrics.originTz,
        metrics.destTz,
        metrics.distanceKm,
        metrics.durationMinutes,
        metrics.durationSource,
        timesFromSchedule,
        metrics.zonesOverflown,
        source,
        enrichmentStatus,
        ...lifecycleValues(lifecycle),
        id,
        user.id,
        ...PATCH_CAS_COLUMNS.map(name => existing[name]),
      ), dirtyUserStatement(env.DB, user.id, true)])
    if (!update.meta.changes) {
      // Reject changes to any rewritten snapshot field; a concurrent deletion remains a 404.
      await loadFlight(env.DB, id, user.id)
      throw new HttpError(409, 'Flight changed while it was being edited; reload and retry', 'STATE_CONFLICT', { cause: 'flight_changed' })
    }
    const updated = update.results[0] as FlightRow
    const undoToken = offerUndo ? await createUndoToken(env.AUTH_SECRET, user.id, existing, updated, Object.keys(patch)) : undefined
    const derived = await repairUserDerivedState(env.DB, user.id)
    return json({ ...toOwnFlight(updated), ...derived, ...(undoToken ? { undo_token: undoToken } : {}) })
  })
}

export const onRequestDelete: PagesFunction<Env, string, RequestData> = context =>
  deleteFlightRequest(context.request, context.env, context.data, context.params.id as string)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function deleteFlightRequest(request: Request, env: Env, data: RequestData, rawId: string): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)
    const id = parseId(rawId)

    const [deleted] = await env.DB.batch([
      env.DB.prepare('DELETE FROM flights WHERE id = ? AND user_id = ?').bind(id, user.id),
      dirtyUserStatement(env.DB, user.id, true),
    ])
    if (!deleted.meta.changes) throw new HttpError(404, 'Flight not found', 'NOT_FOUND')
    const derived = await repairUserDerivedState(env.DB, user.id)
    return json({ ok: true, ...derived })
  })
}
