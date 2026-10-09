import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type {
  ConfirmOutcome,
  ConfirmRequest,
} from '../../../../../functions/api/_services/confirmation'
import type { AwaitingQueue } from '../awaiting'
import {
  confirmFlights,
  partitionPending,
  type ConfirmTransport,
  type PendingFlight,
} from './confirm-flights'

vi.mock('../activity', () => ({ trackPrivateOperation: () => () => {} }))

const flight = (
  id: number,
  lifecycle_state: PendingFlight['lifecycle_state'] = 'awaiting',
): PendingFlight => ({ id, lifecycle_state })
const queueOf = (ids: number[], total = ids.length, token = (id: number) => `t${id}`) =>
  ({
    awaitingFlights: ids.map((id) => ({ flight: { id }, candidateToken: token(id) })),
    awaitingFlightCount: total,
  }) as unknown as AwaitingQueue
const ok = (request: ConfirmRequest, overrides: Partial<ConfirmOutcome> = {}): ConfirmOutcome => ({
  results: request.items.map((item) => ({
    flightId: item.flightId,
    lifecycleState: 'logged',
    confirmationSource: 'user',
    confirmedAt: '',
    arrivalTransit: false,
    arrivalTransitLegId: null,
  })),
  derivedState: 'ready',
  revision: 2,
  newlyStampedCountries: [],
  pendingCountryCount: 0,
  ...overrides,
})
function transport(
  queues: AwaitingQueue[],
  confirm: ConfirmTransport['confirm'] = async (request) => ok(request),
) {
  const reads = [...queues]
  return { readQueue: vi.fn(async () => reads.shift() ?? queues.at(-1)!), confirm: vi.fn(confirm) }
}

describe('partitionPending', () => {
  it('splits by lifecycle and keeps order', () => {
    expect(
      partitionPending([flight(3), flight(1, 'upcoming'), flight(2, 'logged'), flight(4)]),
    ).toEqual({ awaiting: [3, 4], upcoming: [1], notAwaiting: [2] })
  })
})

