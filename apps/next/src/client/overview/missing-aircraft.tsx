'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { api } from '../../../../web/src/lib/apiClient'
import { formatCount, type Locale } from '../../lib/format'
import { trackPrivateOperation } from '../activity'
import { AircraftPanel, type AircraftApi } from '../import/aircraft-panel'
import type { AircraftTarget } from '../import/aircraft-review'
import { Button } from '../ui/button'
import { Sheet } from '../ui/sheet'
import { S, fill, forms, t } from './copy'
import '../../app/(member)/import/import.css'

/** The review works through the newest flights first; each saved batch refreshes the count and brings the next ones in. */
export const REVIEW_LIMIT = 100

type FlightRead = { flights: Array<Pick<AircraftTarget, 'id' | 'flight_number' | 'airline_iata' | 'date' | 'origin' | 'destination'>>; total: number }
type Load = { phase: 'idle' } | { phase: 'loading' } | { phase: 'failed' } | { phase: 'ready'; targets: AircraftTarget[]; total: number }

/** Owner-scoped read of the same set the summary counts: completed flights of the period with no aircraft (`?missing=aircraft`). */
export const readMissingAircraft = (period: string, signal: AbortSignal) =>
  api.get<FlightRead>('/api/flights', { status: 'completed', missing: 'aircraft', ...(period === 'all' ? {} : { year: period }), limit: REVIEW_LIMIT, sort: 'date', order: 'desc' }, { signal })

/**
 * "N flights have no aircraft listed" with the retained enrichment review (`AircraftPanel`) in a sheet. Targets are read
 * when the sheet opens, so they match the summary's count; after a confirmed write the server summary is re-read.
 */
export function MissingAircraftReview({ locale, period, count, read = readMissingAircraft, aircraftApi }: {
  locale: Locale
  period: string
  count: number
  read?: typeof readMissingAircraft
  aircraftApi?: AircraftApi
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>({ phase: 'idle' })
  const pending = useRef<{ controller: AbortController; release: () => void } | null>(null)

  const stop = () => { pending.current?.controller.abort(); pending.current?.release(); pending.current = null }
  const start = () => {
    stop()
    const controller = new AbortController()
    pending.current = { controller, release: trackPrivateOperation(controller) }
    setLoad({ phase: 'loading' })
    read(period, controller.signal).then(answer => {
      if (controller.signal.aborted) return
      setLoad({ phase: 'ready', total: answer.total, targets: answer.flights.map(flight => ({ id: flight.id, flight_number: flight.flight_number ?? null,
        airline_iata: flight.airline_iata ?? null, date: flight.date, origin: flight.origin, destination: flight.destination })) })
    }).catch(() => { if (!controller.signal.aborted) setLoad({ phase: 'failed' }) })
  }
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) start()
    else { stop(); setLoad({ phase: 'idle' }) }
  }

  return <div className="ov-missing"><span>{formatCount(locale, count, forms.noAircraft)}</span>{' '}
    <Button dense variant="ghost" onClick={() => onOpenChange(true)}>{t(S.reviewAircraft, locale)}</Button>
    <Sheet open={open} onOpenChange={onOpenChange} title={t(S.reviewTitle, locale)} description={t(S.reviewDescription, locale)} closeLabel={t(S.close, locale)} side="bottom" className="ov-review-sheet">
      <div className="import-page ov-review" data-testid="overview-aircraft-review">
        {load.phase === 'loading' ? <p role="status" className="muted">{t(S.reviewLoading, locale)}</p> : null}
        {load.phase === 'failed' ? <div role="alert"><p>{t(S.reviewFailed, locale)}</p><Button dense onClick={start}>{t(S.retry, locale)}</Button></div> : null}
        {load.phase === 'ready' && load.targets.length === 0 ? <p className="muted">{t(S.reviewNone, locale)}</p> : null}
        {load.phase === 'ready' && load.targets.length > 0 ? <>
          {load.total > load.targets.length ? <p className="muted">{fill(t(S.reviewShowing, locale), { shown: load.targets.length, total: load.total })}</p> : null}
          <AircraftPanel locale={locale} targets={load.targets} api={aircraftApi} onSaved={() => router.refresh()} />
        </> : null}
      </div>
    </Sheet>
  </div>
}
