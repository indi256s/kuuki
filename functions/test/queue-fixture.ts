// Shared fixture and call helpers for the T09 queue, confirmation and transit-review tests.
import { apiContext, csrfRequest } from './harness'
import { accountWith, at, T0, USER, type FixtureFlight } from './country-fixture'
import { onRequestGet as awaitingRoute } from '../api/me/awaiting'
import { onRequestPost as confirmRoute } from '../api/flights/confirm'

export { USER }

/**
 * u1's account (airports: TBS/KUT GE, IST/ADB TR, JFK US, LHR GB, DXB AE, BKK TH):
 *  1 awaiting TBS->IST, timed; 2 upcoming IST->JFK next day: a precise third-country connection, so flight 1 defaults to transit.
 *  3 awaiting LHR->DXB, no connection.            4 logged BKK->DXB: TH and AE are already pressed.
 *  5 upcoming TBS->LHR, unrelated.
 * Before any confirmation GE and GB are pending, TR is suppressed, TH and AE are pressed.
 */
export const FLIGHTS: FixtureFlight[] = [
  { id: 1, date: '2026-10-01', origin: 'TBS', destination: 'IST', state: 'awaiting', dep: at(T0, -4), arr: T0 },
  { id: 2, date: '2026-10-02', origin: 'IST', destination: 'JFK', state: 'upcoming', dep: at(T0, 3), arr: at(T0, 12), awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
  { id: 3, date: '2026-10-01', origin: 'LHR', destination: 'DXB', state: 'awaiting' },
  { id: 4, date: '2026-09-01', origin: 'BKK', destination: 'DXB', state: 'logged' },
  { id: 5, date: '2026-10-20', origin: 'TBS', destination: 'LHR', state: 'upcoming', awaitingAfter: '2099-01-01T00:00:00.000Z', autoAfter: '2099-02-01T00:00:00.000Z' },
]

export const queueAccount = (flights: FixtureFlight[] = FLIGHTS, extra?: (db: D1Database) => D1PreparedStatement[]) => accountWith(flights, extra)

export const addUser = (db: D1Database, id: string) => db.batch([
  db.prepare('INSERT INTO users (id,email,password_hash) VALUES (?,?,?)').bind(id, `${id}@example.test`, 'hash'),
  db.prepare("INSERT INTO profiles (id, created_at) VALUES (?, '2020-01-01T00:00:00.000Z')").bind(id),
])

type Who = { id: string; email: string } | null
const ctx = (db: D1Database, request: Request, user: Who) => ({ ...apiContext(db, request), data: { user }, params: {} } as never)

export async function getAwaiting(db: D1Database, user: Who = USER) {
  const response = await awaitingRoute(ctx(db, new Request('https://kuuki.test/api/me/awaiting'), user))
  return { status: response.status, body: await response.json() as Record<string, any> }
}

export async function postConfirm(db: D1Database, body: unknown, user: Who = USER, headers: Record<string, string> = {}) {
  const response = await confirmRoute(ctx(db, csrfRequest('/api/flights/confirm', 'POST', body, headers), user))
  return { status: response.status, body: await response.json() as Record<string, any> }
}

/** Fresh per-flight tokens from the queue, keyed by flight id. */
export async function tokens(db: D1Database, user: Who = USER): Promise<Record<number, string>> {
  const { body } = await getAwaiting(db, user)
  return Object.fromEntries(body.awaitingFlights.map((entry: any) => [entry.flight.id, entry.candidateToken]))
}

let sequence = 0
export const operationId = (label = 'op') => `${label}-${Date.now().toString(36)}-${++sequence}`
