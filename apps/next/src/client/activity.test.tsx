// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
const api = { get: vi.fn(), post: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../../../web/src/lib/apiClient', () => ({
  api, beginIdentityOperation: vi.fn(), getAuthGeneration: () => 1,
}))

const sync = () => api.post.mock.calls.filter(call => call[0] === '/api/flights/sync-upcoming')

describe('ActivityBridge owner sync', () => {
  beforeEach(async () => {
    vi.resetModules()
    refresh.mockReset(); api.get.mockReset(); api.post.mockReset()
    window.sessionStorage.clear()
  })
  afterEach(cleanup)

  async function mount() {
    const { ActivityBridge } = await import('./activity')
    return render(<ActivityBridge />)
  }

  it('does not sync for a guest', async () => {
    api.get.mockResolvedValue({ user: null })
    await mount()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/auth/me'))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(sync()).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('syncs once after identity is confirmed, refreshes when something changed, and not again within the interval', async () => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockResolvedValue({ synced: 2, awaited: 2, autoConfirmed: 0, more: false, derived_state: 'ready', revision: 4 })
    const first = await mount()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(sync()).toHaveLength(1)
    expect(sync()[0][1]).toBeUndefined()
    first.unmount()
    await mount() // a remount in the same session (a document navigation keeps sessionStorage)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(sync()).toHaveLength(1)
  })

  it('does not refresh the page when nothing was due', async () => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockResolvedValue({ synced: 0, awaited: 0, autoConfirmed: 0, more: false })
    await mount()
    await waitFor(() => expect(sync()).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('never lets a sync failure look like a sign-out', async () => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockRejectedValue(new Error('offline'))
    await mount()
    await waitFor(() => expect(sync()).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(refresh).not.toHaveBeenCalled()
  })
})
