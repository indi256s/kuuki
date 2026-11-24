import { FLIGHT_BULK_CREATE_MAX, validateFlightInput } from '@kuuki/shared'
import { api, ApiError } from '@kuuki/client/apiClient'
import {
  abandonFlightCreateOperation,
  completeFlightCreateOperation,
  getFlightCreateOperation,
  pendingFlightCreateOperation,
} from '@kuuki/client/flightCreateOperations'
import type { DerivedAck } from '@kuuki/client/derivedState'
import type { Flight, FlightInsert, FlightUpdate } from '@kuuki/client/flights'

export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

const omit = <T extends object>(value: T, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

export const withZone = <T extends object>(
  body: T,
  zone: boolean = true,
): T & { timezone?: string } => {
  const timezone = zone ? browserTimezone() : null
  return timezone ? { ...body, timezone } : body
}

export async function sendWithZone<T>(send: (zone: boolean) => Promise<T>): Promise<T> {
  try {
    return await send(true)
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === 'INVALID_TIMEZONE' &&
      browserTimezone()
    )
      return send(false)
    throw error
  }
}

export const flightCreatePayload = (flight: object): object =>
  validateFlightInput(omit(flight, 'is_upcoming'), 'create')

export const isFlightValidationRefusal = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.status === 400 || error.status === 422) &&
  !(error.code ?? '').startsWith('IDEMPOTENCY_') &&
  error.code !== 'CSRF'

export async function createFlight(
  userId: string,
  flight: FlightInsert,
  operationId: string,
  retryKey?: string,
): Promise<Flight & DerivedAck> {
  const firstAttempt = retryKey === undefined && !pendingFlightCreateOperation(userId, operationId)
  const operation = getFlightCreateOperation(
    userId,
    operationId,
    flightCreatePayload(flight),
    retryKey,
  )
  let dto: Flight & DerivedAck
  try {
    dto = await sendWithZone((zone) =>
      api.post<Flight & DerivedAck>('/api/flights', withZone(operation.body, zone), {
        headers: { 'Idempotency-Key': operation.key },
      }),
    )
  } catch (error) {
    if (firstAttempt && isFlightValidationRefusal(error))
      abandonFlightCreateOperation(userId, operationId)
    throw error
  }
  completeFlightCreateOperation(userId, operationId, operation.key)
  return dto
}

interface BulkCreateResult {
  status: 'created' | 'replayed' | 'error'
  http_status?: number
  code?: string
  error?: string
}

export async function createFlights(
  userId: string,
  entries: Array<{
    operationId: string
    retryKey?: string
    flight: FlightInsert
  }>,
  onChunk?: (ack: DerivedAck, saved: number) => void,
): Promise<Array<Error | null>> {
  const outcomes: Array<Error | null> = entries.map(() => null)
  const ready: Array<{ index: number; operationId: string; key: string; body: object }> = []
  entries.forEach(({ operationId, flight, retryKey }, index) => {
    try {
      ready.push({
        index,
        operationId,
        ...getFlightCreateOperation(userId, operationId, flightCreatePayload(flight), retryKey),
      })
    } catch (error) {
      outcomes[index] = error instanceof Error ? error : new Error(String(error))
    }
  })
  for (let start = 0; start < ready.length; start += FLIGHT_BULK_CREATE_MAX) {
    const chunk = ready.slice(start, start + FLIGHT_BULK_CREATE_MAX)
    try {
      const items = chunk.map(({ key, body }) => ({ key, flight: body }))
      const response = await sendWithZone((zone) =>
        api.post<DerivedAck & { results: BulkCreateResult[] }>(
          '/api/flights/bulk',
          withZone({ items }, zone),
        ),
      )
      let saved = 0
      chunk.forEach((item, i) => {
        const result = response.results[i]
        if (result?.status === 'created' || result?.status === 'replayed') {
          completeFlightCreateOperation(userId, item.operationId, item.key)
          saved++
        } else {
          outcomes[item.index] = new ApiError(
            result?.http_status ?? 500,
            result?.error ?? 'Flight was not saved',
            result?.code,
          )
        }
      })
      if (response.derived_state) onChunk?.(response, saved)
    } catch (error) {
      for (const item of chunk)
        outcomes[item.index] = error instanceof Error ? error : new Error(String(error))
    }
  }
  return outcomes
}

export async function updateFlight(
  flightId: number,
  updates: FlightUpdate,
): Promise<Flight & DerivedAck> {
  const body = omit(updates, 'user_id', 'id', 'created_at', 'is_upcoming')
  const dto = await sendWithZone((zone) =>
    api.patch<Flight & DerivedAck>(`/api/flights/${flightId}`, withZone(body, zone)),
  )
  return dto
}
