'use client'

import { Windsock } from './loading/windsock'
import { useLocale } from './preferences'

import type { Locale } from '../lib/format'

/** Route loading state: the windsock filling as the wind builds (空気, air), and a localized status line. */
export function LoadingScreen({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  return (
    <div className="loading-screen" role="status">
      <Windsock />
      <p>{locale === 'ru' ? 'Ждём попутного ветра…' : 'Waiting for a tailwind…'}</p>
    </div>
  )
}
