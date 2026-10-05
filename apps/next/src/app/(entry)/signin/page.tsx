import { redirect } from 'next/navigation'
import { getMemberLanding } from '../../../server/gates'
import { pageMetadata } from '../../../server/metadata'
import { AuthForm } from '../../../client/public/auth-form'
import { getRequestLocale } from '../../../server/locale'

export const generateMetadata = () => pageMetadata('Sign in', 'Войти')
export default async function SignIn({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const landing = await getMemberLanding()
  if (landing) redirect(landing)
  const [{ email }, locale] = await Promise.all([searchParams, getRequestLocale()])
  return <AuthForm mode="signin" locale={locale} initialEmail={email ?? ''} />
}
