import { redirect } from 'next/navigation'
import { getOwnProfile } from '../../server/profile'

export default async function Me() {
  const own = await getOwnProfile()
  if (!own) redirect('/signin')
  redirect(own.profile.username ? `/fly/${encodeURIComponent(own.profile.username)}` : '/onboarding')
}
