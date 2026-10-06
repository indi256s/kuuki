import { create } from 'zustand'
import { advanceAuthGeneration, beginIdentityOperation, setUnauthorizedHandler, type IdentityOperationToken } from '@kuuki/client/apiClient'
import { resetPrivateClientState } from '@/lib/identityReset'
import { allowedLegacyReturn } from '@/lib/legacyBridge'
import {
  type AuthUser,
  type Profile,
  getMe,
  getProfile,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  deleteAccount as authDeleteAccount,
} from '@/lib/auth'

interface AuthStore {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean
  initializationError: boolean

  // Actions
  initialize: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<{ success: boolean; error?: string }>
  deleteAccount: (password: string) => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
}

let authActionVersion = 0
let authOperationBusy = false
let pendingPeerChange = false
const busyResult = { success: false, error: 'Another account action is in progress. Please wait.' }
type AuthOutcome = { success: boolean; error?: string; publish?: () => void }

function runAuthOperation(action: (token: IdentityOperationToken, version: number) => Promise<AuthOutcome>): Promise<{ success: boolean; error?: string }> {
  if (authOperationBusy) return Promise.resolve(busyResult)
  authOperationBusy = true
  const version = ++authActionVersion
  const operation = beginIdentityOperation()
  useAuthStore.setState({ isLoading: true })
  return (async () => {
    let outcome: AuthOutcome
    try {
      await operation.ready
      outcome = await action(operation.token, version)
    } catch (error) {
      outcome = {
        success: false,
        error: error instanceof Error ? error.message : 'Account action failed',
        publish: () => useAuthStore.setState({ isLoading: false }),
      }
    } finally {
      operation.release()
      authOperationBusy = false
      if (pendingPeerChange) {
        pendingPeerChange = false
        void reconcilePeerIdentity()
      } else {
        outcome!.publish?.()
      }
      if (outcome!.success) broadcastIdentityChange()
    }
    return { success: outcome.success, ...(outcome.error ? { error: outcome.error } : {}) }
  })()
}

/** Invalidate in-flight requests and private caches from the previous cookie identity. */
function startNewIdentity(): void {
  advanceAuthGeneration()
  resetPrivateClientState()
}

/** Apply a state patch only if no newer auth action has started since `version`. */
function publishIf(version: number, patch: Partial<AuthStore>): () => void {
  return () => { if (version === authActionVersion) useAuthStore.setState(patch) }
}

type AuthCall = (token: IdentityOperationToken) => Promise<{ success: boolean; error?: string; user?: AuthUser }>

/** Sign-in/sign-up: on success, switch identity and publish the new user + profile. */
function establishIdentity(call: AuthCall): Promise<{ success: boolean; error?: string }> {
  return runAuthOperation(async (token, version) => {
    const result = await call(token)
    if (!result.success || !result.user) return { ...result, publish: publishIf(version, { isLoading: false }) }
    if (version !== authActionVersion) return result
    startNewIdentity()
    let profile: Profile | null = null
    let profileLoadFailed = false
    try {
      profile = await getProfile(result.user.id, token)
    } catch (error) {
      // Authentication succeeded even when the profile read is unavailable.
      console.error('Profile load after sign-in failed:', error)
      profileLoadFailed = true
    }
    return { ...result, publish: publishIf(version, { user: result.user, profile, isLoading: false, isInitialized: !profileLoadFailed, initializationError: profileLoadFailed }) }
  })
}

/** Sign-out/account deletion: on success, drop the identity and publish `cleared`. */
function clearIdentity(
  call: (token: IdentityOperationToken) => Promise<{ success: boolean; error?: string }>,
  cleared: Partial<AuthStore>,
): Promise<{ success: boolean; error?: string }> {
  return runAuthOperation(async (token, version) => {
    const result = await call(token)
    if (version !== authActionVersion) return result
    if (!result.success) return { ...result, publish: publishIf(version, { isLoading: false }) }
    startNewIdentity()
    const publish = publishIf(version, { user: null, profile: null, isLoading: false, ...cleared })
    return { ...result, publish: () => {
      publish?.()
      if (import.meta.env.BASE_URL === '/legacy/' && allowedLegacyReturn(new URLSearchParams(window.location.search).get('returnTo'))) {
        window.location.assign('/signin')
      }
    } }
  })
}

