'use client'

import { useRouter } from 'next/navigation'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { OverviewRow } from '@kuuki/shared/overview/model'
import type { MissingAircraftPage } from '@kuuki/shared/overview'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import type { AircraftApi } from '../import/aircraft-panel'
import type { AircraftRun } from '../import/aircraft-review'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { S, fill, forms, t } from './copy'
import '../../app/(member)/import/import.css'
import './missing-aircraft.css'

const AircraftPanel = lazy(() =>
  import('../import/aircraft-panel').then((module) => ({ default: module.AircraftPanel })),
)

type Read = (after: string | null, signal: AbortSignal) => Promise<MissingAircraftPage>

/** Same missing-only keyset contract, backed by the admitted owner payload. */
export function payloadMissingAircraft(
  rows: OverviewRow[],
  after: string | null,
  signal: AbortSignal,
): MissingAircraftPage {
  signal.throwIfAborted()
  const missing = rows
    .filter(
      (row) =>
        row.state !== 'upcoming' &&
        !row.aircraft &&
        row.weight === 1 &&
        Number.isSafeInteger(row.id) &&
        row.id > 0,
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const boundary = after ? /^(.*):(\d+)$/.exec(after) : null
  const candidates = boundary
    ? missing.filter(
        (row) =>
          row.date < boundary[1] || (row.date === boundary[1] && row.id < Number(boundary[2])),
      )
    : missing
  const page = candidates.slice(0, 100),
    last = page.at(-1)
  return {
    period: 'all',
    total: missing.length,
    limit: 100,
    offset: missing.length - candidates.length,
    flights: page.map((row) => ({
      id: row.id,
      flight_number: row.flightNumber,
      airline_iata: row.airline,
      date: row.date,
      origin: row.origin,
      destination: row.destination,
    })),
    nextCursor: candidates.length > page.length && last ? `${last.date}:${last.id}` : null,
  }
}

type Load =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'failed' }
  | { phase: 'ready'; page: MissingAircraftPage; after: string | null; remaining: number }
type Notice = 'more' | 'refresh' | null

/**
 * "N flights have no aircraft listed" with the retained enrichment review (`AircraftPanel`) in a sheet. The review works
 * through the set one page at a time, newest first: "Show the next N" reaches every flight whether or not the earlier ones
 * could be identified or saved, and a confirmed save re-reads the same page (the saved flights leave it, the next ones
 * fill it, the total follows) before the server summary is refreshed.
 */
