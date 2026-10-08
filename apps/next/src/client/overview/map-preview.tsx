'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { OverviewPeriod } from '@kuuki/shared/overview'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { CountryPreview, previewArcPath, type CountryVisit } from '../maps/preview'
import { useRouteProjection } from '../maps/projection'
import { S, fill, forms, t } from './copy'

type Props = {
  /** Absent for the inert first-run sample: it never reads the member's routes. */
  ownerId?: string
  locale: Locale
  period: OverviewPeriod
  revision: number
  publishedRevision: number
  /** The summary's `map.routeCount`; the projection must report the same number before any arc is drawn. */
  routeCount: number
  countryIds: string[]
  visits: CountryVisit[]
}

/**
 * The country preview plus the period's route arcs from the same projection the Passport map reads. Countries render
 * first and stay whenever routes are loading, stale or unavailable; only a ready projection that matches the summary
 * (stamps and route count) draws arcs.
 */
export function OverviewMapPreview({ ownerId, locale, period, revision, publishedRevision, routeCount, countryIds, visits }: Props) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])
  const { loaded, current, mismatched, failed } = useRouteProjection({
    ownerId: ownerId ?? '', period, revision, publishedRevision, enabled: !!ownerId && routeCount > 0, onStale: refresh,
  })
  const agreed = current && current.routeCount === routeCount ? current : null
  const unavailable = failed || (!mismatched && loaded?.derivedState === 'error')
  const updating = !unavailable && !!loaded && !agreed
  const routes = useMemo(() => agreed?.pairs.map(pair => ({ a: pair.a, b: pair.b, d: previewArcPath(pair) })), [agreed])
  const unplaced = routes?.filter(route => !route.d).length ?? 0
  return <>
    <CountryPreview countryIds={countryIds} visits={visits} locale={locale} period={period} routes={routes} />
    {unavailable ? <p role="status" className="status-note">{t(S.routesUnavailable, locale)}</p>
      : updating ? <p role="status" className="status-note">{t(S.routesUpdating, locale)}</p> : null}
    {agreed?.truncated ? <p className="muted">{fill(formatCount(locale, agreed.routeCount, forms.routesShown), { shown: formatNumber(locale, agreed.pairs.length) })}</p> : null}
    {unplaced ? <p className="muted">{formatCount(locale, unplaced, forms.unplaced)}</p> : null}
  </>
}
