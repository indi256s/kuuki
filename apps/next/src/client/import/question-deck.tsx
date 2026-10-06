'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { findAirport } from '@kuuki/data/airport-lookup'
import { formatDateOnly, type Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { S, count } from './copy'
import type { DraftChange, SaveState } from './draft-saver'
import type { Draft } from './import-types'
import { answerAirport, answerFlown, answerNoAirline, answerNotFlown, answerRestore, answerYear, buildQuestions, monthDayOf, questionDrafts, type Endpoint, type Question } from './questions'
import { cityOf } from './reference'

export interface QuestionDeckProps {
  locale: Locale
  /** Review rows as shown: the stored drafts with unsent changes laid over them. */
  drafts: Draft[]
  saveStates: Record<string, SaveState>
  /** Rows chosen for import right now, for the header line. */
  readyCount: number
  /** The import is being saved: answers wait, like row edits. */
  frozen: boolean
  /** The member's calendar day, YYYY-MM-DD; tests pin it. */
  today?: string
  onChange: (draft: Draft, change: DraftChange) => void
  onRetry: (id: string) => void
}

interface Resolved { key: string; label: string; ids: string[] }

/** «26 марта» / "26 March": a printed day without its year, formatted in a fixed leap year so 29 February survives. */
export function formatMonthDay(locale: Locale, monthDay: { month: number; day: number }): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, monthDay.month - 1, monthDay.day, 12)))
}

const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }

