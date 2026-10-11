import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getOwnProfile } from './profile'
import { getWelcomeResume, welcomePath } from './welcome'

/** One own-profile read per request, shared by every gate on the page. */
export const getGateProfile = cache(getOwnProfile)

/** The unfinished member's resume URL, read once per request. */
const resumePath = cache(async (userId: string, displayName: string | null) => {
  const resume = await getWelcomeResume(userId, { display_name: displayName })
  return welcomePath(resume.step, resume.batch)
})

/** Member pages: guests go to sign-in; a member who hasn't finished onboarding resumes the card first. */
export async function requireOnboardedMember() {
  const own = await getGateProfile()
  if (!own) redirect('/signin')
  if (!own.profile.onboarded_at) redirect(await resumePath(own.ownerId, own.profile.display_name))
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
  return own.profile.onboarded_at ? '/overview' : resumePath(own.ownerId, own.profile.display_name)
}
