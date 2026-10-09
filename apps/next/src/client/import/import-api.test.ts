// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelBatch,
  confirmItems,
  discardBatch,
  listUnfinished,
  patchDraft,
  submitSource,
} from './import-api'

const post = vi.fn(),
  get = vi.fn(),
  patch = vi.fn(),
  del = vi.fn()
vi.mock('@kuuki/client/apiClient', () => ({
  api: {
    post: (...a: unknown[]) => post(...a),
    get: (...a: unknown[]) => get(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message)
    }
  },
}))
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

describe('import api', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    patch.mockReset()
    del.mockReset()
  })

  it('sends the member timezone and a deterministic key per item on confirm', async () => {
    post.mockResolvedValue({
      results: [],
      batch: { id: 'b1', status: 'review', sequence: 2, reviewRowCount: 0 },
    })
    await confirmItems('b1', [
      { draftId: 'd1', version: 3 },
      { draftId: 'd2', version: 1 },
    ])
    const [path, body] = post.mock.calls[0]
    expect(path).toBe('/api/import/batches/b1/confirm')
    expect(body).toEqual({
      timezone: zone(),
      items: [
        { draftId: 'd1', version: 3, key: 'import:d1:3' },
        { draftId: 'd2', version: 1, key: 'import:d2:1' },
      ],
    })
  })

  it('retries once without the zone when the server rejects it', async () => {
    const { ApiError } = await import('@kuuki/client/apiClient')
    post
      .mockRejectedValueOnce(new ApiError(400, 'bad zone', 'INVALID_TIMEZONE'))
      .mockResolvedValueOnce({
        results: [],
        batch: { id: 'b1', status: 'review', sequence: 2, reviewRowCount: 0 },
      })
    await confirmItems('b1', [{ draftId: 'd1', version: 1 }])
    expect(post.mock.calls[0][1]).toHaveProperty('timezone')
    expect(post.mock.calls[1][1]).not.toHaveProperty('timezone')
  })

  it('submits the source with an operation id and the long upload deadline', async () => {
    post.mockResolvedValue({ batchId: 'b1' })
    await submitSource({ type: 'text', content: 'JFK BOS', sourceLabel: null }, 'op-12345678')
    expect(post.mock.calls[0][0]).toBe('/api/import/jobs')
    expect(post.mock.calls[0][1]).toEqual({
      type: 'text',
      content: 'JFK BOS',
      sourceLabel: null,
      submissionOperationId: 'op-12345678',
    })
    expect(post.mock.calls[0][2].timeoutMs).toBeGreaterThan(30_000)
  })

  it('unwraps a patched draft and routes cancel, discard and the unfinished list', async () => {
    patch.mockResolvedValue({ draft: { id: 'd1', version: 2 } })
    expect(await patchDraft('d1', { version: 1, selected: false })).toEqual({
      id: 'd1',
      version: 2,
    })
    expect(patch.mock.calls[0][0]).toBe('/api/import/drafts/d1')
    post.mockResolvedValue({ cancelled: true })
    await cancelBatch('b1')
    expect(post.mock.calls[0][0]).toBe('/api/import/batches/b1/cancel')
    del.mockResolvedValue({ deleted: true })
    await discardBatch('b1')
    expect(del.mock.calls[0][0]).toBe('/api/import/batches/b1')
    get.mockResolvedValue({ drafts: [{ batchId: 'b2' }] })
    expect(await listUnfinished()).toEqual([{ batchId: 'b2' }])
    expect(get.mock.calls[0][0]).toBe('/api/me/awaiting')
  })
})
