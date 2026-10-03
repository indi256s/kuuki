import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))

import { api, resetApiMock } from '@/test/mocks/apiClient'
import { useEnrichmentPolling } from '../useImport'

describe('useEnrichmentPolling', () => {
  it('ignores a previous job response after switching jobs', async () => {
    resetApiMock()
    let resolvePrevious!: (value: { status: 'completed'; flights: [] }) => void
    const previousRequest = new Promise<{ status: 'completed'; flights: [] }>((resolve) => {
      resolvePrevious = resolve
    })
    vi.mocked(api.get).mockImplementation((path) =>
      path.endsWith('/previous') ? previousRequest as never : new Promise<never>(() => {})
    )
    const onComplete = vi.fn()
    const onError = vi.fn()

    const { rerender, unmount } = renderHook(
      ({ jobId }) => useEnrichmentPolling(jobId, onComplete, onError),
      { initialProps: { jobId: 'previous' } }
    )
    const previousSignal = vi.mocked(api.get).mock.calls[0][2]

    rerender({ jobId: 'next' })
    expect(previousSignal?.aborted).toBe(true)

    await act(async () => {
      resolvePrevious({ status: 'completed', flights: [] })
      await previousRequest
    })

    expect(onComplete).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    unmount()
  })
})
