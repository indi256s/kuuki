// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
const api = { get: vi.fn(), post: vi.fn() }
const awaitPublication = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@kuuki/client/apiClient', () => ({
  api, beginIdentityOperation: vi.fn(), getAuthGeneration: () => 1,
}))
vi.mock('./publication', () => ({ awaitPublication }))

const sync = () => api.post.mock.calls.filter(call => call[0] === '/api/flights/sync-upcoming')

describe('ActivityBridge owner sync', () => {
  beforeEach(async () => {
    vi.resetModules()
    refresh.mockReset(); api.get.mockReset(); api.post.mockReset(); awaitPublication.mockReset()
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

  it.each(['pending', 'error'] as const)('shows committed lifecycle changes when derived publication is %s', async derivedState => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockResolvedValue({ synced: 1, awaited: 1, autoConfirmed: 0, more: false, derived_state: derivedState, revision: 4 })
    awaitPublication.mockResolvedValue('delayed')
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    try {
      await mount()
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      expect(changed).toHaveBeenCalledTimes(1)
    } finally { window.removeEventListener('kuuki:lifecycle-changed', changed) }
  })

  it('refreshes derived results after publication without announcing the canonical change twice', async () => {
    api.get.mockResolvedValue({ user: { id: 'u1' } })
    api.post.mockResolvedValue({ synced: 1, awaited: 1, autoConfirmed: 0, more: false, derived_state: 'pending', revision: 4 })
    let published!: (result: 'ready') => void
    awaitPublication.mockImplementationOnce(() => new Promise(resolve => { published = resolve }))
    const changed = vi.fn()
    window.addEventListener('kuuki:lifecycle-changed', changed)
    try {
      await mount()
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      expect(changed).toHaveBeenCalledTimes(1)
      await act(async () => { published('ready') })
      expect(refresh).toHaveBeenCalledTimes(2)
      expect(changed).toHaveBeenCalledTimes(1)
    } finally { window.removeEventListener('kuuki:lifecycle-changed', changed) }
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
  const { beginIdentityOperation } = await import('@kuuki/client/apiClient')
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

it('accepts only the explicit saved-password query when navigating after an identity mutation', async () => {
  const { beginIdentityOperation } = await import('@kuuki/client/apiClient')
  vi.mocked(beginIdentityOperation).mockReturnValue({ ready: Promise.resolve(), token: Symbol(), release: vi.fn() } as never)
  api.get.mockResolvedValue({ user: null })
  const { withIdentityMutation } = await import('./activity')
  const run = vi.fn(async () => ({ ok: true }))
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(withIdentityMutation(run, '/?notice=password-saved')).resolves.toEqual({ ok: true })
    for (const target of ['/?notice=unknown', '/?notice=password-saved&token=secret', '//example.test/']) {
      await expect(withIdentityMutation(run, target)).rejects.toThrow('Invalid identity navigation target')
    }
  } finally { consoleError.mockRestore() }
  expect(run).toHaveBeenCalledOnce()
})
