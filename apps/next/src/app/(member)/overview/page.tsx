import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnOverview } from '../../../server/overview'
import { getRequestLocale, type Locale } from '../../../server/locale'
import { pageMetadata } from '../../../server/metadata'
import { requireOnboardedMember } from '../../../server/gates'
import { normalizeOverviewQuery, withQuery } from '../../../lib/url-state'
import { IdentitySnapshot } from '../../../client/activity'
import { ReadFreshness } from '../../../client/freshness'
import { CountryPreview } from '../../../client/maps/preview'
import type { OverviewPeriod, OverviewSummary } from '../../../../../../packages/shared/src/overview'
import { formatDateOnly, formatDistanceKm, formatNumber } from '../../../lib/format'
import '../../reads.css'

const words = {
  en: { heading: 'Overview', eyebrow: 'Your journeys', lead: 'The shape of your flying, at a glance.', all: 'All time', flights: 'Flights', distance: 'Distance', countries: 'Countries', time: 'Time in the air', next: 'Next flight', upcoming: 'Upcoming', edit: 'Edit flight', map: 'Places by air', mapLink: 'Open Passport map', insights: 'Notable', longest: 'Longest flight', frequent: 'Most frequent route', rankings: 'Frequent flyers', airlines: 'Airlines', airports: 'Airports', aircraft: 'Aircraft', rhythm: 'Monthly rhythm', period: 'Period', empty: 'Your overview begins with a flight.', import: 'Import flights', add: 'Add manually', pending: 'Recent changes are still being prepared. Figures may lag behind your journal.', error: 'Some figures could not be refreshed. Your saved flights remain in the journal.', noData: 'More journeys will reveal a pattern.', refresh: 'Refresh' },
  ru: { heading: 'Обзор', eyebrow: 'Ваши путешествия', lead: 'Ваши полёты одним взглядом.', all: 'Всё время', flights: 'Перелёты', distance: 'Расстояние', countries: 'Страны', time: 'Время в воздухе', next: 'Следующий перелёт', upcoming: 'Предстоящий', edit: 'Изменить перелёт', map: 'Места по воздуху', mapLink: 'Открыть карту паспорта', insights: 'Заметное', longest: 'Самый длинный перелёт', frequent: 'Самый частый маршрут', rankings: 'Частые спутники', airlines: 'Авиакомпании', airports: 'Аэропорты', aircraft: 'Самолёты', rhythm: 'Ритм по месяцам', period: 'Период', empty: 'Ваш обзор начнётся с перелёта.', import: 'Импортировать перелёты', add: 'Добавить вручную', pending: 'Последние изменения ещё обрабатываются. Цифры могут отставать от журнала.', error: 'Часть цифр не обновилась. Сохранённые перелёты остаются в журнале.', noData: 'После нескольких перелётов появится картина.', refresh: 'Обновить' },
} as const

