import { getRequestLocale } from '../../server/locale'
import { ForgotPasswordForm } from '../../client/account/forgot-password-form'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Восстановить пароль — Kuuki' : 'Reset password — Kuuki', referrer: 'no-referrer' } }
export default async function ForgotPassword() {
  return <ForgotPasswordForm locale={await getRequestLocale()} />
}
