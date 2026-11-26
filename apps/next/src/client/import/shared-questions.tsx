'use client'

import { useEffect, useId, useRef } from 'react'
import { findAirportLabel } from '@kuuki/data/airport-labels'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { S } from './copy'
import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import { formatDay, legRoute } from './leg-ticket'
import { formatMonthDay, OtherYear } from './question-deck'
import {
  answerAirport,
  answerYear,
  monthDayOf,
  ordinalOf,
  questionDrafts,
  type AirportQuestion,
  type YearQuestion,
} from './questions'
import { R, rcount } from './route-copy'
import { cityOf } from './reference'
import { hintCity, placeCity, type Leg } from './route-model'

export type SharedQuestion = YearQuestion | AirportQuestion

export function SharedQuestions({
  locale,
  questions,
  legs,
  frozen,
  today,
  onAnswer,
  onDefer,
  onDone,
}: {
  locale: Locale
  questions: SharedQuestion[]
  legs: ReadonlyMap<string, Leg>
  frozen: boolean
  today: string
  onAnswer: (answers: { draft: Draft; change: DraftChange }[]) => void
  onDefer: (key: string) => void
  onDone: () => void
}) {
  const id = useId()
  const root = useRef<HTMLElement>(null)
  const focusAt = useRef<number | null>(null)
  useEffect(() => {
    if (focusAt.current === null || !root.current) return
    const headings = root.current.querySelectorAll<HTMLElement>('h3')
    const target = headings[Math.min(focusAt.current, headings.length - 1)]
    focusAt.current = null
    if (target) target.focus()
    else onDone()
  })
  const when = (draft: Draft) => {
    const monthDay = monthDayOf(draft)
    const ordinal = ordinalOf(draft)
    return monthDay
      ? formatMonthDay(locale, monthDay, 'short')
      : ordinal !== null
        ? S.ordinalDay[locale].replace('{day}', String(ordinal))
        : draft.fields.date
          ? formatDay(locale, draft.fields.date)
          : S.noDate[locale]
  }
  const answer = (index: number, answers: { draft: Draft; change: DraftChange | null }[]) => {
    const sent = answers.filter(
      (entry): entry is { draft: Draft; change: DraftChange } => entry.change !== null,
    )
    if (!sent.length) return false
    focusAt.current = index
    onAnswer(sent)
    return true
  }
  if (!questions.length) return null

  return (
    <section ref={root} className="shared-questions" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="sr-only">
        {R.shared[locale]}
      </h2>
      <ol className="shared-list">
        {questions.map((question, index) => {
          const drafts = questionDrafts(question)
          const titleId = `${id}-${index}`
          if (question.kind === 'year')
            return (
              <li key={question.key} className="shared-q" aria-labelledby={titleId}>
                <div className="shared-q-head">
                  <h3 id={titleId} tabIndex={-1}>
                    {S.yearQuestion[locale]}
                  </h3>
                  <span className="shared-q-count">{rcount(locale, 'legs', drafts.length)}</span>
                </div>
                <ul className="shared-q-legs">
                  {question.drafts.map((draft) => {
                    const leg = legs.get(draft.id)
                    return (
                      <li key={draft.id}>
                        <span className="import-code">{leg ? legRoute(leg) : ''}</span>
                        <span>{when(draft)}</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="leg-chip-row">
                  {question.years.map((year) => (
                    <Button
                      key={year}
                      disabled={frozen}
                      onClick={() =>
                        answer(
                          index,
                          question.drafts.map((draft) => ({
                            draft,
                            change: answerYear(draft, year, today),
                          })),
                        )
                      }
                    >
                      <span className="import-code">{year}</span>
                    </Button>
                  ))}
                  <OtherYear
                    locale={locale}
                    max={Number(today.slice(0, 4)) + 1}
                    disabled={frozen}
                    onApply={(year) =>
                      answer(
                        index,
                        question.drafts.map((draft) => ({
                          draft,
                          change: answerYear(draft, year, today),
                        })),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  dense
                  className="import-text-action"
                  disabled={frozen}
                  onClick={() => {
                    focusAt.current = index
                    onDefer(question.key)
                  }}
                >
                  {R.each[locale]}
                </Button>
              </li>
            )
          const sample = legs.get(question.items[0].draft.id)
          const place = sample?.[question.items[0].endpoint]
          const city = (place ? placeCity(place, locale) : null) ?? cityOf(question.options[0])
          return (
            <li key={question.key} className="shared-q" aria-labelledby={titleId}>
              <div className="shared-q-head">
                <h3 id={titleId} tabIndex={-1}>
                  {S.airportTitle[locale].replace('{city}', city)}
                </h3>
                <span className="shared-q-count">{rcount(locale, 'legs', drafts.length)}</span>
              </div>
              <ul className="shared-q-legs">
                {question.items.map(({ draft, endpoint }) => {
                  const leg = legs.get(draft.id)
                  const other = endpoint === 'origin' ? leg?.destination : leg?.origin
                  const otherText = other?.code ?? (other?.hint ? hintCity(other.hint) : '—')
                  return (
                    <li key={`${draft.id}:${endpoint}`}>
                      <span className="import-code">
                        {endpoint === 'origin' ? (
                          <>
                            <span className="shared-q-gap" aria-label={city} /> → {otherText}
                          </>
                        ) : (
                          <>
                            {otherText} → <span className="shared-q-gap" aria-label={city} />
                          </>
                        )}
                      </span>
                      <span>{when(draft)}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="leg-chip-row" data-airports="">
                {question.options.map((code) => (
                  <Button
                    key={code}
                    disabled={frozen}
                    aria-label={`${code}, ${findAirportLabel(code)?.name ?? code}`}
                    onClick={() =>
                      answer(
                        index,
                        question.items.map(({ draft, endpoint }) => ({
                          draft,
                          change: answerAirport(draft, endpoint, code, today),
                        })),
                      )
                    }
                  >
                    <span className="leg-chip-code">{code}</span>
                    <span className="leg-chip-name">{findAirportLabel(code)?.name ?? ''}</span>
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                dense
                className="import-text-action"
                disabled={frozen}
                onClick={() => {
                  focusAt.current = index
                  onDefer(question.key)
                }}
              >
                {R.each[locale]}
              </Button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
