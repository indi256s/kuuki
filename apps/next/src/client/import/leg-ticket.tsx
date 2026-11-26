'use client'

import { Check, CircleAlert, PenLine } from '@keyline-icons/react'
import { memo, useEffect, useRef, useState } from 'react'
import { formatDistanceKm, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { SegmentedControl } from '../ui/segmented-control'
import { fill } from '../overview/copy'
import { AirportChoices, YearChoices } from './answer-chips'
import { S } from './copy'
import type { DraftChange } from './draft-saver'
import { routeKm } from './flight-input'
import type { LegView } from './import-review'
import { LegEditorSheet, useLegEdit } from './leg-editor'
import { LegPicker } from './leg-picker'
import { answerAirport, answerYear, type Endpoint } from './questions'
import { airlineName } from './reference'
import { R } from './route-copy'
import { airlineOf, dayLabel, legRoute, placeCity, type Decision } from './route-model'

export interface LegActions {
  decide: (id: string, decision: Decision) => void
  change: (id: string, change: DraftChange) => void
  dirty: (id: string, dirty: boolean) => void
  retry: (id: string) => void
  discard: (id: string) => void
}

export const LegTicket = memo(function LegTicket({
  locale,
  view,
  frozen: paused,
  today,
  mobile,
  actions,
}: {
  locale: Locale
  view: LegView
  frozen: boolean
  today: string
  mobile: boolean
  actions: LegActions
}) {
  const { leg, stored, state, blank, done } = view
  const { draft } = leg
  const frozen = paused || view.locked
  const root = useRef<HTMLLIElement>(null)
  const [picking, setPicking] = useState<Endpoint | null>(null)
  const [editing, setEditing] = useState(false)
  const focusAfter = useRef<'blank' | 'edit' | null>(null)
  const change = (next: DraftChange) => actions.change(leg.id, next)
  const edit = useLegEdit({
    locale,
    draft,
    stored,
    state,
    onChange: change,
    onDirty: actions.dirty,
    onDiscard: () => actions.discard(leg.id),
  })
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

  return (
    <li ref={root} className="route-leg" data-line={view.line}>
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
        {view.year ? (
          <div className="leg-chips" role="group" aria-label={S.yearQuestion[locale]}>
            <p className="leg-chips-label">{S.yearQuestion[locale]}</p>
            <YearChoices
              locale={locale}
              years={view.year.years}
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
        {view.airports.map(({ key, endpoint, options }) => {
          const city = placeCity(leg[endpoint], locale) ?? options[0]
          const label = S.airportTitle[locale].replace('{city}', city)
          return (
            <div key={key} className="leg-chips" role="group" aria-label={label}>
              <AirportChoices
                options={options}
                disabled={frozen}
                dense
                onPick={(code) => pickAirport(endpoint, code)}
              />
            </div>
          )
        })}
        {view.duplicate ? <p className="leg-note">{view.duplicate}</p> : null}
        {view.landNote ? <p className="leg-note">{view.landNote}</p> : null}
        {view.problems.map((problem) => (
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
            <Button dense disabled={frozen} onClick={() => actions.retry(leg.id)}>
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
                onChange={(decision) => actions.decide(leg.id, decision)}
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
        <LegPicker
          locale={locale}
          leg={leg}
          picking={picking}
          mobile={mobile}
          onPick={pickAirport}
          onClose={(restore) => {
            if (restore) focusAfter.current = 'blank'
            setPicking(null)
          }}
          onClosed={() => focusLeg('blank')}
        />
      </article>
      <LegEditorSheet
        locale={locale}
        draft={draft}
        edit={edit}
        state={state}
        open={editing}
        mobile={mobile}
        frozen={frozen}
        title={`${routeLabel}${dayText ? ` · ${dayText}` : ''}`}
        onOpenChange={setEditing}
        onClosed={() => focusLeg('edit')}
      />
    </li>
  )
})
