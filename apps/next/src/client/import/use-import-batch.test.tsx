// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { batch, draft, snapshot } from './fixtures'
import type { ImportEvent, Snapshot } from './import-types'
import { useImportBatch, type BatchApi } from './use-import-batch'

afterEach(cleanup)

const rows = (sequence: number): ImportEvent => ({ name: 'rows', sequence, rowIds: [], snapshot: false, reupload: false })
const make = (over: Partial<BatchApi> = {}): BatchApi => ({
  readBatch: vi.fn(async () => snapshot([draft({ id: 'a' })])),
  connect: vi.fn(async () => {}),
  submit: vi.fn(async () => ({ batchId: 'b1' })),
  sleep: vi.fn(async () => {}),
  ...over,
})

describe('useImportBatch resume', () => {
  it('reads the stored snapshot for a batch URL and goes straight to review without submitting', async () => {
    const api = make()
    const { result } = renderHook(() => useImportBatch({ api, initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.drafts.map(row => row.id)).toEqual(['a'])
    expect(api.submit).not.toHaveBeenCalled()
    expect(api.connect).not.toHaveBeenCalled()
  })

  it('resumes a running recognition: subscribes after the snapshot sequence and reloads when rows arrive', async () => {
    const processing = snapshot([], { status: 'processing', stage: 'recognizing', sequence: 3 })
    const done = snapshot([draft({ id: 'a' }), draft({ id: 'b', ordinal: 1 })], { sequence: 4 })
    const readBatch = vi.fn<BatchApi['readBatch']>().mockResolvedValueOnce(processing).mockResolvedValue(done)
    const connect = vi.fn<BatchApi['connect']>(async (_id, _after, onEvent) => { onEvent(rows(4)) })
    const { result } = renderHook(() => useImportBatch({ api: make({ readBatch, connect }), initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(connect.mock.calls[0][1]).toBe(3)
    expect(result.current.drafts).toHaveLength(2)
    expect(result.current.batch?.sequence).toBe(4)
  })

  it('shows the stage and found count while processing', async () => {
    const hold = new Promise<void>(() => {})
    const readBatch = vi.fn(async () => snapshot([draft({ id: 'a' })], { status: 'processing', stage: 'validating', sequence: 2 }))
    const { result } = renderHook(() => useImportBatch({ api: make({ readBatch, connect: () => hold }), initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('processing'))
    expect(result.current.batch?.stage).toBe('validating')
    expect(result.current.drafts).toHaveLength(1)
  })

  it('treats a missing or expired batch as a stated cause, not a blank screen', async () => {
    const missing = renderHook(() => useImportBatch({ api: make({ readBatch: async () => { throw Object.assign(new Error('x'), { status: 404, code: 'IMPORT_BATCH_NOT_FOUND' }) } }), initialBatchId: 'b1' }))
    await waitFor(() => expect(missing.result.current.phase).toBe('failed'))
    expect(missing.result.current.failure?.kind).toBe('notFound')
    const expired = renderHook(() => useImportBatch({ api: make({ readBatch: async () => snapshot([], { status: 'review', expired: true }) }), initialBatchId: 'b1' }))
    await waitFor(() => expect(expired.result.current.phase).toBe('failed'))
    expect(expired.result.current.failure?.kind).toBe('expired')
  })
})

describe('useImportBatch start', () => {
  it('submits once, reports the batch id for the URL and watches the accepted batch', async () => {
    const onBatchId = vi.fn()
    const readBatch = vi.fn(async () => snapshot([draft({ id: 'a' })]))
    const api = make({ readBatch })
    const { result } = renderHook(() => useImportBatch({ api, onBatchId }))
    await act(async () => { await result.current.start({ type: 'text', content: 'JFK BOS' }, 'op-12345678') })
    expect(api.submit).toHaveBeenCalledWith({ type: 'text', content: 'JFK BOS' }, 'op-12345678', expect.anything())
    expect(onBatchId).toHaveBeenCalledWith('b1')
    await waitFor(() => expect(result.current.phase).toBe('ready'))
  })

  it('uses the snapshot of a synchronous answer without opening a stream', async () => {
    const sync: Snapshot = snapshot([draft({ id: 'a' })])
    const api = make({ submit: vi.fn(async () => sync) })
    const { result } = renderHook(() => useImportBatch({ api }))
    await act(async () => { await result.current.start({ type: 'text', content: 'x' }, 'op-12345678') })
    expect(result.current.phase).toBe('ready')
    expect(api.connect).not.toHaveBeenCalled()
  })

  it('classifies a refused submit and keeps the retry instant', async () => {
    const retryAt = '2026-10-05T12:00:00.000Z'
    const submit = vi.fn(async () => { throw Object.assign(new Error('quota'), { status: 429, code: 'PROVIDER_QUOTA', body: { retryAt } }) })
    const { result } = renderHook(() => useImportBatch({ api: make({ submit }) }))
    await act(async () => { await result.current.start({ type: 'text', content: 'x' }, 'op-12345678') })
    expect(result.current.phase).toBe('failed')
    expect(result.current.failure).toMatchObject({ kind: 'quota', retryAt })
    expect(result.current.drafts).toEqual([])
  })

  it('shows a failed batch cause from the snapshot and keeps partial rows', async () => {
    const failed = snapshot([], { status: 'failed', errorCode: 'NO_FLIGHTS_FOUND' })
    const one = renderHook(() => useImportBatch({ api: make({ readBatch: async () => failed }), initialBatchId: 'b1' }))
    await waitFor(() => expect(one.result.current.phase).toBe('failed'))
    expect(one.result.current.failure?.kind).toBe('nothing')
    const partial = snapshot([draft({ id: 'a' })], { status: 'partial', errorCode: 'JOB_INTERRUPTED' })
    const two = renderHook(() => useImportBatch({ api: make({ readBatch: async () => partial }), initialBatchId: 'b1' }))
    await waitFor(() => expect(two.result.current.phase).toBe('ready'))
    expect(two.result.current.partial).toBe(true)
    expect(two.result.current.failure?.kind).toBe('interrupted')
    expect(two.result.current.drafts).toHaveLength(1)
  })
})

describe('useImportBatch drafts', () => {
  it('replaces one row by id and never regresses to an older version', async () => {
    const { result } = renderHook(() => useImportBatch({ api: make(), initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    act(() => result.current.setDraft(draft({ id: 'a', version: 3, selected: false })))
    expect(result.current.drafts[0]).toMatchObject({ version: 3, selected: false })
    act(() => result.current.setDraft(draft({ id: 'a', version: 2, selected: true })))
    expect(result.current.drafts[0].version).toBe(3)
  })

  it('stops watching on unmount', async () => {
    let signal: AbortSignal | undefined
    const connect = vi.fn((_id: string, _after: number, _on: (e: ImportEvent) => void, s: AbortSignal) => { signal = s; return new Promise<void>(() => {}) })
    const readBatch = vi.fn(async () => snapshot([], { status: 'processing', stage: 'accepted', sequence: 1 }))
    const { unmount } = renderHook(() => useImportBatch({ api: make({ readBatch, connect }), initialBatchId: 'b1' }))
    await waitFor(() => expect(connect).toHaveBeenCalled())
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})

void batch

describe('useImportBatch cancelled batches', () => {
  it('keeps the rows extracted before a cancel as a stopped, partial review and does not subscribe', async () => {
    const readBatch = vi.fn(async () => snapshot([draft({ id: 'a' })], { status: 'cancelled', stage: 'recognizing' }))
    const api = make({ readBatch })
    const { result } = renderHook(() => useImportBatch({ api, initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(result.current.drafts.map(row => row.id)).toEqual(['a'])
    expect(result.current.partial).toBe(true)
    expect(result.current.cancelled).toBe(true)
    expect(api.connect).not.toHaveBeenCalled()
  })

  it('returns to the source step only when a cancelled batch kept no rows', async () => {
    const readBatch = vi.fn(async () => snapshot([], { status: 'cancelled' }))
    const { result } = renderHook(() => useImportBatch({ api: make({ readBatch }), initialBatchId: 'b1' }))
    await waitFor(() => expect(result.current.phase).toBe('cancelled'))
    expect(result.current.drafts).toEqual([])
  })
})
