'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { formatDateOnly, formatNumber, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Stamp } from '../signature/stamp'
import { S, count } from './copy'
import type { AircraftApi } from './aircraft-panel'
import { AircraftPanel } from './aircraft-panel'
import type { AircraftRun, AircraftTarget } from './aircraft-review'

export interface FailedRow { key: string; label: string; message: string; retryable: boolean }
export interface NewStamp { code: string; name: string; eventId: string }

export const MAX_STAMPS = 8

export function DoneStep({ locale, savedCount, requested, totalKm, newCountries, stamps, publication, failures, retryCount, retrying, checking, checkFailed, remaining, aircraftTargets, aircraftApi, theme, retryBlocked, onRetry, onReview, onImportMore, onAircraftSaved }: {
  locale: Locale
  savedCount: number
  /** Rows the member asked to save in this session (0 when the page was resumed on a finished batch). */
  requested: number
  totalKm: number
  /** null while unknown (totals not published yet, or the page was resumed): the line is left out rather than guessed. */
  newCountries: number | null
  stamps: NewStamp[]
  publication: 'idle' | 'ready' | 'pending' | 'delayed'
  failures: FailedRow[]
  retryCount: number
  retrying: boolean
  checking: boolean
  checkFailed: boolean
  /** Flights (rows in review and manual rows) still waiting after this save; the member can return to them. */
  remaining: number
  aircraftTargets: AircraftTarget[]
  aircraftApi?: AircraftApi
  theme: 'light' | 'dark'
  /** Why the retry is held back (corrections on the review page are not saved yet); shown beside the button. */
  retryBlocked?: ReactNode
  onRetry: () => void
  onReview: () => void
  onImportMore: () => void
  onAircraftSaved: (run: AircraftRun) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const partial = failures.length > 0
  const shown = stamps.slice(0, MAX_STAMPS)
  const total = requested || savedCount + failures.length
  const chunks: ReactNode[] = [
    <strong key="added">{partial ? `${count(locale, 'savedOf', savedCount)} ${locale === 'ru' ? 'из' : 'of'} ${formatNumber(locale, total)}` : count(locale, 'added', savedCount)}</strong>,
    ...(newCountries !== null && newCountries > 0 ? [<span key="countries">{count(locale, 'newCountries', newCountries)}</span>] : []),
    ...(totalKm > 0 ? [<span key="km" className="import-code">{formatNumber(locale, Math.round(totalKm))} {locale === 'ru' ? 'км' : 'km'}</span>] : []),
  ]
  return <section className="import-done" aria-labelledby="import-done-title">
    <h2 id="import-done-title" ref={heading} tabIndex={-1}>{partial ? S.partialSaved[locale] : S.savedHeading[locale]}</h2>
    <p className="import-summary" data-testid="import-summary">{chunks.map((chunk, index) => <span key={index} className="import-summary-chunk" style={{ ['--stagger' as string]: `${index * 100}ms` }}>{index > 0 ? ' · ' : ''}{chunk}</span>)}</p>
    {checking ? <p className="import-hint" role="status">{S.checkingSaved[locale]}</p> : null}
    {checkFailed ? <p className="import-problem" role="alert">{S.checkFailed[locale]}</p> : null}
    {publication === 'pending' ? <p className="import-hint" role="status">{S.stampsWaiting[locale]}</p> : null}
    {publication === 'delayed' ? <p className="import-hint" role="status">{S.stampsDelayed[locale]}</p> : null}

    {shown.length > 0 ? <div className="import-stamps">
      <h3>{S.newCountries[locale]}</h3>
      <div className="import-stamp-grid">{shown.map(stamp =>
        <Stamp key={stamp.code} countryCode={stamp.code} nativeName={stamp.name} kind="air" theme={theme} locale={locale} pressEventId={stamp.eventId} />)}</div>
    </div> : null}

    {partial ? <div className="import-failed">
      <h3>{S.failedList[locale]}</h3>
      <ul className="import-rows">{failures.map(failure => <li key={failure.key} className="import-row"><p className="import-row-meta"><span>{failure.label}</span></p><p className="import-note">{failure.message}</p></li>)}</ul>
      <div className="import-actions">
        {retryCount > 0 ? <Button variant="primary" loading={retrying} loadingLabel={S.importing[locale]} disabledReason={retryBlocked} onClick={onRetry}>{count(locale, 'retryFor', retryCount)}</Button> : null}
      </div>
    </div> : null}

    {remaining > 0 ? <div className="import-remaining">
      <p className="import-hint" role="status">{count(locale, 'remaining', remaining)}</p>
      <div className="import-actions"><Button onClick={onReview}>{partial ? S.backToReview[locale] : S.reviewRemaining[locale]}</Button></div>
    </div> : null}

    {aircraftTargets.length > 0 ? <AircraftPanel locale={locale} targets={aircraftTargets} onSaved={onAircraftSaved} api={aircraftApi} /> : null}

    <div className="import-actions import-final-actions">
      <a className="ui-button" data-variant="primary" href="/passport">{S.passport[locale]}</a>
      <a className="ui-button" data-variant="secondary" href="/journal">{S.journal[locale]}</a>
      <Button onClick={onImportMore}>{S.importMore[locale]}</Button>
    </div>
  </section>
}

export const rowLabel = (locale: Locale, fields: { origin: string; destination: string; date: string }) =>
  `${fields.origin} → ${fields.destination}${fields.date ? ` · ${formatDateOnly(locale, fields.date, 'medium')}` : ''}`
