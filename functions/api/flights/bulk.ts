// POST /api/flights/bulk — create up to FLIGHT_BULK_CREATE_MAX flights, each under its own idempotency key.
// Items validate independently; accepted flights and their receipts commit in one D1 batch with one
// dirty mark, then derived state is repaired once. Results are positional: created / replayed / error.

import { runHandler, readJson, json, HttpError } from '../_lib/http'
import { requireUser, requireCsrf, type RequestData } from '../_lib/auth'
import { toOwnFlight, type FlightRow } from '../_lib/flights'
import { parseFlightBodies } from '../_lib/flightValidation'
import { FLIGHT_BULK_CREATE_MAX } from '../../../packages/shared/src/flightValidation'
import { dirtyUserStatement, repairUserDerivedState } from '../_services/derivedState'
import { FLIGHT_COLUMNS, createFlightStatements, isIdempotencyKey } from './index'

type ItemResult =
  | { key: string | null; status: 'created' | 'replayed'; flight: ReturnType<typeof toOwnFlight> }
  | { key: string | null; status: 'error'; http_status: number; code: string; error: string }

function failure(key: string | null, status: number, code: string, error: string): ItemResult {
  return { key, status: 'error', http_status: status, code, error }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export const onRequestPost: PagesFunction<Env, string, RequestData> = context =>
  bulkCreateRequest(context.request, context.env, context.data)

/** Actual Request/Response domain entry, shared by the Pages compatibility transport. */
export function bulkCreateRequest(request: Request, env: Env, data: RequestData): Promise<Response> {
  return runHandler(async () => {
    requireCsrf(request)
    const user = requireUser(data)

    // A full legitimate item is under 1 KB, so 64 KB covers FLIGHT_BULK_CREATE_MAX with room to spare.
    const body = await readJson<{ items?: unknown }>(request, { maxBytes: 64 * 1024 })
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'items must be a non-empty array', 'INVALID_ITEMS')
    if (items.length > FLIGHT_BULK_CREATE_MAX) throw new HttpError(413, `At most ${FLIGHT_BULK_CREATE_MAX} flights per request`, 'TOO_MANY_FLIGHTS')

    const parsed = await parseFlightBodies(env.DB, items.map(item => isRecord(item) ? item.flight : undefined))
    const results: ItemResult[] = []
    const accepted: Array<{ index: number; key: string; digest: string; first: number }> = []
    const statements: D1PreparedStatement[] = []
    for (const [index, item] of items.entries()) {
      const key = isRecord(item) && isIdempotencyKey(item.key) ? item.key : null
      const input = parsed[index]
      if (!key) results.push(failure(null, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Valid idempotency key required'))
      else if (input instanceof HttpError) results.push(failure(key, input.status, input.code ?? 'INVALID_FLIGHT', input.message))
      else {
        const created = await createFlightStatements(env.DB, user.id, key, input)
        accepted.push({ index, key, digest: created.digest, first: statements.length })
        statements.push(...created.statements)
        results.push(failure(key, 500, 'RECEIPT_MISSING', 'Flight receipt missing')) // replaced once the ledger is read
      }
    }
    if (accepted.length === 0) return json({ results })

    // Unconditional dirty mark: changes() only sees the last item, and a pure replay just repairs again.
    const batch = await env.DB.batch([...statements, dirtyUserStatement(env.DB, user.id)])
    const ledgers = await env.DB.prepare(
      'SELECT key, payload_digest, flight_id FROM flight_idempotency WHERE user_id = ? AND key IN (SELECT value FROM json_each(?))',
    ).bind(user.id, JSON.stringify(accepted.map(item => item.key))).all<{ key: string; payload_digest: string; flight_id: number | null }>()
    const ledgerByKey = new Map(ledgers.results.map(row => [row.key, row]))
    const ids = ledgers.results.flatMap(row => row.flight_id == null ? [] : [row.flight_id])
    const rows = await env.DB.prepare(`SELECT ${FLIGHT_COLUMNS} FROM flights WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`)
      .bind(user.id, JSON.stringify(ids)).all<FlightRow>()
    const rowById = new Map(rows.results.map(row => [row.id, row]))

    for (const { index, key, digest, first } of accepted) {
      const ledger = ledgerByKey.get(key)
      const row = ledger?.flight_id == null ? undefined : rowById.get(ledger.flight_id)
      if (!ledger) continue
      if (ledger.payload_digest !== digest) results[index] = failure(key, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key already used for another flight')
      else if (!row) results[index] = failure(key, 410, 'IDEMPOTENCY_GONE', 'Original flight was deleted')
      else results[index] = { key, status: (batch[first].meta.changes ?? 0) > 0 ? 'created' : 'replayed', flight: toOwnFlight(row) }
    }
    return json({ results, ...await repairUserDerivedState(env.DB, user.id) })
  })
}
