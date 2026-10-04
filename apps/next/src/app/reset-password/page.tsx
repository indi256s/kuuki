import { getRequestLocale } from '../../server/locale'
import { ResetPasswordForm } from '../../client/account/reset-password-form'

export async function generateMetadata() { return { title: (await getRequestLocale()) === 'ru' ? 'Новый пароль — Kuuki' : 'New password — Kuuki', referrer: 'no-referrer' } }
export default async function ResetPassword() {
  return <ResetPasswordForm locale={await getRequestLocale()} />
}
