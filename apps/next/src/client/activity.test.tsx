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
    window.localStorage.clear()
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
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(sync()).toHaveLength(1)
    expect(sync()[0][1]).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('kuuki:lifecycle-sync:u1')).not.toBeNull()
    window.removeEventListener('kuuki:lifecycle-changed', changed)
    first.unmount()
    await mount() // a remount or another tab: the shared localStorage timestamp holds the throttle
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(sync()).toHaveLength(1)
  })

  it('does not refresh the page when nothing was due', async () => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockResolvedValue({ synced: 0, awaited: 0, autoConfirmed: 0, more: false })
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    await mount()
    await waitFor(() => expect(sync()).toHaveLength(1))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(refresh).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    window.removeEventListener('kuuki:lifecycle-changed', changed)
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

it("clears the departing owner's capture recents and disclosure preferences when signing out", async () => {
  const { beginIdentityOperation } = await import('../../../web/src/lib/apiClient')
  vi.mocked(beginIdentityOperation).mockReturnValue({ ready: Promise.resolve(), token: Symbol(), release: vi.fn() } as never)
  // The departing cookie owner is resolved under the account lock before the mutation runs.
  api.get.mockResolvedValueOnce({ user: { id: 'a' } })
  const { writeCapturePreference, readCapturePreference } = await import('./capture/capture-preferences')
  const { withIdentityMutation } = await import('./activity')
  writeCapturePreference('a', 'airports', ['TBS'])
  writeCapturePreference('a', 'details', true)
  writeCapturePreference('b', 'airports', ['IST'])
  sessionStorage.setItem('unrelated', 'keep')
  // jsdom reports document navigation as unimplemented; the cleanup precedes it.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  try { await withIdentityMutation(async () => undefined, '/signin') } finally { consoleError.mockRestore() }
  expect(readCapturePreference('a', 'airports', [])).toEqual([])
  expect(readCapturePreference('a', 'details', false)).toBe(false)
  expect(readCapturePreference('b', 'airports', [])).toEqual(['IST'])
  expect(sessionStorage.getItem('unrelated')).toBe('keep')
})
