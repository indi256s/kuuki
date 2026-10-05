// Shared fixture and call helpers for the T10 import-draft tests (jobs, batches, drafts, conversion).
// The provider is stubbed by each test file (`vi.mock('@google/genai')`): no test reaches the network.
import { vi } from 'vitest'
import { createApiDatabase, csrfRequest, testOrigin } from './harness'
import { onRequestPost as jobsRoute } from '../api/import/jobs'
import { onRequestGet as batchGet, onRequestDelete as batchDelete } from '../api/import/batches/[id]'
import { onRequestPost as confirmRoute } from '../api/import/batches/[id]/confirm'
import { onRequestPatch as draftPatch } from '../api/import/drafts/[id]'

export const USER = { id: 'u1', email: 'u1@example.test' }
export const OTHER = { id: 'u2', email: 'u2@example.test' }
export const DAY = 86_400_000
export const NOW = new Date('2026-10-05T12:00:00.000Z')

/** Date-only fake clock: handlers read `new Date()`, timers stay real. Callers restore with `vi.useRealTimers()`. */
export function clock(at: Date | string = NOW) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(at))
}
export const daysAfter = (days: number, from: Date = NOW) => new Date(from.getTime() + days * DAY)

const AIRPORTS: Array<[string, string, number, number]> = [
  ['JFK', 'US', 40.6, -73.8], ['LHR', 'GB', 51.5, -0.45], ['TBS', 'GE', 41.67, 44.95], ['IST', 'TR', 41.27, 28.74], ['DXB', 'AE', 25.25, 55.36],
]

export async function importAccount() {
  const { db, dispose } = await createApiDatabase()
  await db.batch([
    ...[USER, OTHER].flatMap(user => [
      db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(user.id, user.email, 'hash'),
      db.prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')").bind(user.id),
    ]),
    ...AIRPORTS.map(([iata, cc, lat, lon]) => db.prepare(
      'INSERT INTO airports_reference (iata, name, city, country, country_code, latitude, longitude) VALUES (?,?,?,?,?,?,?)')
      .bind(iata, iata, `${iata} city`, cc, cc, lat, lon)),
    db.prepare("INSERT INTO aircraft_reference (icao, iata, name, manufacturer, model, type, engine_type, engine_count) VALUES ('B738','738','Boeing 737-800','Boeing','737','jet','jet',2)"),
  ])
  return { db, dispose }
}

/** One provider flight with an explicit year, as the model would return it. */
export const providerFlight = (over: Record<string, unknown> = {}) => ({
  date: '2026-03-10', origin: 'JFK', destination: 'LHR', airline_iata: 'BA', flight_number: '178', aircraft_icao: 'B738',
  departure_time: '19:00', arrival_time: '07:00', confidence: 0.9,
  field_confidence: { date: 0.9, date_year_explicit: true, origin: 0.9, destination: 0.9, airline_iata: 0.9, aircraft_icao: 0.9 },
  ...over,
})
export const providerText = (flights: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ flights, ...extra })

type Who = { id: string; email: string } | null
const context = (db: D1Database, request: Request, user: Who, params: Record<string, string> = {}, env: Record<string, unknown> = {}) =>
  ({ request, env: { GEMINI_API_KEY: 'test', PAGES_ORIGIN: testOrigin, DB: db, ...env }, data: { user }, params, waitUntil() {} }) as never

async function reply(response: Response) {
  return { status: response.status, body: await response.json() as Record<string, any> }
}

let sequence = 0
export const opId = (label = 'submission') => `${label}-${++sequence}-${Math.random().toString(36).slice(2, 8)}`

export async function postJob(db: D1Database, body: Record<string, unknown>, user: Who = USER, headers: Record<string, string> = {}, env: Record<string, unknown> = {}) {
  const payload = { type: 'text', content: 'Flight details', submissionOperationId: opId(), ...body }
  return reply(await jobsRoute(context(db, csrfRequest('/api/import/jobs', 'POST', payload, headers), user, {}, env)))
}

export async function getBatch(db: D1Database, id: string, user: Who = USER) {
  return reply(await batchGet(context(db, new Request(`${testOrigin}/api/import/batches/${id}`), user, { id })))
}

export async function deleteBatch(db: D1Database, id: string, user: Who = USER) {
  return reply(await batchDelete(context(db, csrfRequest(`/api/import/batches/${id}`, 'DELETE'), user, { id })))
}

export async function patchDraft(db: D1Database, id: string, body: unknown, user: Who = USER, headers: Record<string, string> = {}) {
  return reply(await draftPatch(context(db, csrfRequest(`/api/import/drafts/${id}`, 'PATCH', body, headers), user, { id })))
}

export async function confirm(db: D1Database, batchId: string, body: unknown, user: Who = USER, headers: Record<string, string> = {}) {
  return reply(await confirmRoute(context(db, csrfRequest(`/api/import/batches/${batchId}/confirm`, 'POST', body, headers), user, { id: batchId })))
}

/** A fresh batch of provider flights through the real job endpoint; returns the snapshot. */
export async function seedBatch(db: D1Database, generate: (flights: unknown[]) => void, flights: unknown[], user: Who = USER) {
  generate(flights)
  const { status, body } = await postJob(db, {}, user)
  if (status !== 201) throw new Error(`seed failed: ${status} ${JSON.stringify(body)}`)
  return body as { batch: { id: string; status: string; sequence: number }; drafts: Array<{ id: string; version: number; fields: Record<string, string>; [k: string]: any }> }
}

let keys = 0
export const itemKey = (label = 'conv') => `${label}-key-${String(++keys).padStart(5, '0')}`
