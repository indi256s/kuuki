import { redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../server/gates'

/** The viewer's own profile is their Passport; a member without an address yet still gets the page. */
export default async function Me() {
  await requireOnboardedMember()
  redirect('/passport')
}
