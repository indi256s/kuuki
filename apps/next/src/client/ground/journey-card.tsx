'use client'
// One journey in the list. The title is a real link (`?journey=<id>` with the current filters), so it is shareable and
// middle-clickable; a click is handled in place so the page keeps its history rules. The route leads, departure left
// and destination right, with a stop-order schematic beneath; a small map of the route sits beside it on a wide card
// and below it on a narrow one. Mode is an icon AND a word, and active status is a word, never colour alone. Missing
// optional facts stay in the details.

import { Fragment } from 'react'
import Link from 'next/link'
import { Car, ChevronRight, Train, TriangleAlert } from '@keyline-icons/react'
import { placeKey, placeLabel, type GroundJourneyDto } from '@kuuki/shared/groundTravel'
import { formatCount, formatDateOnly, type Locale } from '../../lib/format'
import { approxDistance, coverageNote, knownDuration } from './format'
import { copy, days, legs, startsIn, stops } from './copy'
import { endpoints, groupOf, routeStops, type RouteStop } from './list-model'
import { journeyPlaces, RouteMiniMap } from './route-sketch'
import { countryNamer } from '../passport/model'
import { groundHref, type GroundView } from './url'

/** Days since 1970-01-01 for an ISO date; null for anything else. */
function dayNumber(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(0)
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Math.round(date.getTime() / 86_400_000)
}

const rangeFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}

export function dateRange(locale: Locale, start: string | null, end: string | null): string {
  const t = copy[locale]
  if (!start && !end) return t.dateUnknown
  // Keep each localized date whole; a range can still wrap around its separator.
  const date = (value: string) => formatDateOnly(locale, value, 'medium').replaceAll(' ', '\u00a0')
  if (!start) return `${t.dateUnknown}, ${date(end!)}`
  const from = dayNumber(start)
  const to = end === null ? null : dayNumber(end)
  if (from === null || to === null || to <= from)
    return end && end !== start ? `${date(start)} – ${date(end)}` : date(start)
  // One range shares the month and year it repeats: "Nov 13 – 29, 2026", «13–29 нояб. 2026 г.».
  const format = (rangeFormats[locale] ??= new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }))
  return format
    .formatRange(new Date(from * 86_400_000), new Date(to * 86_400_000))
    .replaceAll(' ', '\u00a0')
}

/** Calendar days a dated journey spans, both ends included; null unless both dates are known and in order. */
export function journeyDays(start: string | null, end: string | null): number | null {
  const from = start === null ? null : dayNumber(start)
  const to = end === null ? null : dayNumber(end)
  return from === null || to === null || to < from ? null : to - from + 1
}

/** "today", "tomorrow" or "in 29 days" for a plan that has not started; empty otherwise. */
export function countdown(locale: Locale, journey: GroundJourneyDto, today: string): string {
  if (journey.status !== 'planned' || !journey.startDate) return ''
  const from = dayNumber(today)
  const to = dayNumber(journey.startDate)
  if (from === null || to === null || to < from) return ''
  const t = copy[locale]
  return to === from
    ? t.startsToday
    : to === from + 1
      ? t.startsTomorrow
      : formatCount(locale, to - from, startsIn)
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
  const trainNote = coverageNote(locale, metrics.trainMinutesCoverage)
  const length = journeyDays(journey.startDate, journey.endDate)
  // "9 212 km" and "17 days" read without a label; the unit is quieter than the number.
  const [amount, unit] =
    metrics.distanceKm === null
      ? [t.distanceUnknown, '']
      : splitUnit(approxDistance(locale, metrics.distanceKm))
  return (
    <dl className="gt-card-facts">
      <div className="gt-card-distance">
        <dt className="sr-only">{t.distance}</dt>
        <dd data-unknown={metrics.distanceKm === null}>
          {amount}
          {unit && <span className="gt-unit">{unit}</span>}
          {distanceNote && <small>{distanceNote}</small>}
        </dd>
      </div>
      {journey.mode === 'rail' && metrics.trainMinutes !== null && (
        <div>
          <dt>{t.onTrains}</dt>
          <dd>
            {knownDuration(locale, metrics.trainMinutes)}
            {trainNote && <small>{trainNote}</small>}
          </dd>
        </div>
      )}
      {length !== null && length > 1 && (
        <div>
          <dt className="sr-only">{t.length}</dt>
          <dd>{formatCount(locale, length, days)}</dd>
        </div>
      )}
    </dl>
  )
}

