'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { api } from '../../../../web/src/lib/apiClient'
import type { MissingAircraftPage } from '../../../../../packages/shared/src/overview'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import { AircraftPanel, type AircraftApi } from '../import/aircraft-panel'
import type { AircraftRun } from '../import/aircraft-review'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { S, fill, forms, t } from './copy'
import '../../app/(member)/import/import.css'

type Read = (period: string, after: string | null, signal: AbortSignal) => Promise<MissingAircraftPage>

/** Owner-scoped keyset page (at most 100, newest first) of the same set the summary counts: completed flights of the period with no aircraft. */
export const readMissingAircraft: Read = (period, after, signal) =>
  api.get<MissingAircraftPage>('/api/me/overview/missing-aircraft', { period, ...(after ? { after } : {}) }, { signal })

type Load = { phase: 'idle' } | { phase: 'loading' } | { phase: 'failed' } | { phase: 'ready'; page: MissingAircraftPage; after: string | null }
type Notice = 'more' | 'refresh' | null

/**
 * "N flights have no aircraft listed" with the retained enrichment review (`AircraftPanel`) in a sheet. The review works
 * through the set one page at a time, newest first: "Show the next N" reaches every flight whether or not the earlier ones
 * could be identified or saved, and a confirmed save re-reads the same page (the saved flights leave it, the next ones
 * fill it, the total follows) before the server summary is refreshed.
 */
export function MissingAircraftReview({ locale, period, count, read = readMissingAircraft, aircraftApi }: {
  locale: Locale
  period: string
  count: number
  read?: Read
  aircraftApi?: AircraftApi
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>({ phase: 'idle' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [saved, setSaved] = useState(0)
  // A new panel (fresh suggestions) for every page the sheet shows; saved flights are never offered again.
  const [generation, setGeneration] = useState(0)
  const current = useRef<string | null>(null)
  const pending = useRef<{ controller: AbortController; release: () => void } | null>(null)

  const stop = () => { pending.current?.controller.abort(); pending.current?.release(); pending.current = null }
  /** Reads the page that starts after `after`; `mode` decides what a failure leaves on screen. */
  const fetchPage = (after: string | null, mode: 'open' | 'next' | 'refresh') => {
    stop()
    const controller = new AbortController()
    pending.current = { controller, release: trackPrivateOperation(controller) }
    if (mode === 'open') setLoad({ phase: 'loading' }); else setBusy(true)
    setNotice(null)
    read(period, after, controller.signal).then(page => {
      if (controller.signal.aborted) return
      current.current = after
      setLoad({ phase: 'ready', page, after })
      setGeneration(value => value + 1)
      setBusy(false)
    }).catch(() => {
      if (controller.signal.aborted) return
      if (mode === 'open') setLoad({ phase: 'failed' }); else { setBusy(false); setNotice(mode === 'next' ? 'more' : 'refresh') }
    })
  }
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) { setSaved(0); current.current = null; fetchPage(null, 'open') } else { stop(); setLoad({ phase: 'idle' }); setBusy(false); setNotice(null) }
  }
  const onSaved = (run: AircraftRun) => {
    setSaved(value => value + [...run.rows.values()].filter(row => row.status === 'saved').length)
    fetchPage(current.current, 'refresh') // the open targets, not just the summary behind the sheet
    router.refresh()
  }

  const page = load.phase === 'ready' ? load.page : null
  const shown = page?.flights.length ?? 0
  const remaining = page ? Math.max(page.total - page.offset - shown, 1) : 0
  const num = (n: number) => formatNumber(locale, n)

  return <div className="ov-missing"><span>{formatCount(locale, count, forms.noAircraft)}</span>{' '}
    <Button dense variant="ghost" onClick={() => onOpenChange(true)}>{t(S.reviewAircraft, locale)}</Button>
    <Sheet open={open} onOpenChange={onOpenChange} title={t(S.reviewTitle, locale)} description={t(S.reviewDescription, locale)} closeLabel={t(S.close, locale)} side="bottom" className="ov-review-sheet">
      <div className="import-page ov-review" data-testid="overview-aircraft-review">
        {load.phase === 'loading' ? <p role="status" className="muted">{t(S.reviewLoading, locale)}</p> : null}
        {load.phase === 'failed' ? <div role="alert"><p>{t(S.reviewFailed, locale)}</p><Button dense onClick={() => fetchPage(current.current, 'open')}>{t(S.retry, locale)}</Button></div> : null}
        {page && page.total === 0 ? <p className="muted">{t(S.reviewNone, locale)}</p> : null}
        {page && page.total > 0 ? <>
          {saved > 0 ? <p role="status" className="muted">{formatCount(locale, saved, forms.aircraftSaved)}</p> : null}
          {page.offset > 0 || page.nextCursor ? <p className="muted">{fill(t(S.reviewRange, locale), { from: num(page.offset + (shown > 0 ? 1 : 0)), to: num(page.offset + shown), total: num(page.total) })}</p> : null}
          {notice === 'refresh' ? <div role="alert"><p>{t(S.reviewRefreshFailed, locale)}</p><Button dense onClick={() => fetchPage(current.current, 'refresh')}>{t(S.retry, locale)}</Button></div> : null}
          {shown === 0 ? <p className="muted">{t(S.reviewEnd, locale)}</p> : <AircraftPanel key={generation} locale={locale} targets={page.flights.map(flight => ({ id: flight.id,
            flight_number: flight.flight_number ?? null, airline_iata: flight.airline_iata ?? null, date: flight.date, origin: flight.origin, destination: flight.destination }))}
            api={aircraftApi} onSaved={onSaved} />}
          {notice === 'more' ? <div role="alert"><p>{t(S.reviewMoreFailed, locale)}</p></div> : null}
          <div className="import-actions">
            {page.nextCursor ? <Button dense loading={busy} loadingLabel={t(S.reviewLoading, locale)} onClick={() => fetchPage(page.nextCursor, 'next')}>{formatCount(locale, Math.min(page.limit, remaining), forms.showNext)}</Button> : null}
            {page.offset > 0 ? <Button dense variant="ghost" disabled={busy} onClick={() => fetchPage(null, 'open')}>{t(S.reviewStartOver, locale)}</Button> : null}
          </div>
        </> : null}
      </div>
    </Sheet>
  </div>
}