export function QuestionDeck({ locale, drafts, saveStates, readyCount, frozen, today = localToday(), onChange, onRetry }: QuestionDeckProps) {
  const id = useId()
  const questions = useMemo(() => buildQuestions(drafts, today), [drafts, today])
  const [deferred, setDeferred] = useState<ReadonlySet<string>>(new Set())
  const [resolved, setResolved] = useState<Resolved[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  // Set by an answer; read by the effect after the next render, when the answered question has left the list.
  const focusAt = useRef<number | null>(null)
  const root = useRef<HTMLElement>(null)
  const shown = questions.filter(question => !deferred.has(question.key))
  const byId = useMemo(() => new Map(drafts.map(draft => [draft.id, draft])), [drafts])
  const skippedRows = skipped.map(rowId => byId.get(rowId)).filter((draft): draft is Draft => draft?.status === 'dismissed')

  // After an answer, focus moves to the question now in that place, or to the deck heading when none is left.
  useEffect(() => {
    if (focusAt.current === null || !root.current) return
    const headings = root.current.querySelectorAll<HTMLElement>('[data-question-heading]')
    ;(headings[Math.min(focusAt.current, headings.length - 1)] ?? root.current.querySelector<HTMLElement>('h3'))?.focus()
    focusAt.current = null
  })

  // Kept while the last answer's announcement is live, so focus has somewhere to land.
  if (shown.length === 0 && resolved.length === 0 && skippedRows.length === 0 && !notice) return null

  const route = (draft: Draft, gap?: Endpoint) => `${gap === 'origin' ? '?' : draft.fields.origin || '—'} → ${gap === 'destination' ? '?' : draft.fields.destination || '—'}`
  const when = (draft: Draft) => {
    const monthDay = monthDayOf(draft)
    return draft.fields.date ? formatDateOnly(locale, draft.fields.date, 'medium') : monthDay ? formatMonthDay(locale, monthDay) : S.noDate[locale]
  }
  const saving = (rows: Draft[]) => rows.some(draft => saveStates[draft.id]?.status === 'saving')
  const failedIds = (ids: string[]) => ids.filter(rowId => { const state = saveStates[rowId]; return state && state.status !== 'saving' })
  const remaining = shown.reduce((total, question) => total + questionDrafts(question).length, 0)

  const apply = (index: number, entries: { draft: Draft; change: DraftChange | null }[], resolution: { key: string; label: string } | null, note?: string) => {
    const sent = entries.filter((entry): entry is { draft: Draft; change: DraftChange } => entry.change !== null)
    for (const { draft, change } of sent) onChange(draft, change)
    if (resolution) setResolved(current => [...current.filter(item => item.key !== resolution.key), { ...resolution, ids: sent.map(entry => entry.draft.id) }])
    setNotice(resolution ? `${resolution.label}: ${count(locale, 'flightsN', sent.length)}.` : note ?? '')
    focusAt.current = index
  }

  const flightList = (rows: Draft[]) => <ul className="import-question-flights">
    {rows.map(draft => <li key={draft.id}><span className="import-code">{route(draft)}</span> <span>{when(draft)}</span></li>)}
  </ul>

  const card = (question: Question, index: number) => {
    const titleId = `${id}-${question.key}`
    const rows = questionDrafts(question)
    const busy = frozen || saving(rows)
    const each = <Button variant="ghost" dense disabled={busy} onClick={() => { focusAt.current = index; setDeferred(current => new Set(current).add(question.key)) }}>{S.questionsEach[locale]}</Button>
    const heading = (text: string) => <h4 id={titleId} tabIndex={-1} data-question-heading>{text}</h4>

    if (question.kind === 'year') {
      return <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
        {heading(count(locale, 'yearTitle', question.drafts.length))}
        <p className="import-question-ask">{S.yearQuestion[locale]}</p>
        <p className="import-hint">{S.yearBody[locale]}</p>
        {flightList(question.drafts)}
        <div className="import-actions">
          {question.years.map(year => <Button key={year} dense disabled={busy}
            onClick={() => apply(index, question.drafts.map(draft => ({ draft, change: answerYear(draft, year) })), { key: question.key, label: S.yearDone[locale].replace('{year}', String(year)) })}>{year}</Button>)}
          <OtherYear locale={locale} max={question.years[0] + 1} disabled={busy}
            onApply={year => apply(index, question.drafts.map(draft => ({ draft, change: answerYear(draft, year) })), { key: question.key, label: S.yearDone[locale].replace('{year}', String(year)) })} />
          {each}
        </div>
      </li>
    }

    if (question.kind === 'airline') {
      return <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
        {heading(count(locale, 'airlineTitle', question.drafts.length))}
        <p className="import-question-ask">{S.airlineQuestion[locale]}</p>
        <p className="import-hint">{S.airlineBody[locale]}</p>
        {flightList(question.drafts)}
        <div className="import-actions">
          <Button dense disabled={busy} onClick={() => apply(index, question.drafts.map(draft => ({ draft, change: answerNoAirline(draft) })), { key: question.key, label: S.airlineDone[locale] })}>{S.airlineAnswer[locale]}</Button>
          {each}
        </div>
      </li>
    }

    if (question.kind === 'airport') {
      const city = cityOf(question.options[0])
      return <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
        {heading(S.airportTitle[locale].replace('{city}', city))}
        <p className="import-hint">{S.airportBody[locale]}</p>
        <ul className="import-question-items">
          {question.items.map(({ draft, endpoint }) => {
            const itemId = `${titleId}-${draft.id}-${endpoint}`
            const rowBusy = frozen || saving([draft])
            return <li key={`${draft.id}:${endpoint}`} role="group" aria-labelledby={itemId}>
              <p id={itemId}><span className="import-code">{route(draft, endpoint)}</span> <span>{when(draft)}</span></p>
              <div className="import-actions">
                {question.options.map(code => <Button key={code} dense disabled={rowBusy} aria-label={`${code}, ${findAirport(code)?.name ?? code}`}
                  onClick={() => apply(index, [{ draft, change: answerAirport(draft, endpoint, code) }], null, `${route({ ...draft, fields: { ...draft.fields, [endpoint]: code } })}.`)}>
                  <span className="import-code">{code}</span> {findAirport(code)?.name ?? ''}
                </Button>)}
              </div>
            </li>
          })}
        </ul>
        <div className="import-actions">{each}</div>
      </li>
    }

    return <li key={question.key} className="import-question" role="group" aria-labelledby={titleId}>
      {heading(count(locale, 'statusTitle', question.drafts.length))}
      <p className="import-question-ask">{S.statusQuestion[locale]}</p>
      <p className="import-hint">{S.statusBody[locale]}</p>
      <ul className="import-question-items">
        {question.drafts.map(draft => {
          const itemId = `${titleId}-${draft.id}`
          const rowBusy = frozen || saving([draft])
          return <li key={draft.id} role="group" aria-labelledby={itemId}>
            <p id={itemId}><span className="import-code">{route(draft)}</span> <span>{when(draft)}</span>{draft.fields.flight_number ? <span className="import-code"> {draft.fields.airline_iata}{draft.fields.flight_number}</span> : null}</p>
            <div className="import-actions">
              <Button dense disabled={rowBusy} onClick={() => apply(index, [{ draft, change: answerFlown() }], null, `${route(draft)}: ${S.statusFlew[locale]}.`)}>{S.statusFlew[locale]}</Button>
              <Button dense variant="ghost" disabled={rowBusy} onClick={() => { setSkipped(current => [...current, draft.id]); apply(index, [{ draft, change: answerNotFlown() }], null, `${route(draft)}: ${S.statusSkipped[locale]}.`) }}>{S.statusNotFlew[locale]}</Button>
            </div>
          </li>
        })}
      </ul>
    </li>
  }

  return <section ref={root} className="import-questions" aria-labelledby={`${id}-title`}>
    <div className="import-questions-head">
      <h3 id={`${id}-title`} tabIndex={-1}>{S.questionsTitle[locale]}</h3>
      <p className="import-hint import-count">
        {count(locale, 'readyN', readyCount)}{shown.length > 0 ? ` · ${count(locale, 'questionsN', shown.length)} ${count(locale, 'forFlights', remaining)}` : ''}
      </p>
    </div>
    {shown.length > 0 ? <ol className="import-question-list">{shown.map(card)}</ol> : null}
    {resolved.length > 0 || skippedRows.length > 0 ? <ul className="import-question-done">
      {resolved.map(item => {
        const failed = failedIds(item.ids)
        return <li key={item.key}>
          <span>{item.label} · {count(locale, 'flightsN', item.ids.length)}</span>
          {saving(item.ids.map(rowId => byId.get(rowId)).filter((draft): draft is Draft => Boolean(draft))) ? <span className="import-hint"> · {S.questionsApplying[locale]}</span> : null}
          {failed.length > 0 ? <span className="import-question-failed"> · {count(locale, 'notApplied', failed.length)} <Button dense disabled={frozen} onClick={() => failed.forEach(rowId => onRetry(rowId))}>{S.questionsRetry[locale]}</Button></span> : null}
        </li>
      })}
      {skippedRows.map(draft => <li key={draft.id}>
        <span><span className="import-code">{route(draft)}</span> {when(draft)} · {S.statusSkipped[locale]}</span>{' '}
        <Button dense variant="ghost" disabled={frozen || saving([draft])} onClick={() => { onChange(draft, answerRestore()); setSkipped(current => current.filter(rowId => rowId !== draft.id)) }}>{S.statusRestore[locale]}</Button>
      </li>)}
    </ul> : null}
    <p className="import-note" role="status">{notice}</p>
  </section>
}

function OtherYear({ locale, max, disabled, onApply }: { locale: Locale; max: number; disabled: boolean; onApply: (year: number) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) input.current?.focus() }, [open])
  if (!open) return <Button dense disabled={disabled} aria-expanded={false} onClick={() => setOpen(true)}>{S.yearOther[locale]}</Button>
  const submit = () => {
    const year = Number(value)
    if (!/^\d{4}$/.test(value) || year < 1950 || year > max) { setError(S.yearInvalid[locale].replace('{max}', String(max))); return }
    onApply(year)
  }
  return <form className="import-question-year" onSubmit={event => { event.preventDefault(); submit() }}>
    <Field ref={input} label={S.yearLabel[locale]} inputMode="numeric" autoComplete="off" maxLength={4} value={value} error={error}
      onChange={event => { setValue(event.target.value.trim()); setError('') }} disabled={disabled} />
    <Button dense type="submit" disabled={disabled}>{S.yearApply[locale]}</Button>
  </form>
}
