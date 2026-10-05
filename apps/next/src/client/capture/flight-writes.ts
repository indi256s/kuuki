// Next flight writes. They keep the apps/web idempotent-create contract (one stored key and payload per
// operation) and add the member's browser IANA timezone as the top-level `timezone` request field that
// the lifecycle API reads (ADR 0001 §1). The zone is request context only: it is kept out of the stored
// retry payload, so a replay from another zone is still the same operation. apps/web stays untouched.
import { FLIGHT_BULK_CREATE_MAX, validateFlightInput } from '@kuuki/shared'
import { api, ApiError } from '../../../../web/src/lib/apiClient'
import { completeFlightCreateOperation, getFlightCreateOperation } from '../../../../web/src/lib/flightCreateOperations'
import type { DerivedAck } from '../../../../web/src/lib/derivedState'
import type { Flight, FlightInsert, FlightUpdate } from '../../../../web/src/lib/flights'

/** The browser's IANA zone, or null when unavailable (the server then falls back to UTC). */
export function browserTimezone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { return null }
}

/** A copy of `value` without the listed keys (client-only or server-owned fields never go on the wire). */
const omit = <T extends object>(value: T, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

const withZone = <T extends object>(body: T, zone: boolean = true): T & { timezone?: string } => {
  const timezone = zone ? browserTimezone() : null
  return timezone ? { ...body, timezone } : body
}

/**
 * Send with the browser zone; if the server rejects the zone (400 INVALID_TIMEZONE, answered before any
 * write or idempotency record), send the same operation once more without it so the server falls back to UTC.
 * The stored retry payload never contains the zone, so a failing zone is not persisted or retried again.
 */
async function sendWithZone<T>(send: (zone: boolean) => Promise<T>): Promise<T> {
  try {
    return await send(true)
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.code === 'INVALID_TIMEZONE' && browserTimezone()) return send(false)
    throw error
  }
}

export async function createFlight(flight: Omit<FlightInsert, 'id' | 'created_at'>, operationId: string): Promise<Flight & DerivedAck> {
  const { user_id } = flight
  const operation = getFlightCreateOperation(user_id, operationId, validateFlightInput(omit(flight, 'user_id', 'is_upcoming'), 'create'))
  const dto = await sendWithZone(zone => api.post<Omit<Flight, 'user_id'> & DerivedAck>(
    '/api/flights', withZone(operation.body, zone), { headers: { 'Idempotency-Key': operation.key } }))
  completeFlightCreateOperation(user_id, operationId, operation.key)
  return { ...dto, user_id } as Flight & DerivedAck
}

interface BulkCreateResult { status: 'created' | 'replayed' | 'error'; http_status?: number; code?: string; error?: string }

/** Same chunking, keys and per-entry outcomes as apps/web `createFlights`, with one timezone per request. */
export async function createFlights(
  userId: string,
  entries: Array<{ operationId: string; flight: Omit<FlightInsert, 'id' | 'created_at' | 'user_id'> }>,
  onChunk?: (ack: DerivedAck, saved: number) => void,
): Promise<Array<Error | null>> {
  const outcomes: Array<Error | null> = entries.map(() => null)
  const ready: Array<{ index: number; operationId: string; key: string; body: object }> = []
  entries.forEach(({ operationId, flight }, index) => {
    try {
      ready.push({ index, operationId, ...getFlightCreateOperation(userId, operationId, validateFlightInput(omit(flight, 'is_upcoming'), 'create')) })
    } catch (error) {
      outcomes[index] = error instanceof Error ? error : new Error(String(error))
    }
  })
  for (let start = 0; start < ready.length; start += FLIGHT_BULK_CREATE_MAX) {
    const chunk = ready.slice(start, start + FLIGHT_BULK_CREATE_MAX)
    try {
      const items = chunk.map(({ key, body }) => ({ key, flight: body }))
      const response = await sendWithZone(zone => api.post<DerivedAck & { results: BulkCreateResult[] }>('/api/flights/bulk', withZone({ items }, zone)))
      let saved = 0
      chunk.forEach((item, i) => {
        const result = response.results[i]
        if (result?.status === 'created' || result?.status === 'replayed') {
          completeFlightCreateOperation(userId, item.operationId, item.key)
          saved++
        } else {
          outcomes[item.index] = new ApiError(result?.http_status ?? 500, result?.error ?? 'Flight was not saved', result?.code)
        }
      })
      if (response.derived_state) onChunk?.(response, saved)
    } catch (error) {
      for (const item of chunk) outcomes[item.index] = error instanceof Error ? error : new Error(String(error))
    }
  }
  return outcomes
}

/** The API recomputes lifecycle from a changed date in the sent zone, so lifecycle fields are never sent. */
export async function updateFlight(flightId: number, updates: FlightUpdate): Promise<Flight & DerivedAck> {
  const body = omit(updates, 'user_id', 'id', 'created_at', 'is_upcoming')
  const dto = await sendWithZone(zone => api.patch<Omit<Flight, 'user_id'> & DerivedAck>(`/api/flights/${flightId}`, withZone(body, zone)))
  return { ...dto, user_id: updates.user_id ?? '' } as Flight & DerivedAck
}
