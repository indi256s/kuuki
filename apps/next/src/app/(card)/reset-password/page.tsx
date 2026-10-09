import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { ResetPasswordForm } from '../../../client/account/reset-password-form'

export const generateMetadata = () =>
  pageMetadata('Choose a new password', 'Выберите новый пароль', { referrer: 'no-referrer' })
export default async function ResetPassword() {
  return <ResetPasswordForm locale={await getRequestLocale()} />
}
