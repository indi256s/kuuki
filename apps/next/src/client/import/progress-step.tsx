'use client'

import { Check, Circle, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatDateOnly, formatNumber, type Locale } from '../../lib/format'
import { FeedbackText } from '../ui/feedback-text'
import { Button } from '../ui/button'
import { Announcer } from './announcer'
import { S, STAGE_KEY, count, tx } from './copy'
import type { Batch, BatchStage, Draft } from './import-types'

const ORDER: BatchStage[] = ['accepted', 'recognizing', 'validating', 'review_ready']
/** The stages shown; `review_ready` is the hand-off to the review page, not a step of its own. */
const SHOWN = ORDER.slice(0, 3)

/** Spoken progress: every stage change at once, found counts at most every few seconds, and the last one when it settles. */
function useAnnouncement(stage: BatchStage | null, found: number, locale: Locale): string {
  const [text, setText] = useState('')
  const announcer = useRef(new Announcer(3000))
  useEffect(() => {
    const timers: number[] = []
    const speak = (heard: { stage: string | null; found?: number } | null) => {
      if (!heard) return
      const stageText = heard.stage ? tx(locale, STAGE_KEY[heard.stage as BatchStage]) : ''
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
  const stage = batch?.stage ?? 'accepted'
  const index = ORDER.indexOf(stage)
  // Honest progress: only stages that have finished count. The service reports no total for the rows still to be found.
  const finished = Math.min(index, SHOWN.length)
  const announcement = useAnnouncement(batch ? stage : null, drafts.length, locale)
  const [initial] = useState(() => new Set(drafts.map((draft) => draft.id)))
  return (
    <section className="import-progress" aria-labelledby="import-progress-title">
      <h2 id="import-progress-title">{S.recognizing[locale]}</h2>
      <p className="import-source-chip">
        <span>{S.sourceChip[locale]}:</span>{' '}
        <strong>{sourceName ?? batch?.sourceLabel ?? S.textSource[locale]}</strong>
      </p>
      <div
        className="import-progressbar"
        role="progressbar"
        aria-label={S.recognizing[locale]}
        aria-valuemin={0}
        aria-valuemax={SHOWN.length}
        aria-valuenow={finished}
        aria-valuetext={`${formatNumber(locale, finished)} / ${formatNumber(locale, SHOWN.length)} · ${tx(locale, STAGE_KEY[stage])}`}
      >
        <span
          className="import-progressbar-fill"
          style={{ ['--done' as string]: finished / SHOWN.length }}
        />
      </div>
      <ol className="import-stages" aria-label={S.stagesLabel[locale]}>
        {SHOWN.map((name, position) => {
          const state = position < index ? 'done' : position === index ? 'active' : 'pending'
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
              <span>{tx(locale, STAGE_KEY[name])}</span>
              <span className="import-stage-state">
                <FeedbackText fast locale={locale}>
                  {state === 'done'
                    ? S.stateDone[locale]
                    : state === 'active'
                      ? S.stateActive[locale]
                      : S.statePending[locale]}
                </FeedbackText>
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
            {count(locale, 'found', drafts.length)}
          </FeedbackText>
        </span>
      </h3>
      {drafts.length > 0 ? (
        <ul className="import-found">
          {drafts.map((draft, position) => (
            <li
              key={draft.id}
              data-new={initial.has(draft.id) ? undefined : 'true'}
              style={{ ['--stagger' as string]: `${(position % 8) * 40}ms` }}
            >
              <span className="import-code">
                {draft.fields.origin || '—'} → {draft.fields.destination || '—'}
              </span>
              <span>
                {draft.fields.date
                  ? formatDateOnly(locale, draft.fields.date, 'medium')
                  : S.noDate[locale]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="import-hint">{S.leaveSafe[locale]}</p>
      {error ? (
        <p className="import-problem" role="alert">
          {error}
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
