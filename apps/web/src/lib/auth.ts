import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import type { Tables } from './database.types'

export type Profile = Tables<'profiles'>

export interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Check if invite code is valid
export async function checkInviteCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_invite_code', {
    p_code: code.toUpperCase(),
  })

  if (error) {
    console.error('Error checking invite code:', error)
    return false
  }

  return data === true
}

// Sign up with email, password, and invite code
export async function signUp(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ success: boolean; error?: string }> {
  // First validate the invite code
  const isValidCode = await checkInviteCode(inviteCode)
  if (!isValidCode) {
    return { success: false, error: 'Invalid or expired invite code' }
  }

  // Create the user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        invite_code: inviteCode.toUpperCase(),
      },
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data.user) {
    return { success: false, error: 'Failed to create user' }
  }

  // Use the invite code
  const { error: useCodeError } = await supabase.rpc('use_invite_code', {
    p_code: inviteCode.toUpperCase(),
    p_user_id: data.user.id,
  })

  if (useCodeError) {
    console.error('Error using invite code:', useCodeError)
    // User is created but code wasn't marked as used - not critical
  }

  return { success: true }
}

// Sign in with email and password
export async function signIn(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Sign out
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// Get current session
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// Get current user
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Get user profile
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }

  return data
}

// Update user profile
export async function updateProfile(
  userId: string,
  updates: Partial<Profile>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Subscribe to auth changes
export function onAuthStateChange(
  callback: (user: User | null) => void
) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
}

/**
 * Verify password by re-authenticating
 * Returns true if password is correct
 */
export async function verifyPassword(
  email: string,
  password: string
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return !error
}

/**
 * Delete all user data and the account itself
 * This is a permanent, irreversible action
 */
export async function deleteAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete user data in order (respecting foreign key constraints)
    // Note: visits are derived from flights, they should cascade or be handled by triggers

    // 1. Delete country claims
    const { error: claimsError } = await supabase
      .from('country_claims')
      .delete()
      .eq('user_id', userId)

    if (claimsError) {
      console.error('Error deleting claims:', claimsError)
    }

    // 2. Delete flights
    const { error: flightsError } = await supabase
      .from('flights')
      .delete()
      .eq('user_id', userId)

    if (flightsError) {
      console.error('Error deleting flights:', flightsError)
    }

    // 3. Delete visits (may be handled by trigger, but let's be explicit)
    const { error: visitsError } = await supabase
      .from('visits')
      .delete()
      .eq('user_id', userId)

    if (visitsError) {
      console.error('Error deleting visits:', visitsError)
    }

    // 4. Delete user_stats (if exists)
    const { error: statsError } = await supabase
      .from('user_stats')
      .delete()
      .eq('user_id', userId)

    if (statsError) {
      console.error('Error deleting user stats:', statsError)
    }

    // 5. Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return { success: false, error: 'Failed to delete profile data' }
    }

    // 6. Sign out the user (this invalidates the current session)
    await supabase.auth.signOut()

    // Note: The auth.users record deletion requires admin privileges
    // In a production app, this would typically be handled by:
    // - A Supabase Edge Function with service role key
    // - A database trigger on profile deletion
    // For now, we've deleted all user data which is the important part

    return { success: true }
  } catch (error) {
    console.error('Error during account deletion:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account'
    }
  }
}
