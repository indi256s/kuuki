'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { AirportChoices, YearChoices } from './answer-chips'
import { S } from './copy'
import type { DraftChange } from './draft-saver'
import type { Draft } from './import-types'
import { answerAirport, answerYear, questionDrafts, type SharedQuestion } from './questions'
import { R, rcount } from './route-copy'
import { cityOf } from './reference'
import { dayLabel, endpointLabel, legRoute, placeCity, type Leg } from './route-model'
import './shared-questions.css'

type Answer = { draft: Draft; change: DraftChange | null }

function QuestionCard({
  locale,
  titleId,
  title,
  count,
  frozen,
  legs,
  choices,
  onDefer,
}: {
  locale: Locale
  titleId: string
  title: string
  count: number
  frozen: boolean
  legs: ReactNode
  choices: ReactNode
  onDefer: () => void
}) {
  return (
    <li className="shared-q" aria-labelledby={titleId}>
      <div className="shared-q-head">
        <h3 id={titleId} tabIndex={-1}>
          {title}
        </h3>
        <span className="shared-q-count">{rcount(locale, 'legs', count)}</span>
      </div>
      <ul className="shared-q-legs">{legs}</ul>
      {choices}
      <Button
        variant="ghost"
        dense
        className="import-text-action"
        disabled={frozen}
        onClick={onDefer}
      >
        {R.each[locale]}
      </Button>
    </li>
  )
}

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
  const when = (draft: Draft) => dayLabel(draft, locale) ?? S.noDate[locale]
  const answer = (index: number, answers: Answer[]) => {
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
          const card = {
            locale,
            titleId: `${id}-${index}`,
            count: questionDrafts(question).length,
            frozen,
            onDefer: () => {
              focusAt.current = index
              onDefer(question.key)
            },
          }
          if (question.kind === 'year')
            return (
              <QuestionCard
                key={question.key}
                {...card}
                title={S.yearQuestion[locale]}
                legs={question.drafts.map((draft) => {
                  const leg = legs.get(draft.id)
                  return (
                    <li key={draft.id}>
                      <span className="import-code">{leg ? legRoute(leg, locale) : ''}</span>
                      <span>{when(draft)}</span>
                    </li>
                  )
                })}
                choices={
                  <YearChoices
                    locale={locale}
                    years={question.years}
                    today={today}
                    disabled={frozen}
                    onAnswer={(year) =>
                      answer(
                        index,
                        question.drafts.map((draft) => ({
                          draft,
                          change: answerYear(draft, year, today),
                        })),
                      )
                    }
                  />
                }
              />
            )
          const sample = legs.get(question.items[0].draft.id)
          const place = sample?.[question.items[0].endpoint]
          const city = (place ? placeCity(place, locale) : null) ?? cityOf(question.options[0])
          return (
            <QuestionCard
              key={question.key}
              {...card}
              title={S.airportTitle[locale].replace('{city}', city)}
              legs={question.items.map(({ draft, endpoint }) => {
                const leg = legs.get(draft.id)
                const other = endpoint === 'origin' ? leg?.destination : leg?.origin
                const otherText = other ? endpointLabel(other, locale) : '—'
                const gap = <span className="shared-q-gap" aria-label={city} />
                return (
                  <li key={`${draft.id}:${endpoint}`}>
                    <span className="import-code">
                      {endpoint === 'origin' ? (
                        <>
                          {gap} → {otherText}
                        </>
                      ) : (
                        <>
                          {otherText} → {gap}
                        </>
                      )}
                    </span>
                    <span>{when(draft)}</span>
                  </li>
                )
              })}
              choices={
                <AirportChoices
                  options={question.options}
                  disabled={frozen}
                  onPick={(code) =>
                    answer(
                      index,
                      question.items.map(({ draft, endpoint }) => ({
                        draft,
                        change: answerAirport(draft, endpoint, code, today),
                      })),
                    )
                  }
                />
              }
            />
          )
        })}
      </ol>
    </section>
  )
}
