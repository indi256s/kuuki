import { redirect } from 'next/navigation'
import { requireOnboardedMember } from '../../server/gates'

export default async function Me() {
  await requireOnboardedMember()
  redirect('/passport')
}
