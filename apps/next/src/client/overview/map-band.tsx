import type { OverviewSummary } from '@kuuki/shared/overview'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { BUCKET_LABELS, BUCKET_TOKENS } from '../../lib/map-buckets'
import { OverviewMapPreview } from './map-preview'
import { S, forms, t } from './copy'
import type { OverviewLabels } from './labels'

/**
 * Period-correct mini map from the summary's country visit counts. Pending countries are listed and counted as waiting,
 * never drawn as pressed. Route arcs come from the Passport map's route projection for the same period; the interactive
 * map stays behind the Passport link. `ownerId` is absent only for the inert first-run sample.
 */
export function OverviewMap({ summary, locale, labels, ownerId }: { summary: OverviewSummary; locale: Locale; labels: OverviewLabels; ownerId?: string }) {
  const { map, totals, period } = summary
  const pressed = map.countries.filter(country => !country.pending)
  const sorted = [...map.countries].sort((a, b) => b.visits - a.visits || labels.country(a.id).localeCompare(labels.country(b.id), locale))
  const line = [formatCount(locale, map.routeCount, forms.routes), formatCount(locale, totals.airports, forms.airports),
    totals.countries === null ? t(S.countriesUpdating, locale) : formatCount(locale, totals.countries, forms.countries)]
  if (totals.pendingCountries) line.push(formatCount(locale, totals.pendingCountries, forms.waiting))
  const href = `/passport?view=map${period === 'all' ? '' : `&year=${period}`}`
  return <section className="read-section ov-map" aria-labelledby="ov-map-title">
    <div className="section-heading"><h2 id="ov-map-title">{t(S.map, locale)}</h2><a href={href}>{t(S.mapLink, locale)} →</a></div>
    <OverviewMapPreview ownerId={ownerId} locale={locale} period={period} revision={summary.revision} publishedRevision={summary.publishedRevision} routeCount={map.routeCount}
      countryIds={pressed.map(country => country.id)} visits={map.countries.map(country => ({ countryCode: country.id, count: country.visits, pending: country.pending }))} />
    <div className="ov-legend-row">
      <p className="ov-legend-line">{line.join(' · ')}</p>
      <ul className="ov-legend" aria-label={t(S.legend, locale)}>{BUCKET_LABELS[locale].map((label, index) =>
        <li key={label}><span className="ov-swatch" style={{ background: `var(${BUCKET_TOKENS[index + 1]})` }} aria-hidden="true" />{label}</li>)}</ul>
    </div>
    {totals.countries === null ? <p role="status" className="status-note">{t(S.countriesUpdating, locale)}</p> : null}
    <details className="ov-country-list">
      <summary>{`${t(S.countryList, locale)} (${formatNumber(locale, map.countries.length)})`}</summary>
      {sorted.length ? <ul>{sorted.map(country => <li key={country.id}>{labels.country(country.id)} · {formatCount(locale, country.visits, forms.visits)}{country.pending ? ` · ${t(S.newWaiting, locale)}` : ''}</li>)}</ul> : <p className="muted">{t(S.noCountries, locale)}</p>}
    </details>
  </section>
}
