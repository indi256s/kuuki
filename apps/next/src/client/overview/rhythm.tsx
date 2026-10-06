import type { OverviewSummary } from '@kuuki/shared/overview'
import { formatNumber, type Locale } from '../../lib/format'
import { S, fill, t } from './copy'
import { monthStrip, regionName } from './model'

/** Month strip with a text equivalent per month, plus the six collection-region chips. */
export function OverviewRhythm({ summary, locale }: { summary: OverviewSummary; locale: Locale }) {
  const { bars, busiest } = monthStrip(locale, summary.months)
  return <section className="read-section" aria-labelledby="ov-rhythm-title">
    <div className="section-heading"><h2 id="ov-rhythm-title">{t(S.rhythm, locale)}</h2><span className="muted">{summary.period === 'all' ? t(S.last12, locale) : summary.period}</span></div>
    <ol className="ov-months">{bars.map(bar => <li key={bar.month} data-empty={bar.flights === 0 ? 'true' : undefined}>
      <span className="ov-bar" aria-hidden="true" style={{ height: `${bar.height}%` }} /><span className="ov-month-label" aria-hidden="true">{bar.label}</span><span className="sr-only">{bar.text}</span>
    </li>)}</ol>
    <p className="muted">{busiest ?? t(S.quiet, locale)}</p>
    <h3 className="ov-regions-title">{t(S.regions, locale)}</h3>
    {summary.regions ? <ul className="ov-regions">{summary.regions.map(region => <li key={region.id} data-reached={region.pressed + region.pending > 0 ? 'true' : undefined}>
      <strong>{regionName(locale, region.id)}</strong>
      <span>{fill(t(S.regionOf, locale), { pressed: formatNumber(locale, region.pressed), total: formatNumber(locale, region.total) })}{region.pending > 0 ? ` ${fill(t(S.regionWaiting, locale), { count: formatNumber(locale, region.pending) })}` : ''}</span>
    </li>)}</ul> : <p className="muted" role="status">{t(S.countriesUpdating, locale)}</p>}
  </section>
}