const tabId = Math.random().toString(36).slice(2)
const identityChannel = typeof window === 'undefined' || !('BroadcastChannel' in window)
  ? null
  : new BroadcastChannel('kuuki-identity')

function broadcastIdentityChange(): void {
  identityChannel?.postMessage({ tabId })
}

/** Keep private routes blocked until /auth/me confirms the cookie identity, then expose retry. */
function retryIdentityLookup(version: number, attempt = 0): void {
  if (attempt >= 2) {
    if (version === authActionVersion) useAuthStore.setState({ isLoading: false, initializationError: true })
    return
  }
  const delayMs = 1_000 * 2 ** attempt
  setTimeout(() => {
    if (version !== authActionVersion) return
    void getMe().then(({ user, profile }) => {
      if (version === authActionVersion) useAuthStore.setState({ user, profile, isLoading: false, isInitialized: true, initializationError: false })
    }).catch(() => {
      if (version === authActionVersion) retryIdentityLookup(version, attempt + 1)
    })
  }, delayMs)
}

async function reconcilePeerIdentity(): Promise<void> {
  const version = ++authActionVersion
  startNewIdentity()
  useAuthStore.setState({ user: null, profile: null, isLoading: true, isInitialized: false, initializationError: false })
  try {
    const { user, profile } = await getMe()
    if (version === authActionVersion) useAuthStore.setState({ user, profile, isLoading: false, isInitialized: true, initializationError: false })
  } catch {
    if (version === authActionVersion) retryIdentityLookup(version)
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  initializationError: false,

  initialize: async () => {
    if (get().isInitialized && !get().initializationError) return

    const version = authActionVersion
    set({ isLoading: true, initializationError: false })

    // A failed session refresh (inside apiClient) hard-logs-out the user.
    setUnauthorizedHandler(() => {
      authActionVersion += 1
      startNewIdentity()
      set({ user: null, profile: null, isLoading: false, isInitialized: true, initializationError: false })
    })

    try {
      // Bootstrap the session from the httpOnly cookie.
      const { user, profile } = await getMe()
      if (version !== authActionVersion) return
      set({ user, profile, isLoading: false, isInitialized: true, initializationError: false })
    } catch (error) {
      // A transport failure cannot establish that the cookie is anonymous.
      console.error('Auth initialization failed:', error)
      if (version === authActionVersion) {
        set({ user: null, profile: null, isLoading: true, isInitialized: false })
        retryIdentityLookup(version)
      }
    }
  },

  signUp: (email, password) => establishIdentity(token => authSignUp(email, password, token)),

  signIn: (email, password) => establishIdentity(token => authSignIn(email, password, token)),

  signOut: () => clearIdentity(authSignOut, {}),

  deleteAccount: password => clearIdentity(token => authDeleteAccount(password, token), { isInitialized: true }),

  refreshProfile: async () => {
    const { user } = get()
    if (user && !get().isLoading) {
      try {
        const profile = await getProfile(user.id)
        if (get().user?.id === user.id) set({ profile })
      } catch (error) {
        // Keep the last confirmed profile on a background failure.
        console.error('Profile refresh failed:', error)
        throw error
      }
    }
  },
}))

identityChannel?.addEventListener('message', event => {
  if (typeof event.data?.tabId !== 'string' || event.data.tabId === tabId) return
  if (authOperationBusy) {
    pendingPeerChange = true
    return
  }
  void reconcilePeerIdentity()
})

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user)
export const useProfile = () => useAuthStore((state) => state.profile)