export function MissingAircraftReview({
  locale,
  count,
  read,
  aircraftApi,
  actionLabel,
  onConfirmedSaved,
}: {
  locale: Locale
  count: number
  read: Read
  actionLabel?: string
  onConfirmedSaved?: (run: AircraftRun) => void
  aircraftApi?: AircraftApi
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>({ phase: 'idle' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [saved, setSaved] = useState(0)
  const [work, setWork] = useState({ busy: false, dirty: false })
  const [discard, setDiscard] = useState<(() => void) | null>(null)
  // Only replace the panel when leaving a page or when all its suggestions were saved.
  const [generation, setGeneration] = useState(0)
  const current = useRef<string | null>(null)
  const pending = useRef<{ controller: AbortController; release: () => void } | null>(null)

  const stop = () => {
    pending.current?.controller.abort()
    pending.current?.release()
    pending.current = null
  }
  useEffect(() => {
    const reset = () => {
      pending.current?.controller.abort()
      pending.current?.release()
      pending.current = null
    }
    window.addEventListener('kuuki:identity-reset', reset)
    return () => {
      reset()
      window.removeEventListener('kuuki:identity-reset', reset)
    }
  }, [])
  /** Reads the page that starts after `after`; `mode` decides what a failure leaves on screen. */
  const fetchPage = (
    after: string | null,
    mode: 'open' | 'next' | 'refresh',
    preserveReview = false,
  ) => {
    stop()
    const controller = new AbortController()
    pending.current = { controller, release: trackPrivateOperation(controller) }
    if (mode === 'open') setLoad({ phase: 'loading' })
    else setBusy(true)
    setNotice(null)
    read(after, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        current.current = after
        // Keep the reviewed boundary: the refreshed page may contain older targets not reviewed yet.
        setLoad((previous) => {
          const retained = preserveReview && previous.phase === 'ready' ? previous.page : null
          const reviewedIds = new Set(retained?.flights.map((flight) => flight.id))
          // Saved rows no longer consume the server cursor's missing-only prefix.
          const consumed = retained
            ? page.flights.filter((flight) => reviewedIds.has(flight.id)).length
            : page.flights.length
          return {
            phase: 'ready',
            after,
            remaining: Math.max(page.total - page.offset - consumed, 0),
            page: retained
              ? { ...page, flights: retained.flights, nextCursor: retained.nextCursor }
              : page,
          }
        })
        if (!preserveReview) {
          setGeneration((value) => value + 1)
          setWork({ busy: false, dirty: false })
        }
        setBusy(false)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        if (mode === 'open') setLoad({ phase: 'failed' })
        else {
          setBusy(false)
          setNotice(mode === 'next' ? 'more' : 'refresh')
        }
      })
  }
  const leaveReview = (action: () => void) => {
    if (work.busy || busy) return
    if (work.dirty) setDiscard(() => action)
    else action()
  }
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setSaved(0)
      current.current = null
      fetchPage(null, 'open')
    } else {
      stop()
      setLoad({ phase: 'idle' })
      setBusy(false)
      setNotice(null)
      setDiscard(null)
      setWork({ busy: false, dirty: false })
    }
  }
  const onOpenChange = (next: boolean) =>
    next ? changeOpen(true) : leaveReview(() => changeOpen(false))
  const onSaved = (run: AircraftRun, unresolved: boolean) => {
    setSaved(
      (value) => value + [...run.rows.values()].filter((row) => row.status === 'saved').length,
    )
    onConfirmedSaved?.(run)
    fetchPage(current.current, 'refresh', unresolved) // the open targets, not just the summary behind the sheet
    router.refresh()
  }

  const page = load.phase === 'ready' ? load.page : null
  const targets =
    page?.flights.map((flight) => ({
      id: flight.id,
      flight_number: flight.flight_number ?? null,
      airline_iata: flight.airline_iata ?? null,
      date: flight.date,
      origin: flight.origin,
      destination: flight.destination,
    })) ?? []
  const shown = page?.flights.length ?? 0
  const remaining = load.phase === 'ready' ? load.remaining : 0
  const num = (n: number) => formatNumber(locale, n)

  if (count <= 0 && !open) return null

  return (
    <div className="ov-missing">
      {count > 0 ? (
        <>
          <span>{formatCount(locale, count, forms.noAircraft)}</span>{' '}
          <Button dense variant="ghost" onClick={() => onOpenChange(true)}>
            {actionLabel ?? t(S.reviewAircraft, locale)}
          </Button>
        </>
      ) : null}
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={t(S.reviewTitle, locale)}
        description={t(S.reviewDescription, locale)}
        closeLabel={t(S.close, locale)}
        side="bottom"
        className="ov-review-sheet"
      >
        <div className="import-page ov-review">
          {load.phase === 'loading' ? (
            <p role="status" className="muted">
              {t(S.reviewLoading, locale)}
            </p>
          ) : null}
          {load.phase === 'failed' ? (
            <div role="alert">
              <p>{t(S.reviewFailed, locale)}</p>
              <Button dense onClick={() => fetchPage(current.current, 'open')}>
                {t(S.retry, locale)}
              </Button>
            </div>
          ) : null}
          {page && page.total === 0 && !work.dirty ? (
            <p className="muted">{t(S.reviewNone, locale)}</p>
          ) : null}
          {page && (page.total > 0 || work.dirty) ? (
            <>
              {saved > 0 ? (
                <p role="status" className="muted">
                  {formatCount(locale, saved, forms.aircraftSaved)}
                </p>
              ) : null}
              {(!work.dirty || saved === 0) && (page.offset > 0 || page.nextCursor) ? (
                <p className="muted">
                  {fill(t(S.reviewRange, locale), {
                    from: num(page.offset + (shown > 0 ? 1 : 0)),
                    to: num(page.offset + shown),
                    total: num(page.total),
                  })}
                </p>
              ) : null}
              {notice === 'refresh' ? (
                <div role="alert">
                  <p>{t(S.reviewRefreshFailed, locale)}</p>
                  <Button
                    dense
                    disabled={busy || work.busy}
                    onClick={() => fetchPage(current.current, 'refresh', work.dirty)}
                  >
                    {t(S.retry, locale)}
                  </Button>
                </div>
              ) : null}
              {targets.length === 0 ? (
                <p className="muted">{t(S.reviewEnd, locale)}</p>
              ) : (
                <Suspense
                  fallback={
                    <p role="status" className="muted">
                      {t(S.reviewLoading, locale)}
                    </p>
                  }
                >
                  <AircraftPanel
                    key={generation}
                    locale={locale}
                    targets={targets}
                    api={aircraftApi}
                    onSaved={onSaved}
                    onWorkChange={setWork}
                  />
                </Suspense>
              )}
              {work.busy ? (
                <p role="status" className="muted">
                  {t(S.reviewWorking, locale)}
                </p>
              ) : null}
              {discard ? (
                <div role="alert">
                  <p>{t(S.reviewDiscard, locale)}</p>
                  <Button
                    dense
                    disabled={busy || work.busy}
                    onClick={() => {
                      setDiscard(null)
                      discard()
                    }}
                  >
                    {t(S.reviewDiscardContinue, locale)}
                  </Button>
                  <Button dense variant="ghost" onClick={() => setDiscard(null)}>
                    {t(S.reviewKeep, locale)}
                  </Button>
                </div>
              ) : null}
              {work.dirty && saved > 0 ? (
                <>
                  <p className="muted">{t(S.reviewRetained, locale)}</p>
                  <Button
                    dense
                    disabled={busy || work.busy}
                    onClick={() => leaveReview(() => fetchPage(current.current, 'refresh'))}
                  >
                    {t(S.reviewReload, locale)}
                  </Button>
                </>
              ) : null}
              {notice === 'more' ? (
                <div role="alert">
                  <p>{t(S.reviewMoreFailed, locale)}</p>
                </div>
              ) : null}
              <div className="import-actions">
                {page.nextCursor && remaining > 0 ? (
                  <Button
                    dense
                    loading={busy}
                    disabled={work.busy}
                    loadingLabel={t(S.reviewLoading, locale)}
                    onClick={() => leaveReview(() => fetchPage(page.nextCursor, 'next'))}
                  >
                    {formatCount(locale, Math.min(page.limit, remaining), forms.showNext)}
                  </Button>
                ) : null}
                {page.offset > 0 ? (
                  <Button
                    dense
                    variant="ghost"
                    disabled={busy || work.busy}
                    onClick={() => leaveReview(() => fetchPage(null, 'open'))}
                  >
                    {t(S.reviewStartOver, locale)}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </div>
  )
}
