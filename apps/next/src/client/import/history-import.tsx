'use client'
// The Flighty CSV import (ADR 0008): one summary of counts, one question per group, the records that still need an
// answer paged from the server, and one Save that the controller walks in server pages. Everything shown comes from
// the server run, so a refresh lands on the same decisions.
import { X } from '@keyline-icons/react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { findAirportLabel } from '@kuuki/data/airport-labels'
import type { HistoryGroup, HistoryRowAnswers, HistoryRowView } from '@kuuki/shared/flightyHistory'
import { formatDateOnly, formatNumber, type Locale } from '../../lib/format'
import { NavigationLink as Link } from '../navigation-link'
import { airlineChoices, airportChoices } from '../capture/reference-choices'
import { countryNamer } from '../passport/model'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import { Combobox } from '../ui/combobox'
import { DestructiveConfirm } from '../ui/destructive-confirm'
import { Disclosure } from '../ui/disclosure'
import { Field } from '../ui/field'
import { FloatingActionBar } from '../ui/floating-action-bar'
import { SlotText } from '../ui/slot-text'
import { SplitFlap } from '../ui/split-flap'
import { TextShimmer } from '../ui/text-shimmer'
import { historyArchiveHref } from './history-api'
import {
  FIELD,
  FINDING,
  H,
  ISSUE,
  STATE_LABEL,
  failureText,
  groupKind,
  groupQuestion,
  hcount,
} from './history-copy'
import { airlineName } from './reference'
import { StampSection, type NewStamp } from './stamp-section'
import type { HistorySession, HistoryState } from './history-session'

const SUMMARY: Array<keyof typeof STATE_LABEL> = [
  'ready',
  'open',
  'created',
  'duplicate',
  'preserved_only',
  'ignored',
  'removed',
]
const TIME_ISSUES = new Set([
  'INVALID_TIME',
  'UNRESOLVED_TIME',
  'INCONSISTENT_TIMES',
  'DURATION_OUT_OF_RANGE',
])

/** An answered or skipped card or row fades for this long before it leaves the list. */
const LEAVE_MS = 140

type Leaving<T> = { id: string; item: T; leaving: boolean }

/**
 * The list with items that were just removed kept for one fade. Only ids in `fading` (pointer-initiated answers) are
 * kept; a kept item is marked `leaving` and is treated as gone by everything but its own fade.
 */