/** "9 212 km" → ["9 212", " km"], splitting at the last no-break space. */
function splitUnit(value: string): [string, string] {
  const at = value.lastIndexOf('\u00a0')
  return at < 0 ? [value, ''] : [value.slice(0, at), value.slice(at)]
}

/**
 * Stop order, not geography: start outline, intermediate dots, filled destination with the arrowhead beside it.
 * Disjoint rail legs leave a gap instead of a line. Decorative; the route text and "Via" line carry the meaning.
 */
function RouteLine({ route }: { route: RouteStop[] }) {
  if (route.length < 2) return null
  return (
    <div className="gt-route-line" aria-hidden="true">
      {route.map((stop, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span
              className="gt-route-track"
              data-gap={stop.afterGap || undefined}
              data-arrow={stop.role === 'end' || undefined}
            />
          )}
          <span className="gt-route-stop" data-role={stop.role} />
        </Fragment>
      ))}
    </div>
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
  const passed = groupOf(journey, today) === 'past-plan'
  const { from, to, steps } = endpoints(journey)
  const route = routeStops(journey)
  const continuous = !route.some((stop) => stop.afterGap)
  const via = continuous
    ? [
        ...new Map(
          route
            .filter(
              (stop) =>
                placeKey(stop.place) !== (from && placeKey(from)) &&
                placeKey(stop.place) !== (to && placeKey(to)),
            )
            .map((stop) => [placeKey(stop.place), placeLabel(stop.place, locale)]),
        ).values(),
      ]
    : []
  const viaText = via.slice(0, 3).join(', ') + (via.length > 3 ? ` +${via.length - 3}` : '')
  const loop = !!from && !!to && placeKey(from) === placeKey(to)
  // Departure and destination flank the schematic, each with its country beneath; a round trip spans the row instead.
  const split = !!from && !!to && !loop
  const country = countryNamer(locale)
  const soon = countdown(locale, journey, today)
  const map = <RouteMiniMap places={journeyPlaces(journey)} />
  return (
    <li
      className="gt-card"
      data-journey-card={journey.id}
      data-mode={journey.mode}
      data-status={journey.status}
    >
      <div className="gt-card-body">
        <div className="gt-card-main">
          <div className="gt-card-topline">
            <p className="gt-card-meta">
              <span className="gt-mode">
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                {journey.mode === 'rail' ? t.modeRail : t.modeRoad}
              </span>
              <span>
                {journey.mode === 'rail'
                  ? formatCount(locale, steps, legs)
                  : formatCount(locale, steps, stops)}
              </span>
            </p>
            <p className="gt-card-when">
              {journey.status !== 'completed' && (
                <span className="gt-status" data-status={journey.status}>
                  {statusWord(locale, journey.status)}
                </span>
              )}
              <span>
                {journey.startDate || journey.endDate
                  ? dateRange(locale, journey.startDate, journey.endDate)
                  : t.undated}
              </span>
              {soon && <span className="gt-card-soon">{soon}</span>}
            </p>
          </div>
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
              {split ? (
                <>
                  <span className="gt-card-from">
                    {placeLabel(from, locale)}
                    <span className="gt-card-country">{country(from.countryCode)}</span>
                  </span>
                  <span className="gt-card-path">
                    <RouteLine route={route} />
                    {via.length > 0 && <span className="gt-card-via">{t.via(viaText)}</span>}
                  </span>
                  <span className="sr-only">{t.routeJoin}</span>
                  <span className="gt-card-to">
                    {placeLabel(to, locale)}
                    <span className="gt-card-country">{country(to.countryCode)}</span>
                  </span>
                </>
              ) : (
                <span className="gt-card-from">{routeText(locale, journey)}</span>
              )}
            </Link>
          </h3>
          {!split && <RouteLine route={route} />}
          {!split && via.length > 0 && <p className="gt-card-via">{t.via(viaText)}</p>}
        </div>
        {map}
        <div className="gt-card-bottom">
          <Facts locale={locale} journey={journey} />
          <ChevronRight className="gt-card-cue" size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        {passed && (
          <p className="gt-card-hint">
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>
              <strong>{t.datePassed}.</strong> {t.datePassedHint}
            </span>
          </p>
        )}
      </div>
    </li>
  )
}
