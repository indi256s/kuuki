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
  placeLabel,
  railRouteRuns,
  type GroundJourneyDto,
  type GroundPlaceSnapshot,
} from '@kuuki/shared/groundTravel'
import { formatCount, formatDateOnly, type Locale } from '../../lib/format'
import { countryNamer } from '../passport/model'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Sheet } from '../ui/sheet'
import { useMobile } from '../ui/use-mobile'
import { OfflineNote, PublicationPending } from './states'
import { approxDistance, coverageNote, knownDuration, unknownText } from './format'
import { cities, copy, nights } from './copy'
import { dateRange, routeText, statusWord } from './journey-card'
import { endpoints } from './list-model'
import { RouteSketch } from './route-sketch'
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

function placeLine(place: GroundPlaceSnapshot, locale: Locale, country: (code: string) => string) {
  return `${placeLabel(place, locale)}, ${country(place.countryCode)}`
}

const when = (locale: Locale, date: string | null, time: string | null) =>
  [date ? formatDateOnly(locale, date, 'medium') : null, time].filter(Boolean).join(' ')

function Steps({ locale, journey }: { locale: Locale; journey: GroundJourneyDto }) {
  const t = copy[locale]
  const country = countryNamer(locale)
  if (journey.mode === 'rail')
    return (
      <ol className="gt-steps">
        {journey.legs.map((leg) => {
          const departs = when(locale, leg.departureDate, leg.departureTime)
          const arrives = when(locale, leg.arrivalDate, leg.arrivalTime)
          const vehicle = [leg.trainNumber && `${t.train} ${leg.trainNumber}`, leg.operator]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={leg.id} className="gt-step">
              <p className="gt-step-route">
                {placeLine(leg.from, locale, country)}
                <span aria-hidden="true"> → </span>
                <span className="sr-only">{t.to}</span>
                {placeLine(leg.to, locale, country)}
              </p>
              {(leg.fromStation || leg.toStation) && (
                <p className="gt-step-meta">
                  {t.station}: {[leg.fromStation, leg.toStation].filter(Boolean).join(' → ')}
                </p>
              )}
              {vehicle && <p className="gt-step-meta">{vehicle}</p>}
              {(departs || arrives) && (
                <p className="gt-step-meta">
                  {departs && `${t.departs}: ${departs}`}
                  {departs && arrives && ' · '}
                  {arrives && `${t.arrives}: ${arrives}`}
                </p>
              )}
              <p className="gt-step-meta">
                {t.timeOnTrain}: {knownDuration(locale, leg.durationMinutes)}
                {' · '}
                {t.distance}: {approxDistance(locale, leg.distanceKm)}
              </p>
            </li>
          )
        })}
      </ol>
    )
  return (
    <ol className="gt-steps">
      {journey.points.map((point) => {
        const arrives = point.arrivalDate
          ? formatDateOnly(locale, point.arrivalDate, 'medium')
          : null
        const leaves = point.departureDate
          ? formatDateOnly(locale, point.departureDate, 'medium')
          : null
        return (
          <li key={point.id} className="gt-step">
            <p className="gt-step-route">{placeLine(point.place, locale, country)}</p>
            {(arrives || leaves || point.nights !== null) && (
              <p className="gt-step-meta">
                {[
                  arrives && `${t.arrival}: ${arrives}`,
                  leaves && `${t.departure}: ${leaves}`,
                  point.nights !== null && formatCount(locale, point.nights, nights),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {point.note && <p className="gt-step-meta">{point.note}</p>}
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
  const places =
    journey.mode === 'rail'
      ? railRouteRuns(journey.legs).flatMap((run, index) => (index === 0 ? run : [null, ...run]))
      : journey.points.map((point) => point.place)
  const distanceNote = coverageNote(locale, metrics.distanceCoverage)
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
      </p>
      <dl className="gt-facts">
        <Row label={t.dates}>{dateRange(locale, journey.startDate, journey.endDate)}</Row>
        <Row label={t.distance}>
          {metrics.distanceKm === null
            ? t.distanceUnknown
            : approxDistance(locale, metrics.distanceKm)}
          {metrics.distanceKm === null && distanceNote && <small>{distanceNote}</small>}
        </Row>
        {journey.mode === 'rail' ? (
          <Row label={t.onTrains}>
            {knownDuration(locale, metrics.trainMinutes)}
            {metrics.trainMinutes !== null &&
              coverageNote(locale, metrics.trainMinutesCoverage) && (
                <small>{coverageNote(locale, metrics.trainMinutesCoverage)}</small>
              )}
          </Row>
        ) : (
          <Row label={t.uniqueCities}>
            {metrics.uniqueCities === null
              ? unknownText(locale)
              : formatCount(locale, metrics.uniqueCities, cities)}
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
      <RouteSketch places={places} locale={locale} />
      <h3 className="gt-detail-heading">{t.route}</h3>
      <Steps locale={locale} journey={journey} />
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
