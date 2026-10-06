import { EmailLinkForm } from '../../../../client/public/email-link-form'
import { getRequestLocale } from '../../../../server/locale'
import { pageMetadata } from '../../../../server/metadata'

export const generateMetadata = () => pageMetadata('Activate your account', 'Активировать аккаунт', { referrer: 'no-referrer' })
export default async function ActivationRequest({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const [{ email }, locale] = await Promise.all([searchParams, getRequestLocale()])
  return <EmailLinkForm locale={locale} purpose="activation" initialEmail={email ?? ''} />
}
