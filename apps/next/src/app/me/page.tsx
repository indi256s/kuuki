import { redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../server/gates'

/** The viewer's own profile; a member without an address yet sets one in Settings. */
export default async function Me() {
  const own = await requireOnboardedMember()
  redirect(own.profile.username ? `/fly/${encodeURIComponent(own.profile.username)}` : '/settings')
}
