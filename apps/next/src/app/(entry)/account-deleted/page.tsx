import { LocaleText } from '../../../client/locale-text'
import Link from 'next/link'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import '../../../client/ui/ui.css'

export const generateMetadata = () => pageMetadata('Account deleted', 'Аккаунт удалён')
export default async function AccountDeleted() {
  const locale = await getRequestLocale()
  return (
    <section className="edge-card">
      <div className="edge-heading">
        <h1>
          <LocaleText locale={locale} en="Account deleted" ru="Аккаунт удалён" />
        </h1>
        <p role="status">
          <LocaleText
            locale={locale}
            en="Your account data has been deleted and all sessions have ended."
            ru="Данные аккаунта удалены, все сеансы завершены."
          />
        </p>
      </div>
      <Link className="ui-button" data-variant="primary" href="/">
        <LocaleText locale={locale} en="Return to home" ru="На главную" />
      </Link>
    </section>
  )
}
