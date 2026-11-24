import { redirect } from 'next/navigation'
import { getMemberLanding } from '../../../server/gates'

export default async function Onboarding() {
  redirect((await getMemberLanding()) ?? '/signin')
}
