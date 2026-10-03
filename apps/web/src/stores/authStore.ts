import { create } from 'zustand'
import { advanceAuthGeneration, beginIdentityOperation, setUnauthorizedHandler, type IdentityOperationToken } from '@/lib/apiClient'
import { resetPrivateClientState } from '@/lib/identityReset'
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
    const profile = await getProfile(result.user.id, token)
    return { ...result, publish: publishIf(version, { user: result.user, profile, isLoading: false, isInitialized: true }) }
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
    return { ...result, publish: publishIf(version, { user: null, profile: null, isLoading: false, ...cleared }) }
  })
}

const tabId = Math.random().toString(36).slice(2)
const identityChannel = typeof window === 'undefined' || !('BroadcastChannel' in window)
  ? null
  : new BroadcastChannel('kuuki-identity')

function broadcastIdentityChange(): void {
  identityChannel?.postMessage({ tabId })
}

/** Keep private routes blocked until /auth/me confirms the current cookie identity. */
function retryIdentityLookup(version: number, delayMs = 1_000): void {
  setTimeout(() => {
    if (version !== authActionVersion) return
    void getMe().then(({ user, profile }) => {
      if (version === authActionVersion) useAuthStore.setState({ user, profile, isLoading: false, isInitialized: true })
    }).catch(() => {
      if (version === authActionVersion) retryIdentityLookup(version, Math.min(delayMs * 2, 15_000))
    })
  }, delayMs)
}

async function reconcilePeerIdentity(): Promise<void> {
  const version = ++authActionVersion
  startNewIdentity()
  useAuthStore.setState({ user: null, profile: null, isLoading: true })
  try {
    const { user, profile } = await getMe()
    if (version === authActionVersion) useAuthStore.setState({ user, profile, isLoading: false, isInitialized: true })
  } catch {
    if (version === authActionVersion) retryIdentityLookup(version)
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return

    const version = authActionVersion
    set({ isLoading: true })

    // A failed session refresh (inside apiClient) hard-logs-out the user.
    setUnauthorizedHandler(() => {
      authActionVersion += 1
      startNewIdentity()
      set({ user: null, profile: null, isLoading: false, isInitialized: true })
    })

    try {
      // Bootstrap the session from the httpOnly cookie.
      const { user, profile } = await getMe()
      if (version !== authActionVersion) return
      set({ user, profile, isLoading: false, isInitialized: true })
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
      const profile = await getProfile(user.id)
      if (get().user?.id === user.id) set({ profile })
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
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user)
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
