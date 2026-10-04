import { redirect } from 'next/navigation'
import { getRequestIdentity } from '../../server/identity'
import { AuthForm } from '../../client/public/auth-form'
import { getRequestLocale } from '../../server/locale'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Создать аккаунт — Kuuki' : 'Create an account — Kuuki' } }
export default async function SignUp() {
  try { if (await getRequestIdentity()) redirect('/overview') } catch (error) { if (error && typeof error === 'object' && 'digest' in error) throw error }
  return <AuthForm mode="signup" locale={await getRequestLocale()} />
}
