import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { EmailLinkForm } from '../../../client/public/email-link-form'

export const generateMetadata = () => pageMetadata('Reset password', 'Восстановить пароль', { referrer: 'no-referrer' })
export default async function ForgotPassword() {
  return <EmailLinkForm locale={await getRequestLocale()} purpose="recovery" />
}