function date(date: string, locale: Locale) {
  return formatDateOnly(locale, date, 'medium')
}
function Ranking({ title, rows, locale }: { title: string; rows: {id:string;count:number}[]; locale: Locale }) {
  return <section className="read-panel"><h3>{title}</h3>{rows.length ? <ol className="rank-list">{rows.map(row => <li key={row.id}><span className="mono">{row.id}</span><span className="rank-track"><span style={{ width: `${Math.max(8, row.count / rows[0].count * 100)}%` }} /></span><span>{formatNumber(locale, row.count)}</span></li>)}</ol> : <p className="muted">{words[locale].noData}</p>}</section>
}
function Data({ summary, locale }: {summary:OverviewSummary; locale: Locale}) {
  const t = words[locale]
  const years = Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - i)
  const maxMonth = Math.max(1, ...summary.months.map(month => month.flights))
  return <section data-testid="overview-data" className="overview-data read-stack">
    <nav className="period-switch" aria-label={t.period}><a aria-current={summary.period === 'all' ? 'page' : undefined} href="/overview">{t.all}</a>{years.map(year => <a key={year} aria-current={summary.period === String(year) ? 'page' : undefined} href={`/overview?year=${year}`}>{year}</a>)}</nav>
    {summary.derivedState !== 'ready' && <p role="status" className="status-note">{summary.derivedState === 'pending' ? t.pending : t.error}</p>}
    {summary.nextFlight && <section className="flight-ticket" aria-label={t.next}><div><p className="eyebrow">{t.next}</p><strong className="ticket-route mono">{summary.nextFlight.origin} <span aria-hidden="true">→</span> {summary.nextFlight.destination}</strong><p>{date(summary.nextFlight.date, locale)}{summary.nextFlight.flightNumber ? ` · ${summary.nextFlight.flightNumber}` : ''}</p></div><a className="text-link" href={`/journal/${summary.nextFlight.id}/edit`}>{t.edit}</a></section>}
    <div className="figure-strip"><div className="hero-stat"><span className="eyebrow">{t.flights}</span><strong>{formatNumber(locale, summary.totals.flights)}</strong></div><div><span className="eyebrow">{t.distance}</span><strong>{formatNumber(locale, summary.totals.distanceKm)}</strong><span className="muted">{locale === 'ru' ? 'км' : 'km'}</span></div><div><span className="eyebrow">{t.countries}</span><strong>{formatNumber(locale, summary.totals.countries)}</strong></div><div><span className="eyebrow">{t.time}</span><strong>{formatNumber(locale, Math.round(summary.totals.durationMinutes / 60))}</strong><span className="muted">{locale === 'ru' ? 'ч' : 'h'}</span></div></div>
    {summary.totals.flights === 0 && <section className="read-panel empty-panel"><h2>{t.empty}</h2><div className="read-actions"><a className="button primary" href="/import">{t.import}</a><a className="button secondary" href="/add">{t.add}</a></div></section>}
    <section className="read-section"><div className="section-heading"><h2>{t.map}</h2><a href={`/passport?view=map${summary.period === 'all' ? '' : `&year=${summary.period}`}`}>{t.mapLink} →</a></div><CountryPreview countryIds={summary.countryIds} locale={locale} period={summary.period} /><p className="muted">{formatNumber(locale, summary.totals.airports)} {t.airports.toLowerCase()} · {formatNumber(locale, summary.totals.countries)} {t.countries.toLowerCase()}</p><ul className="country-code-list" aria-label={t.countries}>{summary.countryIds.map(code => <li key={code}>{new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code}</li>)}</ul></section>
    <section className="read-section"><h2>{t.insights}</h2><dl className="insight-list"><div><dt>{t.longest}</dt><dd>{summary.insights.longestFlight ? `${summary.insights.longestFlight.origin} → ${summary.insights.longestFlight.destination} · ${formatDistanceKm(locale, summary.insights.longestFlight.distanceKm)}` : t.noData}</dd></div><div><dt>{t.frequent}</dt><dd>{summary.insights.mostFrequentRoute ? `${summary.insights.mostFrequentRoute.origin} → ${summary.insights.mostFrequentRoute.destination} · ${formatNumber(locale, summary.insights.mostFrequentRoute.count)}` : t.noData}</dd></div></dl></section>
    <section className="read-section"><h2>{t.rankings}</h2><div className="rank-grid"><Ranking title={t.airlines} rows={summary.topLists.airlines} locale={locale} /><Ranking title={t.airports} rows={summary.topLists.airports} locale={locale} /><Ranking title={t.aircraft} rows={summary.topLists.aircraft} locale={locale} /></div></section>
    <section className="read-section"><h2>{t.rhythm}</h2><div className="month-strip">{summary.months.map(month => <div key={month.month} title={`${month.month}: ${month.flights}`}><span className="month-bar" style={{ height: `${Math.max(4, month.flights / maxMonth * 100)}%` }} /><span>{new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(`${month.month}-01T12:00:00Z`))}</span><span className="sr-only">{month.flights}</span></div>)}</div></section>
  </section>
}
async function OverviewData({ period }: { period: OverviewPeriod }) {
  const [owned, locale] = await Promise.all([getOwnOverview(period), getRequestLocale()])
  if (!owned) redirect('/signin')
  return <IdentitySnapshot ownerId={owned.ownerId}><ReadFreshness ownerId={owned.ownerId} revision={owned.summary.revision} publishedRevision={owned.summary.publishedRevision} locale={locale} /><Data summary={owned.summary} locale={locale} /></IdentitySnapshot>
}
export const generateMetadata = () => pageMetadata('Overview', 'Обзор')
export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOnboardedMember()
  const locale = await getRequestLocale()
  const t = words[locale]
  const normalized = normalizeOverviewQuery(await searchParams)
  if (!normalized.canonical) redirect(withQuery('/overview', normalized.query))
  const period: OverviewPeriod = (normalized.state.year ?? 'all') as OverviewPeriod
  return <><div className="page-heading"><p className="eyebrow">{t.eyebrow}</p><h1>{t.heading}</h1><p className="lead">{t.lead}</p></div><Suspense key={period} fallback={<p className="loading" data-testid="overview-loading" role="status">{locale === 'ru' ? 'Загружаем обзор…' : 'Loading overview…'}</p>}><OverviewData period={period} /></Suspense></>
}
