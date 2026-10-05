import { redirect } from 'next/navigation'
import { getMemberLanding } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { AuthForm } from '../../../client/public/auth-form'
import { getRequestLocale } from '../../../server/locale'

export const generateMetadata = () => pageMetadata('Create an account', 'Создать аккаунт')
export default async function SignUp() {
  const landing = await getMemberLanding()
  if (landing) redirect(landing)
  return <AuthForm mode="signup" locale={await getRequestLocale()} />
}
