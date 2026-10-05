// GET /api/flights — list (filters + sort + paging). POST /api/flights — create.
// Both own-scoped; the create also requires CSRF. Mirrors the live trigger chain (LOGIC_SPEC):
// duration → distance → insert → visits → recompute → unlocks → badges → advanced stats.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { FLIGHT_COLUMNS, toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBody } from '../_lib/flightValidation'
import {
  parseFlightFilters,
  parsePagination,
  parseSort,
} from '../_lib/flightQuery'
import { readJournal } from '../_services/journal'
import { createFlightStatements, digestInput, isIdempotencyKey } from '../_services/flightCreate'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { takeRequestTimezone } from '../_services/lifecycle'
import { readPressedBefore, stampsForCreated } from '../_services/newlyStamped'

export { FLIGHT_COLUMNS, createFlightStatements, digestInput, isIdempotencyKey }

export const onRequestGet: PagesFunction<Env, string, RequestData> = context =>
  listFlights(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function listFlights(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    const user = requireUser(data)
    const params = new URL(request.url).searchParams
    const filters = parseFlightFilters(params)
    const { limit, offset } = parsePagination(params, 20)
    const sort = parseSort(params)
    return json(await readJournal(env.DB, user.id, filters, sort, limit, offset))
  })
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  createFlightRequest(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function createFlightRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    const started = Date.now()
    requireCsrf(request)
    const user = requireUser(data)

    const key = request.headers.get('Idempotency-Key')
    if (!isIdempotencyKey(key)) throw new HttpError(400, 'Valid Idempotency-Key required', 'IDEMPOTENCY_KEY_REQUIRED')
    const { body, timezone } = takeRequestTimezone(await readJson<unknown>(request))
    const input = await parseFlightBody(env.DB, body, 'create')
    const { digest, statements } = await createFlightStatements(env.DB, user.id, key, input, timezone)
    const pressedBefore = await readPressedBefore(env.DB, user.id)
    const canonicalStarted = Date.now()
    const batch = await env.DB.batch([...statements, dirtyUserStatement(env.DB, user.id, true)])
    const canonicalMs = Date.now() - canonicalStarted
    const ledger = await env.DB.prepare('SELECT payload_digest, flight_id FROM flight_idempotency WHERE user_id = ? AND key = ?')
      .bind(user.id, key).first<{ payload_digest: string; flight_id: number | null }>()
    if (!ledger) throw new HttpError(500, 'Flight receipt missing', 'RECEIPT_MISSING')
    if (ledger.payload_digest !== digest) throw new HttpError(409, 'Idempotency key already used for another flight', 'IDEMPOTENCY_CONFLICT')
    const row = ledger.flight_id == null ? null : await env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE id = ? AND user_id = ?`)
      .bind(ledger.flight_id, user.id).first<FlightRow>()
    if (!row) throw new HttpError(410, 'Original flight was deleted', 'IDEMPOTENCY_GONE')
    const created = (batch[0].meta.changes ?? 0) > 0
    const repairStarted = Date.now()
    const derived = await repairUserDerivedState(env.DB, user.id)
    console.log(JSON.stringify({ event: 'flight_save', outcome: created ? 'created' : 'replayed', canonicalMs,
      repairMs: Date.now() - repairStarted, durationMs: Date.now() - started, derivedState: derived.derived_state }))
    const stamps = created ? await stampsForCreated(env.DB, user.id, pressedBefore, derived, [row]) : () => null
    return json({ ...toOwnFlight(row), ...derived, newly_stamped_countries: stamps(row.id) }, { status: created ? 201 : 200 })
  })
}
