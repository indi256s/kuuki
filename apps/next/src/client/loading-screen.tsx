'use client'

import { useLocale } from './preferences'
import { Skeleton } from './ui/skeleton'

import type { Locale } from '../lib/format'

/** Route loading state: one stable logo mark (no spinner, no motion) and a localized status line. */
export function LoadingScreen({ locale: initialLocale }: { locale: Locale }) {
  const locale = useLocale(initialLocale)
  return (
    <div className="loading-screen" role="status">
      <span className="mark" aria-hidden>
        空
      </span>
      <p>{locale === 'ru' ? 'Загрузка…' : 'Loading…'}</p>
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
