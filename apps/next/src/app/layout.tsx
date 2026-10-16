import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { ActivityBridge } from '../client/activity'
import { AppearanceProvider } from '../client/appearance'
import { FaviconSync } from '../client/favicon-sync'
import { Kuukies } from '../client/kuukies'
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
  appleWebApp: { capable: true, title: 'Kuuki', statusBarStyle: 'default' },
}
export const viewport: Viewport = { themeColor: THEME_COLOR.light, viewportFit: 'cover' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* oxlint-disable-next-line next/no-sync-scripts -- it must block: App Router loads next/script's
            beforeInteractive files after the first paint, so the page flashed light before the saved theme applied. */}
        <script src="/bootstrap.js" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          <span className="locale-en">Skip to content</span>
          <span className="locale-ru" lang="ru">
            Перейти к содержимому
          </span>
        </a>
        <RouteTransitions>{children}</RouteTransitions>
        {/* Outside the route stage: a transformed ancestor would pin these to it instead of the viewport. */}
        <div className="edge-top" aria-hidden="true" />
        <div className="edge-bottom" aria-hidden="true" />
        <Suspense fallback={null}>
          <RouteFocus />
        </Suspense>
        <AppearanceProvider />
        <FaviconSync />
        <ActivityBridge />
        <Kuukies />
      </body>
    </html>
  )
}
