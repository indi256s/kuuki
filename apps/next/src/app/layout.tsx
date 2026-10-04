import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { ActivityBridge } from '../client/activity'
import { AppearanceProvider } from '../client/appearance'
import { Preferences } from '../client/preferences'
import { PrimaryNav } from '../client/nav'
import { THEME_COLOR } from '../lib/theme-colors'
import { getRequestLocale } from '../server/locale'
import './styles.css'
import './public.css'

export const metadata: Metadata = { title: 'Kuuki — flight journal', description: 'Keep your journeys close.' }
export const viewport: Viewport = { themeColor: THEME_COLOR.light }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale()
  return <html lang={locale} suppressHydrationWarning><head><Script src="/bootstrap.js" strategy="beforeInteractive" /></head><body>
    <a className="skip-link" href="#main"><span className="locale-en">Skip to content</span><span className="locale-ru" lang="ru">Перейти к содержимому</span></a>
    <header className="site-header"><div className="site-header-inner">
      <Link href="/" className="wordmark" aria-label="Kuuki home"><span className="mark" aria-hidden>く</span><span>kuuki</span></Link>
      <PrimaryNav />
      <Preferences initialLocale={locale} /><Link className="header-me" href="/me"><span className="locale-en">Me</span><span className="locale-ru" lang="ru">Я</span></Link><Link className="header-settings" href="/settings"><span className="locale-en">Settings</span><span className="locale-ru" lang="ru">Настройки</span></Link><a className="header-action" href="/add"><span className="locale-en">Add flight</span><span className="locale-ru" lang="ru">Добавить перелёт</span> <span aria-hidden>↗</span></a>
    </div></header>
    <main id="main" className="page-shell">{children}</main>
    <AppearanceProvider /><ActivityBridge />
  </body></html>
}
