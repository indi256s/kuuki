import type { ReactNode } from 'react'
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'
import { formatCount, formatDistanceKm, type Locale } from '../../lib/format'
import { journalHref } from '../../lib/url-state'
import { S, fill, forms, t } from './copy'
import type { OverviewLabels } from './labels'

const route = (origin: string, destination: string) => `${origin} → ${destination}`

/** Text-first rows: only facts the period has. Each route row opens the Journal on that exact route and year. */
export function OverviewNotable({ summary, locale, labels }: { summary: OverviewSummary; locale: Locale; labels: OverviewLabels }) {
  const { insights, period } = summary
  const year = period === 'all' ? undefined : period
  const rows: Array<{ key: string; term: string; body: ReactNode }> = []
  if (insights.longestFlight) {
    const { origin, destination, distanceKm } = insights.longestFlight
    rows.push({ key: 'longest', term: t(S.longest, locale), body: <a href={journalHref({ origin, destination, year, status: 'completed' })}>{route(origin, destination)} · {formatDistanceKm(locale, distanceKm)}</a> })
  }
  if (insights.mostFrequentRoute) {
    const { origin, destination, count } = insights.mostFrequentRoute
    rows.push({ key: 'frequent', term: t(S.frequent, locale), body: <a href={journalHref({ origin, destination, year, status: 'completed' })}>{route(origin, destination)} · {formatCount(locale, count, forms.flights)}</a> })
  }
  if (insights.newCountries && insights.newCountries.count > 0) {
    const { items, count } = insights.newCountries
    const names = items.map(item => item.pending ? `${labels.country(item.id)} (${t(S.newWaiting, locale)})` : labels.country(item.id)).join(', ')
    rows.push({ key: 'new', term: fill(t(S.newCountries, locale), { year: period }), body: <>{names}{count > items.length ? `, ${fill(t(S.moreCountries, locale), { count: count - items.length })}` : ''}</> })
  }
  if (insights.favoriteAirline) {
    const { id, count } = insights.favoriteAirline
    rows.push({ key: 'airline', term: t(S.favoriteAirline, locale), body: <a href={journalHref({ airline: id, year, status: 'completed' })}>{labels.airline(id)} · {formatCount(locale, count, forms.flights)}</a> })
  }
  return <section className="read-section" aria-labelledby="ov-notable-title">
    <h2 id="ov-notable-title">{t(S.notable, locale)}</h2>
    {rows.length ? <dl className="insight-list">{rows.map(row => <div key={row.key}><dt>{row.term}</dt><dd>{row.body}</dd></div>)}</dl> : <p className="muted">{t(S.noInsights, locale)}</p>}
  </section>
}
