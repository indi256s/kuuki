import Link from 'next/link'
import type { ReactNode } from 'react'
import { Preferences } from './preferences'
import { PrimaryNav } from './nav'
import type { Locale } from '../server/locale'

function Wordmark({ label = 'Kuuki home' }: { label?: string }) {
  return <Link href="/" className="wordmark" aria-label={label}><span className="mark" aria-hidden>く</span><span>kuuki</span></Link>
}
function Main({ children }: { children: ReactNode }) { return <main id="main" className="page-shell">{children}</main> }

/** Current member header, moved verbatim out of the root layout. T06 rebuilds it. */
export function MemberShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <>
    <header className="site-header"><div className="site-header-inner">
      <Wordmark />
      <PrimaryNav />
      <Preferences initialLocale={locale} /><Link className="header-me" href="/me"><span className="locale-en">Me</span><span className="locale-ru" lang="ru">Я</span></Link><Link className="header-settings" href="/settings"><span className="locale-en">Settings</span><span className="locale-ru" lang="ru">Настройки</span></Link><a className="header-action" href="/add"><span className="locale-en">Add flight</span><span className="locale-ru" lang="ru">Добавить перелёт</span> <span aria-hidden>↗</span></a>
    </div></header>
    <Main>{children}</Main>
  </>
}

/** Wordmark and preferences only; no member navigation. `actions` adds guest links. */
export function BrandShell({ locale, actions, children }: { locale: Locale; actions?: boolean; children: ReactNode }) {
  const ru = locale === 'ru'
  return <>
    <header className="site-header"><div className="site-header-inner">
      <Wordmark />
      <div className="guest-actions">
        {actions && <nav aria-label={ru ? 'Аккаунт' : 'Account'}><Link href="/signin">{ru ? 'Войти' : 'Sign in'}</Link><Link href="/signup">{ru ? 'Создать аккаунт' : 'Sign up'}</Link></nav>}
        <Preferences initialLocale={locale} />
      </div>
    </div></header>
    <Main>{children}</Main>
  </>
}

export { Main }
