'use client'

import { Check, CircleAlert, PenLine } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import { findAirportLabel } from '@kuuki/data/airport-labels'
import { formatDistanceKm, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { useMobile } from '../ui/use-mobile'
import { AirportPicker } from './airport-picker'
import type { RowOutcome } from './confirm-runner'
import { ROW_FAILURE, S } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import { routeKm } from './flight-input'
import type { Draft } from './import-types'
import { LegEditor, useLegEdit } from './leg-editor'
import { formatMonthDay, OtherYear } from './question-deck'
import {
  answerAirport,
  answerYear,
  monthDayOf,
  ordinalOf,
  type AirportQuestion,
  type Endpoint,
  type YearQuestion,
} from './questions'
import { airlineName } from './reference'
import { fill, R } from './route-copy'
import { hintCity, lineOf, placeCity, type Decision, type Leg, type Place } from './route-model'

export type LandState = 'saved' | 'failed'

const dayFormats: Partial<Record<Locale, Intl.DateTimeFormat>> = {}
export const formatDay = (locale: Locale, date: string) =>
  (dayFormats[locale] ??= new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })).format(new Date(`${date}T12:00:00Z`))

export const legRoute = (leg: Leg) => {
  const end = (place: Place) =>
    place.code ?? (place.hint ? hintCity(place.hint) : placeCity(place, 'en')) ?? '—'
  return `${end(leg.origin)} → ${end(leg.destination)}`
}

const realAirline = (draft: Draft) =>
  draft.fields.airline_iata &&
  draft.fields.airline_iata !== 'ZZ' &&
  !draft.fields.airline_was_placeholder
    ? draft.fields.airline_iata
    : null

