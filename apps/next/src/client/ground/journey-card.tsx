'use client'
// One journey in the list. The title is a real link (`?journey=<id>` with the current filters), so it is shareable and
// middle-clickable; a click is handled in place so the page keeps its history rules. Mode is an icon AND a word, and
// status is a word, never colour alone. Unknown values are words.

import Link from 'next/link'
import { Car, Train } from '@keyline-icons/react'
import { placeLabel, type GroundJourneyDto } from '@kuuki/shared/groundTravel'
import { formatCount, formatDateOnly, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration } from './format'
import { cities, copy, legs, stops } from './copy'
import { endpoints, groupOf } from './list-model'
import { groundHref, type GroundView } from './url'

export function dateRange(locale: Locale, start: string | null, end: string | null): string {
  const t = copy[locale]
  if (!start && !end) return t.dateUnknown
  if (!start) return `${t.dateUnknown}, ${formatDateOnly(locale, end!, 'medium')}`
  const from = formatDateOnly(locale, start, 'medium')
  return end && end !== start ? `${from} – ${formatDateOnly(locale, end, 'medium')}` : from
}

export function statusWord(locale: Locale, status: GroundJourneyDto['status']): string {
  const t = copy[locale]
  return status === 'planned'
    ? t.statusPlanned
    : status === 'completed'
      ? t.statusCompleted
      : t.statusCancelled
}

/** "A → B", "A and back" for a round trip, or the title-less fallback. */
export function routeText(locale: Locale, journey: GroundJourneyDto): string {
  const { from, to } = endpoints(journey)
  if (!from || !to) return journey.title ?? copy[locale].detailTitleFallback
  const a = placeLabel(from, locale)
  const b = placeLabel(to, locale)
  const same = from.source === to.source && from.id === to.id
  return same ? copy[locale].roundTrip(a) : `${a} → ${b}`
}

export function Facts({ locale, journey }: { locale: Locale; journey: GroundJourneyDto }) {
  const t = copy[locale]
  const { metrics } = journey
  const distanceNote =
    metrics.distanceKm === null ? coverageNote(locale, metrics.distanceCoverage) : ''
  return (
    <p className="gt-card-facts">
      <span>
        {metrics.distanceKm === null
          ? `${t.distanceUnknown}${distanceNote ? ` (${distanceNote})` : ''}`
          : approxDistance(locale, metrics.distanceKm)}
      </span>
      {journey.mode === 'rail' ? (
        <span>
          {metrics.trainMinutes === null
            ? t.timeUnknown
            : `${t.onTrains}: ${knownDuration(locale, metrics.trainMinutes)}`}
          {metrics.trainMinutes !== null && coverageNote(locale, metrics.trainMinutesCoverage)
            ? ` (${coverageNote(locale, metrics.trainMinutesCoverage)})`
            : ''}
        </span>
      ) : (
        metrics.uniqueCities !== null && (
          <span>{formatCount(locale, metrics.uniqueCities, cities)}</span>
        )
      )}
    </p>
  )
}

export function JourneyCard({
  journey,
  locale,
  view,
  today,
  onOpen,
}: {
  journey: GroundJourneyDto
  locale: Locale
  view: GroundView
  today: string
  onOpen: (id: string) => void
}) {
  const t = copy[locale]
  const Icon = journey.mode === 'rail' ? Train : Car
  const count = endpoints(journey).steps
  const passed = groupOf(journey, today) === 'past-plan'
  return (
    <li
      className="gt-card"
      data-journey-card={journey.id}
      data-mode={journey.mode}
      data-status={journey.status}
    >
      <h3 className="gt-card-title">
        <Link
          href={groundHref({ ...view, journey: journey.id })}
          scroll={false}
          className="gt-card-link"
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            )
              return
            event.preventDefault()
            onOpen(journey.id)
          }}
        >
          {routeText(locale, journey)}
        </Link>
      </h3>
      <p className="gt-card-meta">
        <span className="gt-mode">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
          {journey.mode === 'rail' ? t.modeRail : t.modeRoad}
        </span>
        <span className="gt-status" data-status={journey.status}>
          {statusWord(locale, journey.status)}
        </span>
        <span>{dateRange(locale, journey.startDate, journey.endDate)}</span>
        <span>
          {journey.mode === 'rail'
            ? formatCount(locale, count, legs)
            : formatCount(locale, count, stops)}
        </span>
      </p>
      <Facts locale={locale} journey={journey} />
      {passed && (
        <p className="gt-card-hint">
          <strong>{t.datePassed}.</strong> {t.datePassedHint}
        </p>
      )}
    </li>
  )
}
