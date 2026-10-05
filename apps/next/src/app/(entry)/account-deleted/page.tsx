import Link from 'next/link'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'

export const generateMetadata = () => pageMetadata('Account deleted', 'Аккаунт удалён')
export default async function AccountDeleted() {
  const ru = await getRequestLocale() === 'ru'
  return <section className="auth-page"><h1>{ru ? 'Аккаунт удалён' : 'Account deleted'}</h1><p>{ru ? 'Данные аккаунта удалены, все сеансы завершены.' : 'Your account data has been deleted and all sessions have ended.'}</p><Link href="/">{ru ? 'На главную' : 'Return to home'}</Link></section>
}
