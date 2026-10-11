'use client'

import clsx from 'clsx'
import { Calendar } from 'lucide-react'
import { useState } from 'react'
import type { Locale } from '../../../lib/format'
import type { DraftChange } from '../../import/draft-saver'
import type { Draft } from '../../import/import-types'
import { answerAirport, answerFlown, answerNotFlown } from '../../import/questions'
import { COPY } from './copy'
import {
  airportName,
  answerDate,
  datePlaceholder,
  dateText,
  flightText,
  openCity,
  openEndpoints,
  routeText,
  validDate,
  type Kind,
} from './rows'

type Fix = Exclude<Kind, 'other'>

/** One unsure flight with its one-tap fix (boards 15.5, 15.9, 18.x). Resolved rows leave the group, so no state is kept for them. */
export function UnsureCard({
  locale,
  draft,
  kind,
  disabled,
  onChange,
}: {
  locale: Locale
  draft: Draft
  kind: Fix
  disabled: boolean
  onChange: (change: DraftChange) => void
}) {
  const t = (entry: { en: string; ru: string }) => entry[locale]
  const route = routeText(draft)
  const open = openEndpoints(draft)
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)

  const tag =
    kind === 'airport'
      ? t(COPY.whichCity).replace('{city}', open[0] ? openCity(draft, open[0]) : '')
      : kind === 'date'
        ? t(COPY.dayMissing)
        : t(COPY.maybeCancelled)

  function commitDate() {
    const typed = value.trim()
    if (!typed) {
      setInvalid(false)
      return
    }
    if (!validDate(draft, typed)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(answerDate(draft, typed))
  }

  const leaveOut = (
    <button
      type="button"
      className="review-button"
      data-quiet={kind === 'date' ? 'true' : undefined}
      disabled={disabled}
      aria-label={`${t(COPY.leaveOut)}: ${route}`}
      onClick={() => onChange(answerNotFlown())}
    >
      {t(COPY.leaveOut)}
    </button>
  )

  return (
    <li className="review-card" data-kind={kind}>
      <div className="review-head">
        <span className="review-route">{route}</span>
        <span className="review-meta">
          <span className="review-date" data-problem={kind === 'date' ? 'true' : undefined}>
            {dateText(draft)}
          </span>
          <span className="review-sep" aria-hidden="true">
            ·
          </span>
          <span className="review-flight">{flightText(draft)}</span>
        </span>
        <span className="review-tag">{tag}</span>
      </div>
      {kind === 'airport'
        ? open.map((endpoint) => {
            const city = openCity(draft, endpoint)
            return (
              <div
                key={endpoint}
                className="review-chips"
                data-grid={
                  (draft.fields[`${endpoint}_options`]?.length ?? 0) > 4 ? 'true' : undefined
                }
                role="group"
                aria-label={t(COPY.chipsLabel).replace('{city}', city)}
              >
                {(draft.fields[`${endpoint}_options`] ?? []).map((code) => {
                  const name = airportName(code)
                  const nameId = `${draft.id}-${endpoint}-${code}-name`
                  return (
                    <button
                      key={code}
                      type="button"
                      className="review-chip"
                      aria-label={code}
                      aria-pressed={draft.fields[endpoint] === code}
                      aria-describedby={name ? nameId : undefined}
                      disabled={disabled}
                      onClick={() => onChange(answerAirport(draft, endpoint, code))}
                    >
                      <span className="review-chip-code">{code}</span>
                      {name ? (
                        <span id={nameId} className="review-chip-name">
                          {name}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })
        : null}
      {kind === 'date' ? (
        <div className="review-fix">
          <label className={clsx('review-date-field', invalid && 'is-invalid')}>
            <span className="sr-only">{t(COPY.dateLabel).replace('{route}', route)}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              value={value}
              placeholder={datePlaceholder(draft)}
              disabled={disabled}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? `${draft.id}-date-error` : undefined}
              onChange={(event) => {
                setValue(event.target.value)
                setInvalid(false)
              }}
              onBlur={commitDate}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                commitDate()
              }}
            />
            <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />
          </label>
          {leaveOut}
        </div>
      ) : null}
      {kind === 'date' && invalid ? (
        <p id={`${draft.id}-date-error`} className="review-error" role="alert">
          {t(COPY.dateInvalid)}
        </p>
      ) : null}
      {kind === 'status' ? (
        <div className="review-fix" data-equal="true">
          <button
            type="button"
            className="review-button"
            disabled={disabled}
            aria-label={`${t(COPY.flewIt)}: ${route}`}
            onClick={() => onChange(answerFlown())}
          >
            {t(COPY.flewIt)}
          </button>
          {leaveOut}
        </div>
      ) : null}
    </li>
  )
}
