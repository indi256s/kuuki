import { api, ApiError } from './apiClient'
import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>

/** The minimal authenticated-user shape returned by the cookie-session API. */
export interface AuthUser {
  id: string
  email: string
}

export interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Sign up with email and password (open registration — no invite code).
export async function signUp(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  try {
    const data = await api.post<{ user: AuthUser; profile: Profile | null }>('/api/auth/signup', {
      email,
      password,
    })
    return { success: true, user: data.user }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to create account' }
  }
}

// Sign in with email and password
export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  try {
    const data = await api.post<{ user: AuthUser; profile: Profile | null }>('/api/auth/signin', {
      email,
      password,
    })
    return { success: true, user: data.user }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to sign in' }
  }
}

// Sign out
export async function signOut(): Promise<void> {
  try {
    await api.post('/api/auth/signout')
  } catch (error) {
    console.error('Error signing out:', error)
  }
}

// Bootstrap the current session from the httpOnly cookie. Replaces getSession()/getUser().
export async function getMe(): Promise<{ user: AuthUser | null; profile: Profile | null }> {
  try {
    return await api.get<{ user: AuthUser | null; profile: Profile | null }>('/api/auth/me')
  } catch (error) {
    console.error('Error fetching current user:', error)
    return { user: null, profile: null }
  }
}

// Get user profile
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    return await api.get<Profile>(`/api/profiles/${userId}`)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return null
  }
}

// Update user profile (the API resolves the user from the session; userId kept for signature compatibility).
export async function updateProfile(
  _userId: string,
  updates: Partial<Profile>
): Promise<{ success: boolean; error?: string }> {
  try {
    await api.patch<Profile>('/api/profiles/me', updates)
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to update profile' }
  }
}

/**
 * Verify the logged-in user's password (re-authentication gate).
 * Returns true if the password is correct.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    await api.post('/api/auth/verify-password', { password })
    return true
  } catch {
    return false
  }
}

/**
 * Delete the authenticated user's account and all of its data.
 * This is a permanent, irreversible action.
 */
export async function deleteAccount(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    await api.delete('/api/auth/account', { password })
    return { success: true }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to delete account' }
  }
}
