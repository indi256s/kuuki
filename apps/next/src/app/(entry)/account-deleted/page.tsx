import { LocaleText } from '../../../client/locale-text'
import Link from 'next/link'
import { AuthShell } from '../../../client/public/auth-shell'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'

export const generateMetadata = () => pageMetadata('Account deleted', 'Аккаунт удалён')
export default async function AccountDeleted() {
  const locale = await getRequestLocale()
  return (
    <AuthShell
      locale={locale}
      title={<LocaleText locale={locale} en="Account deleted" ru="Аккаунт удалён" />}
    >
      <p role="status" className="auth-success">
        <LocaleText
          locale={locale}
          en="Your account data has been deleted and all sessions have ended."
          ru="Данные аккаунта удалены, все сеансы завершены."
        />
      </p>
      <div className="auth-links">
        <Link href="/">
          <LocaleText locale={locale} en="Return to home" ru="На главную" />
        </Link>
      </div>
    </AuthShell>
  )
}
