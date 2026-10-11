'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { isEmptyFilter, previousPeriod } from '@kuuki/shared/overview/filter'
import { calendarDay } from '@kuuki/shared/overview/next'
import { overviewSeries } from '@kuuki/shared/overview/series'
import {
  formatCount,
  formatDistanceKm,
  formatDuration,
  formatDurationDays,
  formatMonthYear,
  formatPeriodDate,
  formatNumber,
  type CountForms,
  type Locale,
} from '../../../lib/format'
import { forms, S, t } from '../copy'
import { useOverview } from '../store/overview-context'
import { YearStrip } from './year-strip'
import { OnThisDayLine } from './on-this-day-line'
import { ArcSparkline } from '../charts/arc-sparkline'
import './hero.css'

const copy = {
  km: { en: 'Kilometres', ru: 'Километры' },
  air: { en: 'In the air', ru: 'В воздухе' },
  byAir: { en: 'by air', ru: 'по воздуху' },
  lastPublished: { en: 'last published total', ru: 'последний опубликованный итог' },
  all: { en: 'of all', ru: 'от всех' },
  since: { en: 'Flights since', ru: 'Перелёты с' },
  equator: { en: 'round the equator', ru: 'вокруг экватора' },
  mobileEquator: { en: 'the equator', ru: 'экватора' },
  toReview: { en: 'to review', ru: 'на проверку' },
}
const estimatedForms: CountForms = {
  en: { one: '{count} estimated', other: '{count} estimated' },
  ru: {
    one: '{count} оценённый',
    few: '{count} оценённых',
    many: '{count} оценённых',
    other: '{count} оценённых',
  },
}
const awaitingForms: CountForms = {
  en: { one: '{count} awaiting review', other: '{count} awaiting review' },
  ru: {
    one: '{count} ждёт проверки',
    few: '{count} ждут проверки',
    many: '{count} ждут проверки',
    other: '{count} ждут проверки',
  },
}
function units(value: string): ReactNode {
  // Formatters join number and unit with a no-break space; the unit is that space plus the non-digit run after it.
  return value.split(/(\u00a0[^\d\s]+)/).map((part, index) =>
    index % 2 ? (
      <span className="ov3-hero-unit" key={index}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}
function Delta({
  value,
  label,
  locale,
  format = formatNumber,
}: {
  value: number
  label: string
  locale: Locale
  format?: (locale: Locale, value: number) => string
}) {
  return (
    <p className={`ov3-hero-delta${value < 0 ? ' negative' : ''}`}>
      {value < 0 ? '↓ −' : '↑ +'}
      {format(locale, Math.abs(value))} {locale === 'ru' ? 'к' : 'vs'} {label}
    </p>
  )
}

/** Each sparkline renders twice: inline in its figure's column, and as a full-width row that only the docked wide band (page.css) shows. CSS picks one, so the server's first paint matches. */
export function HeroPanel() {
  const { scope, payload, filter, locale } = useOverview()
  const trend = useMemo(
    () => (payload ? overviewSeries(payload, filter).monthly : []),
    [payload, filter],
  )
  const trendLabels = useMemo(() => {
    const dates = trend.map((row) => formatPeriodDate(locale, row.date))
    return {
      flights: trend.map(
        (row, i) => `${dates[i]}: ${formatCount(locale, row.flights, forms.flights)}`,
      ),
      km: trend.map((row, i) => `${dates[i]}: ${formatDistanceKm(locale, row.km)}`),
    }
  }, [trend, locale])
  if (!payload || !scope) return <p role="status">{t(S.loading, locale)}</p>
  const f = scope.figures,
    zero = f.flights === 0 && !isEmptyFilter(filter)
  const trendLabel =
    locale === 'ru' ? 'По месяцам выбранного периода' : 'By month in the selected period'
  const previous = previousPeriod(filter)?.period
  const label = previous
    ? 'years' in previous
      ? previous.years.length === 1
        ? String(previous.years[0])
        : `${previous.years[0]}–${previous.years.at(-1)}`
      : `${formatPeriodDate(locale, previous.from)}–${formatPeriodDate(locale, previous.to)}`
    : null
  const deltas = !zero && label && f.deltas ? f.deltas : null
  const share = !zero && !filter.period && !isEmptyFilter(filter) ? f.share : null
  const percent = (ratio: number) =>
    `${formatNumber(locale, Math.round(ratio * 100))}% ${t(copy.all, locale)}`
  const firstDay = f.firstDate ? calendarDay(f.firstDate) : null
  const since =
    firstDay !== null
      ? locale === 'ru'
        ? new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })
            .format(new Date(firstDay))
            .replace(/^\d+\s/, '')
        : formatMonthYear(locale, new Date(firstDay))
      : null
  const airCaption =
    t(copy.air, locale) +
    (f.estimatedFlights > 0 ? ` · ${formatCount(locale, f.estimatedFlights, estimatedForms)}` : '')
  const review = f.awaiting > 0 ? `${formatCount(locale, f.awaiting, awaitingForms)}\u00a0→` : null
  const laps = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(f.equatorLaps)
  const metrics = [
    {
      key: 'km',
      name: t(copy.km, locale),
      value: units(formatDistanceKm(locale, f.distanceKm)),
      caption: `${laps}× ${t(copy.equator, locale)}`,
      delta: deltas ? f.distanceKm - deltas.distanceKm : null,
      format: formatDistanceKm,
      share: share?.distanceKm,
    },
    {
      key: 'duration',
      name: t(copy.air, locale),
      value: (
        <>
          {f.durationApproximate ? '≈ ' : ''}
          {units(formatDurationDays(locale, f.durationMinutes))}
        </>
      ),
      caption: airCaption,
      delta: deltas ? f.durationMinutes - deltas.durationMinutes : null,
      format: formatDuration,
      share: share?.durationMinutes,
    },
    {
      key: 'countries',
      name: t(S.countries, locale),
      value: formatNumber(locale, f.countries.value),
      caption: `${t(S.countries, locale)}${f.countries.source === 'by_air' ? ` · ${t(copy.byAir, locale)}` : !payload.derivedReady ? ` · ${t(copy.lastPublished, locale)}` : ''}`,
      delta: null,
      share: share?.countries,
    },
    {
      key: 'airports',
      name: t(S.airports, locale),
      value: formatNumber(locale, f.airports),
      caption: t(S.airports, locale),
      delta: null,
      share: share?.airports,
    },
  ]
  // Phones show both sparklines side by side under one period note, so each caption keeps only its name there.
  const sparkCaption = (name: string) => (
    <>
      {name}
      <span className="ov3-spark-period"> · {trendLabel}</span>
    </>
  )
  const flightSpark = (place: 'inline' | 'row') =>
    !zero && trend.length > 0 ? (
      <ArcSparkline
        place={place}
        values={trend.map((row) => row.flights)}
        labels={trendLabels.flights}
        summary={`${t(S.flights, locale)} · ${trendLabel}`}
        caption={sparkCaption(t(S.flights, locale))}
      />
    ) : null
  const kmSpark = (place: 'inline' | 'row') =>
    !zero && trend.length > 0 ? (
      <ArcSparkline
        place={place}
        values={trend.map((row) => row.km)}
        labels={trendLabels.km}
        summary={`${t(copy.km, locale)} · ${trendLabel}`}
        caption={sparkCaption(t(copy.km, locale))}
      />
    ) : null
  const metric = (item: (typeof metrics)[number]) => (
    <div className={`ov3-hero-metric ov3-hero-${item.key}`} key={item.key}>
      <dt className="ov3-hero-caption">
        {item.key === 'km' ? (
          <>
            <span className="ov3-desktop-caption">{item.caption}</span>
            <span className="ov3-mobile-caption">
              {item.name} · {laps}× {t(copy.mobileEquator, locale)}
            </span>
          </>
        ) : (
          item.caption
        )}
      </dt>
      <dd className="ov3-hero-value" aria-label={item.name}>
        {zero ? '—' : item.value}
      </dd>
      {item.delta !== null && label ? (
        <Delta value={item.delta} label={label} locale={locale} format={item.format} />
      ) : null}
      {item.share !== undefined ? <p className="ov3-hero-share">{percent(item.share)}</p> : null}
      {item.key === 'km' ? kmSpark('inline') : null}
    </div>
  )
  return (
    <section className="ov3-hero-panel" aria-label={t(S.figures, locale)}>
      <div className="ov3-hero-lead">
        <div className="ov3-hero-flight">
          <div className="ov3-hero-value" aria-label={t(S.flights, locale)}>
            {zero ? '—' : formatNumber(locale, f.flights)}
          </div>
          <p className="ov3-hero-caption ov3-desktop-caption">
            {since ? `${t(copy.since, locale)} ${since}` : t(S.flights, locale)}
          </p>
          {/* Phones hide the desktop review link, so the count in the caption is the way to the queue. */}
          <p className="ov3-hero-caption ov3-mobile-caption">
            {t(S.flights, locale)}
            {f.awaiting > 0 ? (
              <>
                {' '}
                ·{' '}
                <Link className="ov3-mobile-review" href="/journal?queue=awaiting">
                  {formatNumber(locale, f.awaiting)} {t(copy.toReview, locale)}
                </Link>
              </>
            ) : null}
          </p>
          {deltas && label ? (
            <Delta value={f.flights - deltas.flights} label={label} locale={locale} />
          ) : null}
          {share ? (
            <p className="ov3-hero-share">
              {formatCount(locale, f.flights, forms.flights)} · {percent(share.flights)}
            </p>
          ) : null}
          {flightSpark('inline')}
        </div>
        {review ? (
          <Link className="ov3-hero-review" href="/journal?queue=awaiting">
            {review}
          </Link>
        ) : null}
      </div>
      {flightSpark('row')}
      <YearStrip />
      <div className="ov3-hero-measures">
        <dl className="ov3-hero-metrics">{metrics.slice(0, 2).map(metric)}</dl>
        {kmSpark('row')}
        <dl className="ov3-hero-metrics">{metrics.slice(2).map(metric)}</dl>
      </div>
      {!zero && trend.length > 0 ? (
        <p className="ov3-hero-trend-note" aria-hidden="true">
          {trendLabel}
        </p>
      ) : null}
      <OnThisDayLine />
    </section>
  )
}
