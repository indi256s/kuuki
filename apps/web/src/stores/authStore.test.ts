import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthStore } from './authStore'
import { signIn, signOut, deleteAccount, getProfile, getMe } from '@/lib/auth'
import { getFlightCreateOperation, pendingFlightCreateOperation, clearFlightCreateOperations } from '@/lib/flightCreateOperations'
import { api } from '@/lib/apiClient'

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), deleteAccount: vi.fn(), getMe: vi.fn(), getProfile: vi.fn(),
}))

describe('cookie identity changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    clearFlightCreateOperations()
    useAuthStore.setState({
      user: { id: 'a', email: 'a@example.com' }, profile: null,
      isLoading: false, isInitialized: true,
    })
  })

  it('keeps the old identity and its data when signout fails', async () => {
    queryClient.setQueryData(queryKeys.flights('a'), [{ id: 'private-a' }])
    vi.mocked(signOut).mockResolvedValue({ success: false, error: 'Server unavailable' })

    const result = await useAuthStore.getState().signOut()

    expect(result).toEqual({ success: false, error: 'Server unavailable' })
    expect(useAuthStore.getState().user?.id).toBe('a')
    expect(queryClient.getQueryData(queryKeys.flights('a'))).toEqual([{ id: 'private-a' }])
  })

  it('removes the previous user cache on confirmed switch', async () => {
    const receipt = getFlightCreateOperation('a', 'manual', { date: '2026-01-01' })
    queryClient.setQueryData(queryKeys.flights('a'), [{ id: 'private-a' }])
    vi.mocked(signIn).mockResolvedValue({ success: true, user: { id: 'b', email: 'b@example.com' } })
    vi.mocked(getProfile).mockResolvedValue(null)

    await useAuthStore.getState().signIn('b@example.com', 'password')

    expect(useAuthStore.getState().user?.id).toBe('b')
    expect(queryClient.getQueryData(queryKeys.flights('a'))).toBeUndefined()
    expect(pendingFlightCreateOperation('a', 'manual')).toMatchObject({ key: receipt.key, body: { date: '2026-01-01' } })
    expect(pendingFlightCreateOperation('b', 'manual')).toBeNull()
  })

  it('clears identity and private data only after account deletion succeeds', async () => {
    queryClient.setQueryData(queryKeys.flights('a'), [{ id: 'private-a' }])
    vi.mocked(deleteAccount).mockResolvedValueOnce({ success: false, error: 'Wrong password' })
    await expect(useAuthStore.getState().deleteAccount('wrong')).resolves.toEqual({ success: false, error: 'Wrong password' })
    expect(useAuthStore.getState().user?.id).toBe('a')
    expect(queryClient.getQueryData(queryKeys.flights('a'))).toEqual([{ id: 'private-a' }])

    vi.mocked(deleteAccount).mockResolvedValueOnce({ success: true })
    await expect(useAuthStore.getState().deleteAccount('correct')).resolves.toEqual({ success: true })
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryData(queryKeys.flights('a'))).toBeUndefined()
  })

  it('admits only one cookie identity mutation until its response settles', async () => {
    let finishFirst: ((result: { success: boolean; user: { id: string; email: string } }) => void) | undefined
    vi.mocked(signIn).mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve }))
    vi.mocked(getProfile).mockResolvedValue(null)

    const first = useAuthStore.getState().signIn('first@example.com', 'password')
    const second = await useAuthStore.getState().signIn('second@example.com', 'password')
    const signout = await useAuthStore.getState().signOut()
    const deletion = await useAuthStore.getState().deleteAccount('password')

    expect(second).toMatchObject({ success: false })
    expect(signout).toMatchObject({ success: false })
    expect(deletion).toMatchObject({ success: false })
    await vi.waitFor(() => expect(signIn).toHaveBeenCalledTimes(1))
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(signOut).not.toHaveBeenCalled()
    expect(deleteAccount).not.toHaveBeenCalled()
    finishFirst?.({ success: true, user: { id: 'first', email: 'first@example.com' } })
    await first
    expect(useAuthStore.getState().user?.id).toBe('first')
  })

  it('publishes the new user only after ordinary requests can pass the account lock', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(signIn).mockResolvedValue({ success: true, user: { id: 'b', email: 'b@example.com' } })
    vi.mocked(getProfile).mockResolvedValue(null)
    let visibleRead: Promise<unknown> | undefined
    const unsubscribe = useAuthStore.subscribe(state => {
      if (state.user?.id === 'b' && !state.isLoading) visibleRead = api.get('/api/visible-after-signin')
    })
    try {
      await useAuthStore.getState().signIn('b@example.com', 'password')
      await expect(visibleRead).resolves.toEqual({ ok: true })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
      vi.unstubAllGlobals()
    }
  })

  it('keeps routes blocked and retries when session lookup has a transport error', async () => {
    vi.useFakeTimers()
    try {
      useAuthStore.setState({ user: null, profile: null, isInitialized: false, isLoading: true })
      vi.mocked(getMe)
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ user: { id: 'a', email: 'a@example.com' }, profile: null })
      await useAuthStore.getState().initialize()
      expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: true, isInitialized: false })
      await vi.advanceTimersByTimeAsync(1_000)
      expect(useAuthStore.getState()).toMatchObject({ user: { id: 'a' }, isLoading: false, isInitialized: true })
    } finally {
      vi.useRealTimers()
    }
  })
})
