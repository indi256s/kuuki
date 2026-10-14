'use client'

import { Check, Circle, LoaderCircle, CircleAlert } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import { formatDateOnly, type Locale } from '../../lib/format'
import { FeedbackText } from '../ui/feedback-text'
import { Button } from '../ui/button'
import { Announcer } from './announcer'
import { useImportRunsStore } from './import-runs'
import { S, STAGE_KEY, count, progressLabel, tx } from './copy'
import type { Batch, BatchStage, Draft } from './import-types'

const ORDER: BatchStage[] = ['accepted', 'recognizing', 'validating', 'review_ready']
/** The stages shown; `review_ready` is the hand-off to the review page, not a step of its own. */
export const SHOWN = ORDER.slice(0, 3)
export type StageState = 'done' | 'active' | 'pending'
/** Where the shown stage at `position` stands while the batch is at `stage`. */
export function stageState(position: number, stage: BatchStage | null): StageState {
  if (stage === 'accepted') return position === 0 ? 'done' : 'pending'
  const index = ORDER.indexOf(stage ?? 'accepted')
  return position < index ? 'done' : position === index ? 'active' : 'pending'
}

/** Spoken progress: every stage change at once, found counts at most every few seconds, and the last one when it settles. */
function useAnnouncement(stage: BatchStage | null, found: number, locale: Locale): string {
  const [text, setText] = useState('')
  const announcer = useRef(new Announcer(3000))
  useEffect(() => {
    const timers: number[] = []
    const speak = (heard: { stage: string | null; found?: number } | null) => {
      if (!heard) return
      const stageText = progressLabel(locale, heard.stage as BatchStage | null)
      timers.push(
        window.setTimeout(
          () =>
            setText(
              [stageText, heard.found ? count(locale, 'found', heard.found) : '']
                .filter(Boolean)
                .join('. '),
            ),
          0,
        ),
      )
    }
    speak(announcer.current.next({ stage, found }, Date.now()))
    const wait = announcer.current.dueIn(Date.now())
    if (wait !== null)
      timers.push(window.setTimeout(() => speak(announcer.current.flush(Date.now())), wait))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [stage, found, locale])
  return text
}

export function ProgressStep({
  locale,
  batch,
  drafts,
  sourceName,
  onCancel,
  cancelling,
  error,
}: {
  locale: Locale
  batch: Batch | null
  drafts: Draft[]
  sourceName: string | null
  onCancel: () => void
  cancelling: boolean
  error: string | null
}) {
  const stage = batch ? (batch.stage ?? 'accepted') : null
  const announcement = useAnnouncement(stage, drafts.length, locale)
  // The shell's runs exist only where the job worker is bound: there the dock carries the batch once this page is left.
  const bound = useImportRunsStore() !== null
  return (
    <section className="import-progress" aria-labelledby="import-progress-title">
      <h2 id="import-progress-title">{progressLabel(locale, stage)}</h2>
      <p className="import-source-chip">
        <span>{S.sourceChip[locale]}:</span>{' '}
        <strong>{sourceName ?? batch?.sourceLabel ?? S.textSource[locale]}</strong>
      </p>
      <ol className="import-stages" aria-label={S.stagesLabel[locale]}>
        {SHOWN.map((name, position) => {
          const state = stageState(position, stage)
          const Icon = state === 'done' ? Check : state === 'active' ? LoaderCircle : Circle
          return (
            <li
              key={name}
              data-state={state}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="import-stage-marker" aria-hidden="true">
                <Icon size={14} strokeWidth={2} />
              </span>
              <span className="import-stage-copy">
                <span>
                  {name === 'accepted' && !batch
                    ? S.stagePreparing[locale]
                    : tx(locale, STAGE_KEY[name])}
                </span>
                <span className="import-stage-state">
                  <FeedbackText fast locale={locale}>
                    {state === 'done'
                      ? S.stateDone[locale]
                      : state === 'active'
                        ? S.stateActive[locale]
                        : S.statePending[locale]}
                  </FeedbackText>
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <h3 className="import-found-title">
        {S.foundRows[locale]}:{' '}
        <span className="import-count">
          <FeedbackText numbers locale={locale}>
            {count(locale, 'flightsN', drafts.length)}
          </FeedbackText>
        </span>
      </h3>
      {drafts.length > 0 ? (
        <ul className="import-found">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <span className="import-code">
                {draft.fields.origin || '—'} → {draft.fields.destination || '—'}
              </span>
              <span className="import-found-detail">
                {draft.fields.flight_number ? (
                  <span className="import-code">{draft.fields.flight_number}</span>
                ) : null}
                <span>
                  {draft.fields.date
                    ? formatDateOnly(locale, draft.fields.date, 'medium')
                    : S.noDate[locale]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="import-hint">{bound ? S.progressBound[locale] : S.leaveSafe[locale]}</p>
      {error ? (
        <p className="import-problem" role="alert">
          <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="import-actions">
        <Button loading={cancelling} loadingLabel={S.cancelling[locale]} onClick={onCancel}>
          {S.cancelRun[locale]}
        </Button>
      </div>
    </section>
  )
}
