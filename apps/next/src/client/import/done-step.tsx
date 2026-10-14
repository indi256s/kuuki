'use client'

import { CircleAlert } from '@keyline-icons/react'
import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { formatDateOnly, formatInstantDate, formatNumber, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Stamp } from '../signature/stamp'
import { S, count } from './copy'
import type { AircraftApi } from './aircraft-panel'
import { AircraftPanel } from './aircraft-panel'
import type { AircraftRun, AircraftTarget } from './aircraft-review'

export interface FailedRow {
  key: string
  label: string
  message: string
  retryable: boolean
}
export interface NewStamp {
  code: string
  name: string
  eventId: string
}

export const MAX_STAMPS = 8

export function DoneStep({
  locale,
  savedCount,
  requested,
  totalKm,
  newCountries,
  stamps,
  publication,
  failures,
  retryCount,
  retrying,
  checking,
  checkFailed,
  remaining,
  expiresAt = null,
  aircraftTargets,
  aircraftApi,
  theme,
  retryBlocked,
  onRetry,
  onReview,
  onImportMore,
  onAircraftSaved,
}: {
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
  /** When the stored batch is removed; the line about it is left out without it. */
  expiresAt?: string | null
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
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const partial = failures.length > 0
  const shown = stamps.slice(0, MAX_STAMPS)
  // The Passport hero carries at most MAX_STAMPS stamps; with more, Passport opens without it.
  const hero = stamps.length > 0 && stamps.length <= MAX_STAMPS
  const total = requested || savedCount + failures.length
  const km =
    totalKm > 0
      ? `${formatNumber(locale, Math.round(totalKm))}\u00a0${locale === 'ru' ? 'км' : 'km'}`
      : null
  const countries =
    newCountries !== null && newCountries > 0 ? count(locale, 'newCountries', newCountries) : null
  const summary = [km, countries].filter(Boolean).join(` ${S.summaryAnd[locale]} `)
  // Long localized names (United Arab Emirates) use the short form the locale data offers (UAE / ОАЭ).
  const shortNames = new Intl.DisplayNames([locale], { type: 'region', style: 'short' })
  const stampName = ({ code, name }: NewStamp) => {
    const short = name.length > 14 ? shortNames.of(code) : undefined
    return short && short.length < name.length ? short : name
  }
  return (
    <section className="import-done" aria-labelledby="import-done-title">
      {/* Static results as saved, with no count-up. */}
      <h2
        id="import-done-title"
        ref={heading}
        tabIndex={-1}
        className={partial ? undefined : 'sr-only'}
      >
        {partial ? S.partialSaved[locale] : S.savedHeading[locale]}
      </h2>
      {partial ? (
        <p className="import-summary" data-testid="import-summary">
          {count(locale, 'savedOf', savedCount)} {locale === 'ru' ? 'из' : 'of'}{' '}
          {formatNumber(locale, total)}
        </p>
      ) : (
        <p className="import-hero" data-testid="import-summary">
          <span className="import-hero-count">{formatNumber(locale, savedCount)}</span>{' '}
          <span className="import-hero-label">{count(locale, 'flightsAdded', savedCount)}</span>
        </p>
      )}
      {summary ? <p className="import-done-summary">{summary}.</p> : null}
      {partial ? null : <p className="import-hint import-done-note">{S.doneNote[locale]}</p>}
      {checking ? (
        <p className="import-hint" role="status">
          {S.checkingSaved[locale]}
        </p>
      ) : null}
      {checkFailed ? (
        <p className="import-problem" role="alert">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{S.checkFailed[locale]}</span>
        </p>
      ) : null}
      {publication === 'pending' ? (
        <p className="import-hint" role="status">
          {S.stampsWaiting[locale]}
        </p>
      ) : null}
      {publication === 'delayed' ? (
        <p className="import-hint" role="status">
          {S.stampsDelayed[locale]}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <div className="import-stamps">
          <h3>{S.newCountries[locale]}</h3>
          <div className="import-stamp-rail">
            {shown.map((stamp) => (
              <Stamp
                key={stamp.code}
                countryCode={stamp.code}
                nativeName={stampName(stamp)}
                kind="air"
                theme={theme}
                locale={locale}
                pressEventId={stamp.eventId}
                heroExitKey={hero ? stamp.code : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}

      {partial ? (
        <div className="import-failed">
          <h3>{S.failedList[locale]}</h3>
          <ul className="import-rows">
            {failures.map((failure) => (
              <li key={failure.key} className="import-row">
                <p className="import-row-meta">
                  <span>{failure.label}</span>
                </p>
                <p className="import-note">{failure.message}</p>
              </li>
            ))}
          </ul>
          <div className="import-actions">
            {retryCount > 0 ? (
              <Button
                variant="primary"
                loading={retrying}
                loadingLabel={S.importing[locale]}
                disabledReason={retryBlocked}
                onClick={onRetry}
              >
                {count(locale, 'retryFor', retryCount)}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {aircraftTargets.length > 0 ? (
        <AircraftPanel
          locale={locale}
          targets={aircraftTargets}
          onSaved={onAircraftSaved}
          api={aircraftApi}
        />
      ) : null}

      <div className="import-actions import-final-actions">
        {/* Stamps appear only after the write refreshed the router, and every later write refreshes it again, so a full prefetch from here stays fresh. */}
        <Link
          className="ui-button"
          data-variant="primary"
          href="/passport"
          prefetch={hero ? true : undefined}
        >
          {S.passport[locale]}
        </Link>
        <a className="ui-button" data-variant="secondary" href="/journal">
          {S.journal[locale]}
        </a>
        <Button onClick={onImportMore}>{S.importMore[locale]}</Button>
      </div>

      {remaining > 0 ? (
        <div className="import-remaining">
          <Button variant="ghost" className="import-text-action import-each" onClick={onReview}>
            {partial ? S.backToReview[locale] : count(locale, 'stillInReview', remaining)}
          </Button>
          {expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? (
            <p className="import-hint">
              {S.retentionDone[locale].replace(
                '{date}',
                formatInstantDate(locale, expiresAt, 'medium'),
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export const rowLabel = (
  locale: Locale,
  fields: { origin: string; destination: string; date: string },
) =>
  `${fields.origin} → ${fields.destination}${fields.date ? ` · ${formatDateOnly(locale, fields.date, 'medium')}` : ''}`
