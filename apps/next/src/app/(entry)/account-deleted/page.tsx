import Link from 'next/link'
import { AuthShell } from '../../../client/public/auth-shell'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'

export const generateMetadata = () => pageMetadata('Account deleted', 'Аккаунт удалён')
export default async function AccountDeleted() {
  const locale = await getRequestLocale()
  const ru = locale === 'ru'
  return <AuthShell locale={locale} title={ru ? 'Аккаунт удалён' : 'Account deleted'}><p role="status" className="auth-success">{ru ? 'Данные аккаунта удалены, все сеансы завершены.' : 'Your account data has been deleted and all sessions have ended.'}</p><div className="auth-links"><Link href="/">{ru ? 'На главную' : 'Return to home'}</Link></div></AuthShell>
}
