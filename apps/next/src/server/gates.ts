import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getRequestEnv } from './identity'
import { getOwnProfile } from './profile'

export const ONBOARDING_NAME_PATH = '/onboarding?step=name'

/** One own-profile read per request, shared by every gate on the page. */
export const getGateProfile = cache(getOwnProfile)

/** Member pages: guests go to sign-in; a member without a username finishes onboarding first. */
export async function requireOnboardedMember() {
  const own = await getGateProfile()
  if (!own) redirect('/signin')
  if (!own.profile.username) redirect(ONBOARDING_NAME_PATH)
  return own
}

/** Entry pages (`/`, `/signin`, `/signup`): where a confirmed member belongs, or null for a guest. */
export async function getMemberLanding(): Promise<string | null> {
  let own
  try {
    own = await getGateProfile()
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    return null
  }
  if (!own) return null
  return own.profile.username ? '/overview' : ONBOARDING_NAME_PATH
}

/** A saved flight (not derived stats) is what earns the Reveal step. */
export async function hasSavedFlight(userId: string): Promise<boolean> {
  const env = await getRequestEnv()
  return !!(await env.DB.prepare('SELECT 1 AS present FROM flights WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first())
}
