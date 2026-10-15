'use client'
/**
 * The ground-travel detail sheet (page-flow contract "Адреса и возврат"). Open while the view carries `?journey=<id>`;
 * the journey is read by id whatever the list filter shows, with the list's copy shown first. Right sheet on desktop,
 * bottom sheet on phones, mounted only after hydration so a deep link renders the same markup on server and client.
 *
 * Actions: Edit and Complete are links to the forms; Cancel plan / Restore / Back to plans / Delete send one command
 * each (`use-journey-actions.ts`). Focus returns to the journey's card on close, else to the page title.
 */
import Link from 'next/link'
import { Car, Train } from '@keyline-icons/react'
import { useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  placeKey,
  placeLabel,
  segmentKm,
  todayIso,
  type GroundJourneyDto,
  type GroundPlaceSnapshot,
} from '@kuuki/shared/groundTravel'
import { formatCount, type Locale } from '../../lib/format'
import { countryNamer } from '../passport/model'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import { OfflineNote, PublicationPending } from './states'
import { approxDistance, coverageNote, knownDuration } from './format'
import { copy, days, nights } from './copy'
import { countdown, dateRange, journeyDays, routeText, statusWord } from './journey-card'
import { endpoints } from './list-model'
import { journeyPlaces, RouteSketch, sketchOf, stopMarks, type StopMark } from './route-sketch'
import { useJourneyRead } from './use-ground-data'
import { useJourneyActions } from './use-journey-actions'
import { withReturn, type GroundView } from './url'
import './ground.css'

const noSubscribe = () => () => {}
const useMounted = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  )

const cardFor = (id: string | null) =>
  id === null
    ? null
    : document.querySelector<HTMLElement>(`[data-journey-card="${id}"] .gt-card-link`)

function Title({ locale, journey }: { locale: Locale; journey: GroundJourneyDto | null }) {
  const t = copy[locale]
  if (!journey) return <>{t.detailTitleFallback}</>
  const { from, to } = endpoints(journey)
  const loop = from && to && from.source === to.source && from.id === to.id
  if (!from || !to || loop) return <>{routeText(locale, journey)}</>
  return (
    <>
      {placeLabel(from, locale)}
      <span aria-hidden="true"> → </span>
      <span className="sr-only">{t.to}</span>
      {placeLabel(to, locale)}
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const shortDates: Partial<Record<Locale, Intl.DateTimeFormat>> = {}

/** "Nov 13 08:00": day and month only, since the facts above carry the year. */
function when(locale: Locale, date: string | null, time: string | null) {
  const format = (shortDates[locale] ??= new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }))
  const day =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? format.format(new Date(`${date}T00:00:00Z`)) : date
  return [day, time].filter(Boolean).join(' ')
}

/** One city in the route list, with the connection that arrives at it. */
type Stop = {
  key: string
  place: GroundPlaceSnapshot
  /** Starts a new run: the previous rail leg ended somewhere else, so no line joins them. */
  gap: boolean
  leg: { vehicle: string; facts: string[] } | null
  details: string[]
  times: string[]
  note: string | null
}

function stopsOf(locale: Locale, journey: GroundJourneyDto): Stop[] {
  const t = copy[locale]
  if (journey.mode === 'road')
    return journey.points.map((point, index) => {
      const previous = journey.points[index - 1]
      const km = previous ? segmentKm(previous.place, point.place) : null
      const stay =
        point.arrivalDate || point.departureDate
          ? dateRange(locale, point.arrivalDate ?? point.departureDate, point.departureDate)
          : null
      return {
        key: point.id,
        place: point.place,
        gap: false,
        leg: previous
          ? { vehicle: '', facts: km === null ? [] : [approxDistance(locale, km)] }
          : null,
        details: [],
        times: [
          stay,
          point.nights === null ? null : formatCount(locale, point.nights, nights),
        ].filter((value): value is string => !!value),
        note: point.note,
      }
    })
  const stops: Stop[] = []
  journey.legs.forEach((leg, index) => {
    const previous = journey.legs[index - 1]
    const departs = when(locale, leg.departureDate, leg.departureTime)
    if (previous && placeKey(previous.to) === placeKey(leg.from)) {
      // A change of trains: the stop already listed gains this leg's departure.
      const stop = stops[stops.length - 1]
      if (leg.fromStation && !stop.details.includes(leg.fromStation))
        stop.details.push(leg.fromStation)
      if (departs) stop.times.push(departs)
    } else
      stops.push({
        key: `${leg.id}:from`,
        place: leg.from,
        gap: index > 0,
        leg: null,
        details: leg.fromStation ? [leg.fromStation] : [],
        times: departs ? [departs] : [],
        note: null,
      })
    const arrives = when(locale, leg.arrivalDate, leg.arrivalTime)
    stops.push({
      key: `${leg.id}:to`,
      place: leg.to,
      gap: false,
      leg: {
        vehicle: [leg.trainNumber && `${t.train} ${leg.trainNumber}`, leg.operator]
          .filter(Boolean)
          .join(' · '),
        facts: [
          leg.durationMinutes === null ? null : knownDuration(locale, leg.durationMinutes),
          leg.distanceKm === null ? null : approxDistance(locale, leg.distanceKm),
        ].filter((value): value is string => !!value),
      },
      details: leg.toStation ? [leg.toStation] : [],
      times: arrives ? [arrives] : [],
      note: null,
    })
  })
  return stops
}

