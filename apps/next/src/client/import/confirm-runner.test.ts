import { describe, expect, it, vi } from 'vitest'
import { importKey, retryableIds, runConfirm, type ConfirmItem } from './confirm-runner'
import type { ConfirmItemResult, ConfirmResponse } from './import-types'

const items = (n: number, from = 0): ConfirmItem[] => Array.from({ length: n }, (_, i) => ({ draftId: `d${from + i}`, version: 2 }))
const flight = (id: number) => ({ id, aircraft_icao: null, origin: 'JFK', destination: 'BOS', date: '2026-03-01' })
const created = (item: ConfirmItem, id: number): ConfirmItemResult => ({ draftId: item.draftId, key: importKey(item.draftId, item.version), status: 'created', flight: flight(id) })
const failed = (item: ConfirmItem, code: string, http_status: number): ConfirmItemResult => ({ draftId: item.draftId, key: importKey(item.draftId, item.version), status: 'error', code, http_status, error: 'x' })
const response = (results: ConfirmItemResult[], over: Partial<ConfirmResponse> = {}): ConfirmResponse =>
  ({ results, batch: { id: 'b1', status: 'review', sequence: 4, reviewRowCount: 0 }, derived_state: 'ready', revision: 3, ...over })

describe('importKey', () => {
  it('is deterministic per draft and version, so a lost response is replayed rather than duplicated', () => {
    expect(importKey('abc', 2)).toBe('import:abc:2')
    expect(importKey('abc', 2)).toBe(importKey('abc', 2))
    expect(importKey('abc', 3)).not.toBe(importKey('abc', 2))
  })
  it('fits the server key grammar for a UUID draft id', () => {
    expect(importKey('3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f', 12)).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
  })
})

describe('runConfirm', () => {
  it('sends 50-item chunks one after another and reports each saved row', async () => {
    let active = 0, peak = 0
    const send = vi.fn(async (_id: string, chunk: ConfirmItem[]) => {
      active++; peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      return response(chunk.map((item, i) => created(item, i + 1)))
    })
    const outcome = await runConfirm({ batchId: 'b1', items: items(120), send })
    expect(send.mock.calls.map(call => call[1].length)).toEqual([50, 50, 20])
    expect(peak).toBe(1)
    expect([...outcome.rows.values()].filter(row => row.status === 'saved')).toHaveLength(120)
    expect(outcome.acks).toHaveLength(3)
    expect(retryableIds(outcome)).toEqual([])
  })

  it('keeps per-row failures beside saved rows and retries only the failed ones', async () => {
    const all = items(3)
    const send = vi.fn(async (_id: string, chunk: ConfirmItem[]) => response(chunk.map(item =>
      item.draftId === 'd1' ? failed(item, 'INTERNAL', 500) : item.draftId === 'd2' ? failed(item, 'YEAR_NOT_CONFIRMED', 409) : created(item, 7))))
    const outcome = await runConfirm({ batchId: 'b1', items: all, send })
    expect(outcome.rows.get('d0')).toMatchObject({ status: 'saved', flightId: 7 })
    expect(outcome.rows.get('d1')).toMatchObject({ status: 'failed', retryable: true, failure: 'transient' })
    expect(outcome.rows.get('d2')).toMatchObject({ status: 'failed', retryable: false, failure: 'year' })
    expect(retryableIds(outcome)).toEqual(['d1'])
  })

  it('treats a replayed item as saved', async () => {
    const send = async (_id: string, chunk: ConfirmItem[]) => response(chunk.map(item => ({ ...created(item, 9), status: 'replayed' as const })))
    const outcome = await runConfirm({ batchId: 'b1', items: items(1), send })
    expect(outcome.rows.get('d0')).toMatchObject({ status: 'saved', replayed: true })
  })

  it('marks the chunk uncertain when the response is lost and leaves later chunks unsent', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(response(items(50).map(item => created(item, 1))))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const outcome = await runConfirm({ batchId: 'b1', items: items(120), send })
    expect(send).toHaveBeenCalledTimes(2)
    expect(outcome.rows.get('d0')?.status).toBe('saved')
    expect(outcome.rows.get('d50')?.status).toBe('uncertain')
    expect(outcome.rows.get('d99')?.status).toBe('uncertain')
    expect(outcome.rows.get('d100')?.status).toBe('unsent')
    expect(retryableIds(outcome)).toHaveLength(70)
    expect(outcome.uncertain).toBe(true)
  })

  it('treats a 5xx request failure as uncertain but a 4xx as a definite failure', async () => {
    const serverError = Object.assign(new Error('boom'), { status: 502 })
    const expired = Object.assign(new Error('gone'), { status: 410, code: 'IMPORT_BATCH_EXPIRED' })
    const one = await runConfirm({ batchId: 'b1', items: items(1), send: async () => { throw serverError } })
    expect(one.rows.get('d0')?.status).toBe('uncertain')
    const two = await runConfirm({ batchId: 'b1', items: items(1), send: async () => { throw expired } })
    expect(two.rows.get('d0')).toMatchObject({ status: 'failed', failure: 'expired', retryable: false })
    expect(two.uncertain).toBe(false)
  })

  it('reports the last batch snapshot header and every derived acknowledgement', async () => {
    const send = vi.fn()
      .mockResolvedValueOnce(response(items(50).map(item => created(item, 1)), { derived_state: 'pending', revision: 5 }))
      .mockResolvedValueOnce(response(items(1, 50).map(item => created(item, 2)), { batch: { id: 'b1', status: 'completed', sequence: 9, reviewRowCount: 0 }, revision: 6 }))
    const outcome = await runConfirm({ batchId: 'b1', items: items(51), send })
    expect(outcome.batch).toMatchObject({ status: 'completed', sequence: 9 })
    expect(outcome.acks.map(ack => ack.revision)).toEqual([5, 6])
  })

  it('does not resend rows that were already saved on a retry of the remainder', async () => {
    const first = await runConfirm({ batchId: 'b1', items: items(2), send: async (_i, chunk) => response(chunk.map(item => item.draftId === 'd1' ? failed(item, 'INTERNAL', 500) : created(item, 1))) })
    const ids = retryableIds(first)
    const send = vi.fn(async (_id: string, chunk: ConfirmItem[]) => response(chunk.map(item => created(item, 2))))
    await runConfirm({ batchId: 'b1', items: items(2).filter(item => ids.includes(item.draftId)), send })
    expect(send.mock.calls[0][1].map(item => item.draftId)).toEqual(['d1'])
  })
})
