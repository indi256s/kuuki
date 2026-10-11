import { redirect } from 'next/navigation'
import { getMemberLanding } from '../../../server/gates'

/** Old `/onboarding` and `/onboarding?step=*` links: the card's resume step, the Overview once onboarded. */
export default async function Onboarding() {
  redirect((await getMemberLanding()) ?? '/signin')
}