/**
 * The route as a list: each city carries the mark its pin has on the map (start outline, numbered stops, filled end),
 * and the connection that reaches it sits on the line above it. Unknown facts are left out, never written as zero.
 */
function Route({
  locale,
  journey,
  marks,
}: {
  locale: Locale
  journey: GroundJourneyDto
  marks: Map<string, StopMark>
}) {
  const country = countryNamer(locale)
  const Icon = journey.mode === 'rail' ? Train : Car
  const stops = stopsOf(locale, journey)
  const oneCountry = new Set(stops.map((stop) => stop.place.countryCode)).size === 1
  return (
    <ol className="gt-route">
      {stops.map((stop) => {
        const mark = marks.get(placeKey(stop.place))
        const where = [
          stop.place.region,
          oneCountry && stop.place.region ? null : country(stop.place.countryCode),
        ]
          .filter(Boolean)
          .join(', ')
        return (
          <li key={stop.key} className="gt-stop" data-gap={stop.gap || undefined}>
            {stop.leg && (
              <p className="gt-leg">
                <Icon size={14} strokeWidth={2} aria-hidden="true" />
                {stop.leg.vehicle && <span className="gt-leg-vehicle">{stop.leg.vehicle}</span>}
                {stop.leg.facts.length > 0 && <span>{stop.leg.facts.join(' · ')}</span>}
              </p>
            )}
            <div className="gt-stop-row">
              <span className="gt-stop-mark" data-role={mark?.role ?? 'none'} aria-hidden="true">
                {mark?.number}
              </span>
              <div className="gt-stop-place">
                <p className="gt-stop-name">{placeLabel(stop.place, locale)}</p>
                <p className="gt-stop-meta">
                  {stop.details.length > 0 ? stop.details.join(' · ') : where}
                </p>
                {stop.note && <p className="gt-stop-meta">{stop.note}</p>}
              </div>
              {stop.times.length > 0 && (
                <p className="gt-stop-when">
                  {stop.times.map((time, index) => (
                    <span key={index}>{time}</span>
                  ))}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Body({ locale, journey }: { locale: Locale; journey: GroundJourneyDto }) {
  const t = copy[locale]
  const country = countryNamer(locale)
  const { metrics } = journey
  const Icon = journey.mode === 'rail' ? Train : Car
  const sketch = sketchOf(journeyPlaces(journey))
  const distanceNote = coverageNote(locale, metrics.distanceCoverage)
  const length = journeyDays(journey.startDate, journey.endDate)
  const soon = countdown(locale, journey, todayIso())
  return (
    <>
      <p className="gt-card-meta">
        <span className="gt-mode">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
          {journey.mode === 'rail' ? t.modeRail : t.modeRoad}
        </span>
        <span className="gt-status" data-status={journey.status}>
          {statusWord(locale, journey.status)}
        </span>
        {soon && <span className="gt-card-soon">{soon}</span>}
      </p>
      <RouteSketch sketch={sketch} locale={locale} />
      <dl className="gt-facts">
        <Row label={t.dates}>
          {dateRange(locale, journey.startDate, journey.endDate)}
          {length !== null && length > 1 && <small>{formatCount(locale, length, days)}</small>}
        </Row>
        <Row label={t.distance}>
          {metrics.distanceKm === null
            ? t.distanceUnknown
            : approxDistance(locale, metrics.distanceKm)}
          {metrics.distanceKm === null && distanceNote && <small>{distanceNote}</small>}
        </Row>
        {journey.mode === 'rail' && (
          <Row label={t.onTrains}>
            {knownDuration(locale, metrics.trainMinutes)}
            {metrics.trainMinutes !== null &&
              coverageNote(locale, metrics.trainMinutesCoverage) && (
                <small>{coverageNote(locale, metrics.trainMinutesCoverage)}</small>
              )}
          </Row>
        )}
        {journey.status === 'completed' && (
          <Row label={t.countries}>
            {journey.countries.length > 0
              ? journey.countries.map(country).join(', ')
              : t.countriesNone}
          </Row>
        )}
      </dl>
      <h3 className="gt-detail-heading">{t.route}</h3>
      <Route locale={locale} journey={journey} marks={stopMarks(sketch)} />
      {journey.note && (
        <>
          <h3 className="gt-detail-heading">{t.note}</h3>
          <p className="gt-note-text">{journey.note}</p>
        </>
      )}
    </>
  )
}

export type DetailProps = {
  locale: Locale
  view: GroundView
  /** The list's copy of the open journey, shown until the read answers. */
  seed: GroundJourneyDto | null
  online: boolean
  onClose: () => void
  /** A write landed: reload the list (totals, order). */
  onChanged: () => void
  onDeleted: () => void
}

export function GroundDetail({
  locale,
  view,
  seed,
  online,
  onClose,
  onChanged,
  onDeleted,
}: DetailProps) {
  const t = copy[locale]
  const id = view.journey
  const mounted = useMounted()
  const mobile = useMobile()
  const offlineNoteId = useId()
  const { read, reload, apply } = useJourneyRead(id, seed)
  // The sheet keeps the last journey while it animates out.
  const [shown, setShown] = useState(read)
  if (id !== null && shown !== read) setShown(read)
  const display = id === null ? shown : read
  const journey = display.journey
  const [confirm, setConfirm] = useState<null | 'reopen' | 'delete'>(null)
  const actions = useJourneyActions({
    journey,
    onSaved: (next) => {
      apply(next)
      onChanged()
    },
    onDeleted: () => {
      setConfirm(null)
      onDeleted()
    },
    onStale: () => {
      reload()
      onChanged()
    },
  })
  const { state } = actions
  const blocked = !online || state.busy !== null || state.unknown !== null
  const offlineDescribed = !online ? offlineNoteId : undefined

  const savedLine =
    state.saved &&
    (state.saved.action === 'cancel'
      ? t.savedCancel
      : state.saved.action === 'restore'
        ? t.savedRestore
        : state.saved.action === 'reopen'
          ? t.savedReopen
          : null)

  const footer = journey ? (
    <div className="gt-list-actions">
      {journey.status !== 'cancelled' && (
        <Link
          className="ui-button"
          data-variant={journey.status === 'planned' ? 'secondary' : 'primary'}
          href={withReturn(`/ground-travel/${journey.id}/edit`, view)}
        >
          <span>{t.edit}</span>
        </Link>
      )}
      {journey.status === 'planned' && (
        <Link
          className="ui-button"
          data-variant="primary"
          href={withReturn(`/ground-travel/${journey.id}/edit?complete=1`, view)}
        >
          <span>{t.complete}</span>
        </Link>
      )}
      {journey.status === 'planned' && (
        <Button
          variant="secondary"
          loading={state.busy === 'cancel'}
          loadingLabel={t.working}
          disabled={blocked}
          aria-describedby={offlineDescribed}
          onClick={() => void actions.run('cancel')}
        >
          {t.cancelPlan}
        </Button>
      )}
      {journey.status === 'cancelled' && (
        <Button
          variant="primary"
          loading={state.busy === 'restore'}
          loadingLabel={t.working}
          disabled={blocked}
          aria-describedby={offlineDescribed}
          onClick={() => void actions.run('restore')}
        >
          {t.restore}
        </Button>
      )}
      {journey.status === 'completed' && (
        <Button
          variant="secondary"
          disabled={blocked}
          aria-describedby={offlineDescribed}
          onClick={() => setConfirm('reopen')}
        >
          {t.backToPlans}
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={blocked}
        aria-describedby={offlineDescribed}
        onClick={() => setConfirm('delete')}
      >
        {t.delete}
      </Button>
    </div>
  ) : undefined

  const issue = state.issue
  const content =
    display.status === 'missing' ? (
      <div className="gt-missing" role="status">
        <p>{t.missing}</p>
        <Button variant="secondary" onClick={onClose}>
          {t.closeMissing}
        </Button>
      </div>
    ) : (
      <div className="gt-detail">
        {!online && <OfflineNote locale={locale} id={offlineNoteId} />}
        {display.status === 'error' && (
          <Alert
            variant="warning"
            urgent
            title={t.detailErrorTitle}
            action={
              <Button dense onClick={reload}>
                {t.retry}
              </Button>
            }
          >
            {t.detailErrorDescription}
          </Alert>
        )}
        {issue?.kind === 'conflict' && (
          <Alert
            variant="warning"
            urgent
            title={t.conflictTitle}
            action={
              <Button dense onClick={actions.clearNotice}>
                {t.dismiss}
              </Button>
            }
          >
            {t.conflictDescription}
          </Alert>
        )}
        {issue?.kind === 'gone' && (
          <Alert
            variant="danger"
            urgent
            title={t.goneTitle}
            action={
              <Button dense onClick={onClose}>
                {t.closeMissing}
              </Button>
            }
          />
        )}
        {issue?.kind === 'rejected' && (
          <Alert
            variant="danger"
            urgent
            title={t.actionFailed}
            action={
              <Button dense onClick={actions.clearNotice}>
                {t.dismiss}
              </Button>
            }
          >
            {issue.message}
          </Alert>
        )}
        {state.unknown && (
          <Alert
            variant="warning"
            urgent
            title={t.unknownTitle}
            action={
              <div className="gt-alert-actions">
                <Button
                  dense
                  loading={state.checking}
                  loadingLabel={t.checking}
                  onClick={() => void actions.check()}
                >
                  {t.checkResult}
                </Button>
                <Button dense disabled={!online || state.checking} onClick={actions.retry}>
                  {t.retrySame}
                </Button>
                <Button dense disabled={state.checking} onClick={actions.dismiss}>
                  {t.dismiss}
                </Button>
              </div>
            }
          >
            {state.notRecorded ? t.notRecorded : t.unknownDescription}
          </Alert>
        )}
        {savedLine && (
          <p role="status" className="gt-note">
            {savedLine}
          </p>
        )}
        {state.saved?.pending && <PublicationPending locale={locale} />}
        {journey ? (
          <Body locale={locale} journey={journey} />
        ) : (
          <div className="gt-detail-loading" role="status" aria-busy="true">
            <span className="sr-only">{t.loading}</span>
          </div>
        )}
      </div>
    )

  const asked = confirm === 'reopen' ? t.backToPlansTitle : t.deleteTitle
  return (
    <>
      <Sheet
        open={mounted && mobile !== null && id !== null}
        onOpenChange={(open) => {
          if (!open && state.busy === null) onClose()
        }}
        title={<Title locale={locale} journey={journey} />}
        initialDetent={1}
        side={mobile ? 'bottom' : 'right'}
        className={mobile ? 'gt-detail-sheet flight-full-sheet' : 'gt-detail-sheet'}
        closeLabel={t.close}
        footer={footer}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const target = cardFor(id ?? display.journey?.id ?? null)
          ;(target ?? document.querySelector<HTMLElement>('main h1'))?.focus()
        }}
      >
        {content}
      </Sheet>
      <DestructiveConfirm
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={asked}
        consequence={confirm === 'reopen' ? t.backToPlansConsequence : t.deleteConsequence}
        confirmLabel={confirm === 'reopen' ? t.backToPlans : t.delete}
        cancelLabel={t.cancelButton}
        closeLabel={t.closeMissing}
        pendingLabel={t.working}
        confirmDisabledReason={!online ? t.offlineReason : undefined}
        errorMessage={t.actionFailed}
        onConfirm={async () => {
          const outcome = await actions.run(confirm === 'reopen' ? 'reopen' : 'delete')
          const result = await outcome
          if (result?.kind === 'rejected') throw new Error(result.message)
          setConfirm(null)
        }}
      />
    </>
  )
}