function useLeaving<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  fading: ReadonlySet<string>,
): Array<Leaving<T> & { index: number }> {
  const [entries, setEntries] = useState<Array<Leaving<T>>>(() =>
    items.map((item) => ({ id: idOf(item), item, leaving: false })),
  )
  let current = entries
  const live = entries.filter((entry) => !entry.leaving)
  if (live.length !== items.length || live.some((entry, index) => entry.item !== items[index])) {
    const next: Array<Leaving<T>> = items.map((item) => ({
      id: idOf(item),
      item,
      leaving: false,
    }))
    let at = 0
    for (const old of entries) {
      const kept = next.findIndex((entry) => entry.id === old.id)
      if (kept >= 0) at = kept + 1
      else if (old.leaving || fading.has(old.id)) next.splice(at++, 0, { ...old, leaving: true })
    }
    current = next
    setEntries(next)
  }
  const hasLeaving = current.some((entry) => entry.leaving)
  useEffect(() => {
    if (!hasLeaving) return
    // The fade is CSS; this releases the item once it has run (or at once if it never started).
    const timer = window.setTimeout(
      () => setEntries((all) => all.filter((entry) => !entry.leaving)),
      LEAVE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [current, hasLeaving])
  // `index` counts only the items still in place (what focus-after counts); a leaving item shares its successor's.
  let placed = 0
  return current.map((entry) => ({ ...entry, index: entry.leaving ? placed : placed++ }))
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const offsetLabel = (minutes: number) => {
  const sign = minutes < 0 ? '−' : '+'
  const abs = Math.abs(minutes)
  const rest = abs % 60
  return `UTC${sign}${Math.floor(abs / 60)}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`
}

export function HistoryImport({
  session,
  locale,
  onClose,
}: {
  session: HistorySession
  locale: Locale
  onClose: () => void
}) {
  const state = useSyncExternalStore(session.subscribe, session.getState, session.getState)
  const { run, failure } = state
  const reselect = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  // After an answer or Skip removes an item, focus moves to the item now in its place, as in QuestionDeck.
  const focusAfter = useRef<{ list: string; index: number; id: string } | null>(null)
  useEffect(() => {
    const target = focusAfter.current
    if (!target || !root.current) return
    // A leaving item is gone already: focus never waits on its fade.
    const liveItems = (list: Element | null) =>
      (list ? Array.from(list.children as HTMLCollectionOf<HTMLElement>) : []).filter(
        (item) => !item.hasAttribute('data-leaving'),
      )
    const items = liveItems(root.current.querySelector(`[data-history-list="${target.list}"]`))
    if (items.some((item) => item.dataset.historyItem === target.id)) {
      // Still there: the answer is on its way, or it failed or left the item open; focus stays put.
      if (!state.busy.has(target.id)) focusAfter.current = null
      return
    }
    focusAfter.current = null
    const focusable = (item: HTMLElement | undefined) =>
      item?.querySelector<HTMLElement>(
        '[data-question-heading], input:not(:disabled), button:not(:disabled)',
      )
    // The item now in its place; when its list emptied, the first item of another list, then Save, then the title:
    // never a section heading, which unmounts with its last item.
    ;(
      focusable(items[Math.min(target.index, items.length - 1)]) ??
      focusable(
        Array.from(root.current.querySelectorAll('[data-history-list]')).flatMap(liveItems)[0],
      ) ??
      root.current.querySelector<HTMLElement>('[data-history-save]') ??
      root.current.querySelector<HTMLElement>('h1')
    )?.focus()
  })
  // Leaving the view stops the wait for the stamps' publication.
  useEffect(() => () => session.stopStamps(), [session])
  // A pointer answer fades its card or row out; a keyboard one (and reduced motion) removes it at once.
  const lastInput = useRef<'pointer' | 'key'>('key')
  // State, not a ref: useLeaving reads it during render.
  const [fading, setFading] = useState<ReadonlySet<string>>(() => new Set())
  const track = (list: string, index: number, id: string) => {
    focusAfter.current = { list, index, id }
    const fade = lastInput.current === 'pointer' && !reducedMotion()
    setFading((prev) => {
      if (prev.has(id) === fade) return prev
      const next = new Set(prev)
      if (fade) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const groups = useLeaving(run?.groups ?? [], (group) => group.group, fading)
  const exceptions = useLeaving(state.exceptions, (row) => row.id, fading)
  const readyRows = useLeaving(state.ready?.rows ?? [], (row) => row.id, fading)
  // The hero flips only when the run finished while this view was open; a reload onto a finished run is static.
  const [wasOpen, setWasOpen] = useState(false)
  if (run && run.status !== 'completed' && run.status !== 'closed' && !wasOpen) setWasOpen(true)
  const arrived = wasOpen && run?.status === 'completed'
  const countryName = useMemo(() => countryNamer(locale), [locale])
  const [initialSettled] = useState(() => state.settled.length)
  const closeReasonId = 'history-close-reason'
  const [confirm, setConfirm] = useState<'erase' | 'discard' | null>(null)
  const open = run ? run.totals.states.needs_review + run.totals.states.error : 0
  const ready = run?.totals.states.ready ?? 0
  const receiving = run?.status === 'receiving'
  const finished = run?.status === 'completed' || run?.status === 'closed'
  const busyRun = state.reading || Boolean(state.upload) || Boolean(state.saving)
  const deciding = state.busy.size > 0
  const stateCount = (key: keyof typeof STATE_LABEL) =>
    key === 'open' ? open : (run?.totals.states[key as 'ready'] ?? 0)
  // The other non-zero states, as "label n" joined by dots.
  const others = (skip: Array<keyof typeof STATE_LABEL>) =>
    SUMMARY.filter((key) => !skip.includes(key) && stateCount(key) > 0)
      .map((key) => `${STATE_LABEL[key][locale]} ${formatNumber(locale, stateCount(key))}`)
      .join(' · ')
  const headline = ready ? (
    <>
      <SlotText value={ready} format={(n) => formatNumber(locale, n)} />
      {` ${hcount(locale, 'recordNoun', ready)} · ${STATE_LABEL.ready[locale]}`}
    </>
  ) : (
    `${hcount(locale, 'records', open)} · ${STATE_LABEL.open[locale]}`
  )
  const rest = others(ready ? ['ready'] : ['open'])
  const created = run?.totals.states.created ?? 0
  const finishedRest = others(['created'])

  return (
    <div
      ref={root}
      className="import-page"
      onPointerDownCapture={() => (lastInput.current = 'pointer')}
      onKeyDownCapture={() => (lastInput.current = 'key')}
    >
      <div className="unified-import-heading">
        <h1 tabIndex={-1}>{state.fileName ?? H.title[locale]}</h1>
        <Button
          variant="ghost"
          aria-label={H.close[locale]}
          disabled={busyRun}
          aria-describedby={busyRun ? closeReasonId : undefined}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </Button>
      </div>
      {busyRun ? (
        <p id={closeReasonId} className="import-hint">
          {H.closeBusy[locale]}
        </p>
      ) : null}
      <p className="import-privacy">{H.privacy[locale]}</p>

      <div aria-live="polite">
        {state.reading ? (
          <TextShimmer>{run ? H.restoring[locale] : H.reading[locale]}</TextShimmer>
        ) : state.upload ? (
          <p className="import-hint">{H.sending[locale]}</p>
        ) : null}
      </div>
      {state.upload ? (
        <div className="history-board">
          {state.upload.years ? (
            <div aria-hidden="true">
              <SplitFlap
                className="history-board-flaps"
                value={
                  state.upload.years.from === state.upload.years.to
                    ? String(state.upload.years.from)
                    : `${state.upload.years.from}–${state.upload.years.to}`
                }
                entering
              />
            </div>
          ) : null}
          <p className="import-hint">
            {formatNumber(locale, state.upload.sent)} {hcount(locale, 'of', state.upload.total)}
          </p>
        </div>
      ) : null}

      {failure ? (
        <Alert
          variant="danger"
          urgent={failure.kind === 'offline' || failure.kind === 'server'}
          title={failureText(locale, failure)}
          action={
            failure.kind === 'offline' || failure.kind === 'server' ? (
              <Button dense onClick={() => void session.retry()}>
                {H.retry[locale]}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {receiving && !state.upload && !state.reading && !session.holdsFile() ? (
        <>
          <Alert
            variant="info"
            title={H.reselect[locale]}
            action={
              <Button dense onClick={() => reselect.current?.click()}>
                {H.chooseAgain[locale]}
              </Button>
            }
          />
          <input
            ref={reselect}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void session.choose(file)
            }}
          />
        </>
      ) : null}

      {run && !receiving ? (
        <>
          {finished ? null : (
            <section aria-labelledby="history-summary">
              <h2 id="history-summary" className="sr-only">
                {H.summary[locale]}
              </h2>
              <p className="import-lead">{headline}</p>
              {rest ? <p className="import-hint">{rest}</p> : null}
              {run.unknownHeaders.length ? (
                <p className="import-hint">
                  {H.unknownColumns[locale]} {run.unknownHeaders.join(', ')}
                </p>
              ) : null}
            </section>
          )}

          {groups.length || state.settled.length ? (
            <section className="import-questions" aria-labelledby="history-questions">
              <h2 id="history-questions" tabIndex={-1}>
                {H.questions[locale]}
              </h2>
              <ul className="import-question-list" data-history-list="questions">
                {groups.map(({ item: group, leaving, index }) => (
                  <GroupQuestion
                    key={group.group}
                    group={group}
                    locale={locale}
                    leaving={leaving}
                    busy={state.busy.has(group.group) || Boolean(state.saving)}
                    onAnswer={(answer) => {
                      track('questions', index, group.group)
                      void session.answerGroup(group, answer)
                    }}
                  />
                ))}
              </ul>
              {state.settled.length ? (
                <ul className="import-question-done">
                  {state.settled.map((entry, index) => (
                    <li
                      key={`${entry.group}:${index}`}
                      data-settled-new={index >= initialSettled || undefined}
                    >
                      {settledLine(locale, entry)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {exceptions.length ? (
            <section aria-labelledby="history-exceptions">
              <h2 id="history-exceptions" tabIndex={-1}>
                {H.exceptions[locale]}
              </h2>
              <ul className="import-rows" data-history-list="exceptions">
                {exceptions.map(({ item: row, leaving, index }) => (
                  <RecordRow
                    key={row.id}
                    row={row}
                    locale={locale}
                    leaving={leaving}
                    busy={state.busy.has(row.id) || Boolean(state.saving)}
                    onPatch={(change) => {
                      track('exceptions', index, row.id)
                      void session.patchRow(row, change)
                    }}
                  />
                ))}
              </ul>
              {state.nextCursor !== null ? (
                <Button variant="ghost" dense onClick={() => void session.more()}>
                  {H.more[locale]}
                </Button>
              ) : null}
            </section>
          ) : null}

          {ready && !finished ? (
            <Disclosure
              layout="row"
              summary={H.readyTitle[locale]}
              description={hcount(locale, 'records', ready)}
              open={state.ready !== null}
              onOpenChange={(next) => {
                if (next) {
                  if (state.ready === null) void session.showReady()
                } else session.hideReady()
              }}
            >
              {state.ready ? (
                <>
                  <ul className="import-rows" data-history-list="ready">
                    {readyRows.map(({ item: row, leaving, index }) => (
                      <RecordRow
                        key={row.id}
                        row={row}
                        locale={locale}
                        leaving={leaving}
                        busy={state.busy.has(row.id) || Boolean(state.saving)}
                        onPatch={(change) => {
                          track('ready', index, row.id)
                          void session.patchRow(row, change)
                        }}
                      />
                    ))}
                  </ul>
                  {state.ready.nextCursor !== null ? (
                    <Button variant="ghost" dense onClick={() => void session.showReady(true)}>
                      {H.more[locale]}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </Disclosure>
          ) : null}

          {finished ? (
            <section className="import-done" aria-labelledby="history-finished">
              <h2 id="history-finished" className="sr-only">
                {H.finished[locale]}
              </h2>
              <p className="import-hero">
                <SplitFlap
                  className="import-hero-count history-hero-flaps"
                  value={formatNumber(locale, created)}
                  entering={arrived}
                />{' '}
                <span className="import-hero-label">{hcount(locale, 'added', created)}</span>
              </p>
              {finishedRest ? <p className="import-hint">{finishedRest}</p> : null}
              <StampSection
                locale={locale}
                publication={state.stamps?.status ?? 'idle'}
                stamps={(state.stamps?.codes ?? []).map((code): NewStamp => ({
                  code,
                  name: countryName(code),
                  eventId: `history:${run.id}:${code}`,
                }))}
                hero={false}
              />
              <div className="import-actions import-final-actions">
                <Link className="ui-button" data-variant="primary" href="/journal">
                  {H.openJournal[locale]}
                </Link>
                {run.sourceErased ? null : (
                  <>
                    <a
                      className="ui-button"
                      data-variant="secondary"
                      href={historyArchiveHref(run.id)}
                      download
                    >
                      {H.archive[locale]}
                    </a>
                    <Button
                      variant="ghost"
                      dense
                      className="import-text-action"
                      onClick={() => setConfirm('erase')}
                    >
                      {H.erase[locale]}
                    </Button>
                  </>
                )}
              </div>
              {run.sourceErased ? (
                <p className="import-hint" role="status">
                  {H.erased[locale]}
                </p>
              ) : null}
            </section>
          ) : (
            <FloatingActionBar
              label={H.summary[locale]}
              countLabel={hcount(locale, 'records', ready)}
            >
              <Button variant="ghost" disabled={busyRun} onClick={() => setConfirm('discard')}>
                {H.discard[locale]}
              </Button>
              <Button
                variant="primary"
                data-history-save
                disabled={!ready || busyRun || deciding}
                loading={Boolean(state.saving)}
                loadingLabel={
                  state.saving
                    ? `${H.saving[locale]} · ${formatNumber(locale, state.saving.done)} ${hcount(locale, 'of', state.saving.total)}`
                    : undefined
                }
                disabledReason={!ready ? H.nothingReady[locale] : undefined}
                onClick={() => void session.save()}
              >
                {hcount(locale, 'save', ready)}
              </Button>
            </FloatingActionBar>
          )}
        </>
      ) : null}

      <DestructiveConfirm
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm === 'erase' ? H.eraseTitle[locale] : H.discardTitle[locale]}
        consequence={
          confirm === 'erase' ? H.eraseConsequence[locale] : H.discardConsequence[locale]
        }
        confirmLabel={confirm === 'erase' ? H.erase[locale] : H.discard[locale]}
        cancelLabel={H.cancel[locale]}
        onConfirm={async () => {
          if (confirm === 'erase') await session.eraseSource()
          else {
            await session.discard()
            onClose()
          }
          setConfirm(null)
        }}
      />
    </div>
  )
}

/** The name shown under an airport or airline code ('' when the reference has none). */
const codeName = (kind: string, code: string) =>
  (kind === 'airport' ? findAirportLabel(code)?.name : airlineName(code)) ?? ''

/** What the owner answered, as short as the question was: the airline or airport code and name, or the choice label. */
function settledAnswer(locale: Locale, group: string, answer: string | boolean | null) {
  const kind = groupKind(group)
  if (kind === 'canceled') return answer ? H.cancelled[locale] : H.flew[locale]
  if (group === 'match:new_since_import') return H.addAllNew[locale]
  if (group === 'match:existing_flight')
    return answer === 'link' ? H.keepJournal[locale] : H.addSeparate[locale]
  if (typeof answer !== 'string') return H.noAirline[locale]
  const name = codeName(kind, answer)
  return name ? `${answer} ${name}` : answer
}

/** What the question was about: the quoted source token, or a name for the token-less groups. */
function settledSubject(locale: Locale, group: string, token: string) {
  if (token) return locale === 'ru' ? `«${token}»` : `“${token}”`
  if (groupKind(group) === 'canceled') return H.emptyField[locale]
  return group === 'match:new_since_import' ? H.matchNew[locale] : H.matchExisting[locale]
}

/** «token» → answer · N records. */
const settledLine = (
  locale: Locale,
  { group, token, answer, rows }: HistoryState['settled'][number],
) =>
  `${settledSubject(locale, group, token)} → ${settledAnswer(locale, group, answer)} · ${hcount(locale, 'records', rows)}`

/** The answer buttons of a question or a record: two equal halves, or an auto-fit grid. */
function AnswerGrid({ pair, children }: { pair: boolean; children: ReactNode }) {
  return (
    <div
      className="import-question-answers"
      data-pair={pair || undefined}
      data-choices={!pair || undefined}
    >
      {children}
    </div>
  )
}

/** A typed airport or airline answer: the shared searchable Combobox, applied the moment a choice is made. */
function ChoiceAnswer({
  label,
  kind,
  locale,
  busy,
  onChoose,
}: {
  label: string
  kind: 'airport' | 'airline'
  locale: Locale
  busy: boolean
  onChoose: (code: string) => void
}) {
  const [value, setValue] = useState('')
  // Leaving the field settles a typed exact code (Combobox does that on blur); here an answer is sent at once, so only
  // an explicit choice sends it, and a click on Skip or another answer is never preceded by this one.
  const blurring = useRef(false)
  return (
    <div
      onBlurCapture={() => {
        blurring.current = true
        queueMicrotask(() => (blurring.current = false))
      }}
    >
      <Combobox
        label={label}
        value={value}
        onChange={setValue}
        choices={kind === 'airport' ? airportChoices(locale) : airlineChoices}
        locale={locale}
        disabled={busy}
        onSelect={(code) => {
          if (!blurring.current) onChoose(code)
        }}
      />
    </div>
  )
}

/** One answer button with the code over its name (an airport or an airline). */
function CandidateButton({
  code,
  name,
  busy,
  onClick,
}: {
  code: string
  name: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <Button disabled={busy} aria-label={name ? `${code}, ${name}` : code} onClick={onClick}>
      <span className="import-airport-choice">
        <span className="import-code import-airport-code">{code}</span>
        <span className="import-airport-name">{name}</span>
      </span>
    </Button>
  )
}

function GroupQuestion({
  group,
  locale,
  busy,
  leaving,
  onAnswer,
}: {
  group: HistoryGroup
  locale: Locale
  busy: boolean
  leaving: boolean
  onAnswer: (answer: string | boolean | null) => void
}) {
  const kind = groupKind(group.group)
  const titleId = useId()
  return (
    <li
      className="import-question"
      role="group"
      aria-labelledby={titleId}
      data-history-item={group.group}
      data-leaving={leaving || undefined}
      inert={leaving || undefined}
    >
      <div className="import-question-head">
        <div className="import-question-title">
          <h3 id={titleId} tabIndex={-1} data-question-heading>
            {groupQuestion(locale, group.group, group.token)}
          </h3>
          <span className="import-question-count">{hcount(locale, 'records', group.rows)}</span>
        </div>
      </div>
      {kind === 'canceled' ? (
        <AnswerGrid pair>
          <Button disabled={busy} onClick={() => onAnswer(false)}>
            {H.flew[locale]}
          </Button>
          <Button disabled={busy} onClick={() => onAnswer(true)}>
            {H.cancelled[locale]}
          </Button>
        </AnswerGrid>
      ) : group.group === 'match:new_since_import' ? (
        <AnswerGrid pair={false}>
          <Button disabled={busy} onClick={() => onAnswer('new')}>
            {H.addAllNew[locale]}
          </Button>
        </AnswerGrid>
      ) : group.group === 'match:existing_flight' ? (
        <AnswerGrid pair>
          <Button disabled={busy} onClick={() => onAnswer('link')}>
            {H.keepJournal[locale]}
          </Button>
          <Button disabled={busy} onClick={() => onAnswer('new')}>
            {H.addSeparate[locale]}
          </Button>
        </AnswerGrid>
      ) : (
        <>
          <AnswerGrid pair={false}>
            {group.candidates.map((candidate) => (
              <CandidateButton
                key={candidate}
                code={candidate}
                name={codeName(kind, candidate)}
                busy={busy}
                onClick={() => onAnswer(candidate)}
              />
            ))}
            {kind === 'airline' ? (
              <Button disabled={busy} onClick={() => onAnswer(null)}>
                {H.noAirline[locale]}
              </Button>
            ) : null}
          </AnswerGrid>
          <ChoiceAnswer
            label={kind === 'airport' ? H.anotherAirport[locale] : H.anotherAirline[locale]}
            kind={kind === 'airport' ? 'airport' : 'airline'}
            locale={locale}
            busy={busy}
            onChoose={onAnswer}
          />
        </>
      )}
    </li>
  )
}

function RecordRow({
  row,
  locale,
  busy,
  leaving,
  onPatch,
}: {
  row: HistoryRowView
  locale: Locale
  busy: boolean
  leaving: boolean
  onPatch: (change: { answers?: HistoryRowAnswers; ignore?: boolean }) => void
}) {
  const { projection } = row
  const { answers } = row
  const routeId = useId()
  const answer = (change: HistoryRowAnswers) => onPatch({ answers: { ...answers, ...change } })
  const own = row.issues.filter((issue) => !issue.group)
  const has = (code: string) => own.some((issue) => issue.code === code)
  const ambiguous = own.filter(
    (issue) => issue.code === 'AMBIGUOUS_TIME' && issue.header && issue.offsets,
  )
  const timeIssue = own.some((issue) => TIME_ISSUES.has(issue.code))
  const airports = own.filter(
    (issue) =>
      (issue.code === 'MISSING_AIRPORT' || issue.code === 'UNKNOWN_AIRPORT') &&
      (issue.field === 'origin' || issue.field === 'destination' || issue.field === 'diversion'),
  )
  const finding = !row.issues.length && row.finding ? row.finding : null
  const offsets = answers.times && answers.times !== 'drop' ? answers.times.offsets : {}
  const flight = [projection.airline, projection.flightNumber].filter(Boolean).join(' ')
  const buttons: ReactNode[] = [
    ...ambiguous.flatMap((issue) =>
      issue.offsets!.map((offset) => (
        <Button
          key={`${issue.header}:${offset}`}
          disabled={busy}
          aria-pressed={offsets[issue.header!] === offset}
          onClick={() => answer({ times: { offsets: { ...offsets, [issue.header!]: offset } } })}
        >
          <span className="import-code">{offsetLabel(offset)}</span>
        </Button>
      )),
    ),
    ...(timeIssue || ambiguous.length
      ? [
          <Button key="drop" disabled={busy} onClick={() => answer({ times: 'drop' })}>
            {H.dropTimes[locale]}
          </Button>,
        ]
      : []),
    ...(has('INVALID_FLIGHT_NUMBER')
      ? [
          <Button key="number" disabled={busy} onClick={() => answer({ flightNumber: null })}>
            {H.noFlightNumber[locale]}
          </Button>,
        ]
      : []),
    ...(has('UNKNOWN_AIRLINE')
      ? [
          <Button key="airline" disabled={busy} onClick={() => answer({ airline: null })}>
            {H.noAirline[locale]}
          </Button>,
        ]
      : []),
    ...(has('UNKNOWN_CANCELED')
      ? [
          <Button key="flew" disabled={busy} onClick={() => answer({ canceled: false })}>
            {H.flew[locale]}
          </Button>,
          <Button key="cancelled" disabled={busy} onClick={() => answer({ canceled: true })}>
            {H.cancelled[locale]}
          </Button>,
        ]
      : []),
    ...(finding
      ? [
          <Button key="new" disabled={busy} onClick={() => answer({ match: 'new' })}>
            {H.addNew[locale]}
          </Button>,
          ...(finding.flightId !== null && finding.kind !== 'previous_deleted'
            ? [
                <Button key="link" disabled={busy} onClick={() => answer({ match: 'link' })}>
                  {H.link[locale]}
                </Button>,
              ]
            : []),
        ]
      : []),
  ]
  return (
    <li
      className="import-row"
      role="group"
      aria-labelledby={routeId}
      data-history-item={row.id}
      data-leaving={leaving || undefined}
      inert={leaving || undefined}
    >
      <div className="import-row-main">
        <div className="import-row-body">
          <p id={routeId} className="import-row-route">
            <span className="import-code">{projection.origin || '—'}</span>
            <span aria-hidden="true"> → </span>
            <span className="sr-only"> {H.to[locale]} </span>
            <span className="import-code">{projection.destination || '—'}</span>
          </p>
          <p className="import-row-meta">
            {projection.date ? <span>{formatDateOnly(locale, projection.date)}</span> : null}
            {flight ? <span>{flight}</span> : null}
            <span>
              {H.line[locale]} {row.line}
            </span>
          </p>
        </div>
      </div>
      {row.issues.map((issue, index) => (
        <p key={index} className="import-note">
          {ISSUE[issue.code][locale]} {issue.group ? H.answeredAbove[locale] : null}
        </p>
      ))}
      {finding ? <p className="import-note">{FINDING[finding.kind][locale]}</p> : null}
      {has('INVALID_DATE') ? (
        <DateAnswer locale={locale} busy={busy} onApply={(date) => answer({ date })} />
      ) : null}
      {airports.map((issue) => (
        <ChoiceAnswer
          key={issue.field}
          label={FIELD[issue.field as 'origin'][locale]}
          kind="airport"
          locale={locale}
          busy={busy}
          onChoose={(code) => answer({ [issue.field as 'origin']: code })}
        />
      ))}
      {buttons.length ? <AnswerGrid pair={buttons.length === 2}>{buttons}</AnswerGrid> : null}
      <Button
        variant="ghost"
        dense
        className="import-text-action"
        disabled={busy}
        onClick={() => onPatch({ ignore: true })}
      >
        {H.skip[locale]}
      </Button>
    </li>
  )
}

/** A corrected date with its own Apply. */
function DateAnswer({
  locale,
  busy,
  onApply,
}: {
  locale: Locale
  busy: boolean
  onApply: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return (
    <form
      className="import-question-year"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && !busy) onApply(value)
      }}
    >
      <Field
        type="date"
        label={H.date[locale]}
        value={value}
        autoComplete="off"
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" dense disabled={!valid || busy}>
        {H.apply[locale]}
      </Button>
    </form>
  )
}
