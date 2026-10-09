import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { ActivityBridge } from '../client/activity'
import { AppearanceProvider } from '../client/appearance'
import { RouteFocus } from '../client/route-focus'
import { RouteTransitions } from '../client/route-transitions'
import { THEME_COLOR } from '../lib/theme-colors'
import { getRequestLocale } from '../server/locale'
import './styles.css'
import './public.css'
import './shell.css'

export const metadata: Metadata = {
  title: 'Kuuki — flight journal',
  description: 'Keep your journeys close.',
}
export const viewport: Viewport = { themeColor: THEME_COLOR.light }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <Script src="/bootstrap.js" strategy="beforeInteractive" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          <span className="locale-en">Skip to content</span>
          <span className="locale-ru" lang="ru">
            Перейти к содержимому
          </span>
        </a>
        <RouteTransitions>{children}</RouteTransitions>
        <Suspense fallback={null}>
          <RouteFocus />
        </Suspense>
        <AppearanceProvider />
        <ActivityBridge />
      </body>
    </html>
  )
}
