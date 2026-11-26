'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { findAirportLabel as findAirport } from '@kuuki/data/airport-labels'
import { formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Disclosure } from '../ui/disclosure'
import { S, count } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft } from './import-types'
import {
  answerAirport,
  answerFlown,
  answerNoAirline,
  answerNotFlown,
  answerRestore,
  answerTookFlight,
  answerYear,
  buildQuestions,
  localToday,
  monthDayOf,
  ordinalOf,
  questionDrafts,
  type Endpoint,
  type Question,
} from './questions'
import { cityOf } from './reference'
import { endpointText, RouteEndpoint } from './route-endpoint'
import { OtherYear } from './answer-chips'
import { formatMonthDay } from './day-format'

export interface QuestionDeckProps {
  compact?: boolean
  locale: Locale
  drafts: Draft[]
  saveStates: Record<string, SaveState>
  frozen: boolean
  today?: string
  onChange: (draft: Draft, change: DraftChange) => void
  onRetry: (id: string) => void
}

interface Resolved {
  key: string
  label: string
  ids: string[]
}

export function QuestionDeck({
  locale,
  compact = false,
  drafts,
  saveStates,
  frozen,
  today = localToday(),
  onChange,
  onRetry,
}: QuestionDeckProps) {
  const id = useId()
  const [deferred, setDeferred] = useState<ReadonlySet<string>>(new Set())
  const [notYet, setNotYet] = useState<ReadonlySet<string>>(new Set())
  const questions = useMemo(
    () =>
      buildQuestions(drafts, today).flatMap((question): Question[] => {
        if (question.kind !== 'flown') return [question]
        const waiting = question.drafts.filter((draft) => !notYet.has(draft.id))
        return waiting.length > 0 ? [{ ...question, drafts: waiting }] : []
      }),
    [drafts, today, notYet],
  )
  const [resolved, setResolved] = useState<Resolved[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const focusAt = useRef<number | null>(null)
  const root = useRef<HTMLElement>(null)
  const shown = questions.filter((question) => !deferred.has(question.key))
  const byId = useMemo(() => new Map(drafts.map((draft) => [draft.id, draft])), [drafts])
  const skippedRows = skipped
    .map((rowId) => byId.get(rowId))
    .filter((draft): draft is Draft => draft?.status === 'dismissed')

  useEffect(() => {
    if (focusAt.current === null || !root.current) return
    const headings = root.current.querySelectorAll<HTMLElement>('[data-question-heading]')
    ;(
      headings[Math.min(focusAt.current, headings.length - 1)] ??
      (compact
        ? root.current
            .closest('li')
            ?.querySelector<HTMLElement>(
              'input:not(:disabled), button:not(:disabled):not([aria-disabled="true"])',
            )
        : null) ??
      root.current.querySelector<HTMLElement>('h3')
    )?.focus()
    focusAt.current = null
  })

  if (shown.length === 0 && resolved.length === 0 && skippedRows.length === 0 && !notice)
    return null

  const route = (draft: Draft, gap?: Endpoint) =>
    `${gap === 'origin' ? '?' : endpointText(draft, 'origin')} → ${gap === 'destination' ? '?' : endpointText(draft, 'destination')}`
  const routeView = (draft: Draft) => (
    <>
      <RouteEndpoint draft={draft} endpoint="origin" /> →{' '}
      <RouteEndpoint draft={draft} endpoint="destination" />
    </>
  )
  const when = (draft: Draft) => {
    const monthDay = monthDayOf(draft)
    const ordinal = ordinalOf(draft)
    return draft.fields.date
      ? formatDateOnly(locale, draft.fields.date, 'medium')
      : monthDay
        ? formatMonthDay(locale, monthDay)
        : ordinal !== null
          ? S.ordinalDay[locale].replace('{day}', String(ordinal))
          : S.noDate[locale]
  }
  const saving = (rows: Draft[]) => rows.some((draft) => saveStates[draft.id]?.status === 'saving')
  const failedIds = (ids: string[]) =>
    ids.filter((rowId) => {
      const state = saveStates[rowId]
      return state && state.status !== 'saving'
    })

  const apply = (
    index: number,
    entries: { draft: Draft; change: DraftChange | null }[],
    resolution: { key: string; label: string } | null,
    note?: string,
  ) => {
    const sent = entries.filter(
      (entry): entry is { draft: Draft; change: DraftChange } => entry.change !== null,
    )
    for (const { draft, change } of sent) onChange(draft, change)
    if (resolution)
      setResolved((current) => [
        ...current.filter((item) => item.key !== resolution.key),
        { ...resolution, ids: sent.map((entry) => entry.draft.id) },
      ])
    setNotice(
      resolution ? `${resolution.label}: ${count(locale, 'flightsN', sent.length)}.` : (note ?? ''),
    )
    focusAt.current = index
  }

  const flightList = (rows: Draft[]) =>
    compact ? null : (
      <ul className="import-question-flights">
        {rows.map((draft) => (
          <li key={draft.id} className="import-code">
            {route(draft)} · {when(draft)}
          </li>
        ))}
      </ul>
    )

  const withMore = (rows: ReactNode[], visible: number) =>
    rows.length <= visible ? (
      <ul className="import-question-items">{rows}</ul>
    ) : (
      <>
        <ul className="import-question-items">{rows.slice(0, visible)}</ul>
        <Disclosure summary={count(locale, 'showMore', rows.length - visible)}>
          <ul className="import-question-items">{rows.slice(visible)}</ul>
        </Disclosure>
      </>
    )

  const card = (question: Question, index: number) => {
    const titleId = `${id}-${question.key}`
    const rows = questionDrafts(question)
    const busy = frozen || saving(rows)
    const each = (label: string) => (
      <Button
        variant="ghost"
        className="import-text-action import-each"
        disabled={busy}
        onClick={() => {
          focusAt.current = index
          setDeferred((current) => new Set(current).add(question.key))
        }}
      >
        {label}
      </Button>
    )
    const head = (title: string, body: string) => (
      <div className="import-question-head">
        <div className="import-question-title">
          <h4 id={titleId} tabIndex={-1} data-question-heading>
            {title}
          </h4>
          {compact ? null : (
            <span className="import-question-count">{count(locale, 'flightsN', rows.length)}</span>
          )}
        </div>
        {compact ? null : <p className="import-hint">{body}</p>}
      </div>
    )

    if (question.kind === 'year') {
      const setYear = (year: number) => {
        const entries = question.drafts.map((draft) => ({
          draft,
          change: answerYear(draft, year, today),
        }))
        if (entries.every((entry) => entry.change === null)) return false
        apply(index, entries, {
          key: question.key,
          label: S.yearDone[locale].replace('{year}', String(year)),
        })
        return true
      }
      return (
        <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
          {head(
            S.yearQuestion[locale],
            [
              question.evidence === 'ordinal' ? S.yearOrdinalBody[locale] : S.yearBody[locale],
              question.drafts.length > 1 ? S.yearForAll[locale] : '',
            ]
              .filter(Boolean)
              .join(' '),
          )}
          {compact && question.evidence !== 'ordinal' ? null : (
            <p className="import-question-dates import-code">
              {question.drafts.map(when).join(' · ')}
            </p>
          )}
          <div className="import-question-answers" data-columns="3">
            {question.years.map((year) => (
              <Button key={year} disabled={busy} onClick={() => setYear(year)}>
                <span className="import-code">{year}</span>
              </Button>
            ))}
            <OtherYear
              locale={locale}
              max={Number(today.slice(0, 4)) + 1}
              disabled={busy}
              onApply={setYear}
            />
          </div>
          {compact ? null : each(S.questionsEach[locale])}
        </li>
      )
    }

    if (question.kind === 'flown') {
      return (
        <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
          {head(S.flownQuestion[locale], S.flownBody[locale])}
          {withMore(
            question.drafts.map((draft) => {
              const itemId = `${titleId}-${draft.id}`
              const rowBusy = frozen || saving([draft])
              return (
                <li key={draft.id} role="group" aria-labelledby={itemId}>
                  <p id={itemId} className="import-question-what">
                    <span className="import-question-route">{routeView(draft)}</span>
                    <span className="import-question-meta">
                      {when(draft)}
                      {draft.fields.flight_number ? (
                        <>
                          {' · '}
                          <span className="import-code">
                            {draft.fields.airline_iata}
                            {draft.fields.flight_number}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </p>
                  <div className="import-question-answers" data-pair="true">
                    <Button
                      disabled={rowBusy}
                      onClick={() =>
                        apply(
                          index,
                          [{ draft, change: answerTookFlight(draft, today) }],
                          null,
                          `${route(draft)}: ${S.flownYes[locale]}.`,
                        )
                      }
                    >
                      {S.flownYes[locale]}
                    </Button>
                    <Button
                      disabled={rowBusy}
                      onClick={() => {
                        setNotYet((current) => new Set(current).add(draft.id))
                        apply(index, [], null, `${route(draft)}: ${S.flownNotYetNote[locale]}`)
                      }}
                    >
                      {S.flownNotYet[locale]}
                    </Button>
                  </div>
                </li>
              )
            }),
            3,
          )}
        </li>
      )
    }

    if (question.kind === 'airline') {
      return (
        <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
          {head(S.airlineQuestion[locale], S.airlineBody[locale])}
          {flightList(question.drafts)}
          <div className="import-question-answers">
            <Button
              disabled={busy}
              onClick={() =>
                apply(
                  index,
                  question.drafts.map((draft) => ({
                    draft,
                    change: answerNoAirline(draft, today),
                  })),
                  { key: question.key, label: S.airlineDone[locale] },
                )
              }
            >
              {S.airlineAnswer[locale]}
            </Button>
          </div>
          {compact ? null : each(S.questionsEach[locale])}
        </li>
      )
    }

    if (question.kind === 'airport') {
      const city = cityOf(question.options[0])
      return (
        <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
          {head(S.airportTitle[locale].replace('{city}', city), S.airportBody[locale])}
          {withMore(
            question.items.map(({ draft, endpoint }) => {
              const itemId = `${titleId}-${draft.id}-${endpoint}`
              const rowBusy = frozen || saving([draft])
              const cityName = <span className="import-question-city">{city}</span>
              return (
                <li key={`${draft.id}:${endpoint}`} role="group" aria-labelledby={itemId}>
                  <p id={itemId} className="import-question-what">
                    <span>
                      {endpoint === 'origin' ? (
                        <>
                          {cityName} → <RouteEndpoint draft={draft} endpoint="destination" />
                        </>
                      ) : (
                        <>
                          <RouteEndpoint draft={draft} endpoint="origin" /> → {cityName}
                        </>
                      )}
                    </span>
                    <span className="import-question-meta">{when(draft)}</span>
                  </p>
                  <div className="import-question-answers" data-choices="true">
                    {question.options.map((code) => (
                      <Button
                        key={code}
                        disabled={rowBusy}
                        aria-label={`${code}, ${findAirport(code)?.name ?? code}`}
                        onClick={() =>
                          apply(
                            index,
                            [{ draft, change: answerAirport(draft, endpoint, code, today) }],
                            null,
                            `${route({ ...draft, fields: { ...draft.fields, [endpoint]: code } })}.`,
                          )
                        }
                      >
                        <span className="import-airport-choice">
                          <span className="import-code import-airport-code">{code}</span>
                          <span className="import-airport-name">
                            {findAirport(code)?.name ?? ''}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </li>
              )
            }),
            1,
          )}
          {compact ? null : each(S.questionsEachAirport[locale])}
        </li>
      )
    }

    return (
      <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
        {head(S.statusQuestion[locale], S.statusBody[locale])}
        {withMore(
          question.drafts.map((draft) => {
            const itemId = `${titleId}-${draft.id}`
            const rowBusy = frozen || saving([draft])
            const issue = !draft.fields.origin
              ? S.issueNoOrigin[locale]
              : !draft.fields.destination
                ? S.issueNoDestination[locale]
                : null
            return (
              <li key={draft.id} role="group" aria-labelledby={itemId}>
                <p id={itemId} className="import-question-what">
                  <span className="import-question-route">{routeView(draft)}</span>
                  <span
                    className="import-question-meta"
                    data-tone={issue || !draft.fields.date ? 'warning' : undefined}
                  >
                    {when(draft)}
                    {draft.fields.flight_number ? (
                      <>
                        {' · '}
                        <span className="import-code">
                          {draft.fields.airline_iata}
                          {draft.fields.flight_number}
                        </span>
                      </>
                    ) : null}
                    {issue ? ` · ${issue}` : null}
                  </span>
                </p>
                <div className="import-question-answers" data-pair="true">
                  <Button
                    disabled={rowBusy}
                    onClick={() =>
                      apply(
                        index,
                        [{ draft, change: answerFlown() }],
                        null,
                        `${route(draft)}: ${S.statusFlew[locale]}.`,
                      )
                    }
                  >
                    {S.statusFlew[locale]}
                  </Button>
                  <Button
                    disabled={rowBusy}
                    onClick={() => {
                      setSkipped((current) => [...current, draft.id])
                      apply(
                        index,
                        [{ draft, change: answerNotFlown() }],
                        null,
                        `${route(draft)}: ${S.statusSkipped[locale]}.`,
                      )
                    }}
                  >
                    {S.statusNotFlew[locale]}
                  </Button>
                </div>
              </li>
            )
          }),
          3,
        )}
      </li>
    )
  }

  return (
    <section ref={root} className="import-questions" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="sr-only" tabIndex={-1}>
        {S.questionsTitle[locale]}
      </h3>
      {shown.length > 0 ? <ol className="import-question-list">{shown.map(card)}</ol> : null}
      {!compact && (resolved.length > 0 || skippedRows.length > 0) ? (
        <ul className="import-question-done">
          {resolved.map((item) => {
            const failed = failedIds(item.ids)
            return (
              <li key={item.key}>
                <span>
                  {item.label} · {count(locale, 'flightsN', item.ids.length)}
                </span>
                {saving(
                  item.ids
                    .map((rowId) => byId.get(rowId))
                    .filter((draft): draft is Draft => Boolean(draft)),
                ) ? (
                  <span className="import-hint"> · {S.questionsApplying[locale]}</span>
                ) : null}
                {failed.length > 0 ? (
                  <span className="import-question-failed">
                    {' '}
                    · {count(locale, 'notApplied', failed.length)}{' '}
                    <Button
                      disabled={frozen}
                      onClick={() => failed.forEach((rowId) => onRetry(rowId))}
                    >
                      {S.questionsRetry[locale]}
                    </Button>
                  </span>
                ) : null}
              </li>
            )
          })}
          {skippedRows.map((draft) => (
            <li key={draft.id} className="import-skipped">
              <span className="import-skipped-what">
                <span className="import-skipped-label">{S.statusSkipped[locale]}</span>
                <span className="import-code">
                  {route(draft)} · {when(draft)}
                </span>
              </span>
              <Button
                variant="ghost"
                className="import-text-action"
                disabled={frozen || saving([draft])}
                onClick={() => {
                  onChange(draft, answerRestore())
                  setSkipped((current) => current.filter((rowId) => rowId !== draft.id))
                }}
              >
                {S.statusRestore[locale]}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={compact ? 'sr-only' : 'import-note'} role="status">
        {notice}
      </p>
    </section>
  )
}
