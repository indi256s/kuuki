import { pageMetadata } from '../../../server/metadata'
import { getRequestLocale } from '../../../server/locale'
import { AuthCard } from '../../../client/auth-card/auth-card'

export const generateMetadata = () => pageMetadata('Get back into Kuuki', 'Вернитесь в Kuuki', { referrer: 'no-referrer' })
export default async function ForgotPassword() {
  return <AuthCard locale={await getRequestLocale()} initialStep="request" tagline={0} />
}
