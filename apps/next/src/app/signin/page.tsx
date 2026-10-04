import { redirect } from 'next/navigation'
import { getRequestIdentity } from '../../server/identity'
import { AuthForm } from '../../client/public/auth-form'
import { getRequestLocale } from '../../server/locale'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Войти — Kuuki' : 'Sign in — Kuuki' } }
export default async function SignIn({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  try { if (await getRequestIdentity()) redirect('/overview') } catch (error) { if (error && typeof error === 'object' && 'digest' in error) throw error }
  const [{ email }, locale] = await Promise.all([searchParams, getRequestLocale()])
  return <AuthForm mode="signin" locale={locale} initialEmail={email ?? ''} />
}
