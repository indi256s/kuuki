import type { OverviewSummary } from '../../../../../packages/shared/src/overview'
import { formatDistanceKm, formatNumber, formatCount, type Locale } from '../../lib/format'
import { S, forms, t } from './copy'
import { comparisonCaption, earthCaption, timeFigure } from './model'

/** Four unboxed figures: flights, distance, countries and time in the air, with the period comparison beneath. */
export function OverviewFigures({ summary, locale, sample = false }: { summary: OverviewSummary; locale: Locale; sample?: boolean }) {
  const { totals, comparison, dataAvailability } = summary
  const km = (n: number) => formatDistanceKm(locale, n)
  const time = timeFigure(locale, summary)
  const distanceUnknown = dataAvailability.flights > 0 && dataAvailability.distanceKnown === 0
  const countryCaptions = [
    totals.countries === null ? t(S.updating, locale) : null,
    summary.period === 'all' && totals.countries !== null ? t(S.archivedIncluded, locale) : null,
    totals.pendingCountries ? formatCount(locale, totals.pendingCountries, forms.waiting) : null,
    comparison && comparisonCaption(locale, comparison.countries, comparison),
  ].filter(Boolean)
  const cells: Array<{ key: string; label: string; value: string; unit?: string | null; captions: Array<string | null | false | undefined>; flights?: boolean }> = [
    { key: 'flights', label: t(S.flights, locale), value: formatNumber(locale, totals.flights), captions: [comparison && comparisonCaption(locale, comparison.flights, comparison)], flights: true },
    { key: 'distance', label: t(S.distance, locale),
      value: distanceUnknown ? '—' : formatNumber(locale, totals.distanceKm), unit: distanceUnknown ? null : locale === 'ru' ? 'км' : 'km',
      captions: [distanceUnknown ? (locale === 'ru' ? 'Расстояние не указано' : 'Distance not recorded') : earthCaption(locale, totals.distanceKm), comparison && !distanceUnknown && comparisonCaption(locale, comparison.distanceKm, comparison, km)] },
    { key: 'countries', label: t(S.countries, locale), value: totals.countries === null ? '—' : formatNumber(locale, totals.countries), captions: countryCaptions },
    { key: 'time', label: t(S.time, locale), value: time.value, unit: time.unit,
      captions: [time.caption, comparison && time.value !== '—' && comparisonCaption(locale, comparison.durationMinutes, comparison, minutes => `${formatNumber(locale, Math.round(minutes / 60))} ${t(S.hours, locale)}`)] },
  ]
  return <dl className="ov-figures" aria-label={t(S.figures, locale)}>
    {cells.map(cell => <div key={cell.key} className={cell.flights ? 'hero-stat' : undefined} data-figure={cell.key}>
      <dt className="eyebrow">{cell.label}</dt>
      <dd><strong data-testid={cell.flights && !sample ? 'overview-flights' : undefined}>{cell.value}</strong>{cell.unit ? <span className="ov-unit">{cell.unit}</span> : null}
        {cell.captions.filter(Boolean).map((caption, index) => <span key={index} className="ov-caption">{caption}</span>)}</dd>
    </div>)}
  </dl>
}
