import { Fragment } from 'react'
import type { OverviewSummary } from '../../../../../packages/shared/src/overview'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { journalHref, type JournalLink } from '../../lib/url-state'
import { S, forms, t } from './copy'
import type { OverviewLabels } from './labels'
import { rankingShape, sentenceLead, type RankingKind, type RankingRow } from './model'

function Ranking({ kind, title, rows, flights, locale, allHref }: { kind: RankingKind; title: string; rows: RankingRow[]; flights: number; locale: Locale; allHref: string }) {
  const shape = rankingShape(rows, flights, kind)
  return <section className="read-panel ov-ranking" aria-label={title}>
    <div className="section-heading"><h3>{title}</h3>{shape.kind === 'empty' ? null : <a className="text-link" href={allHref}>{t(S.all_, locale)}<span className="sr-only"> · {title}</span></a>}</div>
    {shape.kind === 'empty' ? <p className="muted">{t(S.noRanking, locale)}</p>
      : shape.kind === 'sentence' ? <p className="ov-sentence">{sentenceLead(locale, kind, shape.all, flights)}{' '}{shape.rows.map((row, index) => <Fragment key={row.id}>{index > 0 ? ', ' : ''}<a href={row.href}>{row.label}</a>{shape.all ? '' : ` (${formatNumber(locale, row.count)})`}</Fragment>)}.</p>
      : <ol className="rank-list">{shape.rows.map(row => <li key={row.id}>
          <a href={row.href} className="ov-rank-label">{row.label}</a>
          <span className="rank-track" aria-hidden="true"><span style={{ width: `${Math.max(6, Math.round(row.count / shape.max * 100))}%` }} /></span>
          <span className="ov-rank-count">{formatNumber(locale, row.count)}</span>
        </li>)}</ol>}
  </section>
}

/** Top-five airlines, airports and aircraft. Every row and "All" link opens the Journal on the selected year. */
export function OverviewRankings({ summary, locale, labels }: { summary: OverviewSummary; locale: Locale; labels: OverviewLabels }) {
  const { topLists, totals, dataAvailability, period } = summary
  const year = period === 'all' ? undefined : period
  const rows = (list: Array<{ id: string; count: number }>, label: (id: string) => string, link: (id: string) => JournalLink): RankingRow[] =>
    list.map(row => ({ id: row.id, label: label(row.id), count: row.count, href: journalHref({ ...link(row.id), year }) }))
  return <section className="read-section" aria-labelledby="ov-rank-title">
    <h2 id="ov-rank-title">{t(S.rankings, locale)}</h2>
    <div className="rank-grid">
      <Ranking kind="airlines" title={t(S.airlines, locale)} rows={rows(topLists.airlines, labels.airline, id => ({ airline: id }))} flights={totals.flights} locale={locale} allHref={journalHref({ year, sort: 'airline_iata' })} />
      <Ranking kind="airports" title={t(S.airports, locale)} rows={rows(topLists.airports, labels.airport, id => ({ airport: id }))} flights={totals.flights} locale={locale} allHref={journalHref({ year })} />
      <div className="ov-aircraft">
        <Ranking kind="aircraft" title={t(S.aircraft, locale)} rows={rows(topLists.aircraft, labels.aircraft, id => ({ aircraft: id }))} flights={totals.flights} locale={locale} allHref={journalHref({ year, sort: 'aircraft_icao' })} />
        {topLists.manufacturers.length ? <p className="ov-manufacturers"><span className="eyebrow">{t(S.manufacturers, locale)}</span>{' '}{topLists.manufacturers.map(row => `${row.id} (${formatNumber(locale, row.count)})`).join(', ')}</p> : null}
      </div>
    </div>
    {dataAvailability.missingAircraft > 0 ? <p className="ov-missing"><span>{formatCount(locale, dataAvailability.missingAircraft, forms.noAircraft)}</span>{' '}
      {/* Ascending aircraft puts flights without one first; each row there has its own "Add aircraft" action. */}
      <a className="text-link" href={journalHref({ year, sort: 'aircraft_icao', order: 'asc' })}>{t(S.findAircraft, locale)} →</a></p> : null}
  </section>
}
