'use client'

import { Windsock } from './loading/windsock'
import { useLocale } from './preferences'
import { Skeleton } from './ui/skeleton'

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

export function OverviewLoadingScreen({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  const label = locale === 'ru' ? 'Загрузка обзора…' : 'Loading overview…'
  return (
    <div className="ov3-page" lang={locale}>
      <Skeleton height={36} label={label} />
      <Skeleton height={436} label={label} />
      <Skeleton height={240} label={label} />
    </div>
  )
}
