'use client'
// One journey in the list. The title is a real link (`?journey=<id>` with the current filters), so it is shareable and
// middle-clickable; a click is handled in place so the page keeps its history rules. Mode is an icon AND a word, and
// active status is a word, never colour alone. Missing optional facts stay in the details.

import Link from 'next/link'
import { Car, Train, TriangleAlert } from '@keyline-icons/react'
import {
  placeKey,
  placeLabel,
  railRouteRuns,
  type GroundJourneyDto,
} from '@kuuki/shared/groundTravel'
import { formatCount, formatDateOnly, formatNumber, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration } from './format'
import { copy, legs, stops } from './copy'
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
    <dl className="gt-card-facts">
      <div>
        <dt>{t.distance}</dt>
        <dd data-unknown={metrics.distanceKm === null}>
          {metrics.distanceKm === null
            ? t.distanceUnknown
            : approxDistance(locale, metrics.distanceKm)}
          {distanceNote && <small>{distanceNote}</small>}
        </dd>
      </div>
      {journey.mode === 'rail' && metrics.trainMinutes !== null && (
        <div>
          <dt>{t.onTrains}</dt>
          <dd>
            {knownDuration(locale, metrics.trainMinutes)}
            {coverageNote(locale, metrics.trainMinutesCoverage) && (
              <small>{coverageNote(locale, metrics.trainMinutesCoverage)}</small>
            )}
          </dd>
        </div>
      )}
      {journey.mode === 'road' && metrics.uniqueCities !== null && (
        <div>
          <dt>{t.uniqueCities}</dt>
          <dd>{formatNumber(locale, metrics.uniqueCities)}</dd>
        </div>
      )}
    </dl>
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
  const { from, to } = endpoints(journey)
  const runs =
    journey.mode === 'rail'
      ? railRouteRuns(journey.legs)
      : [journey.points.map((point) => point.place)]
  const places = runs.length === 1 ? runs[0] : []
  const via = [
    ...new Map(
      places
        .filter(
          (place) =>
            placeKey(place) !== (from && placeKey(from)) &&
            placeKey(place) !== (to && placeKey(to)),
        )
        .map((place) => [placeKey(place), placeLabel(place, locale)]),
    ).values(),
  ]
  const viaText = via.slice(0, 3).join(', ') + (via.length > 3 ? ` +${via.length - 3}` : '')
  return (
    <li
      className="gt-card"
      data-journey-card={journey.id}
      data-mode={journey.mode}
      data-status={journey.status}
    >
      <div className="gt-card-topline">
        <p className="gt-card-meta">
          <span className="gt-mode">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            {journey.mode === 'rail' ? t.modeRail : t.modeRoad}
          </span>
          <span>
            {journey.mode === 'rail'
              ? formatCount(locale, count, legs)
              : formatCount(locale, count, stops)}
          </span>
        </p>
        {journey.status !== 'completed' && (
          <span className="gt-status" data-status={journey.status}>
            {statusWord(locale, journey.status)}
          </span>
        )}
      </div>
      <div className="gt-card-content">
        <div className="gt-card-itinerary">
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
          <p className="gt-card-date">
            {journey.startDate || journey.endDate
              ? dateRange(locale, journey.startDate, journey.endDate)
              : t.undated}
          </p>
          {via.length > 0 && <p className="gt-card-via">{t.via(viaText)}</p>}
        </div>
        <Facts locale={locale} journey={journey} />
      </div>
      {passed && (
        <p className="gt-card-hint">
          <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong>{t.datePassed}.</strong> {t.datePassedHint}
          </span>
        </p>
      )}
    </li>
  )
}
