import Link from 'next/link'
import { AuthShell } from '../../../client/public/auth-shell'
import { getRequestLocale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'

export const generateMetadata = () => pageMetadata('Password updated', 'Пароль обновлён', { referrer: 'no-referrer' })
export default async function PasswordUpdated() {
  const locale = await getRequestLocale()
  const ru = locale === 'ru'
  return <AuthShell locale={locale} title={ru ? 'Пароль обновлён' : 'Password updated'}>
    <p role="status" className="auth-success">{ru ? 'Войдите с новым паролем. Остальные сеансы завершены.' : 'Sign in with your new password. Other sessions have been signed out.'}</p>
    <div className="auth-links"><Link href="/signin">{ru ? 'Войти' : 'Sign in'}</Link></div>
  </AuthShell>
}
