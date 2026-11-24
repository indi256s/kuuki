'use client'

import { Windsock } from './loading/windsock'
import { useLocale } from './preferences'

import type { Locale } from '../lib/format'

export function LoadingScreen({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  return (
    <div className="loading-screen" role="status">
      <Windsock />
      <p>{locale === 'ru' ? 'Ждём попутного ветра…' : 'Waiting for a tailwind…'}</p>
    </div>
  )
}
