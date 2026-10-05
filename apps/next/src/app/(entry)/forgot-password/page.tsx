import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { ForgotPasswordForm } from '../../../client/account/forgot-password-form'

export const generateMetadata = () => pageMetadata('Reset password', 'Восстановить пароль', { referrer: 'no-referrer' })
export default async function ForgotPassword() {
  return <ForgotPasswordForm locale={await getRequestLocale()} />
}