describe('confirmFlights', () => {
  it('sends only awaiting flights with their queue tokens and counts the skipped ones', async () => {
    const t = transport([queueOf([1, 2])])
    const result = await confirmFlights({
      flights: [
        flight(1),
        flight(5, 'upcoming'),
        flight(6, 'upcoming'),
        flight(7, 'logged'),
        flight(2),
      ],
      arrivalTransit: new Map([[2, true]]),
      transport: t,
    })
    expect(t.confirm).toHaveBeenCalledTimes(1)
    expect(t.confirm.mock.calls[0]![0].items).toEqual([
      { flightId: 1, candidateToken: 't1' },
      { flightId: 2, candidateToken: 't2', arrivalTransit: true },
    ])
    expect(result).toMatchObject({
      outcome: 'confirmed',
      confirmed: [1, 2],
      skipped: { upcoming: [5, 6], notAwaiting: [7], noToken: [] },
      derivedState: 'ready',
    })
  })

  it('makes no request when nothing is awaiting', async () => {
    const t = transport([queueOf([])])
    const result = await confirmFlights({
      flights: [flight(1, 'upcoming'), flight(2, 'logged')],
      transport: t,
    })
    expect(t.readQueue).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      outcome: 'nothing',
      confirmed: [],
      skipped: { upcoming: [1], notAwaiting: [2], noToken: [] },
    })
  })

  it('uses the queue it was given, then reads the next page after each committed batch of at most 100', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1)
    const t = transport([queueOf(ids.slice(100), 50)])
    const result = await confirmFlights({
      flights: ids.map((id) => flight(id)),
      queue: queueOf(ids.slice(0, 100), 150),
      transport: t,
    })
    expect(t.confirm.mock.calls.map(([request]) => request.items.length)).toEqual([100, 50])
    expect(t.readQueue).toHaveBeenCalledTimes(1)
    expect(new Set(t.confirm.mock.calls.map(([request]) => request.operationId)).size).toBe(2)
    expect(result.outcome).toBe('confirmed')
    expect(result.confirmed).toHaveLength(150)
  })

  it('reports flights missing from a complete queue as not awaiting, and from a truncated one as having no token', async () => {
    const complete = await confirmFlights({
      flights: [flight(1), flight(2)],
      transport: transport([queueOf([1])]),
    })
    expect(complete).toMatchObject({
      outcome: 'confirmed',
      confirmed: [1],
      skipped: { notAwaiting: [2], noToken: [] },
    })
    const truncated = await confirmFlights({
      flights: [flight(1), flight(2)],
      transport: transport([queueOf([1], 101)]),
    })
    expect(truncated).toMatchObject({
      outcome: 'confirmed',
      confirmed: [1],
      skipped: { notAwaiting: [], noToken: [2] },
    })
  })

  it('treats a 409 as all or nothing: rereads the queue and rebuilds the batch without the flight that moved', async () => {
    const t = transport(
      [queueOf([1, 2], 2, (id) => `fresh${id}`), queueOf([1], 1, (id) => `fresh${id}`)],
      async (request) => {
        if (
          request.items.some((item) => item.candidateToken.startsWith('old') || item.flightId === 2)
        )
          throw new ApiError(409, 'conflict', 'STATE_CONFLICT')
        return ok(request)
      },
    )
    const result = await confirmFlights({
      flights: [flight(1), flight(2)],
      queue: queueOf([1, 2], 2, (id) => `old${id}`),
      transport: t,
    })
    expect(
      t.confirm.mock.calls.map(([request]) => request.items.map((item) => item.candidateToken)),
    ).toEqual([['old1', 'old2'], ['fresh1', 'fresh2'], ['fresh1']])
    expect(result).toMatchObject({
      outcome: 'confirmed',
      confirmed: [1],
      skipped: { notAwaiting: [2] },
    })
  })

  it('maps a refusal to rejected and confirms nothing', async () => {
    const t = transport([queueOf([1, 2])], async () => {
      throw new ApiError(404, 'Flight not found', 'NOT_FOUND')
    })
    const result = await confirmFlights({ flights: [flight(1), flight(2)], transport: t })
    expect(t.confirm).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      outcome: 'rejected',
      confirmed: [],
      failed: [1, 2],
      error: { status: 404, code: 'NOT_FOUND' },
      derivedState: null,
    })
  })

  it('replays a lost answer once with the same operation id; still lost is unknown', async () => {
    const recovered = transport(
      [queueOf([1])],
      vi
        .fn<ConfirmTransport['confirm']>()
        .mockRejectedValueOnce(new TypeError('network'))
        .mockImplementation(async (request) => ok(request, { derivedState: 'pending' })),
    )
    const first = await confirmFlights({ flights: [flight(1)], transport: recovered })
    expect(recovered.confirm.mock.calls[0]![0].operationId).toBe(
      recovered.confirm.mock.calls[1]![0].operationId,
    )
    expect(first).toMatchObject({ outcome: 'confirmed', confirmed: [1], derivedState: 'pending' })

    const gone = transport([queueOf([1])], async () => {
      throw new ApiError(503, 'unavailable')
    })
    expect(await confirmFlights({ flights: [flight(1)], transport: gone })).toMatchObject({
      outcome: 'unknown',
      confirmed: [],
      failed: [1],
    })
  })

  it('reports partial when a later batch fails after an earlier one committed', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => i + 1)
    let calls = 0
    const t = transport(
      [queueOf(ids.slice(0, 100), 120), queueOf(ids.slice(100), 20)],
      async (request) => {
        calls += 1
        if (calls > 1) throw new ApiError(400, 'bad', 'INVALID_REQUEST')
        return ok(request)
      },
    )
    const result = await confirmFlights({ flights: ids.map((id) => flight(id)), transport: t })
    expect(result.outcome).toBe('partial')
    expect(result.confirmed).toHaveLength(100)
    expect(result.failed).toEqual(ids.slice(100))
  })

  it('drops the answer once the caller aborts', async () => {
    const controller = new AbortController()
    const t = transport([queueOf([1])], async (request) => {
      controller.abort()
      return ok(request)
    })
    expect(
      (await confirmFlights({ flights: [flight(1)], signal: controller.signal, transport: t }))
        .outcome,
    ).toBe('stale')
  })
})
