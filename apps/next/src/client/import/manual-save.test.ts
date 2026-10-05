// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('../../../../web/src/lib/apiClient', async importOriginal => ({ ...(await importOriginal<typeof import('../../../../web/src/lib/apiClient')>()), api: { post: (...args: unknown[]) => post(...args) } }))

import { clearFlightCreateOperations } from '../../../../web/src/lib/flightCreateOperations'
import { emptyValues } from './review-model'
import { classifyManualFailure, newManualRow, saveManualRows, startNewOperation, type ManualRowState } from './manual-save'
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

  it('classifies what is known to be unwritten apart from what is uncertain', () => {
    expect(classifyManualFailure(new ApiError(422, 'x', 'INVALID_FLIGHT')).kind).toBe('refused')
    expect(classifyManualFailure(new ApiError(429, 'x')).kind).toBe('busy')
    expect(classifyManualFailure(new ApiError(503, 'x')).kind).toBe('uncertain')
    expect(classifyManualFailure(new ApiError(408, 'x')).kind).toBe('uncertain')
    expect(classifyManualFailure(new TypeError('x')).kind).toBe('uncertain')
    expect(classifyManualFailure(new Error('damaged receipt')).kind).toBe('expired')
  })
})
