// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('../../../../web/src/lib/apiClient')>()), api: { post: (...args: unknown[]) => post(...args) } }))

import { clearFlightCreateOperations, pendingFlightCreateOperation } from '../../../../web/src/lib/flightCreateOperations'
import { emptyValues } from './review-model'
import { classifyManualFailure, newManualRow, retryUnconfirmedSave, saveManualRows, settleUnconfirmedSave, startNewOperation, unconfirmedSaves, type ManualRowState } from './manual-save'
import { createFlights } from '../capture/flight-writes'
import { toFlightInput } from './flight-input'
import { ApiError } from '../../../../web/src/lib/apiClient'

const values = (over: Partial<ReturnType<typeof emptyValues>> = {}) => ({ ...emptyValues(), date: '2026-03-01', origin: 'JFK', destination: 'BOS', ...over })
const sentItems = (call: number) => (post.mock.calls[call][1] as { items: Array<{ key: string; flight: Record<string, unknown> }> }).items
const answer = (result: object) => ({ results: [result], derived_state: 'ready', revision: 3 })

beforeEach(() => { post.mockReset(); clearFlightCreateOperations() })

describe('manual flights and the shared create receipt', () => {
  it('a definite refusal drops the receipt, so the corrected row saves as a new operation', async () => {
    post.mockResolvedValueOnce(answer({ status: 'error', http_status: 400, code: 'INVALID_FLIGHT', error: 'bad' }))
    const row = newManualRow(values())
    const first = await saveManualRows('u1', [row])
    expect(first.saved).toEqual([])
    expect(first.failures.get(row.key)).toEqual({ kind: 'refused', code: 'INVALID_FLIGHT' })
    const next = first.rows.get(row.key)!
    expect(next.operationId).not.toBe(row.operationId)

    post.mockResolvedValueOnce(answer({ status: 'created' }))
    const corrected: ManualRowState = { ...next, values: values({ destination: 'LAX' }), failure: undefined }
    const second = await saveManualRows('u1', [corrected])
    expect(second.saved).toHaveLength(1)
    expect(sentItems(1)[0].flight.destination).toBe('LAX')
    expect(sentItems(1)[0].key).not.toBe(sentItems(0)[0].key)
  })

  it('a lost response keeps the receipt, and the unchanged row replays under the same key', async () => {
    post.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const row = newManualRow(values())
    const first = await saveManualRows('u1', [row])
    expect(first.failures.get(row.key)?.kind).toBe('uncertain')
    post.mockResolvedValueOnce(answer({ status: 'replayed' }))
    const second = await saveManualRows('u1', [first.rows.get(row.key)!])
    expect(second.saved).toHaveLength(1)
    expect(sentItems(1)[0].key).toBe(sentItems(0)[0].key)
  })

  it('a changed payload under an unconfirmed receipt is not sent; retrying the original or checking the journal recovers it', async () => {
    post.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const row = newManualRow(values())
    const first = await saveManualRows('u1', [row])
    const edited: ManualRowState = { ...first.rows.get(row.key)!, values: values({ destination: 'LAX' }) }

    const blocked = await saveManualRows('u1', [edited])
    expect(blocked.failures.get(row.key)?.kind).toBe('unconfirmed')
    expect(post).toHaveBeenCalledTimes(1) // nothing was sent for the changed payload

    post.mockResolvedValueOnce(answer({ status: 'replayed' }))
    const original = await saveManualRows('u1', [edited], new Set([row.key]))
    expect(original.saved[0].values.destination).toBe('BOS')
    expect(sentItems(1)[0]).toEqual(sentItems(0)[0])

    // Alternatively the member says the journal was checked: the edited row is a fresh operation.
    post.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const lost = await saveManualRows('u1', [newManualRow(values({ origin: 'LHR', destination: 'CDG' }))])
    const stuck = [...lost.rows.values()][0]
    const fresh = startNewOperation('u1', { ...stuck, values: values({ origin: 'LHR', destination: 'AMS' }) })
    expect(fresh.operationId).not.toBe(stuck.operationId)
    post.mockResolvedValueOnce(answer({ status: 'created' }))
    expect((await saveManualRows('u1', [fresh])).saved).toHaveLength(1)
  })

  describe('an unsettled operation keeps its receipt, operation id and pinned payload', () => {
    // A server that commits every key once; the first answer can be lost after the commit.
    const committed = new Set<string>()
    const lostCommit = async (row: ManualRowState) => {
      post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); throw new TypeError('Failed to fetch') })
      const first = await saveManualRows('u1', [row])
      expect(first.failures.get(row.key)?.kind).toBe('uncertain')
      return first.rows.get(row.key)!
    }
    beforeEach(() => committed.clear())

    it('a lost committed response then a refused 403 replay keeps the key, so the next retry cannot add a second flight', async () => {
      const row = newManualRow(values())
      const lost = await lostCommit(row)
      post.mockRejectedValueOnce(new ApiError(403, 'Invalid CSRF token', 'CSRF'))
      const refused = await saveManualRows('u1', [lost])
      expect(refused.failures.get(row.key)?.kind).toBe('uncertain')
      const kept = refused.rows.get(row.key)!
      expect(kept.operationId).toBe(row.operationId)
      expect(pendingFlightCreateOperation('u1', row.operationId)?.key).toBe(sentItems(0)[0].key)

      post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => {
        const key = body.items[0].key
        const status = committed.has(key) ? 'replayed' : 'created'
        committed.add(key)
        return answer({ status })
      })
      const retry = await saveManualRows('u1', [kept], new Set([row.key]))
      expect(retry.saved).toHaveLength(1)
      expect(sentItems(2)[0].key).toBe(sentItems(0)[0].key)
      expect(committed.size).toBe(1)
      expect(pendingFlightCreateOperation('u1', row.operationId)).toBeNull()
    })

    it.each([
      ['409 IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT'],
      ['410 IDEMPOTENCY_GONE', 410, 'IDEMPOTENCY_GONE'],
      ['401 UNAUTHENTICATED', 401, 'UNAUTHENTICATED'],
      ['400 INVALID_FLIGHT after an earlier unknown attempt', 400, 'INVALID_FLIGHT'],
    ])('after a lost response, a replay answered %s is still unsettled', async (_label, status, code) => {
      const row = newManualRow(values())
      const lost = await lostCommit(row)
      post.mockResolvedValueOnce(answer({ status: 'error', http_status: status, code, error: 'x' }))
      const replay = await saveManualRows('u1', [lost])
      expect(replay.saved).toEqual([])
      expect(replay.failures.get(row.key)).toEqual({ kind: 'uncertain', code })
      const kept = replay.rows.get(row.key)!
      expect(kept.operationId).toBe(row.operationId)
      expect(pendingFlightCreateOperation('u1', row.operationId)?.key).toBe(sentItems(0)[0].key)

      post.mockResolvedValueOnce(answer({ status: 'replayed' }))
      expect((await saveManualRows('u1', [kept], new Set([row.key]))).saved).toHaveLength(1)
      expect(sentItems(2)[0]).toEqual(sentItems(0)[0])
    })

    it.each([
      ['401', 401, 'UNAUTHENTICATED'], ['403', 403, 'CSRF'], ['429', 429, 'RATE_LIMITED'], ['413', 413, 'PAYLOAD_TOO_LARGE'],
    ])('a first attempt answered %s is not proven unwritten, so the receipt stays', async (_label, status, code) => {
      post.mockRejectedValueOnce(new ApiError(status, 'x', code))
      const row = newManualRow(values())
      const first = await saveManualRows('u1', [row])
      expect(first.failures.get(row.key)).toEqual({ kind: 'uncertain', code })
      expect(first.rows.get(row.key)!.operationId).toBe(row.operationId)
      expect(pendingFlightCreateOperation('u1', row.operationId)).not.toBeNull()
    })
  })

  describe('an unresolved save survives a reload', () => {
    const committed = new Set<string>()
    const serverCommits = () => post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => {
      const key = body.items[0].key
      const status = committed.has(key) ? 'replayed' : 'created'
      committed.add(key)
      return answer({ status })
    })
    beforeEach(() => committed.clear())
    const loseCommittedResponse = async (scope = 'b1') => {
      post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); throw new TypeError('Failed to fetch') })
      const row = newManualRow(values(), scope)
      await saveManualRows('u1', [row])
      return row
    }

    it('is listed for its owner whatever batch wrote it, and retrying it ends with one committed key', async () => {
      const lost = await loseCommittedResponse()
      expect(lost.operationId.startsWith('manual:b1:')).toBe(true)
      expect(unconfirmedSaves('other')).toEqual([]) // never another member's
      const [listed] = unconfirmedSaves('u1')
      expect(listed).toMatchObject({ operationId: lost.operationId, expired: false })
      expect(listed.values).toMatchObject({ date: '2026-03-01', origin: 'JFK', destination: 'BOS' })

      serverCommits()
      const retry = await retryUnconfirmedSave('u1', lost.operationId)
      expect(retry.saved).toBe(true)
      expect(sentItems(1)[0]).toEqual(sentItems(0)[0])
      expect(committed.size).toBe(1)
      expect(unconfirmedSaves('u1')).toEqual([])
    })

    it('a plain-UUID receipt from the earlier manual rows is listed and held against like any other', async () => {
      post.mockImplementationOnce(async (_path: string, body: { items: Array<{ key: string }> }) => { committed.add(body.items[0].key); throw new TypeError('Failed to fetch') })
      const old = crypto.randomUUID()
      // Written as before (plain UUID), with its fields in another order and the empty optional ones left out.
      const flight = Object.fromEntries(Object.entries(toFlightInput(values())).reverse().filter(([, value]) => value !== null))
      await createFlights('u1', [{ operationId: old, flight: flight as never }])
      expect(unconfirmedSaves('u1').map(save => save.operationId)).toEqual([old])
      const again = newManualRow(values(), 'b2')
      expect((await saveManualRows('u1', [again])).failures.get(again.key)).toMatchObject({ kind: 'duplicate', heldBy: old })
      expect(post).toHaveBeenCalledTimes(1)
    })

    it('a refused retry of a listed save keeps its receipt', async () => {
      const lost = await loseCommittedResponse()
      post.mockResolvedValueOnce(answer({ status: 'error', http_status: 400, code: 'INVALID_FLIGHT', error: 'x' }))
      const retry = await retryUnconfirmedSave('u1', lost.operationId)
      expect(retry).toMatchObject({ saved: false, failure: { kind: 'uncertain', code: 'INVALID_FLIGHT' } })
      expect(pendingFlightCreateOperation('u1', lost.operationId)?.key).toBe(sentItems(0)[0].key)
    })

    it('holds back an identical new row until the unresolved save is settled by the journal check', async () => {
      const lost = await loseCommittedResponse()
      const again = newManualRow(values(), 'b2')
      const held = await saveManualRows('u1', [again])
      expect(held.saved).toEqual([])
      expect(held.failures.get(again.key)).toEqual({ kind: 'duplicate', code: null, heldBy: lost.operationId })
      expect(post).toHaveBeenCalledTimes(1) // no second key was minted
      expect(pendingFlightCreateOperation('u1', again.operationId)).toBeNull()
      expect(pendingFlightCreateOperation('u1', lost.operationId)).not.toBeNull()
      // Another member's identical flight is not held by u1's save.
      serverCommits()
      expect((await saveManualRows('u2', [newManualRow(values())])).saved).toHaveLength(1)

      // A different flight is not held.
      serverCommits()
      expect((await saveManualRows('u1', [newManualRow(values({ destination: 'LAX' }), 'b1')])).saved).toHaveLength(1)

      // The member checked the journal for the unresolved save: the identical row is now a normal new save.
      settleUnconfirmedSave('u1', lost.operationId)
      serverCommits()
      expect((await saveManualRows('u1', [again])).saved).toHaveLength(1)
    })
  })

  it('classifies what is known to be unwritten apart from what is uncertain', () => {
    expect(classifyManualFailure(new ApiError(422, 'x', 'INVALID_FLIGHT'), true).kind).toBe('refused')
    expect(classifyManualFailure(new ApiError(400, 'x', 'UNKNOWN_AIRPORT'), true).kind).toBe('refused')
    expect(classifyManualFailure(new ApiError(400, 'x', 'INVALID_FLIGHT'), false).kind).toBe('uncertain')
    expect(classifyManualFailure(new ApiError(400, 'x', 'IDEMPOTENCY_KEY_REQUIRED'), true).kind).toBe('uncertain')
    for (const [status, code] of [[401, 'UNAUTHENTICATED'], [403, 'CSRF'], [409, 'IDEMPOTENCY_CONFLICT'], [410, 'IDEMPOTENCY_GONE'], [413, 'PAYLOAD_TOO_LARGE'], [429, 'RATE_LIMITED'], [408, undefined], [503, undefined]] as const) {
      expect(classifyManualFailure(new ApiError(status, 'x', code), true).kind).toBe('uncertain')
    }
    expect(classifyManualFailure(new TypeError('x'), true).kind).toBe('uncertain')
    expect(classifyManualFailure(new Error('damaged receipt'), true).kind).toBe('expired')
  })
})