export function LegTicket({
  locale,
  leg,
  stored,
  state,
  outcome,
  land,
  year,
  airports,
  frozen,
  today,
  onDecide,
  onChange,
  onDirty,
  onRetry,
  onDiscard,
}: {
  locale: Locale
  leg: Leg
  stored: Draft
  state?: SaveState
  outcome?: RowOutcome
  land?: LandState
  year?: YearQuestion
  airports: AirportQuestion[]
  frozen: boolean
  today: string
  onDecide: (decision: Decision) => void
  onChange: (change: DraftChange) => void
  onDirty: (id: string, dirty: boolean) => void
  onRetry: () => void
  onDiscard: () => void
}) {
  const { draft } = leg
  const mobile = useMobile() === true
  const root = useRef<HTMLLIElement>(null)
  const [picking, setPicking] = useState<Endpoint | null>(null)
  const [editing, setEditing] = useState(false)
  const focusAfter = useRef<'blank' | 'edit' | null>(null)
  const edit = useLegEdit({ locale, draft, stored, state, onDirty, onDiscard })
  const blank = {
    origin: !leg.origin.code,
    destination: !leg.destination.code,
    year: !leg.date,
  }
  const [wasBlank, setWasBlank] = useState(blank)
  if (
    (blank.origin && !wasBlank.origin) ||
    (blank.destination && !wasBlank.destination) ||
    (blank.year && !wasBlank.year)
  )
    setWasBlank({
      origin: wasBlank.origin || blank.origin,
      destination: wasBlank.destination || blank.destination,
      year: wasBlank.year || blank.year,
    })
  const focusLeg = (kind: 'blank' | 'edit') => {
    const node = root.current
    if (!node) return
    const target =
      kind === 'edit'
        ? node.querySelector<HTMLElement>('.leg-edit')
        : (node.querySelector<HTMLElement>('button.leg-blank, .leg-chips button') ??
          node.querySelector<HTMLElement>('[role="radio"][tabindex="0"]'))
    target?.focus()
  }
  useEffect(() => {
    if (!focusAfter.current) return
    const kind = focusAfter.current
    focusAfter.current = null
    focusLeg(kind)
  })

  const line = lineOf(leg)
  const flew = leg.decision === 'flew'
  const future = Boolean(draft.fields.date && draft.fields.date > today)
  const routeLabel = legRoute(leg)
  const monthDay = monthDayOf(draft)
  const ordinal = ordinalOf(draft)
  const dayText = leg.date
    ? formatDay(locale, leg.date)
    : monthDay
      ? formatMonthDay(locale, monthDay, 'short')
      : ordinal !== null
        ? S.ordinalDay[locale].replace('{day}', String(ordinal))
        : null
  const km =
    leg.origin.code && leg.destination.code
      ? Math.round(routeKm(leg.origin.code, leg.destination.code))
      : 0
  const airline = realAirline(draft)
  const carrier = [
    airline ? (airlineName(airline) ?? airline) : null,
    draft.fields.flight_number ? `${airline ?? ''}${draft.fields.flight_number}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const times = [draft.fields.departure_time, draft.fields.arrival_time]
    .filter(Boolean)
    .map((time) => time!.slice(0, 5))
    .join('–')
  const duplicate = draft.duplicateFlightId !== null && !leg.saved
  const done = leg.saved || land === 'saved'
  const settle = (key: 'origin' | 'destination' | 'year') =>
    wasBlank[key] && !blank[key] ? '' : undefined

  const end = (endpoint: Endpoint) => {
    const place = leg[endpoint]
    const city = placeCity(place, locale)
    return (
      <span className="leg-end" data-end={endpoint}>
        {place.code ? (
          <span className="leg-code" data-settle={settle(endpoint)}>
            {place.code}
          </span>
        ) : (
          <button
            type="button"
            className="leg-blank"
            data-attention={flew ? '' : undefined}
            aria-expanded={picking === endpoint}
            aria-label={city ? fill(R.airportFor[locale], { city }) : R.airport[locale]}
            disabled={frozen || done}
            onClick={() => setPicking(picking === endpoint ? null : endpoint)}
          >
            <span aria-hidden="true" />
          </button>
        )}
        <span className="leg-city">{city ?? ' '}</span>
      </span>
    )
  }

  const pickAirport = (endpoint: Endpoint, code: string) => {
    setPicking(null)
    focusAfter.current = 'blank'
    onChange(answerAirport(draft, endpoint, code, today))
  }
  const decisionOptions = [
    { value: 'flew' as const, label: future ? R.flying[locale] : R.flew[locale] },
    { value: 'land' as const, label: R.land[locale] },
    { value: 'skip' as const, label: R.skip[locale] },
  ]

  const problems: string[] = []
  if (outcome?.status === 'failed') problems.push(ROW_FAILURE[outcome.failure][locale])
  if (outcome?.status === 'uncertain') problems.push(S.uncertainRow[locale])
  if (outcome?.status === 'unsent') problems.push(S.unsentRow[locale])
  if (land === 'failed') problems.push(R.landFailed[locale])
  if (draft.issue && !leg.saved && !blank.origin && !blank.destination && !blank.year)
    problems.push(
      draft.issue.code === 'UNKNOWN_AIRPORT'
        ? S.issueUnknownAirport[locale]
        : draft.issue.code === 'UNKNOWN_AIRCRAFT'
          ? S.issueUnknownAircraft[locale]
          : S.issueGeneric[locale],
    )

  return (
    <li ref={root} className="route-leg" data-line={line}>
      <article
        className="leg"
        data-decision={leg.decision ?? undefined}
        data-done={done ? '' : undefined}
        aria-label={`${routeLabel}${dayText ? `, ${dayText}` : ''}`}
      >
        <div className="leg-head">
          <p className="leg-route">
            {end('origin')}
            <span className="leg-arrow" aria-hidden="true">
              →
            </span>
            <span className="sr-only"> {locale === 'ru' ? '—' : 'to'} </span>
            {end('destination')}
          </p>
          <p className="leg-when">
            <span className="leg-date">
              {dayText ? (
                <span data-settle={settle('year')}>{dayText}</span>
              ) : (
                <button
                  type="button"
                  className="leg-blank leg-blank-date"
                  data-attention={flew ? '' : undefined}
                  disabled={frozen || done}
                  onClick={() => setEditing(true)}
                >
                  {R.date[locale]}
                </button>
              )}
              {dayText && blank.year ? (
                <span className="leg-blank leg-blank-year" data-attention={flew ? '' : undefined}>
                  <span className="sr-only">{R.year[locale]}</span>
                </span>
              ) : null}
            </span>
            {km > 0 ? <span className="leg-km">{formatDistanceKm(locale, km)}</span> : null}
          </p>
        </div>
        {carrier || times ? (
          <p className="leg-meta">
            {carrier ? <span>{carrier}</span> : null}
            {times ? <span className="import-code">{times}</span> : null}
          </p>
        ) : null}
        {!done && year ? (
          <div className="leg-chips" role="group" aria-label={S.yearQuestion[locale]}>
            <p className="leg-chips-label">{S.yearQuestion[locale]}</p>
            <div className="leg-chip-row">
              {year.years.map((value) => (
                <Button
                  key={value}
                  dense
                  disabled={frozen}
                  onClick={() => {
                    const change = answerYear(draft, value, today)
                    if (!change) return
                    focusAfter.current = 'blank'
                    onChange(change)
                  }}
                >
                  <span className="import-code">{value}</span>
                </Button>
              ))}
              <OtherYear
                locale={locale}
                max={Number(today.slice(0, 4)) + 1}
                disabled={frozen}
                onApply={(value) => {
                  const change = answerYear(draft, value, today)
                  if (!change) return false
                  focusAfter.current = 'edit'
                  onChange(change)
                  return true
                }}
              />
            </div>
          </div>
        ) : null}
        {done
          ? null
          : airports.flatMap((question) =>
              question.items
                .filter((item) => item.draft.id === draft.id)
                .map(({ endpoint }) => {
                  const city = placeCity(leg[endpoint], locale) ?? question.options[0]
                  const label = S.airportTitle[locale].replace('{city}', city)
                  return (
                    <div
                      key={`${question.key}:${endpoint}`}
                      className="leg-chips"
                      role="group"
                      aria-label={label}
                    >
                      <div className="leg-chip-row">
                        {question.options.map((code) => (
                          <Button
                            key={code}
                            dense
                            disabled={frozen}
                            aria-label={`${code}, ${findAirportLabel(code)?.name ?? code}`}
                            onClick={() => pickAirport(endpoint, code)}
                          >
                            <span className="leg-chip-code">{code}</span>
                            <span className="leg-chip-name">
                              {findAirportLabel(code)?.name ?? ''}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )
                }),
            )}
        {duplicate ? (
          <p className="leg-note">
            {draft.duplicateFlightId === -1 ? R.copy[locale] : R.duplicate[locale]}
          </p>
        ) : null}
        {problems.map((problem) => (
          <p key={problem} className="leg-note" data-tone="danger" role="status">
            <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
            <span>{problem}</span>
          </p>
        ))}
        {edit.statusText ? (
          <p className="leg-note" role="status" data-tone={edit.failed ? 'danger' : undefined}>
            {edit.failed ? <CircleAlert size={16} strokeWidth={2} aria-hidden="true" /> : null}
            <span>{edit.statusText}</span>
          </p>
        ) : null}
        {edit.failed ? (
          <div className="leg-actions">
            <Button dense disabled={frozen} onClick={onRetry}>
              {S.retrySave[locale]}
            </Button>
            <Button dense variant="ghost" disabled={frozen} onClick={edit.discard}>
              {S.discardEdit[locale]}
            </Button>
          </div>
        ) : null}
        {done ? (
          <p className="leg-done">
            <Check size={16} strokeWidth={2} aria-hidden="true" />
            {leg.saved ? R.saved[locale] : R.landSaved[locale]}
          </p>
        ) : (
          <div className="leg-foot">
            <fieldset className="leg-decision" disabled={frozen}>
              <SegmentedControl
                label={fill(R.decision[locale], { route: routeLabel })}
                value={leg.decision}
                options={decisionOptions}
                onChange={onDecide}
              />
            </fieldset>
            <Button
              variant="ghost"
              className="leg-edit"
              aria-label={S.edit[locale]}
              disabled={frozen}
              onClick={() => setEditing(true)}
            >
              <PenLine size={18} aria-hidden="true" />
            </Button>
          </div>
        )}
        <AirportPicker
          locale={locale}
          endpoint={picking}
          mobile={mobile}
          query={
            picking && leg[picking].hint
              ? hintCity(leg[picking].hint!)
              : picking
                ? (placeCity(leg[picking], locale) ?? '')
                : ''
          }
          city={picking ? placeCity(leg[picking], locale) : null}
          onPick={pickAirport}
          onClose={(restore) => {
            if (restore) focusAfter.current = 'blank'
            setPicking(null)
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            focusLeg('blank')
          }}
        />
      </article>
      <LegEditor
        locale={locale}
        draft={draft}
        edit={edit}
        state={state}
        open={editing}
        mobile={mobile}
        frozen={frozen}
        title={`${routeLabel}${dayText ? ` · ${dayText}` : ''}`}
        onOpenChange={setEditing}
        onChange={onChange}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          root.current?.querySelector<HTMLElement>('.leg-edit')?.focus()
        }}
      />
    </li>
  )
}
