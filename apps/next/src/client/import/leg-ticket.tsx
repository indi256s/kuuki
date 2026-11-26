'use client'

import { Check, CircleAlert, PenLine } from '@keyline-icons/react'
import { memo, useEffect, useRef, useState } from 'react'
import { formatDistanceKm, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { fill } from '../overview/copy'
import { AirportPicker } from './airport-picker'
import { AirportChoices, YearChoices } from './answer-chips'
import type { RowOutcome } from './confirm-runner'
import { issueText, ROW_FAILURE, S } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import { routeKm } from './flight-input'
import type { Draft } from './import-types'
import { LegEditor, useLegEdit } from './leg-editor'
import {
  answerAirport,
  answerYear,
  type AirportQuestion,
  type Endpoint,
  type YearQuestion,
} from './questions'
import { airlineName } from './reference'
import { R } from './route-copy'
import {
  airlineOf,
  dayLabel,
  landOutcome,
  legRoute,
  lineOf,
  placeCity,
  type Decision,
  type Leg,
} from './route-model'
import { isDuplicate } from './review-model'

export type LandState = 'saved' | 'failed'

const NO_AIRPORTS: readonly AirportQuestion[] = []

function useHeld(open: boolean) {
  const [held, setHeld] = useState(false)
  if (open && !held) setHeld(true)
  return [open || held, () => setHeld(false)] as const
}

export const LegTicket = memo(function LegTicket({
  locale,
  leg,
  stored,
  state,
  outcome,
  land,
  year,
  airports = NO_AIRPORTS,
  frozen,
  today,
  mobile,
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
  airports?: readonly AirportQuestion[]
  frozen: boolean
  today: string
  mobile: boolean
  onDecide: (id: string, decision: Decision) => void
  onChange: (id: string, change: DraftChange) => void
  onDirty: (id: string, dirty: boolean) => void
  onRetry: (id: string) => void
  onDiscard: (id: string) => void
}) {
  const { draft } = leg
  const root = useRef<HTMLLIElement>(null)
  const [picking, setPicking] = useState<Endpoint | null>(null)
  const [editing, setEditing] = useState(false)
  const [editorShown, releaseEditor] = useHeld(editing)
  const [pickerShown, releasePicker] = useHeld(mobile && picking !== null)
  const focusAfter = useRef<'blank' | 'edit' | null>(null)
  const change = (next: DraftChange) => onChange(leg.id, next)
  const edit = useLegEdit({
    locale,
    draft,
    stored,
    state,
    onChange: change,
    onDirty,
    onDiscard: () => onDiscard(leg.id),
  })
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
  const routeLabel = legRoute(leg, locale)
  const dayText = dayLabel(draft, locale)
  const km =
    leg.origin.code && leg.destination.code
      ? Math.round(routeKm(leg.origin.code, leg.destination.code))
      : 0
  const airline = airlineOf(draft)
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
  const duplicate = (isDuplicate(draft) || leg.copyOf !== null) && !leg.saved
  const done = leg.saved || land === 'saved'
  const landNote = leg.decision === 'land' && !done ? landOutcome(leg) : null
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
    change(answerAirport(draft, endpoint, code, today))
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
  const issue = issueText(draft, locale)
  if (issue && !leg.saved && !blank.origin && !blank.destination && !blank.year)
    problems.push(issue)

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
            <YearChoices
              locale={locale}
              years={year.years}
              today={today}
              disabled={frozen}
              dense
              onAnswer={(value, typed) => {
                const next = answerYear(draft, value, today)
                if (!next) return false
                focusAfter.current = typed ? 'edit' : 'blank'
                change(next)
                return true
              }}
            />
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
                      <AirportChoices
                        options={question.options}
                        disabled={frozen}
                        dense
                        onPick={(code) => pickAirport(endpoint, code)}
                      />
                    </div>
                  )
                }),
            )}
        {duplicate ? (
          <p className="leg-note">{isDuplicate(draft) ? R.duplicate[locale] : R.copy[locale]}</p>
        ) : null}
        {landNote && landNote !== 'visit' ? (
          <p className="leg-note">
            {landNote === 'same-country' ? R.sameCountry[locale] : R.unknownCountry[locale]}
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
            <Button dense disabled={frozen} onClick={() => onRetry(leg.id)}>
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
                equal
                onChange={(decision) => onDecide(leg.id, decision)}
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
        {picking || pickerShown ? (
          <AirportPicker
            locale={locale}
            endpoint={picking}
            mobile={mobile}
            city={picking ? placeCity(leg[picking], locale) : null}
            onPick={pickAirport}
            onClose={(restore) => {
              if (restore) focusAfter.current = 'blank'
              setPicking(null)
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              releasePicker()
              focusLeg('blank')
            }}
          />
        ) : null}
      </article>
      {editorShown ? (
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
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            releaseEditor()
            root.current?.querySelector<HTMLElement>('.leg-edit')?.focus()
          }}
        />
      ) : null}
    </li>
  )
})
